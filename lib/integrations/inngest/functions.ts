import { inngest } from './client';
import { db } from '@/lib/db';
import { documentos, dosagens, medicamentos, pacientes, users, notificacoes } from '@/db/schema';
import { eq, and, lte, gte, isNull, sql } from 'drizzle-orm';

/**
 * Job: Verificar documentos próximos do vencimento.
 *
 * Roda diariamente às 9h (Inngest Schedule).
 * Busca documentos com validade nos próximos 30 dias e:
 * 1. Cria notificação no sistema
 * 2. Envia e-mail ao paciente via Brevo
 */
export const verificarValidadeDocumentos = inngest.createFunction(
  {
    id: 'verificar-validade-documentos',
    name: 'Verificar Validade de Documentos',
    triggers: [{ cron: '0 9 * * *' }],
  },
  async ({ step }) => {
    // Step 1: Buscar documentos próximos do vencimento (30 dias)
    const documentosVencendo = await step.run(
      'buscar-documentos-vencendo',
      async () => {
        const hoje = new Date();
        const daqui30dias = new Date();
        daqui30dias.setDate(hoje.getDate() + 30);

        const resultado = await db
          .select({
            id: documentos.id,
            tipo: documentos.tipo,
            dataValidade: documentos.dataValidade,
            pacienteId: documentos.pacienteId,
            pacienteNome: users.nome,
            pacienteEmail: users.email,
            pacienteUserId: pacientes.userId,
          })
          .from(documentos)
          .innerJoin(pacientes, eq(documentos.pacienteId, pacientes.id))
          .innerJoin(users, eq(pacientes.userId, users.id))
          .where(
            and(
              isNull(documentos.deletedAt),
              lte(documentos.dataValidade, daqui30dias.toISOString().split('T')[0]),
              gte(documentos.dataValidade, hoje.toISOString().split('T')[0]),
            ),
          );

        console.log(
          `[Job] Encontrados ${resultado.length} documentos próximos do vencimento`,
        );

        return resultado.map((doc) => ({
          id: doc.id,
          pacienteEmail: doc.pacienteEmail,
          pacienteNome: doc.pacienteNome,
          tipoDocumento: doc.tipo,
          dataValidade: doc.dataValidade,
          pacienteUserId: doc.pacienteUserId,
        }));
      },
    );

    // Step 2: Criar notificações e enviar e-mails
    for (const doc of documentosVencendo) {
      await step.run(`notificar-documento-${doc.id}`, async () => {
        // Criar notificação no sistema
        await db.insert(notificacoes).values({
          userId: doc.pacienteUserId,
          titulo: 'Documento próximo do vencimento',
          mensagem: `Seu documento "${doc.tipoDocumento}" vence em ${doc.dataValidade}. Providencie a renovação.`,
          tipo: 'renovacao_documento',
        });

        // Enviar e-mail via Brevo
        try {
          const { enviarEmailRenovacaoDocumento } = await import(
            '@/lib/email/notificacoes'
          );

          await enviarEmailRenovacaoDocumento({
            emailPaciente: doc.pacienteEmail,
            nomePaciente: doc.pacienteNome,
            tipoDocumento: doc.tipoDocumento,
            dataValidade: doc.dataValidade,
          });
        } catch (error) {
          console.error(`[Job] Erro ao enviar e-mail para ${doc.pacienteEmail}:`, error);
        }

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
    // Step 1: Buscar dosagens com recompra próxima (10 dias)
    const recomprasPendentes = await step.run(
      'buscar-recompras-pendentes',
      async () => {
        const hoje = new Date();
        const daqui10dias = new Date();
        daqui10dias.setDate(hoje.getDate() + 10);

        const resultado = await db
          .select({
            id: dosagens.id,
            dataPrevista: dosagens.dataFimPrevista,
            nomeMedicamento: medicamentos.nome,
            pacienteId: dosagens.pacienteId,
            pacienteNome: users.nome,
            pacienteEmail: users.email,
            pacienteUserId: pacientes.userId,
          })
          .from(dosagens)
          .innerJoin(medicamentos, eq(dosagens.medicamentoId, medicamentos.id))
          .innerJoin(pacientes, eq(dosagens.pacienteId, pacientes.id))
          .innerJoin(users, eq(pacientes.userId, users.id))
          .where(
            and(
              eq(dosagens.ativa, true),
              lte(dosagens.dataFimPrevista, daqui10dias.toISOString().split('T')[0]),
              gte(dosagens.dataFimPrevista, hoje.toISOString().split('T')[0]),
            ),
          );

        console.log(
          `[Job] Encontradas ${resultado.length} dosagens com recompra nos próximos 10 dias`,
        );

        return resultado.map((r) => ({
          id: r.id,
          pacienteEmail: r.pacienteEmail,
          pacienteNome: r.pacienteNome,
          nomeMedicamento: r.nomeMedicamento,
          dataPrevista: r.dataPrevista,
          pacienteUserId: r.pacienteUserId,
        }));
      },
    );

    // Step 2: Criar notificações e enviar e-mails
    for (const recompra of recomprasPendentes) {
      await step.run(`notificar-recompra-${recompra.id}`, async () => {
        // Criar notificação no sistema
        await db.insert(notificacoes).values({
          userId: recompra.pacienteUserId,
          titulo: 'Recompra de medicamento',
          mensagem: `Seu medicamento "${recompra.nomeMedicamento}" está previsto para acabar em ${recompra.dataPrevista}.`,
          tipo: 'recompra_medicamento',
        });

        // Enviar e-mail via Brevo
        try {
          const { enviarEmailRecompraPaciente } = await import(
            '@/lib/email/notificacoes'
          );

          await enviarEmailRecompraPaciente({
            emailPaciente: recompra.pacienteEmail,
            nomePaciente: recompra.pacienteNome,
            nomeMedicamento: recompra.nomeMedicamento,
            dataPrevista: recompra.dataPrevista,
          });
        } catch (error) {
          console.error(`[Job] Erro ao enviar e-mail para ${recompra.pacienteEmail}:`, error);
        }

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
      const { enviarEmailRecompraPaciente } = await import(
        '@/lib/email/notificacoes'
      );

      await enviarEmailRecompraPaciente({
        emailPaciente: pacienteEmail,
        nomePaciente: pacienteNome,
        nomeMedicamento,
        dataPrevista,
      });
    });

    return { enviado: true, timestamp: new Date().toISOString() };
  },
);
