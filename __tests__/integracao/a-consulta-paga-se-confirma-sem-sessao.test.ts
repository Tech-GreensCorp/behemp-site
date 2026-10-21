/**
 * A CONFIRMAÇÃO DA CONSULTA PAGA, EXECUTADA contra um Postgres de verdade (Parte 2, Fase 2.3).
 *
 * `confirmarAgendamento` foi partida em duas: a casca autenticada (a action) e a confirmação em
 * si, `confirmarConsultaPaga`, que o webhook do Mercado Pago vai chamar SEM sessão. Este teste
 * prova as duas metades:
 *
 *   1. `confirmarConsultaPaga` funciona com o Clerk devolvendo NINGUÉM — o caminho do webhook —
 *      e grava consulta confirmada, prazo limpo, pagamento PAGO (`status`, `pagoEm`,
 *      `confirmadoEm`), auditoria sem autor, e os dois e-mails
 *   2. a casca, com o paciente dono, produz o mesmo resultado — e a auditoria tem o paciente
 *   3. a casca recusa consulta de OUTRO paciente com a mesma mensagem de antes, sem tocar em nada
 *   4. reserva vencida é cancelada com a mensagem de antes
 *   5. consulta já confirmada responde a mensagem de antes, sem reconfirmar
 *
 * Os e-mails (Brevo) e o Google Calendar são duplos: nada sai do processo.
 *
 * Rodar: ver o cabeçalho de `a-cobranca-do-mercado-pago.test.ts` (mesmo banco).
 */

import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

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
const calendario = vi.hoisted(() => ({ criar: vi.fn(), cancelar: vi.fn() }));
vi.mock('@/lib/integrations/google-calendar', async (original) => ({
  ...(await original<typeof import('@/lib/integrations/google-calendar')>()),
  criarConsultaGoogleCalendar: calendario.criar,
  cancelarEventoGoogleCalendar: calendario.cancelar,
}));

const { db } = await import('@/lib/db');
const schema = await import('@/db/schema');
const { confirmarConsultaPaga } = await import('@/lib/agendamento/confirmar-consulta-paga');
const { confirmarAgendamento } = await import('@/app/(public)/_actions/agendamento');

const CLERK_DONO = 'user_paciente_dono';
const CLERK_OUTRO = 'user_paciente_outro';

async function limpar() {
  await db.delete(schema.logsAuditoria);
  await db.delete(schema.pagamentos);
  await db.delete(schema.consultas);
  await db.delete(schema.pacientes);
  await db.delete(schema.medicos);
  await db.delete(schema.users);
}

async function criarPaciente(clerkId: string) {
  const [user] = await db
    .insert(schema.users)
    .values({
      clerkId,
      email: `${clerkId}@teste.local`,
      nome: `Paciente ${clerkId}`,
      role: 'paciente',
    })
    .returning({ id: schema.users.id });
  const [paciente] = await db
    .insert(schema.pacientes)
    .values({ userId: user.id })
    .returning({ id: schema.pacientes.id });
  return { userId: user.id, pacienteId: paciente.id };
}

/** Médico SEM Google conectado: o Calendar nem é tentado, e a consulta vira 'agendada'. */
async function cenario(opcoes: { expiraEmMs?: number; status?: 'reservada' | 'agendada' } = {}) {
  const { expiraEmMs = 20 * 60 * 1000, status = 'reservada' } = opcoes;
  const [userMedico] = await db
    .insert(schema.users)
    .values({
      clerkId: 'user_medico_confirma',
      email: 'medico@teste.local',
      nome: 'Dra. Teste',
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

  const dono = await criarPaciente(CLERK_DONO);
  await criarPaciente(CLERK_OUTRO);

  const dataHora = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  const [consulta] = await db
    .insert(schema.consultas)
    .values({
      pacienteId: dono.pacienteId,
      medicoId: medico.id,
      dataHora,
      status,
      expiraEm: status === 'reservada' ? new Date(Date.now() + expiraEmMs) : null,
    })
    .returning({ id: schema.consultas.id });
  const [pagamento] = await db
    .insert(schema.pagamentos)
    .values({
      consultaId: consulta.id,
      pacienteId: dono.pacienteId,
      medicoId: medico.id,
      dataHora,
      valor: '350.00',
    })
    .returning({ id: schema.pagamentos.id });

  return { consultaId: consulta.id, pagamentoId: pagamento.id, donoUserId: dono.userId };
}

async function ler(consultaId: string, pagamentoId: string) {
  const [consulta] = await db
    .select()
    .from(schema.consultas)
    .where(eq(schema.consultas.id, consultaId));
  const [pagamento] = await db
    .select()
    .from(schema.pagamentos)
    .where(eq(schema.pagamentos.id, pagamentoId));
  return { consulta, pagamento };
}

async function auditoriaDaConfirmacao(consultaId: string) {
  return db
    .select()
    .from(schema.logsAuditoria)
    .where(
      and(
        eq(schema.logsAuditoria.entidade, 'consultas'),
        eq(schema.logsAuditoria.entidadeId, consultaId),
      ),
    );
}

describe('a consulta paga se confirma — com sessão e sem ela', () => {
  beforeEach(async () => {
    sessao.clerkId = null;
    sessao.role = 'paciente';
    emails.paciente.mockClear();
    emails.medico.mockClear();
    calendario.criar.mockClear();
    await limpar();
  });

  afterAll(async () => {
    await limpar();
  });

  it('1. SEM sessão (o caminho do webhook): confirma, marca PAGO, audita sem autor, envia os e-mails', async () => {
    const c = await cenario();
    sessao.clerkId = null; // o Clerk não devolve ninguém

    const res = await confirmarConsultaPaga(c.consultaId);

    expect(res).toEqual({ sucesso: true, dados: { consultaId: c.consultaId, meetLink: '' } });
    const { consulta, pagamento } = await ler(c.consultaId, c.pagamentoId);
    expect(consulta.status).toBe('agendada');
    expect(consulta.expiraEm).toBeNull();
    expect(pagamento.status).toBe('pago');
    expect(pagamento.pagoEm).toBeInstanceOf(Date);
    expect(pagamento.confirmadoEm).toBeInstanceOf(Date);
    expect(pagamento.pagoEm?.getTime()).toBe(pagamento.confirmadoEm?.getTime());
    expect(pagamento.erroConfirmacao).toBeNull();

    const [registro] = await auditoriaDaConfirmacao(c.consultaId);
    expect(registro.userId).toBeNull();
    expect(registro.dadosDepois).toEqual({ status: 'agendada' });

    expect(emails.paciente).toHaveBeenCalledTimes(1);
    expect(emails.medico).toHaveBeenCalledTimes(1);
    expect(calendario.criar).not.toHaveBeenCalled(); // médico sem Google
  });

  it('2. a casca, com o paciente DONO, dá o mesmo resultado — e a auditoria tem o paciente', async () => {
    const c = await cenario();
    sessao.clerkId = CLERK_DONO;

    const res = await confirmarAgendamento({ consultaId: c.consultaId });

    expect(res).toEqual({ sucesso: true, dados: { consultaId: c.consultaId, meetLink: '' } });
    const { consulta, pagamento } = await ler(c.consultaId, c.pagamentoId);
    expect(consulta.status).toBe('agendada');
    expect(pagamento.status).toBe('pago');
    const [registro] = await auditoriaDaConfirmacao(c.consultaId);
    expect(registro.userId).toBe(c.donoUserId);
    expect(registro.dadosAntes).toEqual({ status: 'reservada' });
  });

  it('3. a casca recusa consulta de OUTRO paciente — mesma mensagem de antes, nada muda', async () => {
    const c = await cenario();
    sessao.clerkId = CLERK_OUTRO;

    const res = await confirmarAgendamento({ consultaId: c.consultaId });

    expect(res).toEqual({ sucesso: false, erro: 'Reserva não encontrada.' });
    const { consulta, pagamento } = await ler(c.consultaId, c.pagamentoId);
    expect(consulta.status).toBe('reservada');
    expect(pagamento.status).toBe('pendente');
    expect(emails.paciente).not.toHaveBeenCalled();
  });

  it('3b. sem sessão, a casca nem chega à confirmação', async () => {
    const c = await cenario();
    sessao.clerkId = null;

    const res = await confirmarAgendamento({ consultaId: c.consultaId });

    expect(res.sucesso).toBe(false);
    expect((await ler(c.consultaId, c.pagamentoId)).consulta.status).toBe('reservada');
  });

  it('4. reserva vencida é cancelada — mesma mensagem e mesmo registro de antes', async () => {
    const c = await cenario({ expiraEmMs: -60 * 1000 });
    sessao.clerkId = CLERK_DONO;

    const res = await confirmarAgendamento({ consultaId: c.consultaId });

    expect(res).toEqual({
      sucesso: false,
      erro: 'O prazo da reserva expirou antes da confirmação. Escolha um novo horário.',
    });
    const { consulta, pagamento } = await ler(c.consultaId, c.pagamentoId);
    expect(consulta.status).toBe('cancelada');
    expect(consulta.expiraEm).toBeNull();
    expect(pagamento.erroConfirmacao).toBe('O prazo da reserva expirou antes da confirmação.');
    expect(pagamento.status).toBe('pendente'); // vencida não é paga
  });

  it('5. consulta já confirmada responde a mensagem de antes, sem reconfirmar', async () => {
    const c = await cenario({ status: 'agendada' });

    const res = await confirmarConsultaPaga(c.consultaId);

    expect(res).toEqual({
      sucesso: false,
      erro: 'Este agendamento já foi confirmado anteriormente.',
    });
    expect(emails.paciente).not.toHaveBeenCalled();
    expect((await ler(c.consultaId, c.pagamentoId)).pagamento.status).toBe('pendente');
  });
});
