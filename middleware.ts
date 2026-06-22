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
  '/entrar(.*)',
  '/registrar-se(.*)',
  '/historias',
  '/ebooks(.*)',
  '/agendamento',
  '/parceiros',
  '/contato',
  '/triagem',
  '/politica-de-privacidade',
  '/termos-de-uso',
  '/redirect',
  // Arquivos de SEO — NUNCA devem ser interceptados pelo auth
  '/robots.txt',
  '/sitemap.xml',
  '/sitemap(.*).xml',
  '/favicon.ico',
  // Rotas de sistema e integrações
  '/api/webhooks(.*)',
  '/api/cron(.*)',
  '/api/inngest(.*)',
  '/api/auth/callback',
]);

export default clerkMiddleware(
  async (auth, req) => {
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
  },
  {
    // Tolera até 30s de diferença de relógio do sistema (clock skew)
    // Evita loops de redirect causados por JWT com iat ligeiramente no futuro
    clockSkewInMs: 30_000,
  },
);

export const config = {
  matcher: [
    // Ignora arquivos estáticos e API routes internas do Next.js
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|mp4|mov|webm|pdf)).*)',
    // Sempre roda para API routes
    '/(api|trpc)(.*)',
  ],
};
