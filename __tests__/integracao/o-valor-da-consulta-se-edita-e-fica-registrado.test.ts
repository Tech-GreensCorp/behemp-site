/**
 * O CRUD do médico no admin, EXECUTADO contra um Postgres de verdade.
 *
 * 🔴 ISTO NÃO É GUARDA ESTRUTURAL. Guarda lê o código e prova que está escrito; este roda a
 * action e olha as linhas que sobraram no banco. É o Nível 4 da regra _"Deploy CUSTA"_ do
 * `CLAUDE.md` — e o único nível que responde "funciona?" sem gastar um deploy.
 *
 * ## O que ele prova, e por que cada um importa
 *
 *   1. o `valorConsulta` é GRAVADO na edição — até 23/09/2026 ele só era gravável no cadastro,
 *      e corrigir um valor errado exigia `UPDATE` manual no banco de produção
 *   2. a edição deixa RASTRO: `logs_auditoria` com o antes e o depois. Dado de médico que muda
 *      sem registro é o que impede responder "quem baixou o preço da consulta?"
 *   3. campo omitido APAGA — comportamento declarado da action, e a razão de `bio` e `ordem`
 *      terem entrado em `MedicoResumo` no mesmo commit
 *   4. valor inválido NÃO CHEGA ao banco, e o que já estava lá sobrevive
 *   5. médico inexistente não vira "sucesso" nem linha de auditoria
 *
 * Rodar:
 *
 *   docker start behemp-pg || docker run -d --name behemp-pg \
 *     -e POSTGRES_PASSWORD=local -e POSTGRES_DB=behemp -p 5544:5432 postgres:16
 *   DATABASE_URL=postgresql://postgres:local@localhost:5544/behemp npx drizzle-kit push --force
 *   DATABASE_URL=postgresql://postgres:local@localhost:5544/behemp \
 *     npx vitest run --config vitest.integracao.mts \
 *     __tests__/integracao/o-valor-da-consulta-se-edita-e-fica-registrado.test.ts
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';

const CLERK_ID_ADMIN = 'user_admin_de_teste';

/** O duplo do Clerk. `verificarAdmin` lê `userId` e `sessionClaims.metadata.role` daqui. */
const sessao = { clerkId: CLERK_ID_ADMIN as string | null, role: 'admin' as string };

vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({
    userId: sessao.clerkId,
    sessionClaims: { metadata: { role: sessao.role } },
  }),
  currentUser: async () => ({ id: sessao.clerkId }),
  clerkClient: async () => ({ users: {} }),
}));

// Fora do Next não há o que revalidar nem cabeçalho de request que valha.
vi.mock('next/cache', () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock('next/headers', () => ({
  headers: async () => new Map<string, string>() as unknown as Headers,
}));

const { db } = await import('@/lib/db');
const schema = await import('@/db/schema');
const { atualizarDadosMedico, listarMedicosAdmin } = await import('@/app/_actions/admin-medicos');

async function limpar() {
  await db.delete(schema.logsAuditoria);
  await db.delete(schema.medicos);
  await db.delete(schema.users);
}

/** Cria o admin da sessão e um médico com estado conhecido. Devolve o id do médico. */
async function cenario(valorInicial: string | null = '350.00') {
  await db.insert(schema.users).values({
    clerkId: CLERK_ID_ADMIN,
    email: 'admin@teste.local',
    nome: 'Admin de Teste',
    role: 'admin',
  });

  const [userMedico] = await db
    .insert(schema.users)
    .values({
      clerkId: 'user_medico_de_teste',
      email: 'medico@teste.local',
      nome: 'Dra. Teste',
      role: 'medico',
    })
    .returning({ id: schema.users.id });

  const [medico] = await db
    .insert(schema.medicos)
    .values({
      userId: userMedico.id,
      especialidade: 'Neurologia',
      crm: 'CRM/SP 111111',
      bio: 'Biografia original que não pode sumir sozinha.',
      ordem: 3,
      valorConsulta: valorInicial,
    })
    .returning({ id: schema.medicos.id });

  return medico.id;
}

async function lerMedico(medicoId: string) {
  const [linha] = await db
    .select()
    .from(schema.medicos)
    .where(eq(schema.medicos.id, medicoId))
    .limit(1);
  return linha;
}

/** O formulário inteiro, como a tela manda. Sobrescreva só o campo do caso. */
function formulario(medicoId: string, sobrescrever: Record<string, unknown> = {}) {
  return {
    medicoId,
    especialidade: 'Neurologia',
    crm: 'CRM/SP 111111',
    bio: 'Biografia original que não pode sumir sozinha.',
    ordem: 3,
    valorConsulta: '350.00',
    ...sobrescrever,
  } as Parameters<typeof atualizarDadosMedico>[0];
}

describe('a edição do médico grava o valor e deixa rastro', () => {
  beforeEach(async () => {
    sessao.clerkId = CLERK_ID_ADMIN;
    sessao.role = 'admin';
    await limpar();
  });

  afterAll(async () => {
    await limpar();
  });

  it('1. grava o valor novo da consulta — o que a action não fazia antes de 23/09/2026', async () => {
    const medicoId = await cenario('350.00');

    const res = await atualizarDadosMedico(formulario(medicoId, { valorConsulta: '420.50' }));

    expect(res.sucesso).toBe(true);
    expect((await lerMedico(medicoId)).valorConsulta).toBe('420.50');
  });

  it('2. aceita o valor como número, não só como string do formulário', async () => {
    const medicoId = await cenario('350.00');

    const res = await atualizarDadosMedico(formulario(medicoId, { valorConsulta: 199.9 }));

    expect(res.sucesso).toBe(true);
    expect((await lerMedico(medicoId)).valorConsulta).toBe('199.90');
  });

  it('3. a edição vira linha de auditoria com o ANTES e o DEPOIS', async () => {
    const medicoId = await cenario('350.00');

    await atualizarDadosMedico(formulario(medicoId, { valorConsulta: '420.50' }));

    const logs = await db.select().from(schema.logsAuditoria);
    expect(logs).toHaveLength(1);
    expect(logs[0].acao).toBe('atualizar');
    expect(logs[0].entidade).toBe('medicos');
    expect(logs[0].entidadeId).toBe(medicoId);
    // O antes veio do BANCO, não do que o cliente mandou — é o ponto do snapshot.
    expect((logs[0].dadosAntes as Record<string, unknown>).valorConsulta).toBe('350.00');
    expect((logs[0].dadosDepois as Record<string, unknown>).valorConsulta).toBe('420.50');
  });

  it('4. a auditoria aponta para o ADMIN da sessão, resolvido pelo clerkId', async () => {
    const medicoId = await cenario();

    await atualizarDadosMedico(formulario(medicoId, { especialidade: 'Clínica Geral' }));

    const [admin] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.clerkId, CLERK_ID_ADMIN))
      .limit(1);
    const logs = await db.select().from(schema.logsAuditoria);
    expect(logs[0].userId).toBe(admin.id);
  });

  it('5. limpar o campo apaga o valor — e o agendamento passa a recusar este médico', async () => {
    const medicoId = await cenario('350.00');

    const res = await atualizarDadosMedico(formulario(medicoId, { valorConsulta: '' }));

    expect(res.sucesso).toBe(true);
    expect((await lerMedico(medicoId)).valorConsulta).toBeNull();
  });

  it('6. campo omitido APAGA — é por isso que bio e ordem entraram em MedicoResumo', async () => {
    const medicoId = await cenario();

    const res = await atualizarDadosMedico({
      medicoId,
      especialidade: 'Neurologia',
      // sem `bio`, sem `ordem`, sem `crm`, sem `valorConsulta`
    });

    expect(res.sucesso).toBe(true);
    const linha = await lerMedico(medicoId);
    expect(linha.bio).toBeNull();
    expect(linha.ordem).toBeNull();
    expect(linha.valorConsulta).toBeNull();
  });

  it('7. a listagem devolve bio e ordem — sem elas a tela salvaria nulo em cima do que existe', async () => {
    const medicoId = await cenario();

    const res = await listarMedicosAdmin();
    const medico = res.dados?.find((m) => m.medicoId === medicoId);

    expect(medico?.bio).toBe('Biografia original que não pode sumir sozinha.');
    expect(medico?.ordem).toBe(3);
    expect(medico?.valorConsulta).toBe(350);
  });

  /**
   * ⚠️ A MENSAGEM FAZ PARTE DO CASO, e não é preciosismo — foi o que uma sabotagem provou
   * em 23/09/2026. Tirando o teto de `numeric(10,2)`, `1e9` passa no Zod, o Postgres recusa
   * com `numeric field overflow`, o `catch` devolve `sucesso: false` e o valor antigo
   * sobrevive porque o UPDATE inteiro falhou. Ou seja: asserir só `sucesso === false` fica
   * VERDE com o defeito. O que muda é o que o admin lê — "Valor acima do máximo permitido"
   * contra "Erro interno ao atualizar médico" — e o log de produção, que enche de
   * `DrizzleQueryError` com a query e os valores inline.
   */
  it.each([
    ['texto', 'abc', 'Valor da consulta inválido'],
    ['negativo', '-5', 'O valor da consulta deve ser positivo'],
    ['zero', '0', 'O valor da consulta deve ser positivo'],
    ['três casas decimais', '10.999', 'Use no máximo duas casas decimais'],
    ['acima do teto de numeric(10,2)', '1e9', 'Valor acima do máximo permitido (99.999.999,99)'],
  ])(
    '8. valor inválido (%s) é recusado PELA VALIDAÇÃO, com a causa na tela',
    async (_r, v, mensagem) => {
      const medicoId = await cenario('350.00');

      const res = await atualizarDadosMedico(formulario(medicoId, { valorConsulta: v }));

      expect(res.sucesso).toBe(false);
      expect(res.erro).toBe(mensagem);
      expect((await lerMedico(medicoId)).valorConsulta).toBe('350.00');
      expect(await db.select().from(schema.logsAuditoria)).toHaveLength(0);
    },
  );

  it('9. médico inexistente não vira sucesso nem linha de auditoria', async () => {
    await cenario();

    const res = await atualizarDadosMedico(formulario('00000000-0000-0000-0000-000000000000'));

    expect(res.sucesso).toBe(false);
    expect(res.erro).toBe('Médico não encontrado');
    expect(await db.select().from(schema.logsAuditoria)).toHaveLength(0);
  });

  it('10. quem não é admin não edita e não deixa rastro', async () => {
    const medicoId = await cenario('350.00');
    sessao.role = 'medico';

    const res = await atualizarDadosMedico(formulario(medicoId, { valorConsulta: '1.00' }));

    expect(res.sucesso).toBe(false);
    expect((await lerMedico(medicoId)).valorConsulta).toBe('350.00');
    expect(await db.select().from(schema.logsAuditoria)).toHaveLength(0);
  });
});
