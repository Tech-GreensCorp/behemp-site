/**
 * O ENVIO EM LOTE do comunicado "Atualização do Programa de Doação", EXECUTADO contra um Postgres
 * de verdade — as duas actions novas (`previaDoLoteDeComunicados`, `resolverPacientesDasTriagens`)
 * e o laço do lote (cada paciente pela action individual).
 *
 * ⚠️ Duplos só nas FRONTEIRAS DE REDE (DocuSign, Brevo, store privado), como na integração irmã
 * `o-comunicado-so-assina-quem-o-docusign-confirma`. O envio real só se prova na conta com
 * credenciais.
 *
 * ## O que ele prova
 *
 *   1. a pré-checagem separa quem recebe de quem não (sem e-mail, sem CPF, já pendente, já
 *      assinado, ficha arquivada, id inexistente) — e um envio CANCELADO ou em ERRO não bloqueia
 *   2. só admin; paciente e médico recebem erro; vazio e mais de 25 são recusados
 *   3. a pré-checagem não escreve nada (nenhuma linha de comunicado, nenhum envelope, nenhum e-mail)
 *   4. a triagem casa o paciente pelo e-mail (caixa e espaços ignorados), e e-mail sem ficha,
 *      ficha arquivada e triagem sem e-mail dão `null`
 *   5. o lote de verdade: 3 elegíveis viram 3 envelopes, e repetir o lote não duplica nada
 *   6. uma falha no meio do lote (DocuSign recusa um) não impede os outros
 *
 * Rodar:
 *
 *   docker run -d --name behemp-pg-lote -e POSTGRES_PASSWORD=local -e POSTGRES_DB=behemp \
 *     -p 5544:5432 postgres:17-alpine
 *   DATABASE_URL=postgresql://postgres:local@localhost:5544/behemp npx drizzle-kit push --force
 *   DATABASE_URL=postgresql://postgres:local@localhost:5544/behemp \
 *     npx vitest run --config vitest.integracao.mts \
 *     __tests__/integracao/o-lote-do-comunicado-so-envia-a-quem-pode.test.ts
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
const { LIMITE_DO_LOTE } = await import('@/lib/comunicados/lote');
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

let adminId = '';
const linhas = () => db.select().from(schema.comunicadosAssinatura);
const situacoes = async (ids: string[]) => {
  const r = await acoes.previaDoLoteDeComunicados(ids);
  if (!r.sucesso) throw new Error(r.erro);
  return Object.fromEntries(r.dados.map((d) => [d.pacienteId, d.situacao]));
};

beforeEach(async () => {
  await limpar();
  const [adm] = await db
    .insert(schema.users)
    .values({ clerkId: 'ck_adm', email: 'adm@teste.invalid', nome: 'Admin Teste', role: 'admin' })
    .returning({ id: schema.users.id });
  adminId = adm.id;
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

describe('a pré-checagem separa quem recebe de quem não', () => {
  it('cada situação aparece como deve, e a pré-checagem não escreve nada', async () => {
    const ok = await criarPaciente({ chave: 'ok' });
    const semCpf = await criarPaciente({ chave: 'semcpf', cpf: null });
    const cpfEmBranco = await criarPaciente({ chave: 'cpfbranco', cpf: '   ' });
    const semEmail = await criarPaciente({ chave: 'sememail', email: '' });
    const pendente = await criarPaciente({ chave: 'pendente' });
    const assinado = await criarPaciente({ chave: 'assinado' });
    const cancelado = await criarPaciente({ chave: 'cancelado' });
    const emErro = await criarPaciente({ chave: 'erro' });
    const arquivado = await criarPaciente({ chave: 'arquivado', arquivado: true });

    const base = {
      tipo: 'atualizacao_programa_doacao',
      titulo: 'Atualização do Programa de Doação',
      nomeDestino: 'x',
      emailDestino: 'x@teste.invalid',
      enviadoPorUserId: adminId,
    };
    await db.insert(schema.comunicadosAssinatura).values([
      { ...base, pacienteId: pendente, status: 'pendente' },
      { ...base, pacienteId: assinado, status: 'assinado' },
      { ...base, pacienteId: cancelado, status: 'cancelado' },
      { ...base, pacienteId: emErro, status: 'erro' },
    ]);
    const antes = (await linhas()).length;

    const r = await situacoes([
      ok,
      semCpf,
      cpfEmBranco,
      semEmail,
      pendente,
      assinado,
      cancelado,
      emErro,
      arquivado,
      'id-que-nao-existe',
    ]);
    expect(r).toEqual({
      [ok]: 'elegivel',
      [semCpf]: 'sem_cpf',
      [cpfEmBranco]: 'sem_cpf',
      [semEmail]: 'sem_email',
      [pendente]: 'ja_enviado',
      [assinado]: 'ja_enviado',
      [cancelado]: 'elegivel', // fluxo reiniciado: pode receber de novo
      [emErro]: 'elegivel', // o envio nunca chegou ao paciente
      [arquivado]: 'nao_encontrado',
      'id-que-nao-existe': 'nao_encontrado',
    });

    // só leu: nenhuma linha nova, nenhum envelope, nenhum e-mail
    expect((await linhas()).length).toBe(antes);
    expect(docusign.criar).not.toHaveBeenCalled();
    expect(emails.envio).not.toHaveBeenCalled();
  });

  it('ids repetidos na entrada viram uma linha só', async () => {
    const ok = await criarPaciente({ chave: 'ok' });
    const r = await acoes.previaDoLoteDeComunicados([ok, ok, ok]);
    expect(r.sucesso && r.dados).toHaveLength(1);
  });

  it('o envio de OUTRO tipo de comunicado não bloqueia este', async () => {
    const p = await criarPaciente({ chave: 'outro' });
    await db.insert(schema.comunicadosAssinatura).values({
      pacienteId: p,
      tipo: 'outro_comunicado',
      titulo: 'Outro',
      status: 'pendente',
      nomeDestino: 'x',
      emailDestino: 'x@teste.invalid',
      enviadoPorUserId: adminId,
    });
    expect((await situacoes([p]))[p]).toBe('elegivel');
  });
});

describe('só admin, de 1 a 25', () => {
  it.each([
    ['paciente', 'ck_pac'],
    ['medico', 'ck_med'],
  ])('%s recebe erro nas duas actions', async (role, clerkId) => {
    const p = await criarPaciente({ chave: 'pac' });
    como(clerkId, role);
    expect((await acoes.previaDoLoteDeComunicados([p])).sucesso).toBe(false);
    expect((await acoes.resolverPacientesDasTriagens(['t1'])).sucesso).toBe(false);
  });

  it('sem sessão, também', async () => {
    sessao.clerkId = null;
    expect((await acoes.previaDoLoteDeComunicados(['x'])).sucesso).toBe(false);
  });

  it('vazio e acima do teto são recusados no servidor', async () => {
    expect((await acoes.previaDoLoteDeComunicados([])).sucesso).toBe(false);
    const muitos = Array.from({ length: LIMITE_DO_LOTE + 1 }, (_, i) => `id-${i}`);
    const r = await acoes.previaDoLoteDeComunicados(muitos);
    expect(r).toMatchObject({ sucesso: false });
    expect((await acoes.resolverPacientesDasTriagens(muitos)).sucesso).toBe(false);
    // no teto exato, passa
    const noTeto = Array.from({ length: LIMITE_DO_LOTE }, (_, i) => `id-${i}`);
    expect((await acoes.previaDoLoteDeComunicados(noTeto)).sucesso).toBe(true);
  });
});

describe('a triagem casa o paciente pelo e-mail', () => {
  const triagem = (emailContato: string | null) =>
    db
      .insert(schema.triagens)
      .values({ dados: {}, emailContato, nomeContato: 'Fulano' })
      .returning({ id: schema.triagens.id })
      .then(([t]) => t.id);

  it('ignora caixa e espaços; sem ficha, ficha arquivada e sem e-mail dão null', async () => {
    const maria = await criarPaciente({ chave: 'maria', email: 'maria@teste.invalid' });
    await criarPaciente({ chave: 'arq', email: 'arq@teste.invalid', arquivado: true });

    const t1 = await triagem('  MARIA@Teste.Invalid ');
    const t2 = await triagem('ninguem@teste.invalid');
    const t3 = await triagem('arq@teste.invalid');
    const t4 = await triagem(null);
    const t5 = await triagem('maria@teste.invalid'); // segunda triagem da mesma pessoa
    // o e-mail da FICHA é que está sujo (caixa mista e espaço): o SQL também normaliza o seu lado
    const joana = await criarPaciente({ chave: 'joana', email: ' Joana@Teste.Invalid ' });
    const t6 = await triagem('joana@teste.invalid');

    const r = await acoes.resolverPacientesDasTriagens([
      t1,
      t2,
      t3,
      t4,
      t5,
      t6,
      'triagem-inexistente',
    ]);
    expect(r.sucesso).toBe(true);
    const mapa = Object.fromEntries(
      (r.sucesso ? r.dados : []).map((x) => [x.triagemId, x.pacienteId]),
    );
    expect(mapa[t1]).toBe(maria);
    expect(mapa[t2]).toBeNull();
    expect(mapa[t3]).toBeNull();
    expect(mapa[t4]).toBeNull();
    expect(mapa[t5]).toBe(maria);
    expect(mapa[t6]).toBe(joana);
    // triagem que não existe também vira null (a tela a lista como "sem cadastro")
    expect(mapa['triagem-inexistente']).toBeNull();
  });
});

describe('o lote de verdade: cada um pela action individual', () => {
  it('3 elegíveis viram 3 envelopes; repetir o lote não duplica nada', async () => {
    const ids = [
      await criarPaciente({ chave: 'a' }),
      await criarPaciente({ chave: 'b' }),
      await criarPaciente({ chave: 'c' }),
    ];
    for (const id of ids) {
      expect(await acoes.enviarComunicadoAtualizacaoDoacao(id)).toMatchObject({ sucesso: true });
    }
    expect(docusign.criar).toHaveBeenCalledTimes(3);
    expect(emails.envio).toHaveBeenCalledTimes(3);
    expect((await linhas()).filter((l) => l.status === 'pendente')).toHaveLength(3);

    // a pré-checagem já os enxerga como "já recebeu", e forçar o envio de novo é recusado pelo banco
    expect(Object.values(await situacoes(ids))).toEqual(['ja_enviado', 'ja_enviado', 'ja_enviado']);
    for (const id of ids) {
      expect(await acoes.enviarComunicadoAtualizacaoDoacao(id)).toMatchObject({ sucesso: false });
    }
    expect(docusign.criar).toHaveBeenCalledTimes(3);
    expect(await linhas()).toHaveLength(3);
  });

  it('o DocuSign recusar UM não impede os outros, e o recusado pode ser reenviado', async () => {
    const [a, b, c] = [
      await criarPaciente({ chave: 'a' }),
      await criarPaciente({ chave: 'b' }),
      await criarPaciente({ chave: 'c' }),
    ];
    docusign.criar
      .mockReset()
      .mockResolvedValueOnce({ sucesso: true, envelopeId: 'env-a' })
      .mockResolvedValueOnce({ sucesso: false, erro: 'fora do ar' })
      .mockResolvedValueOnce({ sucesso: true, envelopeId: 'env-c' });

    const resultados = [];
    for (const id of [a, b, c]) resultados.push(await acoes.enviarComunicadoAtualizacaoDoacao(id));
    expect(resultados.map((r) => r.sucesso)).toEqual([true, false, true]);

    const porPaciente = Object.fromEntries((await linhas()).map((l) => [l.pacienteId, l.status]));
    expect(porPaciente).toEqual({ [a]: 'pendente', [b]: 'erro', [c]: 'pendente' });

    // o que falhou volta a ser elegível numa nova rodada do lote
    expect(await situacoes([a, b, c])).toEqual({
      [a]: 'ja_enviado',
      [b]: 'elegivel',
      [c]: 'ja_enviado',
    });
    docusign.criar.mockResolvedValue({ sucesso: true, envelopeId: 'env-b2' });
    expect(await acoes.enviarComunicadoAtualizacaoDoacao(b)).toMatchObject({ sucesso: true });
    const [lb] = await db
      .select()
      .from(schema.comunicadosAssinatura)
      .where(eq(schema.comunicadosAssinatura.docusignEnvelopeId, 'env-b2'));
    expect(lb.pacienteId).toBe(b);
  });
});
