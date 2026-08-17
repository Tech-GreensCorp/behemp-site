'use server';

import { db } from '@/lib/db';
import {
  notificacoes, pacientes, users, medicos, teleconsultas,
} from '@/db/schema';
import { verificarMedico } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { eq, and } from 'drizzle-orm';
import { getPusherServer } from '@/lib/integrations/pusher/server';
import { env } from '@/lib/env';

/**
 * Notifica o paciente que a teleconsulta começou.
 * Dispara simultaneamente:
 * 1. Notificação in-app (banco de dados)
 * 2. Push em tempo real via Pusher
 * 3. Email via Brevo
 */
export async function notificarPacienteTeleconsultaIniciada(
  salaId: string,
  roomId: string,
) {
  const auth = await verificarMedico();
  if (!auth.autorizado || !auth.clerkId) redirect('/entrar');

  // Buscar dados da sala com paciente e médico
  const [sala] = await db
    .select({
      pacienteId: teleconsultas.pacienteId,
      medicoId: teleconsultas.medicoId,
    })
    .from(teleconsultas)
    .where(eq(teleconsultas.id, salaId))
    .limit(1);

  if (!sala) return { sucesso: false, erro: 'Sala não encontrada' };

  // Buscar dados do paciente
  const [paciente] = await db
    .select({
      userId: pacientes.userId,
      email: users.email,
      nome: users.nome,
      telefone: users.telefone,
    })
    .from(pacientes)
    .innerJoin(users, eq(pacientes.userId, users.id))
    .where(eq(pacientes.id, sala.pacienteId))
    .limit(1);

  if (!paciente) return { sucesso: false, erro: 'Paciente não encontrado' };

  // Buscar nome do médico
  const [medicoData] = await db
    .select({ nome: users.nome })
    .from(medicos)
    .innerJoin(users, eq(medicos.userId, users.id))
    .where(eq(medicos.id, sala.medicoId))
    .limit(1);

  const medicoNome = medicoData?.nome ?? 'Seu médico';
  const appUrl = env.NEXT_PUBLIC_APP_URL ?? 'https://be4hope.org';
  const linkSala = `${appUrl}/paciente/teleconsulta/${roomId}`;

  // 1. Notificação in-app (banco)
  await db.insert(notificacoes).values({
    userId: paciente.userId,
    tipo: 'teleconsulta_iniciada',
    titulo: '🔴 Sua teleconsulta está começando!',
    mensagem: `Dr(a). ${medicoNome} iniciou a teleconsulta. Clique para entrar agora.`,
    lida: false,
    linkAcao: `/paciente/teleconsulta/${roomId}`,
  }).catch(() => {});

  // 2. Push em tempo real via Pusher
  try {
    const pusherServer = getPusherServer();
    await pusherServer.trigger(
      `private-user-${paciente.userId}`,
      'teleconsulta:iniciada',
      {
        roomId,
        salaId,
        medicoNome,
        linkSala,
        mensagem: `Dr(a). ${medicoNome} está aguardando você`,
      },
    );
  } catch (err) {
    console.error('[Teleconsulta] Erro Pusher:', err);
  }

  // 3. Email via Brevo
  try {
    const { enviarEmailTeleconsultaIniciada } = await import('@/lib/email/consultas');
    await enviarEmailTeleconsultaIniciada({
      pacienteNome: paciente.nome,
      pacienteEmail: paciente.email,
      medicoNome,
      linkSala,
    });
  } catch (err) {
    console.error('[Teleconsulta] Erro email:', err);
  }

  return { sucesso: true };
}

/**
 * Inicia teleconsulta: cria sala + notifica paciente + redireciona médico.
 * Action principal chamada pelo botão na agenda.
 */
export async function iniciarTeleconsulta(consultaId: string) {
  const auth = await verificarMedico();
  if (!auth.autorizado || !auth.clerkId) redirect('/entrar');

  // Criar sala via action existente
  const { criarSalaTeleconsulta } = await import('@/app/(medico)/_actions/teleconsulta');
  const res = await criarSalaTeleconsulta(consultaId);

  if (!res.sucesso || !res.dados) {
    return { sucesso: false, erro: res.erro ?? 'Erro ao criar sala' };
  }

  const { roomId, salaId } = res.dados;

  // Atualizar status da consulta para em_andamento
  const { consultas } = await import('@/db/schema');
  await db.update(consultas)
    .set({ status: 'confirmada' })
    .where(eq(consultas.id, consultaId))
    .catch(() => {});

  // Notificar paciente
  await notificarPacienteTeleconsultaIniciada(salaId, roomId);

  return {
    sucesso: true,
    dados: { roomId, salaId },
  };
}

/**
 * Cria uma consulta avulsa (encaixe/urgência) e inicia a teleconsulta imediatamente.
 * Consolida: criação da consulta + criação da sala + notificação do paciente.
 */
export async function iniciarConsultaAvulsa(params: {
  pacienteId: string;
  tipo?: 'urgencia' | 'encaixe';
  observacoes?: string;
}) {
  const auth = await verificarMedico();
  if (!auth.autorizado || !auth.clerkId) redirect('/entrar');

  // 1. Criar a consulta com dataHora = agora
  const { criarConsultaMedico } = await import('@/app/(medico)/_actions/consultas');
  const consultaRes = await criarConsultaMedico({
    pacienteId: params.pacienteId,
    dataHora: new Date().toISOString(),
    tipo: params.tipo ?? 'encaixe',
    observacoes: params.observacoes ?? 'Atendimento imediato (encaixe)',
  });

  if (!consultaRes.sucesso || !consultaRes.dados?.id) {
    return { sucesso: false, erro: consultaRes.erro ?? 'Falha ao obter consulta criada' };
  }

  // 2. Iniciar a teleconsulta (cria sala + notifica)
  return iniciarTeleconsulta(consultaRes.dados.id);
}

/**
 * Retorna os pacientes do médico que estão "online" na sala de espera virtual.
 * Usa o canal presence do Pusher para verificar presença.
 * Como o Pusher presence é client-side, esta action retorna os userIds dos pacientes
 * vinculados ao médico para que o frontend faça a correlação.
 */
export async function listarPacientesParaPresenca(): Promise<{
  sucesso: boolean;
  dados?: { pacienteId: string; userId: string; nome: string }[];
  erro?: string;
}> {
  const auth = await verificarMedico();
  if (!auth.autorizado || !auth.clerkId) return { sucesso: false, erro: 'Não autorizado' };

  const { db } = await import('@/lib/db');
  const { pacientes, users: usersSchema, medicos } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');

  const [user] = await db.select({ id: usersSchema.id }).from(usersSchema).where(eq(usersSchema.clerkId, auth.clerkId!));
  const [medico] = await db.select({ id: medicos.id }).from(medicos).where(eq(medicos.userId, user.id));
  if (!medico) return { sucesso: false, erro: 'Médico não encontrado' };

  const lista = await db
    .select({ pacienteId: pacientes.id, userId: pacientes.userId, nome: usersSchema.nome })
    .from(pacientes)
    .innerJoin(usersSchema, eq(pacientes.userId, usersSchema.id))
    .where(eq(pacientes.medicoId, medico.id));

  return { sucesso: true, dados: lista };
}
