import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

/**
 * Rota de callback pós-login.
 * Lê o role do usuário e redireciona para o dashboard correto.
 * Usada como afterSignInUrl e afterSignUpUrl no componente SignIn.
 */
export async function GET() {
  const { userId, sessionClaims } = await auth();

  // Não autenticado — volta para sign-in
  if (!userId) {
    redirect('/sign-in');
  }

  // Tenta ler o role do JWT (se o session token está configurado)
  type MetaRole = { role?: string } | undefined;
  const metaRole = (sessionClaims?.metadata as MetaRole)?.role
    ?? (sessionClaims?.publicMetadata as MetaRole)?.role;

  // Se não tem no JWT, busca diretamente do Clerk (mais lento, mas confiável)
  if (!metaRole) {
    const user = await currentUser();
    const publicRole = (user?.publicMetadata as { role?: string })?.role;

    if (publicRole === 'admin') redirect('/admin');
    if (publicRole === 'medico') redirect('/medico');
    if (publicRole === 'paciente') redirect('/paciente');

    // Sem role definido — volta para home
    redirect('/');
  }

  // Redireciona pelo role no JWT
  if (metaRole === 'admin') redirect('/admin');
  if (metaRole === 'medico') redirect('/medico');
  if (metaRole === 'paciente') redirect('/paciente');

  redirect('/');
}
