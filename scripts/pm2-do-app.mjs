#!/usr/bin/env node
/**
 * O QUE FAZ
 * ---------
 * Lê o registro do PM2 e devolve o processo do app. Rodado direto com `--caminho`, imprime
 * o caminho do script que o processo está executando (vazio se não houver processo).
 *
 * POR QUE EXISTE
 * --------------
 * `pm2 restart` NÃO relê o caminho do script — reusa o que foi gravado no `pm2 start`
 * original (Unitech/pm2#3054). Em 10/09/2026 isso fez o servidor rodar um build de dias
 * antes enquanto todo deploy passava verde. Para decidir entre `restart` (barato) e
 * `delete`+`start` (necessário quando o caminho mudou), o deploy precisa LER esse caminho.
 *
 * COMO SE DESFAZ / IDEMPOTENTE
 * ----------------------------
 * Não escreve nada. Só lê.
 */

import { execFileSync } from 'node:child_process';

/** Devolve o primeiro `[...]` do texto que seja JSON válido, ou null.
 *
 * ⚠️ Não serve pegar o primeiro `[`: o próprio PM2 imprime avisos no formato `[PM2] ...`
 * antes do JSON, e o colchete do aviso quebrava o parse. Descoberto pelo teste com PM2
 * simulado, antes de isto rodar em produção.
 */
export function primeiroArrayValido(texto) {
  const fim = texto.lastIndexOf(']');
  if (fim === -1) return null;
  for (let i = texto.indexOf('['); i !== -1 && i < fim; i = texto.indexOf('[', i + 1)) {
    try {
      const v = JSON.parse(texto.slice(i, fim + 1));
      if (Array.isArray(v)) return v;
    } catch {
      // este `[` não abre o array; tenta o próximo
    }
  }
  return null;
}

/** O processo do app no PM2, ou null se o PM2 não existe, não responde ou não o tem. */
export function processoDoPm2(nome) {
  let cru;
  try {
    cru = execFileSync('pm2', ['jlist'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch {
    return null;
  }
  const lista = primeiroArrayValido(cru);
  if (!lista) return null;
  return lista.find((p) => p?.name === nome) ?? null;
}

if (process.argv.includes('--caminho')) {
  const nome =
    process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'behemp-site';
  const proc = processoDoPm2(nome);
  process.stdout.write(proc?.pm2_env?.pm_exec_path ?? '');
}
