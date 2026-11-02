/**
 * Seed de TESTE LOCAL das telas Triagens / Pacientes / Atribuir Médico.
 *
 * O que faz: cria dados fictícios (e-mails `seedtp+...@example.com`, nomes com "[SEED]") para
 * exercitar a conversão triagem → paciente, a atribuição de médico, o arquivamento e a paginação.
 * Como se desfaz: `npx tsx scripts/seed-teste-triagem-paciente.ts --remover` (só apaga o que tem o
 * marcador). Idempotente: apaga o que é dele e recria.
 *
 * 🔴 Recusa rodar com NODE_ENV=production ou DATABASE_URL de Neon. Nenhum dado real, nenhum login
 * no Clerk é criado (clerk_id fica nulo): a conversão cria a conta no Clerk de DESENVOLVIMENTO.
 */
import { eq, like, inArray } from 'drizzle-orm';

import { medicos, pacientes, triagens, users } from '@/db/schema';
import { db } from '@/lib/db';

const MARCA = 'seedtp+';
const DOMINIO = '@example.com';
const email = (n: string) => `${MARCA}${n}${DOMINIO}`;

function abortarSeProducao() {
  const url = process.env.DATABASE_URL ?? '';
  if (process.env.NODE_ENV === 'production' || /neon\.tech|neon\.build/.test(url) || !url) {
    throw new Error('Este seed só roda em banco local.');
  }
}

async function remover() {
  const us = await db
    .select({ id: users.id })
    .from(users)
    .where(like(users.email, `${MARCA}%`));
  const ids = us.map((u) => u.id);
  await db.delete(triagens).where(like(triagens.emailContato, `${MARCA}%`));
  if (ids.length) {
    await db.delete(pacientes).where(inArray(pacientes.userId, ids));
    await db.delete(medicos).where(inArray(medicos.userId, ids));
    await db.delete(users).where(inArray(users.id, ids));
  }
  console.log(`Removidos ${ids.length} usuários e as triagens de teste.`);
}

function dadosDaTriagem(nome: string, mail: string) {
  return {
    nome_paciente: nome,
    cpf: '529.982.247-25',
    data_nascimento: '1985-03-21',
    peso: '70',
    altura: '1.70',
    email: mail,
    telefone: '11999990000',
    cep: '01310-100',
    estado: 'SP',
    endereco: 'Av. Paulista, 1000',
    como_chegou: 'Indicação',
    diagnostico_principal: 'Epilepsia refratária',
    nivel_tratamento: 'Moderado',
  };
}

async function criar() {
  await remover();

  // Dois médicos de teste (para atribuir e reatribuir).
  const medicosIds: string[] = [];
  for (const [n, nome] of [
    ['medico1', 'Dr. Seed Um'],
    ['medico2', 'Dra. Seed Dois'],
  ]) {
    const [u] = await db
      .insert(users)
      .values({ email: email(n), nome: `[SEED] ${nome}`, role: 'medico' })
      .returning();
    const [m] = await db
      .insert(medicos)
      .values({ userId: u.id, crm: `CRM/SP 0000${n.slice(-1)}-SEED`, especialidade: 'Teste' })
      .returning();
    medicosIds.push(m.id);
  }

  // 30 pacientes ativos (2 páginas de 20): os 10 primeiros sem médico, o resto com.
  for (let i = 1; i <= 30; i++) {
    const [u] = await db
      .insert(users)
      .values({
        email: email(`paciente${String(i).padStart(2, '0')}`),
        nome: `[SEED] Paciente ${String(i).padStart(2, '0')}`,
        role: 'paciente',
      })
      .returning();
    await db.insert(pacientes).values({
      userId: u.id,
      medicoId: i <= 10 ? null : medicosIds[i % 2],
      createdAt: new Date(Date.now() - i * 86_400_000), // paciente01 é o mais recente
    });
  }

  // 1 paciente arquivado (para o filtro "Arquivado").
  const [ua] = await db
    .insert(users)
    .values({ email: email('arquivado'), nome: '[SEED] Paciente Arquivado', role: 'paciente' })
    .returning();
  await db.insert(pacientes).values({ userId: ua.id, status: 'arquivado', deletedAt: new Date() });

  // Triagens: pendentes e lidas, com cada situação da conversão.
  const T = [
    ['nova1', '[SEED] Triagem Nova Um', 'pendente'], // converter → vira paciente
    ['nova2', '[SEED] Triagem Nova Dois', 'pendente'], // converter → vira paciente
    ['paciente03', '[SEED] Paciente 03', 'visualizada'], // já é paciente → flag "Paciente"
    ['arquivado', '[SEED] Paciente Arquivado', 'pendente'], // ficha arquivada → conversão recusa
    ['lida1', '[SEED] Triagem Lida', 'visualizada'],
  ] as const;
  for (const [n, nome, status] of T) {
    await db.insert(triagens).values({
      dados: dadosDaTriagem(nome, email(n)),
      emailContato: email(n),
      telefoneContato: '11999990000',
      nomeContato: nome,
      statusVisualizacao: status,
    });
  }
  // Triagem sem e-mail: a conversão deve recusar com mensagem clara.
  await db.insert(triagens).values({
    dados: { nome_paciente: '[SEED] Sem Email' },
    nomeContato: '[SEED] Triagem Sem E-mail',
    statusVisualizacao: 'pendente',
  });

  console.log('Seed criado: 2 médicos, 30 pacientes (1–10 sem médico), 1 arquivado, 6 triagens.');
}

abortarSeProducao();
(process.argv.includes('--remover') ? remover : criar)()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('🔴', e instanceof Error ? e.message : e);
    process.exit(1);
  });
