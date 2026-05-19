/**
 * Script one-time: localiza e corrige o role do usuário no banco + Clerk.
 * 
 * Uso 1 - por clerkId:
 *   npx tsx --env-file=.env scripts/fix-user-role.ts clerkId <clerkId> <novoRole>
 * 
 * Uso 2 - por email:
 *   npx tsx --env-file=.env scripts/fix-user-role.ts email <email> <novoRole>
 * 
 * Uso 3 - apenas diagnóstico (sem alterar):
 *   npx tsx --env-file=.env scripts/fix-user-role.ts diagnostico <email>
 */

import { db } from '../lib/db';
import { users } from '../db/schema';
import { eq, sql } from 'drizzle-orm';
import { clerkClient } from '@clerk/nextjs/server';

const modo = process.argv[2];
const argumento = process.argv[3];
const novoRole = process.argv[4] as 'admin' | 'medico' | 'paciente' | undefined;

async function main() {
  if (!modo || !argumento) {
    console.log('Uso:\n  clerkId <id> <role>\n  email <email> <role>\n  diagnostico <email>');
    process.exit(1);
  }

  // ── DIAGNÓSTICO ────────────────────────────────────────────────
  if (modo === 'diagnostico') {
    console.log(`\n🔍 Diagnóstico para: ${argumento}\n`);
    
    // Busca por email
    const porEmail = await db
      .select({ id: users.id, clerkId: users.clerkId, email: users.email, role: users.role, createdAt: users.createdAt })
      .from(users)
      .where(eq(users.email, argumento));

    if (porEmail.length > 0) {
      console.log('📋 Encontrado por EMAIL:');
      console.log(JSON.stringify(porEmail, null, 2));
    } else {
      console.log('❌ Nenhum registro com este email');
    }

    // Busca por clerkId se parece com um clerk id
    if (argumento.startsWith('user_')) {
      const porClerkId = await db
        .select({ id: users.id, clerkId: users.clerkId, email: users.email, role: users.role })
        .from(users)
        .where(eq(users.clerkId, argumento));
      
      if (porClerkId.length > 0) {
        console.log('\n📋 Encontrado por CLERK ID:');
        console.log(JSON.stringify(porClerkId, null, 2));
      }
    }

    // Contagem total
    const countResult = await db.execute(sql`SELECT COUNT(*)::int as total FROM users`);
    const total = (countResult.rows?.[0] as any)?.total ?? countResult?.[0]?.total ?? '?';
    console.log(`\n📊 Total de usuários no banco: ${total}`);
    
    // Listar os 5 mais recentes
    const recentes = await db
      .select({ id: users.id, clerkId: users.clerkId, email: users.email, role: users.role, createdAt: users.createdAt })
      .from(users)
      .orderBy(sql`created_at DESC`)
      .limit(5);
    console.log('\n📋 Últimos 5 usuários criados:');
    console.log(JSON.stringify(recentes, null, 2));
    return;
  }

  // ── CORREÇÃO ───────────────────────────────────────────────────
  if (!novoRole || !['admin', 'medico', 'paciente'].includes(novoRole)) {
    console.error('Role inválido. Use: admin, medico ou paciente');
    process.exit(1);
  }

  let usuario: { id: string; email: string; role: string | null; clerkId: string | null } | undefined;

  if (modo === 'clerkId') {
    const [u] = await db
      .select({ id: users.id, email: users.email, role: users.role, clerkId: users.clerkId })
      .from(users)
      .where(eq(users.clerkId, argumento))
      .limit(1);
    usuario = u;
  } else if (modo === 'email') {
    const [u] = await db
      .select({ id: users.id, email: users.email, role: users.role, clerkId: users.clerkId })
      .from(users)
      .where(eq(users.email, argumento))
      .limit(1);
    usuario = u;
  }

  if (!usuario) {
    console.error(`❌ Usuário não encontrado (${modo}: ${argumento})`);
    process.exit(1);
  }

  console.log(`📋 Usuário: ${usuario.email} | role atual: ${usuario.role} | clerkId: ${usuario.clerkId ?? 'null'}`);

  // Atualizar role no banco
  await db.update(users).set({ role: novoRole }).where(eq(users.id, usuario.id));
  console.log(`✅ Banco atualizado: role = ${novoRole}`);

  // Atualizar publicMetadata no Clerk (usa clerkId da tabela ou do argumento)
  const clerkIdAlvo = modo === 'clerkId' ? argumento : usuario.clerkId;

  if (clerkIdAlvo) {
    try {
      const client = await clerkClient();
      await client.users.updateUserMetadata(clerkIdAlvo, {
        publicMetadata: { role: novoRole },
      });
      console.log(`✅ Clerk atualizado: publicMetadata.role = ${novoRole}`);
    } catch (err) {
      console.error('❌ Falha ao atualizar Clerk (banco OK):', err);
    }
  } else {
    console.warn('⚠️  clerkId não encontrado no banco — Clerk não foi atualizado. Defina manualmente no Clerk Dashboard.');
  }

  console.log('\n✅ Concluído! Faça logout e login novamente.\n');
}

main().catch(console.error);
