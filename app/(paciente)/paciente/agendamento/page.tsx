import { AgendamentoWizard } from '@/components/shared/agendamento-wizard';
import { obterEstadoAgendamentoPaciente } from '@/app/(public)/_actions/agendamento';
import { PageHeader } from '@/components/shared/page-header';

/**
 * Agendamento — única rota do fluxo (não existe versão pública). Protegida pelo
 * layout de `(paciente)`, que redireciona quem não é paciente/admin.
 *
 * Server Component: a etapa do wizard e a reserva ativa vêm do banco a cada carregamento
 * (`obterEstadoAgendamentoPaciente`), não só do estado local do componente — reload ou
 * saída da tela não faz o paciente perder uma reserva em andamento.
 */
export default async function PacienteAgendamentoPage() {
  const estado = await obterEstadoAgendamentoPaciente();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Agendamento"
        title="Agende sua consulta"
        description="Escolha o médico, a data e o horário para a sua teleconsulta."
      />

      <AgendamentoWizard
        reservaAtivaInicial={estado.dados?.reservaAtiva ?? null}
        historicoInicial={estado.dados?.historico ?? []}
      />
    </div>
  );
}
