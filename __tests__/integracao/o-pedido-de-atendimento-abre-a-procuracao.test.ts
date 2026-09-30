/**
 * O pedido de atendimento assistido, EXECUTADO contra um Postgres de verdade (ADR-0029).
 *
 * 🔴 ISTO NÃO É GUARDA ESTRUTURAL. Este roda as actions e olha as linhas que sobraram no banco.
 *
 * ## O que ele prova
 *
 *   1. o paciente pede só para a PRÓPRIA autorização; pedir de novo não duplica nem muda a data
 *   2. pedido para autorização de outro paciente, ou apagada, não vira linha
 *   3. só admin ativa; paciente chamando a ativação não muda nada
 *   4. ativar grava quem e quando, e deixa o antes e o depois em `logs_auditoria`
 *   5. desativar antes da assinatura volta o pedido, a modalidade para `guiada` e tira do checklist
 *      a procuração que ainda não foi enviada — tudo junto, numa transação
 *   6. desativar depois da procuração assinada é recusado, e nada muda
 *   7. ativar, desativar e ativar de novo deixa TRÊS linhas de auditoria: o histórico não se perde
 *   8. a aprovação da ANVISA conclui o pedido
 *   9. a lista do admin traz o nome e nunca CPF nem e-mail; paciente não lista
 *  10. a TRAVA: sem pedido ativado, o paciente não entra na procuração nem chamando a action
 *      direto; com o pedido ativado, entra; quem já estava nela (os 12 de produção) segue
 *
 * Rodar:
 *
 *   docker start behemp-pg || docker run -d --name behemp-pg \
 *     -e POSTGRES_PASSWORD=local -e POSTGRES_DB=behemp -p 5544:5432 postgres:16
 *   DATABASE_URL=postgresql://postgres:local@localhost:5544/behemp npx drizzle-kit push --force
 *   DATABASE_URL=postgresql://postgres:local@localhost:5544/behemp \
 *     npx vitest run --config vitest.integracao.mts \
 *     __tests__/integracao/o-pedido-de-atendimento-abre-a-procuracao.test.ts
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq } from 'drizzle-orm';

/** O duplo do Clerk: quem está logado e com que papel. */
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
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error('REDIRECT ' + url);
  },
}));

const { db } = await import('@/lib/db');
const schema = await import('@/db/schema');
const acoes = await import('@/app/_actions/pedido-atendimento-assistido');
const { encerrarPedidoDaAutorizacao } = await import('@/lib/anvisa/encerrar-pedido-de-atendimento');
const { definirModalidadeAnvisa } = await import('@/app/(paciente)/_actions/anvisa');
const rotaDaProcuracao = await import('@/app/api/anvisa/procuracao/route');

const como = (clerkId: string, role: string) => {
  sessao.clerkId = clerkId;
  sessao.role = role;
};

async function limpar() {
  await db.delete(schema.logsAuditoria);
  await db.delete(schema.pedidosAtendimentoAssistido);
  await db.delete(schema.procuracoesEspecificas);
  await db.delete(schema.autorizacoesAnvisa);
  await db.delete(schema.pacientes);
  await db.delete(schema.users);
}

let adminId = '';

/** Paciente A (com três autorizações), paciente B (com uma) e um admin. */
async function cenario() {
  const [ua, ub, ad] = await db
    .insert(schema.users)
    .values([
      { clerkId: 'ck_a', email: 'a@teste.invalid', nome: 'Paciente A', role: 'paciente' },
      { clerkId: 'ck_b', email: 'b@teste.invalid', nome: 'Paciente B', role: 'paciente' },
      { clerkId: 'ck_adm', email: 'adm@teste.invalid', nome: 'Admin Teste', role: 'admin' },
    ])
    .returning({ id: schema.users.id });
  adminId = ad.id;
  const [pa, pb] = await db
    .insert(schema.pacientes)
    .values([
      { userId: ua.id, cpf: '111.111.111-11' },
      { userId: ub.id, cpf: '222.222.222-22' },
    ])
    .returning({ id: schema.pacientes.id });
  const docs = [
    { tipo: 'receita_medica', enviado: true, validado: false, urlBlob: null, nomeArquivo: null },
    {
      tipo: 'procuracao_especifica',
      enviado: false,
      validado: false,
      urlBlob: null,
      nomeArquivo: null,
    },
    { tipo: 'laudo_medico', enviado: false, validado: false, urlBlob: null, nomeArquivo: null },
  ];
  await db.insert(schema.autorizacoesAnvisa).values([
    { id: 'aut_a', pacienteId: pa.id, modalidade: 'guiada' },
    { id: 'aut_a_apagada', pacienteId: pa.id, modalidade: 'guiada', deletedAt: new Date() },
    { id: 'aut_a_repr', pacienteId: pa.id, modalidade: 'representacao', documentos: docs },
    { id: 'aut_b', pacienteId: pb.id, modalidade: 'guiada' },
  ]);
  return { pa: pa.id, pb: pb.id };
}

const pedidosDe = (autorizacaoId: string) =>
  db
    .select()
    .from(schema.pedidosAtendimentoAssistido)
    .where(eq(schema.pedidosAtendimentoAssistido.autorizacaoId, autorizacaoId));

beforeEach(async () => {
  await limpar();
  await cenario();
});
afterAll(limpar);

describe('o paciente pede atendimento', () => {
  it('pede para a própria autorização, e pedir de novo não duplica nem muda a data', async () => {
    como('ck_a', 'paciente');
    const r1 = await acoes.pedirAtendimentoAssistido({ autorizacaoId: 'aut_a' });
    expect(r1).toMatchObject({ sucesso: true, dados: { status: 'aguardando_ativacao' } });
    const [antes] = await pedidosDe('aut_a');

    const r2 = await acoes.pedirAtendimentoAssistido({ autorizacaoId: 'aut_a' });
    expect(r2).toMatchObject({ sucesso: true, dados: { status: 'aguardando_ativacao' } });
    const depois = await pedidosDe('aut_a');
    expect(depois).toHaveLength(1);
    expect(depois[0].pedidoEm.getTime()).toBe(antes.pedidoEm.getTime());
  });

  it('dois pedidos ao mesmo tempo viram UM (o banco segura a corrida)', async () => {
    como('ck_a', 'paciente');
    const rs = await Promise.all(
      [1, 2, 3].map(() => acoes.pedirAtendimentoAssistido({ autorizacaoId: 'aut_a' })),
    );
    expect(rs.every((r) => r.sucesso)).toBe(true);
    expect(await pedidosDe('aut_a')).toHaveLength(1);
  });

  /**
   * ⚠️ O caso acima NÃO reproduz a corrida: a sabotagem que tirou o tratamento do `23505`
   * sobreviveu a ele (30/09/2026), porque as três chamadas acabavam em série. Este força a
   * corrida: outra transação ocupa a vaga do índice parcial SEM confirmar; a action não a vê na
   * checagem, esbarra no índice ao inserir e espera; a outra confirma, e a action recebe o 23505.
   */
  it('a corrida forçada: quem perde para o índice devolve o pedido que venceu', async () => {
    const [aut] = await db
      .select({ pacienteId: schema.autorizacoesAnvisa.pacienteId })
      .from(schema.autorizacoesAnvisa)
      .where(eq(schema.autorizacoesAnvisa.id, 'aut_a'));
    const { Client } = await import('pg');
    const outra = new Client({ connectionString: process.env.DATABASE_URL });
    await outra.connect();
    try {
      await outra.query('begin');
      await outra.query(
        "insert into pedidos_atendimento_assistido (id, autorizacao_id, paciente_id) values ('venceu', 'aut_a', $1)",
        [aut.pacienteId],
      );
      como('ck_a', 'paciente');
      const emCurso = acoes.pedirAtendimentoAssistido({ autorizacaoId: 'aut_a' });
      await new Promise((r) => setTimeout(r, 400));
      await outra.query('commit');
      expect(await emCurso).toMatchObject({
        sucesso: true,
        dados: { status: 'aguardando_ativacao' },
      });
    } finally {
      await outra.end();
    }
    const linhas = await pedidosDe('aut_a');
    expect(linhas.map((l) => l.id)).toEqual(['venceu']);
  });

  it('pedido para a autorização de OUTRO paciente é recusado e não vira linha', async () => {
    como('ck_a', 'paciente');
    const r = await acoes.pedirAtendimentoAssistido({ autorizacaoId: 'aut_b' });
    expect(r.sucesso).toBe(false);
    expect(await pedidosDe('aut_b')).toHaveLength(0);
  });

  it('pedido para autorização apagada é recusado', async () => {
    como('ck_a', 'paciente');
    const r = await acoes.pedirAtendimentoAssistido({ autorizacaoId: 'aut_a_apagada' });
    expect(r.sucesso).toBe(false);
    expect(await pedidosDe('aut_a_apagada')).toHaveLength(0);
  });

  it('entrada inválida é recusada antes do banco', async () => {
    como('ck_a', 'paciente');
    expect((await acoes.pedirAtendimentoAssistido({ autorizacaoId: '' })).sucesso).toBe(false);
    expect(
      (await acoes.pedirAtendimentoAssistido({ autorizacaoId: 'aut_a', pacienteId: 'x' })).sucesso,
    ).toBe(false);
  });

  it('o paciente lê o próprio pedido, e não o de outro', async () => {
    como('ck_a', 'paciente');
    await acoes.pedirAtendimentoAssistido({ autorizacaoId: 'aut_a' });
    expect(await acoes.lerMeuPedidoDeAtendimento({ autorizacaoId: 'aut_a' })).toMatchObject({
      sucesso: true,
      dados: { status: 'aguardando_ativacao' },
    });
    como('ck_b', 'paciente');
    expect((await acoes.lerMeuPedidoDeAtendimento({ autorizacaoId: 'aut_a' })).sucesso).toBe(false);
  });
});

describe('o admin ativa e desativa', () => {
  async function pedidoAberto(autorizacaoId = 'aut_a') {
    como('ck_a', 'paciente');
    await acoes.pedirAtendimentoAssistido({ autorizacaoId });
    const [p] = await pedidosDe(autorizacaoId);
    return p.id;
  }

  it('paciente chamando a ativação não muda nada', async () => {
    const id = await pedidoAberto();
    como('ck_a', 'paciente');
    const r = await acoes.ativarProcuracaoAnvisa({ pedidoId: id });
    expect(r.sucesso).toBe(false);
    expect((await pedidosDe('aut_a'))[0].status).toBe('aguardando_ativacao');
  });

  it('ativar grava quem e quando, com o antes e o depois na auditoria', async () => {
    const id = await pedidoAberto();
    como('ck_adm', 'admin');
    const r = await acoes.ativarProcuracaoAnvisa({ pedidoId: id });
    expect(r.sucesso).toBe(true);
    const [p] = await pedidosDe('aut_a');
    expect(p.status).toBe('pendente_autorizacao');
    expect(p.ativadoPor).toBe(adminId);
    expect(p.ativadoEm).toBeInstanceOf(Date);
    const logs = await db
      .select()
      .from(schema.logsAuditoria)
      .where(
        and(
          eq(schema.logsAuditoria.entidadeId, id),
          eq(schema.logsAuditoria.acao, 'ATIVAR_PROCURACAO'),
        ),
      );
    expect(logs).toHaveLength(1);
    expect(logs[0].userId).toBe(adminId);
    expect(logs[0].dadosAntes).toMatchObject({ status: 'aguardando_ativacao' });
    expect(logs[0].dadosDepois).toMatchObject({ status: 'pendente_autorizacao' });
  });

  it('ativar o que já está ativo é recusado', async () => {
    const id = await pedidoAberto();
    como('ck_adm', 'admin');
    await acoes.ativarProcuracaoAnvisa({ pedidoId: id });
    const r = await acoes.ativarProcuracaoAnvisa({ pedidoId: id });
    expect(r.sucesso).toBe(false);
  });

  it('desativar antes da assinatura volta pedido, modalidade e checklist, juntos', async () => {
    const id = await pedidoAberto('aut_a_repr');
    como('ck_adm', 'admin');
    await acoes.ativarProcuracaoAnvisa({ pedidoId: id });
    const r = await acoes.desativarProcuracaoAnvisa({ pedidoId: id });
    expect(r.sucesso).toBe(true);
    const [p] = await pedidosDe('aut_a_repr');
    expect(p.status).toBe('aguardando_ativacao');
    expect(p.desativadoPor).toBe(adminId);
    const [aut] = await db
      .select()
      .from(schema.autorizacoesAnvisa)
      .where(eq(schema.autorizacoesAnvisa.id, 'aut_a_repr'));
    expect(aut.modalidade).toBe('guiada');
    const tipos = (aut.documentos as { tipo: string }[]).map((d) => d.tipo);
    expect(tipos).toEqual(['receita_medica']);
  });

  it('desativar depois da procuração ASSINADA é recusado, e nada muda', async () => {
    const id = await pedidoAberto('aut_a_repr');
    como('ck_adm', 'admin');
    await acoes.ativarProcuracaoAnvisa({ pedidoId: id });
    const [pac] = await db
      .select()
      .from(schema.autorizacoesAnvisa)
      .where(eq(schema.autorizacoesAnvisa.id, 'aut_a_repr'));
    await db.insert(schema.procuracoesEspecificas).values({
      pacienteId: pac.pacienteId,
      autorizacaoId: 'aut_a_repr',
      nomeCompleto: 'Paciente A',
      email: 'a@teste.invalid',
      assinadoEm: new Date(),
    });
    const r = await acoes.desativarProcuracaoAnvisa({ pedidoId: id });
    expect(r.sucesso).toBe(false);
    expect((await pedidosDe('aut_a_repr'))[0].status).toBe('pendente_autorizacao');
    const [aut] = await db
      .select()
      .from(schema.autorizacoesAnvisa)
      .where(eq(schema.autorizacoesAnvisa.id, 'aut_a_repr'));
    expect(aut.modalidade).toBe('representacao');
  });

  it('ativar, desativar e ativar de novo deixa as três vezes na auditoria', async () => {
    const id = await pedidoAberto();
    como('ck_adm', 'admin');
    await acoes.ativarProcuracaoAnvisa({ pedidoId: id });
    await acoes.desativarProcuracaoAnvisa({ pedidoId: id });
    await acoes.ativarProcuracaoAnvisa({ pedidoId: id });
    const logs = await db
      .select()
      .from(schema.logsAuditoria)
      .where(eq(schema.logsAuditoria.entidadeId, id));
    const atos = logs
      .map((l) => l.acao)
      .filter((a) => a !== 'PEDIR_ATENDIMENTO_ASSISTIDO')
      .sort();
    expect(atos).toEqual(['ATIVAR_PROCURACAO', 'ATIVAR_PROCURACAO', 'DESATIVAR_PROCURACAO']);
  });
});

describe('a ANVISA aprova, e o admin lista', () => {
  it('a aprovação conclui o pedido aberto', async () => {
    como('ck_a', 'paciente');
    await acoes.pedirAtendimentoAssistido({ autorizacaoId: 'aut_a' });
    await encerrarPedidoDaAutorizacao('aut_a', 'concluido');
    const [p] = await pedidosDe('aut_a');
    expect(p.status).toBe('concluido');
    expect(p.encerradoEm).toBeInstanceOf(Date);
  });

  it('a rejeição encerra o pedido como rejeitado_anvisa, e o paciente pode pedir de novo (DO-76)', async () => {
    como('ck_a', 'paciente');
    await acoes.pedirAtendimentoAssistido({ autorizacaoId: 'aut_a' });
    await encerrarPedidoDaAutorizacao('aut_a', 'rejeitado_anvisa');
    const [p] = await pedidosDe('aut_a');
    expect(p.status).toBe('rejeitado_anvisa');
    expect(p.encerradoEm).toBeInstanceOf(Date);

    // Encerrado sai do índice parcial: um pedido novo vira linha nova, e o antigo fica.
    const r = await acoes.pedirAtendimentoAssistido({ autorizacaoId: 'aut_a' });
    expect(r).toMatchObject({ sucesso: true, dados: { status: 'aguardando_ativacao' } });
    expect((await pedidosDe('aut_a')).map((x) => x.status).sort()).toEqual([
      'aguardando_ativacao',
      'rejeitado_anvisa',
    ]);
  });

  it('o admin não ativa um pedido rejeitado', async () => {
    como('ck_a', 'paciente');
    await acoes.pedirAtendimentoAssistido({ autorizacaoId: 'aut_a' });
    const [p] = await pedidosDe('aut_a');
    await encerrarPedidoDaAutorizacao('aut_a', 'rejeitado_anvisa');
    como('ck_adm', 'admin');
    expect((await acoes.ativarProcuracaoAnvisa({ pedidoId: p.id })).sucesso).toBe(false);
  });

  it('concluir sem pedido não lança nem cria linha', async () => {
    await expect(encerrarPedidoDaAutorizacao('aut_b', 'concluido')).resolves.toBeUndefined();
    expect(await pedidosDe('aut_b')).toHaveLength(0);
  });

  it('o admin vê o nome e nunca CPF nem e-mail; o paciente não lista', async () => {
    como('ck_a', 'paciente');
    await acoes.pedirAtendimentoAssistido({ autorizacaoId: 'aut_a' });
    expect((await acoes.listarPedidosDeAtendimento()).sucesso).toBe(false);

    como('ck_adm', 'admin');
    const r = await acoes.listarPedidosDeAtendimento();
    expect(r.sucesso).toBe(true);
    const lista = r.dados ?? [];
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ pacienteNome: 'Paciente A', status: 'aguardando_ativacao' });
    const texto = JSON.stringify(lista);
    expect(texto).not.toMatch(/111\.111|teste\.invalid/);
  });
});

describe('a trava: a procuração só abre depois da ativação (D-04.3)', () => {
  const modalidadeDe = async (id: string) =>
    (
      await db.select().from(schema.autorizacoesAnvisa).where(eq(schema.autorizacoesAnvisa.id, id))
    )[0].modalidade;

  it('sem pedido, chamar a action direto não abre a procuração', async () => {
    como('ck_a', 'paciente');
    const r = await definirModalidadeAnvisa('aut_a', 'representacao');
    expect(r.sucesso).toBe(false);
    expect(await modalidadeDe('aut_a')).toBe('guiada');
  });

  it('com o pedido só aguardando, continua fechada', async () => {
    como('ck_a', 'paciente');
    await acoes.pedirAtendimentoAssistido({ autorizacaoId: 'aut_a' });
    expect((await definirModalidadeAnvisa('aut_a', 'representacao')).sucesso).toBe(false);
    expect(await modalidadeDe('aut_a')).toBe('guiada');
  });

  it('com o pedido ativado pelo admin, abre', async () => {
    como('ck_a', 'paciente');
    await acoes.pedirAtendimentoAssistido({ autorizacaoId: 'aut_a' });
    const [p] = await pedidosDe('aut_a');
    como('ck_adm', 'admin');
    await acoes.ativarProcuracaoAnvisa({ pedidoId: p.id });
    como('ck_a', 'paciente');
    expect((await definirModalidadeAnvisa('aut_a', 'representacao')).sucesso).toBe(true);
    expect(await modalidadeDe('aut_a')).toBe('representacao');
  });

  it('quem já estava na procuração, sem pedido, segue com ela', async () => {
    como('ck_a', 'paciente');
    expect((await definirModalidadeAnvisa('aut_a_repr', 'representacao')).sucesso).toBe(true);
    expect(await modalidadeDe('aut_a_repr')).toBe('representacao');
  });

  it('voltar para o passo a passo nunca é travado', async () => {
    como('ck_a', 'paciente');
    expect((await definirModalidadeAnvisa('aut_a_repr', 'guiada')).sucesso).toBe(true);
  });
});

/**
 * Os quatro achados da revisão independente de 30/09/2026 — cada um nasceu vermelho.
 */
describe('a revisão de 30/09: os desvios da trava', () => {
  const modalidadeDe = async (id: string) =>
    (
      await db.select().from(schema.autorizacoesAnvisa).where(eq(schema.autorizacoesAnvisa.id, id))
    )[0].modalidade;

  it('ALTA: a rota que GERA a procuração recusa sem liberação — a trava não se contorna por ela', async () => {
    como('ck_a', 'paciente');
    const req = new Request('http://teste.local/api/anvisa/procuracao', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ autorizacaoId: 'aut_a' }),
    });
    const res = await rotaDaProcuracao.POST(req as never);
    expect(res.status).toBe(409);
    expect(await db.select().from(schema.procuracoesEspecificas)).toHaveLength(0);
  });

  it('MÉDIA: desativar é recusado com o envelope já ENVIADO para assinatura', async () => {
    como('ck_a', 'paciente');
    await acoes.pedirAtendimentoAssistido({ autorizacaoId: 'aut_a_repr' });
    const [p] = await pedidosDe('aut_a_repr');
    como('ck_adm', 'admin');
    await acoes.ativarProcuracaoAnvisa({ pedidoId: p.id });
    const [aut] = await db
      .select()
      .from(schema.autorizacoesAnvisa)
      .where(eq(schema.autorizacoesAnvisa.id, 'aut_a_repr'));
    await db.insert(schema.procuracoesEspecificas).values({
      pacienteId: aut.pacienteId,
      autorizacaoId: 'aut_a_repr',
      nomeCompleto: 'Paciente A',
      email: 'a@teste.invalid',
      docusignStatus: 'enviado',
      docusignEnvelopeId: 'env-teste',
    });
    const r = await acoes.desativarProcuracaoAnvisa({ pedidoId: p.id });
    expect(r.sucesso).toBe(false);
    expect((await pedidosDe('aut_a_repr'))[0].status).toBe('pendente_autorizacao');
    expect(await modalidadeDe('aut_a_repr')).toBe('representacao');
  });

  it('MÉDIA: a corrida forçada — o admin desativa no meio da entrada do paciente, e o paciente NÃO entra', async () => {
    como('ck_a', 'paciente');
    await acoes.pedirAtendimentoAssistido({ autorizacaoId: 'aut_a' });
    const [p] = await pedidosDe('aut_a');
    como('ck_adm', 'admin');
    await acoes.ativarProcuracaoAnvisa({ pedidoId: p.id });

    // Outra transação faz o que o desativar faz: tranca o pedido e o devolve a "aguardando".
    const { Client } = await import('pg');
    const admin = new Client({ connectionString: process.env.DATABASE_URL });
    await admin.connect();
    try {
      await admin.query('begin');
      await admin.query('select id from pedidos_atendimento_assistido where id = $1 for update', [
        p.id,
      ]);
      await admin.query(
        "update pedidos_atendimento_assistido set status = 'aguardando_ativacao' where id = $1",
        [p.id],
      );
      como('ck_a', 'paciente');
      const emCurso = definirModalidadeAnvisa('aut_a', 'representacao');
      await new Promise((r) => setTimeout(r, 400));
      await admin.query('commit');
      expect((await emCurso).sucesso).toBe(false);
    } finally {
      await admin.end();
    }
    expect(await modalidadeDe('aut_a')).toBe('guiada');
  });

  it('BAIXA: ativar recusa o pedido de uma autorização apagada', async () => {
    const [aut] = await db
      .select()
      .from(schema.autorizacoesAnvisa)
      .where(eq(schema.autorizacoesAnvisa.id, 'aut_a_apagada'));
    const [p] = await db
      .insert(schema.pedidosAtendimentoAssistido)
      .values({ autorizacaoId: 'aut_a_apagada', pacienteId: aut.pacienteId })
      .returning();
    como('ck_adm', 'admin');
    expect((await acoes.ativarProcuracaoAnvisa({ pedidoId: p.id })).sucesso).toBe(false);
    expect((await pedidosDe('aut_a_apagada'))[0].status).toBe('aguardando_ativacao');
  });
});
