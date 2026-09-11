'use client';

import { AgendamentoWizard } from '@/components/shared/agendamento-wizard';

/**
 * Agendamento — única rota do fluxo (não existe versão pública). Protegida pelo
 * layout de `(paciente)`, que redireciona quem não é paciente/admin.
 */
export default function PacienteAgendamentoPage() {
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

      <AgendamentoWizard />
    </div>
  );
}
