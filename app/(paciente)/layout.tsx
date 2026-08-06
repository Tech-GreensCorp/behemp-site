import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { obterRoleComFallback } from '@/lib/auth';
import { PacienteSidebar } from '@/components/shared/paciente-sidebar';

/**
 * Layout da área do paciente.
 * Verifica role via obterRoleComFallback() — publicMetadata → banco → default 'paciente'.
 * Sidebar fixa + área de conteúdo.
 */
export default async function PacienteLayout({ children }: { children: ReactNode }) {
  const { user, role } = await obterRoleComFallback();

  if (!user || (role !== 'paciente' && role !== 'admin')) {
    redirect('/');
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen">
      <PacienteSidebar />
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}

