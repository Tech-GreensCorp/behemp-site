/**
 * A LISTA DE USUÁRIOS DO ADMIN CONHECE O RESPONSÁVEL — EXECUTADO contra Postgres real (ADR-0033 D-04 e D-16, 29/10/2026).
 *
 * ## O que ele prova
 *   1. o filtro `responsavel` devolve só responsáveis, e a contagem por papel traz `responsaveis`
 *   2. o `users` TÉCNICO do dependente (`@dependente.invalid`, sem login) NÃO aparece na lista, na busca nem em nenhuma
 *      contagem: ele é um paciente, e mora em Pacientes
 *   3. `excluirUsuarioAdmin` RECUSA apagar quem tem dependente com vínculo ATIVO, e não chama o Clerk nem altera nada
 *   4. depois que o vínculo é ENCERRADO, o responsável pode ser apagado (a recusa não é eterna)
 *   5. quem não é admin não lista nem apaga
 *   6. controle limpo: um paciente comum e um admin continuam aparecendo e continuam podendo ser apagados
 *   7. a lista de PACIENTES do admin marca quem tem responsável (flag) e esconde o e-mail técnico do dependente
 *   8. a lista de RESPONSÁVEIS traz os dependentes de cada um, com o CPF mascarado, e só o admin a lê
 *   9. "Minha área de paciente" depende de ter FICHA de paciente, não do papel
 *
 * Rodar (banco descartável): ver `o-responsavel-age-so-por-vinculo-provado.test.ts`.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq, sql } from 'drizzle-orm';

const sessao = { clerkId: 'ck_adm' as string | null, role: 'admin' as string };
const deleteUser = vi.fn();

vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({
    userId: sessao.clerkId,
    sessionClaims: { metadata: { role: sessao.role } },
  }),
  currentUser: async () => ({ id: sessao.clerkId }),
  clerkClient: async () => ({ users: { deleteUser } }),
}));
vi.mock('next/cache', () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));

const { db } = await import('@/lib/db');
const schema = await import('@/db/schema');
const { cadastrarDependente } = await import('@/app/_actions/dependentes');
const { listarUsuariosAdmin, excluirUsuarioAdmin } = await import(
  '@/app/(admin)/_actions/usuarios'
);

const { listarPacientesAdmin } = await import('@/app/_actions/admin-pacientes');
const { listarResponsaveisAdmin } = await import('@/app/_actions/admin-responsaveis');
const { temFichaDePaciente } = await import('@/lib/auth/escopo-do-responsavel');

const CPF = '529.982.247-25';

async function limpar() {
  const host = new URL(process.env.DATABASE_URL ?? 'postgresql://x@invalido/x').hostname;
  if (host !== 'localhost' && host !== '127.0.0.1') {
    throw new Error(`Este teste apaga dados e só roda em banco local (host: ${host}).`);
  }
  await db.execute(
    sql`TRUNCATE TABLE responsaveis_pacientes, responsaveis, logs_auditoria, pacientes, users CASCADE`,
  );
}

async function criarUsuario(
  chave: string,
  role: 'responsavel' | 'paciente' | 'medico' | 'admin',
): Promise<string> {
  const [u] = await db
    .insert(schema.users)
    .values({
      clerkId: `ck_${chave}`,
      email: `${chave}@teste.invalid`,
      nome: `Usuário ${chave}`,
      role,
    })
    .returning({ id: schema.users.id });
  return u.id;
}

const entrarComo = (chave: string, role: string) => {
  sessao.clerkId = `ck_${chave}`;
  sessao.role = role;
};

/** O responsável `resp` cadastra um dependente (cria o `users` técnico e o vínculo ativo). */
async function comDependente(): Promise<{ responsavelId: string; pacienteId: string }> {
  const responsavelId = await criarUsuario('resp', 'responsavel');
  entrarComo('resp', 'responsavel');
  const r = await cadastrarDependente({
    nome: 'Filho Técnico',
    dataNascimento: '2016-04-10',
    parentesco: 'Mãe',
    cpfDoResponsavel: CPF,
  });
  expect(r.sucesso, r.erro).toBe(true);
  entrarComo('adm', 'admin');
  return { responsavelId, pacienteId: r.dados!.pacienteId };
}

beforeEach(async () => {
  await limpar();
  deleteUser.mockReset();
  deleteUser.mockResolvedValue({});
  await criarUsuario('adm', 'admin');
  entrarComo('adm', 'admin');
});
afterAll(limpar);

describe('a lista conhece o responsável', () => {
  it('o filtro `responsavel` devolve só responsáveis e a contagem traz `responsaveis`', async () => {
    await comDependente();
    await criarUsuario('pac', 'paciente');

    const r = await listarUsuariosAdmin({ role: 'responsavel' });
    expect(r.sucesso, r.erro).toBe(true);
    expect(r.dados!.usuarios.map((u) => u.role)).toEqual(['responsavel']);
    expect(r.dados!.porRole.responsaveis).toBe(1);
  });

  it('controle: o paciente e o admin continuam na lista sem filtro', async () => {
    await comDependente();
    await criarUsuario('pac', 'paciente');

    const r = await listarUsuariosAdmin();
    expect(r.sucesso, r.erro).toBe(true);
    const papeis = r.dados!.usuarios.map((u) => u.role).sort();
    expect(papeis).toEqual(['admin', 'paciente', 'responsavel']);
    expect(r.dados!.porRole).toMatchObject({ admins: 1, pacientes: 1, responsaveis: 1 });
  });
});

describe('o `users` técnico do dependente não é usuário da plataforma', () => {
  it('não aparece na lista, na busca nem em contagem nenhuma', async () => {
    const { pacienteId } = await comDependente();

    // Prova que o técnico EXISTE no banco (senão a ausência não prova nada).
    const [tec] = await db
      .select({ email: schema.users.email, role: schema.users.role })
      .from(schema.pacientes)
      .innerJoin(schema.users, eq(schema.users.id, schema.pacientes.userId))
      .where(eq(schema.pacientes.id, pacienteId));
    expect(tec.email).toMatch(/@dependente\.invalid$/);

    const lista = await listarUsuariosAdmin();
    expect(lista.dados!.usuarios.some((u) => u.email.endsWith('@dependente.invalid'))).toBe(false);
    expect(lista.dados!.total).toBe(2); // admin + responsável
    const { admins, medicos, pacientes, responsaveis } = lista.dados!.porRole;
    expect(admins + medicos + pacientes + responsaveis).toBe(2);

    const busca = await listarUsuariosAdmin({ busca: 'dependente' });
    expect(busca.dados!.usuarios).toHaveLength(0);

    const porPapel = await listarUsuariosAdmin({ role: tec.role });
    expect(porPapel.dados!.usuarios.some((u) => u.email.endsWith('@dependente.invalid'))).toBe(
      false,
    );
  });
});

describe('o admin não apaga responsável com dependente ativo', () => {
  it('recusa, não chama o Clerk e não altera nada', async () => {
    const { responsavelId } = await comDependente();

    const r = await excluirUsuarioAdmin(responsavelId);
    expect(r.sucesso).toBe(false);
    expect(r.erro).toMatch(/dependente/i);
    expect(deleteUser).not.toHaveBeenCalled();

    const [u] = await db
      .select({ deletedAt: schema.users.deletedAt })
      .from(schema.users)
      .where(eq(schema.users.id, responsavelId));
    expect(u.deletedAt).toBeNull();
  });

  it('com o vínculo ENCERRADO, o responsável pode ser apagado', async () => {
    const { responsavelId, pacienteId } = await comDependente();
    await db
      .update(schema.responsaveisPacientes)
      .set({ status: 'encerrado', encerradoEm: new Date(), motivo: 'teste' })
      .where(eq(schema.responsaveisPacientes.pacienteId, pacienteId));

    const r = await excluirUsuarioAdmin(responsavelId);
    expect(r.sucesso, r.erro).toBe(true);
    expect(deleteUser).toHaveBeenCalledTimes(1);
  });

  it('o vínculo de OUTRO responsável não impede apagar quem não tem dependente', async () => {
    await comDependente(); // `resp` tem um dependente ativo
    const outro = await criarUsuario('outro', 'responsavel');

    const r = await excluirUsuarioAdmin(outro);
    expect(r.sucesso, r.erro).toBe(true);
  });

  it('controle: um paciente comum, sem vínculo, é apagado normalmente', async () => {
    const pac = await criarUsuario('pac', 'paciente');
    const r = await excluirUsuarioAdmin(pac);
    expect(r.sucesso, r.erro).toBe(true);
  });

  it('um paciente que também é responsável (vínculo ativo) também é recusado', async () => {
    const { responsavelId } = await comDependente();
    await db
      .update(schema.users)
      .set({ role: 'paciente' })
      .where(eq(schema.users.id, responsavelId));

    const r = await excluirUsuarioAdmin(responsavelId);
    expect(r.sucesso).toBe(false);
    expect(deleteUser).not.toHaveBeenCalled();
  });
});

describe('só o admin lista e apaga', () => {
  for (const papel of ['medico', 'paciente', 'responsavel']) {
    it(`${papel} é recusado`, async () => {
      const { responsavelId } = await comDependente();
      entrarComo('resp', papel);
      expect((await listarUsuariosAdmin()).sucesso).toBe(false);
      expect((await excluirUsuarioAdmin(responsavelId)).sucesso).toBe(false);
      expect(deleteUser).not.toHaveBeenCalled();
    });
  }
});

describe('a lista de pacientes marca quem tem responsável', () => {
  it('o dependente traz o nome do responsável e e-mail nulo; o paciente comum, o contrário', async () => {
    await comDependente();
    const pac = await criarUsuario('pac', 'paciente');
    await db.insert(schema.pacientes).values({ userId: pac, status: 'aguardando_consulta' });

    const r = await listarPacientesAdmin();
    expect(r.sucesso, r.erro).toBe(true);
    const dep = r.dados!.pacientes.find((p) => p.nome === 'Filho Técnico');
    const comum = r.dados!.pacientes.find((p) => p.nome === 'Usuário pac');
    expect(dep?.responsavelNome).toBe('Usuário resp');
    expect(dep?.email).toBeNull();
    expect(comum?.responsavelNome).toBeNull();
    expect(comum?.email).toBe('pac@teste.invalid');
  });

  it('vínculo ENCERRADO: a flag some, o paciente continua listado', async () => {
    const { pacienteId } = await comDependente();
    await db
      .update(schema.responsaveisPacientes)
      .set({ status: 'encerrado', encerradoEm: new Date(), motivo: 'teste' })
      .where(eq(schema.responsaveisPacientes.pacienteId, pacienteId));

    const r = await listarPacientesAdmin();
    const dep = r.dados!.pacientes.find((p) => p.id === pacienteId);
    expect(dep).toBeDefined();
    expect(dep?.responsavelNome).toBeNull();
  });
});

describe('a lista de responsáveis do admin', () => {
  it('traz o responsável com os dependentes, o CPF mascarado, e nunca o técnico', async () => {
    await comDependente();
    await criarUsuario('pac', 'paciente');

    const r = await listarResponsaveisAdmin();
    expect(r.sucesso, r.erro).toBe(true);
    expect(r.dados!.total).toBe(1);
    const [resp] = r.dados!.responsaveis;
    expect(resp.nome).toBe('Usuário resp');
    expect(resp.dependentes).toEqual([
      { pacienteId: expect.any(String), nome: 'Filho Técnico', parentesco: 'Mãe' },
    ]);
    expect(resp.cpfMascarado).toBe('529.***.***-25');
    expect(JSON.stringify(r.dados)).not.toContain('529.982.247-25');
    expect(JSON.stringify(r.dados)).not.toContain('dependente.invalid');
  });

  it('defesa em profundidade: um `users` técnico nunca é listado, mesmo com papel de responsável', async () => {
    await db.insert(schema.users).values({
      email: 'dependente-xyz@dependente.invalid',
      nome: 'Técnico Solto',
      role: 'responsavel',
    });
    await criarUsuario('real', 'responsavel');

    const r = await listarResponsaveisAdmin();
    expect(r.dados!.responsaveis.map((x) => x.nome)).toEqual(['Usuário real']);
  });

  it('um paciente que também cuida de alguém aparece; um paciente comum não', async () => {
    const { responsavelId } = await comDependente();
    await db
      .update(schema.users)
      .set({ role: 'paciente' })
      .where(eq(schema.users.id, responsavelId));
    await criarUsuario('pac', 'paciente');

    const r = await listarResponsaveisAdmin();
    expect(r.dados!.responsaveis.map((x) => x.nome)).toEqual(['Usuário resp']);
    expect(r.dados!.responsaveis[0].papel).toBe('paciente');
  });

  it('responsável sem dependentes aparece com lista vazia; a busca filtra', async () => {
    await criarUsuario('sozinho', 'responsavel');
    await comDependente();

    const todos = await listarResponsaveisAdmin();
    expect(todos.dados!.total).toBe(2);
    expect(
      todos.dados!.responsaveis.find((x) => x.nome === 'Usuário sozinho')?.dependentes,
    ).toEqual([]);

    const busca = await listarResponsaveisAdmin({ busca: 'sozinho' });
    expect(busca.dados!.responsaveis.map((x) => x.nome)).toEqual(['Usuário sozinho']);
  });

  it('vínculo encerrado: o dependente sai da linha do responsável', async () => {
    const { pacienteId } = await comDependente();
    await db
      .update(schema.responsaveisPacientes)
      .set({ status: 'encerrado', encerradoEm: new Date(), motivo: 'teste' })
      .where(eq(schema.responsaveisPacientes.pacienteId, pacienteId));

    const r = await listarResponsaveisAdmin();
    expect(r.dados!.responsaveis[0].dependentes).toEqual([]);
  });

  for (const papel of ['medico', 'paciente', 'responsavel']) {
    it(`${papel} é recusado`, async () => {
      await comDependente();
      entrarComo('resp', papel);
      expect((await listarResponsaveisAdmin()).sucesso).toBe(false);
    });
  }
});

describe('"Minha área de paciente" depende de ficha, não de papel', () => {
  it('responsável puro: sem ficha; paciente com ficha: com ficha; paciente sem ficha: sem', async () => {
    const resp = await criarUsuario('resp', 'responsavel');
    const pac = await criarUsuario('pac', 'paciente');
    const semFicha = await criarUsuario('semficha', 'paciente');
    await db.insert(schema.pacientes).values({ userId: pac, status: 'aguardando_consulta' });

    expect(await temFichaDePaciente(resp)).toBe(false);
    expect(await temFichaDePaciente(pac)).toBe(true);
    expect(await temFichaDePaciente(semFicha)).toBe(false);
  });

  it('ficha arquivada (soft delete) não conta', async () => {
    const pac = await criarUsuario('pac', 'paciente');
    await db
      .insert(schema.pacientes)
      .values({ userId: pac, status: 'arquivado', deletedAt: new Date() });
    expect(await temFichaDePaciente(pac)).toBe(false);
  });
});
