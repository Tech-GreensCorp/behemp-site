/**
 * Proxy reverso para o Clerk.
 *
 * Contexto: O Clerk Dashboard está configurado com proxy path-based em:
 *   https://behemp-site.vercel.app/__clerk
 *
 * O next.config.ts tem um rewrite interno que encaminha:
 *   /__clerk/* → /api/clerk-proxy/*
 *
 * Este handler recebe todas essas requisições e encaminha para:
 *   → https://frontend-api.clerk.services (API calls E npm assets)
 *
 * O `frontend-api.clerk.services` é o ponto central do Clerk que serve
 * tanto as chamadas de autenticação quanto os assets JS/CSS do Clerk,
 * identificando a instância pelo header Origin.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const CLERK_FAPI = 'https://frontend-api.clerk.services';

// Headers da requisição a encaminhar para o Clerk
const REQUEST_HEADERS_TO_FORWARD = [
  'accept',
  'accept-language',
  'authorization',
  'cache-control',
  'content-type',
  'if-none-match',
  'if-modified-since',
  'user-agent',
  'x-clerk-auth-reason',
  'x-clerk-auth-token',
  'cookie',
];

// Headers da resposta a retornar ao browser
const RESPONSE_HEADERS_TO_RETURN = [
  'content-type',
  'cache-control',
  'etag',
  'last-modified',
  'vary',
  'set-cookie',
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

  // Preservar query string para chamadas de API
  const search = request.nextUrl.search;
  const targetUrl = `${CLERK_FAPI}/${pathStr}${search}`;

  // Montar headers de encaminhamento
  const forwardHeaders = new Headers();

  for (const header of REQUEST_HEADERS_TO_FORWARD) {
    const value = request.headers.get(header);
    if (value) forwardHeaders.set(header, value);
  }

  // Identificar a instância para o Clerk Frontend API
  // O Clerk usa o Origin para rotear para a instância correta
  forwardHeaders.set('Origin', 'https://behemp-site.vercel.app');
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

    for (const header of RESPONSE_HEADERS_TO_RETURN) {
      const value = upstream.headers.get(header);
      if (value) responseHeaders.set(header, value);
    }

    // Garantir CORS aberto para o Clerk funcionar no browser
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
    console.error(
      `[Clerk Proxy] Erro ao encaminhar requisição para ${targetUrl}:`,
      error,
    );
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
