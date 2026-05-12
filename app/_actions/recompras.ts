'use server';

import { db } from '@/lib/db';
import { recompras, users, pacientes, notificacoes, emailsNotificacao } from '@/db/schema';
import { eq, desc, and, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { obterUsuarioAtual } from '@/lib/auth';
import { inngest } from '@/lib/integrations/inngest';

/**
 * Server Actions para recompra de medicamento.
 *
 * Fórmula:
 *   gotas_totais = ml_frasco × gotas_por_ml (padrão 20)
 *   dias_duracao = gotas_totais / gotas_por_dia
 *   data_termino = data_inicio + dias_duracao
 */

// ── Schemas ───────────────────────────────────────────────────

const solicitarRecompraSchema = z.object({
  medicamentoNome: z.string().min(1, 'Nome do medicamento é obrigatório'),
  mlFrasco: z.number().min(1, 'ML do frasco é obrigatório'),
  gotasPorDia: z.number().min(1, 'Gotas por dia é obrigatório'),
  dataInicioUso: z.string().min(1, 'Data de início é obrigatória'),
  contatoTelefone: z.string().optional(),
  contatoEmail: z.string().email('E-mail inválido').optional().or(z.literal('')),
  observacoes: z.string().optional(),
  /** Quando médico cria para um paciente */
  pacienteId: z.string().optional(),
});

// ── Types ─────────────────────────────────────────────────────

interface ActionResult<T = unknown> {
  sucesso: boolean;
  dados?: T;
  erro?: string;
}

// ── Helpers ───────────────────────────────────────────────────

const GOTAS_POR_ML = 20;

function calcularDataTermino(
  dataInicio: string,
  mlFrasco: number,
  gotasPorDia: number,
): { dataTermino: Date; diasDuracao: number } {
  const gotasTotais = mlFrasco * GOTAS_POR_ML;
  const diasDuracao = Math.floor(gotasTotais / gotasPorDia);
  const inicio = new Date(dataInicio);
  const dataTermino = new Date(inicio);
  dataTermino.setDate(dataTermino.getDate() + diasDuracao);
  return { dataTermino, diasDuracao };
}

// ── Actions ───────────────────────────────────────────────────

/**
 * Solicitar recompra manual — cria pedido avulso sem vínculo com dosagem.
 * Envia notificações in-app + e-mails para toda a equipe.
 */
export async function solicitarRecompraManual(
  dados: z.infer<typeof solicitarRecompraSchema>,
): Promise<ActionResult<{
  recompraId: string;
  dataTermino: string;
  diasDuracao: number;
}>> {
  try {
    const auth = await obterUsuarioAtual();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const parsed = solicitarRecompraSchema.safeParse(dados);
    if (!parsed.success) return { sucesso: false, erro: parsed.error.errors[0].message };

    // Buscar userId interno
    const [solicitante] = await db
      .select({ id: users.id, nome: users.nome, email: users.email, role: users.role })
      .from(users)
      .where(eq(users.clerkId, auth.clerkId!))
      .limit(1);

    if (!solicitante) return { sucesso: false, erro: 'Usuário não encontrado' };

    // Calcular data de término
    const { dataTermino, diasDuracao } = calcularDataTermino(
      parsed.data.dataInicioUso,
      parsed.data.mlFrasco,
      parsed.data.gotasPorDia,
    );

    const dataTerminoStr = dataTermino.toISOString().split('T')[0];

    // Determinar pacienteId
    let pacienteIdFinal: string | null = null;

    if (parsed.data.pacienteId) {
      // Médico criando para paciente
      pacienteIdFinal = parsed.data.pacienteId;
    } else if (solicitante.role === 'paciente') {
      // Paciente criando para si mesmo
      const [pacienteReg] = await db
        .select({ id: pacientes.id })
        .from(pacientes)
        .where(eq(pacientes.userId, solicitante.id))
        .limit(1);
      pacienteIdFinal = pacienteReg?.id ?? null;
    }

    // Inserir recompra
    const [novaRecompra] = await db
      .insert(recompras)
      .values({
        solicitanteId: solicitante.id,
        pacienteId: pacienteIdFinal,
        medicamentoNome: parsed.data.medicamentoNome,
        mlFrasco: parsed.data.mlFrasco,
        gotasPorDia: parsed.data.gotasPorDia,
        dataInicioUso: parsed.data.dataInicioUso,
        dataPrevista: dataTerminoStr,
        contatoTelefone: parsed.data.contatoTelefone || null,
        contatoEmail: parsed.data.contatoEmail || null,
        observacoes: parsed.data.observacoes || null,
        status: 'pedida',
        emailEnviadoEm: new Date(),
      })
      .returning({ id: recompras.id });

    // ── Disparar evento Inngest para lembretes futuros (60/30/15 dias) ──
    try {
      await inngest.send({
        name: 'be4hope/recompra.criada',
        data: {
          dataPrevista: dataTerminoStr,
          pacienteEmail: solicitante.email,
          pacienteNome: solicitante.nome,
          nomeMedicamento: parsed.data.medicamentoNome,
          solicitanteUserId: solicitante.id,
        },
      });
    } catch (inngestError) {
      // Não bloqueia o pedido se o Inngest falhar
      console.warn('[Recompra] Inngest não disponível — lembretes futuros não agendados:', inngestError);
    }

    // ── Notificações in-app para admins e médicos ──────────────
    const destinatarios = await db
      .select({ id: users.id })
      .from(users)
      .where(or(eq(users.role, 'admin'), eq(users.role, 'medico')));

    if (destinatarios.length > 0) {
      const notificacoesData = destinatarios.map((d) => ({
        userId: d.id,
        tipo: 'recompra_medicamento' as const,
        titulo: 'Nova solicitação de recompra',
        mensagem: `${solicitante.nome} solicitou recompra de ${parsed.data.medicamentoNome}. Previsão de término: ${new Date(dataTerminoStr).toLocaleDateString('pt-BR')}.`,
        lida: false,
        linkAcao: '/admin/recompras',
      }));

      await db.insert(notificacoes).values(notificacoesData);
    }

    // ── E-mails para equipe ────────────────────────────────────
    try {
      // Buscar nome do paciente se for pedido de médico
      let nomePaciente = solicitante.nome;
      let emailPaciente = solicitante.email;

      if (pacienteIdFinal && parsed.data.pacienteId) {
        const [pacInfo] = await db
          .select({ nome: users.nome, email: users.email })
          .from(pacientes)
          .innerJoin(users, eq(pacientes.userId, users.id))
          .where(eq(pacientes.id, pacienteIdFinal))
          .limit(1);
        if (pacInfo) {
          nomePaciente = pacInfo.nome;
          emailPaciente = pacInfo.email;
        }
      }

      // Buscar emails de admins, médicos e financeiro
      const [adminsEmails, medicosEmails, financeiroEmails] = await Promise.all([
        db.select({ email: users.email, nome: users.nome }).from(users).where(eq(users.role, 'admin')),
        db.select({ email: users.email, nome: users.nome }).from(users).where(eq(users.role, 'medico')),
        db.select({ email: emailsNotificacao.email, nome: emailsNotificacao.nome })
          .from(emailsNotificacao)
          .where(and(eq(emailsNotificacao.ativo, true), eq(emailsNotificacao.categoria, 'financeiro'))),
      ]);

      const todosDestinatarios = [...adminsEmails, ...medicosEmails, ...financeiroEmails];

      if (todosDestinatarios.length > 0) {
        const { enviarEmailRecompraCompletoEquipe } = await import('@/lib/email/notificacoes');
        await enviarEmailRecompraCompletoEquipe({
          destinatarios: todosDestinatarios.map((d) => ({ email: d.email, nome: d.nome })),
          solicitanteNome: solicitante.nome,
          solicitanteRole: solicitante.role ?? 'paciente',
          pacienteNome: nomePaciente,
          pacienteEmail: emailPaciente,
          pacienteTelefone: parsed.data.contatoTelefone ?? null,
          medicamentoNome: parsed.data.medicamentoNome,
          mlFrasco: parsed.data.mlFrasco,
          gotasPorDia: parsed.data.gotasPorDia,
          dataInicioUso: parsed.data.dataInicioUso,
          dataTermino: dataTerminoStr,
        });
      }
    } catch (emailError) {
      console.error('[Recompra] Erro ao enviar e-mails (pedido salvo):', emailError);
    }

    return {
      sucesso: true,
      dados: {
        recompraId: novaRecompra.id,
        dataTermino: dataTerminoStr,
        diasDuracao,
      },
    };
  } catch (error) {
    console.error('[Action] Erro ao solicitar recompra manual:', error);
    return { sucesso: false, erro: 'Erro ao solicitar recompra' };
  }
}

/**
 * Lista histórico de recompras do usuário autenticado.
 */
export async function listarMinhasRecompras(): Promise<ActionResult<Array<{
  id: string;
  medicamentoNome: string | null;
  mlFrasco: number | null;
  gotasPorDia: number | null;
  dataInicioUso: string | null;
  dataPrevista: string;
  status: string;
  contatoTelefone: string | null;
  contatoEmail: string | null;
  criadoEm: string;
  solicitanteNome: string;
}>>> {
  try {
    const auth = await obterUsuarioAtual();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const [usuario] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.clerkId, auth.clerkId!))
      .limit(1);

    if (!usuario) return { sucesso: false, erro: 'Usuário não encontrado' };

    // Buscar recompras onde o usuário é solicitante ou é o paciente alvo
    const resultado = await db.execute(sql`
      SELECT
        r.id,
        r.medicamento_nome as "medicamentoNome",
        r.ml_frasco as "mlFrasco",
        r.gotas_por_dia as "gotasPorDia",
        r.data_inicio_uso as "dataInicioUso",
        r.data_prevista as "dataPrevista",
        r.status,
        r.contato_telefone as "contatoTelefone",
        r.contato_email as "contatoEmail",
        TO_CHAR(r.created_at, 'YYYY-MM-DD"T"HH24:MI:SS') as "criadoEm",
        u.nome as "solicitanteNome"
      FROM recompras r
      INNER JOIN users u ON u.id = r.solicitante_id
      WHERE r.solicitante_id = ${usuario.id}
         OR r.paciente_id IN (
           SELECT p.id FROM pacientes p WHERE p.user_id = ${usuario.id}
         )
      ORDER BY r.created_at DESC
    `);

    return {
      sucesso: true,
      dados: resultado.rows as Array<{
        id: string;
        medicamentoNome: string | null;
        mlFrasco: number | null;
        gotasPorDia: number | null;
        dataInicioUso: string | null;
        dataPrevista: string;
        status: string;
        contatoTelefone: string | null;
        contatoEmail: string | null;
        criadoEm: string;
        solicitanteNome: string;
      }>,
    };
  } catch (error) {
    console.error('[Action] Erro ao listar recompras:', error);
    return { sucesso: false, erro: 'Erro ao listar recompras' };
  }
}

/**
 * Lista todas as recompras (para admin).
 */
export async function listarTodasRecompras(): Promise<ActionResult<Array<{
  id: string;
  medicamentoNome: string | null;
  mlFrasco: number | null;
  gotasPorDia: number | null;
  dataPrevista: string;
  status: string;
  contatoTelefone: string | null;
  contatoEmail: string | null;
  criadoEm: string;
  solicitanteNome: string;
  solicitanteRole: string | null;
  pacienteNome: string | null;
}>>> {
  try {
    const auth = await obterUsuarioAtual();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const resultado = await db.execute(sql`
      SELECT
        r.id,
        r.medicamento_nome as "medicamentoNome",
        r.ml_frasco as "mlFrasco",
        r.gotas_por_dia as "gotasPorDia",
        r.data_prevista as "dataPrevista",
        r.status,
        r.contato_telefone as "contatoTelefone",
        r.contato_email as "contatoEmail",
        TO_CHAR(r.created_at, 'YYYY-MM-DD"T"HH24:MI:SS') as "criadoEm",
        sol.nome as "solicitanteNome",
        sol.role as "solicitanteRole",
        pac_user.nome as "pacienteNome"
      FROM recompras r
      INNER JOIN users sol ON sol.id = r.solicitante_id
      LEFT JOIN pacientes p ON p.id = r.paciente_id
      LEFT JOIN users pac_user ON pac_user.id = p.user_id
      ORDER BY r.created_at DESC
    `);

    return { sucesso: true, dados: resultado.rows as never[] };
  } catch (error) {
    console.error('[Action] Erro ao listar todas recompras:', error);
    return { sucesso: false, erro: 'Erro ao listar recompras' };
  }
}

/**
 * Atualizar status de uma recompra (admin).
 */
export async function atualizarStatusRecompra(
  recompraId: string,
  novoStatus: 'agendada' | 'pedida' | 'entregue',
): Promise<ActionResult> {
  try {
    const auth = await obterUsuarioAtual();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    await db
      .update(recompras)
      .set({ status: novoStatus })
      .where(eq(recompras.id, recompraId));

    return { sucesso: true };
  } catch (error) {
    console.error('[Action] Erro ao atualizar status da recompra:', error);
    return { sucesso: false, erro: 'Erro ao atualizar status' };
  }
}

/**
 * Lista pacientes para o médico selecionar ao criar recompra.
 */
export async function listarPacientesParaRecompra(): Promise<ActionResult<Array<{
  pacienteId: string;
  nome: string;
  email: string;
}>>> {
  try {
    const auth = await obterUsuarioAtual();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const resultado = await db
      .select({
        pacienteId: pacientes.id,
        nome: users.nome,
        email: users.email,
      })
      .from(pacientes)
      .innerJoin(users, eq(pacientes.userId, users.id))
      .where(eq(pacientes.deletedAt, sql`NULL`).if(false)) // soft-deleted não aparecem
      .orderBy(users.nome);

    return { sucesso: true, dados: resultado };
  } catch (error) {
    console.error('[Action] Erro ao listar pacientes para recompra:', error);
    return { sucesso: false, erro: 'Erro ao listar pacientes' };
  }
}
