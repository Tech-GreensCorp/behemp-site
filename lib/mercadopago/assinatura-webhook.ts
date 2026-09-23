/**
 * A ASSINATURA DO WEBHOOK DO MERCADO PAGO — prova de que a notificação veio do MP.
 *
 * Doc oficial, conferida em 23/09/2026:
 *   https://www.mercadopago.com.br/developers/pt/docs/split-payments/additional-content/your-integrations/notifications/webhooks
 *
 *   · o header `x-signature` vem como `ts=1704908010,v1=618c85…`
 *   · o texto assinado é `id:[data.id_url];request-id:[x-request-id_header];ts:[ts_header];`
 *   · `data.id` é o da QUERY STRING da URL — não o do corpo — e vai em minúsculas se for
 *     alfanumérico ("convert it to lowercase before using it in the manifest")
 *   · o que não vier (data.id, x-request-id) SAI do texto ("you must remove them")
 *   · HMAC-SHA256 em hexadecimal, com a "assinatura secreta" da aplicação — gerada em
 *     Suas integrações → Webhooks → Configurar notificação. NÃO é o `client_secret`.
 *
 * ⚠️ O QUE A ASSINATURA NÃO COBRE: o CORPO. Por isso quem chama usa o `data.id` da URL (que é
 * assinado), nunca o do corpo, e o processamento relê o pagamento na API antes de agir.
 *
 * ⚠️ SEM JANELA DE TEMPO, ao contrário de `lib/parceiros/assinatura.ts`: o MP não documenta
 * uma. O replay de uma notificação legítima é inofensivo aqui — ela só manda reler, na API,
 * o status de um pagamento; o que se faz com ele depende da API, não da notificação.
 *
 * Estrutura e comparação em tempo constante copiadas de `lib/parceiros/assinatura.ts`.
 *
 * 🛑 Módulo PURO — sem `db`, sem `next/*`.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

export type MotivoDeRecusaDoWebhook =
  | 'sem_segredo'
  | 'cabecalho_ausente'
  | 'formato_invalido'
  | 'assinatura_invalida';

export type VerificacaoDoWebhook =
  | { valida: true }
  | { valida: false; motivo: MotivoDeRecusaDoWebhook };

/** As partes do `x-signature`. Ordem e espaços não importam; `ts` e `v1` são obrigatórios. */
export function lerXSignature(valor: string | null | undefined): { ts: string; v1: string } | null {
  if (!valor?.trim()) return null;
  const partes = new Map<string, string>();
  for (const pedaco of valor.split(',')) {
    const igual = pedaco.indexOf('=');
    if (igual <= 0) continue;
    partes.set(pedaco.slice(0, igual).trim(), pedaco.slice(igual + 1).trim());
  }
  const ts = partes.get('ts');
  const v1 = partes.get('v1');
  if (!ts || !v1) return null;
  return { ts, v1 };
}

/**
 * O texto que o MP assina. Exportado para o teste montar a mesma coisa — e para que um
 * separador diferente num lado só apareça como teste vermelho, não como "assinatura inválida"
 * sem pista em produção.
 */
export function manifestoDoWebhook(params: {
  dataId: string | null | undefined;
  requestId: string | null | undefined;
  ts: string;
}): string {
  const dataId = params.dataId?.trim();
  const requestId = params.requestId?.trim();
  let texto = '';
  if (dataId) texto += `id:${/^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId};`;
  if (requestId) texto += `request-id:${requestId};`;
  texto += `ts:${params.ts};`;
  return texto;
}

export function assinarManifesto(manifesto: string, segredo: string): string {
  return createHmac('sha256', segredo).update(manifesto).digest('hex');
}

/**
 * Verifica a notificação.
 *
 * @param dataId o `data.id` da QUERY STRING — o que o MP assina
 * @param segredo padrão: `MERCADOPAGO_WEBHOOK_SECRET`. Sem ele, recusa TUDO: um webhook que
 *   aceita sem conferir por falta de configuração é um webhook aberto.
 */
export function verificarAssinaturaWebhook(
  headers: Headers,
  dataId: string | null,
  segredo: string | undefined = process.env.MERCADOPAGO_WEBHOOK_SECRET,
): VerificacaoDoWebhook {
  const chave = segredo?.trim();
  if (!chave) return { valida: false, motivo: 'sem_segredo' };

  const bruto = headers.get('x-signature');
  if (!bruto?.trim()) return { valida: false, motivo: 'cabecalho_ausente' };

  const partes = lerXSignature(bruto);
  if (!partes || !/^\d+$/.test(partes.ts)) return { valida: false, motivo: 'formato_invalido' };

  const esperada = assinarManifesto(
    manifestoDoWebhook({ dataId, requestId: headers.get('x-request-id'), ts: partes.ts }),
    chave,
  );
  const recebida = partes.v1.toLowerCase();

  // Comprimentos diferentes fazem `timingSafeEqual` LANÇAR — e o tamanho de um hex de SHA-256
  // é público (64 caracteres), então conferi-lo não vaza nada.
  if (recebida.length !== esperada.length) return { valida: false, motivo: 'assinatura_invalida' };

  const conferem = timingSafeEqual(Buffer.from(recebida, 'utf8'), Buffer.from(esperada, 'utf8'));
  return conferem ? { valida: true } : { valida: false, motivo: 'assinatura_invalida' };
}
