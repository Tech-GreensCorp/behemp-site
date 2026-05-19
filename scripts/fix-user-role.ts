import { db } from '../lib/db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { clerkClient } from '@clerk/nextjs/server';

const clerkId = process.argv[2];
const novoRole = process.argv[3] as 'admin' | 'medico' | 'paciente';

if (!clerkId || !novoRole) {
  console.error('Uso: npx tsx --env-file=.env scripts/fix-user-role.mts <clerkId> <novoRole>');
  process.exit(1);
}

if (!['admin', 'medico', 'paciente'].includes(novoRole)) {
  console.error('Role inválido. Use: admin, medico ou paciente');
  process.exit(1);
}

console.log(`\n🔧 Corrigindo role do usuário ${clerkId} → ${novoRole}\n`);

async function main() {
  // 1. Buscar usuário no banco
  const [usuario] = await db
    .select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  if (!usuario) {
    console.error(`❌ Usuário não encontrado no banco para clerkId: ${clerkId}`);
    console.log('\nBuscando por todos os usuários recentes...');
    const todos = await db
      .select({ id: users.id, clerkId: users.clerkId, email: users.email, role: users.role })
      .from(users)
      .limit(20);
    console.log(JSON.stringify(todos, null, 2));
    process.exit(1);
  }

  console.log(`📋 Usuário encontrado: ${usuario.email} (role atual: ${usuario.role})`);

  // 2. Atualizar role no banco
  await db.update(users).set({ role: novoRole }).where(eq(users.clerkId, clerkId));
  console.log(`✅ Banco atualizado: role = ${novoRole}`);

  // 3. Atualizar publicMetadata no Clerk
  try {
    const client = await clerkClient();
    await client.users.updateUserMetadata(clerkId, {
      publicMetadata: { role: novoRole },
    });
    console.log(`✅ Clerk atualizado: publicMetadata.role = ${novoRole}`);
  } catch (err) {
    console.error('❌ Falha ao atualizar Clerk:', err);
    console.warn('⚠️  Banco foi atualizado. Defina o publicMetadata manualmente no Clerk Dashboard.');
  }

  console.log('\n✅ Concluído! Faça logout e login novamente para o role ser aplicado.\n');
}

main().catch(console.error);
