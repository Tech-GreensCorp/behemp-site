/**
 * GUARDA — o `state` do OAuth do Mercado Pago não é forjável, não expira mal, e não conta
 * a quem tentou o que deu errado.
 *
 * ## A CLASSE DE ERRO, e ela já está no repositório
 *
 * `app/api/auth/google/callback/route.ts` manda `state: medicoId` **cru**, sem assinatura.
 * Qualquer um forja. Está catalogado, não corrigido, e é o padrão que este guarda impede
 * de ser copiado para o caminho que move dinheiro.
 *
 * O ataque concreto é o **CSRF de OAuth**: o atacante obtém um `code` da conta de Mercado
 * Pago dele e induz o navegador do médico logado a bater no nosso callback. Sem defesa, a
 * linha do médico passa a apontar para a conta do atacante — e o pagamento das consultas
 * daquele médico cai lá.
 *
 * ## 🔴 SÃO DUAS DEFESAS, E NENHUMA BASTA SOZINHA
 *
 * 1. **a assinatura** impede forjar um `state` — mas o atacante consegue um legítimo
 *    pedindo pela nossa própria rota `/conectar`, para ele mesmo;
 * 2. **a comparação com a sessão**, no callback, é o que impede reusar o dele na sessão
 *    de outro. Sem ela, a camada 1 é teatro.
 *
 * Por isso este guarda tem casos que EXECUTAM as funções **e** um caso estrutural sobre a
 * rota: a segunda defesa não vive em `state.ts`, e um guarda que só olhasse o módulo
 * ficaria verde com o buraco aberto.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import {
  JANELA_DO_STATE_EM_SEGUNDOS,
  gerarState,
  stateConfigurado,
  verificarState,
} from '@/lib/mercadopago/state';

/** Chave de teste. Não é segredo de lugar nenhum — 64 hex é só o formato exigido. */
const CHAVE = 'a'.repeat(64);
const OUTRA_CHAVE = 'b'.repeat(64);
const AGORA = 1_790_000_000;
const MEDICO = 'med_abc123';

beforeEach(() => {
  process.env.MERCADOPAGO_TOKEN_ENCRYPTION_KEY = CHAVE;
});

// ─────────────────────────────────────────────────────────────────────────────
describe('o guarda tem o que medir (vacuidade)', () => {
  it('as funções existem e a janela é um número positivo', () => {
    expect(typeof gerarState).toBe('function');
    expect(typeof verificarState).toBe('function');
    expect(JANELA_DO_STATE_EM_SEGUNDOS).toBeGreaterThan(0);
  });

  it('o caminho feliz FUNCIONA — sem isto, "recusa tudo" passaria por segurança', () => {
    const state = gerarState(MEDICO, AGORA);
    const r = verificarState(state, AGORA);
    expect(r.valido).toBe(true);
    expect(r.valido && r.medicoId).toBe(MEDICO);
  });
});

// ── Invariante 1 ─────────────────────────────────────────────────────────────
describe('INVARIANTE 1 — nunca sai um state sem assinatura válida', () => {
  it('sem a chave, gerarState LANÇA em vez de devolver algo inseguro', () => {
    delete process.env.MERCADOPAGO_TOKEN_ENCRYPTION_KEY;
    expect(() => gerarState(MEDICO, AGORA)).toThrow();
    expect(stateConfigurado()).toBe(false);
  });

  it('e verificarState recusa tudo sem a chave — nunca abre por falta de configuração', () => {
    const state = gerarState(MEDICO, AGORA);
    delete process.env.MERCADOPAGO_TOKEN_ENCRYPTION_KEY;
    const r = verificarState(state, AGORA);
    expect(r.valido).toBe(false);
    expect(!r.valido && r.motivo).toBe('sem_segredo');
  });

  it('o state carrega assinatura de tamanho de SHA-256 (64 hex), não um campo decorativo', () => {
    const partes = gerarState(MEDICO, AGORA).split('.');
    expect(partes).toHaveLength(4);
    expect(partes[3]).toMatch(/^[0-9a-f]{64}$/);
  });

  it('dois states do MESMO médico no MESMO segundo diferem — o nonce não é enfeite', () => {
    const vistos = new Set(Array.from({ length: 50 }, () => gerarState(MEDICO, AGORA)));
    expect(vistos.size).toBe(50);
  });

  it('state assinado com OUTRA chave é recusado', () => {
    const state = gerarState(MEDICO, AGORA);
    process.env.MERCADOPAGO_TOKEN_ENCRYPTION_KEY = OUTRA_CHAVE;
    expect(verificarState(state, AGORA).valido).toBe(false);
  });
});

// ── Invariante 2 ─────────────────────────────────────────────────────────────
describe('INVARIANTE 2 — a janela é conferida ANTES da assinatura', () => {
  /**
   * 🔴 A ORDEM É A REGRA, não um detalhe de implementação.
   *
   * Conferir a assinatura primeiro e só então o prazo **conta a quem forjou** que a
   * assinatura estava certa e só o tempo passou — é um oráculo, e ele acelera a busca.
   * Este caso fica vermelho se alguém "melhorar" a função invertendo as duas checagens.
   */
  it('state EXPIRADO e com assinatura ERRADA responde fora_da_janela, não assinatura_invalida', () => {
    const [med, ts, nonce] = gerarState(MEDICO, AGORA).split('.');
    const forjado = `${med}.${ts}.${nonce}.${'0'.repeat(64)}`;
    const r = verificarState(forjado, AGORA + JANELA_DO_STATE_EM_SEGUNDOS + 60);
    expect(r.valido).toBe(false);
    expect(!r.valido && r.motivo).toBe('fora_da_janela');
  });

  it('dentro da janela, o mesmo forjado é recusado por assinatura — prova que o caso acima mede a ORDEM', () => {
    const [med, ts, nonce] = gerarState(MEDICO, AGORA).split('.');
    const forjado = `${med}.${ts}.${nonce}.${'0'.repeat(64)}`;
    const r = verificarState(forjado, AGORA);
    expect(!r.valido && r.motivo).toBe('assinatura_invalida');
  });

  it('expira depois da janela, e vale no limite', () => {
    const state = gerarState(MEDICO, AGORA);
    expect(verificarState(state, AGORA + JANELA_DO_STATE_EM_SEGUNDOS - 1).valido).toBe(true);
    const r = verificarState(state, AGORA + JANELA_DO_STATE_EM_SEGUNDOS + 1);
    expect(!r.valido && r.motivo).toBe('fora_da_janela');
  });

  it('carimbo no FUTURO também é recusado — esticar a janela é a forjadura mais simples', () => {
    const state = gerarState(MEDICO, AGORA);
    const r = verificarState(state, AGORA - JANELA_DO_STATE_EM_SEGUNDOS - 1);
    expect(!r.valido && r.motivo).toBe('fora_da_janela');
  });
});

// ── Invariante 3 ─────────────────────────────────────────────────────────────
describe('INVARIANTE 3 — o medicoId não pode ser trocado', () => {
  it('trocar o medicoId no state quebra a assinatura', () => {
    const [, ts, nonce, sig] = gerarState(MEDICO, AGORA).split('.');
    const r = verificarState(`med_OUTRO.${ts}.${nonce}.${sig}`, AGORA);
    expect(r.valido).toBe(false);
    expect(!r.valido && r.motivo).toBe('assinatura_invalida');
  });

  it('o medicoId devolvido é o assinado, nunca outro', () => {
    const r = verificarState(gerarState('med_XYZ', AGORA), AGORA);
    expect(r.valido && r.medicoId).toBe('med_XYZ');
  });

  it.each([
    ['', 'vazio'],
    ['a.b.c', 'três partes'],
    ['a.b.c.d.e', 'cinco partes'],
    ['med.NAONUMERO.nonce.sig', 'timestamp não numérico'],
  ])('formato inválido (%s) é recusado — %s', (entrada) => {
    expect(verificarState(entrada, AGORA).valido).toBe(false);
  });
});

// ── A segunda defesa, que NÃO mora em state.ts ───────────────────────────────
describe('🔴 o callback compara o state com a SESSÃO — a assinatura sozinha é teatro', () => {
  const rota = readFileSync(
    path.join(process.cwd(), 'app/api/medico/mercadopago/callback/route.ts'),
    'utf8',
  );
  /** Sem os comentários: o arquivo EXPLICA o ataque, e menção não é implementação. */
  const codigo = rota
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l))
    .join('\n');

  it('a rota existe e chama verificarState (vacuidade)', () => {
    expect(codigo).toContain('verificarState');
  });

  it('e COMPARA o medicoId do state com o da sessão — é o que fecha o CSRF de OAuth', () => {
    expect(codigo).toMatch(/conferido\.medicoId\s*!==\s*medico\.id/);
  });

  it('o medicoId da sessão NÃO vem de query param — o que não se recebe não se troca', () => {
    // Só `code`, `state` e `error` são lidos da URL. Um `searchParams.get('medicoId')`
    // aqui seria BOLA (OWASP API1) por uma porta nova.
    const lidos = [...codigo.matchAll(/params\.get\('([^']+)'\)/g)].map((m) => m[1]);
    expect(lidos.sort()).toEqual(['code', 'error', 'state']);
  });

  it('a rota de conectar também resolve o médico pela sessão, não pela URL', () => {
    const conectar = readFileSync(
      path.join(process.cwd(), 'app/api/medico/mercadopago/conectar/route.ts'),
      'utf8',
    );
    expect(conectar).toContain('verificarMedico');
    expect(conectar).not.toMatch(/searchParams\.get\(\s*'medicoId'/);
  });
});
