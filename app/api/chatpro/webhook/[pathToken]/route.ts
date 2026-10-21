/**
 * `POST /api/chatpro/webhook/{segredo}` — recepção de eventos do funil.
 *
 * 🔴 A REGRA DE OURO: NADA É PROCESSADO DENTRO DA REQUISIÇÃO.
 * O handler grava o evento na fila e responde `202`. Processar aqui faria o ChatPro atingir
 * o tempo limite e REENTREGAR o mesmo evento — multiplicando exatamente o problema que a
 * deduplicação existe para resolver.
 *
 * POR QUE O SEGREDO ESTÁ NA URL, E POR QUE ISSO NÃO BASTA
 * A documentação do ChatPro não descreve assinatura, segredo compartilhado nem IPs de
 * origem: o painel expõe apenas o campo "Webhook url". Sem assinatura, quem descobrir a URL
 * pode enviar um POST falso.
 *
 * O segredo no caminho é a camada mínima, e é reconhecidamente fraca sozinha — URL vaza em
 * log de proxy e em histórico. A defesa real é a CONFIRMAÇÃO REVERSA, feita no
 * processamento: do payload usamos só os identificadores, e o dado real vem de uma chamada
 * autenticada de volta ao ChatPro. Um POST falso não sobrevive a ela.
 *
 * 🔴 LGPD: o conteúdo das mensagens NUNCA é gravado.
 * `message`, `alt_message`, `title` e `url` de mídia são removidos antes do insert. Conversa
 * de paciente contém dado de saúde, que é dado sensível — e o mínimo necessário aqui é o
 * metadado do funil, não o que foi conversado.
 *
 * 🔴 SEMPRE `202`, inclusive para evento duplicado, fora da janela de tempo ou de tipo sem
 * interesse. Responder erro faria o ChatPro reentregar indefinidamente. E responder `202`
 * também para o que descartamos não dá pista nenhuma a quem estiver sondando.
 */

import { NextRequest, NextResponse } from 'next/server';

import { chatproEventos } from '@/db/schema';
import { db } from '@/lib/db';
import { segredosConferem } from '@/lib/chatpro/segredo';

export const dynamic = 'force-dynamic';

const ACEITO = NextResponse.json({ ok: true }, { status: 202 });

/**
 * Campos que carregam conteúdo de conversa. Removidos em qualquer profundidade antes de
 * gravar — a lista é de campos PROIBIDOS, não de campos permitidos, porque um payload novo
 * do ChatPro pode trazer chaves que ainda não conhecemos.
 */
const CAMPOS_PROIBIDOS = new Set([
  'message',
  'alt_message',
  'altMessage',
  'title',
  'caption',
  'body',
  'text',
  'url',
  'media_url',
  'mediaUrl',
  'thumbnail',
  'base64',
]);

/** Remove recursivamente o conteúdo de mensagem. */
function limparPayload(valor: unknown, profundidade = 0): unknown {
  if (profundidade > 8) return null;
  if (Array.isArray(valor)) return valor.map((item) => limparPayload(item, profundidade + 1));
  if (!valor || typeof valor !== 'object') return valor;

  const saida: Record<string, unknown> = {};
  for (const [chave, item] of Object.entries(valor as Record<string, unknown>)) {
    if (CAMPOS_PROIBIDOS.has(chave)) {
      // Marca que existia, sem guardar o conteúdo — útil para depurar sem violar a LGPD.
      saida[chave] = '[removido]';
      continue;
    }
    saida[chave] = limparPayload(item, profundidade + 1);
  }
  return saida;
}

/** Procura uma chave em qualquer nível do payload, tolerando variações de nome. */
function procurar(payload: unknown, chaves: string[], profundidade = 0): string | null {
  if (profundidade > 6 || !payload || typeof payload !== 'object') return null;

  const registro = payload as Record<string, unknown>;
  for (const chave of chaves) {
    const valor = registro[chave];
    if (typeof valor === 'string' && valor.trim()) return valor.trim();
  }

  for (const valor of Object.values(registro)) {
    if (valor && typeof valor === 'object') {
      const achado = procurar(valor, chaves, profundidade + 1);
      if (achado) return achado;
    }
  }
  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ pathToken: string }> },
) {
  const esperado = process.env.CHATPRO_WEBHOOK_PATH_TOKEN;
  const { pathToken } = await params;

  if (!esperado) {
    console.error('[chatpro] CHATPRO_WEBHOOK_PATH_TOKEN ausente — webhook fechado');
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  if (!segredosConferem(pathToken, esperado)) {
    // Log SEM o corpo da requisição: ele pode conter conteúdo de conversa.
    console.warn('[chatpro] webhook com token inválido');
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    // Corpo ilegível: aceita e ignora. Devolver 400 faria o ChatPro reentregar para sempre.
    console.warn('[chatpro] webhook com corpo ilegível');
    return ACEITO;
  }

  const evento = procurar(payload, ['event', 'evento', 'type']);
  const sessionId = procurar(payload, ['session_id', 'sessionId', 'session']);
  const eventoTs = procurar(payload, ['event_ts', 'eventTs', 'timestamp', 'created_at']);

  // Sem a chave de deduplicação não há como garantir que o evento não repita: aceita e
  // descarta, em vez de gravar algo que pode duplicar depois.
  if (!evento || !sessionId || !eventoTs) {
    console.warn('[chatpro] webhook sem chave de deduplicação completa', {
      temEvento: !!evento,
      temSessao: !!sessionId,
      temTs: !!eventoTs,
    });
    return ACEITO;
  }

  try {
    await db
      .insert(chatproEventos)
      .values({
        evento,
        sessionId,
        eventoTs,
        leadId: procurar(payload, ['lead_id', 'leadId']),
        payload: limparPayload(payload) as Record<string, unknown>,
        status: 'pendente',
      })
      // Evento repetido: a chave única recusa, e nada acontece. É o equivalente a
      // "não faça nada se já existe" — sem erro, sem duplicata.
      .onConflictDoNothing({
        target: [chatproEventos.evento, chatproEventos.sessionId, chatproEventos.eventoTs],
      });
  } catch (erro) {
    // Falha ao gravar NÃO vira erro para o ChatPro: ele reentregaria, e o problema é nosso.
    console.error('[chatpro] webhook: falha ao enfileirar evento', {
      evento,
      sessionId,
      mensagem: erro instanceof Error ? erro.message : String(erro),
    });
  }

  return ACEITO;
}
