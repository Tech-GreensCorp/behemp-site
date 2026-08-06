/**
 * Script de sincronização Clerk ↔ Neon.
 *
 * Busca todos os usuários do Clerk via API REST,
 * cria/atualiza os registros correspondentes no banco (users, medicos),
 * e popula medicamentos padrão.
 *
 * Uso: pnpm db:sync-clerk
 */

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq } from 'drizzle-orm';
import * as schema from './schema';

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

if (!CLERK_SECRET_KEY || !DATABASE_URL) {
  console.error(
    '❌ Variáveis CLERK_SECRET_KEY e DATABASE_URL são obrigatórias no .env',
  );
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const db = drizzle({ client: sql, schema });

interface ClerkUser {
  id: string;
  email_addresses: { email_address: string }[];
  first_name: string | null;
  last_name: string | null;
  phone_numbers: { phone_number: string }[];
  image_url: string;
  public_metadata: { role?: 'admin' | 'medico' | 'paciente' };
}

async function buscarUsuariosClerk(): Promise<ClerkUser[]> {
  const response = await fetch('https://api.clerk.com/v1/users?limit=100', {
    headers: {
      Authorization: `Bearer ${CLERK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const erro = await response.text();
    throw new Error(`Erro ao buscar usuários do Clerk: ${erro}`);
  }

  return response.json();
}

async function sincronizarUsuarios(usuariosClerk: ClerkUser[]) {
  let criados = 0;
  let atualizados = 0;

  for (const clerkUser of usuariosClerk) {
    const email = clerkUser.email_addresses[0]?.email_address;
    if (!email) continue;

    const nome =
      [clerkUser.first_name, clerkUser.last_name]
        .filter(Boolean)
        .join(' ')
        .trim() || email.split('@')[0];

    const role = clerkUser.public_metadata?.role ?? 'paciente';
    const telefone = clerkUser.phone_numbers[0]?.phone_number ?? null;

    // Verificar se já existe pelo clerkId
    const [existente] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.clerkId, clerkUser.id))
      .limit(1);

    if (existente) {
      // Atualizar dados
      await db
        .update(schema.users)
        .set({ nome, email, role, telefone, avatarUrl: clerkUser.image_url })
        .where(eq(schema.users.id, existente.id));
      atualizados++;
      console.log(`  🔄 Atualizado: ${nome} (${role})`);
    } else {
      // Verificar por email (seed anterior sem clerkId)
      const [porEmail] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, email))
        .limit(1);

      if (porEmail) {
        await db
          .update(schema.users)
          .set({ clerkId: clerkUser.id, nome, role, telefone, avatarUrl: clerkUser.image_url })
          .where(eq(schema.users.id, porEmail.id));
        atualizados++;
        console.log(`  🔗 Vinculado ao Clerk: ${nome} (${role})`);
      } else {
        // Inserir novo
        const [novoUser] = await db
          .insert(schema.users)
          .values({
            email,
            nome,
            role,
            telefone,
            avatarUrl: clerkUser.image_url,
            clerkId: clerkUser.id,
          })
          .returning({ id: schema.users.id, role: schema.users.role });
        criados++;
        console.log(`  ✅ Criado: ${nome} (${role})`);

        // Se for médico, criar registro na tabela médicos
        if (role === 'medico') {
          const medicoJaExiste = await db
            .select()
            .from(schema.medicos)
            .where(eq(schema.medicos.userId, novoUser.id))
            .limit(1);

          if (medicoJaExiste.length === 0) {
            await db.insert(schema.medicos).values({
              userId: novoUser.id,
              crm: 'CRM/SP 000000', // Atualizar no painel
              especialidade: 'Medicina Geral',
              bio: 'Especialista em medicina endocanabinóide.',
            });
            console.log(`     → Perfil de médico criado`);
          }
        }
      }
    }
  }

  return { criados, atualizados };
}

// Também verifica usuários médicos já no banco sem perfil de médico
async function criarPerfisMedicosFaltantes() {
  const medicosSemPerfil = await db
    .select({ id: schema.users.id, nome: schema.users.nome })
    .from(schema.users)
    .where(eq(schema.users.role, 'medico'));

  for (const user of medicosSemPerfil) {
    const [perfilExiste] = await db
      .select()
      .from(schema.medicos)
      .where(eq(schema.medicos.userId, user.id))
      .limit(1);

    if (!perfilExiste) {
      await db.insert(schema.medicos).values({
        userId: user.id,
        crm: 'CRM/SP 000000',
        especialidade: 'Medicina Geral',
        bio: 'Especialista em medicina endocanabinóide.',
      });
      console.log(`  🩺 Perfil de médico criado para: ${user.nome}`);
    }
  }
}

async function seedMedicamentos() {
  const existentes = await db.select().from(schema.medicamentos).limit(1);
  if (existentes.length > 0) {
    console.log('  ⏭️  Medicamentos já populados — pulando');
    return;
  }

  await db.insert(schema.medicamentos).values([
    {
      nome: 'Canabidiol 200mg/ml',
      principioAtivo: 'Canabidiol (CBD)',
      gotasPorMl: 20,
    },
    {
      nome: 'Canabidiol 100mg/ml',
      principioAtivo: 'Canabidiol (CBD)',
      gotasPorMl: 20,
    },
    {
      nome: 'THC Full Spectrum 30mg/ml',
      principioAtivo: 'Tetrahidrocanabinol (THC)',
      gotasPorMl: 25,
    },
    {
      nome: 'CBD + THC 1:1 50mg/ml',
      principioAtivo: 'Canabidiol + Tetrahidrocanabinol',
      gotasPorMl: 20,
    },
    {
      nome: 'CBD Isolado 50mg/ml',
      principioAtivo: 'Canabidiol Isolado',
      gotasPorMl: 30,
    },
  ]);
  console.log('  ✅ 5 medicamentos cadastrados');
}

async function main() {
  console.log('🔄 Iniciando sincronização Clerk → Neon...\n');

  // 1. Buscar usuários do Clerk
  console.log('📡 Buscando usuários do Clerk...');
  const usuariosClerk = await buscarUsuariosClerk();
  console.log(`   ${usuariosClerk.length} usuário(s) encontrado(s)\n`);

  // 2. Sincronizar usuários
  console.log('👤 Sincronizando usuários...');
  const { criados, atualizados } = await sincronizarUsuarios(usuariosClerk);
  console.log(
    `   Resultado: ${criados} criado(s), ${atualizados} atualizado(s)\n`,
  );

  // 3. Garantir perfis de médicos
  console.log('🩺 Verificando perfis de médicos...');
  await criarPerfisMedicosFaltantes();
  console.log('');

  // 4. Seed de medicamentos
  console.log('💊 Verificando medicamentos...');
  await seedMedicamentos();
  console.log('');

  console.log('🎉 Sincronização concluída com sucesso!');
  console.log('\n📋 Próximos passos:');
  console.log(
    '   1. Acesse /medico para verificar o dashboard com o usuário médico',
  );
  console.log(
    '   2. Acesse /admin para verificar o painel admin',
  );
  console.log(
    '   3. Cadastre um paciente em /medico/pacientes/novo',
  );
}

main().catch((error) => {
  console.error('❌ Erro na sincronização:', error);
  process.exit(1);
});
