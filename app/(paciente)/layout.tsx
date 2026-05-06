import type { ReactNode } from 'react';
import { PacienteSidebar } from '@/components/shared/paciente-sidebar';

/**
 * Layout da área do paciente.
 * Sidebar fixa + área de conteúdo.
 */
export default function PacienteLayout({ children }: { children: ReactNode }) {
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
