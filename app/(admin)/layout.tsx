import type { ReactNode } from 'react';
import { AdminSidebar } from '@/components/shared/admin-sidebar';

/**
 * Layout da área do admin.
 * Sidebar fixa + área de conteúdo.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
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
