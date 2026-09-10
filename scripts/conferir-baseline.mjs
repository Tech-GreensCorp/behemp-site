#!/usr/bin/env node
/**
 * Portão de baseline — falha quando a qualidade PIORA, não quando está vermelha.
 * =============================================================================
 *
 * O QUE FAZ
 * Roda lint, Prettier e type-check; compara cada número com o teto de baseline.json.
 * Sai com código 1 se algum número piorou. Se MELHOROU, avisa e ensina a apertar o teto —
 * baseline que só afrouxa não é portão, é decoração.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * Em 20/08/2026 o repositório tinha 210 erros de lint e 360 arquivos fora do Prettier.
 * Um portão que exigisse zero reprovaria todo PR e seria desligado na primeira semana
 * (o mesmo modo de falha da Regra 2 de docs/TECNICA-DOS-GUARDAS.md). Um portão que não
 * existisse deixaria o número 211 passar sem ninguém ver. O teto resolve as duas coisas.
 *
 * POR QUE .mjs E NÃO .ts
 * `tsx` NÃO está em node_modules — os scripts .ts do repo usam `npx tsx`, que baixa da
 * rede a cada execução. Portão de CI que depende de download é portão que cai quando o
 * registry oscila. Node roda .mjs direto, com zero dependência nova.
 *
 * COMO SE DESFAZ
 * Apagar este arquivo e baseline.json, e remover o step do workflow. Não escreve em banco,
 * não toca arquivo de produto, não tem efeito fora do próprio processo.
 *
 * IDEMPOTENTE: sim. Só lê. A única escrita possível é em baseline.json, com --apertar.
 *
 * USO
 *   node scripts/conferir-baseline.mjs             confere e falha se piorou
 *   node scripts/conferir-baseline.mjs --apertar   baixa os tetos que melhoraram
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const APERTAR = process.argv.includes('--apertar');
const arquivo = new URL('../baseline.json', import.meta.url);
const baseline = JSON.parse(readFileSync(arquivo, 'utf8'));

/** Roda o comando e devolve a saída, mesmo quando ele sai com código != 0. */
function saidaDe(comando) {
  try {
    return execSync(comando, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (erro) {
    return `${erro.stdout ?? ''}${erro.stderr ?? ''}`;
  }
}

// Cada medição declara COMO extrai o número, e o que fazer se o formato mudar.
// Formato que muda sem ninguém ver produz "0 erros" silencioso — o modo de falha
// mais perigoso de um portão (teste de vacuidade, §5 da técnica dos guardas).
const MEDICOES = [
  {
    chave: 'lint_erros',
    rotulo: 'erros de lint',
    medir: () => {
      const saida = saidaDe('pnpm lint');
      const m = saida.match(/(\d+) problems? \((\d+) errors?, (\d+) warnings?\)/);
      if (m) return { erros: Number(m[2]), warnings: Number(m[3]) };
      // Sem problema algum, o ESLint não imprime o resumo.
      if (/^\s*$/.test(saida.replace(/^>.*$/gm, ''))) return { erros: 0, warnings: 0 };
      return null;
    },
  },
  {
    chave: 'prettier_arquivos',
    rotulo: 'arquivos fora do Prettier',
    medir: () => {
      const saida = saidaDe('pnpm format:check');
      const m = saida.match(/Code style issues found in (\d+) files?/);
      if (m) return { erros: Number(m[1]) };
      if (/All matched files use Prettier code style/.test(saida)) return { erros: 0 };
      return null;
    },
  },
  {
    chave: 'typecheck_erros',
    rotulo: 'erros de type-check',
    medir: () => {
      const saida = saidaDe('pnpm typecheck');
      return { erros: (saida.match(/error TS\d+/g) ?? []).length };
    },
  },
];

console.log(`Portão de baseline — tetos medidos em ${baseline.medido_em}\n`);

let piorou = false;
let melhorou = false;
const novos = { ...baseline.tetos };

for (const { chave, rotulo, medir } of MEDICOES) {
  const resultado = medir();

  if (resultado === null) {
    console.error(`  ✗ ${rotulo}: NÃO FOI POSSÍVEL MEDIR.`);
    console.error(`    O formato de saída da ferramenta mudou. Conserte a extração deste`);
    console.error(`    script — portão que não sabe medir não pode dizer que está tudo bem.`);
    piorou = true;
    continue;
  }

  const teto = baseline.tetos[chave];
  const atual = resultado.erros;
  const marca = atual > teto ? '✗' : atual < teto ? '↓' : '✓';
  console.log(`  ${marca} ${rotulo}: ${atual} (teto ${teto})`);

  if (atual > teto) {
    console.error(`    PIOROU em ${atual - teto}. Corrija o que seu PR introduziu.`);
    console.error(`    Subir o teto em baseline.json é decisão de quem manda, não do PR.`);
    piorou = true;
  } else if (atual < teto) {
    novos[chave] = atual;
    melhorou = true;
  }

  // Warnings de lint têm teto próprio: são ruído hoje, mas ruído que cresce vira erro.
  if (chave === 'lint_erros' && resultado.warnings !== undefined) {
    const tetoW = baseline.tetos.lint_warnings;
    const marcaW = resultado.warnings > tetoW ? '✗' : resultado.warnings < tetoW ? '↓' : '✓';
    console.log(`  ${marcaW} warnings de lint: ${resultado.warnings} (teto ${tetoW})`);
    if (resultado.warnings > tetoW) {
      console.error(`    PIOROU em ${resultado.warnings - tetoW}.`);
      piorou = true;
    } else if (resultado.warnings < tetoW) {
      novos.lint_warnings = resultado.warnings;
      melhorou = true;
    }
  }
}

if (melhorou) {
  console.log('\n  ↓ Algum número MELHOROU. Aperte o teto para que não volte a subir:');
  console.log('      node scripts/conferir-baseline.mjs --apertar');
  if (APERTAR) {
    writeFileSync(arquivo, `${JSON.stringify({ ...baseline, tetos: novos }, null, 2)}\n`);
    console.log('    baseline.json atualizado. Commite o arquivo junto do PR.');
  }
}

if (piorou) {
  console.error('\nVERMELHO — a baseline piorou.');
  process.exit(1);
}
console.log('\nverde — nada piorou em relação à baseline declarada.');
