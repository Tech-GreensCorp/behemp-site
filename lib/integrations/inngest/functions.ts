import { inngest } from './client';

/**
 * Job: Verificar documentos próximos do vencimento.
 *
 * Roda diariamente às 9h (Inngest Schedule).
 * Busca documentos com validade nos próximos 30 dias e:
 * 1. Cria notificação no sistema
 * 2. Envia e-mail ao paciente via Resend
 */
export const verificarValidadeDocumentos = inngest.createFunction(
  {
    id: 'verificar-validade-documentos',
    name: 'Verificar Validade de Documentos',
    triggers: [{ cron: '0 9 * * *' }],
  },
  async ({ step }) => {
    // Step 1: Buscar documentos próximos do vencimento
    const documentosVencendo = await step.run(
      'buscar-documentos-vencendo',
      async () => {
        // Esta lógica será conectada ao banco via Server Action na Fase 4
        console.log(
          '[Job] Buscando documentos com validade nos próximos 30 dias...',
        );
        return [] as Array<{
          id: string;
          pacienteEmail: string;
          pacienteNome: string;
          tipoDocumento: string;
          dataValidade: string;
          pacienteUserId: string;
        }>;
      },
    );

    // Step 2: Enviar notificações para cada documento
    for (const doc of documentosVencendo) {
      await step.run(`notificar-documento-${doc.id}`, async () => {
        const { enviarEmailRenovacaoDocumento } = await import(
          '@/lib/integrations/resend'
        );

        await enviarEmailRenovacaoDocumento({
          emailPaciente: doc.pacienteEmail,
          nomePaciente: doc.pacienteNome,
          tipoDocumento: doc.tipoDocumento,
          dataValidade: doc.dataValidade,
        });

        console.log(
          `[Job] Notificação enviada para ${doc.pacienteEmail} — Documento: ${doc.tipoDocumento}`,
        );
      });
    }

    return {
      documentosVerificados: documentosVencendo.length,
      timestamp: new Date().toISOString(),
    };
  },
);

/**
 * Job: Verificar recompras de medicamentos.
 *
 * Roda diariamente às 9h.
 * Busca dosagens ativas cujo frasco está previsto para acabar nos próximos 10 dias.
 */
export const verificarRecompraMedicamentos = inngest.createFunction(
  {
    id: 'verificar-recompra-medicamentos',
    name: 'Verificar Recompra de Medicamentos',
    triggers: [{ cron: '0 9 * * *' }],
  },
  async ({ step }) => {
    // Step 1: Buscar dosagens com recompra próxima
    const recomprasPendentes = await step.run(
      'buscar-recompras-pendentes',
      async () => {
        console.log(
          '[Job] Buscando dosagens com recompra nos próximos 10 dias...',
        );
        return [] as Array<{
          id: string;
          pacienteEmail: string;
          pacienteNome: string;
          nomeMedicamento: string;
          dataPrevista: string;
          pacienteUserId: string;
        }>;
      },
    );

    // Step 2: Enviar notificações
    for (const recompra of recomprasPendentes) {
      await step.run(`notificar-recompra-${recompra.id}`, async () => {
        const { enviarEmailRecompraMedicamento } = await import(
          '@/lib/integrations/resend'
        );

        await enviarEmailRecompraMedicamento({
          emailPaciente: recompra.pacienteEmail,
          nomePaciente: recompra.pacienteNome,
          nomeMedicamento: recompra.nomeMedicamento,
          dataPrevista: recompra.dataPrevista,
        });

        console.log(
          `[Job] Notificação de recompra enviada para ${recompra.pacienteEmail}`,
        );
      });
    }

    return {
      recomprasVerificadas: recomprasPendentes.length,
      timestamp: new Date().toISOString(),
    };
  },
);

/**
 * Job: Enviar e-mail de recompra em data específica.
 *
 * Disparado por evento quando uma recompra é criada.
 * Usa step.sleepUntil para agendar o envio na data prevista.
 */
export const enviarEmailRecompraAgendado = inngest.createFunction(
  {
    id: 'enviar-email-recompra-agendado',
    name: 'Enviar E-mail de Recompra Agendado',
    triggers: [{ event: 'be4hope/recompra.criada' }],
  },
  async ({ event, step }) => {
    const { dataPrevista, pacienteEmail, pacienteNome, nomeMedicamento } =
      event.data;

    // Aguardar até a data prevista
    await step.sleepUntil('aguardar-data-recompra', dataPrevista);

    // Enviar o e-mail
    await step.run('enviar-email', async () => {
      const { enviarEmailRecompraMedicamento } = await import(
        '@/lib/integrations/resend'
      );

      await enviarEmailRecompraMedicamento({
        emailPaciente: pacienteEmail,
        nomePaciente: pacienteNome,
        nomeMedicamento,
        dataPrevista,
      });
    });

    return { enviado: true, timestamp: new Date().toISOString() };
  },
);
