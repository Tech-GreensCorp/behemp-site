import { listarPacientesPorJornada } from '@/app/_actions/pacientes';
import { KanbanBoard } from '@/components/medico/kanban-board';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  UserPlus,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
/**
 * Página "Jornada do Paciente" — Board Kanban CRM.
 *
 * Server Component que carrega os dados no servidor e repassa
 * para o KanbanBoard client-side que gerencia drag & drop.
 *
 * Design: Organic / Editorial Caloroso — Fraunces heading, Epilogue body.
 * Layout: viewport-fixed — apenas as colunas do kanban têm scroll.
 */
export default async function JornadaPage() {
  const resultado = await listarPacientesPorJornada();

  const dados = resultado.dados ?? {
    acolhimento: [],
    avaliacao_medica: [],
    burocracia_anvisa: [],
    logistica: [],
    acompanhamento_continuo: [],
  };

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col overflow-hidden">
      {/* Header — fixo no topo */}
      <div className="shrink-0 pb-4">
        <PageHeader
          eyebrow="Operação"
          title="Jornada do Paciente"
          description="Arraste e solte os cartões entre as colunas para atualizar a fase de cada paciente no fluxo de tratamento."
          actions={
            <Link href="/medico/pacientes/novo">
              <Button className="gap-2 rounded-xl">
                <UserPlus size={16} />
                Novo paciente
              </Button>
            </Link>
          }
        />
      </div>

      {/* Board — ocupa todo o espaço restante, sem scroll na página */}
      <div className="min-h-0 flex-1 overflow-x-auto pb-2">
        <KanbanBoard dadosIniciais={dados} />
      </div>
    </div>
  );
}
