/**
 * A EXPIRAÇÃO DE RESERVAS, EXECUTADA contra um Postgres de verdade (Parte 2, Fase 4).
 *
 * 🔴 NÃO É GUARDA ESTRUTURAL. Grava reservas no banco, chama `liberarReservasExpiradas()` e a
 * rota `GET /api/agendamento/expirar`, e confere o que sobrou.
 *
 * O que ele prova, e por que cada um importa — é o horário de um paciente que pagou:
 *   1. reserva vencida SEM pagamento em curso → cancelada, pagamento com o motivo, e-mail,
 *      auditoria
 *   2. reserva vencida com PIX AINDA PAGÁVEL (`pix_valido_ate` no futuro) → fica
 *   3. reserva vencida com pagamento `em_processamento` → fica
 *   4. CONTROLE: `pix_valido_ate` no PASSADO não protege — a regra é "PIX pagável", não "teve
 *      PIX". Sem este caso, uma trava que nunca libera nada passaria nos de cima
 *   5. reserva dentro do prazo não é tocada nem contada
 *   6. o cenário da corrida do plano: a reserva protegida continua `reservada`, e o webhook
 *      com o pagamento aprovado a confirma (em vez de cair em `pago_sem_horario`)
 *   7. a rota: 401 com o segredo errado (nada muda), 200 com os contadores
 *
 * E-mails (Brevo) são duplos: nada sai do processo.
 *
 * Rodar: ver o cabeçalho de `vitest.integracao.mts` (mesmo banco).
 */

import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const CRON = 'cron-de-teste-expirar';
process.env.CRON_SECRET = CRON;

vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: null, sessionClaims: {} }),
  currentUser: async () => null,
  clerkClient: async () => ({ users: {} }),
}));
vi.mock('next/cache', () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

const emails = vi.hoisted(() => ({
  expirada: vi.fn(async () => {}),
  paciente: vi.fn(async () => ({ sucesso: true })),
  medico: vi.fn(async () => ({ sucesso: true })),
}));
vi.mock('@/lib/email/consultas', async (original) => ({
  ...(await original<typeof import('@/lib/email/consultas')>()),
  enviarEmailReservaExpirada: emails.expirada,
  enviarEmailConsultaAgendada: emails.paciente,
  enviarEmailConsultaMedico: emails.medico,
}));

const { db } = await import('@/lib/db');
const schema = await import('@/db/schema');
const { liberarReservasExpiradas } = await import('@/lib/agendamento/liberar-reservas-expiradas');
const { confirmarConsultaPaga } = await import('@/lib/agendamento/confirmar-consulta-paga');
const { GET: expirar } = await import('@/app/api/agendamento/expirar/route');

const MINUTO = 60 * 1000;

async function limpar() {
  await db.delete(schema.logsAuditoria);
  await db.delete(schema.pagamentos);
  await db.delete(schema.consultas);
  await db.delete(schema.pacientes);
  await db.delete(schema.medicos);
  await db.delete(schema.users);
}

let pessoas = { pacienteId: '', medicoId: '' };
let horario = 0;

async function pessoasDoCenario() {
  const [userMedico] = await db
    .insert(schema.users)
    .values({
      clerkId: 'medico_expirar',
      email: 'medico_expirar@teste.local',
      nome: 'Dra. Expirar',
      role: 'medico',
    })
    .returning({ id: schema.users.id });
  const [medico] = await db
    .insert(schema.medicos)
    .values({ userId: userMedico.id, especialidade: 'Neurologia', crm: 'CRM/SP 4' })
    .returning({ id: schema.medicos.id });
  const [userPaciente] = await db
    .insert(schema.users)
    .values({
      clerkId: 'paciente_expirar',
      email: 'paciente_expirar@teste.local',
      nome: 'Paciente Expirar',
      role: 'paciente',
    })
    .returning({ id: schema.users.id });
  const [paciente] = await db
    .insert(schema.pacientes)
    .values({ userId: userPaciente.id, cpf: '123.456.789-09' })
    .returning({ id: schema.pacientes.id });
  pessoas = { pacienteId: paciente.id, medicoId: medico.id };
}

interface Reserva {
  expiraEm: Date;
  pixValidoAte?: Date | null;
  statusPagamento?: 'pendente' | 'em_processamento' | 'recusado' | null;
}

/** Uma reserva, cada uma num horário diferente (o índice único não deixa repetir). */
async function reserva(r: Reserva): Promise<string> {
  horario += 1;
  const dataHora = new Date(Date.now() + (3 * 24 * 60 + horario * 60) * MINUTO);
  const [consulta] = await db
    .insert(schema.consultas)
    .values({
      pacienteId: pessoas.pacienteId,
      medicoId: pessoas.medicoId,
      dataHora,
      status: 'reservada',
      expiraEm: r.expiraEm,
      pixValidoAte: r.pixValidoAte ?? null,
    })
    .returning({ id: schema.consultas.id });
  if (r.statusPagamento !== null) {
    await db.insert(schema.pagamentos).values({
      consultaId: consulta.id,
      pacienteId: pessoas.pacienteId,
      medicoId: pessoas.medicoId,
      dataHora,
      valor: '1.00',
      moeda: 'BRL',
      status: r.statusPagamento ?? 'pendente',
    });
  }
  return consulta.id;
}

async function consulta(id: string) {
  const [c] = await db.select().from(schema.consultas).where(eq(schema.consultas.id, id));
  return c;
}
async function pagamento(id: string) {
  const [p] = await db.select().from(schema.pagamentos).where(eq(schema.pagamentos.consultaId, id));
  return p;
}

const vencida = () => new Date(Date.now() - 5 * MINUTO);

beforeEach(async () => {
  emails.expirada.mockClear();
  emails.paciente.mockClear();
  emails.medico.mockClear();
  await limpar();
  await pessoasDoCenario();
});

// O banco é compartilhado entre os arquivos: sem isto, as consultas que sobram daqui impedem o
// `delete from pacientes` dos próximos (FK), e 28 casos de outros arquivos ficam vermelhos.
afterAll(limpar);

describe('reserva vencida SEM pagamento em curso é liberada', () => {
  it('cancela, limpa o prazo, marca o pagamento, audita e avisa o paciente', async () => {
    const id = await reserva({ expiraEm: vencida() });

    const r = await liberarReservasExpiradas();

    expect(r).toEqual({ liberadas: 1, protegidas: 0 });
    const c = await consulta(id);
    expect(c.status).toBe('cancelada');
    expect(c.expiraEm).toBeNull();
    expect((await pagamento(id)).erroConfirmacao).toBe('Reserva expirada antes da confirmação.');
    expect(emails.expirada).toHaveBeenCalledTimes(1);
    const auditorias = await db
      .select()
      .from(schema.logsAuditoria)
      .where(eq(schema.logsAuditoria.entidadeId, id));
    expect(auditorias).toHaveLength(1);
    expect(auditorias[0].dadosDepois).toMatchObject({ status: 'cancelada' });
  });

  it('sem linha de pagamento também é liberada (4 das 8 medidas em produção não têm)', async () => {
    const id = await reserva({ expiraEm: vencida(), statusPagamento: null });
    expect(await liberarReservasExpiradas()).toEqual({ liberadas: 1, protegidas: 0 });
    expect((await consulta(id)).status).toBe('cancelada');
  });

  it('pagamento RECUSADO não protege — não há dinheiro em trânsito', async () => {
    const id = await reserva({ expiraEm: vencida(), statusPagamento: 'recusado' });
    expect(await liberarReservasExpiradas()).toEqual({ liberadas: 1, protegidas: 0 });
    expect((await consulta(id)).status).toBe('cancelada');
  });
});

describe('🔴 reserva vencida COM pagamento em curso NÃO é liberada', () => {
  it('PIX ainda pagável (`pix_valido_ate` no futuro): fica reservada', async () => {
    // Pagamento `pendente`, não `em_processamento`: isola a proteção do PIX.
    const id = await reserva({
      expiraEm: vencida(),
      pixValidoAte: new Date(Date.now() + 10 * MINUTO),
    });

    expect(await liberarReservasExpiradas()).toEqual({ liberadas: 0, protegidas: 1 });
    const c = await consulta(id);
    expect(c.status).toBe('reservada');
    expect(c.expiraEm).not.toBeNull();
    expect((await pagamento(id)).erroConfirmacao).toBeNull();
    expect(emails.expirada).not.toHaveBeenCalled();
  });

  it('pagamento `em_processamento` (cartão em análise), sem PIX: fica reservada', async () => {
    const id = await reserva({ expiraEm: vencida(), statusPagamento: 'em_processamento' });

    expect(await liberarReservasExpiradas()).toEqual({ liberadas: 0, protegidas: 1 });
    expect((await consulta(id)).status).toBe('reservada');
    expect(emails.expirada).not.toHaveBeenCalled();
  });

  it('`em_processamento` protege mesmo com o PIX já vencido', async () => {
    const id = await reserva({
      expiraEm: vencida(),
      pixValidoAte: new Date(Date.now() - MINUTO),
      statusPagamento: 'em_processamento',
    });
    expect(await liberarReservasExpiradas()).toEqual({ liberadas: 0, protegidas: 1 });
    expect((await consulta(id)).status).toBe('reservada');
  });

  it('CONTROLE: PIX com validade no PASSADO e pagamento pendente → liberada', async () => {
    const id = await reserva({
      expiraEm: vencida(),
      pixValidoAte: new Date(Date.now() - MINUTO),
    });
    expect(await liberarReservasExpiradas()).toEqual({ liberadas: 1, protegidas: 0 });
    expect((await consulta(id)).status).toBe('cancelada');
  });

  it('num lote misto, só as livres saem, e as protegidas são contadas', async () => {
    const livre = await reserva({ expiraEm: vencida() });
    const pix = await reserva({
      expiraEm: vencida(),
      pixValidoAte: new Date(Date.now() + 10 * MINUTO),
    });
    const cartao = await reserva({ expiraEm: vencida(), statusPagamento: 'em_processamento' });
    const noPrazo = await reserva({ expiraEm: new Date(Date.now() + 10 * MINUTO) });

    expect(await liberarReservasExpiradas()).toEqual({ liberadas: 1, protegidas: 2 });
    expect((await consulta(livre)).status).toBe('cancelada');
    expect((await consulta(pix)).status).toBe('reservada');
    expect((await consulta(cartao)).status).toBe('reservada');
    expect((await consulta(noPrazo)).status).toBe('reservada');
    expect(emails.expirada).toHaveBeenCalledTimes(1);
  });

  it('a corrida do plano: protegida agora, o webhook aprovado a confirma depois', async () => {
    const id = await reserva({ expiraEm: vencida(), statusPagamento: 'em_processamento' });

    await liberarReservasExpiradas();
    const confirmacao = await confirmarConsultaPaga(id, { ignorarPrazo: true });

    expect(confirmacao.sucesso).toBe(true);
    expect((await consulta(id)).status).toBe('agendada');
    expect((await pagamento(id)).status).toBe('pago');
  });

  it('worker e GitHub AO MESMO TEMPO: cada reserva sai uma vez, com um e-mail só', async () => {
    // ADR-0027 D-05.2 pedia SKIP LOCKED contra os dois chamadores; aqui é um UPDATE condicional.
    // ⚠️ Prova o DESFECHO com duas chamadas simultâneas, não o mecanismo: a sabotagem que tira a
    // reavaliação do WHERE do UPDATE continuou verde (28/09/2026), e o teste não garante que as
    // duas se sobreponham dentro do Postgres.
    const ids: string[] = [];
    for (let i = 0; i < 6; i++) ids.push(await reserva({ expiraEm: vencida() }));

    const [a, b] = await Promise.all([liberarReservasExpiradas(), liberarReservasExpiradas()]);

    expect(a.liberadas + b.liberadas).toBe(6);
    expect(emails.expirada).toHaveBeenCalledTimes(6);
    const auditorias = await db.select().from(schema.logsAuditoria);
    expect(auditorias).toHaveLength(6);
    for (const id of ids) expect((await consulta(id)).status).toBe('cancelada');
  });

  it('chamar de novo não libera o que estava protegido nem duplica nada', async () => {
    const id = await reserva({ expiraEm: vencida(), statusPagamento: 'em_processamento' });
    await liberarReservasExpiradas();
    expect(await liberarReservasExpiradas()).toEqual({ liberadas: 0, protegidas: 1 });
    expect((await consulta(id)).status).toBe('reservada');
  });
});

describe('a rota GET /api/agendamento/expirar', () => {
  const chamar = (segredo: string) =>
    expirar(
      new Request('http://127.0.0.1:3000/api/agendamento/expirar', {
        headers: { authorization: `Bearer ${segredo}`, 'x-forwarded-for': `10.0.0.${horario}` },
      }),
    );

  it('segredo errado: 401 e nada muda', async () => {
    const id = await reserva({ expiraEm: vencida() });
    const resposta = await chamar('outro-segredo');
    expect(resposta.status).toBe(401);
    expect((await consulta(id)).status).toBe('reservada');
  });

  it('segredo certo: 200 com os dois contadores', async () => {
    await reserva({ expiraEm: vencida() });
    await reserva({ expiraEm: vencida(), statusPagamento: 'em_processamento' });
    const resposta = await chamar(CRON);
    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toEqual({
      sucesso: true,
      dados: { liberadas: 1, protegidas: 1 },
    });
  });
});
