/**
 * Script para atualizar médicos na página de agendamento.
 *
 * Remove: Dr. Carlos Silva, Dra. Ana Santos (soft-delete)
 * Adiciona: Dr. Sidarta Zuanon Dias (1º), Dr. Wellington Briques (2º), Natalia Balderas Amurrio (3º)
 *
 * Uso: npx tsx db/scripts/update-medicos.ts
 */

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { createId } from '@paralleldrive/cuid2';
import { eq, inArray } from 'drizzle-orm';
import * as schema from '../schema';

async function run() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL não configurada. Crie o arquivo .env.local');
    process.exit(1);
  }

  const sql = neon(databaseUrl);
  const db = drizzle({ client: sql, schema });

  console.log('🔄 Atualizando médicos...\n');

  // ── 1. Soft-delete dos médicos antigos ──────────────────────
  const nomesRemover = ['Dr. Carlos Silva', 'Dra. Ana Santos'];
  const usuariosAntigos = await db
    .select({ id: schema.users.id, nome: schema.users.nome })
    .from(schema.users)
    .where(inArray(schema.users.nome, nomesRemover));

  if (usuariosAntigos.length > 0) {
    const idsRemover = usuariosAntigos.map((u) => u.id);
    await db
      .update(schema.users)
      .set({ deletedAt: new Date() })
      .where(inArray(schema.users.id, idsRemover));
    console.log(`✅ Soft-delete em ${usuariosAntigos.length} médico(s): ${usuariosAntigos.map((u) => u.nome).join(', ')}`);
  } else {
    console.log('⚠️  Médicos Dr. Carlos Silva / Dra. Ana Santos não encontrados (já removidos ou IDs diferentes)');
  }

  // ── 2. Inserir novos usuários ───────────────────────────────
  const sidartaUserId = createId();
  const wellingtonUserId = createId();
  const nataliaUserId = createId();

  await db.insert(schema.users).values([
    {
      id: sidartaUserId,
      email: 'sidarta.zuanon@be4hope.org',
      nome: 'Sidarta Zuanon Dias',
      role: 'medico',
    },
    {
      id: wellingtonUserId,
      email: 'wellington.briques@be4hope.org',
      nome: 'Dr. Wellington Briques',
      role: 'medico',
    },
    {
      id: nataliaUserId,
      email: 'natalia.balderas@be4hope.org',
      nome: 'Natalia Balderas Amurrio',
      role: 'medico',
    },
  ]);
  console.log('✅ 3 usuários médicos criados');

  // ── 3. Inserir perfis de médico ─────────────────────────────
  await db.insert(schema.medicos).values([
    {
      id: createId(),
      userId: sidartaUserId,
      especialidade: 'Neurocirurgia, Neurologia, Medicina do Trabalho e Medicina Endocanabinoide.',
      bio: 'Médico graduado pela Faculdade Estadual de Medicina de São José do Rio Preto, com especialização em Neurocirurgia pela Sociedade Brasileira de Neurocirurgia. Possui também especialização em Acupuntura e Medicina Tradicional Chinesa pelo Colégio Médico Brasileiro de Acupuntura, além de especialização em Medicina do Trabalho, reconhecida pela Associação Médica Brasileira e pela Associação Nacional de Medicina do Trabalho. Atua com abordagem multidisciplinar, integrando conhecimentos da medicina convencional e práticas complementares no cuidado à saúde.',
      valorConsulta: '200.00',
      ordem: 1,
    },
    {
      id: createId(),
      userId: wellingtonUserId,
      especialidade: 'Clinico Geral',
      bio: 'Dr. Wellington Briques é médico graduado pela Faculdade de Medicina da USP de Ribeirão Preto, com titulação de MBA e GFMD (Global Fellow in Medicine Development pelo Kings College, London UK, e IFAPP), ex-Presidente da Sociedade Brasileira de Medicina Farmacêutica (SBMF), Fundador da Cannabis Academy, e atuou como Chief Medical Officer do Butantan e como Diretor Médico Global da Canopy Growth no Canada, entre outros cargos. Atualmente é o Regional Medical Director LATAM na Regeneron, USA. Autor do livro Descomplicando a Prática Clínica da Medicina Endocanabinoide. Dedica sua carreira ao atendimento de pacientes, ensino médico, publicações científicas e ao desenvolvimento de novas moléculas em áreas como a Medicina Endocanabinoide, fibromialgia e oncologia.',
      valorConsulta: '500.00',
      ordem: 2,
    },
    {
      id: createId(),
      userId: nataliaUserId,
      especialidade: 'Neurologia Pediátrica',
      bio: 'Médica formada pela Universidad Mayor de San Simón, com diploma revalidado no Brasil pela Universidade Estadual Paulista Júlio de Mesquita Filho por meio do Revalida/INEP. Possui especialização em Neurologia Pediátrica pela FG Faculdade Global e atualmente cursa pós-graduação em Neurologia na Universidade São Judas Tadeu. Atua em ambulatório de neurologia e pronto-socorro, com experiência em atendimento clínico, urgência e emergência, além de acompanhamento neurológico ambulatorial. Possui certificações em ACLS e ATLS, com experiência em atendimento pré-hospitalar e hospitalar. Profissional com perfil clínico-assistencial, experiência em neurologia e atendimento emergencial.',
      valorConsulta: '300.00',
      ordem: 3,
    },
  ]);
  console.log('✅ 3 perfis de médico criados');

  console.log('\n🎉 Médicos atualizados com sucesso!');
  console.log('\n⚠️  Atenção: atualize os CRMs reais e as fotos (avatarUrl) via painel admin.');
}

run().catch((error) => {
  console.error('❌ Erro ao atualizar médicos:', error);
  process.exit(1);
});
