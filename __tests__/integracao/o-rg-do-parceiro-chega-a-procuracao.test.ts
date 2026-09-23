/**
 * O RG QUE O PACIENTE DIGITOU NA GREENS CHEGA À FICHA — E À PROCURAÇÃO.
 *
 * 🔴 ISTO NÃO É GUARDA ESTRUTURAL. Ele EXECUTA a rota do handoff (com assinatura HMAC real)
 * e a action de conclusão do cadastro, contra um Postgres de verdade, e depois olha as
 * linhas. É o Nível 4 da regra _"Deploy CUSTA"_ do `CLAUDE.md`.
 *
 * ## O problema que ele trava
 *
 * O paciente digita o RG no formulário da Greens. Eles o mandam no corpo do handoff desde
 * 15/09/2026 (`HandoffService.ts:387-393` no repositório deles). O nosso `z.object` não o
 * declarava — e o padrão do Zod é *strip*: a chave sumia **sem erro e sem log**.
 *
 * O efeito não era "falta um campo". Era a PROCURAÇÃO da ANVISA sair com o RG **em branco**:
 * `app/api/anvisa/procuracao/route.ts:96` lê `paciente.rg ?? ''`, então o documento é gerado,
 * assinado e arquivado com a linha vazia. Nada falha. Quem descobre é o paciente.
 *
 * ⚠️ TODOS OS VALORES AQUI SÃO FICTÍCIOS — RG `00.000.000-0`, CPF de teste conhecido,
 * nascimento em 1990-01-01. Nenhum dado real de paciente entra em teste.
 *
 * Rodar:
 *
 *   docker start behemp-pg || docker run -d --name behemp-pg \
 *     -e POSTGRES_PASSWORD=local -e POSTGRES_DB=behemp -p 5544:5432 postgres:16
 *   DATABASE_URL=postgresql://postgres:local@localhost:5544/behemp npx drizzle-kit push --force
 *   DATABASE_URL=postgresql://postgres:local@localhost:5544/behemp \
 *     npx vitest run --config vitest.integracao.mts \
 *     __tests__/integracao/o-rg-do-parceiro-chega-a-procuracao.test.ts
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { eq } from 'drizzle-orm';

const SEGREDO = 'segredo-de-teste-do-handoff-0000000000000000';
const CLERK_ID = 'user_paciente_de_teste';
const EMAIL = 'paciente.ficticio@exemplo.test';

/** Fictícios e óbvios. Nenhum deles identifica ninguém. */
const RG_DA_GREENS = '00.000.000-0';
const RG_QUE_O_PACIENTE_JA_TINHA = '11.111.111-1';
const NASCIMENTO = '1990-01-01';

process.env.PARCEIRO_GREENS_SEGREDO_ENTRADA = SEGREDO;
process.env.PARCEIRO_ORIGENS_DE_RETORNO = 'https://greens-corp.test';

const sessao = { clerkId: CLERK_ID as string | null, email: EMAIL };

vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: sessao.clerkId, sessionClaims: { metadata: { role: 'paciente' } } }),
  currentUser: async () => ({
    id: sessao.clerkId,
    emailAddresses: [{ emailAddress: sessao.email, verification: { status: 'verified' } }],
  }),
  clerkClient: async () => ({ users: {} }),
}));
vi.mock('next/cache', () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock('next/headers', () => ({
  headers: async () => new Map<string, string>() as unknown as Headers,
}));

const { db } = await import('@/lib/db');
const schema = await import('@/db/schema');
const { POST } = await import('@/app/api/parceiros/greens/cadastro/route');
const { concluirCadastroPorLink } = await import('@/app/_actions/cadastro-por-link');
const { gerarToken } = await import('@/lib/chatpro/solicitacao');

let contador = 0;

/** O POST assinado, exatamente como a Greens o monta. */
async function handoff(corpo: Record<string, unknown>) {
  const cru = JSON.stringify(corpo);
  const id = `evt_teste_${++contador}_${Date.now()}`;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const assinatura = createHmac('sha256', SEGREDO)
    .update(`${id}.${timestamp}.${cru}`)
    .digest('hex');

  const resposta = await POST(
    new Request('https://be4hope.test/api/parceiros/greens/cadastro', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-parceiro-evento-id': id,
        'x-parceiro-timestamp': timestamp,
        'x-parceiro-assinatura': assinatura,
      },
      body: cru,
    }),
  );
  return { status: resposta.status, corpo: await resposta.json() };
}

/** O corpo da Greens, campo a campo como `HandoffService.ts:387-393` o monta. */
function corpoDaGreens(sobrescrever: Record<string, unknown> = {}) {
  return {
    nomeCompleto: 'Paciente Fictício de Teste',
    email: EMAIL,
    telefone: '11999990000',
    cpf: '52998224725',
    rg: RG_DA_GREENS,
    dataNascimento: NASCIMENTO,
    genero: 'MALE',
    pedidoDoParceiro: `ped_${contador}`,
    documentos: ['documento_identidade'],
    urlDeRetorno: 'https://greens-corp.test/voltar',
    ...sobrescrever,
  };
}

async function limpar() {
  await db.delete(schema.logsAuditoria);
  await db.delete(schema.documentos);
  await db.delete(schema.consentimentos);
  await db.delete(schema.pacientes);
  await db.delete(schema.solicitacoesCadastro);
  await db.delete(schema.users);
}

async function solicitacaoDoEmail() {
  const [linha] = await db
    .select()
    .from(schema.solicitacoesCadastro)
    .where(eq(schema.solicitacoesCadastro.email, EMAIL))
    .limit(1);
  return linha;
}

/**
 * Dá um token utilizável à solicitação e conclui o cadastro por ele — é o caminho real do
 * paciente, que recebe o link por WhatsApp dias depois do handoff.
 */
async function concluirPeloLink() {
  const { token, hash } = gerarToken();
  const solicitacao = await solicitacaoDoEmail();
  await db
    .update(schema.solicitacoesCadastro)
    .set({ tokenHash: hash })
    .where(eq(schema.solicitacoesCadastro.id, solicitacao.id));

  return concluirCadastroPorLink({
    token,
    nomeCompleto: 'Paciente Fictício de Teste',
    email: EMAIL,
    telefone: '11999990000',
    cpf: '52998224725',
    jaFazTratamento: false,
  } as Parameters<typeof concluirCadastroPorLink>[0]);
}

/** A ficha, lida com as MESMAS colunas que a procuração seleciona em `route.ts:44-47`. */
async function fichaComoAProcuracaoLe() {
  const [linha] = await db
    .select({
      id: schema.pacientes.id,
      cpf: schema.pacientes.cpf,
      rg: schema.pacientes.rg,
      dataNascimento: schema.pacientes.dataNascimento,
      genero: schema.pacientes.genero,
    })
    .from(schema.pacientes)
    .limit(1);
  return linha;
}

describe('os dados que a Greens manda chegam ao cadastro', () => {
  beforeEach(async () => {
    sessao.clerkId = CLERK_ID;
    await limpar();
  });

  afterAll(async () => {
    await limpar();
  });

  it('a. rg, dataNascimento e genero ficam na solicitação', async () => {
    const r = await handoff(corpoDaGreens());

    expect(r.status).toBe(200);
    const s = await solicitacaoDoEmail();
    expect(s.rg).toBe(RG_DA_GREENS);
    expect(s.dataNascimento).toBe(NASCIMENTO);
    // Traduzido para o vocabulário daqui — `MALE` não é valor que alguma tela leia.
    expect(s.genero).toBe('masculino');
  });

  it('b. concluído o cadastro sem redigitar, os três vão para a ficha', async () => {
    await handoff(corpoDaGreens());

    const res = await concluirPeloLink();
    expect(res.sucesso).toBe(true);

    const ficha = await fichaComoAProcuracaoLe();
    expect(ficha.rg).toBe(RG_DA_GREENS);
    expect(ficha.dataNascimento).toBe(NASCIMENTO);
    expect(ficha.genero).toBe('masculino');
  });

  it('c. o que o paciente já tinha na ficha VENCE o que veio do parceiro', async () => {
    await handoff(corpoDaGreens());
    await concluirPeloLink();

    // O paciente corrige o RG no próprio perfil — é o mais recente, e é dele.
    const antes = await fichaComoAProcuracaoLe();
    await db
      .update(schema.pacientes)
      .set({ rg: RG_QUE_O_PACIENTE_JA_TINHA })
      .where(eq(schema.pacientes.id, antes.id));

    // E um handoff novo chega depois, com o RG velho.
    await handoff(corpoDaGreens());
    await db
      .update(schema.solicitacoesCadastro)
      .set({ usadoEm: null })
      .where(eq(schema.solicitacoesCadastro.email, EMAIL));
    await concluirPeloLink();

    /**
     * ⚠️ AS DUAS ASSERÇÕES, E A PRIMEIRA NÃO É ENFEITE. Sem ela o caso passa VACUAMENTE:
     * se o RG do parceiro nunca chegasse, não haveria o que sobrescrever, e o teste ficaria
     * verde provando nada. A primeira prova que o valor ESTAVA disponível; a segunda, que
     * mesmo assim não venceu o do paciente.
     */
    expect((await solicitacaoDoEmail()).rg).toBe(RG_DA_GREENS);
    expect((await fichaComoAProcuracaoLe()).rg).toBe(RG_QUE_O_PACIENTE_JA_TINHA);
  });

  it('d. corpo SEM os três campos: o handoff funciona igual a hoje', async () => {
    const r = await handoff(
      corpoDaGreens({ rg: undefined, dataNascimento: undefined, genero: undefined }),
    );

    expect(r.status).toBe(200);
    expect(r.corpo.sucesso).toBe(true);
    const s = await solicitacaoDoEmail();
    // O cadastro nasce igual; só os três ficam vazios.
    expect(s.protocolo).toBeTruthy();
    expect(s.rg).toBeNull();
    expect(s.dataNascimento).toBeNull();
    expect(s.genero).toBeNull();
  });

  it('e. gênero desconhecido NÃO derruba o handoff — o campo fica vazio', async () => {
    const r = await handoff(corpoDaGreens({ genero: 'VALOR_QUE_NAO_EXISTE_AQUI' }));

    expect(r.status).toBe(200);
    const s = await solicitacaoDoEmail();
    expect(s.genero).toBeNull();
    // E o resto do handoff não é afetado por um campo acessório.
    expect(s.rg).toBe(RG_DA_GREENS);
  });

  it.each([
    ['MALE', 'masculino'],
    ['FEMALE', 'feminino'],
    ['NON_BINARY', 'outro'],
    ['PREFER_NOT_TO_SAY', 'nao_informado'],
  ])('e2. o gênero %s da Greens vira %s aqui', async (deLa, daqui) => {
    await handoff(corpoDaGreens({ genero: deLa }));
    expect((await solicitacaoDoEmail()).genero).toBe(daqui);
  });

  it('f. 🔴 o RG do parceiro é o valor que a PROCURAÇÃO encontra', async () => {
    await handoff(corpoDaGreens());
    await concluirPeloLink();

    /**
     * A procuração lê `pacientes.rg` em `app/api/anvisa/procuracao/route.ts:46` e o usa em
     * `:96` (`paciente.rg ?? ''`) e `:132`. Este caso executa a MESMA leitura; o envio ao
     * DocuSign não é exercido de propósito — ele não decide o valor, só o transporta, e
     * mandar envelope de teste a um serviço externo seria efeito colateral real.
     */
    const ficha = await fichaComoAProcuracaoLe();
    const oQueAProcuracaoImprimiria = ficha.rg ?? '';

    expect(oQueAProcuracaoImprimiria).toBe(RG_DA_GREENS);
    expect(oQueAProcuracaoImprimiria).not.toBe('');
  });

  it('g. a data inexistente é recusada antes de chegar ao Postgres', async () => {
    // `2026-02-31` passa em qualquer regex de formato e não é dia nenhum. Sem a checagem,
    // o erro apareceria como `date/time field value out of range` no meio do handoff.
    const r = await handoff(corpoDaGreens({ dataNascimento: '2026-02-31' }));

    expect(r.status).toBe(200);
    const s = await solicitacaoDoEmail();
    expect(s.dataNascimento).toBeNull();
    // Controle contra vacuidade: nulo aqui tem de ser a data RECUSADA, não o caminho
    // inteiro estar morto. Os vizinhos chegaram.
    expect(s.rg).toBe(RG_DA_GREENS);
  });

  it('h. RG vazio do parceiro não vira string vazia na ficha', async () => {
    // A Greens manda `(patientRg ?? '').trim()` — vazio, não nulo.
    await handoff(corpoDaGreens({ rg: '' }));
    const s = await solicitacaoDoEmail();
    expect(s.rg).toBeNull();
    // Mesmo controle: o nulo é do `''` recusado, não do campo nunca ter chegado.
    expect(s.dataNascimento).toBe(NASCIMENTO);
  });
});
