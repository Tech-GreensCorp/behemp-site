/**
 * GUARDA — toda variável de integração SEM default chega ao servidor.
 *
 * A CLASSE DE ERRO, e esta é a **terceira** vez que ela aparece:
 *
 *   · 10/09/2026 — `PARCEIRO_ORIGENS_DE_DOCUMENTO` cadastrada no GitHub e ausente do
 *     `deploy.yml`. O documento do parceiro era recusado em produção, e a variável "estava
 *     cadastrada".
 *   · 10/09/2026 — `PARCEIRO_TRANSFERENCIA_ATIVA`, o mesmo. Ganhou um caso em
 *     `a-transferencia-nao-sai-sem-consentimento`.
 *   · 11/09/2026 — `PARCEIRO_GREENS_SEGREDO_CADASTRO`. O guarda anterior **não pegou**, porque
 *     ele media **uma chave pelo nome**. Caso, não classe.
 *
 * 🔴 CADASTRAR O SECRET NO GITHUB NÃO BASTA. O `deploy.yml` escreve uma lista **fixa** de
 * chaves no `.env` do servidor; um secret fora dessa lista fica no GitHub e **nunca chega ao
 * processo**. O sintoma é sempre o mesmo e sempre confuso: o comportamento não acontece, e
 * quem investiga vê a variável cadastrada e conclui que o problema é outro.
 *
 * 🔴 ESTE GUARDA DERIVA DO CÓDIGO, não de uma lista paralela. Ele varre os módulos de
 * integração, extrai cada `process.env.X` e exige a linha `gravar X` no `deploy.yml`. Lista
 * escrita à mão é o que desatualiza e aprova o errado — foi assim que o
 * `contrato-da-ia-e-a-unica-fonte` deixou passar cinco valores em 24/08.
 *
 * ⚠️ TODAS SÃO EXIGIDAS, inclusive as que têm valor de reserva no código.
 *
 * A primeira versão deste guarda tentava adivinhar quais tinham default, procurando `??` ou
 * `||` depois do `process.env`. A heurística quebrou em `?.trim() || '/cadastro'` — o regex
 * parava no parêntese do `trim()` — e o guarda acusou quatro variáveis que funcionam sem o
 * secret. Adivinhar intenção a partir de sintaxe é frágil por natureza.
 *
 * A saída foi mudar a regra, não refinar a adivinhação: **variável que o código lê deve ser
 * configurável em produção**. `gravar` com valor vazio **não sobrescreve** (linha 148 do
 * `deploy.yml`), então listar uma variável que ainda não tem secret não muda nada — e no dia
 * em que alguém precisar ajustá-la, é um secret, não um deploy.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const RAIZ = process.cwd();

/** Onde vivem as integrações que dependem de ambiente. */
const AREAS = [
  'lib/parceiros',
  'lib/chatpro',
  'app/api/parceiros',
  'app/api/chatpro',
  'lib/anvisa',
];

function arquivosDe(dir: string): string[] {
  const cheio = path.join(RAIZ, dir);
  let entradas: string[];
  try {
    entradas = readdirSync(cheio);
  } catch {
    return [];
  }
  return entradas.flatMap((nome) => {
    const alvo = path.join(cheio, nome);
    if (statSync(alvo).isDirectory()) return arquivosDe(path.join(dir, nome));
    return alvo.endsWith('.ts') || alvo.endsWith('.tsx') ? [alvo] : [];
  });
}

const arquivos = AREAS.flatMap(arquivosDe);

/**
 * Extrai as variáveis lidas, separando as que têm valor de reserva.
 *
 * ⚠️ Comentário não conta: um módulo que EXPLICA por que não usa uma variável não pode ser
 * acusado de usá-la. É "menção vs uso", a décima sétima vez neste repositório.
 */
function variaveisDe(fonte: string): Set<string> {
  const codigo = fonte
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l))
    .join('\n');

  const lidas = new Set<string>();

  const direto = /process\.env\.([A-Z0-9_]+)/g;
  let m: RegExpExecArray | null;
  while ((m = direto.exec(codigo))) lidas.add(m[1]);

  /**
   * 🔴 E O ACESSO INDIRETO — achado por sabotagem em 11/09/2026.
   *
   * `lib/chatpro/contas.ts` declara o nome da variável como STRING (`variavel:
   * 'CHATPRO_INTAKE_SECRET_GREENS'`) e lê por `process.env[conta.variavel]`. Removê-la do
   * `deploy.yml` passava verde: o guarda só procurava `process.env.X` literal, e a conta da
   * Greens teria deixado de autenticar em produção sem ninguém saber.
   *
   * Continua sendo derivação da FONTE, não lista paralela: o nome sai do arquivo que o usa.
   */
  const indireto = /variavel:\s*'([A-Z0-9_]+)'/g;
  while ((m = indireto.exec(codigo))) lidas.add(m[1]);

  return lidas;
}

const lidas = new Set<string>(arquivos.flatMap((f) => [...variaveisDe(readFileSync(f, 'utf8'))]));

const deploy = readFileSync(path.join(RAIZ, '.github/workflows/deploy.yml'), 'utf8');

/** `NEXT_PUBLIC_*` é substituída no BUILD — tem guarda próprio, e não se escreve no `.env`. */
const FORA = new Set(['NODE_ENV']);

// ─────────────────────────────────────────────────────────────────────────────
describe('o guarda tem o que medir', () => {
  it('varre arquivos de verdade', () => {
    expect(arquivos.length).toBeGreaterThan(10);
  });

  it('e acha variáveis de verdade', () => {
    expect(lidas.size).toBeGreaterThan(3);
  });

  it('o deploy tem a função que escreve o .env', () => {
    expect(deploy).toMatch(/gravar\(\)|gravar /);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('toda variável de integração chega ao servidor', () => {
  const obrigatorias = [...lidas]
    .filter((v) => !FORA.has(v))
    .filter((v) => !v.startsWith('NEXT_PUBLIC_'))
    .sort();

  it.each(obrigatorias)('%s está no deploy.yml', (variavel) => {
    expect(
      new RegExp(`gravar ${variavel}\\s`).test(deploy),
      `${variavel} é lida sem valor de reserva e NÃO está no deploy.yml — ` +
        `ela ficaria cadastrada no GitHub e nunca chegaria ao processo. ` +
        `Acrescente: gravar ${variavel} "\${{ secrets.${variavel} }}"`,
    ).toBe(true);
  });

  /**
   * 🔴 O PAR DO S2, nomeado, porque é o que originou este guarda e o que não pode sumir sem
   * alguém perceber.
   */
  /**
   * 🔴 O SEGREDO DA CONTA DA GREENS, nomeado, porque foi o que a sabotagem achou: ele é lido
   * por acesso indireto e passou despercebido pela primeira versão deste guarda.
   */
  it('o segredo da conta da Greens no ChatPro está lá', () => {
    expect(deploy).toMatch(/gravar CHATPRO_INTAKE_SECRET_GREENS\s+"\$\{\{ secrets\./);
  });

  it('o segredo do cadastro (S2) está lá', () => {
    expect(deploy).toMatch(/gravar PARCEIRO_GREENS_SEGREDO_CADASTRO\s+"\$\{\{ secrets\./);
  });

  it('e o segredo do aviso (S1) continua — um não substitui o outro', () => {
    expect(deploy).toMatch(/gravar PARCEIRO_GREENS_SEGREDO_SAIDA\s+"\$\{\{ secrets\./);
  });
});
