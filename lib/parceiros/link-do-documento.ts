/**
 * A URL ASSINADA DE VIDA CURTA PARA O DOCUMENTO — como a Greens acessa o arquivo no S2.
 *
 * 🔴 A DECISÃO JÁ ESTAVA TOMADA, e eu a tinha apresentado como aberta. A ADR-0016 diz, ao
 * adiar a cópia de arquivos para a fase 2:
 *
 *   _"Copiar blob de saúde entre duas empresas exige **URL assinada de vida curta na origem,
 *   validação de MIME e tamanho no destino, store privado e prazo de retenção**"_
 *
 * É isto. O que é decisão da Greens é só o **formato do corpo** — e ele já existe do lado
 * deles: `{ tipo, url, nomeArquivo?, dataEmissao? }`, ou a string pura quando o arquivo não
 * viaja (`greens-corp-backend/src/modules/parceiros/behemp/documentos.ts`).
 *
 * ⚠️ POR QUE A URL É NOSSA, E NÃO DO STORE.
 *
 * A Greens usa S3, que assina URL com TTL. Nós usamos Vercel Blob, e a versão 2.3.3 não expõe
 * assinatura com validade — medido nos exports do pacote. Então a URL assinada é a **nossa**:
 * um HMAC de vida curta sobre uma rota nossa.
 *
 * Isso não é contorno; é melhor para o que o dono pediu (_"da maneira mais segura e que valide
 * toda ação"_):
 *
 *   | | URL do store | URL nossa |
 *   |---|---|---|
 *   | validade curta | sim | sim |
 *   | **cada acesso auditado** | não | **sim** |
 *   | dá para revogar antes do prazo | não | sim (some com o documento) |
 *   | vaza a topologia do store | sim | não |
 *
 * 🔴 A CHAVE É DERIVADA, NÃO REUSADA.
 *
 * Assinar o link com o mesmo segredo dos webhooks daria ao mesmo valor dois usos, e um oráculo
 * num deles enfraquece o outro. A chave sai de `HMAC(segredoDeSaida, ROTULO)` — separação de
 * domínio de chave, a mesma ideia do `info` de um HKDF. Não exige secret novo, e um link
 * assinado nunca vale como assinatura de webhook.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

/** Uma hora, espelhando o TTL que a Greens usa no S3 ao mandar documentos para cá. */
export const VALIDADE_DO_LINK_EM_SEGUNDOS = 3600;

/** O rótulo que separa esta chave da de assinatura de webhook. Nunca mude sem trocar a versão. */
const ROTULO_DA_CHAVE = 'link-de-documento.v1';

export type MotivoDeRecusaDoLink =
  | 'sem_segredo'
  | 'formato_invalido'
  | 'expirado'
  | 'assinatura_invalida';

function chaveDoLink(segredoDeSaida: string): Buffer {
  return createHmac('sha256', segredoDeSaida).update(ROTULO_DA_CHAVE).digest();
}

function assinaturaDe(documentoId: string, expiraEm: number, segredoDeSaida: string): string {
  return createHmac('sha256', chaveDoLink(segredoDeSaida))
    .update(`${documentoId}.${expiraEm}`)
    .digest('hex');
}

/**
 * Monta o token do link.
 *
 * Formato: `<documentoId>.<expiraEmSegundos>.<hmac>`. Tudo o que o validador precisa viaja
 * dentro dele — não há estado a guardar, e um link não impede outro.
 */
export function assinarLinkDoDocumento(params: {
  documentoId: string;
  segredoDeSaida: string;
  agoraEmSegundos?: number;
  validadeEmSegundos?: number;
}): string {
  const agora = params.agoraEmSegundos ?? Math.floor(Date.now() / 1000);
  const expiraEm = agora + (params.validadeEmSegundos ?? VALIDADE_DO_LINK_EM_SEGUNDOS);
  const assinatura = assinaturaDe(params.documentoId, expiraEm, params.segredoDeSaida);
  return `${params.documentoId}.${expiraEm}.${assinatura}`;
}

/**
 * Confere o token.
 *
 * 🔴 A EXPIRAÇÃO É CONFERIDA **DEPOIS** DA ASSINATURA.
 *
 * Responder "expirado" a um token não assinado contaria a quem tentou que o formato está certo
 * e só o prazo passou — e o prazo é o único campo que ele controla. Conferindo a assinatura
 * primeiro, token forjado é sempre `assinatura_invalida`, aconteça o que acontecer com a data.
 */
export function conferirLinkDoDocumento(params: {
  token: string;
  segredoDeSaida: string | undefined;
  agoraEmSegundos?: number;
}): { valido: true; documentoId: string } | { valido: false; motivo: MotivoDeRecusaDoLink } {
  if (!params.segredoDeSaida?.trim()) return { valido: false, motivo: 'sem_segredo' };

  const partes = params.token.split('.');
  if (partes.length !== 3) return { valido: false, motivo: 'formato_invalido' };

  const [documentoId, expiraEmTexto, recebida] = partes;
  const expiraEm = Number(expiraEmTexto);
  if (!documentoId || !Number.isFinite(expiraEm) || !/^[0-9a-f]{64}$/.test(recebida)) {
    return { valido: false, motivo: 'formato_invalido' };
  }

  const esperada = assinaturaDe(documentoId, expiraEm, params.segredoDeSaida);
  // Comprimento já garantido pelo regex acima; `timingSafeEqual` lança se divergir.
  if (!timingSafeEqual(Buffer.from(recebida, 'hex'), Buffer.from(esperada, 'hex'))) {
    return { valido: false, motivo: 'assinatura_invalida' };
  }

  const agora = params.agoraEmSegundos ?? Math.floor(Date.now() / 1000);
  if (agora > expiraEm) return { valido: false, motivo: 'expirado' };

  return { valido: true, documentoId };
}
