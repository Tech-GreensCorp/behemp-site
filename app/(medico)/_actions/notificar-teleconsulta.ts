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
