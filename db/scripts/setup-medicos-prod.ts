/**
 * Configura os 3 médicos de produção na tabela medicos.
 *
 * - Atualiza nome dos usuários existentes pelos emails cadastrados no Clerk
 * - Cria ou atualiza os registros na tabela medicos com bio, especialidade, valor e ordem
 * - Soft-delete em médicos antigos (emails de seed/placeholder) que não fazem parte do trio
 *
 * Uso: npx tsx --env-file=.env db/scripts/setup-medicos-prod.ts
 */

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { createId } from '@paralleldrive/cuid2';
import { eq, notInArray } from 'drizzle-orm';
import * as schema from '../schema';

const MEDICOS = [
  {
    email: 'medicos@behemp.org',
    nome: 'Sidarta Zuanon Dias',
    especialidade: 'Neurocirurgia, Neurologia, Medicina do Trabalho e Medicina Endocanabinoide.',
    bio: 'Médico graduado pela Faculdade Estadual de Medicina de São José do Rio Preto, com especialização em Neurocirurgia pela Sociedade Brasileira de Neurocirurgia. Possui também especialização em Acupuntura e Medicina Tradicional Chinesa pelo Colégio Médico Brasileiro de Acupuntura, além de especialização em Medicina do Trabalho, reconhecida pela Associação Médica Brasileira e pela Associação Nacional de Medicina do Trabalho. Atua com abordagem multidisciplinar, integrando conhecimentos da medicina convencional e práticas complementares no cuidado à saúde.',
    valorConsulta: '200.00',
    ordem: 1,
  },
  {
    email: 'wellingtonbriques@hotmail.com',
    nome: 'Dr. Wellington Briques',
    especialidade: 'Clínico Geral',
    bio: 'Dr. Wellington Briques é médico graduado pela Faculdade de Medicina da USP de Ribeirão Preto, com titulação de MBA e GFMD (Global Fellow in Medicine Development pelo Kings College, London UK, e IFAPP), ex-Presidente da Sociedade Brasileira de Medicina Farmacêutica (SBMF), Fundador da Cannabis Academy, e atuou como Chief Medical Officer do Butantan e como Diretor Médico Global da Canopy Growth no Canada, entre outros cargos. Atualmente é o Regional Medical Director LATAM na Regeneron, USA. Autor do livro Descomplicando a Prática Clínica da Cannabis Medicinal. Dedica sua carreira ao atendimento de pacientes, ensino médico, publicações científicas e ao desenvolvimento de novas moléculas em áreas como a cannabis medicinal, fibromialgia e oncologia.',
    valorConsulta: '500.00',
    ordem: 2,
  },
  {
    email: 'balderas.amurrio@gmail.com',
    nome: 'Natalia Balderas Amurrio',
    especialidade: 'Neurologia Pediátrica',
    bio: 'Médica formada pela Universidad Mayor de San Simón, com diploma revalidado no Brasil pela Universidade Estadual Paulista Júlio de Mesquita Filho por meio do Revalida/INEP. Possui especialização em Neurologia Pediátrica pela FG Faculdade Global e atualmente cursa pós-graduação em Neurologia na Universidade São Judas Tadeu. Atua em ambulatório de neurologia e pronto-socorro, com experiência em atendimento clínico, urgência e emergência, além de acompanhamento neurológico ambulatorial. Possui certificações em ACLS e ATLS, com experiência em atendimento pré-hospitalar e hospitalar. Profissional com perfil clínico-assistencial, experiência em neurologia e atendimento emergencial.',
    valorConsulta: '300.00',
    ordem: 3,
  },
] as const;

async function run() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL não configurada.');
    process.exit(1);
  }

  const sql = neon(databaseUrl);
  const db = drizzle({ client: sql, schema });

  console.log('🔄 Configurando médicos de produção...\n');

  const userIdsAtivos: string[] = [];

  for (const m of MEDICOS) {
    // 1. Buscar usuário pelo email
    const [user] = await db
      .select({ id: schema.users.id, nome: schema.users.nome, deletedAt: schema.users.deletedAt })
      .from(schema.users)
      .where(eq(schema.users.email, m.email))
      .limit(1);

    if (!user) {
      console.warn(`⚠️  Usuário não encontrado para ${m.email} — crie ele no Clerk primeiro`);
      continue;
    }

    // 2. Corrigir nome e garantir role=medico, remover soft-delete caso exista
    await db
      .update(schema.users)
      .set({ nome: m.nome, role: 'medico', deletedAt: null })
      .where(eq(schema.users.id, user.id));

    console.log(`✅ User atualizado: ${m.email} → ${m.nome}`);

    // 3. Verificar se já existe registro em medicos
    const [medicoExistente] = await db
      .select({ id: schema.medicos.id })
      .from(schema.medicos)
      .where(eq(schema.medicos.userId, user.id))
      .limit(1);

    if (medicoExistente) {
      // Atualizar dados existentes
      await db
        .update(schema.medicos)
        .set({
          especialidade: m.especialidade,
          bio: m.bio,
          valorConsulta: m.valorConsulta,
          ordem: m.ordem,
        })
        .where(eq(schema.medicos.id, medicoExistente.id));
      console.log(`   ↳ Registro médico atualizado (ordem=${m.ordem})`);
      userIdsAtivos.push(user.id);
    } else {
      // Inserir novo registro
      await db.insert(schema.medicos).values({
        id: createId(),
        userId: user.id,
        especialidade: m.especialidade,
        bio: m.bio,
        valorConsulta: m.valorConsulta,
        ordem: m.ordem,
      });
      console.log(`   ↳ Registro médico criado (ordem=${m.ordem})`);
      userIdsAtivos.push(user.id);
    }
  }

  // 4. Soft-delete de médicos antigos (role=medico, não pertencem aos 3 emails acima)
  if (userIdsAtivos.length > 0) {
    const medicosAntigos = await db
      .select({ id: schema.medicos.id, userId: schema.medicos.userId })
      .from(schema.medicos)
      .where(notInArray(schema.medicos.userId, userIdsAtivos));

    if (medicosAntigos.length > 0) {
      for (const { userId } of medicosAntigos) {
        await db
          .update(schema.users)
          .set({ deletedAt: new Date() })
          .where(eq(schema.users.id, userId));
      }
      console.log(`\n🗑️  Soft-delete em ${medicosAntigos.length} médico(s) antigo(s)`);
    }
  }

  console.log('\n🎉 Médicos configurados com sucesso!');
  console.log('   Ordem: 1 → Sidarta | 2 → Wellington | 3 → Natalia');
  console.log('\n⚠️  Lembre de atualizar os CRMs e fotos (avatarUrl) pelo painel admin.');
}

run().catch((err) => {
  console.error('❌ Erro:', err);
  process.exit(1);
});
