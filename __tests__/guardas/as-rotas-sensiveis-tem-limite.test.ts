/**
 * GUARDA — as rotas que gastam recurso ou guardam segredo têm limite de requisição.
 *
 * OWASP API4:2023, "Unrestricted Resource Consumption". Levantado pelo dono em 10/09/2026:
 * _"a cybersegurança tem que ser levada em conta pela quantidade de dados sensíveis que
 * estaremos passando"_. A auditoria contra o Top 10 mostrou que este era o ÚNICO item sem
 * defesa alguma — BOLA, autenticação, replay e exposição de propriedade já tinham.
 *
 * 🔴 O QUE UM ENDPOINT SEM LIMITE PERMITE
 *
 * `/api/documentos/<id>/arquivo` responde 404 tanto para "não existe" quanto para "não é
 * seu" — de propósito, para não virar oráculo. Sem limite, alguém percorre ids até achar os
 * que respondem 200.
 *
 * `/greens/cadastro` e `/bot-link` comparam segredo em tempo constante. Tempo constante
 * protege contra ataque de temporização; **não** contra tentar um milhão de vezes — e o custo
 * de cada tentativa é do servidor, não de quem tenta.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { consumir, identificarChamador } from '@/lib/seguranca/limite-de-requisicao';

const raiz = process.cwd();
const ler = (p: string) => readFileSync(path.join(raiz, p), 'utf8');

const ROTAS_QUE_PRECISAM = [
  'app/api/documentos/[id]/arquivo/route.ts',
  'app/api/parceiros/greens/cadastro/route.ts',
  'app/api/chatpro/bot-link/route.ts',
];

describe('o limitador conta e corta', () => {
  let n = 0;
  beforeEach(() => {
    n += 1;
  });

  it('permite até o limite e corta depois', () => {
    const chave = `teste-corta-${n}`;
    expect(consumir(chave, 3, 60).permitido).toBe(true);
    expect(consumir(chave, 3, 60).permitido).toBe(true);
    expect(consumir(chave, 3, 60).permitido).toBe(true);
    expect(consumir(chave, 3, 60).permitido).toBe(false);
  });

  it('conta por chave — um chamador não consome a cota do outro', () => {
    const a = `teste-a-${n}`;
    const b = `teste-b-${n}`;
    expect(consumir(a, 1, 60).permitido).toBe(true);
    expect(consumir(a, 1, 60).permitido).toBe(false);
    // o b continua livre
    expect(consumir(b, 1, 60).permitido).toBe(true);
  });

  it('a janela reabre — o limite é por período, não permanente', () => {
    const chave = `teste-janela-${n}`;
    // janela de 0 s expira imediatamente
    expect(consumir(chave, 1, 0).permitido).toBe(true);
    expect(consumir(chave, 1, 0).permitido).toBe(true);
  });

  it('diz quantas restam e quando reabre — quem chama precisa poder se ajustar', () => {
    const chave = `teste-cabecalho-${n}`;
    const r = consumir(chave, 5, 60);
    expect(r.restantes).toBe(4);
    expect(r.reabreEm).toBeGreaterThan(0);
  });
});

describe('a chave do limite não vira registro de quem acessou o quê', () => {
  it('identifica pelo IP do cabeçalho, com prefixo por rota', () => {
    const h = new Headers({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1' });
    expect(identificarChamador(h, 'doc')).toBe('doc:203.0.113.9');
  });

  it('sem cabeçalho, agrupa em "desconhecido" em vez de falhar', () => {
    expect(identificarChamador(new Headers(), 'doc')).toBe('doc:desconhecido');
  });

  /**
   * ⚠️ O IP VEM DE CABEÇALHO, E CABEÇALHO SE FORJA.
   *
   * Aqui ele AGRUPA requisições, nunca autoriza. Quem forja escapa do próprio limite — não
   * obtém acesso. O código diz isso; este caso impede que alguém passe a usá-lo para decidir
   * permissão.
   */
  it('e a identificação não decide permissão em lugar nenhum', () => {
    const limitador = ler('lib/seguranca/limite-de-requisicao.ts');
    expect(limitador).toMatch(/AGRUPAR requisições, não para autorizar/);
    for (const rota of ROTAS_QUE_PRECISAM) {
      const codigo = ler(rota);
      // identificarChamador só aparece dentro da chamada de `consumir`
      const usos = codigo.match(/identificarChamador\(/g) ?? [];
      expect(usos.length).toBeLessThanOrEqual(1);
    }
  });
});

describe('as três rotas sensíveis aplicam o limite', () => {
  it.each(ROTAS_QUE_PRECISAM.map((r) => [r] as const))('%s', (rota) => {
    const codigo = ler(rota);
    expect(codigo).toContain('consumir(');
    expect(codigo).toContain('429');

    /**
     * 🔴 E O 429 PRECISA SER ALCANÇÁVEL PELO RESULTADO DO LIMITE.
     *
     * Checar que a linha `429` existe não prova nada: trocar `if (!limite.permitido)` por
     * `if (false)` deixa o corte morto e o guarda verde. Foi o que a sabotagem mostrou, em
     * 10/09/2026, antes deste trecho existir.
     *
     * O que importa é a CONDIÇÃO que leva ao 429 vir do limite.
     */
    expect(codigo, `${rota}: o 429 não está condicionado ao limite`).toMatch(
      /if \(!limite\.permitido\) \{/,
    );
  });

  /**
   * 🔴 O LIMITE VEM ANTES DA AUTENTICAÇÃO.
   *
   * Conferir sessão primeiro faz cada tentativa custar uma consulta ao banco — NOSSA, não de
   * quem tenta. É o inverso do que se quer numa defesa contra consumo.
   */
  it('e o limite é a primeira coisa que a rota faz', () => {
    const doc = ler('app/api/documentos/[id]/arquivo/route.ts');
    const limite = doc.indexOf('consumir(');
    const escopo = doc.indexOf('garantirLeitorDoDocumento(');
    expect(limite).toBeGreaterThan(-1);
    expect(limite).toBeLessThan(escopo);
  });

  it('o handoff limita antes de verificar a assinatura', () => {
    const handoff = ler('app/api/parceiros/greens/cadastro/route.ts');
    const limite = handoff.indexOf('consumir(');
    const assinatura = handoff.indexOf('verificarAssinatura(');
    expect(limite).toBeGreaterThan(-1);
    expect(limite).toBeLessThan(assinatura);
  });

  it('a resposta 429 diz quando tentar de novo', () => {
    for (const rota of ROTAS_QUE_PRECISAM) {
      expect(ler(rota), rota).toContain('cabecalhosDoLimite(');
    }
    expect(ler('lib/seguranca/limite-de-requisicao.ts')).toContain("'retry-after'");
  });
});

describe('o limitador não vira o problema que resolve', () => {
  /**
   * ⚠️ Um Map que só cresce estoura a memória do processo — e aí o "limitador" vira o ataque
   * que deveria impedir.
   */
  it('limpa as janelas expiradas', () => {
    const limitador = ler('lib/seguranca/limite-de-requisicao.ts');
    expect(limitador).toContain('function limparExpirados');
    expect(limitador).toContain('janelas.delete(chave)');
  });

  /**
   * 🔴 E O ALCANCE ESTÁ DECLARADO NO CÓDIGO.
   *
   * O contador vive na memória do processo: com duas instâncias, o limite efetivo dobra. Isso
   * precisa estar escrito onde quem lê encontra — senão alguém escala o app e acha que a
   * defesa continua valendo o que valia.
   */
  it('e declara que é por processo, não compartilhado', () => {
    const limitador = ler('lib/seguranca/limite-de-requisicao.ts');
    expect(limitador).toMatch(/MEMÓRIA DO PROCESSO/);
    expect(limitador).toMatch(/duas instâncias/i);
  });
});
