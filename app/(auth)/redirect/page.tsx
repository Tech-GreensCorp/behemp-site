import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

/**
 * Página de redirecionamento pós-login — Server Component.
 *
 * Roda inteiramente no servidor: lê a sessão via auth() (JWT rápido)
 * e currentUser() (API do Clerk), determina o role e redireciona
 * instantaneamente antes de qualquer renderização no browser.
 *
 * IMPORTANTE:
 * - 'force-dynamic' garante que esta rota NUNCA seja cacheada.
 * - A rota é marcada como PÚBLICA no middleware para evitar race condition
 *   onde o middleware bloqueia o acesso antes da sessão propagar.
 * - Usamos auth() primeiro (JWT rápido) e currentUser() como fallback.
 */
export const dynamic = 'force-dynamic';

export default async function AuthRedirectPage() {
  // Estratégia 1: auth() — resolve via JWT/cookie, mais rápido
  const { userId } = await auth();

  if (!userId) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Redirect] Nenhuma sessão via auth(), redirecionando para sign-in');
    }
    redirect('/sign-in');
  }

  // Estratégia 2: currentUser() — busca metadata completa do Clerk API
  let role: string | undefined;

  try {
    const user = await currentUser();

    if (user) {
      role = user.publicMetadata?.role as string | undefined;
      if (process.env.NODE_ENV === 'development') {
        console.debug(
          `[Redirect] Usuário: ${user.emailAddresses?.[0]?.emailAddress} | Role: ${role ?? 'sem role'}`,
        );
      }
    }
  } catch (error) {
    console.error('[Redirect] Erro ao buscar currentUser:', error);
    // Se currentUser falhar mas auth() deu certo, tenta resolver via sessionClaims
    const session = await auth();
    role = (session.sessionClaims?.metadata as { role?: string })?.role;
    console.log(`[Redirect] Fallback via claims | Role: ${role ?? 'sem role'}`);
  }

  // Redireciona para o dashboard conforme o role
  if (role === 'admin') redirect('/admin');
  if (role === 'medico') redirect('/medico');
  if (role === 'paciente') redirect('/paciente');

  // Conta sem role configurada: vai para a home pública
  console.warn('[Redirect] Usuário sem role configurada, redirecionando para home');
  redirect('/');
}
