import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { currentUser } from '@clerk/nextjs/server';
import { PacienteSidebar } from '@/components/shared/paciente-sidebar';

/**
 * Layout da área do paciente.
 * Verifica role via currentUser() — sem dependência do JWT/sessionClaims.
 * Sidebar fixa + área de conteúdo.
 */
export default async function PacienteLayout({ children }: { children: ReactNode }) {
  const user = await currentUser();
  const role = user?.publicMetadata?.role as string | undefined;

  if (!user || (role !== 'paciente' && role !== 'admin')) {
    redirect('/');
  }

  return (
    <div className="flex min-h-screen">
      <PacienteSidebar />
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}

