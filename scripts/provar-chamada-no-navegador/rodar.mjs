#!/usr/bin/env node
/**
 * PROVA NO NAVEGADOR DA NEGOCIAÇÃO DA CHAMADA DE ATENDIMENTO — ADR-0029 §10.3.
 *
 * O que faz ..... compila `lib/atendimento/negociacao.ts` (o MESMO módulo que a tela usa) com o `tsc`
 *                 do projeto, serve `prova.html` num servidor local e roda no Chromium dois pares
 *                 WebRTC reais, com microfone falso: voz nos dois sentidos, e a "tela" (um canvas)
 *                 trocada sem renegociar. Imprime um OK/FALHA por passo.
 * Como se desfaz  não escreve nada no repositório: compila para uma pasta temporária do sistema.
 * Idempotente ... sim.
 *
 * Por que existe: sem chave do Clerk local, as telas não abrem; mas a negociação não depende de
 * login, e é a parte que mais falha em silêncio. Ela se prova aqui, sem deploy (CLAUDE.md, "Deploy
 * CUSTA", nível 3).
 *
 * Como rodar (o `playwright-core` NÃO é dependência do projeto; instale fora dele):
 *   npm i --prefix /tmp/pw playwright-core@1
 *   NODE_PATH=/tmp/pw/node_modules \
 *   CHROME=~/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell \
 *   node scripts/provar-chamada-no-navegador/rodar.mjs
 *
 * Resultado medido em 30/09/2026: 15 de 15 passos; e duas sabotagens do módulo (vídeo `inactive`,
 * paciente sem microfone) acusadas. Em 30/09/2026, com câmera e tela nos dois sentidos (D-21, D-22),
 * a prova foi reescrita: ver o resultado no ADR-0029 §12.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

const aqui = path.dirname(new URL(import.meta.url).pathname);
const raiz = path.resolve(aqui, '..', '..');
const saida = fs.mkdtempSync(path.join(os.tmpdir(), 'prova-chamada-'));

execFileSync(
  path.join(raiz, 'node_modules/.bin/tsc'),
  [
    // NEGOCIACAO=<caminho> roda a MESMA prova contra outra versão do módulo: é assim que se
    // prova que ela acusa (a versão anterior, ou uma sabotagem).
    process.env.NEGOCIACAO ?? 'lib/atendimento/negociacao.ts',
    '--target',
    'es2022',
    '--module',
    'es2022',
    '--lib',
    'es2022,dom',
    '--skipLibCheck',
    '--outDir',
    saida,
  ],
  { cwd: raiz, stdio: 'inherit' },
);
fs.copyFileSync(path.join(aqui, 'prova.html'), path.join(saida, 'prova.html'));

const require = createRequire(path.join(process.env.NODE_PATH ?? raiz, 'x.js'));
const { chromium } = require('playwright-core');

const servidor = http.createServer((q, s) => {
  const arquivo = path.join(saida, q.url === '/' ? 'prova.html' : path.basename(q.url));
  if (!fs.existsSync(arquivo)) {
    s.statusCode = 404;
    return s.end();
  }
  s.setHeader('content-type', arquivo.endsWith('.js') ? 'text/javascript' : 'text/html');
  s.end(fs.readFileSync(arquivo));
});
await new Promise((pronto) => servidor.listen(0, '127.0.0.1', pronto));
const porta = servidor.address().port;

const navegador = await chromium.launch({
  executablePath: process.env.CHROME,
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
const pagina = await navegador.newPage();
pagina.on('pageerror', (e) => console.log('ERRO NA PÁGINA', e.message));
await pagina.goto(`http://127.0.0.1:${porta}/`);
await pagina.waitForFunction(() => window.resultado, null, { timeout: 60_000 });
const r = await pagina.evaluate(() => window.resultado);
for (const p of r.passos) {
  const extra = Object.fromEntries(Object.entries(p).filter(([k]) => k !== 'n' && k !== 'ok'));
  console.log(p.ok ? 'OK   ' : 'FALHA', p.n, JSON.stringify(extra));
}
if (r.erro) console.log('ERRO', r.erro);
const tudoOk = r.passos.every((p) => p.ok) && !r.erro;
console.log(tudoOk ? '== TODOS OS PASSOS OK' : '== HÁ FALHA');
await navegador.close();
servidor.close();
process.exit(tudoOk ? 0 : 1);
