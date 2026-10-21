import { listarMedicosAdmin } from '@/app/_actions/admin-medicos';
import { obterStatus } from '@/lib/mercadopago/conta';
import { GerenciarMedicos } from './gerenciar-medicos';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/shared/page-header';

export const metadata: Metadata = {
  title: 'Médicos — Admin Be4Hope',
};

/**
 * Página de gerenciamento de médicos.
 * Lista os médicos cadastrados e oferece formulário para adicionar ou editar.
 */
export default async function AdminMedicosPage() {
  const medicosResult = await listarMedicosAdmin();
  const medicos = medicosResult.dados ?? [];

  // `obterStatus` lê só metadado — não decifra credencial e não audita (ADR-0024 §5).
  // Uma consulta por médico, em paralelo; a tabela tem uma linha por médico e a lista é
  // pequena. Se um dia crescer, isto vira um `IN (…)` — não uma cache.
  const status = await Promise.all(medicos.map((m) => obterStatus(m.medicoId)));
  const mpConectado: Record<string, boolean> = {};
  medicos.forEach((m, i) => {
    mpConectado[m.medicoId] = status[i].conectado;
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Controle"
        title="Médicos"
        description="Gerencie os médicos parceiros da plataforma Be4Hope."
      />

      {medicosResult.erro && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {medicosResult.erro}
        </p>
      )}

      <GerenciarMedicos medicos={medicos} mpConectado={mpConectado} />
    </div>
  );
}
