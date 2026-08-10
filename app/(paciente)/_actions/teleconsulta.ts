'use server';

import { db } from '@/lib/db';
import { teleconsultas, pacientes, users, medicos, logsAuditoria } from '@/db/schema';
import { verificarPaciente } from '@/lib/auth/permissions';
import { redirect } from 'next/navigation';
import { eq, and, isNull } from 'drizzle-orm';

/**
 * Busca sala de teleconsulta pelo roomId.
 * Valida que a sala pertence ao paciente logado.
 * Aceita apenas salas 'aguardando' ou 'em_andamento'.
 */
export async function buscarSalaPorRoomId(roomId: string) {
  const perm = await verificarPaciente();
  if (!perm.autorizado || !perm.clerkId) redirect('/entrar');

  // Buscar paciente do usuário logado
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, perm.clerkId))
    .limit(1);
  if (!user) return { sucesso: false, erro: 'Usuário não encontrado' };

  const [paciente] = await db
    .select({ id: pacientes.id })
    .from(pacientes)
    .where(and(eq(pacientes.userId, user.id), isNull(pacientes.deletedAt)))
    .limit(1);
  if (!paciente) return { sucesso: false, erro: 'Paciente não encontrado' };

  // Buscar sala pelo roomId — validar que pertence ao paciente
  const [sala] = await db
    .select({
      id: teleconsultas.id,
      roomId: teleconsultas.roomId,
      status: teleconsultas.status,
      medicoId: teleconsultas.medicoId,
      pacienteId: teleconsultas.pacienteId,
      iniciadaEm: teleconsultas.iniciadaEm,
    })
    .from(teleconsultas)
    .where(
      and(
        eq(teleconsultas.roomId, roomId),
        eq(teleconsultas.pacienteId, paciente.id),
        isNull(teleconsultas.deletedAt),
      ),
    )
    .limit(1);

  if (!sala) {
    return { sucesso: false, erro: 'Sala não encontrada ou acesso negado' };
  }

  // Rejeitar salas encerradas ou canceladas
  if (sala.status === 'encerrada' || sala.status === 'cancelada') {
    return { sucesso: false, erro: 'Esta consulta já foi encerrada' };
  }

  // Buscar nome do médico
  const [medicoUser] = await db
    .select({ nome: users.nome, especialidade: medicos.especialidade })
    .from(medicos)
    .innerJoin(users, eq(medicos.userId, users.id))
    .where(eq(medicos.id, sala.medicoId))
    .limit(1);

  return {
    sucesso: true,
    dados: {
      salaId: sala.id,
      roomId: sala.roomId,
      status: sala.status,
      medicoNome: medicoUser?.nome ?? 'Médico',
      medicoEspecialidade: medicoUser?.especialidade ?? '',
    },
  };
}

/**
 * Registra entrada do paciente na sala.
 * Atualiza status para 'em_andamento' se estava 'aguardando'.
 */
export async function pacienteEntrarSala(salaId: string) {
  const perm = await verificarPaciente();
  if (!perm.autorizado) redirect('/entrar');

  await db.update(teleconsultas)
    .set({ status: 'em_andamento' })
    .where(
      and(
        eq(teleconsultas.id, salaId),
        eq(teleconsultas.status, 'aguardando'),
      ),
    );

  await db.insert(logsAuditoria).values({
    acao: 'PACIENTE_ENTROU',
    entidade: 'teleconsultas',
    entidadeId: salaId,
  }).catch(() => {});

  return { sucesso: true };
}
