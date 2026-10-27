/**
 * "Cancelar e reenviar" um comunicado pendente — EXECUTADO contra Postgres real (DocuSign e
 * e-mail simulados). O envio velho carrega o e-mail da época (signatário do envelope); o novo sai
 * com o e-mail ATUAL do paciente, e o velho fica no histórico como cancelado.
 *
 * Rodar: DATABASE_URL=postgresql://postgres:local@localhost:5544/behemp  *   npx vitest run --config vitest.integracao.mts __tests__/integracao/o-comunicado-cancela-e-reenvia.test.ts
 */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const sessao = { clerkId: null as string | null, role: 'paciente' as string };

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

const docusign = {
  criar: vi.fn(),
  envelopeSeq: 0,
};
vi.mock('@/lib/docusign/docusign-service', () => ({
  docusignConfigurado: () => true,
  criarEnvelopeComunicado: (...a: unknown[]) => docusign.criar(...a),
  consultarStatusDoEnvelope: async () => ({ sucesso: true, dados: { status: 'sent' } }),
  downloadPdfAssinado: async () => Buffer.from('%PDF'),
  gerarUrlAssinaturaComunicado: async () => ({ sucesso: true, url: 'https://x' }),
}));

const emails = { envio: vi.fn(async () => {}) };
vi.mock('@/lib/email/comunicados', () => ({
  enviarEmailDeEnvio: (...a: unknown[]) => (emails.envio as (...x: unknown[]) => unknown)(...a),
  enviarEmailConfirmacaoPaciente: async () => {},
  enviarEmailNotificacaoDocs: async () => {},
  LINK_DOS_COMUNICADOS: () => 'https://exemplo.invalid/paciente/documentos#comunicados',
}));
vi.mock('@/lib/documentos/store-privado', () => ({
  guardarDocumentoPrivado: async (c: string) => ({ url: `https://x/${c}`, pathname: c }),
  lerDocumentoPrivado: async () => null,
  apagarDocumentoPrivado: async () => {},
  ehDoStorePrivado: () => true,
}));

const { db } = await import('@/lib/db');
const schema = await import('@/db/schema');
const acoes = await import('@/app/_actions/comunicados');
const { eq } = await import('drizzle-orm');

const como = (clerkId: string, role: string) => {
  sessao.clerkId = clerkId;
  sessao.role = role;
};

async function limpar() {
  await db.delete(schema.logsAuditoria);
  await db.delete(schema.comunicadosAssinatura);
  await db.delete(schema.triagens);
  await db.delete(schema.pacientes);
  await db.delete(schema.users);
}

/** Cria usuário + ficha. `cpf: null` e `email: ''` produzem os casos de dado faltante. */
async function criarPaciente(o: {
  chave: string;
  email?: string;
  cpf?: string | null;
  arquivado?: boolean;
}): Promise<string> {
  const [u] = await db
    .insert(schema.users)
    .values({
      clerkId: `ck_${o.chave}`,
      email: o.email ?? `${o.chave}@teste.invalid`,
      nome: `Paciente ${o.chave}`,
      role: 'paciente',
    })
    .returning({ id: schema.users.id });
  const [p] = await db
    .insert(schema.pacientes)
    .values({
      userId: u.id,
      cpf: o.cpf === undefined ? '111.111.111-11' : o.cpf,
      deletedAt: o.arquivado ? new Date() : null,
    })
    .returning({ id: schema.pacientes.id });
  return p.id;
}

const linhas = () => db.select().from(schema.comunicadosAssinatura);

beforeEach(async () => {
  await limpar();
  await db
    .insert(schema.users)
    .values({ clerkId: 'ck_adm', email: 'adm@teste.invalid', nome: 'Admin Teste', role: 'admin' })
    .returning({ id: schema.users.id });
  await db.insert(schema.users).values({
    clerkId: 'ck_med',
    email: 'med@teste.invalid',
    nome: 'Médico Teste',
    role: 'medico',
  });
  como('ck_adm', 'admin');
  docusign.envelopeSeq = 0;
  docusign.criar.mockReset().mockImplementation(async () => ({
    sucesso: true,
    envelopeId: `env-${++docusign.envelopeSeq}`,
  }));
  emails.envio.mockReset().mockResolvedValue(undefined);
});
afterAll(limpar);

describe('cancelar e reenviar', () => {
  it('o novo envio usa o e-mail ATUAL; o antigo vira cancelado e continua no histórico', async () => {
    const pac = await criarPaciente({ chave: 'p1', email: 'antigo@teste.invalid' });
    const env = await acoes.enviarComunicadoAtualizacaoDoacao(pac);
    expect(env.sucesso).toBe(true);
    const velhoId = env.sucesso ? env.dados.comunicadoId : '';

    // o e-mail muda DEPOIS do envio, sem passar pela action (estado de antes da correção)
    await db
      .update(schema.users)
      .set({ email: 'novo@teste.invalid' })
      .where(eq(schema.users.clerkId, 'ck_p1'));

    const r = await acoes.cancelarEReenviarComunicadoPendente(velhoId);
    expect(r.sucesso).toBe(true);

    const todas = await linhas();
    const velho = todas.find((c) => c.id === velhoId)!;
    const novo = todas.find((c) => c.id !== velhoId)!;
    expect(velho.status).toBe('cancelado');
    expect(velho.emailDestino).toBe('antigo@teste.invalid'); // histórico intacto
    expect(novo.status).toBe('pendente');
    expect(novo.emailDestino).toBe('novo@teste.invalid');
    expect(emails.envio).toHaveBeenLastCalledWith(
      expect.objectContaining({ para: expect.objectContaining({ email: 'novo@teste.invalid' }) }),
    );
  });

  it('só admin; e só comunicado pendente', async () => {
    const pac = await criarPaciente({ chave: 'p2' });
    const env = await acoes.enviarComunicadoAtualizacaoDoacao(pac);
    const id = env.sucesso ? env.dados.comunicadoId : '';

    como('ck_med', 'medico');
    expect((await acoes.cancelarEReenviarComunicadoPendente(id)).sucesso).toBe(false);
    como('ck_adm', 'admin');

    await db
      .update(schema.comunicadosAssinatura)
      .set({ status: 'assinado' })
      .where(eq(schema.comunicadosAssinatura.id, id));
    const r = await acoes.cancelarEReenviarComunicadoPendente(id);
    expect(r.sucesso).toBe(false);
    expect((await linhas()).find((c) => c.id === id)!.status).toBe('assinado');
  });

  it('se o novo envelope falhar, o antigo já está cancelado e a mensagem diz isso', async () => {
    const pac = await criarPaciente({ chave: 'p3' });
    const env = await acoes.enviarComunicadoAtualizacaoDoacao(pac);
    const id = env.sucesso ? env.dados.comunicadoId : '';
    docusign.criar.mockResolvedValueOnce({ sucesso: false, erro: 'DocuSign fora' });
    const r = await acoes.cancelarEReenviarComunicadoPendente(id);
    expect(r.sucesso).toBe(false);
    if (!r.sucesso) expect(r.erro).toMatch(/cancelado, mas o novo não saiu/);
    expect((await linhas()).find((c) => c.id === id)!.status).toBe('cancelado');
  });
});
