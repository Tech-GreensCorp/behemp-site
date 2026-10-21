'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import { teleconsultas, transcricoes, logsAuditoria } from '@/db/schema';
import { verificarMedico } from '@/lib/auth/permissions';
import { garantirDonoDaSala } from '@/lib/auth/escopo-sala';
import { registrarAuditoria } from '@/lib/utils/audit';
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
// 🔴 CORRIGIDO EM 20/08/2026 — Item 11 de docs/04-LISTA-DE-AFAZERES.md. `verificarMedico`
// autoriza o PAPEL; o `where` aceitava qualquer `salaId`, então um médico alterava o
// consentimento LGPD de sala alheia. Agora o escopo do objeto é verificado.
export async function registrarConsentimentoLgpd(salaId: string, aceite: boolean) {
  const escopo = await garantirDonoDaSala({ salaId });
  if (!escopo.ok) return { sucesso: false, erro: escopo.erro };
  if (escopo.sala.papel !== 'medico') {
    return { sucesso: false, erro: 'Apenas o médico da consulta registra o consentimento' };
  }

  await db.update(teleconsultas)
    .set({ consentimentoLgpd: aceite, consentimentoEm: new Date() })
    .where(eq(teleconsultas.id, escopo.sala.salaId));

  // Auditoria com QUEM e de onde, pelo helper que o resto do repositório já usa. Antes era
  // insert direto sem `userId`, e com `.catch(() => {})` — registro que podia nunca nascer.
  await registrarAuditoria({
    userId: escopo.sala.userId,
    acao: 'atualizar',
    entidade: 'teleconsultas',
    entidadeId: escopo.sala.salaId,
    dadosDepois: { consentimentoLgpd: aceite },
  });

  return { sucesso: true };
}

// Encerrar teleconsulta e salvar duração
// 🔴 CORRIGIDO EM 20/08/2026 — Item 11. Sem escopo de objeto, qualquer médico encerrava a
// consulta de outro e marcava a consulta vinculada como `realizada`.
export async function encerrarTeleconsulta(salaId: string, duracaoSegundos: number) {
  const escopo = await garantirDonoDaSala({ salaId });
  if (!escopo.ok) return { sucesso: false, erro: escopo.erro };
  if (escopo.sala.papel !== 'medico') {
    return { sucesso: false, erro: 'Apenas o médico da consulta pode encerrar' };
  }

  // 1. Atualizar teleconsulta → encerrada
  await db.update(teleconsultas)
    .set({
      status: 'encerrada',
      encerradaEm: new Date(),
      duracaoSegundos,
    })
    .where(eq(teleconsultas.id, escopo.sala.salaId));

  // 2. CORREÇÃO SPRINT 4: atualizar consulta vinculada → realizada
  // Buscar consultaId da teleconsulta
  const [sala] = await db
    .select({ consultaId: teleconsultas.consultaId, pacienteId: teleconsultas.pacienteId })
    .from(teleconsultas)
    .where(eq(teleconsultas.id, salaId))
    .limit(1);

  if (sala?.consultaId) {
    const { consultas } = await import('@/db/schema');
    await db.update(consultas)
      .set({ status: 'realizada' })
      .where(eq(consultas.id, sala.consultaId));
  }

  // 3. Notificar paciente que a consulta foi encerrada
  if (sala?.pacienteId) {
    try {
      const { users, pacientes } = await import('@/db/schema');
      const [paciente] = await db
        .select({ userId: pacientes.userId })
        .from(pacientes)
        .where(eq(pacientes.id, sala.pacienteId))
        .limit(1);

      if (paciente) {
        const { notificacoes } = await import('@/db/schema');
        await db.insert(notificacoes).values({
          userId: paciente.userId,
          tipo: 'geral',
          titulo: '✅ Consulta realizada',
          mensagem: 'Sua teleconsulta foi concluída. Acesse o portal para ver sua prescrição em breve.',
          lida: false,
          linkAcao: '/paciente',
        }).catch(() => {});
      }
    } catch (err) {
      console.error('[Teleconsulta] Erro ao notificar paciente pós-consulta:', err);
    }
  }

  // 4. Log de auditoria — com autor e IP
  await registrarAuditoria({
    userId: escopo.sala.userId,
    acao: 'atualizar',
    entidade: 'teleconsultas',
    entidadeId: escopo.sala.salaId,
    dadosDepois: { status: 'encerrada', duracaoSegundos },
  });

  revalidatePath('/medico/agenda');
  revalidatePath('/medico/consultas');
  return { sucesso: true };
}

