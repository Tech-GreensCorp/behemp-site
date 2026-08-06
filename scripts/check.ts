import { db } from '../lib/db';
import { users, pacientes, prescricoes } from '../db/schema';
import { eq } from 'drizzle-orm';

async function run() {
  const allUsers = await db.select().from(users).where(eq(users.email, 'joaogabrieldiniz23@gmail.com'));
  console.log('--- USUÁRIOS COM ESTE EMAIL ---');
  for (const u of allUsers) {
    console.log(`\nUser ID: ${u.id} | ClerkId: ${u.clerkId}`);
    
    const pac = await db.select().from(pacientes).where(eq(pacientes.userId, u.id));
    if (pac.length === 0) {
      console.log('  ❌ Nenhum paciente vinculado a este User ID.');
      continue;
    }

    for (const p of pac) {
      console.log(`  ✅ Paciente ID: ${p.id}`);
      const presc = await db.select().from(prescricoes).where(eq(prescricoes.pacienteId, p.id));
      if (presc.length === 0) {
         console.log('    ❌ Nenhuma prescrição para este paciente.');
      }
      for (const pr of presc) {
        console.log(`    ✅ Prescrição ID: ${pr.id} | Status: ${pr.status}`);
      }
    }
  }
}

run().catch(console.error).finally(() => process.exit(0));
