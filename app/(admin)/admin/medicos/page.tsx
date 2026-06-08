import { listarMedicosAdmin } from '@/app/_actions/admin-medicos';
import { FormCriarMedico } from './form-criar-medico';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ChevronRight, Stethoscope } from 'lucide-react';
import type { Metadata } from 'next';

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
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Médicos</h1>
        <p className="mt-1 text-muted-foreground">
          Gerencie os médicos parceiros da plataforma Be4Hope.
        </p>
      </div>

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
              <div className="space-y-3">
                {medicos.map((m) => (
                  <Link
                    key={m.medicoId}
                    href={`/admin/medicos/${m.medicoId}`}
                    className="group flex items-center gap-3 rounded-xl border border-border/50 p-4 transition-all hover:border-primary/50 hover:bg-accent/30"
                  >
                    {m.avatarUrl ? (
                      <img
                        src={m.avatarUrl}
                        alt={m.nome}
                        className="h-12 w-12 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-violet-500/10">
                        <Stethoscope size={20} className="text-violet-600" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{m.nome}</p>
                      <p className="truncate text-xs text-muted-foreground">{m.especialidade}</p>
                      {m.crm && (
                        <p className="mt-0.5 text-xs font-medium text-primary">CRM {m.crm}</p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {m.totalPacientes} paciente{m.totalPacientes !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <ChevronRight
                      size={16}
                      className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1"
                    />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Formulário para cadastrar novo médico */}
        <FormCriarMedico />
      </div>
    </div>
  );
}
