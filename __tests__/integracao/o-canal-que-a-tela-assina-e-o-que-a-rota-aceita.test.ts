/**
 * O CANAL QUE A TELA DE PAGAMENTO ASSINA É O QUE `/api/pusher/auth` ACEITA — executado, com a
 * MESMA sessão nas duas pontas (Item 49).
 *
 * A dúvida: a tela de pagamento monta `private-user-{userId}` com o `userId` que
 * `obterPagamentoDaReserva` devolve, e a rota compara com o `users.id` que ELA resolve a partir
 * da sessão (`app/api/pusher/auth/route.ts:51-56`). As duas derivações são iguais no código
 * (clerkId → users.id), mas "iguais no código" é leitura; isto é execução.
 *
 * ⚠️ E `users.clerk_id` NÃO é único no schema (só `email` é) — as duas pontas fazem `.limit(1)`
 * sem `orderBy`. Com duplicata, cada uma poderia pegar uma linha. Medido em produção em
 * 28/09/2026: 0 duplicatas. Este teste cobre o caso sem duplicata, que é o real.
 *
 * Nenhuma chamada ao Pusher: `authorizeChannel` assina localmente (HMAC), com credenciais falsas.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.PUSHER_APP_ID = 'app-de-teste';
process.env.PUSHER_KEY = 'chave-de-teste';
process.env.PUSHER_SECRET = 'segredo-de-teste';
process.env.PUSHER_CLUSTER = 'sa1';

const sessao = { clerkId: null as string | null };
vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({
    userId: sessao.clerkId,
    sessionClaims: { metadata: { role: 'paciente' } },
  }),
  currentUser: async () => (sessao.clerkId ? { id: sessao.clerkId } : null),
  clerkClient: async () => ({ users: {} }),
}));
vi.mock('next/cache', () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

const { NextRequest } = await import('next/server');
const { db } = await import('@/lib/db');
const schema = await import('@/db/schema');
const { obterPagamentoDaReserva } = await import('@/app/(public)/_actions/agendamento');
// O nome do canal como o CLIENTE o monta — a mesma função que a tela usa.
const { canalUsuario } = await import('@/lib/integrations/pusher/client');
const { POST: autenticar } = await import('@/app/api/pusher/auth/route');

async function limpar() {
  await db.delete(schema.participantesGrupo);
  await db.delete(schema.gruposChat);
  await db.delete(schema.logsAuditoria);
  await db.delete(schema.pagamentos);
  await db.delete(schema.consultas);
  await db.delete(schema.pacientes);
  await db.delete(schema.medicos);
  await db.delete(schema.users);
}
beforeEach(limpar);
afterAll(limpar);

async function paciente(clerk: string) {
  const [u] = await db
    .insert(schema.users)
    .values({ clerkId: clerk, email: `${clerk}@teste.local`, nome: 'Paciente', role: 'paciente' })
    .returning({ id: schema.users.id });
  const [p] = await db
    .insert(schema.pacientes)
    .values({ userId: u.id, cpf: '123.456.789-09' })
    .returning({ id: schema.pacientes.id });
  return { userId: u.id, pacienteId: p.id };
}

async function reservaDe(pacienteId: string) {
  const [um] = await db
    .insert(schema.users)
    .values({
      clerkId: 'medico_canal',
      email: 'medico_canal@teste.local',
      nome: 'Dra',
      role: 'medico',
    })
    .returning({ id: schema.users.id });
  const [m] = await db
    .insert(schema.medicos)
    .values({ userId: um.id, especialidade: 'Neurologia', crm: 'CRM/SP 9' })
    .returning({ id: schema.medicos.id });
  const [c] = await db
    .insert(schema.consultas)
    .values({
      pacienteId,
      medicoId: m.id,
      dataHora: new Date(Date.now() + 864e5),
      status: 'reservada',
      expiraEm: new Date(Date.now() + 30 * 60e3),
    })
    .returning({ id: schema.consultas.id });
  return c.id;
}

function pedirAutorizacao(canal: string) {
  const corpo = new FormData();
  corpo.set('socket_id', '1234.5678');
  corpo.set('channel_name', canal);
  return autenticar(
    new NextRequest('http://127.0.0.1:3000/api/pusher/auth', { method: 'POST', body: corpo }),
  );
}

describe('o canal da tela de pagamento passa pela rota de autorização', () => {
  it('🔴 o canal montado com o userId da tela é AUTORIZADO pela rota (200 com assinatura)', async () => {
    const eu = await paciente('user_canal_eu');
    const consultaId = await reservaDe(eu.pacienteId);
    sessao.clerkId = 'user_canal_eu';

    const lido = await obterPagamentoDaReserva({ consultaId });
    expect(lido.sucesso).toBe(true);
    const canal = canalUsuario(lido.dados!.userId);
    expect(canal).toBe(`private-user-${eu.userId}`);

    const resposta = await pedirAutorizacao(canal);
    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toHaveProperty('auth');
  });

  it('CONTROLE: o canal de OUTRO paciente é recusado — 403 da linha 55 (`Acesso negado`)', async () => {
    await paciente('user_canal_eu');
    const outro = await paciente('user_canal_outro');
    sessao.clerkId = 'user_canal_eu';

    const resposta = await pedirAutorizacao(canalUsuario(outro.userId));
    expect(resposta.status).toBe(403);
    expect(await resposta.json()).toEqual({ erro: 'Acesso negado' });
  });

  it('sem sessão: 401, antes de olhar o canal', async () => {
    const eu = await paciente('user_canal_eu');
    sessao.clerkId = null;
    expect((await pedirAutorizacao(canalUsuario(eu.userId))).status).toBe(401);
  });
});

/**
 * 🔴 O MESMO DEFEITO NO CHAT. O ramo `private-chat-` também só RECUSAVA: na permissão, caía no
 * default que nega (`:108`). Desde `e65771d` (09/09/2026), que trocou o default fail-open por
 * negar — correto —, os dois ramos que dependiam de cair no default para AUTORIZAR ficaram sem
 * saída de sucesso.
 */
describe('o canal do chat passa pela rota de autorização', () => {
  async function grupoCom(...userIds: string[]) {
    const [g] = await db
      .insert(schema.gruposChat)
      .values({ criadoPor: userIds[0], tipo: 'direto' })
      .returning({ id: schema.gruposChat.id });
    for (const userId of userIds) {
      await db.insert(schema.participantesGrupo).values({ grupoId: g.id, userId });
    }
    return g.id;
  }

  it('🔴 participante do grupo é AUTORIZADO (200 com assinatura)', async () => {
    const eu = await paciente('user_canal_eu');
    const grupo = await grupoCom(eu.userId);
    sessao.clerkId = 'user_canal_eu';

    const resposta = await pedirAutorizacao(`private-chat-${grupo}`);
    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toHaveProperty('auth');
  });

  it('CONTROLE: quem não participa é recusado — 403 (`Acesso negado ao grupo`)', async () => {
    await paciente('user_canal_eu');
    const outro = await paciente('user_canal_outro');
    const grupo = await grupoCom(outro.userId);
    sessao.clerkId = 'user_canal_eu';

    const resposta = await pedirAutorizacao(`private-chat-${grupo}`);
    expect(resposta.status).toBe(403);
    expect(await resposta.json()).toEqual({ erro: 'Acesso negado ao grupo' });
  });

  it('CONTROLE: canal sem ramo continua negado pelo default', async () => {
    await paciente('user_canal_eu');
    sessao.clerkId = 'user_canal_eu';
    const resposta = await pedirAutorizacao('private-qualquer-coisa');
    expect(resposta.status).toBe(403);
    expect(await resposta.json()).toEqual({ erro: 'Canal não reconhecido' });
  });
});
