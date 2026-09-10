#!/usr/bin/env node
/**
 * O QUE FAZ
 * ---------
 * Copia para o `.env` do standalone as variáveis que hoje existem SÓ dentro do processo do
 * PM2 — herdadas de um `pm2 start` manual antigo e guardadas no `dump.pm2`.
 *
 * POR QUE EXISTE
 * --------------
 * Medido em 10/09/2026: o deploy escreve 12 variáveis no `.env`, e o schema do app
 * (`lib/env.ts`) declara 61. As outras 49 — entre elas `CLERK_SECRET_KEY`, `BREVO_API_KEY`,
 * `PUSHER_SECRET`, `DOCUSIGN_*` — nunca foram escritas em lugar nenhum: elas vivem apenas na
 * memória do processo em execução.
 *
 * Enquanto o deploy só faz `pm2 restart`, isso não incomoda: restart mantém o ambiente. Mas
 * `pm2 restart` NÃO atualiza o caminho do script (Unitech/pm2#3054), e é por isso que o
 * processo em produção continua servindo um build antigo. Corrigir exige `pm2 delete` +
 * `pm2 start` — e um processo novo nasce só com o que estiver no ambiente do shell.
 *
 * Sem este script, o `pm2 delete` derruba a produção inteira para HTTP 500: sem
 * `CLERK_SECRET_KEY`, o middleware do Clerk falha em TODA rota, inclusive as públicas
 * (reproduzido localmente no mesmo dia).
 *
 * COMO SE DESFAZ
 * --------------
 * Ele só ACRESCENTA linhas ao `.env`, e grava antes uma cópia do estado do PM2 em
 * `~/.pm2-backup-<timestamp>.json`. Para voltar atrás: apagar as linhas marcadas com o
 * comentário `# vindo do processo PM2` do `.env`.
 *
 * É IDEMPOTENTE
 * -------------
 * Sim. Só escreve chave que ainda não está no `.env`; rodar de novo não faz nada.
 *
 * ⚠️ NUNCA IMPRIME VALOR. Só nomes de variáveis — a saída vai para o log público do Actions.
 */

import fs from 'node:fs';
import path from 'node:path';

import { processoDoPm2 } from './pm2-do-app.mjs';

const APP = process.argv[2] ?? 'behemp-site';
const ENVFILE = path.resolve('.next/standalone/.env');
const SCHEMA = path.resolve('lib/env.ts');

/** As chaves que o app conhece. Só elas são copiadas — PATH, HOME e afins nunca. */
function chavesDoSchema() {
  const texto = fs.readFileSync(SCHEMA, 'utf8');
  const achadas = texto.matchAll(/^ {2}([A-Z][A-Z0-9_]*):\s*z\./gm);
  return new Set([...achadas].map((m) => m[1]));
}

function chavesJaNoArquivo() {
  if (!fs.existsSync(ENVFILE)) return new Set();
  const linhas = fs.readFileSync(ENVFILE, 'utf8').split('\n');
  return new Set(linhas.map((l) => l.match(/^([A-Za-z_][A-Za-z0-9_]*)=/)?.[1]).filter(Boolean));
}

const proc = processoDoPm2(APP);
if (!proc) {
  console.log(`[ambiente] nenhum processo "${APP}" no PM2 — nada a preservar.`);
  process.exit(0);
}

// Retrato do estado atual, antes de qualquer mudança. Fica fora do repositório.
const backup = path.join(
  process.env.HOME ?? '.',
  `.pm2-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
);
try {
  fs.writeFileSync(backup, JSON.stringify(proc, null, 2), { mode: 0o600 });
  console.log(`[ambiente] retrato do processo salvo em ${backup}`);
} catch (erro) {
  console.log(`[ambiente] aviso: não deu para salvar o retrato (${erro.code ?? 'erro'})`);
}

console.log(`[ambiente] caminho do script no PM2: ${proc.pm2_env?.pm_exec_path ?? '(?)'}`);
console.log(`[ambiente] cwd do processo:          ${proc.pm2_env?.pm_cwd ?? '(?)'}`);

const conhecidas = chavesDoSchema();
const jaTem = chavesJaNoArquivo();
const doProcesso = proc.pm2_env ?? {};

const aCopiar = [...conhecidas].filter(
  (k) => !jaTem.has(k) && typeof doProcesso[k] === 'string' && doProcesso[k] !== '',
);

if (aCopiar.length === 0) {
  console.log('[ambiente] ✓ o .env já cobre tudo que o processo tem. Nada a copiar.');
  process.exit(0);
}

const linhas = aCopiar
  .sort()
  .map((k) => `${k}='${String(doProcesso[k]).replace(/'/g, "'\\''")}'`)
  .join('\n');

fs.appendFileSync(
  ENVFILE,
  `\n# vindo do processo PM2 em ${new Date().toISOString()} — ver scripts/preservar-ambiente-do-pm2.mjs\n${linhas}\n`,
);
fs.chmodSync(ENVFILE, 0o600);

console.log(`[ambiente] ✓ ${aCopiar.length} variáveis copiadas do processo para o .env:`);
for (const k of aCopiar.sort()) console.log(`             ${k}`);
console.log('[ambiente]   (nomes apenas — nenhum valor é impresso)');
