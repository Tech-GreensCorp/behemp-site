/**
 * Paciente cadastrado pela equipe consegue ENTRAR, e o login sem código é individual — EXECUTADO
 * contra Postgres real, com o Clerk substituído por um duplo em memória que RECUSA como o de verdade
 * (e-mail repetido, senha errada, chave ausente).
 *
 * 🔴 O defeito (27/10/2026): `criarPaciente` gravava `users` sem `clerk_id` e nunca criava o login no
 * Clerk. O paciente aparecia na tela de usuários e, ao entrar, o Clerk dizia "não foi possível
 * encontrar o usuário". Nenhum erro no log. Reproduzido no navegador contra o Clerk de desenvolvimento
 * antes da correção.
 *
 * ## O que ele prova
 *   1. cadastrar paciente cria o login no Clerk, grava o `clerk_id` e o e-mail em MINÚSCULAS
 *   2. e-mail repetido com outra grafia NÃO cria um segundo usuário (nem um segundo login)
 *   3. cadastro antigo sem login (grafia mista) é religado sem duplicar; login que já existia é
 *      religado, não recriado; login de OUTRO papel não é tocado
 *   4. paciente arquivado não ganha acesso; falha do Clerk não derruba o cadastro
 *   5. só admin gerencia acesso; a senha vai ao Clerk (sem `skipPasswordChecks`) e NÃO aparece em
 *      auditoria nem em resposta
 *   6. o login sem código só liga com senha definida, só vale para paciente, e o flag mora em
 *      `privateMetadata`
 *   7. a entrada: só quem tem o flag, com a senha certa, recebe ticket; TODA recusa tem a MESMA
 *      mensagem; o limite corta na 6ª tentativa por e-mail
 *
 * Rodar (⚠️ estes testes APAGAM as tabelas — nunca aponte para o banco de desenvolvimento):
 *
 *   docker run -d --name behemp-pg-acesso -e POSTGRES_PASSWORD=local -e POSTGRES_DB=behemp \
 *     -p 5546:5432 postgres:17-alpine
 *   DATABASE_URL=postgresql://postgres:local@localhost:5546/behemp npx drizzle-kit push --force
 *   DATABASE_URL=postgresql://postgres:local@localhost:5546/behemp \
 *     npx vitest run --config vitest.integracao.mts \
 *     __tests__/integracao/o-paciente-cadastrado-pela-equipe-entra.test.ts
 */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';

// ── Duplo do Clerk ────────────────────────────────────────────────
type UsuarioDoClerk = {
  id: string;
  emails: string[];
  senha?: string;
  publicMetadata: Record<string, unknown>;
  privateMetadata: Record<string, unknown>;
  banned: boolean;
  locked: boolean;
};

const clerk = {
  usuarios: new Map<string, UsuarioDoClerk>(),
  seq: 0,
  tickets: [] as { userId: string; expiresInSeconds: number }[],
  chamadas: [] as { fn: string; args: Record<string, unknown> }[],
  falharAoCriar: false,
};

const comoRecusaDoClerk = (code: string) =>
  Object.assign(new Error('clerk'), { errors: [{ code }] });

const clerkFalso = {
  users: {
    getUserList: async ({ emailAddress }: { emailAddress: string[] }) => ({
      data: [...clerk.usuarios.values()].filter((u) =>
        u.emails.some((e) => emailAddress.includes(e)),
      ),
    }),
    createUser: async (p: { emailAddress: string[]; publicMetadata?: Record<string, unknown> }) => {
      clerk.chamadas.push({ fn: 'createUser', args: p as never });
      if (clerk.falharAoCriar) throw comoRecusaDoClerk('unexpected');
      const email = p.emailAddress[0].toLowerCase();
      if ([...clerk.usuarios.values()].some((u) => u.emails.includes(email))) {
        throw comoRecusaDoClerk('form_identifier_exists');
      }
      const u: UsuarioDoClerk = {
        id: `user_fake_${++clerk.seq}`,
        emails: [email],
        publicMetadata: p.publicMetadata ?? {},
        privateMetadata: {},
        banned: false,
        locked: false,
      };
      clerk.usuarios.set(u.id, u);
      return { id: u.id };
    },
    getUser: async (id: string) => {
      const u = clerk.usuarios.get(id);
      if (!u) throw comoRecusaDoClerk('resource_not_found');
      return { ...u, passwordEnabled: Boolean(u.senha) };
    },
    updateUser: async (id: string, p: { password?: string; skipPasswordChecks?: boolean }) => {
      clerk.chamadas.push({ fn: 'updateUser', args: p as never });
      const u = clerk.usuarios.get(id)!;
      if (p.password) {
        if (p.password === 'Password123') throw comoRecusaDoClerk('form_password_pwned');
        u.senha = p.password;
      }
      return u;
    },
    updateUserMetadata: async (
      id: string,
      p: { publicMetadata?: Record<string, unknown>; privateMetadata?: Record<string, unknown> },
    ) => {
      const u = clerk.usuarios.get(id)!;
      for (const [campo, destino] of [
        ['publicMetadata', u.publicMetadata],
        ['privateMetadata', u.privateMetadata],
      ] as const) {
        for (const [k, v] of Object.entries(p[campo] ?? {})) {
          if (v === null) delete destino[k];
          else destino[k] = v;
        }
      }
      return u;
    },
    deleteUser: async (id: string) => {
      clerk.chamadas.push({ fn: 'deleteUser', args: { id } });
      clerk.usuarios.delete(id);
    },
    verifyPassword: async ({ userId, password }: { userId: string; password: string }) => {
      if (clerk.usuarios.get(userId)?.senha !== password)
        throw comoRecusaDoClerk('incorrect_password');
      return { verified: true as const };
    },
  },
  signInTokens: {
    createSignInToken: async (p: { userId: string; expiresInSeconds: number }) => {
      clerk.tickets.push(p);
      return { token: `ticket_${clerk.tickets.length}` };
    },
  },
};

const sessao = { clerkId: null as string | null, role: 'admin' as string };
const rede = { ip: '10.0.0.1' };

vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({
    userId: sessao.clerkId,
    sessionClaims: { metadata: { role: sessao.role } },
  }),
  currentUser: async () => null,
  clerkClient: async () => clerkFalso,
}));
vi.mock('next/cache', () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': rede.ip }),
}));

const { db } = await import('@/lib/db');
const schema = await import('@/db/schema');
const { criarPaciente } = await import('@/app/_actions/pacientes');
const acoes = await import('@/app/_actions/acesso-do-paciente');
const { entrarSemCodigo } = await import('@/app/_actions/entrar-so-com-senha');
const { MENSAGEM_ENTRADA_RECUSADA, MENSAGEM_MUITAS_TENTATIVAS } = await import(
  '@/lib/auth/login-simplificado'
);

const como = (clerkId: string | null, role: string) => {
  sessao.clerkId = clerkId;
  sessao.role = role;
};

async function limpar() {
  await db.delete(schema.logsAuditoria);
  await db.delete(schema.pacientes);
  await db.delete(schema.medicos);
  await db.delete(schema.users);
}

let ipSeq = 0;
beforeEach(async () => {
  await limpar();
  clerk.usuarios.clear();
  clerk.tickets.length = 0;
  clerk.chamadas.length = 0;
  clerk.falharAoCriar = false;
  rede.ip = `10.1.0.${++ipSeq}`; // o limitador por origem é do processo: cada caso na sua
  await db
    .insert(schema.users)
    .values({ clerkId: 'ck_adm', email: 'adm@teste.invalid', nome: 'Admin', role: 'admin' });
  como('ck_adm', 'admin');
});
afterAll(limpar);

/** Paciente já gravado no banco, do jeito que o cadastro antigo deixava (sem login). */
async function pacienteSemLogin(
  email: string,
  extra: { arquivado?: boolean; clerkId?: string } = {},
) {
  const [u] = await db
    .insert(schema.users)
    .values({ email, nome: 'Maria da Silva', role: 'paciente', clerkId: extra.clerkId ?? null })
    .returning({ id: schema.users.id });
  await db.insert(schema.pacientes).values({
    userId: u.id,
    status: 'aguardando_consulta',
    deletedAt: extra.arquivado ? new Date() : null,
  });
  return u.id;
}

const linhaDe = async (id: string) =>
  (await db.select().from(schema.users).where(eq(schema.users.id, id)))[0];

/** Paciente com login, senha e (opcionalmente) o flag, como o admin deixa pela tela. */
async function pacienteComSenha(email: string, senha: string, liberado: boolean) {
  const antes = { ...sessao };
  como('ck_adm', 'admin'); // quem prepara é o admin, mesmo que o caso rode como visitante
  const id = await pacienteSemLogin(email);
  expect((await acoes.definirSenhaDoPaciente(id, senha)).sucesso).toBe(true);
  if (liberado) expect((await acoes.alterarLoginSimplificado(id, true)).sucesso).toBe(true);
  como(antes.clerkId, antes.role);
  return id;
}

const formulario = (email: string) =>
  ({ nome: 'Maria E2E', email, tratamentoTipo: undefined }) as never;

// ── 1 a 4: o login existe ─────────────────────────────────────────
describe('o paciente cadastrado pela equipe ganha login', () => {
  it('criarPaciente cria o login no Clerk, grava o clerk_id e o e-mail em minúsculas', async () => {
    const r = await criarPaciente(formulario('Maria+E2E@Teste.Invalid'));
    expect(r.sucesso).toBe(true);
    expect(r.dados?.acessoCriado).toBe(true);

    const [u] = await db.select().from(schema.users).where(eq(schema.users.role, 'paciente'));
    expect(u.email).toBe('maria+e2e@teste.invalid');
    expect(u.clerkId).toBeTruthy();
    expect(clerk.usuarios.get(u.clerkId!)?.emails).toEqual(['maria+e2e@teste.invalid']);
    expect(clerk.usuarios.get(u.clerkId!)?.publicMetadata).toEqual({ role: 'paciente' });
    // Sem senha e sem pular a checagem de política: o login nasce para entrar por código/recuperação.
    const criacao = clerk.chamadas.find((c) => c.fn === 'createUser')!;
    expect(criacao.args).not.toHaveProperty('password');
  });

  it('o mesmo e-mail com outra grafia NÃO cria um segundo usuário nem um segundo login', async () => {
    await criarPaciente(formulario('dup@teste.invalid'));
    await criarPaciente(formulario('DUP@Teste.Invalid'));
    const pacientes = await db.select().from(schema.users).where(eq(schema.users.role, 'paciente'));
    expect(pacientes).toHaveLength(1);
    expect(clerk.usuarios.size).toBe(1);
  });

  it('se o Clerk falhar, o cadastro FICA e a resposta avisa que falta o acesso', async () => {
    clerk.falharAoCriar = true;
    const r = await criarPaciente(formulario('falha@teste.invalid'));
    expect(r.sucesso).toBe(true);
    expect(r.dados?.acessoCriado).toBe(false);
    expect(r.dados?.avisoDeAcesso).toBeTruthy();
    const [u] = await db.select().from(schema.users).where(eq(schema.users.role, 'paciente'));
    expect(u.clerkId).toBeNull();
    expect(JSON.stringify(r)).not.toContain('falha@teste.invalid');
  });

  it('cadastro antigo sem login (grafia mista) é religado: e-mail em minúsculas, 1 usuário, 1 login', async () => {
    const id = await pacienteSemLogin('Antiga@Teste.Invalid');
    expect((await acoes.criarAcessoDoUsuario(id)).sucesso).toBe(true);
    const u = await linhaDe(id);
    expect(u.email).toBe('antiga@teste.invalid');
    expect(clerk.usuarios.get(u.clerkId!)).toBeTruthy();
    expect(
      await db.select().from(schema.users).where(eq(schema.users.role, 'paciente')),
    ).toHaveLength(1);
  });

  it('login que já existia no Clerk é religado, não recriado', async () => {
    clerk.usuarios.set('user_antigo', {
      id: 'user_antigo',
      emails: ['jaexiste@teste.invalid'],
      publicMetadata: {},
      privateMetadata: {},
      banned: false,
      locked: false,
    });
    const id = await pacienteSemLogin('jaexiste@teste.invalid');
    expect((await acoes.criarAcessoDoUsuario(id)).sucesso).toBe(true);
    expect((await linhaDe(id)).clerkId).toBe('user_antigo');
    expect(clerk.chamadas.some((c) => c.fn === 'createUser')).toBe(false);
    expect(clerk.usuarios.get('user_antigo')?.publicMetadata).toEqual({ role: 'paciente' });
  });

  it('login de OUTRO papel com o mesmo e-mail não é tocado', async () => {
    clerk.usuarios.set('user_medico', {
      id: 'user_medico',
      emails: ['colega@teste.invalid'],
      publicMetadata: { role: 'medico' },
      privateMetadata: {},
      banned: false,
      locked: false,
    });
    const id = await pacienteSemLogin('colega@teste.invalid');
    const r = await acoes.criarAcessoDoUsuario(id);
    expect(r.sucesso).toBe(false);
    expect((await linhaDe(id)).clerkId).toBeNull();
    expect(clerk.usuarios.get('user_medico')?.publicMetadata).toEqual({ role: 'medico' });
  });

  it('o login já ligado a OUTRO cadastro não é roubado', async () => {
    clerk.usuarios.set('user_ocupado', {
      id: 'user_ocupado',
      emails: ['ocupado@teste.invalid'],
      publicMetadata: { role: 'paciente' },
      privateMetadata: {},
      banned: false,
      locked: false,
    });
    await db.insert(schema.users).values({
      email: 'outro-cadastro@teste.invalid',
      nome: 'Outro',
      role: 'paciente',
      clerkId: 'user_ocupado',
    });
    const id = await pacienteSemLogin('ocupado@teste.invalid');
    expect((await acoes.criarAcessoDoUsuario(id)).sucesso).toBe(false);
    expect((await linhaDe(id)).clerkId).toBeNull();
  });

  it('paciente arquivado não ganha acesso; e-mail só com a grafia diferente de outro usuário é recusado', async () => {
    const arquivado = await pacienteSemLogin('arq@teste.invalid', { arquivado: true });
    expect((await acoes.criarAcessoDoUsuario(arquivado)).sucesso).toBe(false);
    expect(clerk.usuarios.size).toBe(0);

    await db
      .insert(schema.users)
      .values({ email: 'colide@teste.invalid', nome: 'A', role: 'paciente' });
    const colide = await pacienteSemLogin('COLIDE@teste.invalid');
    expect((await acoes.criarAcessoDoUsuario(colide)).sucesso).toBe(false);
    expect(clerk.usuarios.size).toBe(0);
  });

  it('o lote cria só quem pode: sem login, ativo, com ficha ativa — e diz quantos restam', async () => {
    await pacienteSemLogin('a@teste.invalid');
    await pacienteSemLogin('B@teste.invalid');
    await pacienteSemLogin('arquivado@teste.invalid', { arquivado: true });
    await pacienteSemLogin('comlogin@teste.invalid', { clerkId: 'user_ja' });
    const antes = await acoes.contarAcessosPendentes();
    expect(antes.dados?.pendentes).toBe(2);

    const r = await acoes.criarAcessosPendentes();
    expect(r.sucesso).toBe(true);
    expect(r.dados).toMatchObject({ criados: 2, vinculados: 0, restantes: 0 });
    expect(r.dados?.falhas).toEqual([]);
    expect(clerk.usuarios.size).toBe(2);
    expect(JSON.stringify(r)).not.toMatch(/@teste\.invalid/);
  });
});

// ── 5 e 6: senha e login sem código (só admin; individual) ────────
describe('a senha e o login sem código são do admin e individuais', () => {
  it('quem não é admin não faz nada disto', async () => {
    const id = await pacienteSemLogin('p@teste.invalid');
    como('ck_pac', 'paciente');
    for (const r of [
      await acoes.criarAcessoDoUsuario(id),
      await acoes.definirSenhaDoPaciente(id, 'Segura1234x'),
      await acoes.alterarLoginSimplificado(id, true),
      await acoes.consultarAcessoDoUsuario(id),
      await acoes.contarAcessosPendentes(),
      await acoes.criarAcessosPendentes(),
    ]) {
      expect(r.sucesso).toBe(false);
    }
    como('ck_med', 'medico');
    expect((await acoes.definirSenhaDoPaciente(id, 'Segura1234x')).sucesso).toBe(false);
    expect(clerk.usuarios.size).toBe(0);
  });

  it('a senha vai ao Clerk sem pular a política, derruba as outras sessões e não aparece em lugar nenhum', async () => {
    const id = await pacienteSemLogin('senha@teste.invalid');
    const r = await acoes.definirSenhaDoPaciente(id, 'Segura1234x');
    expect(r.sucesso).toBe(true);
    expect(JSON.stringify(r)).not.toContain('Segura1234x');

    const chamada = clerk.chamadas.find((c) => c.fn === 'updateUser')!;
    expect(chamada.args).toMatchObject({ password: 'Segura1234x', signOutOfOtherSessions: true });
    expect(chamada.args).not.toHaveProperty('skipPasswordChecks');

    const auditoria = JSON.stringify(await db.select().from(schema.logsAuditoria));
    expect(auditoria).not.toContain('Segura1234x');
    expect(auditoria).toContain('senhaRedefinida');
  });

  it('recusa senha fraca antes do Clerk e traduz a vazada sem eco', async () => {
    const id = await pacienteSemLogin('fraca@teste.invalid');
    for (const fraca of ['curta1', 'somenteletrasaqui', '123456789012']) {
      expect((await acoes.definirSenhaDoPaciente(id, fraca)).sucesso).toBe(false);
    }
    expect(clerk.chamadas.filter((c) => c.fn === 'updateUser')).toHaveLength(0);

    const vazada = await acoes.definirSenhaDoPaciente(id, 'Password123');
    expect(vazada.sucesso).toBe(false);
    expect(vazada.erro).not.toContain('Password123');
  });

  it('definir a senha de quem não tem login cria o login antes (um passo só)', async () => {
    const id = await pacienteSemLogin('umpasso@teste.invalid');
    expect((await acoes.definirSenhaDoPaciente(id, 'Segura1234x')).sucesso).toBe(true);
    expect((await linhaDe(id)).clerkId).toBeTruthy();
    expect((await acoes.consultarAcessoDoUsuario(id)).dados).toMatchObject({
      temConta: true,
      temSenha: true,
      loginSimplificado: false,
    });
  });

  it('o flag só liga com senha, mora em privateMetadata e desliga removendo a chave', async () => {
    const id = await pacienteSemLogin('flag@teste.invalid');
    expect((await acoes.alterarLoginSimplificado(id, true)).sucesso).toBe(false); // sem login
    await acoes.criarAcessoDoUsuario(id);
    expect((await acoes.alterarLoginSimplificado(id, true)).sucesso).toBe(false); // sem senha

    await acoes.definirSenhaDoPaciente(id, 'Segura1234x');
    expect((await acoes.alterarLoginSimplificado(id, true)).sucesso).toBe(true);
    const c = clerk.usuarios.get((await linhaDe(id)).clerkId!)!;
    expect(c.privateMetadata).toEqual({ loginSimplificado: true });
    expect(c.publicMetadata).not.toHaveProperty('loginSimplificado'); // o JWT/cliente nunca vê

    expect((await acoes.alterarLoginSimplificado(id, false)).sucesso).toBe(true);
    expect(c.privateMetadata).toEqual({});
    expect(c.senha).toBe('Segura1234x'); // desligar não apaga a senha
  });

  it('admin e médico NUNCA recebem o login sem código', async () => {
    for (const role of ['admin', 'medico'] as const) {
      const [u] = await db
        .insert(schema.users)
        .values({ email: `${role}x@teste.invalid`, nome: role, role, clerkId: `ck_${role}x` })
        .returning({ id: schema.users.id });
      clerk.usuarios.set(`ck_${role}x`, {
        id: `ck_${role}x`,
        emails: [`${role}x@teste.invalid`],
        senha: 'Segura1234x',
        publicMetadata: { role },
        privateMetadata: {},
        banned: false,
        locked: false,
      });
      expect((await acoes.alterarLoginSimplificado(u.id, true)).sucesso).toBe(false);
      expect((await acoes.definirSenhaDoPaciente(u.id, 'Segura1234x')).sucesso).toBe(false);
      expect(clerk.usuarios.get(`ck_${role}x`)!.privateMetadata).toEqual({});
    }
  });

  it('a auditoria registra quem, o quê e o antes/depois do flag', async () => {
    const id = await pacienteSemLogin('aud@teste.invalid');
    await acoes.definirSenhaDoPaciente(id, 'Segura1234x');
    await acoes.alterarLoginSimplificado(id, true);
    const linhas = await db
      .select()
      .from(schema.logsAuditoria)
      .where(
        and(eq(schema.logsAuditoria.entidade, 'users'), eq(schema.logsAuditoria.entidadeId, id)),
      );
    expect(linhas.length).toBeGreaterThanOrEqual(2);
    const flag = linhas.find((l) => JSON.stringify(l.dadosDepois).includes('loginSimplificado'))!;
    expect(flag.dadosAntes).toEqual({ loginSimplificado: false });
    expect(flag.dadosDepois).toEqual({ loginSimplificado: true });
    expect(flag.userId).toBeTruthy(); // quem fez
  });
});

// ── 7: a entrada ──────────────────────────────────────────────────
describe('entrar só com e-mail e senha', () => {
  beforeEach(() => como(null, 'paciente')); // quem entra ainda não tem sessão

  it('liberado + senha certa = ticket de uso único e 60 s, e o e-mail pode vir com outra grafia', async () => {
    await pacienteComSenha('entra@teste.invalid', 'Segura1234x', true);
    const r = await entrarSemCodigo({ email: '  ENTRA@Teste.Invalid ', senha: 'Segura1234x' });
    expect(r).toEqual({ sucesso: true, ticket: 'ticket_1' });
    expect(clerk.tickets).toHaveLength(1);
    expect(clerk.tickets[0].expiresInSeconds).toBe(60);
  });

  it('toda recusa devolve a MESMA mensagem e nenhum ticket', async () => {
    await pacienteComSenha('liberado@teste.invalid', 'Segura1234x', true);
    await pacienteComSenha('semflag@teste.invalid', 'Segura1234x', false);

    const comSenhaSemLogin = await pacienteSemLogin('semlogin@teste.invalid');
    expect(comSenhaSemLogin).toBeTruthy();

    // banido
    const idBanido = await pacienteComSenha('banido@teste.invalid', 'Segura1234x', true);
    clerk.usuarios.get((await linhaDe(idBanido)).clerkId!)!.banned = true;
    // papel divergente no Clerk
    const idPapel = await pacienteComSenha('papel@teste.invalid', 'Segura1234x', true);
    clerk.usuarios.get((await linhaDe(idPapel)).clerkId!)!.publicMetadata = { role: 'admin' };
    // usuário apagado
    const idApagado = await pacienteComSenha('apagado@teste.invalid', 'Segura1234x', true);
    await db
      .update(schema.users)
      .set({ deletedAt: new Date() })
      .where(eq(schema.users.id, idApagado));

    const tentativas = [
      { email: 'liberado@teste.invalid', senha: 'errada-errada1' }, // senha errada
      { email: 'semflag@teste.invalid', senha: 'Segura1234x' }, // certa, sem flag
      { email: 'semlogin@teste.invalid', senha: 'Segura1234x' }, // sem login
      { email: 'naoexiste@teste.invalid', senha: 'Segura1234x' }, // inexistente
      { email: 'banido@teste.invalid', senha: 'Segura1234x' },
      { email: 'papel@teste.invalid', senha: 'Segura1234x' },
      { email: 'apagado@teste.invalid', senha: 'Segura1234x' },
      { email: 'adm@teste.invalid', senha: 'Segura1234x' }, // admin
      { email: 'nao-e-email', senha: 'x' }, // entrada inválida
      { email: '', senha: '' },
    ];
    for (const t of tentativas) {
      rede.ip = `10.2.0.${++ipSeq}`; // cada tentativa na sua origem: aqui não se testa o limite
      const r = await entrarSemCodigo(t);
      expect(r, t.email).toEqual({ sucesso: false, erro: MENSAGEM_ENTRADA_RECUSADA });
    }
    expect(clerk.tickets).toHaveLength(0);
  });

  it('o limite por e-mail corta na 6ª tentativa — e só então a mensagem muda', async () => {
    await pacienteComSenha('limite@teste.invalid', 'Segura1234x', true);
    for (let i = 1; i <= 5; i++) {
      rede.ip = `10.3.0.${++ipSeq}`;
      expect(
        await entrarSemCodigo({ email: 'limite@teste.invalid', senha: 'errada-errada1' }),
      ).toEqual({ sucesso: false, erro: MENSAGEM_ENTRADA_RECUSADA });
    }
    rede.ip = `10.3.0.${++ipSeq}`;
    // até a senha CERTA é cortada: o limite vem antes de qualquer conferência
    expect(await entrarSemCodigo({ email: 'limite@teste.invalid', senha: 'Segura1234x' })).toEqual({
      sucesso: false,
      erro: MENSAGEM_MUITAS_TENTATIVAS,
    });
    expect(clerk.tickets).toHaveLength(0);
  });

  it('o limite por origem corta quem testa muitos e-mails do mesmo lugar', async () => {
    rede.ip = '10.4.0.1';
    const respostas: string[] = [];
    for (let i = 0; i < 22; i++) {
      const r = await entrarSemCodigo({ email: `alvo${i}@teste.invalid`, senha: 'qualquer123' });
      respostas.push(r.sucesso ? 'ok' : r.erro);
    }
    expect(respostas.slice(0, 20).every((m) => m === MENSAGEM_ENTRADA_RECUSADA)).toBe(true);
    expect(respostas.slice(20).every((m) => m === MENSAGEM_MUITAS_TENTATIVAS)).toBe(true);
  });

  it('revogar o flag corta a entrada na hora, com a senha ainda certa', async () => {
    const id = await pacienteComSenha('revoga@teste.invalid', 'Segura1234x', true);
    expect(
      (await entrarSemCodigo({ email: 'revoga@teste.invalid', senha: 'Segura1234x' })).sucesso,
    ).toBe(true);

    como('ck_adm', 'admin');
    await acoes.alterarLoginSimplificado(id, false);
    como(null, 'paciente');
    rede.ip = `10.5.0.${++ipSeq}`;
    expect(await entrarSemCodigo({ email: 'revoga@teste.invalid', senha: 'Segura1234x' })).toEqual({
      sucesso: false,
      erro: MENSAGEM_ENTRADA_RECUSADA,
    });
  });

  it('redefinir a senha invalida a antiga e vale a nova', async () => {
    const id = await pacienteComSenha('redef@teste.invalid', 'Antiga1234x', true);
    como('ck_adm', 'admin');
    expect((await acoes.definirSenhaDoPaciente(id, 'Nova9876xyz')).sucesso).toBe(true);
    como(null, 'paciente');

    rede.ip = `10.6.0.${++ipSeq}`;
    expect(
      (await entrarSemCodigo({ email: 'redef@teste.invalid', senha: 'Antiga1234x' })).sucesso,
    ).toBe(false);
    rede.ip = `10.6.0.${++ipSeq}`;
    expect(
      (await entrarSemCodigo({ email: 'redef@teste.invalid', senha: 'Nova9876xyz' })).sucesso,
    ).toBe(true);
  });

  it('a entrada deixa rastro na auditoria, sem senha e sem e-mail', async () => {
    await pacienteComSenha('rastro@teste.invalid', 'Segura1234x', true);
    await entrarSemCodigo({ email: 'rastro@teste.invalid', senha: 'Segura1234x' });
    const [linha] = await db
      .select()
      .from(schema.logsAuditoria)
      .where(eq(schema.logsAuditoria.entidade, 'login_sem_codigo'));
    expect(linha).toBeTruthy();
    expect(JSON.stringify(linha)).not.toMatch(/Segura1234x|rastro@teste/);
  });
});

// O Postgres real é o que prova que `lower(email)` e o índice único se comportam como esperado.
describe('o índice de e-mail do banco continua sensível a maiúsculas (por isso a normalização)', () => {
  it('duas grafias do mesmo e-mail cabem no banco — a aplicação é que impede o duplicado', async () => {
    await db.insert(schema.users).values({ email: 'x@teste.invalid', nome: 'A', role: 'paciente' });
    await db.insert(schema.users).values({ email: 'X@teste.invalid', nome: 'B', role: 'paciente' });
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.users)
      .where(sql`lower(${schema.users.email}) = 'x@teste.invalid'`);
    expect(n).toBe(2);
  });
});
