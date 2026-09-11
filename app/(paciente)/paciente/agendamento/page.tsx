import { AgendamentoWizard } from '@/components/shared/agendamento-wizard';
import { obterEstadoAgendamentoPaciente } from '@/app/(public)/_actions/agendamento';

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
      <div>
        <p className="text-primary mb-2 text-xs font-semibold tracking-[0.25em] uppercase">
          Agendamento
        </p>
        <h1 className="font-display text-foreground text-2xl font-bold sm:text-3xl">
          Agende sua consulta
        </h1>
        <p className="text-muted-foreground mt-2">
          Escolha o médico, a data e o horário para a sua teleconsulta.
        </p>
      </div>

      <AgendamentoWizard
        reservaAtivaInicial={estado.dados?.reservaAtiva ?? null}
        historicoInicial={estado.dados?.historico ?? []}
      />
    </div>
  );
}
