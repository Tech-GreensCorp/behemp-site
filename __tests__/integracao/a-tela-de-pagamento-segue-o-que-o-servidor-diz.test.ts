/**
 * A TELA DE PAGAMENTO, EXECUTADA do envio do Brick até o aviso do webhook (Parte 2, Fase 5).
 *
 * 🔴 NÃO É GUARDA ESTRUTURAL, e NUNCA CHAMA A API REAL. O caminho é o de produção, menos o
 * navegador:
 *
 *   o que o Brick entrega no `onSubmit` → `entradaDoBrick` → a action `iniciarCobranca` DE
 *   VERDADE (sessão de paciente simulada, Postgres real, `fetch` do MP trocado por duplo) →
 *   `estadoDoResultado` → o que a tela mostraria
 *
 * e, do outro lado, o webhook processado → o aviso pelo Pusher → `obterPagamentoDaReserva` →
 * `combinarComSituacao`.
 *
 * O que ele prova:
 *   1. PIX gera o QR code, com a validade DEVOLVIDA pela API (não a da reserva)
 *   2. depois de um reload, a tela sabe que há PIX em curso — e não o apaga se já tem o QR
 *   3. cartão aprovado mostra "aprovado, confirmando" — NUNCA "confirmado" antes do webhook
 *   4. cartão recusado mostra a mensagem do motivo (CVV) e deixa tentar de novo
 *   5. reserva expirada bloqueia o envio: a API não é chamada e a tela diz "prazo acabou"
 *   6. o webhook aprovando avisa o canal pessoal do paciente, só com id e estado, e a tela relida
 *      mostra "confirmado"
 *   7. a leitura do estado só responde a consulta DO paciente da sessão
 *
 * Rodar: ver o cabeçalho de `vitest.integracao.mts` (mesmo banco).
 */

import { randomBytes } from 'node:crypto';

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { FormDataDoBrick, MeioDoBrick } from '@/lib/agendamento/pagamento-na-tela';

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

const emails = vi.hoisted(() => ({
  paciente: vi.fn(async () => ({ sucesso: true })),
  medico: vi.fn(async () => ({ sucesso: true })),
}));
vi.mock('@/lib/email/consultas', async (original) => ({
  ...(await original<typeof import('@/lib/email/consultas')>()),
  enviarEmailConsultaAgendada: emails.paciente,
  enviarEmailConsultaMedico: emails.medico,
}));

const pusher = vi.hoisted(() => ({
  trigger: vi.fn<(canal: string, evento: string, corpo: unknown) => Promise<unknown>>(
    async () => ({}),
  ),
}));
vi.mock('@/lib/integrations/pusher/server', async (original) => ({
  ...(await original<typeof import('@/lib/integrations/pusher/server')>()),
  getPusherServer: () => ({ trigger: pusher.trigger }),
}));

const { db } = await import('@/lib/db');
const schema = await import('@/db/schema');
const { conectar } = await import('@/lib/mercadopago/conta');
const { iniciarCobranca } = await import('@/app/(public)/_actions/pagamento');
const { obterPagamentoDaReserva, listarMedicosDisponiveis } = await import(
  '@/app/(public)/_actions/agendamento'
);
const { processarPagamento } = await import('@/lib/mercadopago/notificacoes');
const tela = await import('@/lib/agendamento/pagamento-na-tela');

const TOKEN_DO_MEDICO = 'APP_USR-token-do-medico-tela';
const CLERK_PACIENTE = 'user_paciente_tela';

// ── O duplo do Mercado Pago ─────────────────────────────────────────────────────────────
let chamadas: { url: string; metodo: string }[] = [];
let responder: (url: string, metodo: string) => Response = () => {
  throw new Error('nenhuma resposta configurada');
};
const json = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

beforeEach(() => {
  chamadas = [];
  pusher.trigger.mockClear();
  emails.paciente.mockClear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL, init?: RequestInit) => {
      const metodo = init?.method ?? 'GET';
      chamadas.push({ url: String(url), metodo });
      return responder(String(url), metodo);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

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
beforeEach(limpar);
afterAll(limpar);

let n = 0;
async function cenario(opcoes: { expiraEmMs?: number; clerk?: string; conectado?: boolean } = {}) {
  n += 1;
  const clerk = opcoes.clerk ?? CLERK_PACIENTE;
  const [userMedico] = await db
    .insert(schema.users)
    .values({
      clerkId: `medico_tela_${n}`,
      email: `medico_tela_${n}@teste.local`,
      nome: 'Dra. Tela',
      role: 'medico',
    })
    .returning({ id: schema.users.id });
  const [medico] = await db
    .insert(schema.medicos)
    .values({ userId: userMedico.id, especialidade: 'Neurologia', crm: `CRM/SP ${n}` })
    .returning({ id: schema.medicos.id });
  const [userPaciente] = await db
    .insert(schema.users)
    .values({
      clerkId: clerk,
      email: `${clerk}@teste.local`,
      nome: 'Paciente Tela',
      role: 'paciente',
    })
    .returning({ id: schema.users.id });
  const [paciente] = await db
    .insert(schema.pacientes)
    .values({ userId: userPaciente.id, cpf: '123.456.789-09' })
    .returning({ id: schema.pacientes.id });
  const dataHora = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const expiraEm = new Date(Date.now() + (opcoes.expiraEmMs ?? 30 * 60 * 1000));
  const [consulta] = await db
    .insert(schema.consultas)
    .values({
      pacienteId: paciente.id,
      medicoId: medico.id,
      dataHora,
      status: 'reservada',
      expiraEm,
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
    })
    .returning({ id: schema.pagamentos.id });
  if (opcoes.conectado !== false)
    await conectar(
      medico.id,
      {
        accessToken: TOKEN_DO_MEDICO,
        refreshToken: 'TG-tela',
        mpUserId: '111',
        expiraEm: new Date(Date.now() + 1e10),
      },
      userMedico.id,
    );
  return {
    consultaId: consulta.id,
    pagamentoId: pagamento.id,
    userId: userPaciente.id,
    medicoId: medico.id,
    expiraEm: expiraEm.toISOString(),
  };
}

/** O que o Brick entrega para cartão (snake_case, como `ICardPaymentFormData`). */
const envioDeCartao = {
  selectedPaymentMethod: 'creditCard',
  formData: {
    token: 'card-token-de-uso-unico',
    issuer_id: '25',
    payment_method_id: 'master',
    transaction_amount: 1,
    installments: 1,
    payer: { email: 'pagador@teste.local', identification: { type: 'CPF', number: '12345678909' } },
  },
};

/** A tela: do envio do Brick ao estado, pela action real. */
async function enviarPelaTela(
  consultaId: string,
  envio: { selectedPaymentMethod?: MeioDoBrick; formData?: FormDataDoBrick },
) {
  const entrada = tela.entradaDoBrick(consultaId, envio);
  if (!entrada) throw new Error('o Brick mandou algo que a tela não cobra');
  return tela.estadoDoResultado(await iniciarCobranca(entrada));
}

beforeEach(() => {
  sessao.clerkId = CLERK_PACIENTE;
  sessao.role = 'paciente';
});

describe('PIX', () => {
  it('1. gera o QR code, com a validade DEVOLVIDA pela API', async () => {
    const c = await cenario();
    const validadeDaApi = new Date(Date.now() + 31 * 60 * 1000);
    validadeDaApi.setMilliseconds(0);
    responder = () =>
      json(201, {
        id: 9001,
        status: 'pending',
        status_detail: 'pending_waiting_transfer',
        date_of_expiration: validadeDaApi.toISOString(),
        point_of_interaction: {
          transaction_data: {
            qr_code: '000201-pix-tela',
            qr_code_base64: 'iVBOR-tela',
            ticket_url: 'https://mp/ticket/9001',
          },
        },
      });

    const estado = await enviarPelaTela(c.consultaId, {
      selectedPaymentMethod: 'bank_transfer',
      formData: {},
    });

    expect(estado).toEqual({
      tipo: 'pix',
      qrCode: '000201-pix-tela',
      qrCodeBase64: 'iVBOR-tela',
      ticketUrl: 'https://mp/ticket/9001',
      validoAte: validadeDaApi.toISOString(),
    });
    expect(chamadas.filter((x) => x.metodo === 'POST')).toHaveLength(1);
    // Há dinheiro em trânsito: a tela não devolve o paciente ao começo nem depois do prazo da reserva.
    expect(tela.haPagamentoEmCurso(estado, new Date(c.expiraEm).getTime() + 1000)).toBe(true);
  });

  it('2. depois de um reload a tela sabe que há PIX em curso — e não apaga o QR que já tem', async () => {
    const c = await cenario();
    responder = () =>
      json(201, {
        id: 9002,
        status: 'pending',
        date_of_expiration: new Date(Date.now() + 31 * 60 * 1000).toISOString(),
        point_of_interaction: {
          transaction_data: { qr_code: 'q', qr_code_base64: 'b', ticket_url: 'https://t' },
        },
      });
    const comQr = await enviarPelaTela(c.consultaId, {
      selectedPaymentMethod: 'bank_transfer',
      formData: {},
    });

    const lido = await obterPagamentoDaReserva({ consultaId: c.consultaId });
    expect(lido.sucesso).toBe(true);
    expect(lido.dados).toMatchObject({
      emCurso: 'pix',
      statusPagamento: 'em_processamento',
      userId: c.userId,
    });

    expect(tela.combinarComSituacao(comQr, lido.dados!).tipo).toBe('pix'); // mantém o QR
    expect(tela.combinarComSituacao({ tipo: 'escolhendo' }, lido.dados!).tipo).toBe('pix_sem_qr'); // reload
  });
});

describe('cartão', () => {
  it('3. aprovado mostra "aprovado, confirmando" — NUNCA "confirmado" antes do webhook', async () => {
    const c = await cenario();
    responder = () => json(201, { id: 9003, status: 'approved', status_detail: 'accredited' });

    const estado = await enviarPelaTela(c.consultaId, envioDeCartao);

    expect(estado).toEqual({ tipo: 'aprovado' });
    // e o banco ainda não confirmou: a releitura não pode "promover" para confirmado
    const lido = await obterPagamentoDaReserva({ consultaId: c.consultaId });
    expect(lido.dados).toMatchObject({ statusConsulta: 'reservada', emCurso: 'cartao' });
    expect(tela.combinarComSituacao(estado, lido.dados!)).toEqual({ tipo: 'aprovado' });
  });

  it('4. recusado mostra o motivo (CVV) e deixa tentar de novo', async () => {
    const c = await cenario();
    responder = () =>
      json(201, {
        id: 9004,
        status: 'rejected',
        status_detail: 'cc_rejected_bad_filled_security_code',
      });

    const estado = await enviarPelaTela(c.consultaId, envioDeCartao);

    expect(estado).toEqual({
      tipo: 'recusado',
      mensagem: 'Confira o código de segurança (CVV) do cartão.',
    });
    expect(tela.podeEnviar(estado, c.expiraEm, Date.now())).toBe(true);
    // a releitura não troca a mensagem do CVV pela genérica
    const lido = await obterPagamentoDaReserva({ consultaId: c.consultaId });
    expect(tela.combinarComSituacao(estado, lido.dados!)).toEqual(estado);

    // e um cartão novo passa: o servidor aceita a nova tentativa
    responder = () => json(201, { id: 9005, status: 'approved', status_detail: 'accredited' });
    const segunda = await enviarPelaTela(c.consultaId, {
      ...envioDeCartao,
      formData: { ...envioDeCartao.formData, token: 'outro-token' },
    });
    expect(segunda).toEqual({ tipo: 'aprovado' });
  });
});

describe('reserva expirada', () => {
  it('5. bloqueia o envio: a API não é chamada e a tela diz que o prazo acabou', async () => {
    const c = await cenario({ expiraEmMs: -60 * 1000 });
    responder = () => {
      throw new Error('não devia chamar o Mercado Pago');
    };

    expect(tela.podeEnviar({ tipo: 'escolhendo' }, c.expiraEm, Date.now())).toBe(false);
    // e se a tela enviasse mesmo assim (relógio do navegador adiantado), o servidor recusa
    const estado = await enviarPelaTela(c.consultaId, envioDeCartao);
    expect(estado).toEqual({ tipo: 'reserva_expirada' });
    expect(chamadas).toHaveLength(0);
  });
});

describe('o aviso do webhook', () => {
  it('6. aprovado: avisa o canal pessoal só com id e estado, e a tela relida mostra "confirmado"', async () => {
    const c = await cenario();
    responder = () => json(201, { id: 9006, status: 'approved', status_detail: 'accredited' });
    const antes = await enviarPelaTela(c.consultaId, envioDeCartao);
    expect(antes).toEqual({ tipo: 'aprovado' });

    // o webhook relê o pagamento na API
    responder = (url) => {
      if (!url.endsWith('/9006')) throw new Error(`URL inesperada ${url}`);
      return json(200, {
        id: 9006,
        status: 'approved',
        status_detail: 'accredited',
        external_reference: c.pagamentoId,
        transaction_amount: 1,
      });
    };
    expect(await processarPagamento('9006')).toBe('confirmada');

    expect(pusher.trigger).toHaveBeenCalledTimes(1);
    const [canal, evento, corpo] = pusher.trigger.mock.calls[0];
    expect(canal).toBe(`private-user-${c.userId}`);
    expect(evento).toBe('pagamento:atualizado');
    expect(corpo).toEqual({ consultaId: c.consultaId, estado: 'confirmado' }); // nada de PII

    const lido = await obterPagamentoDaReserva({ consultaId: c.consultaId });
    expect(tela.combinarComSituacao(antes, lido.dados!)).toEqual({ tipo: 'confirmado' });
  });

  it('o Pusher fora do ar não impede a confirmação — o aviso nunca lança', async () => {
    const c = await cenario();
    responder = () => json(201, { id: 9007, status: 'approved', status_detail: 'accredited' });
    await enviarPelaTela(c.consultaId, envioDeCartao);
    responder = () =>
      json(200, {
        id: 9007,
        status: 'approved',
        external_reference: c.pagamentoId,
        transaction_amount: 1,
      });
    pusher.trigger.mockRejectedValueOnce(new Error('pusher fora'));

    expect(await processarPagamento('9007')).toBe('confirmada');
    const lido = await obterPagamentoDaReserva({ consultaId: c.consultaId });
    expect(lido.dados?.statusConsulta).toBe('agendada');
  });

  it('recusado depois (webhook): avisa com "recusado"', async () => {
    const c = await cenario();
    responder = () =>
      json(201, { id: 9008, status: 'in_process', status_detail: 'pending_review_manual' });
    expect(await enviarPelaTela(c.consultaId, envioDeCartao)).toEqual({ tipo: 'em_analise' });
    responder = () =>
      json(200, {
        id: 9008,
        status: 'rejected',
        status_detail: 'cc_rejected_high_risk',
        external_reference: c.pagamentoId,
        transaction_amount: 1,
      });

    expect(await processarPagamento('9008')).toBe('recusado');
    expect(pusher.trigger.mock.calls[0][2]).toEqual({
      consultaId: c.consultaId,
      estado: 'recusado',
    });
  });
});

describe('🔴 o interruptor de bloqueio e o médico sem conta', () => {
  const INTERRUPTOR = 'MERCADOPAGO_BLOQUEIO_AGENDAMENTO_ATIVO';
  afterEach(() => {
    delete process.env[INTERRUPTOR];
  });

  it('DESLIGADO (o estado de hoje): a Fase 5 funciona inteira para o médico conectado', async () => {
    expect(process.env[INTERRUPTOR]).toBeUndefined();
    const c = await cenario();

    const lista = await listarMedicosDisponiveis();
    expect(lista.dados?.find((m) => m.id === c.medicoId)?.agendavel).toBe(true);
    const lido = await obterPagamentoDaReserva({ consultaId: c.consultaId });
    expect(lido.dados?.medicoConectado).toBe(true);

    responder = () =>
      json(201, {
        id: 9101,
        status: 'pending',
        date_of_expiration: new Date(Date.now() + 31 * 60 * 1000).toISOString(),
        point_of_interaction: {
          transaction_data: { qr_code: 'q', qr_code_base64: 'b', ticket_url: null },
        },
      });
    expect(
      (await enviarPelaTela(c.consultaId, { selectedPaymentMethod: 'bank_transfer', formData: {} }))
        .tipo,
    ).toBe('pix');
    responder = () => json(201, { id: 9102, status: 'approved', status_detail: 'accredited' });
    const outra = await cenario({ clerk: 'user_paciente_tela_2' });
    sessao.clerkId = 'user_paciente_tela_2';
    expect(await enviarPelaTela(outra.consultaId, envioDeCartao)).toEqual({ tipo: 'aprovado' });
  });

  it('DESLIGADO: médico SEM conta continua na lista, e a tela sabe que não há como cobrar', async () => {
    const c = await cenario({ conectado: false });

    const lista = await listarMedicosDisponiveis();
    expect(lista.dados?.find((m) => m.id === c.medicoId)?.agendavel).toBe(true);
    const lido = await obterPagamentoDaReserva({ consultaId: c.consultaId });
    expect(lido.dados?.medicoConectado).toBe(false); // → a tela não mostra o Brick
  });

  it('LIGADO: o médico sem conta sai da escolha; o conectado continua', async () => {
    process.env[INTERRUPTOR] = 'ativo';
    const semConta = await cenario({ conectado: false, clerk: 'user_paciente_tela_3' });
    const comConta = await cenario({ clerk: 'user_paciente_tela_4' });

    const lista = await listarMedicosDisponiveis();
    expect(lista.dados?.find((m) => m.id === semConta.medicoId)?.agendavel).toBe(false);
    expect(lista.dados?.find((m) => m.id === comConta.medicoId)?.agendavel).toBe(true);
  });
});

describe('só à vista — o servidor decide', () => {
  it('2 parcelas são recusadas ANTES de chamar o Mercado Pago', async () => {
    const c = await cenario();
    responder = () => {
      throw new Error('não devia chamar o Mercado Pago');
    };
    const res = await iniciarCobranca({
      consultaId: c.consultaId,
      metodo: 'cartao',
      dadosCartao: {
        token: 't',
        paymentMethodId: 'master',
        installments: 2,
        payer: { email: 'a@b.com' },
      },
    });
    expect(res).toEqual({ sucesso: false, erro: 'Dados de pagamento inválidos.' });
    expect(chamadas).toHaveLength(0);
  });
});

describe('escopo', () => {
  it('7. a leitura do estado só responde a consulta DO paciente da sessão', async () => {
    const c = await cenario();
    await cenario({ clerk: 'user_outro_paciente_tela' });
    sessao.clerkId = 'user_outro_paciente_tela';

    const lido = await obterPagamentoDaReserva({ consultaId: c.consultaId });
    expect(lido).toEqual({ sucesso: false, erro: 'Reserva não encontrada.' });

    sessao.clerkId = null;
    expect((await obterPagamentoDaReserva({ consultaId: c.consultaId })).sucesso).toBe(false);
  });
});
