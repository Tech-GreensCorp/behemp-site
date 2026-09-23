/**
 * GUARDA — a notificação do Mercado Pago não é forjável, e a rota não confia no que a
 * assinatura não cobre.
 *
 * ## A CLASSE DE ERRO
 *
 * O webhook é a porta pela qual uma consulta passa a `confirmada` SEM ninguém logado. Quem
 * forja uma notificação aceita faz o sistema reler um pagamento — e, se a rota confiasse no
 * corpo, faria o sistema acreditar num pagamento que não existe.
 *
 * ## 🔴 SÃO TRÊS DEFESAS, E NENHUMA BASTA SOZINHA
 *
 * 1. **a assinatura** (`x-signature`, HMAC-SHA256) prova que a notificação veio do MP;
 * 2. **o id assinado é o da URL**, não o do corpo — a doc oficial: o manifesto usa
 *    `data.id_url`. O CORPO NÃO É ASSINADO: uma rota que lesse `corpo.data.id` aceitaria um
 *    corpo adulterado com assinatura legítima;
 * 3. **só a API confirma** — a notificação diz QUAL pagamento olhar; o status vem de
 *    `GET /v1/payments/{id}`, e id, `external_reference` e valor têm de bater.
 *
 * Por isso este guarda EXECUTA `assinatura-webhook.ts` e tem casos ESTRUTURAIS sobre a rota e
 * sobre `notificacoes.ts`: as defesas 2 e 3 não moram no módulo da assinatura, e um guarda que
 * só olhasse para ele ficaria verde com as duas abertas.
 *
 * Formato conferido na doc oficial em 23/09/2026 — ver o cabeçalho de
 * `lib/mercadopago/assinatura-webhook.ts`.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  assinarManifesto,
  lerXSignature,
  manifestoDoWebhook,
  verificarAssinaturaWebhook,
} from '@/lib/mercadopago/assinatura-webhook';

/** Chave de teste. Não é segredo de lugar nenhum. */
const SEGREDO = 'segredo-de-teste-do-webhook';
const TS = '1704908010';
const PAGAMENTO = '123456789';
const REQUEST_ID = 'bb56a2f1-6aae-46ac-982e-9dcd3581d08e';

/** Monta os headers como o MP manda, assinando o que se pedir. */
function headersAssinados(opcoes: {
  dataId?: string | null;
  requestId?: string | null;
  ts?: string;
  segredo?: string;
  xSignature?: string;
}): Headers {
  const ts = opcoes.ts ?? TS;
  const requestId = opcoes.requestId === undefined ? REQUEST_ID : opcoes.requestId;
  const v1 = assinarManifesto(
    manifestoDoWebhook({
      dataId: opcoes.dataId === undefined ? PAGAMENTO : opcoes.dataId,
      requestId,
      ts,
    }),
    opcoes.segredo ?? SEGREDO,
  );
  const h = new Headers({ 'x-signature': opcoes.xSignature ?? `ts=${ts},v1=${v1}` });
  if (requestId) h.set('x-request-id', requestId);
  return h;
}

/** Sem os comentários: os arquivos EXPLICAM os ataques, e menção não é implementação. */
function semComentarios(fonte: string): string {
  return fonte
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l))
    .join('\n');
}
const ler = (p: string) => semComentarios(readFileSync(path.join(process.cwd(), p), 'utf8'));

// ─────────────────────────────────────────────────────────────────────────────
describe('o guarda tem o que medir (vacuidade)', () => {
  it('o caminho feliz FUNCIONA — sem isto, "recusa tudo" passaria por segurança', () => {
    expect(verificarAssinaturaWebhook(headersAssinados({}), PAGAMENTO, SEGREDO)).toEqual({
      valida: true,
    });
  });

  it('o manifesto tem o formato da doc: id, request-id e ts, nesta ordem, com ";" final', () => {
    expect(manifestoDoWebhook({ dataId: PAGAMENTO, requestId: REQUEST_ID, ts: TS })).toBe(
      `id:${PAGAMENTO};request-id:${REQUEST_ID};ts:${TS};`,
    );
  });

  it('a assinatura é um HMAC-SHA256 em hex (64 caracteres), não um campo decorativo', () => {
    expect(assinarManifesto('qualquer', SEGREDO)).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ── Invariante 1 ─────────────────────────────────────────────────────────────
describe('INVARIANTE 1 — sem segredo, recusa TUDO (falha fechada)', () => {
  it.each([
    [undefined, 'ausente'],
    ['', 'vazio'],
    ['   ', 'só espaços'],
  ])('segredo %s (%s) → sem_segredo, mesmo com assinatura "certa"', (segredo, _rotulo) => {
    const r = verificarAssinaturaWebhook(headersAssinados({ segredo: '' }), PAGAMENTO, segredo);
    expect(r).toEqual({ valida: false, motivo: 'sem_segredo' });
  });

  it('e o padrão é MERCADOPAGO_WEBHOOK_SECRET — ausente no ambiente, recusa', () => {
    const antes = process.env.MERCADOPAGO_WEBHOOK_SECRET;
    delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
    try {
      const r = verificarAssinaturaWebhook(headersAssinados({}), PAGAMENTO);
      expect(r).toEqual({ valida: false, motivo: 'sem_segredo' });
    } finally {
      if (antes !== undefined) process.env.MERCADOPAGO_WEBHOOK_SECRET = antes;
    }
  });

  it('assinado com OUTRO segredo é recusado', () => {
    const r = verificarAssinaturaWebhook(
      headersAssinados({ segredo: 'outro-segredo' }),
      PAGAMENTO,
      SEGREDO,
    );
    expect(r).toEqual({ valida: false, motivo: 'assinatura_invalida' });
  });
});

// ── Invariante 2 ─────────────────────────────────────────────────────────────
describe('INVARIANTE 2 — cada parte do manifesto está coberta pela assinatura', () => {
  it('trocar o data.id (a assinatura é de OUTRO pagamento) quebra a assinatura', () => {
    const r = verificarAssinaturaWebhook(headersAssinados({}), '999999999', SEGREDO);
    expect(r).toEqual({ valida: false, motivo: 'assinatura_invalida' });
  });

  it('trocar o x-request-id quebra a assinatura', () => {
    const h = headersAssinados({});
    h.set('x-request-id', 'outro-request-id');
    expect(verificarAssinaturaWebhook(h, PAGAMENTO, SEGREDO).valida).toBe(false);
  });

  it('trocar o ts (mantendo o v1) quebra a assinatura', () => {
    const v1 = lerXSignature(headersAssinados({}).get('x-signature'))!.v1;
    const h = headersAssinados({ xSignature: `ts=1704908011,v1=${v1}` });
    expect(verificarAssinaturaWebhook(h, PAGAMENTO, SEGREDO).valida).toBe(false);
  });

  it('assinatura SEM data.id não vale para uma notificação COM data.id', () => {
    const h = headersAssinados({ dataId: null });
    expect(verificarAssinaturaWebhook(h, PAGAMENTO, SEGREDO).valida).toBe(false);
  });

  it('o que não veio SAI do manifesto (doc: "you must remove them")', () => {
    expect(manifestoDoWebhook({ dataId: null, requestId: null, ts: TS })).toBe(`ts:${TS};`);
    expect(manifestoDoWebhook({ dataId: PAGAMENTO, requestId: '', ts: TS })).toBe(
      `id:${PAGAMENTO};ts:${TS};`,
    );
    const semRequestId = headersAssinados({ requestId: null });
    expect(verificarAssinaturaWebhook(semRequestId, PAGAMENTO, SEGREDO).valida).toBe(true);
  });

  it('id alfanumérico vai em minúsculas (doc: "convert it to lowercase")', () => {
    expect(manifestoDoWebhook({ dataId: 'ABC123', requestId: null, ts: TS })).toBe(
      `id:abc123;ts:${TS};`,
    );
  });
});

// ── Invariante 3 ─────────────────────────────────────────────────────────────
describe('INVARIANTE 3 — cabeçalho malformado é recusado sem lançar', () => {
  it('sem x-signature → cabecalho_ausente', () => {
    const r = verificarAssinaturaWebhook(new Headers(), PAGAMENTO, SEGREDO);
    expect(r).toEqual({ valida: false, motivo: 'cabecalho_ausente' });
  });

  it.each([
    ['v1=abc', 'sem ts'],
    [`ts=${TS}`, 'sem v1'],
    ['ts=agora,v1=abc', 'ts não numérico'],
    ['lixo', 'sem pares'],
  ])('%s (%s) → formato_invalido', (valor) => {
    const r = verificarAssinaturaWebhook(new Headers({ 'x-signature': valor }), PAGAMENTO, SEGREDO);
    expect(r).toEqual({ valida: false, motivo: 'formato_invalido' });
  });

  it('v1 de tamanho errado é recusado — timingSafeEqual LANÇARIA com tamanhos diferentes', () => {
    const h = new Headers({ 'x-signature': `ts=${TS},v1=abc`, 'x-request-id': REQUEST_ID });
    expect(() => verificarAssinaturaWebhook(h, PAGAMENTO, SEGREDO)).not.toThrow();
    expect(verificarAssinaturaWebhook(h, PAGAMENTO, SEGREDO)).toEqual({
      valida: false,
      motivo: 'assinatura_invalida',
    });
  });

  it('ordem e espaços do cabeçalho não importam; v1 em maiúsculas é o mesmo hex', () => {
    const v1 = lerXSignature(headersAssinados({}).get('x-signature'))!.v1;
    const h = headersAssinados({ xSignature: ` v1=${v1.toUpperCase()} , ts=${TS} ` });
    expect(verificarAssinaturaWebhook(h, PAGAMENTO, SEGREDO).valida).toBe(true);
  });
});

// ── Invariante 4 ─────────────────────────────────────────────────────────────
describe('INVARIANTE 4 — a comparação é em tempo constante', () => {
  const modulo = ler('lib/mercadopago/assinatura-webhook.ts');

  it('usa timingSafeEqual', () => {
    expect(modulo).toMatch(/timingSafeEqual\(/);
  });

  it('e não compara a assinatura com === / !== (vaza, pelo tempo, quantos caracteres casaram)', () => {
    expect(modulo).not.toMatch(/(recebida|esperada|v1)\s*[!=]==\s*(recebida|esperada|v1)\b/);
  });
});

// ── A segunda defesa, que NÃO mora na assinatura ─────────────────────────────
describe('🔴 a rota usa o data.id ASSINADO, e o corpo não decide nada', () => {
  const rota = ler('app/api/webhooks/mercadopago/route.ts');

  it('a rota existe e chama verificarAssinaturaWebhook (vacuidade)', () => {
    expect(rota).toContain('verificarAssinaturaWebhook(');
  });

  it('o id conferido vem da QUERY STRING — é o que o MP assina', () => {
    expect(rota).toMatch(/const dataId = params\.get\('data\.id'\)/);
    expect(rota).toMatch(/verificarAssinaturaWebhook\(request\.headers,\s*dataId\)/);
  });

  it('o que se enfileira é o id da URL, nunca o do corpo', () => {
    expect(rota).toMatch(/enfileirarNotificacao\(dataId\)/);
    expect(rota).not.toMatch(/enfileirarNotificacao\([^)]*(corpo|idDoCorpo)/);
  });

  it('corpo com data.id DIVERGENTE do da URL é ignorado antes de enfileirar', () => {
    // A CONDIÇÃO INTEIRA, seguida do return: conferir só o trecho `String(idDoCorpo) !== dataId`
    // deixava passar `if (false && …)` — a sabotagem que achou isto, em 23/09/2026.
    const divergencia = rota.search(
      /if \(idDoCorpo !== undefined && String\(idDoCorpo\) !== dataId\) \{[^}]*?return OK\(\);/,
    );
    const enfileira = rota.indexOf('enfileirarNotificacao(');
    expect(divergencia).toBeGreaterThan(-1);
    expect(divergencia).toBeLessThan(enfileira);
  });

  it('assinatura recusada RESPONDE sem enfileirar — a conferência vem antes da fila', () => {
    const conferencia = rota.indexOf('if (!conferencia.valida) {');
    const enfileira = rota.indexOf('enfileirarNotificacao(');
    expect(conferencia).toBeGreaterThan(-1);
    expect(conferencia).toBeLessThan(enfileira);
    // O bloco da recusa termina em return — sem ele, a execução seguiria para a fila.
    // Corta no `}` do próprio `if` (2 espaços, o corpo da função) — o primeiro `}` solto é o
    // do objeto do `console.warn`, e cortar nele deixava o `return` de fora.
    const bloco = rota.slice(conferencia, rota.indexOf('\n  }', conferencia));
    expect(bloco).toMatch(/return OK\(\);/);
  });

  it('a rota não confirma nada sozinha — só enfileira; quem confirma relê a API', () => {
    expect(rota).not.toContain('confirmarConsultaPaga');
    expect(rota).not.toMatch(/corpo\.(data\??\.)?status/);
  });

  it('falha ao GRAVAR responde 500 — é o único caso em que se quer a reentrega do MP', () => {
    const captura = rota.slice(rota.indexOf('enfileirarNotificacao('));
    expect(captura).toMatch(/catch[\s\S]*?status: 500/);
  });
});

// ── A terceira defesa, e a regra que descarta a aprovação se quebrar ─────────
describe('🔴 só a API confirma, e a segunda notificação do mesmo pagamento não se perde', () => {
  const fila = ler('lib/mercadopago/notificacoes.ts');

  it('enfileirar REENFILEIRA — conflito zera processadoEm (senão a aprovação é descartada)', () => {
    expect(fila).toMatch(/onConflictDoUpdate\(\{[\s\S]*?set: \{ processadoEm: null/);
    expect(fila).not.toContain('onConflictDoNothing');
  });

  it('o processamento relê o pagamento na API do MP com o token do médico', () => {
    expect(fila).toMatch(
      /fetch\(`\$\{URL_DE_PAGAMENTOS\}\/\$\{encodeURIComponent\(mpPaymentId\)\}`/,
    );
    expect(fila).toMatch(/Authorization: `Bearer \$\{conta\.accessToken\}`/);
  });

  it('id, external_reference e valor da API têm de bater com a nossa linha', () => {
    expect(fila).toMatch(/String\(dados\.id\) !== mpPaymentId/);
    expect(fila).toMatch(/dados\.external_reference !== linha\.pagamentoId/);
    expect(fila).toMatch(/Math\.abs\(valorApi - valorNosso\)/);
  });

  it('a reserva da fila é atômica (FOR UPDATE SKIP LOCKED) e sem db.transaction', () => {
    expect(fila).toContain('FOR UPDATE SKIP LOCKED');
    expect(fila).not.toContain('db.transaction(');
  });
});

describe('o processador da fila falha fechado', () => {
  const processar = ler('app/api/mercadopago/processar/route.ts');

  it('sem CRON_SECRET, 503 — nunca um endpoint aberto', () => {
    expect(processar).toMatch(/if \(!segredo\) \{[\s\S]*?status: 503/);
  });

  it('o segredo é comparado em tempo constante, e o errado recebe 401', () => {
    expect(processar).toMatch(
      /if \(!segredosConferem\(recebido, segredo\)\) \{[\s\S]*?status: 401/,
    );
  });
});
