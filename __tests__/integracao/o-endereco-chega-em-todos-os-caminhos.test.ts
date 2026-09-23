/**
 * O ENDEREÇO E O CEP CHEGAM À FICHA PELOS TRÊS CAMINHOS — não só quando ela nasce aqui.
 *
 * 🔴 O QUE ACONTECEU, 23/09/2026. O chefe do dono relatou que "até de manhã chegava o CEP e o
 * endereço", e à tarde a procuração saiu com `residente à [endereço completo], CEP [________]`
 * — os placeholders de `lib/receituario/procuracao-pdf.tsx:160`, que só aparecem quando
 * `pacientes.endereco` e `pacientes.cep` estão vazios.
 *
 * ⚠️ A EVIDÊNCIA QUE FECHOU O DIAGNÓSTICO: no MESMO cadastro, o RG chegou e o endereço não.
 * O RG é gravado por um bloco pós-transação que cobre os três caminhos; o endereço só existia
 * no `insert`. Um funcionar e o outro não prova que a ficha JÁ EXISTIA — e aí o `insert` nunca
 * roda.
 *
 * `concluirCadastroPorLink` tem três caminhos até a ficha:
 *
 *   1. `insert`            — ficha nova. Gravava cep/endereço/cidade/uf. ✅
 *   2. `update` existente  — a casca que o `/redirect` cria (ADR-0022 G2). NÃO gravava. ❌
 *   3. corrida com o webhook do Clerk — `onConflictDoNothing` devolve vazio, e a linha do
 *      webhook é reusada sem atualizar nada. NÃO gravava. ❌
 *
 * Nos dois últimos o endereço que o paciente digitou no formulário era descartado em silêncio:
 * o cadastro dizia "pronto", e a procuração saía sem endereço semanas depois.
 *
 * Rodar:
 *   DATABASE_URL=postgresql://postgres:local@localhost:5544/behemp \
 *     npx vitest run --config vitest.integracao.mts \
 *     __tests__/integracao/o-endereco-chega-em-todos-os-caminhos.test.ts
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const CLERK_ID = 'user_endereco_de_teste';
const EMAIL = 'paciente.endereco@exemplo.test';

/** Fictícios e óbvios. */
const CEP = '01310-100';
const ENDERECO = 'Av. Paulista, 1000 — Bela Vista';
const CIDADE = 'São Paulo';
const UF = 'SP';

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
const { concluirCadastroPorLink } = await import('@/app/_actions/cadastro-por-link');
const { gerarToken } = await import('@/lib/chatpro/solicitacao');

async function limpar() {
  await db.delete(schema.logsAuditoria);
  await db.delete(schema.documentos);
  await db.delete(schema.consentimentos);
  await db.delete(schema.pacientes);
  await db.delete(schema.solicitacoesCadastro);
  await db.delete(schema.users);
}

/** Uma solicitação utilizável, como a que chega por link do WhatsApp. Devolve o token. */
async function solicitacaoComToken() {
  const { token, hash } = gerarToken();
  await db.insert(schema.solicitacoesCadastro).values({
    protocolo: `SOL-${Date.now()}`,
    email: EMAIL,
    telefone: '11999990000',
    nomeCompleto: 'Paciente Fictício de Teste',
    tokenHash: hash,
    expiraEm: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    origem: 'greens_handoff',
    parceiro: 'greens',
    canalDeEntrega: 'parceiro_redirect',
  });
  return token;
}

/** A conta do Clerk já existe no nosso `users` — é o estado depois do webhook. */
async function usuarioExistente() {
  const [u] = await db
    .insert(schema.users)
    .values({
      clerkId: CLERK_ID,
      email: EMAIL,
      nome: 'Paciente Fictício de Teste',
      role: 'paciente',
    })
    .returning({ id: schema.users.id });
  return u.id;
}

function formulario(token: string) {
  return {
    token,
    nomeCompleto: 'Paciente Fictício de Teste',
    email: EMAIL,
    telefone: '11999990000',
    cpf: '52998224725',
    jaFazTratamento: false,
    cep: CEP,
    endereco: ENDERECO,
    cidade: CIDADE,
    uf: UF,
  } as Parameters<typeof concluirCadastroPorLink>[0];
}

/** A ficha lida com as MESMAS colunas que a procuração seleciona (`route.ts:44-51`). */
async function fichaComoAProcuracaoLe() {
  const [l] = await db
    .select({
      id: schema.pacientes.id,
      cep: schema.pacientes.cep,
      endereco: schema.pacientes.endereco,
      cidade: schema.pacientes.cidade,
      uf: schema.pacientes.uf,
    })
    .from(schema.pacientes)
    .limit(1);
  return l;
}

describe('o endereço chega à ficha pelos três caminhos', () => {
  beforeEach(async () => {
    sessao.clerkId = CLERK_ID;
    await limpar();
  });
  afterAll(limpar);

  it('1. ficha NOVA (insert) — o endereço é gravado', async () => {
    const token = await solicitacaoComToken();

    const r = await concluirCadastroPorLink(formulario(token));
    expect(r.sucesso).toBe(true);

    const f = await fichaComoAProcuracaoLe();
    expect(f.cep).toBe(CEP);
    expect(f.endereco).toBe(ENDERECO);
    expect(f.cidade).toBe(CIDADE);
    expect(f.uf).toBe(UF);
  });

  it('2. 🔴 ficha JÁ EXISTE (a casca do /redirect) — o endereço não pode ser descartado', async () => {
    const token = await solicitacaoComToken();
    const userId = await usuarioExistente();
    // A casca: ficha sem nada, criada antes pelo `/redirect`.
    await db.insert(schema.pacientes).values({ userId });

    const r = await concluirCadastroPorLink(formulario(token));
    expect(r.sucesso).toBe(true);

    const f = await fichaComoAProcuracaoLe();
    expect(f.cep).toBe(CEP);
    expect(f.endereco).toBe(ENDERECO);
    expect(f.cidade).toBe(CIDADE);
    expect(f.uf).toBe(UF);
  });

  it('3. o que o paciente JÁ tinha não é apagado por um formulário vazio', async () => {
    const token = await solicitacaoComToken();
    const userId = await usuarioExistente();
    await db.insert(schema.pacientes).values({ userId, cep: CEP, endereco: ENDERECO });

    const semEndereco = { ...formulario(token) };
    delete (semEndereco as Record<string, unknown>).cep;
    delete (semEndereco as Record<string, unknown>).endereco;

    const r = await concluirCadastroPorLink(semEndereco);
    expect(r.sucesso).toBe(true);

    const f = await fichaComoAProcuracaoLe();
    expect(f.cep).toBe(CEP);
    expect(f.endereco).toBe(ENDERECO);
  });

  it('4. o endereço novo VENCE o antigo — é o mais recente, e é do paciente', async () => {
    const token = await solicitacaoComToken();
    const userId = await usuarioExistente();
    await db
      .insert(schema.pacientes)
      .values({ userId, cep: '99999-999', endereco: 'Endereço velho' });

    const r = await concluirCadastroPorLink(formulario(token));
    expect(r.sucesso).toBe(true);

    const f = await fichaComoAProcuracaoLe();
    expect(f.cep).toBe(CEP);
    expect(f.endereco).toBe(ENDERECO);
  });
});
