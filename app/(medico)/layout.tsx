import type { ReactNode } from 'react';
import { MedicoSidebar } from '@/components/shared/medico-sidebar';

/**
 * Layout da área do médico.
 * Sidebar fixa + área de conteúdo.
 */
export default function MedicoLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <MedicoSidebar />
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
