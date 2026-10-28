import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';

import { CabecalhoDoResponsavel } from '@/components/responsavel/cabecalho-do-responsavel';
import { obterRoleComFallback } from '@/lib/auth';

/**
 * Layout da área do responsável (ADR-0033). O papel vem de `obterRoleComFallback()`: publicMetadata →
 * banco → default. Entram `responsavel` (quem não faz o próprio tratamento) e `paciente` (que também cuida de
 * outra pessoa); admin e médico têm as próprias áreas.
 *
 * ⚠️ O papel certo NÃO basta para ver um dependente: cada leitura passa por
 * `lib/auth/escopo-do-responsavel.ts`, que prova o vínculo.
 */
export default async function ResponsavelLayout({ children }: { children: ReactNode }) {
  const { user, role } = await obterRoleComFallback();

  // `paciente` entra porque pode ser responsável de outra pessoa (regra de Dryelle, 28/10/2026); admin e médico não.
  if (!user || (role !== 'responsavel' && role !== 'paciente')) {
    redirect('/');
  }

  const nome = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Responsável';

  return (
    <div className="ambar-scope flex min-h-screen flex-col font-sans">
      <CabecalhoDoResponsavel
        nome={nome}
        voltarPara={role === 'paciente' ? '/paciente' : undefined}
      />
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
