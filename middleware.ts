import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

/**
 * Middleware de proteção de rotas com Clerk.
 *
 * Rotas públicas são acessíveis sem autenticação.
 * Rotas protegidas (/medico, /paciente, /admin) exigem login
 * e redirecionam para sign-in se não autenticado.
 *
 * A verificação de role (admin, medico, paciente) é feita via:
 * 1. sessionClaims.metadata.role (requer configuração no Clerk Dashboard → Sessions)
 * 2. Fallback: sessionClaims.publicMetadata.role (alternativa)
 */

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/mundo-endocanabinoide',
  '/agendamento',
  '/parceiros',
  '/entre-em-contato',
  '/triagem',
  '/api/webhooks(.*)',
  '/api/cron(.*)',
  '/api/inngest(.*)',
  '/api/debug-auth',
  '/api/auth/callback',
  '/redirect',
]);

const isMedicoRoute = createRouteMatcher(['/medico(.*)']);
const isPacienteRoute = createRouteMatcher(['/paciente(.*)']);
const isAdminRoute = createRouteMatcher(['/admin(.*)']);

/**
 * Extrai o role do usuário a partir do sessionClaims.
 * Tenta múltiplos caminhos possíveis no JWT para garantir compatibilidade.
 */
function extrairRole(sessionClaims: Record<string, unknown> | null): string | undefined {
  if (!sessionClaims) return undefined;

  // Caminho 1: metadata.role (quando session token customizado está configurado)
  const metadata = sessionClaims.metadata as { role?: string } | undefined;
  if (metadata?.role) return metadata.role;

  // Caminho 2: publicMetadata.role (estrutura alternativa do Clerk)
  const publicMeta = sessionClaims.publicMetadata as { role?: string } | undefined;
  if (publicMeta?.role) return publicMeta.role;

  // Caminho 3: role direto no claims (caso customizado diferente)
  if (typeof sessionClaims.role === 'string') return sessionClaims.role;

  return undefined;
}

export default clerkMiddleware(async (auth, req) => {
  // Rotas públicas: não precisa de autenticação
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // Todas as rotas protegidas: exigir autenticação
  const { userId, sessionClaims, redirectToSignIn } = await auth();

  if (!userId) {
    return redirectToSignIn();
  }

  // Verificação de role via sessionClaims
  const role = extrairRole(sessionClaims as Record<string, unknown>);

  // Se não tem role no JWT, redireciona para a home
  // (o usuário precisa configurar o session token no Clerk Dashboard)
  if (!role) {
    // Log para debug — visível no terminal do dev server
    console.warn(
      `[Middleware] Usuário ${userId} sem role no JWT. Configure o session token no Clerk Dashboard.`,
      'sessionClaims:', JSON.stringify(sessionClaims),
    );
    // Permite acessar mas sem rota protegida específica
    const url = new URL('/', req.url);
    return NextResponse.redirect(url);
  }

  // Médico: apenas role 'medico' ou 'admin'
  if (isMedicoRoute(req) && role !== 'medico' && role !== 'admin') {
    const url = new URL('/', req.url);
    return NextResponse.redirect(url);
  }

  // Paciente: apenas role 'paciente' ou 'admin'
  if (isPacienteRoute(req) && role !== 'paciente' && role !== 'admin') {
    const url = new URL('/', req.url);
    return NextResponse.redirect(url);
  }

  // Admin: apenas role 'admin'
  if (isAdminRoute(req) && role !== 'admin') {
    const url = new URL('/', req.url);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Ignora arquivos estáticos e API routes internas do Next.js
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Sempre roda para API routes
    '/(api|trpc)(.*)',
  ],
};
