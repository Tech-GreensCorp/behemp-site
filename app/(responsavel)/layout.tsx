import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';

import { SidebarDoResponsavel } from '@/components/responsavel/sidebar-do-responsavel';
import {
  listarDependentesDoResponsavel,
  responsavelDaSessao,
  temFichaDePaciente,
} from '@/lib/auth/escopo-do-responsavel';
import { obterRoleComFallback } from '@/lib/auth';

/**
 * Layout da área do responsável (ADR-0033). O papel vem de `obterRoleComFallback()`: publicMetadata →
 * banco → default. Entram `responsavel` (quem não faz o próprio tratamento) e `paciente` (que também cuida de
 * outra pessoa); admin e médico têm as próprias áreas.
 *
 * Barra lateral + conteúdo, como a área do paciente. A lista de dependentes do menu vem de
 * `listarDependentesDoResponsavel`, que só devolve os do responsável logado.
 *
 * ⚠️ O papel certo NÃO basta para ver um dependente: cada página de dependente passa por
 * `carregarDependente`, que prova o vínculo.
 */
export default async function ResponsavelLayout({ children }: { children: ReactNode }) {
  const { user, role } = await obterRoleComFallback();

  // `paciente` entra porque pode ser responsável de outra pessoa (regra de Dryelle, 28/10/2026); admin e médico não.
  if (!user || (role !== 'responsavel' && role !== 'paciente')) {
    redirect('/');
  }

  const [dependentes, responsavel] = await Promise.all([
    listarDependentesDoResponsavel(),
    responsavelDaSessao(),
  ]);
  // "Minha área de paciente" só para quem TEM ficha de paciente: o responsável puro não é paciente.
  const temAreaDePaciente = responsavel ? await temFichaDePaciente(responsavel.id) : false;

  return (
    <div className="ambar-scope flex min-h-screen flex-col font-sans lg:flex-row">
      <SidebarDoResponsavel
        dependentes={dependentes.map((d) => ({ pacienteId: d.pacienteId, nome: d.nome }))}
        temAreaDePaciente={temAreaDePaciente}
      />
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
