/**
 * SOBE O MESMO ARTEFATO QUE A AWS RODA — para provar aqui antes de gastar um deploy.
 *
 * O QUE FAZ
 * ---------
 * Levanta `.next/standalone/server.js` com `NODE_ENV=production`, exatamente como o PM2 faz
 * na VPS (`deploy.yml`: `pm2 start server.js --name "behemp-site"`). Espera a porta responder
 * e imprime a URL.
 *
 * POR QUE EXISTE
 * --------------
 * 🔴 Decisão do dono em 13/09/2026: **deploy custa na AWS**. Nenhum deploy sai para provar que
 * algo funciona — deploy é para entregar o que já foi provado.
 *
 * ⚠️ E `pnpm dev` NÃO SERVE como prova. A doc do Next diz que o servidor de desenvolvimento tem
 * "hot reloading, debug logs e outros comportamentos que não existem em produção, levando a
 * testes instáveis ou enganosos". Metade dos defeitos de 12/09 só aparecia no build real.
 *
 * COMO SE DESFAZ
 * --------------
 * Ctrl+C, ou `kill` no PID que ele imprime. Não escreve nada fora de `.next/`.
 *
 * É IDEMPOTENTE
 * -------------
 * Sim. Se a porta já estiver ocupada, avisa e sai sem derrubar o que está lá.
 */

import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createConnection } from 'node:net';

const PORTA = Number(process.env.PORTA ?? 3100);
const SERVIDOR = '.next/standalone/server.js';

/** O `.env` é DADO, não código — a lição do deploy #39, onde `source` interpretou `&`. */
function lerEnv() {
  if (!existsSync('.env')) return {};
  const env = {};
  for (const linha of readFileSync('.env', 'utf8').split('\n')) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

function portaLivre(porta) {
  return new Promise((ok) => {
    const s = createConnection({ port: porta, host: '127.0.0.1' })
      .on('connect', () => {
        s.destroy();
        ok(false);
      })
      .on('error', () => ok(true));
  });
}

async function esperarSubir(porta, tentativas = 40) {
  for (let i = 0; i < tentativas; i++) {
    if (!(await portaLivre(porta))) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

if (!existsSync(SERVIDOR)) {
  console.error(`[local] ✗ ${SERVIDOR} não existe. Rode \`pnpm build\` antes.`);
  process.exit(1);
}

if (!(await portaLivre(PORTA))) {
  console.error(
    `[local] ✗ a porta ${PORTA} já está ocupada. Use PORTA=outra, ou derrube o que está lá.`,
  );
  process.exit(1);
}

const filho = spawn('node', ['server.js'], {
  cwd: '.next/standalone',
  env: {
    /**
     * 🔴 A ORDEM IMPORTA, e a primeira versão a tinha invertida: `.env` depois de
     * `process.env` fazia o arquivo VENCER quem passou a variável na linha de comando.
     *
     * Medido em 13/09/2026: subir com `DATABASE_URL=<postgres local>` continuava tentando o
     * Neon, porque o `.env` sobrescrevia — e a home ficava pendurada esperando um banco
     * inalcançável, sem erro nenhum. Quem passa explicitamente espera vencer; é o contrato
     * de toda ferramenta de linha de comando.
     */
    ...lerEnv(),
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(PORTA),
    HOSTNAME: '127.0.0.1',
    /**
     * ⚠️ O mesmo id que o deploy passa, para o `deploymentId` existir aqui também — sem ele,
     * o comportamento de recarga por versão não é exercitado.
     */
    NEXT_DEPLOYMENT_ID: process.env.NEXT_DEPLOYMENT_ID ?? 'local',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

filho.stdout.on('data', (d) => process.stdout.write(`[app] ${d}`));
filho.stderr.on('data', (d) => process.stderr.write(`[app] ${d}`));

if (await esperarSubir(PORTA)) {
  console.log(`[local] ✓ de pé em http://127.0.0.1:${PORTA}  (pid ${filho.pid})`);
} else {
  console.error('[local] ✗ não subiu a tempo');
  filho.kill();
  process.exit(1);
}

for (const sinal of ['SIGINT', 'SIGTERM']) {
  process.on(sinal, () => {
    filho.kill(sinal);
    process.exit(0);
  });
}
