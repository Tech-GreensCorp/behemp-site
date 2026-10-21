/**
 * `GET /api/parceiros/documento/[token]` — o arquivo que o parceiro baixa no S2.
 *
 * 🔴 ESTA ROTA É A "URL ASSINADA DE VIDA CURTA" DA ADR-0016. O token carrega o id do documento,
 * a expiração e o HMAC; não há sessão, porque do outro lado não há usuário — é sistema falando
 * com sistema, como no webhook.
 *
 * ⚠️ E CADA ACESSO É AUDITADO. É a terceira pergunta do `.claude/rules/seguranca-lgpd.md`, e a
 * razão de a URL ser nossa em vez de do store: uma URL assinada de S3 entrega o arquivo sem
 * que ninguém aqui saiba que ele foi lido.
 *
 * 🔴 RESPONDE 404 PARA TUDO QUE NÃO DÁ CERTO.
 *
 * Token forjado, expirado, documento apagado, blob fora do ar — tudo 404. Distinguir os casos
 * transformaria a rota em oráculo: quem tentasse descobriria quais ids existem. É a mesma
 * decisão de `lib/auth/escopo-documento.ts`, e ela vale ainda mais aqui, onde não há login.
 */

import { NextRequest, NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { head } from '@vercel/blob';

import { db } from '@/lib/db';
import { documentos } from '@/db/schema';
import { conferirLinkDoDocumento } from '@/lib/parceiros/link-do-documento';
import { registrarAuditoria } from '@/lib/utils/audit';
import {
  cabecalhosDoLimite,
  consumir,
  identificarChamador,
} from '@/lib/seguranca/limite-de-requisicao';

/** Um parceiro baixa poucos arquivos por paciente. 120/min cobre um lote e barra varredura. */
const LIMITE = 120;

export const dynamic = 'force-dynamic';

function naoEncontrado(): NextResponse {
  return NextResponse.json({ erro: 'Não encontrado' }, { status: 404 });
}

export async function GET(request: NextRequest, contexto: { params: Promise<{ token: string }> }) {
  const limite = consumir(identificarChamador(request.headers, 'docparceiro'), LIMITE, 60);
  if (!limite.permitido) {
    return NextResponse.json(
      { erro: 'Muitas requisições' },
      { status: 429, headers: cabecalhosDoLimite(limite, LIMITE) },
    );
  }

  const { token } = await contexto.params;

  const conferido = conferirLinkDoDocumento({
    token,
    segredoDeSaida: process.env.PARCEIRO_GREENS_SEGREDO_SAIDA,
  });

  if (!conferido.valido) {
    // O motivo vai ao log, nunca à resposta — ver o bloco do topo.
    console.warn('[parceiros] link de documento recusado', { motivo: conferido.motivo });
    return naoEncontrado();
  }

  const [documento] = await db
    .select({
      id: documentos.id,
      urlBlob: documentos.urlBlob,
      nomeArquivo: documentos.nomeArquivo,
      pacienteId: documentos.pacienteId,
    })
    .from(documentos)
    .where(and(eq(documentos.id, conferido.documentoId), isNull(documentos.deletedAt)))
    .limit(1);

  if (!documento) return naoEncontrado();

  /**
   * 🔴 AUDITA ANTES DE ENTREGAR.
   *
   * Auditar depois perderia justamente o acesso que falhou no meio — e é esse que interessa
   * quando alguém pergunta o que aconteceu. `userId` fica nulo: não há usuário, e inventar um
   * faria o registro mentir sobre quem leu.
   */
  await registrarAuditoria({
    userId: null,
    acao: 'visualizar',
    entidade: 'documentos',
    entidadeId: documento.id,
    dadosDepois: { por: 'parceiro', via: 'link_assinado' },
  }).catch(() => {});

  try {
    const meta = await head(documento.urlBlob);
    const resposta = await fetch(documento.urlBlob);
    if (!resposta.ok || !resposta.body) return naoEncontrado();

    return new NextResponse(resposta.body, {
      headers: {
        'content-type': meta.contentType ?? 'application/octet-stream',
        'content-disposition': `attachment; filename="${documento.nomeArquivo ?? documento.id}"`,
        // Dado de saúde não entra em cache de CDN nem de proxy.
        'cache-control': 'private, no-store',
      },
    });
  } catch {
    return naoEncontrado();
  }
}
