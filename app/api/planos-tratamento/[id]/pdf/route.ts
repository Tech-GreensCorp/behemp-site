import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { buscarPlanoTratamento } from '@/app/(admin)/_actions/planos-tratamento';
import { renderAdesaoHTML } from '@/lib/planos-tratamento/documento-adesao';

/**
 * Documento "Adesão ao Tratamento" do plano — HTML para imprimir / salvar como PDF.
 * O template mora em `lib/planos-tratamento/documento-adesao.ts`; aqui ficam auth e busca.
 *
 * Acesso restrito a admin. GET /api/planos-tratamento/[id]/pdf
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await currentUser();
    const role = user?.publicMetadata?.role as string | undefined;

    if (!user || role !== 'admin') {
      return NextResponse.json({ erro: 'Acesso não autorizado' }, { status: 403 });
    }

    const { id } = await params;
    const resultado = await buscarPlanoTratamento(id);

    if (!resultado.sucesso || !resultado.dados) {
      return NextResponse.json(
        { erro: resultado.erro ?? 'Plano de tratamento não encontrado' },
        { status: 404 },
      );
    }

    return new NextResponse(renderAdesaoHTML(resultado.dados), {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[PlanoTratamento PDF] Erro ao gerar documento:', error);
    return NextResponse.json({ erro: 'Erro interno ao gerar documento' }, { status: 500 });
  }
}
