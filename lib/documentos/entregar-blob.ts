/**
 * Entrega os bytes de um blob de paciente, depois que quem chamou JÁ provou o escopo.
 *
 * Os dois mundos do store, como `GET /api/documentos/{id}/arquivo`: blob PRIVADO por streaming
 * autenticado (o link direto responde 403) e blob antigo PÚBLICO buscado pelo servidor — nunca
 * por redirect, que entregaria a URL crua ao navegador e desfaria a auditoria.
 *
 * ⚠️ Falha de leitura responde um 502 GENÉRICO e a causa vai para o log do servidor. Dizer
 * "blob não encontrado" confirmaria a existência do registro a quem chegou aqui por engano.
 */

import { NextResponse } from 'next/server';

import { disposicaoInline } from '@/lib/documentos/disposicao-do-arquivo';
import { ehDoStorePrivado, lerDocumentoPrivado } from '@/lib/documentos/store-privado';

export async function entregarBlob(
  url: string,
  nomeArquivo: string | null,
  id: string,
  origem: string,
): Promise<NextResponse> {
  const indisponivel = () => NextResponse.json({ erro: 'Documento indisponível' }, { status: 502 });

  const cabecalhos = (contentType: string) => ({
    'content-type': contentType,
    'content-disposition': disposicaoInline(nomeArquivo, id),
    // 🔴 Dado de saúde não entra em cache de CDN nem de proxy.
    'cache-control': 'private, no-store',
  });

  try {
    if (ehDoStorePrivado(url)) {
      const privado = await lerDocumentoPrivado(url);
      if (!privado) return indisponivel();
      return new NextResponse(privado.stream, { headers: cabecalhos(privado.contentType) });
    }

    const resposta = await fetch(url);
    if (!resposta.ok || !resposta.body) return indisponivel();

    return new NextResponse(resposta.body, {
      headers: cabecalhos(resposta.headers.get('content-type') ?? 'application/octet-stream'),
    });
  } catch (erro) {
    console.error(
      `[${origem}] falha ao entregar arquivo:`,
      erro instanceof Error ? erro.message : 'erro desconhecido',
    );
    return indisponivel();
  }
}
