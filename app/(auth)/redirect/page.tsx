'use client';

import { useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

/**
 * Página de redirecionamento pós-login.
 * Roda no cliente onde o cookie de sessão já está disponível.
 * Lê publicMetadata.role e redireciona para o dashboard correto.
 */
export default function AuthRedirectPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;

    if (!user) {
      router.replace('/sign-in');
      return;
    }

    const role = (user.publicMetadata as { role?: string })?.role;

    if (role === 'admin') {
      router.replace('/admin');
    } else if (role === 'medico') {
      router.replace('/medico');
    } else if (role === 'paciente') {
      router.replace('/paciente');
    } else {
      // Sem role definido: vai para home
      router.replace('/');
    }
  }, [isLoaded, user, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f0eb]">
      <div className="flex flex-col items-center gap-4 text-center">
        {/* Spinner orgânico */}
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-stone-200"
          style={{ borderTopColor: '#c8956c' }}
        />
        <p className="text-sm text-stone-500">Redirecionando para sua área...</p>
      </div>
    </div>
  );
}
