/**
 * O comunicado "Atualização do Programa de Doação", EXECUTADO contra um Postgres de verdade.
 *
 * 🔴 ISTO NÃO É GUARDA ESTRUTURAL: roda as actions, a rota de retorno e o webhook, e olha as
 * linhas que sobraram no banco.
 *
 * ⚠️ O QUE É DUPLO AQUI, e por quê: só as FRONTEIRAS DE REDE — a API do DocuSign, o Brevo e o
 * store privado da Vercel. Sem credenciais não há como chamá-las daqui; o que se prova é a nossa
 * lógica (escopo, idempotência, quem decide o status) contra o banco real. O envio de verdade
 * pelo DocuSign só se prova na conta com credenciais — ver o relatório de entrega.
 *
 * ## O que ele prova
 *
 *   1. admin envia: nasce UMA linha pendente, com envelope, responsável e e-mail de aviso
 *   2. clique duplo (duas chamadas ao mesmo tempo) e reenvio depois: UM envelope só
 *   3. paciente e médico não enviam; só admin
 *   4. quem não recebeu o disparo não vê o comunicado; um paciente não vê o do outro
 *   5. paciente não gera link de assinatura para o comunicado de outro (e a resposta é a mesma
 *      de "não existe")
 *   6. o retorno do paciente à tela, com `event=signing_complete` na URL, NÃO assina nada
 *   7. webhook com o DocuSign dizendo "sent" não assina; dizendo "completed" assina
 *   8. reprocessar o webhook 3 vezes: um PDF guardado, UM e-mail ao paciente, UM a docs@
 *   9. falha do e-mail a docs@ devolve a trava e a próxima tentativa envia — sem repetir o do paciente
 *  10. falha do DocuSign no envio: status `erro`, paciente não vê, admin pode reenviar
 *  11. recusa no DocuSign libera novo envio e o histórico fica
 *  12. o PDF assinado só abre para o dono e para o admin — médico e outro paciente recebem 404
 *
 * Rodar:
 *
 *   docker start behemp-pg || docker run -d --name behemp-pg \
 *     -e POSTGRES_PASSWORD=local -e POSTGRES_DB=behemp -p 5544:5432 postgres:16
 *   DATABASE_URL=postgresql://postgres:local@localhost:5544/behemp npx drizzle-kit push --force
 *   DATABASE_URL=postgresql://postgres:local@localhost:5544/behemp \
 *     npx vitest run --config vitest.integracao.mts \
 *     __tests__/integracao/o-comunicado-so-assina-quem-o-docusign-confirma.test.ts
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';

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

// ── As fronteiras de rede ─────────────────────────────────────

const docusign = {
  configurado: true,
  criar: vi.fn(),
  statusDoEnvelope: 'sent',
  consultaFalha: false,
  baixarPdf: vi.fn(),
  link: vi.fn(),
  envelopeSeq: 0,
};
vi.mock('@/lib/docusign/docusign-service', () => ({
  docusignConfigurado: () => docusign.configurado,
  criarEnvelopeComunicado: (...a: unknown[]) => docusign.criar(...a),
  consultarStatusDoEnvelope: async () =>
    docusign.consultaFalha
      ? { sucesso: false, erro: 'fora do ar' }
      : {
          sucesso: true,
          dados: { status: docusign.statusDoEnvelope, completedDateTime: '2026-10-15T15:30:00Z' },
        },
  downloadPdfAssinado: (...a: unknown[]) => docusign.baixarPdf(...a),
  gerarUrlAssinaturaComunicado: (...a: unknown[]) => docusign.link(...a),
}));

const emails = {
  envio: vi.fn(async () => {}),
  confirmacao: vi.fn(async () => {}),
  docs: vi.fn<(d: unknown) => Promise<void>>(async () => {}),
};
vi.mock('@/lib/email/comunicados', () => ({
  enviarEmailDeEnvio: (...a: unknown[]) => (emails.envio as (...x: unknown[]) => unknown)(...a),
  enviarEmailConfirmacaoPaciente: (...a: unknown[]) =>
    (emails.confirmacao as (...x: unknown[]) => unknown)(...a),
  enviarEmailNotificacaoDocs: (...a: unknown[]) =>
    (emails.docs as (...x: unknown[]) => unknown)(...a),
}));

const loja = { guardados: [] as string[], put: vi.fn() };
vi.mock('@/lib/documentos/store-privado', () => ({
  guardarDocumentoPrivado: async (caminho: string) => {
    loja.guardados.push(caminho);
    return { url: `https://x.private.blob.vercel-storage.com/${caminho}`, pathname: caminho };
  },
  lerDocumentoPrivado: async () => ({
    stream: new Response('%PDF-1.4 assinado').body!,
    contentType: 'application/pdf',
  }),
  apagarDocumentoPrivado: async () => {},
  ehDoStorePrivado: (u: string) => u.includes('.private.blob.vercel-storage.com'),
}));

const { db } = await import('@/lib/db');
const schema = await import('@/db/schema');
const acoes = await import('@/app/_actions/comunicados');
const nucleo = await import('@/lib/comunicados/assinatura');
const rotaRetorno = await import('@/app/api/comunicados/[id]/retorno/route');
const rotaArquivo = await import('@/app/api/comunicados/[id]/arquivo/route');
const webhook = await import('@/app/api/webhooks/docusign/route');

const como = (clerkId: string, role: string) => {
  sessao.clerkId = clerkId;
  sessao.role = role;
};

async function limpar() {
  await db.delete(schema.logsAuditoria);
  await db.delete(schema.comunicadosAssinatura);
  await db.delete(schema.pacientes);
  await db.delete(schema.users);
}

let pa = '';
let pb = '';

async function cenario() {
  const us = await db
    .insert(schema.users)
    .values([
      { clerkId: 'ck_a', email: 'a@teste.invalid', nome: 'Paciente A', role: 'paciente' },
      { clerkId: 'ck_b', email: 'b@teste.invalid', nome: 'Paciente B', role: 'paciente' },
      { clerkId: 'ck_c', email: 'c@teste.invalid', nome: 'Paciente C', role: 'paciente' },
      { clerkId: 'ck_adm', email: 'adm@teste.invalid', nome: 'Admin Teste', role: 'admin' },
      { clerkId: 'ck_med', email: 'med@teste.invalid', nome: 'Médico Teste', role: 'medico' },
    ])
    .returning({ id: schema.users.id });
  const ps = await db
    .insert(schema.pacientes)
    .values([
      { userId: us[0].id, cpf: '111.111.111-11' },
      { userId: us[1].id, cpf: '222.222.222-22' },
      { userId: us[2].id, cpf: '333.333.333-33' },
    ])
    .returning({ id: schema.pacientes.id });
  [pa, pb] = ps.map((p) => p.id);
}

const linhas = () => db.select().from(schema.comunicadosAssinatura);

beforeEach(async () => {
  await limpar();
  await cenario();
  docusign.configurado = true;
  docusign.statusDoEnvelope = 'sent';
  docusign.consultaFalha = false;
  docusign.envelopeSeq = 0;
  docusign.criar.mockReset().mockImplementation(async () => ({
    sucesso: true,
    envelopeId: `env-${++docusign.envelopeSeq}`,
  }));
  docusign.baixarPdf.mockReset().mockResolvedValue(Buffer.from('%PDF-1.4 assinado'));
  docusign.link
    .mockReset()
    .mockResolvedValue({ sucesso: true, url: 'https://demo.docusign.net/assine' });
  emails.envio.mockReset().mockResolvedValue(undefined);
  emails.confirmacao.mockReset().mockResolvedValue(undefined);
  emails.docs.mockReset().mockResolvedValue(undefined);
  loja.guardados.length = 0;
});
afterAll(limpar);

const GET = (url: string) => new Request(url) as never;

describe('o admin envia o comunicado', () => {
  it('nasce UMA linha pendente, com envelope, responsável e e-mail de aviso', async () => {
    como('ck_adm', 'admin');
    const r = await acoes.enviarComunicadoAtualizacaoDoacao(pa);
    expect(r).toMatchObject({ sucesso: true, dados: { emailEnviado: true } });

    const [c] = await linhas();
    expect(c).toMatchObject({
      pacienteId: pa,
      status: 'pendente',
      titulo: 'Atualização do Programa de Doação',
      docusignEnvelopeId: 'env-1',
      emailDestino: 'a@teste.invalid',
      nomeDestino: 'Paciente A',
    });
    expect(c.enviadoPorUserId).toBeTruthy();
    expect(c.emailEnvioEnviadoEm).not.toBeNull();
    expect(emails.envio).toHaveBeenCalledTimes(1);

    // o PDF que vai ao DocuSign leva o nome do paciente e as âncoras da assinatura
    const dadosDoEnvelope = docusign.criar.mock.calls[0][0] as {
      pdfBuffer: Buffer;
      clientUserId: string;
      pacienteEmail: string;
    };
    expect(dadosDoEnvelope.pdfBuffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(dadosDoEnvelope.clientUserId).toBe(`comunicado-${c.id}`);
    expect(dadosDoEnvelope.pacienteEmail).toBe('a@teste.invalid');
    // o PDF foi gerado de verdade (o conteúdo da carta é provado no guarda a-carta-do-docusign-e-a-carta-aprovada)
    expect(dadosDoEnvelope.pdfBuffer.length).toBeGreaterThan(10_000);

    const auditoria = await db.select().from(schema.logsAuditoria);
    expect(
      auditoria.some((a) => a.entidade === 'comunicados_assinatura' && a.acao === 'criar'),
    ).toBe(true);
  });

  it('clique duplo: duas chamadas ao mesmo tempo criam UM envelope só', async () => {
    como('ck_adm', 'admin');
    const [r1, r2] = await Promise.all([
      acoes.enviarComunicadoAtualizacaoDoacao(pa),
      acoes.enviarComunicadoAtualizacaoDoacao(pa),
    ]);
    expect([r1.sucesso, r2.sucesso].filter(Boolean)).toHaveLength(1);
    expect(docusign.criar).toHaveBeenCalledTimes(1);
    expect((await linhas()).filter((c) => c.status === 'pendente')).toHaveLength(1);
  });

  it('reenviar com um pendente ou assinado é recusado', async () => {
    como('ck_adm', 'admin');
    await acoes.enviarComunicadoAtualizacaoDoacao(pa);
    const r = await acoes.enviarComunicadoAtualizacaoDoacao(pa);
    expect(r).toMatchObject({ sucesso: false });
    expect(docusign.criar).toHaveBeenCalledTimes(1);
  });

  it('paciente e médico não enviam — só admin', async () => {
    como('ck_a', 'paciente');
    expect((await acoes.enviarComunicadoAtualizacaoDoacao(pb)).sucesso).toBe(false);
    como('ck_med', 'medico');
    expect((await acoes.enviarComunicadoAtualizacaoDoacao(pb)).sucesso).toBe(false);
    expect(await linhas()).toHaveLength(0);
    expect(docusign.criar).not.toHaveBeenCalled();
  });

  it('o e-mail de aviso falhar não desfaz o envio, e o admin pode reenviar o e-mail', async () => {
    como('ck_adm', 'admin');
    emails.envio.mockRejectedValueOnce(new Error('brevo fora'));
    const r = await acoes.enviarComunicadoAtualizacaoDoacao(pa);
    expect(r).toMatchObject({ sucesso: true, dados: { emailEnviado: false } });
    const [c] = await linhas();
    expect(c.status).toBe('pendente');
    expect(c.emailEnvioErro).not.toBeNull();

    const de = await acoes.reenviarEmailDoComunicado(c.id);
    expect(de.sucesso).toBe(true);
    const [depois] = await linhas();
    expect(depois.emailEnvioErro).toBeNull();
    expect(depois.emailEnvioEnviadoEm).not.toBeNull();
  });

  it('DocuSign recusa o envelope: status erro, paciente não vê, admin pode reenviar', async () => {
    como('ck_adm', 'admin');
    docusign.criar.mockResolvedValueOnce({
      sucesso: false,
      erro: 'DocuSign recusou o envelope (HTTP 400).',
    });
    const r = await acoes.enviarComunicadoAtualizacaoDoacao(pa);
    expect(r.sucesso).toBe(false);
    const [c] = await linhas();
    expect(c.status).toBe('erro');
    expect(c.erro).toContain('DocuSign');
    expect(emails.envio).not.toHaveBeenCalled();

    como('ck_a', 'paciente');
    expect(await acoes.listarMeusComunicados()).toMatchObject({ sucesso: true, dados: [] });

    como('ck_adm', 'admin');
    const de = await acoes.enviarComunicadoAtualizacaoDoacao(pa);
    expect(de.sucesso).toBe(true);
    expect(await linhas()).toHaveLength(2); // o histórico do erro fica
  });

  it('paciente sem CPF não recebe: a carta o exibe, e nada é gravado nem enviado', async () => {
    await db.update(schema.pacientes).set({ cpf: null }).where(eq(schema.pacientes.id, pb));
    como('ck_adm', 'admin');
    const r = await acoes.enviarComunicadoAtualizacaoDoacao(pb);
    expect(r).toMatchObject({ sucesso: false });
    expect(!r.sucesso && r.erro).toContain('CPF');
    expect(await linhas()).toHaveLength(0);
    expect(docusign.criar).not.toHaveBeenCalled();
    expect(emails.envio).not.toHaveBeenCalled();
  });

  it('sem DocuSign configurado nada é gravado', async () => {
    como('ck_adm', 'admin');
    docusign.configurado = false;
    const r = await acoes.enviarComunicadoAtualizacaoDoacao(pa);
    expect(r.sucesso).toBe(false);
    expect(await linhas()).toHaveLength(0);
  });
});

describe('quem vê o quê', () => {
  it('quem não recebeu o disparo não vê nada; o paciente A não vê o do B', async () => {
    como('ck_adm', 'admin');
    await acoes.enviarComunicadoAtualizacaoDoacao(pb);

    como('ck_a', 'paciente');
    expect(await acoes.listarMeusComunicados()).toMatchObject({ sucesso: true, dados: [] });
    como('ck_c', 'paciente');
    expect(await acoes.listarMeusComunicados()).toMatchObject({ sucesso: true, dados: [] });
    como('ck_b', 'paciente');
    const b = await acoes.listarMeusComunicados();
    expect(b.sucesso && b.dados).toHaveLength(1);
    expect(b.sucesso && b.dados[0].status).toBe('pendente');
  });

  it('o histórico do admin é do admin: paciente e médico recebem erro', async () => {
    como('ck_adm', 'admin');
    await acoes.enviarComunicadoAtualizacaoDoacao(pa);
    como('ck_a', 'paciente');
    expect((await acoes.listarComunicadosDoPaciente(pa)).sucesso).toBe(false);
    como('ck_med', 'medico');
    expect((await acoes.listarComunicadosDoPaciente(pa)).sucesso).toBe(false);
    como('ck_adm', 'admin');
    const ok = await acoes.listarComunicadosDoPaciente(pa);
    expect(ok.sucesso && ok.dados).toHaveLength(1);
    // o admin vê quem enviou e nunca a URL do arquivo
    expect(ok.sucesso && Object.keys(ok.dados[0])).not.toContain('urlPdfAssinado');
    expect(ok.sucesso && ok.dados[0].enviadoPorNome).toBe('Admin Teste');
  });

  it('o paciente não gera link para o comunicado de outro, e a resposta é a de "não existe"', async () => {
    como('ck_adm', 'admin');
    await acoes.enviarComunicadoAtualizacaoDoacao(pb);
    const [doB] = await linhas();

    como('ck_a', 'paciente');
    const alheio = await acoes.iniciarAssinaturaDoComunicado(doB.id);
    const inexistente = await acoes.iniciarAssinaturaDoComunicado('id-que-nao-existe');
    expect(alheio).toEqual(inexistente);
    expect(alheio.sucesso).toBe(false);
    expect(docusign.link).not.toHaveBeenCalled();

    como('ck_b', 'paciente');
    const meu = await acoes.iniciarAssinaturaDoComunicado(doB.id);
    expect(meu).toMatchObject({
      sucesso: true,
      dados: { url: 'https://demo.docusign.net/assine' },
    });
    const pedido = docusign.link.mock.calls[0][0] as {
      clientUserId: string;
      pacienteEmail: string;
    };
    expect(pedido.clientUserId).toBe(`comunicado-${doB.id}`);
    expect(pedido.pacienteEmail).toBe('b@teste.invalid');
  });

  it('o DocuSign fora do ar na hora do clique: não entrega link às cegas', async () => {
    como('ck_adm', 'admin');
    await acoes.enviarComunicadoAtualizacaoDoacao(pa);
    const [c] = await linhas();
    docusign.consultaFalha = true;
    como('ck_a', 'paciente');
    const r = await acoes.iniciarAssinaturaDoComunicado(c.id);
    expect(r.sucesso).toBe(false);
    expect(docusign.link).not.toHaveBeenCalled();
  });
});

describe('quem diz que assinou é o DocuSign', () => {
  async function enviado() {
    como('ck_adm', 'admin');
    await acoes.enviarComunicadoAtualizacaoDoacao(pa);
    const [c] = await linhas();
    return c;
  }

  it('o retorno à tela com event=signing_complete NÃO assina nada', async () => {
    const c = await enviado();
    como('ck_a', 'paciente');
    docusign.statusDoEnvelope = 'sent'; // o paciente fechou a aba sem assinar
    const resp = await rotaRetorno.GET(
      GET(`http://localhost/api/comunicados/${c.id}/retorno?event=signing_complete`),
      { params: Promise.resolve({ id: c.id }) },
    );
    expect(resp.status).toBe(307);
    const [depois] = await linhas();
    expect(depois.status).toBe('pendente');
    expect(depois.assinadoEm).toBeNull();
    expect(emails.confirmacao).not.toHaveBeenCalled();
    expect(emails.docs).not.toHaveBeenCalled();
  });

  it('o retorno de OUTRO paciente não sincroniza o comunicado alheio', async () => {
    const c = await enviado();
    docusign.statusDoEnvelope = 'completed';
    como('ck_b', 'paciente');
    await rotaRetorno.GET(GET(`http://localhost/api/comunicados/${c.id}/retorno`), {
      params: Promise.resolve({ id: c.id }),
    });
    expect((await linhas())[0].status).toBe('pendente');
  });

  it('webhook com o DocuSign dizendo "sent" não assina; "completed" assina e finaliza', async () => {
    const c = await enviado();
    const corpo = JSON.stringify({
      event: 'envelope-completed',
      data: { envelopeId: c.docusignEnvelopeId },
    });
    const chamar = () =>
      webhook.POST(
        new Request('http://localhost/api/webhooks/docusign', {
          method: 'POST',
          body: corpo,
        }) as never,
      );

    // O corpo MENTE (diz completed) mas a API diz sent: nada muda.
    docusign.statusDoEnvelope = 'sent';
    expect((await chamar()).status).toBe(200);
    expect((await linhas())[0].status).toBe('pendente');
    expect(emails.docs).not.toHaveBeenCalled();

    docusign.statusDoEnvelope = 'completed';
    const resp = await chamar();
    expect(resp.status).toBe(200);
    const [a] = await linhas();
    expect(a.status).toBe('assinado');
    expect(a.assinadoEm).not.toBeNull();
    expect(a.urlPdfAssinado).toContain('.private.blob.vercel-storage.com');
    expect(a.emailConfirmacaoPacienteEm).not.toBeNull();
    expect(a.emailNotificacaoDocsEm).not.toBeNull();
    expect(emails.confirmacao).toHaveBeenCalledTimes(1);
    expect(emails.docs).toHaveBeenCalledTimes(1);

    // a notificação a docs@ leva o PDF assinado em anexo
    const anexado = emails.docs.mock.calls[0][0] as { pdfAssinado: Buffer; pacienteNome: string };
    expect(anexado.pdfAssinado.toString()).toContain('%PDF');
    expect(anexado.pacienteNome).toBe('Paciente A');
  });

  it('reprocessar o webhook 3 vezes (e em paralelo) não repete PDF nem e-mail', async () => {
    const c = await enviado();
    docusign.statusDoEnvelope = 'completed';
    const corpo = JSON.stringify({
      event: 'envelope-completed',
      data: { envelopeId: c.docusignEnvelopeId },
    });
    const chamar = () =>
      webhook.POST(
        new Request('http://localhost/api/webhooks/docusign', {
          method: 'POST',
          body: corpo,
        }) as never,
      );
    await Promise.all([chamar(), chamar(), chamar()]);
    await chamar();
    expect(emails.confirmacao).toHaveBeenCalledTimes(1);
    expect(emails.docs).toHaveBeenCalledTimes(1);
    expect(loja.guardados.length).toBeLessThanOrEqual(3); // corrida: sobra é apagada
    expect((await linhas()).filter((l) => l.status === 'assinado')).toHaveLength(1);
  });

  it('falha do e-mail a docs@ devolve a trava; a próxima tentativa envia SEM repetir o do paciente', async () => {
    const c = await enviado();
    docusign.statusDoEnvelope = 'completed';
    emails.docs.mockRejectedValueOnce(new Error('brevo fora'));

    const r1 = await nucleo.sincronizarComunicado(c.id);
    expect(r1.finalizacaoPendente).toBe(true);
    let [a] = await linhas();
    expect(a.status).toBe('assinado');
    expect(a.emailNotificacaoDocsEm).toBeNull();
    expect(a.erro).toContain('docs@');

    // o webhook responderia 500 aqui, para o DocuSign reentregar
    const resp = await webhook.POST(
      new Request('http://localhost/api/webhooks/docusign', {
        method: 'POST',
        body: JSON.stringify({ data: { envelopeId: c.docusignEnvelopeId } }),
      }) as never,
    );
    expect(resp.status).toBe(200); // a reentrega concluiu o que faltava

    [a] = await linhas();
    expect(a.emailNotificacaoDocsEm).not.toBeNull();
    expect(a.erro).toBeNull();
    expect(emails.confirmacao).toHaveBeenCalledTimes(1);
    expect(emails.docs).toHaveBeenCalledTimes(2); // uma falha + uma que chegou
  });

  it('PDF assinado que não baixa: segue assinado, sem e-mail, e o webhook pede reentrega (500)', async () => {
    const c = await enviado();
    docusign.statusDoEnvelope = 'completed';
    docusign.baixarPdf.mockResolvedValue(null);
    const resp = await webhook.POST(
      new Request('http://localhost/api/webhooks/docusign', {
        method: 'POST',
        body: JSON.stringify({ data: { envelopeId: c.docusignEnvelopeId } }),
      }) as never,
    );
    expect(resp.status).toBe(500);
    const [a] = await linhas();
    expect(a.status).toBe('assinado');
    expect(a.urlPdfAssinado).toBeNull();
    expect(emails.docs).not.toHaveBeenCalled();
    expect(emails.confirmacao).not.toHaveBeenCalled();
  });

  it('webhook de envelope desconhecido segue o caminho da procuração (404), sem tocar comunicados', async () => {
    await enviado();
    const resp = await webhook.POST(
      new Request('http://localhost/api/webhooks/docusign', {
        method: 'POST',
        body: JSON.stringify({ event: 'envelope-completed', data: { envelopeId: 'nao-e-nosso' } }),
      }) as never,
    );
    expect(resp.status).toBe(404);
    expect((await linhas())[0].status).toBe('pendente');
  });

  it('recusa no DocuSign: status recusado, novo envio liberado, histórico preservado', async () => {
    const c = await enviado();
    docusign.statusDoEnvelope = 'declined';
    await nucleo.sincronizarComunicado(c.id);
    expect((await linhas())[0].status).toBe('recusado');
    expect(emails.docs).not.toHaveBeenCalled();

    como('ck_adm', 'admin');
    const de = await acoes.enviarComunicadoAtualizacaoDoacao(pa);
    expect(de.sucesso).toBe(true);
    expect(await linhas()).toHaveLength(2);

    // o paciente vê só o novo, pendente — a recusa antiga some da frente dele
    como('ck_a', 'paciente');
    const minha = await acoes.listarMeusComunicados();
    expect(minha.sucesso && minha.dados.map((x) => x.status)).toEqual(['pendente']);
  });

  it('assinado nunca regride, e depois de assinado não se envia de novo', async () => {
    const c = await enviado();
    docusign.statusDoEnvelope = 'completed';
    await nucleo.sincronizarComunicado(c.id);
    docusign.statusDoEnvelope = 'voided';
    await nucleo.sincronizarComunicado(c.id);
    expect((await linhas())[0].status).toBe('assinado');

    como('ck_adm', 'admin');
    expect((await acoes.enviarComunicadoAtualizacaoDoacao(pa)).sucesso).toBe(false);
  });
});

describe('o PDF assinado só abre para o dono e para o admin', () => {
  async function assinado() {
    como('ck_adm', 'admin');
    await acoes.enviarComunicadoAtualizacaoDoacao(pa);
    const [c] = await linhas();
    docusign.statusDoEnvelope = 'completed';
    await nucleo.sincronizarComunicado(c.id);
    return c.id;
  }
  const abrir = (id: string) =>
    rotaArquivo.GET(GET(`http://localhost/api/comunicados/${id}/arquivo`), {
      params: Promise.resolve({ id }),
    } as never);

  it('o dono e o admin recebem o PDF; outro paciente e o médico recebem 404', async () => {
    const id = await assinado();

    como('ck_a', 'paciente');
    const dono = await abrir(id);
    expect(dono.status).toBe(200);
    expect(dono.headers.get('content-type')).toBe('application/pdf');
    expect(dono.headers.get('cache-control')).toContain('no-store');

    como('ck_adm', 'admin');
    expect((await abrir(id)).status).toBe(200);

    como('ck_b', 'paciente');
    expect((await abrir(id)).status).toBe(404);
    como('ck_med', 'medico');
    expect((await abrir(id)).status).toBe(404);
    expect((await abrir('nao-existe')).status).toBe(404);

    // as duas aberturas autorizadas ficaram na auditoria
    const vistas = (await db.select().from(schema.logsAuditoria)).filter(
      (l) => l.acao === 'visualizar' && l.entidadeId === id,
    );
    expect(vistas.length).toBeGreaterThanOrEqual(2);
  });

  it('sem sessão, 401; comunicado ainda pendente não tem arquivo (404)', async () => {
    como('ck_adm', 'admin');
    await acoes.enviarComunicadoAtualizacaoDoacao(pa);
    const [pendente] = await db
      .select()
      .from(schema.comunicadosAssinatura)
      .where(eq(schema.comunicadosAssinatura.pacienteId, pa));
    expect((await abrir(pendente.id)).status).toBe(404);
    sessao.clerkId = null;
    expect((await abrir(pendente.id)).status).toBe(401);
  });
});

describe('o admin reinicia o fluxo depois da assinatura', () => {
  async function assinado() {
    como('ck_adm', 'admin');
    await acoes.enviarComunicadoAtualizacaoDoacao(pa);
    const [c] = await linhas();
    docusign.statusDoEnvelope = 'completed';
    await nucleo.sincronizarComunicado(c.id);
    return c.id;
  }
  const abrir = (id: string) =>
    rotaArquivo.GET(GET(`http://localhost/api/comunicados/${id}/arquivo`), {
      params: Promise.resolve({ id }),
    } as never);
  const MOTIVO = 'carta atualizada, precisa ser assinada de novo';

  it('nada é apagado: a linha vira cancelada com quem, quando e por quê, e o PDF assinado fica', async () => {
    const id = await assinado();
    const antes = (await linhas())[0];
    expect(antes.urlPdfAssinado).not.toBeNull();

    como('ck_adm', 'admin');
    const r = await acoes.reiniciarFluxoDoComunicado(id, MOTIVO);
    expect(r).toEqual({ sucesso: true, dados: { reiniciado: true } });

    const todas = await linhas();
    expect(todas).toHaveLength(1);
    const c = todas[0];
    expect(c.status).toBe('cancelado');
    expect(c.motivoCancelamento).toBe(MOTIVO);
    expect(c.canceladoEm).not.toBeNull();
    expect(c.canceladoPorUserId).toBeTruthy();
    // o arquivo, o envelope e o vínculo com o paciente seguem na linha
    expect(c.urlPdfAssinado).toBe(antes.urlPdfAssinado);
    expect(c.docusignEnvelopeId).toBe(antes.docusignEnvelopeId);
    expect(c.pacienteId).toBe(pa);
    expect(c.assinadoEm).not.toBeNull();

    const aud = (await db.select().from(schema.logsAuditoria)).filter(
      (l) => l.entidadeId === id && l.acao === 'atualizar' && l.dadosDepois,
    );
    const reinicio = aud.find((l) => (l.dadosDepois as { status?: string }).status === 'cancelado');
    expect(reinicio).toBeTruthy();
    expect(reinicio?.dadosAntes).toMatchObject({
      status: 'assinado',
      arquivoAssinadoGuardado: true,
    });
    expect(reinicio?.dadosDepois).toMatchObject({
      motivo: MOTIVO,
      arquivoAssinadoPreservado: true,
    });
  });

  it('o paciente deixa de ver o comunicado e o admin vê o estado inicial mais o histórico', async () => {
    const id = await assinado();
    como('ck_adm', 'admin');
    await acoes.reiniciarFluxoDoComunicado(id, MOTIVO);

    como('ck_a', 'paciente');
    expect(await acoes.listarMeusComunicados()).toMatchObject({ sucesso: true, dados: [] });
    // e não consegue mais abrir o fluxo antigo por link
    expect((await acoes.iniciarAssinaturaDoComunicado(id)).sucesso).toBe(false);

    como('ck_adm', 'admin');
    const h = await acoes.listarComunicadosDoPaciente(pa);
    expect(h.sucesso && h.dados).toHaveLength(1);
    expect(h.sucesso && h.dados[0]).toMatchObject({
      status: 'cancelado',
      reiniciadoPorNome: 'Admin Teste',
      motivoDoReinicio: MOTIVO,
      temArquivoAssinado: true,
    });
  });

  it('depois de reiniciar o admin envia de novo, e o histórico mantém as duas linhas', async () => {
    const id = await assinado();
    como('ck_adm', 'admin');
    await acoes.reiniciarFluxoDoComunicado(id, MOTIVO);
    docusign.statusDoEnvelope = 'sent';
    const novo = await acoes.enviarComunicadoAtualizacaoDoacao(pa);
    expect(novo.sucesso).toBe(true);
    expect(docusign.criar).toHaveBeenCalledTimes(2);

    const todas = await linhas();
    expect(todas.map((c) => c.status).sort()).toEqual(['cancelado', 'pendente']);

    como('ck_a', 'paciente');
    const minha = await acoes.listarMeusComunicados();
    expect(minha.sucesso && minha.dados.map((x) => x.status)).toEqual(['pendente']);
  });

  it('só o admin reinicia, e com motivo', async () => {
    const id = await assinado();
    como('ck_a', 'paciente');
    expect((await acoes.reiniciarFluxoDoComunicado(id, MOTIVO)).sucesso).toBe(false);
    como('ck_med', 'medico');
    expect((await acoes.reiniciarFluxoDoComunicado(id, MOTIVO)).sucesso).toBe(false);
    como('ck_adm', 'admin');
    expect((await acoes.reiniciarFluxoDoComunicado(id, '')).sucesso).toBe(false);
    expect((await acoes.reiniciarFluxoDoComunicado(id, 'abc')).sucesso).toBe(false);
    expect((await linhas())[0].status).toBe('assinado');
  });

  it('só reinicia o que está assinado: pendente e já reiniciado são recusados', async () => {
    como('ck_adm', 'admin');
    await acoes.enviarComunicadoAtualizacaoDoacao(pa);
    const [pendente] = await linhas();
    expect((await acoes.reiniciarFluxoDoComunicado(pendente.id, MOTIVO)).sucesso).toBe(false);
    expect((await linhas())[0].status).toBe('pendente');

    docusign.statusDoEnvelope = 'completed';
    await nucleo.sincronizarComunicado(pendente.id);
    expect((await acoes.reiniciarFluxoDoComunicado(pendente.id, MOTIVO)).sucesso).toBe(true);
    expect((await acoes.reiniciarFluxoDoComunicado(pendente.id, MOTIVO)).sucesso).toBe(false);
  });

  it('dois reinícios ao mesmo tempo resultam em UM', async () => {
    const id = await assinado();
    como('ck_adm', 'admin');
    const [r1, r2] = await Promise.all([
      acoes.reiniciarFluxoDoComunicado(id, MOTIVO),
      acoes.reiniciarFluxoDoComunicado(id, MOTIVO),
    ]);
    expect([r1.sucesso, r2.sucesso].filter(Boolean)).toHaveLength(1);
    const reinicios = (await db.select().from(schema.logsAuditoria)).filter(
      (l) =>
        l.entidadeId === id &&
        (l.dadosDepois as { status?: string } | null)?.status === 'cancelado',
    );
    expect(reinicios).toHaveLength(1);
  });

  it('o webhook do envelope antigo, que chega depois do reinício, não muda nada nem manda e-mail', async () => {
    const id = await assinado();
    const antes = {
      conf: emails.confirmacao.mock.calls.length,
      docs: emails.docs.mock.calls.length,
    };
    como('ck_adm', 'admin');
    await acoes.reiniciarFluxoDoComunicado(id, MOTIVO);
    const [c] = await linhas();
    const resp = await webhook.POST(
      new Request('http://localhost/api/webhooks/docusign', {
        method: 'POST',
        body: JSON.stringify({
          event: 'envelope-completed',
          data: { envelopeId: c.docusignEnvelopeId },
        }),
      }) as never,
    );
    expect(resp.status).toBe(200); // não pede reentrega
    expect((await linhas())[0].status).toBe('cancelado');
    expect(emails.confirmacao.mock.calls.length).toBe(antes.conf);
    expect(emails.docs.mock.calls.length).toBe(antes.docs);
  });

  it('o PDF do fluxo reiniciado só abre para o admin: o paciente dono e os outros recebem 404', async () => {
    const id = await assinado();
    como('ck_a', 'paciente');
    expect((await abrir(id)).status).toBe(200); // antes de reiniciar, o dono abre
    como('ck_adm', 'admin');
    await acoes.reiniciarFluxoDoComunicado(id, MOTIVO);

    expect((await abrir(id)).status).toBe(200); // o admin consulta o arquivo
    como('ck_a', 'paciente');
    expect((await abrir(id)).status).toBe(404);
    como('ck_b', 'paciente');
    expect((await abrir(id)).status).toBe(404);
    como('ck_med', 'medico');
    expect((await abrir(id)).status).toBe(404);
  });

  it('o segundo ciclo assina e finaliza normalmente, com os seus próprios e-mails', async () => {
    const id = await assinado();
    como('ck_adm', 'admin');
    await acoes.reiniciarFluxoDoComunicado(id, MOTIVO);
    docusign.statusDoEnvelope = 'sent';
    await acoes.enviarComunicadoAtualizacaoDoacao(pa);
    const novo = (await linhas()).find((c) => c.status === 'pendente')!;
    expect(novo.docusignEnvelopeId).toBe('env-2');

    docusign.statusDoEnvelope = 'completed';
    await nucleo.sincronizarComunicado(novo.id);
    expect(emails.confirmacao).toHaveBeenCalledTimes(2); // um por assinatura
    expect(emails.docs).toHaveBeenCalledTimes(2);
    expect((await linhas()).map((c) => c.status).sort()).toEqual(['assinado', 'cancelado']);
  });
});
