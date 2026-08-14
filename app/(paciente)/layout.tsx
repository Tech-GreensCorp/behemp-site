import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { obterRoleComFallback } from '@/lib/auth';
import { PacienteSidebar } from '@/components/shared/paciente-sidebar';

/**
 * Layout da área do paciente.
 * Verifica role via obterRoleComFallback() — publicMetadata → banco → default 'paciente'.
 * Sidebar fixa + área de conteúdo.
 *
 * Exceção: /paciente/farmacia é liberada a qualquer usuário autenticado (não
 * só role paciente/admin), pois a Nossa Farmácia é um módulo aberto a toda a
 * plataforma. O pathname chega via header x-pathname (setado no middleware),
 * já que Server Components não recebem a rota atual por padrão.
 */
export default async function PacienteLayout({ children }: { children: ReactNode }) {
  const { user, role } = await obterRoleComFallback();
  const pathname = (await headers()).get('x-pathname') ?? '';
  const isFarmacia = pathname.startsWith('/paciente/farmacia');

  if (!user || (!isFarmacia && role !== 'paciente' && role !== 'admin')) {
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

