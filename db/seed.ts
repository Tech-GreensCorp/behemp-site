import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { createId } from '@paralleldrive/cuid2';
import * as schema from './schema';

/**
 * Script de seed — popula o banco com dados mínimos para desenvolvimento.
 *
 * Uso: npx tsx db/seed.ts
 *
 * Dados criados:
 * - 1 admin
 * - 2 médicos
 * - 3 pacientes
 * - 5 medicamentos
 * - 1 grupo de chat
 */
async function seed() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL não configurada. Crie o arquivo .env.local');
    process.exit(1);
  }

  const sql = neon(databaseUrl);
  const db = drizzle({ client: sql, schema });

  console.log('🌱 Iniciando seed do banco de dados...\n');

  // ── 1. Usuários ─────────────────────────────────────────
  const adminId = createId();
  const medico1UserId = createId();
  const medico2UserId = createId();
  const paciente1UserId = createId();
  const paciente2UserId = createId();
  const paciente3UserId = createId();

  await db.insert(schema.users).values([
    {
      id: adminId,
      email: 'admin@be4hope.org',
      nome: 'Administrador Be4Hope',
      role: 'admin',
      telefone: '(11) 99999-0000',
    },
    {
      id: medico1UserId,
      email: 'dr.silva@be4hope.org',
      nome: 'Dr. Carlos Silva',
      role: 'medico',
      telefone: '(11) 99999-1111',
    },
    {
      id: medico2UserId,
      email: 'dra.santos@be4hope.org',
      nome: 'Dra. Ana Santos',
      role: 'medico',
      telefone: '(11) 99999-2222',
    },
    {
      id: paciente1UserId,
      email: 'joao@exemplo.com',
      nome: 'João Oliveira',
      role: 'paciente',
      telefone: '(11) 98888-1111',
    },
    {
      id: paciente2UserId,
      email: 'maria@exemplo.com',
      nome: 'Maria Souza',
      role: 'paciente',
      telefone: '(11) 98888-2222',
    },
    {
      id: paciente3UserId,
      email: 'pedro@exemplo.com',
      nome: 'Pedro Lima',
      role: 'paciente',
      telefone: '(11) 98888-3333',
    },
  ]);
  console.log('✅ 6 usuários criados (1 admin, 2 médicos, 3 pacientes)');

  // ── 2. Médicos ──────────────────────────────────────────
  const medico1Id = createId();
  const medico2Id = createId();

  await db.insert(schema.medicos).values([
    {
      id: medico1Id,
      userId: medico1UserId,
      crm: 'CRM/SP 123456',
      especialidade: 'Neurologia',
      bio: 'Especialista em tratamentos com canabinóides para dor crônica e epilepsia.',
    },
    {
      id: medico2Id,
      userId: medico2UserId,
      crm: 'CRM/SP 654321',
      especialidade: 'Psiquiatria',
      bio: 'Especialista em saúde mental com abordagem integrativa em medicina endocanabinóide.',
    },
  ]);
  console.log('✅ 2 médicos criados');

  // ── 3. Pacientes ────────────────────────────────────────
  const paciente1Id = createId();
  const paciente2Id = createId();
  const paciente3Id = createId();

  await db.insert(schema.pacientes).values([
    {
      id: paciente1Id,
      userId: paciente1UserId,
      medicoId: medico1Id,
      dataNascimento: '1985-03-15',
      cpf: '111.222.333-44',
      status: 'em_tratamento',
      tratamentoTipo: 'cbd',
      endereco: 'Rua das Flores, 123 — São Paulo, SP',
    },
    {
      id: paciente2Id,
      userId: paciente2UserId,
      medicoId: medico1Id,
      dataNascimento: '1992-07-22',
      cpf: '555.666.777-88',
      status: 'aguardando_consulta',
      tratamentoTipo: 'cbd_thc',
      endereco: 'Av. Paulista, 456 — São Paulo, SP',
    },
    {
      id: paciente3Id,
      userId: paciente3UserId,
      medicoId: medico2Id,
      dataNascimento: '1978-11-08',
      cpf: '999.000.111-22',
      status: 'em_tratamento',
      tratamentoTipo: 'thc',
      endereco: 'Rua Augusta, 789 — São Paulo, SP',
    },
  ]);
  console.log('✅ 3 pacientes criados');

  // ── 4. Medicamentos ─────────────────────────────────────
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
  console.log('✅ 5 medicamentos criados');

  // ── 5. Grupo de chat ────────────────────────────────────
  const grupoId = createId();

  await db.insert(schema.gruposChat).values({
    id: grupoId,
    nome: 'Suporte Be4Hope',
    tipo: 'grupo',
    criadoPor: adminId,
  });

  await db.insert(schema.participantesGrupo).values([
    { grupoId, userId: adminId },
    { grupoId, userId: medico1UserId },
    { grupoId, userId: medico2UserId },
  ]);
  console.log('✅ 1 grupo de chat criado com 3 participantes');

  console.log('\n🎉 Seed concluído com sucesso!');
}

seed().catch((error) => {
  console.error('❌ Erro no seed:', error);
  process.exit(1);
});
