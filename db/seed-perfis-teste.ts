/**
 * SEED DE PERFIS DE TESTE — um por papel, para desenvolvimento local.
 *
 * O QUE FAZ
 * Cria três usuários no banco — admin, médico e paciente — com o médico e o paciente
 * **vinculados entre si**, para que as telas que exigem escopo de objeto funcionem: a anamnese
 * do médico só abre para paciente que é dele.
 *
 * COMO SE DESFAZ
 * `pnpm tsx db/seed-perfis-teste.ts --remover` apaga só o que ele criou, pelos e-mails abaixo.
 * Nada mais é tocado.
 *
 * IDEMPOTENTE: sim. Rodar duas vezes não duplica — procura por e-mail antes de inserir.
 *
 * 🔴 RECUSA RODAR EM PRODUÇÃO. Duas travas: `NODE_ENV=production` e URL de Neon. A segunda
 * existe porque `NODE_ENV` pode não estar definido num terminal qualquer, e um seed que cria
 * usuário em banco de produção é incidente, não erro.
 *
 * ⚠️ O QUE ESTE SEED **NÃO** FAZ, E NÃO PODE FAZER
 * Não cria a conta no **Clerk**. O login desta plataforma é Clerk, e criar usuário lá exige a
 * chave secreta da conta — que não está neste ambiente. Sem ela, estes perfis existem no banco e
 * **não têm como fazer login**.
 *
 * O caminho para usá-los está no fim deste arquivo.
 */
import { and, eq, inArray, isNull } from 'drizzle-orm';

import { medicos, pacientes, users } from '@/db/schema';
import { db } from '@/lib/db';

/**
 * Os três perfis. E-mails com `+teste` para serem filtráveis e removíveis.
 *
 * O domínio é `example.com` porque a RFC 2606 §3 o reserva para exatamente este uso — exemplo e
 * teste — então nunca colide com um domínio real da Be4Hope. Foi também o único formato reservado
 * que o Clerk aceitou: `.local` e `.test` ele recusa com `form_param_format_invalid`.
 */
const PERFIS = [
  {
    email: 'admin+clerk_test@example.com',
    nome: 'Ana Administradora (teste)',
    role: 'admin' as const,
  },
  {
    email: 'medico+clerk_test@example.com',
    nome: 'Dr. Marcos Teste',
    role: 'medico' as const,
  },
  {
    email: 'paciente+clerk_test@example.com',
    nome: 'Pedro Paciente (teste)',
    role: 'paciente' as const,
  },
];

const EMAILS = PERFIS.map((p) => p.email);

function abortarSeProducao() {
  const url = process.env.DATABASE_URL ?? '';
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seed de teste não roda com NODE_ENV=production.');
  }
  // Segunda trava: NODE_ENV pode estar ausente num terminal qualquer.
  if (/neon\.tech|neon\.build/.test(url)) {
    throw new Error(
      'DATABASE_URL aponta para o Neon. Este seed cria usuários — não roda contra produção.',
    );
  }
  if (!url) throw new Error('DATABASE_URL não definida.');
}

async function remover() {
  abortarSeProducao();
  const encontrados = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(inArray(users.email, EMAILS));
  if (encontrados.length === 0) return console.log('Nada para remover.');

  const ids = encontrados.map((u) => u.id);
  // Ordem importa: filhos antes do pai, senão a FK reclama.
  await db.delete(pacientes).where(inArray(pacientes.userId, ids));
  await db.delete(medicos).where(inArray(medicos.userId, ids));
  await db.delete(users).where(inArray(users.id, ids));
  console.log(`Removidos ${encontrados.length} perfis de teste.`);
}

async function criar() {
  abortarSeProducao();
  console.log(`Banco: ${process.env.DATABASE_URL?.replace(/:[^:@]*@/, ':***@')}\n`);

  const criados: Record<string, string> = {};

  for (const perfil of PERFIS) {
    const [existente] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, perfil.email))
      .limit(1);

    if (existente) {
      criados[perfil.role] = existente.id;
      console.log(`  = ${perfil.role.padEnd(9)} já existia  ${perfil.email}`);
      continue;
    }

    const [novo] = await db
      .insert(users)
      .values({
        email: perfil.email,
        nome: perfil.nome,
        role: perfil.role,
        // 🔴 `clerkId` fica NULO de propósito. Ele é preenchido quando a conta real do Clerk
        // existir — ver as instruções no fim. Inventar um id aqui criaria um usuário que
        // parece autenticável e não é.
        clerkId: null,
      })
      .returning();
    criados[perfil.role] = novo.id;
    console.log(`  + ${perfil.role.padEnd(9)} criado      ${perfil.email}`);
  }

  // ── médico ────────────────────────────────────────────────────────────────
  let medicoId: string | undefined;
  const [medicoExistente] = await db
    .select({ id: medicos.id })
    .from(medicos)
    .where(eq(medicos.userId, criados.medico))
    .limit(1);

  if (medicoExistente) {
    medicoId = medicoExistente.id;
    console.log('  = perfil de médico já existia');
  } else {
    const [m] = await db
      .insert(medicos)
      .values({
        userId: criados.medico,
        crm: 'CRM/SP 000000-TESTE',
        especialidade: 'Medicina Endocanabinóide',
      })
      .returning();
    medicoId = m.id;
    console.log('  + perfil de médico criado');
  }

  // ── paciente, VINCULADO ao médico ─────────────────────────────────────────
  // O vínculo é o que faz as telas funcionarem: `garantirMedicoDoPaciente` conjunga
  // `pacientes.medicoId`. Sem ele, a anamnese responde "Paciente não encontrado".
  const [pacienteExistente] = await db
    .select({ id: pacientes.id })
    .from(pacientes)
    .where(and(eq(pacientes.userId, criados.paciente), isNull(pacientes.deletedAt)))
    .limit(1);

  if (pacienteExistente) {
    console.log('  = perfil de paciente já existia');
  } else {
    await db.insert(pacientes).values({ userId: criados.paciente, medicoId });
    console.log('  + perfil de paciente criado e VINCULADO ao médico de teste');
  }

  console.log(`
┌─ Perfis de teste no banco local ─────────────────────────────────────────┐
│  admin      ${PERFIS[0].email.padEnd(58)}│
│  médico     ${PERFIS[1].email.padEnd(58)}│
│  paciente   ${PERFIS[2].email.padEnd(58)}│
└──────────────────────────────────────────────────────────────────────────┘

🔴 ELES AINDA NÃO FAZEM LOGIN, e a razão não é este seed.

O login desta plataforma é o Clerk. Criar conta lá exige a chave secreta da sua conta Clerk, que
não está neste ambiente. Sem ela, um usuário no banco é um registro sem credencial.

Para fazer os três logarem, o caminho mais curto:

  1. no painel do Clerk, em Development, copie as duas chaves e ponha no .env:
       NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
       CLERK_SECRET_KEY=sk_test_...
  2. crie os três usuários no painel do Clerk, com ESTES e-mails
  3. rode:  pnpm db:sync-clerk
     — é o script que já existe no repositório e casa cada conta do Clerk com a linha de \`users\`
       pelo e-mail, preenchendo o \`clerk_id\`
  4. no Clerk, em cada usuário, defina publicMetadata:  { "role": "medico" }
     — é de lá que \`obterRoleComFallback\` lê o papel

Depois disso: /entrar com cada e-mail, e cada um cai na sua área.

Para desfazer este seed:  pnpm tsx db/seed-perfis-teste.ts --remover
`);
}

const alvo = process.argv.includes('--remover') ? remover : criar;
alvo()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('\n🔴', e instanceof Error ? e.message : e);
    process.exit(1);
  });
