/**
 * GUARDA — o health da integração é inócuo se vazar, e continua respondendo sem autenticação.
 *
 * POR QUE ELE EXISTE: em 11/09/2026 a tela da Greens disse _"Não conseguimos levar você
 * agora"_ enquanto o cadastro nascia aqui normalmente. Investigar do lado **deles** foi um
 * `curl`; do nosso, não havia nenhum — a única forma de saber se o handoff chegou era abrir o
 * Postgres de produção. A simetria foi proposta por eles no §12 do contrato-ponte.
 *
 * 🔴 A TENSÃO QUE ESTE GUARDA PROTEGE. Duas coisas verdadeiras ao mesmo tempo:
 *
 *   1. **Público**, porque a proposta original é nossa: _"um health que exige autenticação
 *      vira mais uma coisa que não funciona na madrugada"_.
 *   2. **Inócuo**, exatamente porque é público: _"um que não exige precisa ser inócuo se
 *      vazar"_.
 *
 * A segunda é a que se perde primeiro. Acrescentar "só o protocolo, para ajudar a investigar"
 * é o passo que transforma um health num vazamento — e é gradual, então ninguém nota.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const CAMINHO = 'app/api/parceiros/health/route.ts';
const fonte = readFileSync(path.join(process.cwd(), CAMINHO), 'utf8');

/** Menção em comentário não é uso — a décima oitava vez desta classe no repositório. */
const codigo = fonte
  .split('\n')
  .filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l))
  .join('\n');

/** O corpo da resposta: é só ele que chega a quem chama. */
const corpo = codigo.slice(codigo.indexOf('return NextResponse.json('), codigo.indexOf('} catch'));

// ─────────────────────────────────────────────────────────────────────────────
describe('responde sem autenticação', () => {
  it('não exige sessão', () => {
    expect(codigo).not.toMatch(/obterUsuarioAtual|auth\(\)|currentUser/);
  });

  it('e a rota está entre as públicas do middleware', () => {
    const mw = readFileSync(path.join(process.cwd(), 'middleware.ts'), 'utf8');
    expect(mw).toContain("'/api/parceiros(.*)'");
  });

  it('mas tem limite de requisição — público não é ilimitado (OWASP API4)', () => {
    expect(codigo).toContain('consumir(');
    expect(codigo).toMatch(/if \(!limite\.permitido\)/);
  });

  it('e não entra em cache', () => {
    expect(codigo).toContain("'cache-control': 'no-store'");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('🔴 o corpo é inócuo — nada que ajude quem não devia estar lendo', () => {
  it('nenhum identificador de solicitação ou paciente', () => {
    for (const proibido of [
      'referralId',
      'solicitacaoId',
      'protocolo',
      'pacienteId',
      'cpf',
      'email',
      'telefone',
      'nomeCompleto',
    ]) {
      expect(corpo, `${proibido} no corpo do health`).not.toContain(proibido);
    }
  });

  it('🔴 nenhum valor de segredo, nem pedaço dele', () => {
    // `Boolean(...)` é o único uso permitido de uma variável de segredo aqui.
    const linhasDeSegredo = corpo.split('\n').filter((l) => /SEGREDO|SECRET/.test(l));
    expect(linhasDeSegredo.length).toBeGreaterThan(0);
    for (const l of linhasDeSegredo) {
      expect(l, l).toMatch(/Boolean\(|\?\.trim\(\)/);
      expect(l, l).not.toMatch(/slice\(|substring\(|sha256|digest\(/);
    }
  });

  it('e nenhuma URL de API vaza — `configurado` diz que existe, não qual é', () => {
    expect(corpo).not.toMatch(/PARCEIRO_GREENS_API_URL\s*[,}]/);
    expect(corpo).toMatch(/configurado: Boolean\(/);
  });

  it('o erro não devolve stack trace nem nome de tabela', () => {
    const capturado = codigo.slice(codigo.indexOf('} catch'));
    expect(capturado).toMatch(/erro: 'Indisponível'/);
    expect(capturado).not.toMatch(/erro\.message|erro\.stack|String\(erro\)/);
  });

  it('e o log do erro também não leva a mensagem crua', () => {
    const capturado = codigo.slice(codigo.indexOf('} catch'));
    expect(capturado).toMatch(/erro instanceof Error \? erro\.name/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('o que ele responde é o que serve para investigar', () => {
  it('a mesma forma que a Greens publica', () => {
    for (const campo of [
      'configurado',
      'ultimoEventoEm',
      'pendentes',
      'falhados',
      'cadastroConfigurado',
    ]) {
      expect(corpo, campo).toContain(`${campo}:`);
    }
  });

  it('🔴 o par do S2 é reportado SEPARADO do S1 — um configurado não implica o outro', () => {
    expect(corpo).toMatch(
      /cadastroConfigurado: Boolean\(\s*process\.env\.PARCEIRO_GREENS_SEGREDO_CADASTRO/,
    );
    expect(corpo).toMatch(/configurado: Boolean\([\s\S]{0,120}PARCEIRO_GREENS_SEGREDO_SAIDA/);
  });

  it('a trava da transferência aparece — é a primeira hipótese de quem investiga', () => {
    expect(corpo).toContain('transferenciaAtiva: transferenciaAtiva()');
  });

  it('e a entrada também: sem o segredo dela, nada que a Greens manda é aceito', () => {
    expect(corpo).toMatch(
      /entradaConfigurada: Boolean\(\s*process\.env\.PARCEIRO_GREENS_SEGREDO_ENTRADA/,
    );
  });

  it('`pendentes` conta o que ainda pode sair, incluindo o que está em voo', () => {
    expect(corpo).toMatch(/quantos\('pendente'\) \+ quantos\('enviando'\)/);
  });

  it('e `falhados` conta o que desistiu — é o número que abre investigação', () => {
    expect(corpo).toMatch(/falhados: quantos\('falhou'\)/);
  });
});
