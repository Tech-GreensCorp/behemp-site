/**
 * Cadastrar um paciente pela tela "Novo paciente" (admin e médico) — EXECUTADO contra Postgres real.
 *
 * 🔴 O defeito (20/10/2026): o formulário manda `''` em todo campo em branco e só exige nome e e-mail.
 * `criarPaciente` gravava o `''` cru: `dataNascimento: ''` e `dataAssociacao: ''` vão a colunas `date`,
 * e o Postgres responde `invalid input syntax for type date: ""` — a tela mostrava só "Erro ao criar
 * paciente". Reproduzido para os DOIS papéis: não é problema de role. Quem preenchia as duas datas
 * conseguia cadastrar; quem as deixava em branco, não — e como nada era criado, o paciente também
 * "não aparecia no começo da lista".
 *
 * ## O que ele prova
 *   1. admin e médico cadastram só com nome e e-mail (campos em branco viram NULL, não '')
 *   2. o paciente novo aparece em PRIMEIRO na lista do admin
 *   3. a única diferença entre os papéis é o vínculo: o do médico nasce com `medicoId`; o do admin
 *      nasce sem médico (cai na fila "Atribuir Médico")
 *   4. campo preenchido é gravado como veio; tratamento inválido segue recusado
 *
 * Rodar:
 *
 *   docker run -d --name behemp-pg-novo -e POSTGRES_PASSWORD=local -e POSTGRES_DB=behemp \
 *     -p 5544:5432 postgres:17-alpine
 *   DATABASE_URL=postgresql://postgres:local@localhost:5544/behemp npx drizzle-kit push --force
 *   DATABASE_URL=postgresql://postgres:local@localhost:5544/behemp \
 *     npx vitest run --config vitest.integracao.mts \
 *     __tests__/integracao/o-cadastro-de-paciente-aceita-campo-vazio.test.ts
 */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';

const sessao = { clerkId: null as string | null, role: 'admin' as string };
vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({
    userId: sessao.clerkId,
    sessionClaims: { metadata: { role: sessao.role } },
  }),
  currentUser: async () => ({
    id: sessao.clerkId,
    publicMetadata: { role: sessao.role },
    emailAddresses: [],
  }),
  clerkClient: async () => ({ users: {} }),
}));
vi.mock('next/cache', () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));

const { db } = await import('@/lib/db');
const schema = await import('@/db/schema');
const { criarPaciente } = await import('@/app/_actions/pacientes');
const { listarPacientesAdmin } = await import('@/app/_actions/admin-pacientes');

/** O que `novo/page.tsx` monta: todo campo é string, em branco = ''. */
const CAMPOS_EM_BRANCO = [
  'telefone',
  'dataNascimento',
  'cpf',
  'rg',
  'genero',
  'cep',
  'endereco',
  'cidade',
  'uf',
  'peso',
  'altura',
  'historicoMedico',
  'patologia',
  'atendimento',
  'temAdvogado',
  'nomeAdvogado',
  'cid',
  'categorizacao',
  'comoConheceu',
  'dataAssociacao',
  'entradaPaciente',
  'etapa',
  'hospitalProximo',
  'homeCare',
  'planoSaude',
  'possuiPlanoSaude',
  'rendaFamilia',
  'termoAssociado',
  'valorContribuicao',
  'processoJudicializacao',
  'responsavelNome',
  'responsavelCpf',
] as const;

const formulario = (extra: Record<string, unknown> = {}) =>
  ({
    nome: 'Paciente Novo',
    email: 'novo@teste.invalid',
    ...Object.fromEntries(CAMPOS_EM_BRANCO.map((c) => [c, ''])),
    tratamentoTipo: undefined, // a tela faz `tratamentoTipo || undefined`
    ...extra,
  }) as never;

const como = (clerkId: string, role: string) => {
  sessao.clerkId = clerkId;
  sessao.role = role;
};

async function limpar() {
  await db.delete(schema.logsAuditoria);
  await db.delete(schema.pacientes);
  await db.delete(schema.medicos);
  await db.delete(schema.users);
}

let medicoId = '';

beforeEach(async () => {
  await limpar();
  await db
    .insert(schema.users)
    .values({ clerkId: 'ck_adm', email: 'adm@teste.invalid', nome: 'Admin', role: 'admin' });
  const [u] = await db
    .insert(schema.users)
    .values({ clerkId: 'ck_med', email: 'med@teste.invalid', nome: 'Médico', role: 'medico' })
    .returning({ id: schema.users.id });
  const [m] = await db
    .insert(schema.medicos)
    .values({ userId: u.id, crm: 'CRM1', especialidade: 'Clínica' } as never)
    .returning({ id: schema.medicos.id });
  medicoId = m.id;
});
afterAll(limpar);

const lerPaciente = async (id: string) =>
  (await db.select().from(schema.pacientes).where(eq(schema.pacientes.id, id)))[0];

describe.each([
  ['admin', 'ck_adm'],
  ['medico', 'ck_med'],
] as const)('%s cadastra só com nome e e-mail', (papel, clerkId) => {
  it('cria o paciente, com os campos em branco como NULL (não como texto vazio)', async () => {
    como(clerkId, papel);
    const r = await criarPaciente(formulario());
    expect(r.sucesso).toBe(true);

    const p = await lerPaciente(r.dados!.pacienteId);
    expect(p.dataNascimento).toBeNull();
    expect(p.dataAssociacao).toBeNull();
    expect(p.cpf).toBeNull();
    expect(p.cidade).toBeNull();
    expect(p.historicoMedico).toBeNull();
    expect(p.tratamentoTipo).toBeNull();
    expect(p.status).toBe('aguardando_consulta');

    const [u] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, 'novo@teste.invalid'));
    expect(u.telefone).toBeNull();
    expect(u.role).toBe('paciente');
  });

  it('campo preenchido é gravado como veio, junto com os em branco', async () => {
    como(clerkId, papel);
    const r = await criarPaciente(
      formulario({ cidade: 'Recife', dataNascimento: '1990-05-01', tratamentoTipo: 'cbd' }),
    );
    expect(r.sucesso).toBe(true);
    const p = await lerPaciente(r.dados!.pacienteId);
    expect(p).toMatchObject({
      cidade: 'Recife',
      dataNascimento: '1990-05-01',
      tratamentoTipo: 'cbd',
    });
    expect(p.dataAssociacao).toBeNull();
  });
});

describe('o paciente novo aparece no começo da lista do admin', () => {
  it('o último cadastrado vem primeiro, venha de admin ou de médico', async () => {
    como('ck_med', 'medico');
    await criarPaciente(formulario({ nome: 'Primeiro', email: 'primeiro@teste.invalid' }));
    como('ck_adm', 'admin');
    await criarPaciente(formulario({ nome: 'Segundo', email: 'segundo@teste.invalid' }));
    const lista = await listarPacientesAdmin();
    expect(lista.sucesso).toBe(true);
    expect(lista.dados!.pacientes.map((p) => p.nome)).toEqual(['Segundo', 'Primeiro']);
  });
});

describe('a única diferença entre os papéis é o vínculo com o médico', () => {
  it('o paciente do médico nasce com o médico; o do admin nasce sem (fila "Atribuir Médico")', async () => {
    como('ck_med', 'medico');
    const doMedico = await criarPaciente(formulario({ email: 'a@teste.invalid' }));
    como('ck_adm', 'admin');
    const doAdmin = await criarPaciente(formulario({ email: 'b@teste.invalid' }));
    expect((await lerPaciente(doMedico.dados!.pacienteId)).medicoId).toBe(medicoId);
    expect((await lerPaciente(doAdmin.dados!.pacienteId)).medicoId).toBeNull();
  });
});

describe('o que continua recusado', () => {
  it('tratamento inválido, e quem não é médico nem admin', async () => {
    como('ck_adm', 'admin');
    expect((await criarPaciente(formulario({ tratamentoTipo: 'xyz' }))).sucesso).toBe(false);
    como('ck_pac', 'paciente');
    expect((await criarPaciente(formulario())).sucesso).toBe(false);
  });
});
