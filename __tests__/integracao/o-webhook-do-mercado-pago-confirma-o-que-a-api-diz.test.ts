/**
 * O WEBHOOK DO MERCADO PAGO, EXECUTADO de ponta a ponta contra um Postgres de verdade
 * (Parte 2, Fase 3).
 *
 * 🔴 NÃO É GUARDA ESTRUTURAL, e NUNCA CHAMA A API REAL. Chama o `POST` da rota de verdade com
 * uma `NextRequest` assinada como o MP assina (`x-signature` = HMAC-SHA256 de
 * `id:…;request-id:…;ts:…;`), roda o `after()` que a rota agenda, e troca o `fetch` por um
 * duplo que responde como `GET /v1/payments/{id}` responde. O que sobra no banco é o que é
 * conferido.
 *
 * O que ele prova, e por que cada um importa — é dinheiro:
 *   1. DUAS notificações do MESMO pagamento (criado → pendente, depois aprovado): a segunda
 *      REENFILEIRA e confirma. Com `onConflictDoNothing` a aprovação seria descartada e o
 *      paciente pagaria sem consulta
 *   2. REENVIO IDÊNTICO da aprovação: responde 200, relê a API, e não confirma de novo — um
 *      e-mail só, uma auditoria de confirmação só
 *   3. ASSINATURA FORJADA (outro segredo; ou assinatura legítima de OUTRO pagamento): 200,
 *      nada enfileirado, a API nem é chamada
 *   4. CORPO ADULTERADO: `data.id` do corpo divergente é ignorado; corpo dizendo "aprovado"
 *      com a API dizendo "pendente" NÃO confirma — o corpo não é assinado
 *   5. a API aprovando com VALOR diferente do nosso não confirma (regra 3)
 *   6. CONCILIAÇÃO: sem notificação nenhuma, o processador reenfileira o pagamento em
 *      trânsito e confirma; com o CRON_SECRET errado, 401 e nada acontece
 *
 * E-mails (Brevo) e Google Calendar são duplos: nada sai do processo.
 *
 * Rodar: ver o cabeçalho de `a-cobranca-do-mercado-pago.test.ts` (mesmo banco).
 */

import { randomBytes } from 'node:crypto';

import { and, eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.MERCADOPAGO_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString('hex');
const SEGREDO_DO_WEBHOOK = 'segredo-do-webhook-de-teste';
process.env.MERCADOPAGO_WEBHOOK_SECRET = SEGREDO_DO_WEBHOOK;
const CRON = 'cron-de-teste';
process.env.CRON_SECRET = CRON;

vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: null, sessionClaims: {} }),
  currentUser: async () => null,
  clerkClient: async () => ({ users: {} }),
}));
vi.mock('next/cache', () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

/** O `after()` do Next só existe dentro de uma requisição; aqui ele guarda e o teste roda. */
const depois = vi.hoisted(() => ({ tarefas: [] as (() => Promise<unknown>)[] }));
vi.mock('next/server', async (original) => ({
  ...(await original<typeof import('next/server')>()),
  after: (tarefa: () => Promise<unknown>) => {
    depois.tarefas.push(tarefa);
  },
}));

const emails = vi.hoisted(() => ({
  paciente: vi.fn(async () => ({ sucesso: true })),
  medico: vi.fn(async () => ({ sucesso: true })),
}));
vi.mock('@/lib/email/consultas', async (original) => ({
  ...(await original<typeof import('@/lib/email/consultas')>()),
  enviarEmailConsultaAgendada: emails.paciente,
  enviarEmailConsultaMedico: emails.medico,
}));
vi.mock('@/lib/integrations/google-calendar', async (original) => ({
  ...(await original<typeof import('@/lib/integrations/google-calendar')>()),
  criarConsultaGoogleCalendar: vi.fn(),
  cancelarEventoGoogleCalendar: vi.fn(),
}));

const { NextRequest } = await import('next/server');
const { db } = await import('@/lib/db');
const schema = await import('@/db/schema');
const { conectar } = await import('@/lib/mercadopago/conta');
const { assinarManifesto, manifestoDoWebhook } = await import(
  '@/lib/mercadopago/assinatura-webhook'
);
const { POST } = await import('@/app/api/webhooks/mercadopago/route');
const { GET: processar } = await import('@/app/api/mercadopago/processar/route');

const TOKEN_DO_MEDICO = 'APP_USR-token-do-medico-webhook';
const MP_ID = '1320000001';

// ── O duplo da API do MP ─────────────────────────────────────────────────────────────────
let chamadas: { url: string; auth: string | null }[] = [];
/** O que `GET /v1/payments/{id}` responde agora. Mudar entre notificações = o pagamento andou. */
let naApi: Record<string, unknown> = {};

beforeEach(() => {
  chamadas = [];
  depois.tarefas = [];
  emails.paciente.mockClear();
  emails.medico.mockClear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL, init?: RequestInit) => {
      chamadas.push({ url: String(url), auth: new Headers(init?.headers).get('authorization') });
      return new Response(JSON.stringify(naApi), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

// ── A notificação, assinada como o MP assina ────────────────────────────────────────────
interface Notificacao {
  idNaUrl?: string;
  idAssinado?: string;
  corpo?: Record<string, unknown>;
  segredo?: string;
  requestId?: string;
}

let sequencia = 0;
function notificacao(n: Notificacao = {}) {
  const idNaUrl = n.idNaUrl ?? MP_ID;
  const requestId = n.requestId ?? `req-${++sequencia}`;
  const ts = String(1_790_000_000 + sequencia);
  const v1 = assinarManifesto(
    manifestoDoWebhook({ dataId: n.idAssinado ?? idNaUrl, requestId, ts }),
    n.segredo ?? SEGREDO_DO_WEBHOOK,
  );
  const corpo = n.corpo ?? { type: 'payment', action: 'payment.updated', data: { id: idNaUrl } };
  return {
    url: `https://be4hope.org/api/webhooks/mercadopago?data.id=${idNaUrl}&type=payment`,
    headers: { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': requestId },
    body: JSON.stringify(corpo),
  };
}

/** Entrega à rota e roda o que ela agendou para depois da resposta. */
async function entregar(n: ReturnType<typeof notificacao>) {
  const resposta = await POST(
    new NextRequest(n.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...n.headers },
      body: n.body,
    }),
  );
  for (const tarefa of depois.tarefas.splice(0)) await tarefa();
  return resposta;
}

function pagamentoNaApi(status: string, extra: Record<string, unknown> = {}) {
  return {
    id: Number(MP_ID),
    status,
    status_detail: status === 'approved' ? 'accredited' : 'pending_waiting_transfer',
    external_reference: cenarioAtual.pagamentoId,
    transaction_amount: 1,
    ...extra,
  };
}

// ── O cenário ───────────────────────────────────────────────────────────────────────────
async function limpar() {
  await db.delete(schema.mercadopagoEventosWebhook);
  await db.delete(schema.logsAuditoria);
  await db.delete(schema.pagamentos);
  await db.delete(schema.consultas);
  await db.delete(schema.medicosMercadopagoConta);
  await db.delete(schema.pacientes);
  await db.delete(schema.medicos);
  await db.delete(schema.users);
}

let cenarioAtual = { consultaId: '', pagamentoId: '' };

async function cenario(opcoes: { iniciadoHaMs?: number } = {}) {
  const [userMedico] = await db
    .insert(schema.users)
    .values({
      clerkId: 'medico_webhook',
      email: 'medico_webhook@teste.local',
      nome: 'Dra. Webhook',
      role: 'medico',
    })
    .returning({ id: schema.users.id });
  const [medico] = await db
    .insert(schema.medicos)
    .values({
      userId: userMedico.id,
      especialidade: 'Neurologia',
      crm: 'CRM/SP 2',
      valorConsulta: '350.00',
    })
    .returning({ id: schema.medicos.id });
  const [userPaciente] = await db
    .insert(schema.users)
    .values({
      clerkId: 'paciente_webhook',
      email: 'paciente_webhook@teste.local',
      nome: 'Paciente Webhook',
      role: 'paciente',
    })
    .returning({ id: schema.users.id });
  const [paciente] = await db
    .insert(schema.pacientes)
    .values({ userId: userPaciente.id, cpf: '123.456.789-09' })
    .returning({ id: schema.pacientes.id });

  const dataHora = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  // Reserva JÁ VENCIDA de propósito: com o job de expiração parado em produção, é o caso
  // comum — e o webhook, com o pagamento aprovado na API, confirma assim mesmo (ignorarPrazo).
  const [consulta] = await db
    .insert(schema.consultas)
    .values({
      pacienteId: paciente.id,
      medicoId: medico.id,
      dataHora,
      status: 'reservada',
      expiraEm: new Date(Date.now() - 60 * 1000),
    })
    .returning({ id: schema.consultas.id });
  const [pagamento] = await db
    .insert(schema.pagamentos)
    .values({
      consultaId: consulta.id,
      pacienteId: paciente.id,
      medicoId: medico.id,
      dataHora,
      valor: '1.00',
      moeda: 'BRL',
      status: 'em_processamento',
      gatewayProvider: 'mercadopago',
      gatewayReferenciaId: MP_ID,
      pagamentoIniciadoEm: new Date(Date.now() - (opcoes.iniciadoHaMs ?? 30 * 1000)),
    })
    .returning({ id: schema.pagamentos.id });

  await conectar(
    medico.id,
    {
      accessToken: TOKEN_DO_MEDICO,
      refreshToken: 'TG-refresh-webhook',
      mpUserId: '987654321',
      expiraEm: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
    },
    userMedico.id,
  );

  cenarioAtual = { consultaId: consulta.id, pagamentoId: pagamento.id };
  return cenarioAtual;
}

async function estado() {
  const [consulta] = await db
    .select()
    .from(schema.consultas)
    .where(eq(schema.consultas.id, cenarioAtual.consultaId));
  const [pagamento] = await db
    .select()
    .from(schema.pagamentos)
    .where(eq(schema.pagamentos.id, cenarioAtual.pagamentoId));
  const eventos = await db.select().from(schema.mercadopagoEventosWebhook);
  const confirmacoes = await db
    .select()
    .from(schema.logsAuditoria)
    .where(
      and(
        eq(schema.logsAuditoria.entidade, 'consultas'),
        eq(schema.logsAuditoria.entidadeId, cenarioAtual.consultaId),
      ),
    );
  return { consulta, pagamento, eventos, confirmacoes };
}

beforeEach(async () => {
  await limpar();
});
afterAll(async () => {
  await limpar();
});

// ─────────────────────────────────────────────────────────────────────────────────────────
describe('1–2. o mesmo pagamento notificado várias vezes', () => {
  it('criado (pendente) e depois aprovado: a SEGUNDA notificação reenfileira e confirma', async () => {
    await cenario();

    naApi = pagamentoNaApi('pending');
    const r1 = await entregar(
      notificacao({ corpo: { type: 'payment', action: 'payment.created', data: { id: MP_ID } } }),
    );
    expect(r1.status).toBe(200);
    let s = await estado();
    expect(s.consulta.status).toBe('reservada');
    expect(s.pagamento.status).toBe('em_processamento');
    expect(s.eventos).toHaveLength(1);
    expect(s.eventos[0].processadoEm).not.toBeNull();

    naApi = pagamentoNaApi('approved');
    const r2 = await entregar(notificacao());
    expect(r2.status).toBe(200);
    s = await estado();
    expect(s.eventos, 'uma linha por pagamento — reenfileirada, não duplicada').toHaveLength(1);
    expect(s.consulta.status).toBe('agendada');
    expect(s.consulta.expiraEm).toBeNull();
    expect(s.pagamento.status).toBe('pago');
    expect(s.pagamento.confirmadoEm).not.toBeNull();
    expect(emails.paciente).toHaveBeenCalledTimes(1);

    // As duas releram a API, com o token DO MÉDICO, no id da URL.
    expect(chamadas).toHaveLength(2);
    for (const c of chamadas) {
      expect(c.url).toBe(`https://api.mercadopago.com/v1/payments/${MP_ID}`);
      expect(c.auth).toBe(`Bearer ${TOKEN_DO_MEDICO}`);
    }
  });

  it('reenvio IDÊNTICO da aprovação: 200, relê, e não confirma de novo', async () => {
    await cenario();
    naApi = pagamentoNaApi('approved');
    const n = notificacao();

    expect((await entregar(n)).status).toBe(200);
    const antes = await estado();
    expect(antes.consulta.status).toBe('agendada');

    expect((await entregar(n)).status).toBe(200);
    const depoisDoReenvio = await estado();
    expect(depoisDoReenvio.consulta.status).toBe('agendada');
    expect(depoisDoReenvio.pagamento.status).toBe('pago');
    expect(depoisDoReenvio.pagamento.pagoEm).toEqual(antes.pagamento.pagoEm);
    expect(depoisDoReenvio.eventos).toHaveLength(1);
    expect(depoisDoReenvio.confirmacoes, 'uma auditoria de confirmação, não duas').toHaveLength(1);
    expect(emails.paciente).toHaveBeenCalledTimes(1);
    expect(emails.medico).toHaveBeenCalledTimes(1);
  });
});

describe('3. assinatura forjada', () => {
  it('assinada com OUTRO segredo: 200, nada enfileirado, a API nem é chamada', async () => {
    await cenario();
    naApi = pagamentoNaApi('approved');
    const r = await entregar(notificacao({ segredo: 'segredo-do-atacante' }));
    expect(r.status).toBe(200);
    const s = await estado();
    expect(s.eventos).toHaveLength(0);
    expect(chamadas).toHaveLength(0);
    expect(s.consulta.status).toBe('reservada');
  });

  it('assinatura LEGÍTIMA de outro pagamento, com o nosso id na URL: recusada', async () => {
    await cenario();
    naApi = pagamentoNaApi('approved');
    const r = await entregar(notificacao({ idAssinado: '1320000999' }));
    expect(r.status).toBe(200);
    expect((await estado()).eventos).toHaveLength(0);
    expect(chamadas).toHaveLength(0);
  });

  /**
   * 🔴 O caso que a sabotagem "verificar com o id do corpo" achou descoberto, em 23/09/2026.
   * Corpo SEM `data.id` passa pela checagem de divergência; se a verificação usasse o corpo, a
   * assinatura de um manifesto SEM id — a de qualquer notificação sem `data.id` — valeria para
   * QUALQUER pagamento posto na URL.
   */
  it('assinatura de manifesto SEM id, corpo sem data.id e o nosso id na URL: recusada', async () => {
    await cenario();
    naApi = pagamentoNaApi('approved');
    const requestId = 'req-sem-id';
    const ts = '1790009999';
    const v1 = assinarManifesto(
      manifestoDoWebhook({ dataId: null, requestId, ts }),
      SEGREDO_DO_WEBHOOK,
    );
    const r = await entregar({
      url: `https://be4hope.org/api/webhooks/mercadopago?data.id=${MP_ID}&type=payment`,
      headers: { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': requestId },
      body: JSON.stringify({ type: 'payment' }),
    });
    expect(r.status).toBe(200);
    expect((await estado()).eventos).toHaveLength(0);
    expect(chamadas).toHaveLength(0);
  });

  it('sem x-signature: recusada', async () => {
    await cenario();
    const n = notificacao();
    const r = await entregar({
      ...n,
      headers: { 'x-request-id': n.headers['x-request-id'] } as never,
    });
    expect(r.status).toBe(200);
    expect((await estado()).eventos).toHaveLength(0);
  });
});

describe('4. corpo adulterado — o corpo NÃO é assinado', () => {
  it('data.id do corpo divergente do da URL: ignorado, nada enfileirado', async () => {
    await cenario();
    naApi = pagamentoNaApi('approved');
    const r = await entregar(
      notificacao({ corpo: { type: 'payment', data: { id: '1320000999' } } }),
    );
    expect(r.status).toBe(200);
    expect((await estado()).eventos).toHaveLength(0);
    expect(chamadas).toHaveLength(0);
  });

  it('corpo dizendo "aprovado" com a API dizendo "pendente": NÃO confirma', async () => {
    await cenario();
    naApi = pagamentoNaApi('pending');
    const r = await entregar(
      notificacao({
        corpo: {
          type: 'payment',
          action: 'payment.approved',
          data: { id: MP_ID, status: 'approved' },
          status: 'approved',
        },
      }),
    );
    expect(r.status).toBe(200);
    const s = await estado();
    expect(s.consulta.status).toBe('reservada');
    expect(s.pagamento.status).toBe('em_processamento');
  });
});

describe('5. a API tem de falar do NOSSO pagamento', () => {
  it('aprovado com VALOR diferente: não confirma, fica registrado como divergente', async () => {
    await cenario();
    naApi = pagamentoNaApi('approved', { transaction_amount: 0.01 });
    await entregar(notificacao());
    const s = await estado();
    expect(s.consulta.status).toBe('reservada');
    expect(s.pagamento.status).toBe('em_processamento');
    expect(s.pagamento.erroConfirmacao).toMatch(/divergente \(valor\)/);
  });

  it('aprovado com external_reference de OUTRA linha: não confirma', async () => {
    await cenario();
    naApi = pagamentoNaApi('approved', { external_reference: 'pag_de_outro' });
    await entregar(notificacao());
    const s = await estado();
    expect(s.consulta.status).toBe('reservada');
    expect(s.pagamento.erroConfirmacao).toMatch(/external_reference/);
  });
});

describe('6. conciliação — a notificação que nunca chegou', () => {
  function chamarProcessador(segredo: string) {
    return processar(
      new Request('https://be4hope.org/api/mercadopago/processar', {
        headers: { authorization: `Bearer ${segredo}`, 'x-forwarded-for': '198.51.100.7' },
      }),
    );
  }

  it('sem webhook nenhum, o processador reenfileira o pagamento em trânsito e confirma', async () => {
    await cenario({ iniciadoHaMs: 5 * 60 * 1000 });
    naApi = pagamentoNaApi('approved');
    const r = await chamarProcessador(CRON);
    expect(r.status).toBe(200);
    const corpo = await r.json();
    expect(corpo.dados.reenfileirados).toBe(1);
    expect(corpo.dados.efeitos).toEqual({ confirmada: 1 });
    expect((await estado()).consulta.status).toBe('agendada');
  });

  it('pagamento iniciado há menos de 2 min fica para o webhook — não é reenfileirado', async () => {
    await cenario({ iniciadoHaMs: 30 * 1000 });
    const r = await chamarProcessador(CRON);
    expect((await r.json()).dados.reenfileirados).toBe(0);
    expect(chamadas).toHaveLength(0);
  });

  it('CRON_SECRET errado: 401 e nada acontece', async () => {
    await cenario({ iniciadoHaMs: 5 * 60 * 1000 });
    naApi = pagamentoNaApi('approved');
    const r = await chamarProcessador('segredo-errado');
    expect(r.status).toBe(401);
    const s = await estado();
    expect(s.eventos).toHaveLength(0);
    expect(s.consulta.status).toBe('reservada');
    expect(chamadas).toHaveLength(0);
  });
});
