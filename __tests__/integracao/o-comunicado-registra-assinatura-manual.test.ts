/**
 * O registro MANUAL da assinatura do comunicado — EXECUTADO contra Postgres real (DocuSign, e-mail
 * e store de arquivos simulados). Fluxo completo: o comunicado é enviado (pendente), o paciente
 * assina por outra plataforma, o admin anexa o arquivo — e o status vira `assinado` em todas as
 * telas que leem dele, sem duplicar documento nem mandar e-mail.
 *
 * Rodar: DATABASE_URL=postgresql://postgres:local@localhost:5544/behemp *   npx vitest run --config vitest.integracao.mts __tests__/integracao/o-comunicado-registra-assinatura-manual.test.ts
 */
import { NextRequest } from 'next/server';
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
  envelopeSeq: 0,
  statusDoEnvelope: 'sent',
  baixarPdf: vi.fn(async () => Buffer.from('%PDF-do-docusign')),
};
vi.mock('@/lib/docusign/docusign-service', () => ({
  docusignConfigurado: () => true,
  criarEnvelopeComunicado: async () => ({
    sucesso: true,
    envelopeId: `env-${++docusign.envelopeSeq}`,
  }),
  // O envelope segue aberto: o paciente assinou por OUTRA plataforma. Depois, "completed" simula o
  // paciente assinando também no DocuSign (webhook tardio).
  consultarStatusDoEnvelope: async () => ({
    sucesso: true,
    dados: { status: docusign.statusDoEnvelope, completedDateTime: '2026-10-30T12:00:00Z' },
  }),
  downloadPdfAssinado: (...a: unknown[]) =>
    (docusign.baixarPdf as (...x: unknown[]) => unknown)(...a),
  gerarUrlAssinaturaComunicado: async () => ({ sucesso: true, url: 'https://x' }),
}));

const emails = {
  envio: vi.fn(async () => {}),
  confirmacao: vi.fn(async () => {}),
  docs: vi.fn(async () => {}),
};
vi.mock('@/lib/email/comunicados', () => ({
  enviarEmailDeEnvio: (...a: unknown[]) => (emails.envio as (...x: unknown[]) => unknown)(...a),
  enviarEmailConfirmacaoPaciente: (...a: unknown[]) =>
    (emails.confirmacao as (...x: unknown[]) => unknown)(...a),
  enviarEmailNotificacaoDocs: (...a: unknown[]) =>
    (emails.docs as (...x: unknown[]) => unknown)(...a),
  LINK_DOS_COMUNICADOS: () => 'https://exemplo.invalid/paciente/documentos#comunicados',
}));

/** Store de arquivos em memória: mostra o que foi guardado, lido e apagado. */
const store = {
  arquivos: new Map<string, { bytes: Uint8Array; contentType: string }>(),
  apagados: [] as string[],
  aoGuardar: null as null | (() => Promise<void>),
};
vi.mock('@/lib/documentos/store-privado', () => ({
  guardarDocumentoPrivado: async (
    caminho: string,
    corpo: Uint8Array,
    opcoes?: { contentType?: string },
  ) => {
    await store.aoGuardar?.();
    const url = `https://x.private.blob.vercel-storage.com/${caminho}`;
    store.arquivos.set(url, {
      bytes: new Uint8Array(corpo),
      contentType: opcoes?.contentType ?? 'application/octet-stream',
    });
    return { url, pathname: caminho };
  },
  lerDocumentoPrivado: async (url: string) => {
    const a = store.arquivos.get(url);
    if (!a) return null;
    return {
      stream: new Response(new Blob([a.bytes as BlobPart])).body!,
      contentType: a.contentType,
    };
  },
  apagarDocumentoPrivado: async (url: string) => {
    store.apagados.push(url);
    store.arquivos.delete(url);
  },
  ehDoStorePrivado: () => true,
}));

const { db } = await import('@/lib/db');
const schema = await import('@/db/schema');
const acoes = await import('@/app/_actions/comunicados');
const lib = await import('@/lib/comunicados/assinatura');
const rotaManual = await import('@/app/api/comunicados/[id]/assinatura-manual/route');
const rotaArquivo = await import('@/app/api/comunicados/[id]/arquivo/route');
const { eq, sql } = await import('drizzle-orm');

const como = (clerkId: string, role: string) => {
  sessao.clerkId = clerkId;
  sessao.role = role;
};

const PDF = () => new TextEncoder().encode('%PDF-1.7 assinado fora do sistema');
const PNG = () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

let ip = 0;
/** Cada chamada de um IP diferente: o limite de 10/min é por chamador e não é o assunto aqui. */
async function registrar(
  comunicadoId: string,
  o: {
    arquivo?: { bytes: Uint8Array; tipo: string; nome: string } | null;
    data?: string;
    observacao?: string;
  } = {},
) {
  const form = new FormData();
  const a =
    o.arquivo === undefined
      ? { bytes: PDF(), tipo: 'application/pdf', nome: 'carta-assinada.pdf' }
      : o.arquivo;
  if (a) form.append('arquivo', new File([a.bytes as BlobPart], a.nome, { type: a.tipo }));
  form.append('dataAssinatura', o.data ?? '2026-10-20');
  if (o.observacao !== undefined) form.append('observacao', o.observacao);
  const req = new NextRequest(
    `http://localhost/api/comunicados/${comunicadoId}/assinatura-manual`,
    {
      method: 'POST',
      body: form,
      headers: { 'x-forwarded-for': `10.1.0.${++ip}` },
    },
  );
  const res = await rotaManual.POST(req, { params: Promise.resolve({ id: comunicadoId }) });
  return { status: res.status, corpo: (await res.json()) as { sucesso: boolean; erro?: string } };
}

async function baixar(comunicadoId: string) {
  const req = new NextRequest(`http://localhost/api/comunicados/${comunicadoId}/arquivo`, {
    headers: { 'x-forwarded-for': `10.2.0.${++ip}` },
  });
  return rotaArquivo.GET(req, { params: Promise.resolve({ id: comunicadoId }) });
}

/**
 * 🔴 TRUNCATE ... CASCADE apaga tudo o que aponta para users/pacientes — outros testes de integração
 * deixam documentos, consultas etc. no banco local, e um DELETE simples esbarra nessas FKs.
 * Por isso o teste RECUSA rodar contra qualquer banco que não seja local.
 */
async function limpar() {
  const host = new URL(process.env.DATABASE_URL ?? 'postgresql://x@invalido/x').hostname;
  if (host !== 'localhost' && host !== '127.0.0.1') {
    throw new Error(`Este teste apaga dados e só roda em banco local (host: ${host}).`);
  }
  await db.execute(
    sql`TRUNCATE TABLE comunicados_assinatura, logs_auditoria, pacientes, users CASCADE`,
  );
}

async function criarPaciente(chave: string): Promise<string> {
  const [u] = await db
    .insert(schema.users)
    .values({
      clerkId: `ck_${chave}`,
      email: `${chave}@teste.invalid`,
      nome: `Paciente ${chave}`,
      role: 'paciente',
    })
    .returning({ id: schema.users.id });
  const [p] = await db
    .insert(schema.pacientes)
    .values({ userId: u.id, cpf: '111.111.111-11' })
    .returning({ id: schema.pacientes.id });
  return p.id;
}

/** Cria o paciente e deixa o comunicado PENDENTE, como o admin o enviaria. */
async function pendenteDe(chave: string): Promise<{ pacienteId: string; comunicadoId: string }> {
  const pacienteId = await criarPaciente(chave);
  como('ck_adm', 'admin');
  const env = await acoes.enviarComunicadoAtualizacaoDoacao(pacienteId);
  if (!env.sucesso) throw new Error(`envio falhou: ${env.erro}`);
  return { pacienteId, comunicadoId: env.dados.comunicadoId };
}

const linhas = () => db.select().from(schema.comunicadosAssinatura);
const linha = async (id: string) =>
  (
    await db
      .select()
      .from(schema.comunicadosAssinatura)
      .where(eq(schema.comunicadosAssinatura.id, id))
  )[0];

beforeEach(async () => {
  await limpar();
  await db.insert(schema.users).values({
    clerkId: 'ck_adm',
    email: 'adm@teste.invalid',
    nome: 'Admin Teste',
    role: 'admin',
  });
  await db.insert(schema.users).values({
    clerkId: 'ck_med',
    email: 'med@teste.invalid',
    nome: 'Médico Teste',
    role: 'medico',
  });
  como('ck_adm', 'admin');
  docusign.envelopeSeq = 0;
  docusign.statusDoEnvelope = 'sent';
  docusign.baixarPdf.mockClear();
  emails.envio.mockReset().mockResolvedValue(undefined);
  emails.confirmacao.mockReset().mockResolvedValue(undefined);
  emails.docs.mockReset().mockResolvedValue(undefined);
  store.arquivos.clear();
  store.apagados.length = 0;
  store.aoGuardar = null;
});
afterAll(limpar);

describe('o fluxo completo: pendente → registro manual → assinado em todas as telas', () => {
  it('marca assinado na MESMA linha, guarda o arquivo, e não duplica nem manda e-mail', async () => {
    const { pacienteId, comunicadoId } = await pendenteDe('p1');
    expect((await linha(comunicadoId)).status).toBe('pendente');
    emails.envio.mockClear();

    const r = await registrar(comunicadoId, {
      observacao: 'Assinado em outra plataforma, enviado por WhatsApp',
    });
    expect(r).toEqual({ status: 200, corpo: { sucesso: true } });

    // 1) a linha: a MESMA, agora assinada e marcada como manual
    const todas = await linhas();
    expect(todas).toHaveLength(1); // nenhum documento duplicado
    const c = todas[0];
    expect(c.id).toBe(comunicadoId);
    expect(c.status).toBe('assinado');
    expect(c.assinadoEm?.toISOString()).toBe('2026-10-20T15:00:00.000Z'); // a data informada, 12h de Brasília
    expect(c.urlPdfAssinado).toContain(
      `comunicados/${pacienteId}/${comunicadoId}-assinado-manual-`,
    );
    expect(c.registroManualEm).not.toBeNull();
    expect(c.registroManualNomeArquivo).toBe('carta-assinada.pdf');
    expect(c.registroManualObservacao).toBe('Assinado em outra plataforma, enviado por WhatsApp');
    const [admin] = await db.select().from(schema.users).where(eq(schema.users.clerkId, 'ck_adm'));
    expect(c.registroManualPorUserId).toBe(admin.id);
    expect(c.docusignEnvelopeId).toBe('env-1'); // o histórico do envio continua na linha
    expect(c.erro).toBeNull();

    // 2) o arquivo foi guardado, uma vez, em store privado
    expect(store.arquivos.size).toBe(1);
    expect(store.arquivos.get(c.urlPdfAssinado!)?.contentType).toBe('application/pdf');

    // 3) nenhum e-mail saiu: este registro não é DocuSign
    expect(emails.confirmacao).not.toHaveBeenCalled();
    expect(emails.docs).not.toHaveBeenCalled();
    expect(emails.envio).not.toHaveBeenCalled();
  });

  it('o admin vê que foi manual, por quem e quando — e o paciente vê só "assinado"', async () => {
    const { pacienteId, comunicadoId } = await pendenteDe('p1');
    await registrar(comunicadoId, { observacao: 'por WhatsApp' });

    const doAdmin = await lib.listarParaAdmin(pacienteId);
    expect(doAdmin).toHaveLength(1);
    expect(doAdmin[0].status).toBe('assinado');
    expect(doAdmin[0].temArquivoAssinado).toBe(true);
    expect(doAdmin[0].registroManual?.porNome).toBe('Admin Teste');
    expect(doAdmin[0].registroManual?.observacao).toBe('por WhatsApp');
    expect(doAdmin[0].registroManual?.nomeDoArquivo).toBe('carta-assinada.pdf');
    expect(JSON.stringify(doAdmin)).not.toContain('blob.vercel-storage'); // nenhuma URL vai à tela

    como('ck_p1', 'paciente');
    const meus = await acoes.listarMeusComunicados();
    expect(meus.sucesso).toBe(true);
    if (!meus.sucesso) return;
    expect(meus.dados).toHaveLength(1);
    expect(meus.dados[0].status).toBe('assinado');
    expect(meus.dados[0].temArquivoAssinado).toBe(true);
    expect(JSON.stringify(meus.dados)).not.toMatch(/registroManual|blob\.vercel/);

    // O dashboard (AvisoDeDocumentoParaAssinar) só conta `pendente`: o card grande some.
    expect(meus.dados.filter((x) => x.status === 'pendente')).toHaveLength(0);
  });

  it('o arquivo abre pela rota autenticada: o admin e o paciente dono, e mais ninguém', async () => {
    const { comunicadoId } = await pendenteDe('p1');
    await criarPaciente('p2');
    await registrar(comunicadoId);

    como('ck_adm', 'admin');
    const doAdmin = await baixar(comunicadoId);
    expect(doAdmin.status).toBe(200);
    expect(doAdmin.headers.get('content-type')).toBe('application/pdf');
    expect(await doAdmin.text()).toContain('%PDF-1.7 assinado fora do sistema');

    como('ck_p1', 'paciente');
    expect((await baixar(comunicadoId)).status).toBe(200);

    como('ck_p2', 'paciente'); // outro paciente
    expect((await baixar(comunicadoId)).status).toBe(404);
    como('ck_med', 'medico');
    expect((await baixar(comunicadoId)).status).toBe(404);
  });

  it('uma foto (PNG) enviada pelo WhatsApp abre como PNG, e não como um PDF quebrado', async () => {
    const { comunicadoId } = await pendenteDe('p1');
    const r = await registrar(comunicadoId, {
      arquivo: { bytes: PNG(), tipo: 'image/png', nome: 'foto-da-carta.png' },
    });
    expect(r.status).toBe(200);

    como('ck_adm', 'admin');
    const res = await baixar(comunicadoId);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('content-disposition')).toContain('-assinado.png');
  });

  it('o webhook tardio do envelope aberto NÃO manda e-mail nem troca o arquivo', async () => {
    const { comunicadoId } = await pendenteDe('p1');
    await registrar(comunicadoId);
    const antes = await linha(comunicadoId);

    // o paciente também assina no DocuSign, e o webhook chega
    docusign.statusDoEnvelope = 'completed';
    const sync = await lib.sincronizarComunicado(comunicadoId);

    expect(sync.status).toBe('assinado');
    expect(sync.finalizacaoPendente).toBe(false);
    const depois = await linha(comunicadoId);
    expect(depois.urlPdfAssinado).toBe(antes.urlPdfAssinado); // o arquivo do admin continua
    expect(depois.assinadoEm?.toISOString()).toBe(antes.assinadoEm?.toISOString());
    expect(docusign.baixarPdf).not.toHaveBeenCalled();
    expect(emails.confirmacao).not.toHaveBeenCalled();
    expect(emails.docs).not.toHaveBeenCalled();
  });

  it('fica auditado: quem, o quê e de que estado para qual', async () => {
    const { comunicadoId } = await pendenteDe('p1');
    await registrar(comunicadoId, { observacao: 'x' });

    const logs = await db
      .select()
      .from(schema.logsAuditoria)
      .where(eq(schema.logsAuditoria.entidadeId, comunicadoId));
    const registro = logs.find(
      (l) => (l.dadosDepois as { origem?: string } | null)?.origem === 'registro_manual',
    );
    expect(registro).toBeDefined();
    expect(registro?.acao).toBe('atualizar');
    expect((registro?.dadosAntes as { status: string }).status).toBe('pendente');
    expect((registro?.dadosDepois as { status: string }).status).toBe('assinado');
    expect(JSON.stringify(registro)).not.toMatch(/blob\.vercel-storage/);
  });

  it('o fluxo pode ser reiniciado depois: nada é apagado e um novo envio é possível', async () => {
    const { comunicadoId } = await pendenteDe('p1');
    await registrar(comunicadoId);
    const urlAntes = (await linha(comunicadoId)).urlPdfAssinado;

    const r = await acoes.reiniciarFluxoDoComunicado(
      comunicadoId,
      'carta atualizada, assinar de novo',
    );
    expect(r.sucesso).toBe(true);

    const c = await linha(comunicadoId);
    expect(c.status).toBe('cancelado');
    expect(c.urlPdfAssinado).toBe(urlAntes); // o arquivo do registro manual fica no histórico
    expect(c.registroManualEm).not.toBeNull(); // e a marca de manual também
    expect(store.apagados).toHaveLength(0);

    const novo = await acoes.enviarComunicadoAtualizacaoDoacao(c.pacienteId);
    expect(novo.sucesso).toBe(true);
    expect(await linhas()).toHaveLength(2);
  });
});

describe('só o admin, e só de pendente', () => {
  it.each([
    ['médico', 'ck_med', 'medico'],
    ['paciente dono', 'ck_p1', 'paciente'],
    ['sem sessão', null, 'paciente'],
  ])('%s recebe 404 e nada muda', async (_nome, clerkId, role) => {
    const { comunicadoId } = await pendenteDe('p1');
    sessao.clerkId = clerkId;
    sessao.role = role;

    const r = await registrar(comunicadoId);

    expect(r.status).toBe(404);
    expect((await linha(comunicadoId)).status).toBe('pendente');
    expect(store.arquivos.size).toBe(0);
  });

  it('um comunicado JÁ assinado (pelo DocuSign) não é sobrescrito', async () => {
    const { comunicadoId } = await pendenteDe('p1');
    docusign.statusDoEnvelope = 'completed';
    await lib.sincronizarComunicado(comunicadoId);
    expect((await linha(comunicadoId)).status).toBe('assinado');
    const antes = await linha(comunicadoId);
    como('ck_adm', 'admin');

    const r = await registrar(comunicadoId);

    expect(r.status).toBe(409);
    expect(r.corpo.erro).toMatch(/já está assinado/);
    const depois = await linha(comunicadoId);
    expect(depois.urlPdfAssinado).toBe(antes.urlPdfAssinado);
    expect(depois.registroManualEm).toBeNull();
  });

  it('registrar duas vezes: a segunda é recusada, e só um arquivo foi guardado', async () => {
    const { comunicadoId } = await pendenteDe('p1');
    expect((await registrar(comunicadoId)).status).toBe(200);
    const segunda = await registrar(comunicadoId);
    expect(segunda.status).toBe(409);
    expect(store.arquivos.size).toBe(1);
    expect(await linhas()).toHaveLength(1);
  });

  it.each(['recusado', 'erro', 'cancelado'] as const)(
    'comunicado %s não aceita registro manual',
    async (status) => {
      const { comunicadoId } = await pendenteDe('p1');
      await db
        .update(schema.comunicadosAssinatura)
        .set({ status })
        .where(eq(schema.comunicadosAssinatura.id, comunicadoId));

      const r = await registrar(comunicadoId);

      expect(r.status).toBe(409);
      expect((await linha(comunicadoId)).status).toBe(status);
      expect(store.arquivos.size).toBe(0);
    },
  );

  it('o registro de um paciente não toca no comunicado de outro', async () => {
    const a = await pendenteDe('pa');
    const b = await pendenteDe('pb');
    como('ck_adm', 'admin');

    await registrar(a.comunicadoId);

    expect((await linha(a.comunicadoId)).status).toBe('assinado');
    expect((await linha(b.comunicadoId)).status).toBe('pendente');
    como('ck_pb', 'paciente');
    const meus = await acoes.listarMeusComunicados();
    expect(meus.sucesso && meus.dados[0].status).toBe('pendente'); // o aviso dele continua
  });

  it('id que não existe responde 404', async () => {
    const r = await registrar('nao-existe');
    expect(r.status).toBe(404);
  });
});

describe('o arquivo e a data são recusados no SERVIDOR', () => {
  it.each([
    ['PNG declarado como PDF', { bytes: PNG(), tipo: 'application/pdf', nome: 'x.pdf' }],
    [
      'executável',
      {
        bytes: new Uint8Array([0x4d, 0x5a, 0x90, 0, 1, 2]),
        tipo: 'application/pdf',
        nome: 'x.pdf',
      },
    ],
    ['tipo fora da lista', { bytes: PDF(), tipo: 'text/html', nome: 'x.html' }],
    ['sem arquivo', null],
  ])('%s → 400, e a linha segue pendente', async (_nome, arquivo) => {
    const { comunicadoId } = await pendenteDe('p1');
    const r = await registrar(comunicadoId, { arquivo });
    expect(r.status).toBe(400);
    expect((await linha(comunicadoId)).status).toBe('pendente');
    expect(store.arquivos.size).toBe(0);
  });

  it('arquivo acima do limite → 400, antes de ir à memória', async () => {
    const { comunicadoId } = await pendenteDe('p1');
    const grande = new Uint8Array(10 * 1024 * 1024 + 1);
    grande.set([0x25, 0x50, 0x44, 0x46]);
    const r = await registrar(comunicadoId, {
      arquivo: { bytes: grande, tipo: 'application/pdf', nome: 'grande.pdf' },
    });
    expect(r.status).toBe(400);
    expect(r.corpo.erro).toMatch(/limite/);
    expect((await linha(comunicadoId)).status).toBe('pendente');
  });

  it.each([['2999-01-01'], ['2026-02-30'], ['ontem'], ['']])('data "%s" → 400', async (data) => {
    const { comunicadoId } = await pendenteDe('p1');
    const r = await registrar(comunicadoId, { data });
    expect(r.status).toBe(400);
    expect((await linha(comunicadoId)).status).toBe('pendente');
  });

  it('observação acima de 500 caracteres → 400', async () => {
    const { comunicadoId } = await pendenteDe('p1');
    const r = await registrar(comunicadoId, { observacao: 'x'.repeat(501) });
    expect(r.status).toBe(400);
  });
});

describe('a corrida com o DocuSign', () => {
  it('se o webhook marcar assinado no meio, o registro manual perde, devolve erro e recolhe o arquivo', async () => {
    const { comunicadoId } = await pendenteDe('p1');
    // entre a leitura do status e o UPDATE do registro manual, o DocuSign confirma
    store.aoGuardar = async () => {
      await db
        .update(schema.comunicadosAssinatura)
        .set({ status: 'assinado', assinadoEm: new Date('2026-10-19T10:00:00Z') })
        .where(eq(schema.comunicadosAssinatura.id, comunicadoId));
    };

    const r = await registrar(comunicadoId);

    expect(r.status).toBe(409);
    expect(r.corpo.erro).toMatch(/mudou de situação/);
    const c = await linha(comunicadoId);
    expect(c.status).toBe('assinado');
    expect(c.registroManualEm).toBeNull(); // quem ganhou foi o DocuSign
    expect(c.assinadoEm?.toISOString()).toBe('2026-10-19T10:00:00.000Z');
    expect(store.arquivos.size).toBe(0); // o blob órfão foi recolhido
    expect(store.apagados).toHaveLength(1);
  });
});
