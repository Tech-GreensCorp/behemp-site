#!/usr/bin/env node
/**
 * WORKER DAS FILAS — processo `behemp-filas` no PM2 (ADR-0027).
 *
 * O QUE FAZ
 * ---------
 * A cada 60 s, chama `/api/chatpro/processar`, `/api/parceiros/enviar` e
 * `/api/mercadopago/processar` em `http://127.0.0.1:$PORT`, com `Bearer $CRON_SECRET`.
 * A lógica mora em `worker-filas-nucleo.mjs`; este arquivo só a liga.
 *
 * COMO SE SOBE
 * ------------
 * Pelo `deploy.yml`, sempre com `pm2 delete` + `pm2 start` (D-04), e com `env -i`: o
 * processo recebe só PATH, HOME, PORT e CRON_SECRET — nenhum outro segredo do site.
 *
 * COMO SE DESFAZ / IDEMPOTENTE
 * ----------------------------
 * `pm2 stop behemp-filas` (ou `pm2 delete behemp-filas && pm2 save`). O cron do GitHub
 * continua como rede de segurança (D-06). Não escreve nada: só chama rotas idempotentes.
 */

import { iniciar } from './worker-filas-nucleo.mjs';

iniciar();
