import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Página de redirecionamento pós-login — Server Component.
 *
 * Roda inteiramente no servidor: lê a sessão via auth() (JWT rápido)
 * e currentUser() (API do Clerk), determina o role e redireciona
 * instantaneamente antes de qualquer renderização no browser.
 *
 * ESTRATÉGIA DE ROLE (em ordem de prioridade):
 * 1. publicMetadata.role do Clerk (JWT já propagado — caso nominal)
 * 2. sessionClaims.metadata.role (fallback JWT)
 * 3. Banco de dados (fallback para OAuth como Google no primeiro login,
 *    onde o publicMetadata ainda não foi sincronizado)
 * 4. Default 'paciente' (toda conta nova é tratada como paciente)
 *
 * IMPORTANTE:
 * - 'force-dynamic' garante que esta rota NUNCA seja cacheada.
 * - A rota é marcada como PÚBLICA no middleware para evitar race condition
 *   onde o middleware bloqueia o acesso antes da sessão propagar.
 */
export const dynamic = 'force-dynamic';

export default async function AuthRedirectPage() {
  // Estratégia 1: auth() — resolve via JWT/cookie, mais rápido
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Redirect] Nenhuma sessão via auth(), redirecionando para sign-in');
    }
    redirect('/sign-in');
  }

  // Estratégia 2: publicMetadata via currentUser() — mais atualizado que o JWT
  let role: string | undefined;

  try {
    const user = await currentUser();

    if (user) {
      role = user.publicMetadata?.role as string | undefined;
      if (process.env.NODE_ENV === 'development') {
        console.debug(
          `[Redirect] Usuário: ${user.emailAddresses?.[0]?.emailAddress} | Role Clerk: ${role ?? 'sem role'}`,
        );
      }
    }
  } catch (error) {
    console.error('[Redirect] Erro ao buscar currentUser:', error);
  }

  // Estratégia 3: sessionClaims do JWT (fallback se currentUser falhou)
  if (!role) {
    role = (sessionClaims?.metadata as { role?: string } | undefined)?.role;
    if (role && process.env.NODE_ENV === 'development') {
      console.debug(`[Redirect] Role via sessionClaims: ${role}`);
    }
  }

  // Estratégia 4: banco de dados — necessário no PRIMEIRO login via OAuth (Google, etc.)
  // O webhook user.created cria o registro com role='paciente', mas o publicMetadata
  // do Clerk pode ainda não ter sido sincronizado quando esta página é renderizada.
  if (!role) {
    try {
      const [registro] = await db
        .select({ role: users.role })
        .from(users)
        .where(eq(users.clerkId, userId))
        .limit(1);

      if (registro?.role) {
        role = registro.role;
        console.log(`[Redirect] Role via banco: ${role} (clerkId: ${userId})`);
      }
    } catch (dbError) {
      console.error('[Redirect] Erro ao buscar role no banco:', dbError);
    }
  }

  // Estratégia 5: default — toda conta nova sem role explícita é tratada como paciente
  if (!role) {
    console.warn(`[Redirect] Role não encontrada para clerkId: ${userId} — usando default 'paciente'`);
    role = 'paciente';
  }

  // Redireciona para o dashboard conforme o role
  if (role === 'admin') redirect('/admin');
  if (role === 'medico') redirect('/medico');
  redirect('/paciente');
}

