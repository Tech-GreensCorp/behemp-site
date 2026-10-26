/**
 * Editar telefone e e-mail de um paciente (telas /admin e /medico /pacientes/[id]) — EXECUTADO
 * contra Postgres real.
 *
 * 🔴 O defeito (26/10/2026): a edição não tinha campo de telefone nem de e-mail, e a action só
 * gravava `telefone` se viesse preenchido. E `users.email` é único (`users_email_idx`): sem checar,
 * um e-mail já usado virava "Erro ao atualizar paciente".
 *
 * Rodar (mesmo Postgres de o-cadastro-de-paciente-aceita-campo-vazio.test.ts):
 *   DATABASE_URL=postgresql://postgres:local@localhost:5544/behemp \
 *     npx vitest run --config vitest.integracao.mts __tests__/integracao/o-contato-do-paciente-se-edita.test.ts
 */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';

const sessao = { clerkId: 'ck_adm' as string | null, role: 'admin' as string };

/** Clerk de mentira: guarda os e-mails por usuário e registra o que foi chamado. */
const clerk = vi.hoisted(() => ({
  emails: new Map<string, Array<{ id: string; emailAddress: string; primary: boolean }>>(),
  falha: null as null | 'criar' | 'criar_duplicado' | 'apagar',
  seq: 0,
}));
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
  clerkClient: async () => ({
    users: {
      getUser: async (id: string) => ({ emailAddresses: clerk.emails.get(id) ?? [] }),
    },
    emailAddresses: {
      createEmailAddress: async (p: {
        userId: string;
        emailAddress: string;
        primary?: boolean;
      }) => {
        if (clerk.falha === 'criar') throw new Error('clerk fora do ar');
        if (clerk.falha === 'criar_duplicado')
          throw { errors: [{ code: 'form_identifier_exists' }] };
        const lista = clerk.emails.get(p.userId) ?? [];
        if (p.primary) lista.forEach((e) => (e.primary = false));
        const novo = {
          id: 'idn_' + ++clerk.seq,
          emailAddress: p.emailAddress,
          primary: Boolean(p.primary),
        };
        clerk.emails.set(p.userId, [...lista, novo]);
        return novo;
      },
      updateEmailAddress: async (id: string, p: { primary?: boolean }) => {
        for (const lista of clerk.emails.values())
          lista.forEach((e) => {
            if (e.id === id && p.primary) e.primary = true;
          });
      },
      deleteEmailAddress: async (id: string) => {
        if (clerk.falha === 'apagar') throw new Error('clerk fora do ar');
        for (const [k, lista] of clerk.emails)
          clerk.emails.set(
            k,
            lista.filter((e) => e.id !== id),
          );
      },
    },
  }),
}));
vi.mock('next/cache', () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));

const { db } = await import('@/lib/db');
const schema = await import('@/db/schema');
const { atualizarPaciente } = await import('@/app/_actions/pacientes');

async function limpar() {
  await db.delete(schema.logsAuditoria);
  await db.delete(schema.pacientes);
  await db.delete(schema.medicos);
  await db.delete(schema.users);
}

async function novoPaciente(email: string, extra: Record<string, unknown> = {}, cidade = 'Recife') {
  const [u] = await db
    .insert(schema.users)
    .values({
      email,
      nome: `Pac ${email}`,
      role: 'paciente',
      telefone: '(81) 90000-0000',
      ...extra,
    } as never)
    .returning({ id: schema.users.id });
  const [p] = await db
    .insert(schema.pacientes)
    .values({ userId: u.id, cidade } as never)
    .returning({ id: schema.pacientes.id });
  return { userId: u.id, pacienteId: p.id };
}

const lerUser = async (id: string) =>
  (await db.select().from(schema.users).where(eq(schema.users.id, id)))[0];
const lerPac = async (id: string) =>
  (await db.select().from(schema.pacientes).where(eq(schema.pacientes.id, id)))[0];

let a: Awaited<ReturnType<typeof novoPaciente>>;
let b: Awaited<ReturnType<typeof novoPaciente>>;

beforeEach(async () => {
  clerk.emails.clear();
  clerk.falha = null;
  sessao.clerkId = 'ck_adm';
  sessao.role = 'admin';
  await limpar();
  await db
    .insert(schema.users)
    .values({ clerkId: 'ck_adm', email: 'adm@teste.invalid', nome: 'Admin', role: 'admin' });
  a = await novoPaciente('a@teste.invalid');
  b = await novoPaciente('b@teste.invalid');
});
afterAll(limpar);

describe('telefone e e-mail se alteram e persistem', () => {
  it('altera os dois de um paciente sem conta de acesso; e-mail grava em minúsculas', async () => {
    const r = await atualizarPaciente({
      pacienteId: a.pacienteId,
      email: 'Novo.Email@Teste.invalid',
      telefone: '(27) 99999-1111',
    } as never);
    expect(r.sucesso).toBe(true);
    const u = await lerUser(a.userId);
    expect(u.email).toBe('novo.email@teste.invalid');
    expect(u.telefone).toBe('(27) 99999-1111');
  });

  it('telefone vazio apaga (NULL); e-mail vazio não toca', async () => {
    const r = await atualizarPaciente({
      pacienteId: a.pacienteId,
      email: '',
      telefone: '',
    } as never);
    expect(r.sucesso).toBe(true);
    const u = await lerUser(a.userId);
    expect(u.telefone).toBeNull();
    expect(u.email).toBe('a@teste.invalid');
  });

  it('só telefone (campos ausentes) não mexe no e-mail nem no resto', async () => {
    const r = await atualizarPaciente({
      pacienteId: a.pacienteId,
      telefone: '(11) 98888-0000',
    } as never);
    expect(r.sucesso).toBe(true);
    expect((await lerUser(a.userId)).email).toBe('a@teste.invalid');
    expect((await lerPac(a.pacienteId)).cidade).toBe('Recife');
  });

  it('reenviar o próprio e-mail (inclusive com outra caixa) não conflita consigo mesmo', async () => {
    const r = await atualizarPaciente({
      pacienteId: a.pacienteId,
      email: 'A@Teste.invalid',
    } as never);
    expect(r.sucesso).toBe(true);
    expect((await lerUser(a.userId)).email).toBe('a@teste.invalid');
  });
});

describe('conflito com outro cadastro', () => {
  it('e-mail de outro paciente é recusado com mensagem clara, sem gravar nada', async () => {
    const r = await atualizarPaciente({
      pacienteId: a.pacienteId,
      email: 'B@teste.invalid',
      telefone: '(99) 90000-0000',
      cidade: 'Outra',
    } as never);
    expect(r.sucesso).toBe(false);
    expect(r.erro).toMatch(/já está em uso/i);
    expect((await lerUser(a.userId)).telefone).toBe('(81) 90000-0000');
    expect((await lerPac(a.pacienteId)).cidade).toBe('Recife');
    expect((await lerUser(b.userId)).email).toBe('b@teste.invalid');
  });

  it('o mesmo telefone em dois pacientes é permitido (não há unicidade de telefone)', async () => {
    const r = await atualizarPaciente({
      pacienteId: a.pacienteId,
      telefone: '(81) 90000-0000',
    } as never);
    expect(r.sucesso).toBe(true);
    const r2 = await atualizarPaciente({
      pacienteId: b.pacienteId,
      telefone: '(81) 90000-0000',
    } as never);
    expect(r2.sucesso).toBe(true);
  });
});

describe('paciente com conta de acesso (Clerk): o login acompanha o e-mail', () => {
  const comConta = async () => {
    const c = await novoPaciente('c@teste.invalid', { clerkId: 'ck_pac_c' });
    clerk.emails.set('ck_pac_c', [
      { id: 'idn_velho', emailAddress: 'c@teste.invalid', primary: true },
    ]);
    return c;
  };

  it('admin troca: o Clerk fica só com o e-mail novo (primário) e o banco acompanha', async () => {
    const c = await comConta();
    const r = await atualizarPaciente({
      pacienteId: c.pacienteId,
      email: 'Novo@teste.invalid',
    } as never);
    expect(r.sucesso).toBe(true);
    expect(clerk.emails.get('ck_pac_c')).toMatchObject([
      { emailAddress: 'novo@teste.invalid', primary: true },
    ]);
    expect((await lerUser(c.userId)).email).toBe('novo@teste.invalid');
    const [log] = await db
      .select()
      .from(schema.logsAuditoria)
      .where(eq(schema.logsAuditoria.entidadeId, c.pacienteId));
    expect(log.dadosAntes).toMatchObject({ email: 'c@teste.invalid' });
    expect(log.dadosDepois).toMatchObject({ email: 'novo@teste.invalid' });
  });

  it('médico não troca o e-mail de login: recusa, e o Clerk não é tocado', async () => {
    const c = await comConta();
    await db
      .insert(schema.users)
      .values({ clerkId: 'ck_med', email: 'm@teste.invalid', nome: 'M', role: 'medico' });
    sessao.clerkId = 'ck_med';
    sessao.role = 'medico';
    const r = await atualizarPaciente({
      pacienteId: c.pacienteId,
      email: 'novo@teste.invalid',
    } as never);
    expect(r.sucesso).toBe(false);
    expect(r.erro).toMatch(/administrador/i);
    expect(clerk.emails.get('ck_pac_c')).toMatchObject([{ emailAddress: 'c@teste.invalid' }]);
    expect((await lerUser(c.userId)).email).toBe('c@teste.invalid');
  });

  it('médico altera o telefone reenviando o mesmo e-mail (campo travado na tela)', async () => {
    const c = await comConta();
    await db
      .insert(schema.users)
      .values({ clerkId: 'ck_med', email: 'm@teste.invalid', nome: 'M', role: 'medico' });
    sessao.clerkId = 'ck_med';
    sessao.role = 'medico';
    const r = await atualizarPaciente({
      pacienteId: c.pacienteId,
      email: 'c@teste.invalid',
      telefone: '(21) 97777-0000',
    } as never);
    expect(r.sucesso).toBe(true);
    expect((await lerUser(c.userId)).telefone).toBe('(21) 97777-0000');
  });

  it('e-mail que já é login de OUTRA conta no Clerk: recusa clara, nada muda', async () => {
    const c = await comConta();
    clerk.falha = 'criar_duplicado';
    const r = await atualizarPaciente({
      pacienteId: c.pacienteId,
      email: 'novo@teste.invalid',
      cidade: 'Outra',
    } as never);
    expect(r.sucesso).toBe(false);
    expect(r.erro).toMatch(/outra conta de acesso/i);
    expect((await lerUser(c.userId)).email).toBe('c@teste.invalid');
    expect((await lerPac(c.pacienteId)).cidade).toBe('Recife');
  });

  it('Clerk fora do ar ao criar: nada é gravado, a mensagem não vaza detalhe', async () => {
    const c = await comConta();
    clerk.falha = 'criar';
    const r = await atualizarPaciente({
      pacienteId: c.pacienteId,
      email: 'novo@teste.invalid',
    } as never);
    expect(r.sucesso).toBe(false);
    expect(r.erro).not.toMatch(/fora do ar/);
    expect((await lerUser(c.userId)).email).toBe('c@teste.invalid');
  });

  it('o banco falha DEPOIS do Clerk trocar: o login volta ao e-mail antigo (sem divergência)', async () => {
    const c = await comConta();
    // data impossível: o Postgres recusa no UPDATE de pacientes, já com o Clerk trocado
    const r = await atualizarPaciente({
      pacienteId: c.pacienteId,
      email: 'novo@teste.invalid',
      dataNascimento: '2019-13-45',
    } as never);
    expect(r.sucesso).toBe(false);
    const lista = clerk.emails.get('ck_pac_c')!;
    expect(lista).toMatchObject([{ emailAddress: 'c@teste.invalid', primary: true }]);
    expect((await lerUser(c.userId)).email).toBe('c@teste.invalid');
  });

  it('falha ao remover o e-mail antigo: desfaz, o login volta ao antigo e o banco não muda', async () => {
    const c = await comConta();
    clerk.falha = 'apagar';
    const r = await atualizarPaciente({
      pacienteId: c.pacienteId,
      email: 'novo@teste.invalid',
    } as never);
    expect(r.sucesso).toBe(false);
    const lista = clerk.emails.get('ck_pac_c')!;
    expect(lista.find((e) => e.primary)?.emailAddress).toBe('c@teste.invalid');
    expect((await lerUser(c.userId)).email).toBe('c@teste.invalid');
  });
});
