import { listarMedicosAdmin } from '@/app/_actions/admin-medicos';
import { FormCriarMedico } from './form-criar-medico';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, Stethoscope } from 'lucide-react';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/shared/page-header';
import { DataList, DataRow } from '@/components/shared/data-list';

export const metadata: Metadata = {
  title: 'Médicos — Admin Be4Hope',
};

/**
 * Página de gerenciamento de médicos.
 * Lista os médicos cadastrados e oferece formulário para adicionar novos.
 */
export default async function AdminMedicosPage() {
  const medicosResult = await listarMedicosAdmin();
  const medicos = medicosResult.dados ?? [];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Controle"
        title="Médicos"
        description="Gerencie os médicos parceiros da plataforma Be4Hope."
      />

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Lista de médicos cadastrados */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Médicos cadastrados</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Clique para ver detalhes, pacientes e configurar agenda.
              </p>
            </div>
            <Badge variant="secondary">{medicos.length}</Badge>
          </CardHeader>
          <CardContent>
            {medicos.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhum médico cadastrado.
              </p>
            ) : (
              <DataList className="border-border/50">
                {medicos.map((m) => (
                  <DataRow
                    key={m.medicoId}
                    href={`/admin/medicos/${m.medicoId}`}
                    icon={
                      m.avatarUrl ? (
                        <img src={m.avatarUrl} alt={m.nome} className="h-full w-full rounded-full object-cover" />
                      ) : (
                        <Stethoscope size={20} className="text-violet-600" />
                      )
                    }
                    title={m.nome}
                    subtitle={
                      <>
                        {m.especialidade}
                        {m.crm && <span className="ml-1.5 font-medium text-primary">{m.crm}</span>}
                      </>
                    }
                    meta={`${m.totalPacientes} paciente${m.totalPacientes !== 1 ? 's' : ''}`}
                    trailing={<ChevronRight size={16} className="shrink-0 text-muted-foreground" />}
                  />
                ))}
              </DataList>
            )}
          </CardContent>
        </Card>

        {/* Formulário para cadastrar novo médico */}
        <FormCriarMedico />
      </div>
    </div>
  );
}
