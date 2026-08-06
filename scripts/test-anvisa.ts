
import { db } from '../lib/db';
import { users, pacientes, prescricoes } from '../db/schema';
import { eq, and, isNull, inArray, desc } from 'drizzle-orm';

async function test() {
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, 'joaogabrieldiniz23@gmail.com')).limit(1);
  console.log('[ANVISA DEBUG] user:', user?.id ?? 'NOT FOUND');

  const [paciente] = await db.select({ id: pacientes.id }).from(pacientes).where(and(eq(pacientes.userId, user.id), isNull(pacientes.deletedAt))).limit(1);
  console.log('[ANVISA DEBUG] paciente:', paciente?.id ?? 'NOT FOUND');

  const [prescricao] = await db
      .select({ id: prescricoes.id, medicoId: prescricoes.medicoId, status: prescricoes.status })
      .from(prescricoes)
      .where(
        and(
          eq(prescricoes.pacienteId, paciente.id),
          inArray(prescricoes.status, ['emitida', 'assinada']),
          isNull(prescricoes.deletedAt),
        ),
      )
      .orderBy(desc(prescricoes.createdAt))
      .limit(1);
  console.log('[ANVISA DEBUG] prescricao:', prescricao?.id ?? 'NOT FOUND', 'status:', prescricao?.status);
}

test().catch(console.error).finally(() => process.exit(0));
