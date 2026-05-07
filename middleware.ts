import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

/**
 * Middleware de proteção de rotas com Clerk.
 *
 * ESTRATÉGIA: O middleware verifica APENAS se o usuário está autenticado (userId).
 * A verificação de ROLE (admin, medico, paciente) é feita nos layouts de cada área,
 * pois o JWT pode ter delay (clock skew) entre a criação da sessão e a propagação
 * dos claims customizados — o que causava um loop de redirecionamento.
 *
 * Rotas públicas são acessíveis sem autenticação.
 * Rotas protegidas (/medico, /paciente, /admin) exigem apenas userId válido.
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

export default clerkMiddleware(async (auth, req) => {
  // Rotas públicas: passa sem verificação
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // Rotas protegidas: apenas verifica se o usuário tem sessão ativa
  // A verificação de role é feita nos layouts individuais de cada área
  const { userId, redirectToSignIn } = await auth();

  if (!userId) {
    return redirectToSignIn();
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
