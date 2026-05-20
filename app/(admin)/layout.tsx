import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { obterRoleComFallback } from '@/lib/auth';
import { AdminSidebar } from '@/components/shared/admin-sidebar';

/**
 * Layout da área do admin.
 * Verifica role via obterRoleComFallback() — publicMetadata → banco → default 'paciente'.
 * Sidebar fixa + área de conteúdo.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { user, role } = await obterRoleComFallback();

  if (!user || role !== 'admin') {
    redirect('/');
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
