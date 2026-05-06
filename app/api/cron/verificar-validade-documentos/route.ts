import { NextResponse } from 'next/server';

/**
 * Cron Job — Verificação diária de validade de documentos.
 * Executado pela Vercel às 9h UTC (6h BRT).
 *
 * Quando o Inngest estiver configurado, este endpoint disparará
 * o evento `verificar-validade-documentos` para processamento assíncrono.
 */
export async function GET(request: Request) {
  // Validar que a request vem do Vercel Cron
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    // TODO: Integrar com Inngest quando as chaves estiverem configuradas
    // await inngest.send({ name: 'cron/verificar-validade-documentos' });

    return NextResponse.json({
      sucesso: true,
      mensagem: 'Verificação de validade de documentos disparada',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CRON] Erro ao verificar validade de documentos:', error);
    return NextResponse.json(
      { error: 'Erro interno' },
      { status: 500 },
    );
  }
}
