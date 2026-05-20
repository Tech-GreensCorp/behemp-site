/**
 * Proxy reverso para o Clerk — substitui os rewrites do next.config.ts.
 *
 * O Clerk Dashboard está configurado com path-based proxy:
 *   URL: https://behemp-site.vercel.app/__clerk
 *
 * Os rewrites da Edge Network da Vercel não conseguem proxiar corretamente
 * para npm.clerk.dev (retornam 502). Este route handler resolve isso porque:
 *   - Usa fetch() que segue redirects automaticamente
 *   - Tem controle total sobre headers de request e response
 *   - Roda no Node.js runtime (sem limitações do Edge para proxying)
 *
 * Roteamento:
 *   /__clerk/npm/*  →  https://npm.clerk.dev/*         (assets JS/CSS)
 *   /__clerk/*      →  https://frontend-api.clerk.services/*  (API calls)
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const NPM_CDN = 'https://npm.clerk.dev';
const CLERK_FAPI = 'https://frontend-api.clerk.services';

// Headers da requisição a encaminhar para o upstream
const REQUEST_HEADERS = [
  'accept',
  'accept-language',
  'authorization',
  'cache-control',
  'content-type',
  'if-none-match',
  'if-modified-since',
  'origin',
  'user-agent',
  'x-clerk-auth-reason',
  'x-clerk-auth-token',
];

// Headers da resposta a retornar ao cliente
const RESPONSE_HEADERS = [
  'content-type',
  'cache-control',
  'etag',
  'last-modified',
  'vary',
  'access-control-allow-origin',
  'access-control-allow-headers',
  'access-control-allow-methods',
  'access-control-allow-credentials',
  'access-control-expose-headers',
];

async function proxyHandler(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await params;
  const pathStr = path.join('/');

  // Determinar destino com base no tipo de recurso
  let targetUrl: string;

  if (pathStr.startsWith('npm/')) {
    // Assets JS/CSS do Clerk (clerk.browser.js, ui.browser.js, etc.)
    // npm.clerk.dev serve diretamente em /@clerk/... sem prefixo /npm/
    const npmPath = pathStr.slice(4); // Remove 'npm/'
    targetUrl = `${NPM_CDN}/${npmPath}`;
  } else {
    // Chamadas de API do Clerk — preservar query string
    const search = request.nextUrl.search;
    targetUrl = `${CLERK_FAPI}/${pathStr}${search}`;
  }

  // Montar headers de encaminhamento
  const forwardHeaders = new Headers();
  for (const header of REQUEST_HEADERS) {
    const value = request.headers.get(header);
    if (value) forwardHeaders.set(header, value);
  }

  // Identificar instância para o Clerk FAPI
  forwardHeaders.set('X-Forwarded-Host', 'behemp-site.vercel.app');
  forwardHeaders.set('X-Forwarded-Proto', 'https');

  const init: RequestInit = {
    method: request.method,
    headers: forwardHeaders,
    redirect: 'follow',
  };

  // Encaminhar body para POST, PUT, PATCH
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const body = await request.text();
    if (body) init.body = body;
  }

  try {
    const upstream = await fetch(targetUrl, init);

    // Montar headers da resposta
    const responseHeaders = new Headers();
    for (const header of RESPONSE_HEADERS) {
      const value = upstream.headers.get(header);
      if (value) responseHeaders.set(header, value);
    }

    // Garantir CORS para o Clerk funcionar corretamente
    if (!responseHeaders.get('access-control-allow-origin')) {
      responseHeaders.set('access-control-allow-origin', '*');
    }

    const body = await upstream.arrayBuffer();

    return new Response(body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error(`[Clerk Proxy] Falha ao encaminhar para ${targetUrl}:`, error);
    return NextResponse.json(
      { error: 'Falha no proxy do Clerk' },
      { status: 502 },
    );
  }
}

export const GET = proxyHandler;
export const POST = proxyHandler;
export const PUT = proxyHandler;
export const PATCH = proxyHandler;
export const DELETE = proxyHandler;
export const OPTIONS = proxyHandler;
