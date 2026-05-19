import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Rota de callback pós-login.
 * Lê o role do usuário e redireciona para o dashboard correto.
 * Usada como afterSignInUrl e afterSignUpUrl no componente SignIn.
 *
 * ESTRATÉGIA DE ROLE (em ordem de prioridade):
 * 1. sessionClaims (JWT — mais rápido)
 * 2. publicMetadata do Clerk (API — mais atualizado)
 * 3. Banco de dados (fallback para primeiro login via OAuth)
 * 4. Default 'paciente'
 */
export async function GET() {
  const { userId, sessionClaims } = await auth();

  // Não autenticado — volta para sign-in
  if (!userId) {
    redirect('/sign-in');
  }

  // 1. Tenta ler o role do JWT (se o session token está configurado)
  type MetaRole = { role?: string } | undefined;
  let role: string | undefined =
    (sessionClaims?.metadata as MetaRole)?.role ??
    (sessionClaims?.publicMetadata as MetaRole)?.role;

  // 2. Se não tem no JWT, busca diretamente do Clerk (mais lento, mas confiável)
  if (!role) {
    const user = await currentUser();
    role = (user?.publicMetadata as { role?: string })?.role;
  }

  // 3. Fallback: banco de dados (necessário no primeiro login via OAuth como Google)
  if (!role) {
    try {
      const [registro] = await db
        .select({ role: users.role })
        .from(users)
        .where(eq(users.clerkId, userId))
        .limit(1);

      if (registro?.role) {
        role = registro.role;
      }
    } catch {
      // Banco indisponível — usa default abaixo
    }
  }

  // 4. Default: toda conta nova sem role é tratada como paciente
  if (!role) {
    role = 'paciente';
  }

  if (role === 'admin') redirect('/admin');
  if (role === 'medico') redirect('/medico');
  redirect('/paciente');
}
