import { inngest } from './client';
import { db } from '@/lib/db';
import { documentos, dosagens, medicamentos, pacientes, users, notificacoes, emailsNotificacao, alertasEnviados, alertasConfig } from '@/db/schema';
import { eq, and, lte, gte, isNull, sql } from 'drizzle-orm';
import { coletarAlertasMedicacao, coletarAlertasLicencas, coletarAlertasMensalidades } from '@/lib/alertas/coletor';
import { gerarHtmlDigestAdmin, gerarHtmlAlertaPaciente } from '@/lib/email/alertas';
import { enviarEmailGenerico } from '@/lib/email/brevo';
import { liberarReservasExpiradas as liberarReservasVencidas } from '@/lib/agendamento/liberar-reservas-expiradas';

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
 * @deprecated Use o novo motor de alertas unificado (digestDiarioAdmin).
 * Mantido apenas por compatibilidade com rotas/cron antigos até a virada completa.
 */
export const verificarRecompraMedicamentos = inngest.createFunction(
  {
    id: 'verificar-recompra-medicamentos',
    name: 'Verificar Recompra de Medicamentos (Obsoleto)',
    triggers: [{ cron: '0 9 * * *' }], // Será sobrescrito pelo digestDiarioAdmin na prática, mas mantemos isolado.
  },
  async ({ step }) => {
    return { status: 'obsoleto', substituto: 'digest-diario-admin' };
  }
);

/**
 * Job: Central de Alertas — Digest Diário para Admins e Alertas Paciente.
 * Roda diariamente, varre medicação, licenças e mensalidades.
 * Centraliza e unifica as regras antigas.
 */
export const digestDiarioAdmin = inngest.createFunction(
  {
    id: 'digest-diario-admin',
    name: 'Digest Diário de Alertas (Admins)',
    triggers: [
      { cron: '0 11 * * *' },
      { event: 'be4hope/digest.manual' }
    ],
  },
  async ({ step }) => {
    // 1. Coleta
    const alertasMedicacao = await step.run('coletar-alertas-medicacao', coletarAlertasMedicacao);
    const alertasLicenca = await step.run('coletar-alertas-licencas', coletarAlertasLicencas);
    const alertasMensalidade = await step.run('coletar-alertas-mensalidades', coletarAlertasMensalidades);

    const todos = [...alertasMedicacao, ...alertasLicenca, ...alertasMensalidade];
    if (todos.length === 0) {
      return { status: 'sem-alertas' };
    }

    // 2. Filtro de Idempotência
    const alertasNovos = await step.run('filtrar-idempotencia', async () => {
      const novos = [];
      for (const a of todos) {
        const jaEnviado = await db.query.alertasEnviados.findFirst({
          where: and(
            eq(alertasEnviados.tipo, a.tipo),
            eq(alertasEnviados.referenciaId, a.referenciaId),
            eq(alertasEnviados.marcoDias, a.marcoDisparado),
            eq(alertasEnviados.destinatario, 'admin')
          )
        });
        if (!jaEnviado) novos.push(a);
      }
      return novos;
    });

    if (alertasNovos.length === 0) {
      return { status: 'todos-ja-enviados' };
    }

    const config = await step.run('obter-config', async () => db.query.alertasConfig.findFirst());
    const notificarPaciente = config?.notificarPaciente ?? true;

    // 3. Notificar Admin (Digest)
    await step.run('enviar-digest-admin', async () => {
      const htmlDigest = gerarHtmlDigestAdmin({
        alertasMedicacao: alertasNovos.filter(a => a.tipo === 'medicacao') as typeof alertasMedicacao,
        alertasLicenca: alertasNovos.filter(a => a.tipo === 'licenca_anvisa') as typeof alertasLicenca,
        alertasMensalidade: alertasNovos.filter(a => a.tipo === 'mensalidade') as typeof alertasMensalidade,
        adminUrl: 'https://be4hope.org/admin/alertas'
      });

      if (!htmlDigest) return;

      const admins = await db.query.emailsNotificacao.findMany({
        where: sql`categoria IN ('administrativo', 'geral')`
      });
      
      const adminEmails = admins.filter(a => a.ativo).map(a => ({ email: a.email, name: a.nome }));

      if (adminEmails.length > 0) {
        await enviarEmailGenerico(
          adminEmails,
          '🚨 Digest de Alertas - Be4Hope',
          htmlDigest
        );

        // Registra envio Admin
        for (const a of alertasNovos) {
          await db.insert(alertasEnviados).values({
            tipo: a.tipo,
            referenciaId: a.referenciaId,
            marcoDias: a.marcoDisparado,
            destinatario: 'admin',
          }).onConflictDoNothing();
        }
      }
    });

    // 4. Notificar Paciente (Medicação e ANVISA)
    if (notificarPaciente) {
      await step.run('enviar-alertas-paciente', async () => {
        const { gerarHtmlAlertaAnvisaPaciente } = await import('@/lib/email/alertas');
        
        // 4.1 Medicação
        const meds = alertasNovos.filter(a => a.tipo === 'medicacao');
        for (const m of meds) {
          // Verifica se paciente já foi notificado neste marco
          const jaEnviado = await db.query.alertasEnviados.findFirst({
            where: and(
              eq(alertasEnviados.tipo, m.tipo),
              eq(alertasEnviados.referenciaId, m.referenciaId),
              eq(alertasEnviados.marcoDias, m.marcoDisparado),
              eq(alertasEnviados.destinatario, 'paciente')
            )
          });

          if (!jaEnviado) {
            const mTyped = m as typeof alertasMedicacao[number];
            const html = gerarHtmlAlertaPaciente({
              nome: mTyped.pacienteNome,
              medicamento: mTyped.medicamento,
              dataTermino: mTyped.dataFim,
              recompraUrl: 'https://be4hope.org/paciente/recompra',
            });

            await enviarEmailGenerico(
              [{ email: m.pacienteEmail, name: m.pacienteNome }],
              'Aviso de Medicação - Be4Hope',
              html
            );

            // Tenta pegar o userId para notificação in-app
            const pUser = await db.query.users.findFirst({ where: eq(users.email, m.pacienteEmail) });
            if (pUser) {
              await db.insert(notificacoes).values({
                userId: pUser.id,
                titulo: 'Lembrete de Recompra',
                mensagem: `O seu medicamento ${mTyped.medicamento} está próximo do fim.`,
                tipo: 'recompra_medicamento',
                linkAcao: '/paciente/recompra',
              });
            }

            // Registra envio Paciente
            await db.insert(alertasEnviados).values({
              tipo: m.tipo,
              referenciaId: m.referenciaId,
              marcoDias: m.marcoDisparado,
              destinatario: 'paciente',
            }).onConflictDoNothing();
          }
        }

        // 4.2 Licença ANVISA
        const licencas = alertasNovos.filter(a => a.tipo === 'licenca_anvisa');
        for (const l of licencas) {
          const jaEnviado = await db.query.alertasEnviados.findFirst({
            where: and(
              eq(alertasEnviados.tipo, l.tipo),
              eq(alertasEnviados.referenciaId, l.referenciaId),
              eq(alertasEnviados.marcoDias, l.marcoDisparado),
              eq(alertasEnviados.destinatario, 'paciente')
            )
          });

          if (!jaEnviado) {
            const lTyped = l as typeof alertasLicenca[number];
            
            // Só enviar alerta de ANVISA para paciente se os diasRestantes forem >= 0, ou seja, evitar alertar paciente sobre expirados que o admin já deve estar ciente
            if (lTyped.diasRestantes >= 0 || lTyped.marcoDisparado < 0) {
              const html = gerarHtmlAlertaAnvisaPaciente({
                nome: lTyped.pacienteNome,
                dataValidade: lTyped.dataValidade,
                diasRestantes: lTyped.diasRestantes,
                renovacaoUrl: 'https://be4hope.org/paciente/anvisa',
              });

              await enviarEmailGenerico(
                [{ email: l.pacienteEmail, name: l.pacienteNome }],
                lTyped.diasRestantes < 0 ? 'Autorização ANVISA Expirada - Be4Hope' : 'Aviso de Renovação ANVISA - Be4Hope',
                html
              );

              const pUser = await db.query.users.findFirst({ where: eq(users.email, l.pacienteEmail) });
              if (pUser) {
                await db.insert(notificacoes).values({
                  userId: pUser.id,
                  titulo: lTyped.diasRestantes < 0 ? 'Autorização ANVISA Expirada' : 'Aviso de Renovação ANVISA',
                  mensagem: lTyped.diasRestantes < 0 
                    ? 'Sua autorização ANVISA expirou. Renove imediatamente.'
                    : `Sua autorização ANVISA vence em ${lTyped.diasRestantes} dias.`,
                  tipo: 'renovacao_documento',
                  linkAcao: '/paciente/anvisa',
                });
              }

              await db.insert(alertasEnviados).values({
                tipo: l.tipo,
                referenciaId: l.referenciaId,
                marcoDias: l.marcoDisparado,
                destinatario: 'paciente',
              }).onConflictDoNothing();
            }
          }
        }
      });
    }

    return { success: true, alertasNovos: alertasNovos.length };
  }
);

/**
 * Job: Enviar lembretes de recompra em datas programadas.
 *
 * Disparado por evento `be4hope/recompra.criada` ao criar uma recompra manual.
 * Envia notificação no sistema + e-mail ao solicitante em 3 marcos:
 *   - 60 dias antes da data prevista de término
 *   - 30 dias antes
 *   - 15 dias antes
 *
 * Usa step.sleepUntil para dormir até cada data sem consumir recursos.
 */
export const enviarEmailRecompraAgendado = inngest.createFunction(
  {
    id: 'enviar-email-recompra-agendado',
    name: 'Lembretes de Recompra (60/30/15 dias)',
    triggers: [{ event: 'be4hope/recompra.criada' }],
  },
  async ({ event, step }) => {
    const {
      dataPrevista,   // string ISO: '2026-08-15'
      pacienteEmail,
      pacienteNome,
      nomeMedicamento,
      solicitanteUserId, // userId interno para notificação in-app
    } = event.data as {
      dataPrevista: string;
      pacienteEmail: string;
      pacienteNome: string;
      nomeMedicamento: string;
      solicitanteUserId: string;
    };

    const dataTermino = new Date(dataPrevista);

    // Calcular as 3 datas de lembrete
    const marcos = [
      { diasAntes: 60, label: '60 dias' },
      { diasAntes: 30, label: '30 dias' },
      { diasAntes: 15, label: '15 dias' },
    ];

    for (const marco of marcos) {
      const dataLembrete = new Date(dataTermino);
      dataLembrete.setDate(dataTermino.getDate() - marco.diasAntes);

      // Só agenda se a data de lembrete ainda estiver no futuro
      const agora = new Date();
      if (dataLembrete <= agora) {
        console.log(
          `[Job] Lembrete de ${marco.label} para ${pacienteEmail} já passou — pulando.`,
        );
        continue;
      }

      // Dormir até a data do lembrete
      await step.sleepUntil(
        `aguardar-lembrete-${marco.diasAntes}d`,
        dataLembrete.toISOString(),
      );

      // Notificação in-app + e-mail em paralelo
      await step.run(`lembrete-${marco.diasAntes}d`, async () => {
        const dataFormatada = dataTermino.toLocaleDateString('pt-BR');

        // ── Notificação no sistema ────────────────────────────
        await db.insert(notificacoes).values({
          userId: solicitanteUserId,
          tipo: 'recompra_medicamento',
          titulo: `Recompra em ${marco.label} — ${nomeMedicamento}`,
          mensagem: `Seu medicamento "${nomeMedicamento}" está previsto para acabar em ${dataFormatada}. Faltam ${marco.diasAntes} dias. Providencie a recompra.`,
          lida: false,
          linkAcao: '/paciente/recompra',
        });

        // ── E-mail via Brevo ──────────────────────────────────
        try {
          const { enviarEmailRecompraPaciente } = await import(
            '@/lib/email/notificacoes'
          );

          await enviarEmailRecompraPaciente({
            emailPaciente: pacienteEmail,
            nomePaciente: pacienteNome,
            nomeMedicamento,
            dataPrevista,
          });

          console.log(
            `[Job] Lembrete de ${marco.label} enviado para ${pacienteEmail} — ${nomeMedicamento}`,
          );
        } catch (error) {
          console.error(
            `[Job] Erro ao enviar e-mail de ${marco.label} para ${pacienteEmail}:`,
            error,
          );
        }
      });
    }

    return {
      enviado: true,
      marcos: marcos.map((m) => m.diasAntes),
      timestamp: new Date().toISOString(),
    };
  },
);

/**
 * Job: Liberar reservas de agendamento expiradas.
 *
 * ⚠️ NÃO RODA EM PRODUÇÃO (Item 40): quem libera as reservas é o worker das filas, por
 * `GET /api/agendamento/expirar` (ADR-0027). Mantido registrado, mas delegando à MESMA função,
 * para que religar o Inngest não traga de volta uma cópia sem a trava da Fase 4 (PIX ainda
 * pagável, pagamento em processamento). O retorno do step leva só os contadores — nada de
 * nome ou e-mail do paciente na nuvem do Inngest.
 */
export const liberarReservasExpiradas = inngest.createFunction(
  {
    id: 'liberar-reservas-expiradas',
    name: 'Liberar Reservas de Agendamento Expiradas',
    triggers: [{ cron: '*/5 * * * *' }],
  },
  async ({ step }) => {
    const resultado = await step.run('liberar-reservas-expiradas', () =>
      liberarReservasVencidas(),
    );

    return {
      reservasLiberadas: resultado.liberadas,
      reservasProtegidas: resultado.protegidas,
      timestamp: new Date().toISOString(),
    };
  },
);
