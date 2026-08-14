import { db } from '@/lib/db';
import { teleconsultas, medicos, users } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';

/**
 * Resolve medicoId interno a partir do clerkId.
 */
export async function resolverMedicoIdInterno(clerkId: string): Promise<{ medicoId: string; userIdInterno: string } | null> {
  const [row] = await db
    .select({ medicoId: medicos.id, userIdInterno: medicos.userId })
    .from(medicos)
    .innerJoin(users, eq(medicos.userId, users.id))
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  return row ?? null;
}

/**
 * Resolve paciente e consultaId a partir da sala — server-side, nunca do client.
 */
export async function resolverContextoSala(salaId: string): Promise<{
  pacienteId: string;
  consultaId: string | null;
  medicoIdDaSala: string;
} | null> {
  const [sala] = await db
    .select({
      pacienteId: teleconsultas.pacienteId,
      consultaId: teleconsultas.consultaId,
      medicoId: teleconsultas.medicoId,
    })
    .from(teleconsultas)
    .where(and(eq(teleconsultas.id, salaId), isNull(teleconsultas.deletedAt)))
    .limit(1);
  if (!sala) return null;
  return {
    pacienteId: sala.pacienteId,
    consultaId: sala.consultaId ?? null,
    medicoIdDaSala: sala.medicoId,
  };
}
