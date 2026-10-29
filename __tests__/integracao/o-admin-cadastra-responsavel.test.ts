/**
 * O ADMIN CADASTRA UM RESPONSÁVEL — EXECUTADO contra Postgres real, com o Clerk mockado (ADR-0033, 29/10/2026).
 *
 * ## O que ele prova
 *   1. só ADMIN cadastra: médico, paciente e responsável são recusados, e o Clerk nem é chamado
 *   2. o admin cria o login no Clerk já com `publicMetadata.role = 'responsavel'` (é de lá que o papel é lido), a
 *      linha em `users` com o papel `responsavel`, o CPF em `responsaveis`, e a auditoria com o e-mail MASCARADO
 *   3. o responsável nasce SEM ficha de paciente e SEM dependentes: o resolvedor não lhe entrega nada
 *   4. dado inválido (e-mail, senha fraca, CPF) e e-mail já existente são recusados SEM chamar o Clerk
 *   5. se o Clerk recusa, NADA é gravado; se o BANCO falha depois do login criado, o login é DESFEITO
 *   6. o papel não vem do cliente: um `role` mandado de fora é ignorado
 *
 * Rodar (banco descartável): ver `o-responsavel-age-so-por-vinculo-provado.test.ts`.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq, sql } from 'drizzle-orm';

const sessao = { clerkId: 'ck_adm' as string | null, role: 'admin' as string };

const createUser = vi.fn();
const deleteUser = vi.fn();

vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({
    userId: sessao.clerkId,
    sessionClaims: { metadata: { role: sessao.role } },
  }),
  currentUser: async () => ({ id: sessao.clerkId }),
  clerkClient: async () => ({ users: { createUser, deleteUser } }),
}));
vi.mock('next/cache', () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));

// O e-mail de boas-vindas é mockado: o teste nunca pode mandar e-mail de verdade.
const enviarBoasVindas = vi.fn();
vi.mock('@/lib/email/boas-vindas-do-responsavel', () => ({
  enviarBoasVindasDoResponsavel: (d: unknown) => enviarBoasVindas(d),
}));

const { db } = await import('@/lib/db');
const schema = await import('@/db/schema');
const { criarResponsavelAdmin } = await import('@/app/_actions/admin-responsaveis');
const { listarDependentesDoResponsavel, garantirResponsavelDoPaciente } = await import(
  '@/lib/auth/escopo-do-responsavel'
);

const SENHA = 'SenhaForte123';
const dados = (extra: Record<string, unknown> = {}) => ({
  nome: 'Maria Responsável',
  email: 'Maria.Resp@Teste.com',
  telefone: '(11) 99999-1234',
  cpf: '529.982.247-25',
  senha: SENHA,
  ...extra,
});

async function limpar() {
  const host = new URL(process.env.DATABASE_URL ?? 'postgresql://x@invalido/x').hostname;
  if (host !== 'localhost' && host !== '127.0.0.1') {
    throw new Error(`Este teste apaga dados e só roda em banco local (host: ${host}).`);
  }
  await db.execute(
    sql`TRUNCATE TABLE responsaveis_pacientes, responsaveis, logs_auditoria, pacientes, users CASCADE`,
  );
}

const contar = async (t: 'users' | 'responsaveis' | 'pacientes') => {
  const tabela = {
    users: schema.users,
    responsaveis: schema.responsaveis,
    pacientes: schema.pacientes,
  }[t];
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(tabela);
  return r.n;
};

beforeEach(async () => {
  await limpar();
  createUser.mockReset();
  deleteUser.mockReset();
  enviarBoasVindas.mockReset();
  enviarBoasVindas.mockResolvedValue(true);
  createUser.mockResolvedValue({ id: 'ck_novo' });
  deleteUser.mockResolvedValue({});
  sessao.clerkId = 'ck_adm';
  sessao.role = 'admin';
  await db
    .insert(schema.users)
    .values({ clerkId: 'ck_adm', email: 'adm@teste.invalid', nome: 'Admin', role: 'admin' });
});
afterAll(limpar);

describe('só o admin cadastra', () => {
  for (const papel of ['medico', 'paciente', 'responsavel']) {
    it(`${papel} é recusado, e o Clerk nem é chamado`, async () => {
      sessao.role = papel;
      const r = await criarResponsavelAdmin(dados());
      expect(r.sucesso).toBe(false);
      expect(createUser).not.toHaveBeenCalled();
      expect(await contar('users')).toBe(1); // só o admin do beforeEach
    });
  }

  it('sem sessão: recusado', async () => {
    sessao.clerkId = null;
    expect((await criarResponsavelAdmin(dados())).sucesso).toBe(false);
    expect(createUser).not.toHaveBeenCalled();
  });
});

describe('o admin cria o responsável', () => {
  it('login no Clerk com o papel, `users` com o papel, CPF em `responsaveis`, auditoria mascarada', async () => {
    const r = await criarResponsavelAdmin(dados());
    expect(r.sucesso, r.erro).toBe(true);

    // O Clerk recebe o papel no `publicMetadata` e o e-mail em minúsculas.
    expect(createUser).toHaveBeenCalledTimes(1);
    expect(createUser.mock.calls[0][0]).toMatchObject({
      emailAddress: ['maria.resp@teste.com'],
      password: SENHA,
      publicMetadata: { role: 'responsavel' },
    });

    const [u] = await db.select().from(schema.users).where(eq(schema.users.id, r.dados!.id));
    expect(u).toMatchObject({
      email: 'maria.resp@teste.com',
      nome: 'Maria Responsável',
      role: 'responsavel',
      clerkId: 'ck_novo',
      telefone: '(11) 99999-1234',
    });

    const [resp] = await db
      .select()
      .from(schema.responsaveis)
      .where(eq(schema.responsaveis.userId, u.id));
    expect(resp.cpf).toBe('52998224725');

    // A auditoria diz quem criou e leva o e-mail MASCARADO, nunca a senha nem o CPF.
    const [log] = await db
      .select()
      .from(schema.logsAuditoria)
      .where(eq(schema.logsAuditoria.entidadeId, u.id));
    const [adm] = await db.select().from(schema.users).where(eq(schema.users.clerkId, 'ck_adm'));
    expect(log.userId).toBe(adm.id);
    const depois = JSON.stringify(log.dadosDepois);
    expect(depois).toContain('ma***@teste.com');
    expect(depois).not.toContain('maria.resp');
    expect(depois).not.toContain(SENHA);
    expect(depois).not.toContain('52998224725');
  });

  it('o CPF é opcional', async () => {
    const r = await criarResponsavelAdmin(dados({ cpf: '', telefone: '' }));
    expect(r.sucesso, r.erro).toBe(true);
    expect(await contar('responsaveis')).toBe(0);
  });

  it('o responsável nasce SEM ficha de paciente e SEM dependentes: o resolvedor não entrega nada', async () => {
    const r = await criarResponsavelAdmin(dados());
    expect(r.sucesso).toBe(true);
    expect(await contar('pacientes')).toBe(0);

    // Entra como o novo responsável.
    sessao.clerkId = 'ck_novo';
    sessao.role = 'responsavel';
    expect(await listarDependentesDoResponsavel()).toEqual([]);
    expect(await garantirResponsavelDoPaciente('qualquer-id')).toEqual({
      ok: false,
      erro: 'Paciente não encontrado',
    });
  });

  it('o papel NÃO vem do cliente: um `role` mandado de fora é ignorado', async () => {
    const r = await criarResponsavelAdmin(dados({ role: 'admin', papel: 'admin' }));
    expect(r.sucesso, r.erro).toBe(true);
    expect(createUser.mock.calls[0][0].publicMetadata).toEqual({ role: 'responsavel' });
    const [u] = await db.select().from(schema.users).where(eq(schema.users.id, r.dados!.id));
    expect(u.role).toBe('responsavel');
  });
});

describe('recusas ANTES de falar com o Clerk', () => {
  const casos: Array<[string, Record<string, unknown>]> = [
    ['e-mail inválido', { email: 'nao-e-email' }],
    ['senha curta', { senha: 'Ab1' }],
    ['senha sem maiúscula', { senha: 'senhaforte123' }],
    ['senha sem número', { senha: 'SenhaForteSemNumero' }],
    ['CPF inválido', { cpf: '111.111.111-11' }],
    ['telefone inválido', { telefone: 'abc' }],
    ['nome curto', { nome: 'A' }],
  ];
  for (const [nome, extra] of casos) {
    it(nome, async () => {
      const r = await criarResponsavelAdmin(dados(extra));
      expect(r.sucesso).toBe(false);
      expect(createUser).not.toHaveBeenCalled();
      expect(await contar('users')).toBe(1);
    });
  }

  it('e-mail que já existe (sem diferenciar maiúsculas)', async () => {
    await db
      .insert(schema.users)
      .values({ email: 'maria.resp@teste.com', nome: 'Já existe', role: 'paciente' });
    const r = await criarResponsavelAdmin(dados());
    expect(r).toEqual({ sucesso: false, erro: 'Já existe um usuário com este e-mail.' });
    expect(createUser).not.toHaveBeenCalled();
  });
});

describe('quando algo falha, nada fica pela metade', () => {
  it('o Clerk recusa a senha: nada é gravado, e o admin lê um motivo claro', async () => {
    createUser.mockRejectedValue({ errors: [{ code: 'form_password_pwned' }] });
    const r = await criarResponsavelAdmin(dados());
    expect(r.sucesso).toBe(false);
    expect(r.erro).toMatch(/vazamentos/);
    expect(await contar('users')).toBe(1);
    expect(await contar('responsaveis')).toBe(0);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('🔴 o BANCO falha depois do login criado: o login é DESFEITO (sem conta órfã no Clerk)', async () => {
    // Uma linha APAGADA com o mesmo e-mail: o índice único ainda barra o insert, e nenhuma linha ativa a recebe.
    await db.insert(schema.users).values({
      email: 'maria.resp@teste.com',
      nome: 'Apagada',
      role: 'paciente',
      deletedAt: new Date(),
    });
    const r = await criarResponsavelAdmin(dados());
    expect(r.sucesso).toBe(false);
    expect(r.erro).toBe('Não foi possível concluir o cadastro. Nada foi criado.');
    expect(createUser).toHaveBeenCalledTimes(1);
    expect(deleteUser).toHaveBeenCalledWith('ck_novo');
    expect(await contar('responsaveis')).toBe(0);
  });
});

describe('o e-mail de boas-vindas', () => {
  it('sai para o endereço cadastrado (minúsculo), sem a senha, e o resultado diz que saiu', async () => {
    const r = await criarResponsavelAdmin(dados());
    expect(r.sucesso, r.erro).toBe(true);
    expect(r.dados?.emailEnviado).toBe(true);

    expect(enviarBoasVindas).toHaveBeenCalledTimes(1);
    const enviado = enviarBoasVindas.mock.calls[0][0] as Record<string, unknown>;
    expect(enviado).toEqual({ email: 'maria.resp@teste.com', nome: 'Maria Responsável' });
    expect(JSON.stringify(enviado)).not.toContain(SENHA);
  });

  it('se o e-mail não sai, o responsável continua criado e o admin é avisado (emailEnviado = false)', async () => {
    enviarBoasVindas.mockResolvedValue(false);
    const r = await criarResponsavelAdmin(dados());
    expect(r.sucesso, r.erro).toBe(true);
    expect(r.dados?.emailEnviado).toBe(false);
    expect(await contar('users')).toBe(2); // admin + responsável
  });

  it('dado inválido, e-mail repetido, não-admin e erro do Clerk: nenhum e-mail sai', async () => {
    await criarResponsavelAdmin(dados({ senha: 'fraca' }));
    createUser.mockRejectedValueOnce({ errors: [{ code: 'form_password_pwned' }] });
    await criarResponsavelAdmin(dados());
    sessao.role = 'paciente';
    await criarResponsavelAdmin(dados({ email: 'outro@teste.com' }));
    expect(enviarBoasVindas).not.toHaveBeenCalled();
  });
});
