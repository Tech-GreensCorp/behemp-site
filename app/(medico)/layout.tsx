import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { obterRoleComFallback } from '@/lib/auth';
import { MedicoSidebar } from '@/components/shared/medico-sidebar';

/**
 * Layout da área do médico.
 * Verifica role via obterRoleComFallback() — publicMetadata → banco → default 'paciente'.
 * Sidebar fixa + área de conteúdo.
 */
export default async function MedicoLayout({ children }: { children: ReactNode }) {
  const { user, role } = await obterRoleComFallback();

  if (!user || (role !== 'medico' && role !== 'admin')) {
    redirect('/');
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen">
      <MedicoSidebar />
      <main className="flex-1 overflow-auto">
        <div className="px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}

