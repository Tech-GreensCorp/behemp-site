/**
 * A COBRANÇA DO MERCADO PAGO, EXECUTADA contra um Postgres de verdade (Parte 2, Fase 2).
 *
 * 🔴 NÃO É GUARDA ESTRUTURAL, e NUNCA CHAMA A API REAL. Roda `criarCobranca` e a action
 * `iniciarCobranca` de verdade, contra o banco, com o `fetch` trocado por um duplo que responde
 * como o `POST /v1/payments` responde (formato conferido na doc oficial em 23/09/2026). O que
 * sobra no banco é o que é conferido.
 *
 * O que ele prova, e por que cada um importa — é dinheiro:
 *   1. PIX: o pedido leva o token DO MÉDICO, a chave de idempotência, o valor DO BANCO e o CPF
 *      DO CADASTRO; a linha grava a referência; `pixValidoAte` é a data DEVOLVIDA pela API
 *   2. repetir o mesmo PIX usa a MESMA chave (clique duplo não cobra duas vezes)
 *   3. cartão aprovado grava a referência; e trava uma segunda cobrança por outro meio
 *   4. cartão recusado vira `recusado` — e um cartão novo pode tentar de novo, com chave nova
 *   5. reserva vencida NÃO chama a API e não escreve nada
 *   6. falha de rede fica registrada, o status não muda (o pagamento pode ter sido criado)
 *   7. credencial do médico recusada (401) fica registrada
 *   8. médico sem conta conectada: nada é chamado, a falha fica registrada
 *   9. PIX sem CPF no cadastro é recusado antes de chamar a API
 *  10. a action só cobra consulta DO paciente da sessão; sem sessão, nada acontece
 *  11. decifrar o token deixa auditoria com o paciente e o motivo `criar_cobranca`
 *
 * Rodar (mesmo banco local dos outros testes de integração):
 *   docker start behemp-pg || docker run -d --name behemp-pg \
 *     -e POSTGRES_PASSWORD=local -e POSTGRES_DB=behemp -p 5544:5432 postgres:16
 *   DATABASE_URL=postgresql://postgres:local@localhost:5544/behemp npx drizzle-kit push --force
 *   DATABASE_URL=postgresql://postgres:local@localhost:5544/behemp \
 *     npx vitest run --config vitest.integracao.mts __tests__/integracao/a-cobranca-do-mercado-pago.test.ts
 */

import { randomBytes } from 'node:crypto';

import { and, eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Chave de cifra descartável, só deste processo — o token do médico é gravado cifrado como no OAuth.
process.env.MERCADOPAGO_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString('hex');

const sessao = { clerkId: null as string | null, role: 'paciente' as string };

vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({
    userId: sessao.clerkId,
    sessionClaims: { metadata: { role: sessao.role } },
  }),
  currentUser: async () => (sessao.clerkId ? { id: sessao.clerkId } : null),
  clerkClient: async () => ({ users: {} }),
}));
vi.mock('next/cache', () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock('next/headers', () => ({
  headers: async () => new Map<string, string>() as unknown as Headers,
}));

const { db } = await import('@/lib/db');
const schema = await import('@/db/schema');
const { conectar } = await import('@/lib/mercadopago/conta');
const { criarCobranca, PIX_VALIDADE_MINUTOS } = await import('@/lib/mercadopago/cobranca');
const { iniciarCobranca } = await import('@/app/(public)/_actions/pagamento');

const TOKEN_DO_MEDICO = 'APP_USR-token-do-medico-de-teste';
const CLERK_PACIENTE = 'user_paciente_cobranca';
const CLERK_OUTRO_PACIENTE = 'user_outro_paciente_cobranca';

// ── O duplo do Mercado Pago ─────────────────────────────────────────────────────────────
interface ChamadaAoMp {
  url: string;
  headers: Record<string, string>;
  corpo: Record<string, unknown>;
}
let chamadas: ChamadaAoMp[] = [];
let responder: () => Promise<Response> | Response = () => {
  throw new Error('nenhuma resposta configurada');
};

function respostaJson(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Resposta de PIX como a doc mostra: pending/pending_waiting_transfer + transaction_data. */
function respostaPix(id: number, dataExpiracao: string) {
  return respostaJson(201, {
    id,
    status: 'pending',
    status_detail: 'pending_waiting_transfer',
    date_of_expiration: dataExpiracao,
    point_of_interaction: {
      type: 'PIX',
      transaction_data: {
        qr_code: '00020126600014br.gov.bcb.pix-teste',
        qr_code_base64: 'iVBORw0KGgo-teste',
        ticket_url: `https://www.mercadopago.com.br/payments/${id}/ticket`,
      },
    },
  });
}

function respostaCartao(id: number, status: string, detalhe: string) {
  return respostaJson(201, { id, status, status_detail: detalhe });
}

beforeEach(() => {
  chamadas = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL, init?: RequestInit) => {
      chamadas.push({
        url: String(url),
        headers: Object.fromEntries(new Headers(init?.headers).entries()),
        corpo: init?.body ? JSON.parse(String(init.body)) : {},
      });
      return responder();
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── O cenário ───────────────────────────────────────────────────────────────────────────
async function limpar() {
  await db.delete(schema.logsAuditoria);
  await db.delete(schema.pagamentos);
  await db.delete(schema.consultas);
  await db.delete(schema.medicosMercadopagoConta);
  await db.delete(schema.pacientes);
  await db.delete(schema.medicos);
  await db.delete(schema.users);
}

interface Cenario {
  medicoId: string;
  pacienteUserId: string;
  consultaId: string;
  pagamentoId: string;
}

async function cenario(
  opcoes: {
    conectado?: boolean;
    cpf?: string | null;
    expiraEmMs?: number;
    clerkPaciente?: string;
  } = {},
): Promise<Cenario> {
  const { conectado = true, cpf = '123.456.789-09', expiraEmMs = 30 * 60 * 1000 } = opcoes;
  const clerkPaciente = opcoes.clerkPaciente ?? CLERK_PACIENTE;

  const [userMedico] = await db
    .insert(schema.users)
    .values({
      clerkId: `medico_${clerkPaciente}`,
      email: `medico_${clerkPaciente}@teste.local`,
      nome: 'Dra. Teste',
      role: 'medico',
    })
    .returning({ id: schema.users.id });
  const [medico] = await db
    .insert(schema.medicos)
    .values({
      userId: userMedico.id,
      especialidade: 'Neurologia',
      crm: 'CRM/SP 1',
      valorConsulta: '350.00',
    })
    .returning({ id: schema.medicos.id });

  const [userPaciente] = await db
    .insert(schema.users)
    .values({
      clerkId: clerkPaciente,
      email: `${clerkPaciente}@teste.local`,
      nome: 'Paciente Teste',
      role: 'paciente',
    })
    .returning({ id: schema.users.id });
  const [paciente] = await db
    .insert(schema.pacientes)
    .values({ userId: userPaciente.id, cpf })
    .returning({ id: schema.pacientes.id });

  const dataHora = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const [consulta] = await db
    .insert(schema.consultas)
    .values({
      pacienteId: paciente.id,
      medicoId: medico.id,
      dataHora,
      status: 'reservada',
      expiraEm: new Date(Date.now() + expiraEmMs),
    })
    .returning({ id: schema.consultas.id });

  // O valor da LINHA de pagamento (o que o paciente viu na reserva) — de propósito diferente do
  // `valorConsulta` do médico, para provar que a cobrança lê a linha e não o cadastro atual.
  const [pagamento] = await db
    .insert(schema.pagamentos)
    .values({
      consultaId: consulta.id,
      pacienteId: paciente.id,
      medicoId: medico.id,
      dataHora,
      valor: '1.00',
      moeda: 'BRL',
    })
    .returning({ id: schema.pagamentos.id });

  if (conectado) {
    await conectar(
      medico.id,
      {
        accessToken: TOKEN_DO_MEDICO,
        refreshToken: 'TG-refresh-de-teste',
        mpUserId: '123456789',
        expiraEm: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      },
      userMedico.id,
    );
  }

  return {
    medicoId: medico.id,
    pacienteUserId: userPaciente.id,
    consultaId: consulta.id,
    pagamentoId: pagamento.id,
  };
}

async function lerPagamento(id: string) {
  const [linha] = await db
    .select()
    .from(schema.pagamentos)
    .where(eq(schema.pagamentos.id, id))
    .limit(1);
  return linha;
}
async function lerConsulta(id: string) {
  const [linha] = await db
    .select()
    .from(schema.consultas)
    .where(eq(schema.consultas.id, id))
    .limit(1);
  return linha;
}

const cartaoAprovado = (token = 'tok-cartao-1') => ({
  token,
  paymentMethodId: 'master',
  issuerId: '24',
  installments: 1,
  payer: { email: 'pagador@teste.local', identification: { type: 'CPF', number: '12345678909' } },
});

describe('a cobrança nasce registrada — e nunca cobra o que não devia', () => {
  beforeEach(async () => {
    sessao.clerkId = null;
    sessao.role = 'paciente';
    await limpar();
  });

  afterAll(async () => {
    await limpar();
  });

  it('1. PIX: token do médico, idempotência, valor do banco, CPF do cadastro — e a validade DEVOLVIDA', async () => {
    const c = await cenario();
    // A API devolve uma validade DIFERENTE da pedida: é a devolvida que tem de ir para o banco.
    const devolvida = '2026-12-01T10:15:00.000-03:00';
    responder = () => respostaPix(111222333, devolvida);

    const res = await criarCobranca(c.consultaId, c.medicoId, c.pacienteUserId, 'pix');

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.status).toBe('em_processamento');
    expect(res.pix?.qrCode).toBe('00020126600014br.gov.bcb.pix-teste');
    expect(res.pix?.validoAte.toISOString()).toBe(new Date(devolvida).toISOString());

    expect(chamadas).toHaveLength(1);
    const [pedido] = chamadas;
    expect(pedido.url).toBe('https://api.mercadopago.com/v1/payments');
    expect(pedido.headers.authorization).toBe(`Bearer ${TOKEN_DO_MEDICO}`);
    expect(pedido.headers['x-idempotency-key']).toMatch(
      new RegExp(`^be4hope-${c.pagamentoId}-pix-\\d+$`),
    );
    expect(pedido.corpo.transaction_amount).toBe(1); // a linha diz 1.00; o médico cobra 350.00
    expect(pedido.corpo.payment_method_id).toBe('pix');
    expect(pedido.corpo.external_reference).toBe(c.pagamentoId);
    expect(pedido.corpo.payer).toEqual({
      email: `${CLERK_PACIENTE}@teste.local`,
      identification: { type: 'CPF', number: '12345678909' },
    });
    // Formato da doc, em Brasília, ~31 min à frente.
    const pedida = String(pedido.corpo.date_of_expiration);
    expect(pedida).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}-03:00$/);
    const minutos = (new Date(pedida).getTime() - Date.now()) / 60000;
    expect(minutos).toBeGreaterThan(PIX_VALIDADE_MINUTOS - 1);
    expect(minutos).toBeLessThanOrEqual(PIX_VALIDADE_MINUTOS);

    const pagamento = await lerPagamento(c.pagamentoId);
    expect(pagamento.gatewayProvider).toBe('mercadopago');
    expect(pagamento.gatewayReferenciaId).toBe('111222333');
    expect(pagamento.gatewayCheckoutUrl).toBe(
      'https://www.mercadopago.com.br/payments/111222333/ticket',
    );
    expect(pagamento.status).toBe('em_processamento');
    expect(pagamento.pagamentoIniciadoEm).toBeInstanceOf(Date);
    expect(pagamento.pagamentoErroEm).toBeNull();
    expect((await lerConsulta(c.consultaId)).pixValidoAte?.toISOString()).toBe(
      new Date(devolvida).toISOString(),
    );
  });

  it('2. repetir o MESMO PIX usa a MESMA chave de idempotência', async () => {
    const c = await cenario();
    responder = () => respostaPix(444, '2026-12-01T10:15:00.000-03:00');

    const primeiro = await criarCobranca(c.consultaId, c.medicoId, c.pacienteUserId, 'pix');
    const segundo = await criarCobranca(c.consultaId, c.medicoId, c.pacienteUserId, 'pix');

    expect(primeiro.ok && segundo.ok).toBe(true);
    expect(chamadas).toHaveLength(2);
    expect(chamadas[1].headers['x-idempotency-key']).toBe(chamadas[0].headers['x-idempotency-key']);
  });

  it('3. cartão aprovado grava a referência — e TRAVA uma segunda cobrança por outro meio', async () => {
    const c = await cenario();
    responder = () => respostaCartao(555, 'approved', 'accredited');

    const res = await criarCobranca(
      c.consultaId,
      c.medicoId,
      c.pacienteUserId,
      'cartao',
      cartaoAprovado(),
    );

    expect(res.ok).toBe(true);
    const [pedido] = chamadas;
    expect(pedido.corpo).toMatchObject({
      transaction_amount: 1,
      token: 'tok-cartao-1',
      payment_method_id: 'master',
      installments: 1,
      issuer_id: '24',
    });
    expect(pedido.corpo).not.toHaveProperty('date_of_expiration');
    expect(pedido.headers['x-idempotency-key']).toMatch(
      new RegExp(`^be4hope-${c.pagamentoId}-cartao-[0-9a-f]{32}$`),
    );
    expect(pedido.headers['x-idempotency-key']).not.toContain('tok-cartao-1'); // o token não vai inteiro

    const pagamento = await lerPagamento(c.pagamentoId);
    expect(pagamento.gatewayReferenciaId).toBe('555');
    expect(pagamento.status).toBe('em_processamento'); // quem confirma é o webhook (Fase 3)
    expect(pagamento.gatewayCheckoutUrl).toBeNull();
    expect((await lerConsulta(c.consultaId)).pixValidoAte).toBeNull();

    // Um PIX depois de um cartão em trânsito poderia ser pago TAMBÉM: recusado sem chamar a API.
    const dupla = await criarCobranca(c.consultaId, c.medicoId, c.pacienteUserId, 'pix');
    expect(dupla).toMatchObject({ ok: false, motivo: 'pagamento_em_andamento' });
    expect(chamadas).toHaveLength(1);
  });

  it('4. cartão recusado vira `recusado` — e um cartão NOVO tenta de novo, com chave nova', async () => {
    const c = await cenario();
    responder = () => respostaCartao(666, 'rejected', 'cc_rejected_insufficient_amount');

    const recusado = await criarCobranca(
      c.consultaId,
      c.medicoId,
      c.pacienteUserId,
      'cartao',
      cartaoAprovado('tok-a'),
    );
    expect(recusado).toMatchObject({ ok: true, status: 'recusado', statusMp: 'rejected' });
    expect((await lerPagamento(c.pagamentoId)).status).toBe('recusado');

    responder = () => respostaCartao(777, 'approved', 'accredited');
    const aprovado = await criarCobranca(
      c.consultaId,
      c.medicoId,
      c.pacienteUserId,
      'cartao',
      cartaoAprovado('tok-b'),
    );
    expect(aprovado).toMatchObject({ ok: true, status: 'em_processamento' });
    expect(chamadas[1].headers['x-idempotency-key']).not.toBe(
      chamadas[0].headers['x-idempotency-key'],
    );
    expect((await lerPagamento(c.pagamentoId)).gatewayReferenciaId).toBe('777');
  });

  it('5. reserva vencida NÃO chama a API e não escreve nada', async () => {
    const c = await cenario({ expiraEmMs: -60 * 1000 });
    responder = () => respostaPix(888, '2026-12-01T10:15:00.000-03:00');

    const res = await criarCobranca(c.consultaId, c.medicoId, c.pacienteUserId, 'pix');

    expect(res).toMatchObject({ ok: false, motivo: 'reserva_expirada' });
    expect(chamadas).toHaveLength(0);
    const pagamento = await lerPagamento(c.pagamentoId);
    expect(pagamento.gatewayReferenciaId).toBeNull();
    expect(pagamento.status).toBe('pendente');
    // E nem decifrou o token: nenhuma auditoria de acesso à credencial.
    const acessos = await db
      .select()
      .from(schema.logsAuditoria)
      .where(eq(schema.logsAuditoria.entidade, 'medicos_mercadopago_conta'));
    expect(acessos.filter((l) => l.acao === 'visualizar')).toHaveLength(0);
  });

  it('6. falha de rede fica registrada — e o status NÃO muda (o pagamento pode ter sido criado)', async () => {
    const c = await cenario();
    responder = () => {
      throw new TypeError('fetch failed');
    };

    const res = await criarCobranca(
      c.consultaId,
      c.medicoId,
      c.pacienteUserId,
      'cartao',
      cartaoAprovado(),
    );

    expect(res).toMatchObject({ ok: false, motivo: 'falha_de_comunicacao' });
    const pagamento = await lerPagamento(c.pagamentoId);
    expect(pagamento.pagamentoErroEm).toBeInstanceOf(Date);
    expect(pagamento.erroConfirmacao).toContain('falha de comunicação');
    expect(pagamento.status).toBe('pendente');
    expect(pagamento.gatewayReferenciaId).toBeNull();
  });

  it('7. credencial do médico recusada (401) fica registrada, sem detalhe da API na mensagem', async () => {
    const c = await cenario();
    responder = () => respostaJson(401, { message: 'invalid access token', error: 'unauthorized' });

    const res = await criarCobranca(c.consultaId, c.medicoId, c.pacienteUserId, 'pix');

    expect(res).toMatchObject({ ok: false, motivo: 'conta_do_medico_invalida' });
    if (!res.ok) expect(res.mensagem).not.toContain('invalid access token');
    const pagamento = await lerPagamento(c.pagamentoId);
    expect(pagamento.pagamentoErroEm).toBeInstanceOf(Date);
    expect(pagamento.erroConfirmacao).toContain('HTTP 401');
  });

  it('8. médico sem conta conectada: nada é chamado, a falha fica registrada', async () => {
    const c = await cenario({ conectado: false });
    responder = () => respostaPix(999, '2026-12-01T10:15:00.000-03:00');

    const res = await criarCobranca(c.consultaId, c.medicoId, c.pacienteUserId, 'pix');

    expect(res).toMatchObject({ ok: false, motivo: 'medico_sem_conta' });
    expect(chamadas).toHaveLength(0);
    expect((await lerPagamento(c.pagamentoId)).pagamentoErroEm).toBeInstanceOf(Date);
  });

  it('9. PIX sem CPF no cadastro é recusado antes de chamar a API', async () => {
    const c = await cenario({ cpf: null });
    responder = () => respostaPix(1000, '2026-12-01T10:15:00.000-03:00');

    const res = await criarCobranca(c.consultaId, c.medicoId, c.pacienteUserId, 'pix');

    expect(res).toMatchObject({ ok: false, motivo: 'dados_invalidos' });
    expect(chamadas).toHaveLength(0);
  });

  it('10. a action só cobra consulta DO paciente da sessão — e sem sessão, nada acontece', async () => {
    const c = await cenario();
    await cenario({ clerkPaciente: CLERK_OUTRO_PACIENTE });
    responder = () => respostaPix(1100, '2026-12-01T10:15:00.000-03:00');

    // Sem sessão.
    sessao.clerkId = null;
    expect(await iniciarCobranca({ consultaId: c.consultaId, metodo: 'pix' })).toMatchObject({
      sucesso: false,
    });

    // Outro paciente, tentando pagar a consulta alheia: responde como inexistente.
    sessao.clerkId = CLERK_OUTRO_PACIENTE;
    expect(await iniciarCobranca({ consultaId: c.consultaId, metodo: 'pix' })).toEqual({
      sucesso: false,
      erro: 'Reserva não encontrada.',
    });
    expect(chamadas).toHaveLength(0);

    // Cartão sem os dados do Brick: recusado na validação, antes de tudo.
    sessao.clerkId = CLERK_PACIENTE;
    expect(await iniciarCobranca({ consultaId: c.consultaId, metodo: 'cartao' })).toMatchObject({
      sucesso: false,
    });
    expect(chamadas).toHaveLength(0);

    // O dono da consulta: cobra.
    const res = await iniciarCobranca({ consultaId: c.consultaId, metodo: 'pix' });
    expect(res.sucesso).toBe(true);
    if (res.sucesso) expect(typeof res.dados.pix?.validoAte).toBe('string');
    expect(chamadas).toHaveLength(1);
  });

  it('11. decifrar o token deixa auditoria com o PACIENTE e o motivo `criar_cobranca`', async () => {
    const c = await cenario();
    responder = () => respostaPix(1200, '2026-12-01T10:15:00.000-03:00');

    await criarCobranca(c.consultaId, c.medicoId, c.pacienteUserId, 'pix');

    const [acesso] = await db
      .select()
      .from(schema.logsAuditoria)
      .where(
        and(
          eq(schema.logsAuditoria.entidade, 'medicos_mercadopago_conta'),
          eq(schema.logsAuditoria.acao, 'visualizar'),
        ),
      );
    expect(acesso.userId).toBe(c.pacienteUserId);
    expect(acesso.dadosDepois).toMatchObject({ motivo: 'criar_cobranca' });
    expect(JSON.stringify(acesso)).not.toContain(TOKEN_DO_MEDICO);

    const [criacao] = await db
      .select()
      .from(schema.logsAuditoria)
      .where(
        and(
          eq(schema.logsAuditoria.entidade, 'pagamentos'),
          eq(schema.logsAuditoria.acao, 'criar'),
        ),
      );
    expect(criacao.dadosDepois).toMatchObject({ mpPaymentId: '1200', metodo: 'pix' });
  });
});
