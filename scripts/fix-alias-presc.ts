import { db } from '../lib/db';
import { pacientes, prescricoes } from '../db/schema';
import { eq } from 'drizzle-orm';

async function fix() {
  const pacienteAliasId = 'pk6vm7yrk5ya6k72v23buxs3';
  const medicoSidartaId = 'tkls6kagqbxgq3oucgbwwbzt';
  const prescricaoId = 'ydzyr03ru71sv8fecudysw3n';

  // Atualizar o paciente para ter o Dr. Sidarta
  await db.update(pacientes)
    .set({ medicoId: medicoSidartaId })
    .where(eq(pacientes.id, pacienteAliasId));
  console.log('✅ Paciente alias atualizado com medicoId do Dr. Sidarta');

  // Atualizar a prescrição mockada para pertencer a este paciente
  await db.update(prescricoes)
    .set({ pacienteId: pacienteAliasId })
    .where(eq(prescricoes.id, prescricaoId));
  console.log('✅ Prescrição transferida para o paciente alias (+100)');
}

fix().catch(console.error).finally(() => process.exit(0));
