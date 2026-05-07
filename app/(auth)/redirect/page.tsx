import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

/**
 * Página de redirecionamento pós-login — Server Component.
 *
 * Roda inteiramente no servidor: lê a sessão via currentUser() (API do Clerk,
 * não JWT), determina o role e redireciona instantaneamente antes de qualquer
 * renderização no browser. Elimina completamente o flash entre telas.
 */
export default async function AuthRedirectPage() {
  const user = await currentUser();

  // Sem sessão: volta para o login
  if (!user) {
    redirect('/sign-in');
  }

  const role = user.publicMetadata?.role as string | undefined;

  // Redireciona para o dashboard conforme o role
  if (role === 'admin') redirect('/admin');
  if (role === 'medico') redirect('/medico');
  if (role === 'paciente') redirect('/paciente');

  // Conta sem role configurada: vai para a home pública
  redirect('/');
}
