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

/** Lê um arquivo no formato `.env` e devolve um Map de chave -> valor. */
function lerEnv(caminho) {
  const mapa = new Map();
  if (!caminho || !fs.existsSync(caminho)) return mapa;
  for (const linha of fs.readFileSync(caminho, 'utf8').split('\n')) {
    const m = linha.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let valor = m[2].trim();
    if (
      (valor.startsWith("'") && valor.endsWith("'")) ||
      (valor.startsWith('"') && valor.endsWith('"'))
    ) {
      valor = valor.slice(1, -1);
    }
    mapa.set(m[1], valor);
  }
  return mapa;
}

/**
 * TODOS os retratos que este script já salvou, do mais recente para o mais antigo.
 *
 * ⚠️ Não serve pegar só o mais recente: o deploy salva um retrato NOVO a cada execução,
 * e depois da primeira recriação esse retrato já aponta para o diretório de destino.
 * O que interessa é justamente o retrato ANTERIOR, que ainda guarda o diretório antigo.
 */
function retratosAnteriores() {
  const casa = process.env.HOME ?? '.';
  let arquivos;
  try {
    arquivos = fs
      .readdirSync(casa)
      .filter((n) => n.startsWith('.pm2-backup-') && n.endsWith('.json'))
      .sort()
      .reverse();
  } catch {
    return [];
  }
  const retratos = [];
  for (const nome of arquivos.slice(0, 10)) {
    try {
      retratos.push(JSON.parse(fs.readFileSync(path.join(casa, nome), 'utf8')));
    } catch {
      // retrato ilegível não impede os outros
    }
  }
  return retratos;
}

/**
 * 🔴 DE ONDE AS VARIÁVEIS PODEM VIR — E POR QUE SÃO QUATRO FONTES, NÃO UMA.
 *
 * A primeira versão deste script olhava só o `pm2_env` do processo, porque o deploy #37
 * tinha concluído que "o app vive do dump.pm2". Estava errado, e o erro derrubou a
 * produção em 10/09/2026 às 15h37: o processo lia as variáveis de um ARQUIVO `.env`
 * dentro do diretório de onde ele rodava — copiado à mão no dia anterior. O `pm2_env`
 * estava vazio, o script reportou "nada a copiar", e o processo novo nasceu sem
 * CLERK_SECRET_KEY. Toda rota respondeu 500.
 *
 * A lição: a fonte do ambiente não se presume, se procura em todas as que existem.
 */
function fontesDeAmbiente(destinoDir) {
  const fontes = [];
  const vistos = new Set([path.resolve(destinoDir)]);

  /**
   * Arquivo `.env` e ambiente de processo NÃO se tratam igual.
   *
   * Um `.env` é um arquivo de configuração da aplicação: tudo nele é do app, e copiar
   * uma chave que o schema ainda não declara é melhor que perdê-la. Já o ambiente de um
   * processo carrega PATH, HOME, PWD e as variáveis do próprio PM2 — ali o filtro pelo
   * schema é obrigatório.
   */
  const deArquivo = (cwd, rotulo) => {
    if (!cwd) return;
    const dir = path.resolve(cwd);
    if (vistos.has(dir)) return;
    vistos.add(dir);
    const valores = lerEnv(path.join(dir, '.env'));
    if (valores.size > 0) {
      fontes.push({ nome: `${rotulo} ${dir}/.env`, valores, filtrarPeloSchema: false });
    }
  };

  const proc = processoDoPm2(APP);
  if (proc) {
    deArquivo(proc.pm2_env?.pm_cwd, 'arquivo em');
    fontes.push({
      nome: 'ambiente do processo',
      valores: new Map(Object.entries(proc.pm2_env ?? {})),
      filtrarPeloSchema: true,
    });
  }

  for (const retrato of retratosAnteriores()) {
    deArquivo(retrato.pm2_env?.pm_cwd, 'arquivo (retrato) em');
    fontes.push({
      nome: 'ambiente do retrato',
      valores: new Map(Object.entries(retrato.pm2_env ?? {})),
      filtrarPeloSchema: true,
    });
  }

  return fontes;
}

const destinoDir = path.dirname(ENVFILE);
const proc = processoDoPm2(APP);

if (proc) {
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
} else {
  console.log(`[ambiente] nenhum processo "${APP}" no PM2 — procurando o ambiente anterior.`);
}

const conhecidas = chavesDoSchema();
const jaTem = chavesJaNoArquivo();
const fontes = fontesDeAmbiente(destinoDir);

if (fontes.length === 0) {
  console.log('[ambiente] nenhuma fonte de ambiente anterior encontrada. Nada a copiar.');
  process.exit(0);
}

/** chave -> valor, respeitando a ordem das fontes (a primeira que tiver a chave vence). */
const aCopiar = new Map();
const origemDe = new Map();
for (const fonte of fontes) {
  let quantas = 0;
  for (const [chave, valor] of fonte.valores) {
    if (fonte.filtrarPeloSchema && !conhecidas.has(chave)) continue; // nunca PATH, HOME, PWD…
    if (jaTem.has(chave) || aCopiar.has(chave)) continue;
    if (typeof valor !== 'string' || valor === '') continue;
    aCopiar.set(chave, valor);
    origemDe.set(chave, fonte.nome);
    quantas += 1;
  }
  console.log(`[ambiente] fonte "${fonte.nome}": ${quantas} chave(s) aproveitada(s)`);
}

if (aCopiar.size === 0) {
  console.log('[ambiente] ✓ o .env já cobre tudo que as fontes têm. Nada a copiar.');
  process.exit(0);
}

const linhas = [...aCopiar.keys()]
  .sort()
  .map((k) => `${k}='${String(aCopiar.get(k)).replace(/'/g, "'\\''")}'`)
  .join('\n');

fs.appendFileSync(
  ENVFILE,
  `\n# vindo do processo PM2 em ${new Date().toISOString()} — ver scripts/preservar-ambiente-do-pm2.mjs\n${linhas}\n`,
);
fs.chmodSync(ENVFILE, 0o600);

console.log(`[ambiente] ✓ ${aCopiar.size} variáveis recuperadas para o .env:`);
for (const k of [...aCopiar.keys()].sort()) console.log(`             ${k}  ← ${origemDe.get(k)}`);
console.log('[ambiente]   (nomes apenas — nenhum valor é impresso)');
