import { NextRequest, NextResponse } from 'next/server';

/**
 * Rota de retorno do DocuSign após assinatura.
 * DocuSign redireciona o iframe para esta URL com ?event=signing_complete
 * Esta rota retorna HTML que usa postMessage para comunicar com o pai.
 */
export async function GET(request: NextRequest) {
  const event = request.nextUrl.searchParams.get('event') ?? 'unknown';
  const procuracaoId = request.nextUrl.searchParams.get('procuracaoId') ?? '';

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body>
<script>
  // Comunicar com o frame pai (a plataforma Be4Hope)
  try {
    window.parent.postMessage(
      {
        type: 'docusign_event',
        event: '${event}',
        procuracaoId: '${procuracaoId}'
      },
      '*'
    );
  } catch(e) {
    console.error('postMessage failed:', e);
  }
</script>
<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#555;">
  ${event === 'signing_complete'
    ? '<p>✅ Assinatura concluída. Fechando...</p>'
    : '<p>Processando...</p>'
  }
</div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
