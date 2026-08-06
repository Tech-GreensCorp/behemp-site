'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import { teleconsultas, transcricoes, logsAuditoria } from '@/db/schema';
import { verificarMedico } from '@/lib/auth/permissions';
import { redirect } from 'next/navigation';
import { eq, and, isNull } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { revalidatePath } from 'next/cache';

// Criar sala de teleconsulta
export async function criarSalaTeleconsulta(consultaId?: string) {
  const perm = await verificarMedico();
  if (!perm.autorizado || !perm.clerkId) redirect('/entrar');

  // Buscar medicoId
  const { users, medicos } = await import('@/db/schema');
  const [medico] = await db
    .select({ id: medicos.id })
    .from(medicos)
    .innerJoin(users, eq(medicos.userId, users.id))
    .where(eq(users.clerkId, perm.clerkId))
    .limit(1);
  if (!medico) return { sucesso: false, erro: 'Médico não encontrado' };

  // Gerar roomId único (6 chars)
  const roomId = Math.random().toString(36).slice(2, 8).toUpperCase();

  // Buscar pacienteId da consulta (se houver)
  let pacienteId: string | null = null;
  if (consultaId) {
    const { consultas, pacientes } = await import('@/db/schema');
    const [consulta] = await db
      .select({ pacienteId: consultas.pacienteId })
      .from(consultas)
      .where(and(eq(consultas.id, consultaId), eq(consultas.medicoId, medico.id), isNull(consultas.deletedAt)))
      .limit(1);
    if (consulta) pacienteId = consulta.pacienteId;
  }

  if (!pacienteId) return { sucesso: false, erro: 'Consulta ou paciente não encontrado' };

  const [sala] = await db.insert(teleconsultas).values({
    consultaId: consultaId ?? null,
    medicoId: medico.id,
    pacienteId,
    roomId,
    status: 'aguardando',
    iniciadaEm: new Date(),
  }).returning();

  revalidatePath('/medico/agenda');
  return { sucesso: true, dados: { roomId: sala.roomId, salaId: sala.id } };
}

// Registrar consentimento LGPD
export async function registrarConsentimentoLgpd(salaId: string, aceite: boolean) {
  const perm = await verificarMedico();
  if (!perm.autorizado) redirect('/entrar');

  await db.update(teleconsultas)
    .set({ consentimentoLgpd: aceite, consentimentoEm: new Date() })
    .where(eq(teleconsultas.id, salaId));

  await db.insert(logsAuditoria).values({
    acao: aceite ? 'LGPD_ACEITE' : 'LGPD_RECUSA',
    entidade: 'teleconsultas',
    entidadeId: salaId,
  }).catch(() => {});

  return { sucesso: true };
}

// Encerrar teleconsulta e salvar duração
export async function encerrarTeleconsulta(salaId: string, duracaoSegundos: number) {
  const perm = await verificarMedico();
  if (!perm.autorizado) redirect('/entrar');

  await db.update(teleconsultas)
    .set({
      status: 'encerrada',
      encerradaEm: new Date(),
      duracaoSegundos,
    })
    .where(eq(teleconsultas.id, salaId));

  revalidatePath('/medico/consultas');
  return { sucesso: true };
}
