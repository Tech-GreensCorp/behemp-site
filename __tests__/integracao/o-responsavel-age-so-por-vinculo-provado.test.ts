/**
 * O RESPONSÁVEL AGE SÓ POR VÍNCULO PROVADO — EXECUTADO contra Postgres real (ADR-0033 D-03, D-09).
 *
 * ## A REGRA DE 28/10/2026 (Dryelle), que REVOGOU a P-01 e a P-02 da ADR-0033
 *   · o dependente pode ter QUALQUER idade, inclusive maior de 18 anos (antes: só menor de idade)
 *   · quem faz o próprio tratamento (`paciente`) TAMBÉM pode ser responsável (antes: um papel só)
 *   · o responsável pode ter MAIS DE 2 dependentes (não há limite)
 *
 * ## O que ele prova
 *   1. o responsável cria o dependente e o vínculo NUMA transação: um `users` técnico (sem `clerkId`, e-mail
 *      `@dependente.invalid`), a ficha com a data de nascimento, o vínculo `ativo` e o CPF dele
 *   2. a auditoria registra quem agiu e em nome de quem, **sem nome, CPF nem data de nascimento**
 *   3. o resolvedor entrega o dependente a quem tem vínculo `ativo`, e **responde IGUAL (404 indistinto)** para
 *      "não existe", "não é seu" e "o vínculo encerrou" — um responsável SEM vínculo é o controle limpo
 *   4. quem não é `responsavel` (paciente adulto) é recusado, mesmo com sessão válida
 *   5. a action NUNCA liga um paciente que já existe: um `pacienteId` mandado de fora é ignorado
 *   6. o índice único do banco impede DOIS responsáveis ativos para o mesmo paciente (P-07), e libera depois
 *      que o admin encerra
 *   7. dado inválido (CPF inválido, data futura ou absurda, CPF diferente do cadastrado) é recusado e
 *      NADA é gravado (a transação desfaz)
 *
 * Rodar (banco descartável, nunca o de desenvolvimento):
 *
 *   docker start behemp-pg
 *   DATABASE_URL=postgresql://postgres:local@localhost:5544/behemp npx drizzle-kit push --force
 *   DATABASE_URL=postgresql://postgres:local@localhost:5544/behemp \
 *     npx vitest run --config vitest.integracao.mts \
 *     __tests__/integracao/o-responsavel-age-so-por-vinculo-provado.test.ts
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';

const sessao = { clerkId: null as string | null, role: 'responsavel' as string };

vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({
    userId: sessao.clerkId,
    sessionClaims: { metadata: { role: sessao.role } },
  }),
  currentUser: async () => ({ id: sessao.clerkId }),
  clerkClient: async () => ({ users: {} }),
}));
vi.mock('next/cache', () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));

const { db } = await import('@/lib/db');
const schema = await import('@/db/schema');
const { cadastrarDependente } = await import('@/app/_actions/dependentes');
const { garantirResponsavelDoPaciente, listarDependentesDoResponsavel } = await import(
  '@/lib/auth/escopo-do-responsavel'
);

const CPF_A = '529.982.247-25';
const CPF_OUTRO = '111.444.777-35';

/** Menor: nasceu há 5 anos. Gerada a partir de hoje, para o teste não envelhecer. */
function dataDeNascimentoDeMenor(): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - 5);
  return d.toISOString().slice(0, 10);
}

const dependenteValido = (extra: Record<string, unknown> = {}) => ({
  nome: 'Criança Teste',
  dataNascimento: dataDeNascimentoDeMenor(),
  parentesco: 'Mãe',
  cpfDoResponsavel: CPF_A,
  ...extra,
});

/** 🔴 TRUNCATE ... CASCADE: por isso o teste RECUSA rodar contra qualquer banco que não seja local. */
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

async function criarPacienteAdulto(chave: string): Promise<{ userId: string; pacienteId: string }> {
  const userId = await criarUsuario(chave, 'paciente');
  const [p] = await db
    .insert(schema.pacientes)
    .values({ userId, status: 'aguardando_consulta', jornadaFase: 'acolhimento' })
    .returning({ id: schema.pacientes.id });
  return { userId, pacienteId: p.id };
}

const entrarComo = (chave: string, role = 'responsavel') => {
  sessao.clerkId = `ck_${chave}`;
  sessao.role = role;
};

const contar = async (tabela: 'users' | 'pacientes' | 'vinculos' | 'responsaveis') => {
  const t = {
    users: schema.users,
    pacientes: schema.pacientes,
    vinculos: schema.responsaveisPacientes,
    responsaveis: schema.responsaveis,
  }[tabela];
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(t);
  return r.n;
};

let respA: string;
let respB: string;

beforeEach(async () => {
  await limpar();
  respA = await criarUsuario('respA', 'responsavel');
  respB = await criarUsuario('respB', 'responsavel');
  entrarComo('respA');
});
afterAll(limpar);

describe('o responsável cria o dependente e o vínculo numa transação', () => {
  it('grava o users técnico, a ficha, o vínculo ativo e o CPF do responsável', async () => {
    const r = await cadastrarDependente(dependenteValido());
    expect(r.sucesso, r.erro).toBe(true);

    const [v] = await db.select().from(schema.responsaveisPacientes);
    expect(v.responsavelUserId).toBe(respA);
    expect(v.status).toBe('ativo');
    expect(v.parentesco).toBe('Mãe');

    const [ficha] = await db
      .select()
      .from(schema.pacientes)
      .where(eq(schema.pacientes.id, v.pacienteId));
    expect(ficha.dataNascimento).toBe(dataDeNascimentoDeMenor());

    // O users do dependente: sem credencial, com o e-mail que NÃO existe (D-04).
    const [tecnico] = await db.select().from(schema.users).where(eq(schema.users.id, ficha.userId));
    expect(tecnico.clerkId).toBeNull();
    expect(tecnico.role).toBe('paciente');
    expect(tecnico.email).toMatch(/^dependente-[a-z0-9]+@dependente\.invalid$/);
    expect(tecnico.nome).toBe('Criança Teste');

    // O CPF fica só com dígitos, no responsável (P-16).
    const [resp] = await db.select().from(schema.responsaveis);
    expect(resp.userId).toBe(respA);
    expect(resp.cpf).toBe('52998224725');
  });

  it('a auditoria diz quem agiu e por quem, SEM nome, CPF nem data de nascimento', async () => {
    await cadastrarDependente(dependenteValido());
    const [log] = await db.select().from(schema.logsAuditoria);
    expect(log.userId).toBe(respA);
    expect(log.acao).toBe('criar');
    const depois = JSON.stringify(log.dadosDepois);
    expect(depois).toContain('"atuandoComo":"responsavel"');
    expect(depois).not.toContain('Criança Teste');
    expect(depois).not.toContain('52998224725');
    expect(depois).not.toContain(dataDeNascimentoDeMenor());
  });

  it('o mesmo responsável cadastra o segundo filho, com o mesmo CPF', async () => {
    expect((await cadastrarDependente(dependenteValido({ nome: 'Filho Um' }))).sucesso).toBe(true);
    expect((await cadastrarDependente(dependenteValido({ nome: 'Filho Dois' }))).sucesso).toBe(
      true,
    );
    const lista = await listarDependentesDoResponsavel();
    expect(lista.map((d) => d.nome)).toEqual(['Filho Dois', 'Filho Um']);
    expect(await contar('responsaveis')).toBe(1); // um responsável, dois dependentes
  });
});

describe('a regra de 28/10/2026: quem pode ser dependente e quem pode ser responsável', () => {
  it('o dependente pode ser MAIOR de idade', async () => {
    const r = await cadastrarDependente(
      dependenteValido({ nome: 'Dependente Adulto', dataNascimento: '1950-06-15' }),
    );
    expect(r.sucesso, r.erro).toBe(true);
    const [ficha] = await db
      .select()
      .from(schema.pacientes)
      .where(eq(schema.pacientes.id, r.dados!.pacienteId));
    expect(ficha.dataNascimento).toBe('1950-06-15');
    expect((await garantirResponsavelDoPaciente(r.dados!.pacienteId)).ok).toBe(true);
  });

  it('o responsável pode ter MAIS DE 2 dependentes, de idades diferentes', async () => {
    const nomes = ['Ana', 'Bruno', 'Carla', 'Davi'];
    const idades = ['2021-03-10', '2012-08-01', '1995-12-25', '1948-01-30'];
    for (let i = 0; i < nomes.length; i++) {
      const r = await cadastrarDependente(
        dependenteValido({ nome: nomes[i], dataNascimento: idades[i] }),
      );
      expect(r.sucesso, r.erro).toBe(true);
    }
    const lista = await listarDependentesDoResponsavel();
    expect(lista.map((d) => d.nome)).toEqual(['Ana', 'Bruno', 'Carla', 'Davi']);
    expect(await contar('vinculos')).toBe(4);
    expect(await contar('responsaveis')).toBe(1); // um responsável, quatro dependentes
  });

  it('🔴 um PACIENTE que faz o próprio tratamento também é responsável, e o papel não abre dependente alheio', async () => {
    const mae = await criarPacienteAdulto('mae');
    entrarComo('mae', 'paciente');
    const meu = await cadastrarDependente(dependenteValido({ nome: 'Filho da Paciente' }));
    expect(meu.sucesso, meu.erro).toBe(true);

    // Ele enxerga o dependente DELE.
    expect((await garantirResponsavelDoPaciente(meu.dados!.pacienteId)).ok).toBe(true);
    expect((await listarDependentesDoResponsavel()).map((d) => d.nome)).toEqual([
      'Filho da Paciente',
    ]);

    // Mas ser `paciente` NÃO abre o dependente de OUTRO responsável: o que prova é o vínculo.
    entrarComo('respA');
    const alheio = await cadastrarDependente(dependenteValido({ nome: 'Filho da Resp A' }));
    entrarComo('mae', 'paciente');
    expect(await garantirResponsavelDoPaciente(alheio.dados!.pacienteId)).toEqual({
      ok: false,
      erro: 'Paciente não encontrado',
    });

    // E a ficha dela como paciente segue intacta: nenhum vínculo aponta para ela.
    const dela = await db
      .select()
      .from(schema.responsaveisPacientes)
      .where(eq(schema.responsaveisPacientes.pacienteId, mae.pacienteId));
    expect(dela).toEqual([]);
  });
});

describe('o resolvedor prova o vínculo, e responde IGUAL quando não prova', () => {
  it('entrega o dependente ao responsável dele', async () => {
    const r = await cadastrarDependente(dependenteValido());
    const g = await garantirResponsavelDoPaciente(r.dados!.pacienteId);
    expect(g.ok).toBe(true);
    if (g.ok) {
      expect(g.escopo.responsavelUserId).toBe(respA);
      expect(g.escopo.pacienteId).toBe(r.dados!.pacienteId);
    }
  });

  it('🔴 CONTROLE LIMPO: um responsável SEM vínculo recebe 404, igual ao id que não existe', async () => {
    const r = await cadastrarDependente(dependenteValido());
    entrarComo('respB'); // outro responsável, sem vínculo com este paciente
    const alheio = await garantirResponsavelDoPaciente(r.dados!.pacienteId);
    const inexistente = await garantirResponsavelDoPaciente('id-que-nao-existe');
    expect(alheio).toEqual({ ok: false, erro: 'Paciente não encontrado' });
    expect(inexistente).toEqual(alheio); // oráculo de enumeração: as duas respostas são idênticas
  });

  it('o vínculo encerrado não abre acesso, e responde IGUAL', async () => {
    const r = await cadastrarDependente(dependenteValido());
    await db
      .update(schema.responsaveisPacientes)
      .set({ status: 'encerrado', encerradoEm: new Date(), motivo: 'teste' })
      .where(eq(schema.responsaveisPacientes.pacienteId, r.dados!.pacienteId));
    expect(await garantirResponsavelDoPaciente(r.dados!.pacienteId)).toEqual({
      ok: false,
      erro: 'Paciente não encontrado',
    });
    expect(await listarDependentesDoResponsavel()).toEqual([]);
  });

  it('médico e admin são recusados, mesmo com a sessão afirmando `responsavel` (papel lido do banco)', async () => {
    const r = await cadastrarDependente(dependenteValido());
    await criarUsuario('med', 'medico');
    await criarUsuario('adm', 'admin');
    for (const chave of ['med', 'adm']) {
      // A sessão AFIRMA `responsavel`, mas o banco diz outra coisa: o que vale é o banco.
      entrarComo(chave, 'responsavel');
      expect(await garantirResponsavelDoPaciente(r.dados!.pacienteId)).toEqual({
        ok: false,
        erro: 'Paciente não encontrado',
      });
      expect(await listarDependentesDoResponsavel()).toEqual([]);
      expect(await cadastrarDependente(dependenteValido())).toEqual({
        sucesso: false,
        erro: 'Acesso negado.',
      });
    }
  });
  it('sem sessão: recusado', async () => {
    sessao.clerkId = null;
    expect(await cadastrarDependente(dependenteValido())).toEqual({
      sucesso: false,
      erro: 'Acesso negado.',
    });
    expect(await contar('vinculos')).toBe(0);
  });
});

describe('a action NUNCA liga um paciente que já existe', () => {
  it('um `pacienteId` mandado de fora é ignorado: o paciente alheio segue sem vínculo', async () => {
    const adulto = await criarPacienteAdulto('alvo');
    const r = await cadastrarDependente(
      dependenteValido({ pacienteId: adulto.pacienteId, paciente_id: adulto.pacienteId }),
    );
    expect(r.sucesso).toBe(true);
    expect(r.dados!.pacienteId).not.toBe(adulto.pacienteId);

    const doAdulto = await db
      .select()
      .from(schema.responsaveisPacientes)
      .where(eq(schema.responsaveisPacientes.pacienteId, adulto.pacienteId));
    expect(doAdulto).toEqual([]);
  });
});

describe('um só responsável ativo por paciente (índice único do banco, P-07)', () => {
  it('um segundo vínculo ativo para o mesmo paciente é recusado pelo banco', async () => {
    const r = await cadastrarDependente(dependenteValido());
    await expect(
      db.insert(schema.responsaveisPacientes).values({
        responsavelUserId: respB,
        pacienteId: r.dados!.pacienteId,
        parentesco: 'Pai',
      }),
    ).rejects.toThrow();
    expect(await contar('vinculos')).toBe(1);
  });

  it('depois que o admin encerra, outro responsável pode assumir', async () => {
    const r = await cadastrarDependente(dependenteValido());
    await db
      .update(schema.responsaveisPacientes)
      .set({ status: 'encerrado', encerradoEm: new Date(), motivo: 'teste' })
      .where(eq(schema.responsaveisPacientes.pacienteId, r.dados!.pacienteId));
    await db.insert(schema.responsaveisPacientes).values({
      responsavelUserId: respB,
      pacienteId: r.dados!.pacienteId,
      parentesco: 'Pai',
    });
    const ativos = await db
      .select()
      .from(schema.responsaveisPacientes)
      .where(
        and(
          eq(schema.responsaveisPacientes.pacienteId, r.dados!.pacienteId),
          eq(schema.responsaveisPacientes.status, 'ativo'),
        ),
      );
    expect(ativos).toHaveLength(1);
    expect(ativos[0].responsavelUserId).toBe(respB);
    // E a linha antiga CONTINUA lá, encerrada: nada se apaga (proibição 4 do CLAUDE.md).
    expect(await contar('vinculos')).toBe(2);
  });
});

describe('dado inválido é recusado e NADA é gravado', () => {
  async function nadaGravado() {
    expect(await contar('vinculos')).toBe(0);
    expect(await contar('pacientes')).toBe(0);
    expect(await contar('responsaveis')).toBe(0);
    // Só os dois responsáveis do `beforeEach`: nenhum users técnico sobrou.
    expect(await contar('users')).toBe(2);
  }

  it('data absurda, anterior a 1900', async () => {
    const r = await cadastrarDependente(dependenteValido({ dataNascimento: '1850-01-01' }));
    expect(r.sucesso).toBe(false);
    expect(r.erro).toMatch(/data de nascimento válida/);
    await nadaGravado();
  });
  it('data no futuro', async () => {
    const r = await cadastrarDependente(dependenteValido({ dataNascimento: '2999-01-01' }));
    expect(r.sucesso).toBe(false);
    await nadaGravado();
  });

  it('data que não existe', async () => {
    const r = await cadastrarDependente(dependenteValido({ dataNascimento: '2020-02-30' }));
    expect(r.sucesso).toBe(false);
    await nadaGravado();
  });

  it('CPF inválido', async () => {
    const r = await cadastrarDependente(dependenteValido({ cpfDoResponsavel: '111.111.111-11' }));
    expect(r.sucesso).toBe(false);
    expect(r.erro).toBe('CPF inválido.');
    await nadaGravado();
  });

  it('sem nome', async () => {
    expect((await cadastrarDependente(dependenteValido({ nome: ' ' }))).sucesso).toBe(false);
    await nadaGravado();
  });

  it('CPF DIFERENTE do já cadastrado: recusa e a transação desfaz o dependente', async () => {
    expect((await cadastrarDependente(dependenteValido({ nome: 'Primeiro' }))).sucesso).toBe(true);
    const r = await cadastrarDependente(
      dependenteValido({ nome: 'Segundo', cpfDoResponsavel: CPF_OUTRO }),
    );
    expect(r.sucesso).toBe(false);
    expect(r.erro).toMatch(/diferente do CPF já cadastrado/);
    // Só o primeiro dependente existe: o `users` e a ficha do segundo foram desfeitos junto.
    expect(await contar('pacientes')).toBe(1);
    expect(await contar('vinculos')).toBe(1);
    const [resp] = await db.select().from(schema.responsaveis);
    expect(resp.cpf).toBe('52998224725'); // o CPF original NÃO foi sobrescrito
  });
});
