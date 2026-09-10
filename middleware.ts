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
  '/parceiros',
  '/programa-acesso-solidario',
  '/contato',
  '/triagem',
  '/politica-de-privacidade',
  '/termos-de-uso',
  '/redirect',
  // Previsualização de layout — SÓ existe fora de produção.
  // A própria rota faz `notFound()` quando NODE_ENV=production, então liberá-la aqui não abre
  // nada em produção: lá ela não existe. Sem esta linha, o middleware manda para o Clerk antes
  // de a rota poder responder — foi o que aconteceu em 20/08/2026.
  ...(process.env.NODE_ENV === 'production' ? [] : ['/preview(.*)']),
  // Arquivos de SEO — NUNCA devem ser interceptados pelo auth
  '/robots.txt',
  '/sitemap.xml',
  '/sitemap(.*).xml',
  '/favicon.ico',
  /**
   * 🔴 O CADASTRO QUE VEM DO WHATSAPP.
   *
   * Quem abre este link AINDA NÃO TEM CONTA — criar a conta é justamente o que a tela
   * faz. Sem esta linha o middleware manda o paciente para o login antes de a página
   * existir, e ele fica preso num laço: para se cadastrar, precisaria já estar cadastrado.
   *
   * A rota não fica desprotegida por isso: o token de 64 hex no caminho é a credencial,
   * é de uso único, expira, e é conferido no servidor antes de qualquer campo ser pintado.
   */
  '/cadastro(.*)',
  /**
   * 🔴 AS ROTAS DO CHATPRO NÃO USAM CLERK — E NÃO PODEM USAR.
   *
   * Quem as chama é o servidor do ChatPro e o cron, não um navegador com sessão. Elas
   * têm autenticação própria: `x-chatpro-intake-secret` comparado em tempo constante no
   * bot-link e no intake, token no caminho da URL no webhook, e `CRON_SECRET` no
   * processador.
   *
   * ⚠️ ISTO NÃO APARECEU NOS TESTES LOCAIS porque o `.env` de desenvolvimento está sem
   * as chaves do Clerk — sem elas o middleware não bloqueia nada, e tudo respondeu 200.
   * Em produção, com o Clerk configurado, toda chamada do ChatPro receberia um redirect
   * para a tela de login: o bot registraria falha, o paciente cairia na triagem humana, e
   * o log da aplicação não mostraria nada — porque a requisição nunca chegaria à rota.
   */
  '/api/chatpro(.*)',
  /**
   * 🔴 O HANDOFF DOS PARCEIROS TAMBÉM NÃO USA CLERK.
   * Quem chama é o servidor da Greens, não um navegador com sessão. A autenticação é
   * HMAC-SHA256 sobre id + timestamp + corpo, com janela de 300 s — mais forte que uma
   * sessão de navegador, porque prova também a INTEGRIDADE do corpo.
   * Sem esta linha, a chamada receberia um redirect para a tela de login e o log da
   * aplicação não mostraria nada: foi exatamente o que aconteceu com o ChatPro (Item 21).
   */
  '/api/parceiros(.*)',
  // Rotas de sistema e integrações
  '/api/webhooks(.*)',
  '/api/cron(.*)',
  '/api/inngest(.*)',
  '/api/auth/callback',
  '/api/anvisa/signing-complete',
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
