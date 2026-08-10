import { NextRequest, NextResponse } from 'next/server';

/**
 * Endpoint de retorno do DocuSign após assinatura.
 * Retorna HTML puro que usa postMessage para comunicar com o modal pai.
 * NÃO faz redirect — retorna HTML diretamente para evitar loop.
 */
export async function GET(request: NextRequest) {
  const event = request.nextUrl.searchParams.get('event') ?? 'unknown';
  const procuracaoId = request.nextUrl.searchParams.get('procuracaoId') ?? '';

  // Sanitizar inputs
  const safeEvent = event.replace(/[^a-zA-Z0-9_-]/g, '');
  const safeProcuracaoId = procuracaoId.replace(/[^a-zA-Z0-9_-]/g, '');

  const isConcluido = safeEvent === 'signing_complete';

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Assinatura ${isConcluido ? 'Concluída' : 'Processando'}</title>
  <style>
    body {
      margin: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      background: #f5f2ed;
      color: #1a1612;
    }
    .container {
      text-align: center;
      padding: 24px;
    }
    .icon {
      font-size: 48px;
      margin-bottom: 16px;
    }
    p {
      font-size: 14px;
      color: #3d3833;
      margin: 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">${isConcluido ? '✅' : '⏳'}</div>
    <p>${isConcluido ? 'Assinatura concluída. Fechando...' : 'Processando...'}</p>
  </div>
  <script>
    (function() {
      try {
        // Comunicar com o frame pai via postMessage
        var message = {
          type: 'docusign_event',
          event: '${safeEvent}',
          procuracaoId: '${safeProcuracaoId}'
        };
        
        // Tentar enviar para o pai (iframe)
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(message, '*');
        }
        
        // Também tentar via opener (nova aba)
        if (window.opener) {
          window.opener.postMessage(message, '*');
        }
      } catch(e) {
        console.error('postMessage failed:', e);
      }
    })();
  </script>
</body>
</html>`;

  // Retornar HTML com headers que evitam cache e redirect
  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Frame-Options': 'SAMEORIGIN',
      'ngrok-skip-browser-warning': 'true',
    },
  });
}
