import { listarPacientesPorJornada } from '@/app/_actions/pacientes';
import { KanbanBoard } from '@/components/medico/kanban-board';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  UserPlus,
} from 'lucide-react';
/**
 * Página "Jornada do Paciente" — Board Kanban CRM.
 *
 * Server Component que carrega os dados no servidor e repassa
 * para o KanbanBoard client-side que gerencia drag & drop.
 *
 * Design: Organic / Editorial Caloroso — Fraunces heading, Epilogue body.
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
    <div className="space-y-8">
      {/* Header editorial */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Operação
          </p>
          <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            Jornada do{' '}
            <span className="text-accent-italic">Paciente</span>
          </h1>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground leading-relaxed">
            Arraste e solte os cartões entre as colunas para atualizar a fase de cada paciente no fluxo de tratamento.
          </p>
        </div>
        <Link href="/medico/pacientes/novo">
          <Button className="gap-2 rounded-xl">
            <UserPlus size={16} />
            Novo paciente
          </Button>
        </Link>
      </div>

      {/* Separador orgânico */}
      <div className="h-px bg-gradient-to-r from-border/60 via-border to-transparent" />

      {/* Board — ocupa toda a largura disponível com scroll horizontal em mobile */}
      <div className="overflow-x-auto pb-6">
        <KanbanBoard dadosIniciais={dados} />
      </div>
    </div>
  );
}
