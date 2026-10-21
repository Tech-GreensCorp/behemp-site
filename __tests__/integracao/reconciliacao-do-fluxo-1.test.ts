/**
 * SIMULAÇÃO DO CASO REAL — o fluxo 1 da Greens, no estado em que o dono ficou preso.
 *
 * 🔴 ISTO NÃO É GUARDA ESTRUTURAL. Ele EXECUTA a action contra um Postgres de verdade, com o
 * Clerk duplado. É a resposta ao limite que o `CLAUDE.md` registra: _"nenhum guarda executa o
 * fluxo; eles provam que o código está escrito certo"_.
 *
 * Pedido do dono em 13/09/2026: _"eu quero que você teste localmente pra ver se isso funciona…
 * simule essa situação minha para ver se a reconciliação vai ser automática"_.
 *
 * ## O estado que se reproduz aqui, medido das telas dele
 *
 *   - solicitação SOL-000046 aberta, vinda da Greens, com documentos no manifesto
 *   - o e-mail da solicitação é o ANTIGO (o defeito do reaproveitamento por telefone)
 *   - a conta existe no Clerk, com o e-mail CORRIGIDO e verificado
 *   - nada gravado: nem ficha, nem consentimento
 *
 * Rodar: `DATABASE_URL=postgresql://postgres:local@localhost:5544/behemp npx vitest run
 * __tests__/integracao/`
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const CLERK_ID = 'user_simulacao_davi';
const EMAIL_DA_CONTA = 'davi@greens-corp.com';
const EMAIL_ANTIGO_DA_SOLICITACAO = 'davimartins1001@gmail.com';

/**
 * O duplo do Clerk. `auth()` devolve o id da sessão; `currentUser()` o e-mail verificado —
 * exatamente o que a action e a reconciliação leem.
 */
const estadoDaSessao = {
  clerkId: CLERK_ID as string | null,
  email: EMAIL_DA_CONTA,
  verificado: true,
};

vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: estadoDaSessao.clerkId }),
  currentUser: async () => ({
    id: estadoDaSessao.clerkId,
    firstName: 'Davi',
    lastName: 'Martins',
    emailAddresses: [
      {
        emailAddress: estadoDaSessao.email,
        verification: { status: estadoDaSessao.verificado ? 'verified' : 'unverified' },
      },
    ],
  }),
}));

// `revalidatePath` não tem o que revalidar fora do Next.
vi.mock('next/cache', () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

const { db } = await import('@/lib/db');
const schema = await import('@/db/schema');
const { concluirCadastroPorLink } = await import('@/app/_actions/cadastro-por-link');
const { podeReconciliarSozinho, reconciliarPelaSessao } = await import('@/lib/fluxo/reconciliar');
const { gerarToken } = await import('@/lib/chatpro/solicitacao');
const { consentimentoPendente, haCompartilhamentoComParceiro, FINALIDADES_DE_COMPARTILHAMENTO } =
  await import('@/lib/parceiros/consentimento-pendente');

async function limpar() {
  /**
   * ⚠️ OS LOGS PRIMEIRO, e isto é prova de que a correção da auditoria pegou: antes de
   * 13/09/2026 esta linha era desnecessária, porque `logs_auditoria` **nunca recebia nada** — a
   * FK era violada em silêncio a cada cadastro. Agora ela grava, e o delete de `users` esbarra
   * na referência. O teste passou a precisar limpar o que o sistema passou a registrar.
   */
  await db.delete(schema.logsAuditoria);
  await db.delete(schema.documentos);
  await db.delete(schema.consentimentos);
  await db.delete(schema.pacientes);
  await db.delete(schema.solicitacoesCadastro);
  await db.delete(schema.users);
}

/** Reproduz a SOL-000046: aberta, da Greens, com o e-mail ANTIGO e documentos no manifesto. */
async function semearOCasoDoDono() {
  const { token, hash } = gerarToken();

  await db.insert(schema.solicitacoesCadastro).values({
    protocolo: 'SOL-000046',
    tokenHash: hash,
    expiraEm: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    nomeCompleto: 'Davi Rhuan Silva Martins',
    email: EMAIL_ANTIGO_DA_SOLICITACAO,
    telefone: '5598970134822',
    cpf: '03939508837',
    origem: 'greens_handoff',
    parceiro: 'greens',
    // A forma real do manifesto (`DocumentoDoParceiro[]`), não uma inventada pelo teste.
    documentosDoParceiro: [
      {
        tipo: 'receita_medica',
        urlBlob: 'https://exemplo.invalid/receita.pdf',
        nomeArquivo: 'receita.pdf',
        dataEmissao: null,
      },
    ],
  });

  return token;
}

/**
 * ⚠️ NO ESCOPO DO ARQUIVO, e não dentro de um `describe`.
 *
 * Defeito meu, achado ao acrescentar o terceiro bloco: o `beforeEach` vivia dentro do primeiro
 * `describe`, então os blocos seguintes rodavam sobre o estado deixado pelo anterior — e o
 * segundo cadastro morria com protocolo duplicado. O sintoma apontava para o insert; a causa
 * era o escopo da limpeza.
 */
beforeEach(async () => {
  await limpar();
  estadoDaSessao.clerkId = CLERK_ID;
  estadoDaSessao.email = EMAIL_DA_CONTA;
  estadoDaSessao.verificado = true;
});

afterAll(limpar);

describe('o caso real do dono, executado contra um Postgres de verdade', () => {
  it('🔴 A DECISÃO: com e-mail DIVERGENTE, a reconciliação automática NÃO acontece', () => {
    /**
     * É o estado exato em que ele ficou: conta `davi@greens-corp.com`, solicitação com
     * `davimartins1001@gmail.com`. A reconciliação recusa — e recusa CERTO: ela não tem como
     * saber, sozinha, que as duas são a mesma pessoa.
     */
    const veredicto = podeReconciliarSozinho({
      emailDaSessao: EMAIL_DA_CONTA,
      emailDaSolicitacao: EMAIL_ANTIGO_DA_SOLICITACAO,
      emailVerificado: true,
    });

    expect(veredicto.pode).toBe(false);
    expect(veredicto.porque).toBe('email_diverge');
  });

  it('🔴 mas o CADASTRO conclui assim mesmo — a trava aceita o e-mail confirmado no fluxo', async () => {
    /**
     * E é isto que destrava o caso dele: a action aceita a sessão quando ela casa com o e-mail
     * que o paciente confirmou, mesmo que a solicitação guarde outro.
     */
    const token = await semearOCasoDoDono();

    const r = await concluirCadastroPorLink({
      token,
      nomeCompleto: 'Davi Rhuan Silva Martins',
      cpf: '03939508837',
      telefone: '5598970134822',
      email: EMAIL_DA_CONTA,
      jaFazTratamento: null,
      temAutorizacaoAnvisa: null,
      temReceitaMedica: null,
      anexos: [],
      tratamentoAtual: null,
      finalidadesConsentidas: [],
    });

    expect(r.sucesso, `a action recusou: ${JSON.stringify(r)}`).toBe(true);
  });

  it('🔴 e a FICHA nasce com os dados da Greens', async () => {
    const token = await semearOCasoDoDono();
    await concluirCadastroPorLink({
      token,
      nomeCompleto: 'Davi Rhuan Silva Martins',
      cpf: '03939508837',
      telefone: '5598970134822',
      email: EMAIL_DA_CONTA,
      jaFazTratamento: null,
      temAutorizacaoAnvisa: null,
      temReceitaMedica: null,
      anexos: [],
      tratamentoAtual: null,
      finalidadesConsentidas: [],
    });

    const [ficha] = await db.select().from(schema.pacientes);
    expect(ficha, 'nenhuma ficha foi criada').toBeTruthy();
    expect(ficha.cpf).toBe('03939508837');
    // A procedência sobrevive (S8.2) — é o que faz a tela saber de onde ele veio.
    expect(ficha.origem).toBe('greens_handoff');
  });

  it('🔴 e o E-MAIL da solicitação é CORRIGIDO — senão o beco volta pela próxima tela', async () => {
    const token = await semearOCasoDoDono();
    await concluirCadastroPorLink({
      token,
      nomeCompleto: 'Davi Rhuan Silva Martins',
      cpf: '03939508837',
      telefone: '5598970134822',
      email: EMAIL_DA_CONTA,
      jaFazTratamento: null,
      temAutorizacaoAnvisa: null,
      temReceitaMedica: null,
      anexos: [],
      tratamentoAtual: null,
      finalidadesConsentidas: [],
    });

    const [sol] = await db.select().from(schema.solicitacoesCadastro);
    expect(sol.email, 'a solicitação ficou com o e-mail antigo').toBe(EMAIL_DA_CONTA);
  });

  it('🔴 "não informado" é GRAVADO como null — não vira "não faz tratamento"', async () => {
    const token = await semearOCasoDoDono();
    await concluirCadastroPorLink({
      token,
      nomeCompleto: 'Davi Rhuan Silva Martins',
      cpf: '03939508837',
      telefone: '5598970134822',
      email: EMAIL_DA_CONTA,
      jaFazTratamento: null,
      temAutorizacaoAnvisa: null,
      temReceitaMedica: null,
      anexos: [],
      tratamentoAtual: null,
      finalidadesConsentidas: [],
    });

    const [ficha] = await db.select().from(schema.pacientes);
    expect(ficha.jaFazTratamentoCannabis, 'inventou resposta clínica').toBeNull();
  });

  it('🔴 e o CONSENTIMENTO não é inventado — nenhuma linha nasce sem ato do titular', async () => {
    const token = await semearOCasoDoDono();
    await concluirCadastroPorLink({
      token,
      nomeCompleto: 'Davi Rhuan Silva Martins',
      cpf: '03939508837',
      telefone: '5598970134822',
      email: EMAIL_DA_CONTA,
      jaFazTratamento: null,
      temAutorizacaoAnvisa: null,
      temReceitaMedica: null,
      anexos: [],
      tratamentoAtual: null,
      finalidadesConsentidas: [],
    });

    const linhas = await db.select().from(schema.consentimentos);
    expect(linhas.length, 'consentimento gravado sem o paciente consentir').toBe(0);
  });

  it('🔴 FALHA FECHADA: sessão de OUTRA pessoa não conclui o cadastro', async () => {
    const token = await semearOCasoDoDono();
    estadoDaSessao.email = 'invasor@exemplo.com';

    const r = await concluirCadastroPorLink({
      token,
      nomeCompleto: 'Davi Rhuan Silva Martins',
      cpf: '03939508837',
      telefone: '5598970134822',
      // O atacante não controla o e-mail da solicitação nem o da sessão: os dois divergem.
      email: EMAIL_ANTIGO_DA_SOLICITACAO,
      jaFazTratamento: null,
      temAutorizacaoAnvisa: null,
      temReceitaMedica: null,
      anexos: [],
      tratamentoAtual: null,
      finalidadesConsentidas: [],
    });

    expect(r.sucesso, 'a ficha foi para a conta errada').toBe(false);
    const fichas = await db.select().from(schema.pacientes);
    expect(fichas.length, 'nasceu ficha para a sessão errada').toBe(0);
  });

  it('🔴 o LINK é consumido — e só uma vez', async () => {
    const token = await semearOCasoDoDono();
    const dados = {
      token,
      nomeCompleto: 'Davi Rhuan Silva Martins',
      cpf: '03939508837',
      telefone: '5598970134822',
      email: EMAIL_DA_CONTA,
      jaFazTratamento: null,
      temAutorizacaoAnvisa: null,
      temReceitaMedica: null,
      anexos: [],
      tratamentoAtual: null,
      finalidadesConsentidas: [],
    };

    const primeira = await concluirCadastroPorLink({ ...dados });
    expect(primeira.sucesso).toBe(true);

    const segunda = await concluirCadastroPorLink({ ...dados });
    expect(segunda.sucesso, 'o link de uso único aceitou a segunda vez').toBe(false);

    const [sol] = await db.select().from(schema.solicitacoesCadastro);
    expect(sol.usadoEm, 'o link não foi marcado como usado').toBeTruthy();
    expect(sol.pacienteId, 'o vínculo com a ficha não foi gravado').toBeTruthy();
  });
});

/**
 * O CONSENTIMENTO QUE FALTOU — pedido do dono em 13/09/2026, e testado executando.
 *
 * A reconciliação conclui sem o paciente, então não consente por ele. O buraco resultante é
 * previsível: ficha existe, fluxo segue, e nada autoriza o envio à Greens. Estes casos provam
 * que o sistema **sabe** que falta, e que ele não pede quando não há o que autorizar.
 */
describe('o consentimento que faltou se anuncia — e só quando há compartilhamento', () => {
  it('🔴 veio da Greens e não consentiu → PEDE', () => {
    const r = consentimentoPendente({ vigentes: [], haCompartilhamento: true });
    expect(r.pedir).toBe(true);
    expect(r.faltando.length).toBeGreaterThan(0);
    expect(r.porque).toBe('falta_consentimento_de_compartilhamento');
  });

  it('🔴 já consentiu tudo → NÃO pede de novo', () => {
    const r = consentimentoPendente({
      vigentes: FINALIDADES_DE_COMPARTILHAMENTO,
      haCompartilhamento: true,
    });
    expect(r.pedir).toBe(false);
    expect(r.porque).toBe('ja_consentiu_tudo');
  });

  it('🔴 cadastro próprio da BeHemp → NÃO pede: não há o que autorizar', () => {
    /**
     * Pedir autorização sem finalidade é coleta sem propósito — a LGPD trata como vício, não
     * como zelo. E treina a pessoa a marcar caixa sem ler.
     */
    const r = consentimentoPendente({ vigentes: [], haCompartilhamento: false });
    expect(r.pedir).toBe(false);
    expect(r.porque).toBe('sem_compartilhamento');
  });

  it('🔴 a PROCEDÊNCIA decide se há compartilhamento (S8.2, D-08)', () => {
    expect(haCompartilhamentoComParceiro('greens_handoff'), 'a Greens não conta').toBe(true);
    expect(haCompartilhamentoComParceiro('chatpro_bot'), 'o ChatPro não conta').toBe(true);
    expect(haCompartilhamentoComParceiro('painel_admin'), 'cadastro interno pede à toa').toBe(
      false,
    );
  });

  it('⚠️ ficha ANTIGA (origem null) não é assumida como compartilhada', () => {
    /**
     * Ficha nascida antes da procedência não diz de onde veio. Assumir que veio da Greens
     * pediria autorização com base em suposição sobre alguém — e conta antiga não é bloqueada
     * nem incomodada (ADR-0022, D-07/R9).
     */
    expect(haCompartilhamentoComParceiro(null)).toBe(false);
    expect(consentimentoPendente({ vigentes: [], haCompartilhamento: false }).pedir).toBe(false);
  });

  it('🔴 e a reconciliação DEIXA esse estado — é o que torna o aviso necessário', async () => {
    /**
     * Prova a ligação entre as duas peças, executando: depois de reconciliar, o paciente tem
     * ficha da Greens e ZERO consentimento — exatamente o caso que o bloco veio cobrir.
     */
    const token = await semearOCasoDoDono();
    await concluirCadastroPorLink({
      token,
      nomeCompleto: 'Davi Rhuan Silva Martins',
      cpf: '03939508837',
      telefone: '5598970134822',
      email: EMAIL_DA_CONTA,
      jaFazTratamento: null,
      temAutorizacaoAnvisa: null,
      temReceitaMedica: null,
      anexos: [],
      tratamentoAtual: null,
      finalidadesConsentidas: [],
    });

    const [ficha] = await db.select().from(schema.pacientes);
    const linhas = await db.select().from(schema.consentimentos);

    expect(linhas.length, 'consentimento foi inventado').toBe(0);

    const r = consentimentoPendente({
      vigentes: [],
      haCompartilhamento: haCompartilhamentoComParceiro(ficha.origem),
    });
    expect(r.pedir, 'o sistema não sabe que falta consentimento').toBe(true);
  });
});

/**
 * 🔴 O QUE MAIS IMPORTA AO DONO, e o que eu ainda NÃO tinha provado: os documentos que a Greens
 * mandou aparecem na tela da procuração.
 *
 * _"era pra salvar os dados vindos e entregar já na tela de procuração"_ — é o objetivo do
 * portão 1 inteiro. Concluir o cadastro sem os documentos seria fechar o fluxo pela metade.
 */
describe('os documentos da Greens chegam à ficha', () => {
  it('🔴 quantos documentos viram linha em `documentos` depois do cadastro', async () => {
    const token = await semearOCasoDoDono();
    await concluirCadastroPorLink({
      token,
      nomeCompleto: 'Davi Rhuan Silva Martins',
      cpf: '03939508837',
      telefone: '5598970134822',
      email: EMAIL_DA_CONTA,
      jaFazTratamento: null,
      temAutorizacaoAnvisa: null,
      temReceitaMedica: null,
      anexos: [],
      tratamentoAtual: null,
      finalidadesConsentidas: [],
    });

    const docs = await db.select().from(schema.documentos);
    /**
     * 🔴 MEDIDO EM 13/09/2026: 1 documento, tipo `receita_medica`. E note a URL do fixture —
     * `https://exemplo.invalid/` **não existe**. Gravou assim mesmo, e isso confirma o que a
     * ADR-0022 §20.2 afirmava: o arquivo é baixado e re-hospedado **na entrada do handoff**, não
     * no cadastro. A materialização só cria a linha apontando para o que já é nosso.
     *
     * ⚠️ É o que sustenta o portão 1: sem esta linha, o paciente cai na procuração da ANVISA e a
     * tela pede de novo o documento que a Greens já entregou.
     */
    expect(docs.length, 'o documento da Greens NÃO chegou à ficha').toBe(1);
    expect(docs[0].tipo).toBe('receita_medica');

    // E pertence à ficha certa — documento órfão não aparece em tela nenhuma.
    const [ficha] = await db.select().from(schema.pacientes);
    expect(docs[0].pacienteId).toBe(ficha.id);
  });
});

/**
 * 🔴 O CAMINHO QUE O DONO REALMENTE PERCORREU — e que a primeira versão não cobria.
 *
 * Ele entrou na conta e navegou pelo menu até a ANVISA. Nunca abriu o link. A reconciliação
 * vivia só em `/cadastro/[token]`, então nunca rodou — e a tela pediu os quatro documentos que
 * ele já tinha mandado pela Greens. _"A falsa reconciliação está acontecendo."_
 *
 * Estes casos executam `reconciliarPelaSessao`, que é o caminho de quem entra pela conta: sem
 * token, autenticado pela sessão.
 */
describe('reconciliação pela SESSÃO — quem entra pela conta, sem abrir o link', () => {
  /** O estado de quem logou: conta, `users`, e a ficha casca que o `/redirect` cria (G2). */
  async function semearQuemJaLogou() {
    await semearOCasoDoDono();
    const [u] = await db
      .insert(schema.users)
      .values({
        email: EMAIL_ANTIGO_DA_SOLICITACAO,
        nome: 'Davi Rhuan Silva Martins',
        clerkId: CLERK_ID,
        role: 'paciente',
      })
      .returning({ id: schema.users.id });

    // A ficha CASCA: sem CPF, sem procedência — exatamente como o `/redirect` a cria.
    await db.insert(schema.pacientes).values({
      userId: u.id,
      status: 'aguardando_consulta',
      jornadaFase: 'acolhimento',
    });
  }

  it('🔴 materializa os documentos da Greens SEM token — era o que faltava', async () => {
    await semearQuemJaLogou();

    const r = await reconciliarPelaSessao({
      clerkId: CLERK_ID,
      email: EMAIL_ANTIGO_DA_SOLICITACAO,
    });

    expect(r.reconciliou, `não reconciliou: ${JSON.stringify(r)}`).toBe(true);
    if (r.reconciliou) {
      expect(r.documentosMaterializados, 'nenhum documento chegou à ficha').toBe(1);
    }

    const docs = await db.select().from(schema.documentos);
    expect(docs.length).toBe(1);
    expect(docs[0].tipo).toBe('receita_medica');
  });

  it('🔴 e preenche a ficha CASCA com o que a Greens mandou', async () => {
    await semearQuemJaLogou();
    await reconciliarPelaSessao({ clerkId: CLERK_ID, email: EMAIL_ANTIGO_DA_SOLICITACAO });

    const [ficha] = await db.select().from(schema.pacientes);
    expect(ficha.cpf, 'o CPF da Greens não foi aproveitado').toBe('03939508837');
    expect(ficha.origem, 'a procedência não foi gravada').toBe('greens_handoff');
  });

  it('🔴 e LIGA a solicitação à ficha — senão a sentinela continua vendo órfão', async () => {
    await semearQuemJaLogou();
    await reconciliarPelaSessao({ clerkId: CLERK_ID, email: EMAIL_ANTIGO_DA_SOLICITACAO });

    const [sol] = await db.select().from(schema.solicitacoesCadastro);
    const [ficha] = await db.select().from(schema.pacientes);
    expect(sol.pacienteId).toBe(ficha.id);
  });

  it('⚠️ NÃO consome o link — o cadastro pelo token continua possível', async () => {
    /**
     * Queimar o link aqui tiraria do paciente um caminho que ele não pediu para perder. A
     * reconciliação é oportunidade, não substituição do fluxo.
     */
    await semearQuemJaLogou();
    await reconciliarPelaSessao({ clerkId: CLERK_ID, email: EMAIL_ANTIGO_DA_SOLICITACAO });

    const [sol] = await db.select().from(schema.solicitacoesCadastro);
    expect(sol.usadoEm, 'a reconciliação queimou o link').toBeNull();
  });

  it('🔴 é IDEMPOTENTE — rodar a cada login não duplica documento', async () => {
    /**
     * Ela roda em TODO login. Sem idempotência, o paciente acumularia uma cópia da receita por
     * visita — e a tela da ANVISA viraria uma lista de duplicatas.
     */
    await semearQuemJaLogou();
    await reconciliarPelaSessao({ clerkId: CLERK_ID, email: EMAIL_ANTIGO_DA_SOLICITACAO });
    await reconciliarPelaSessao({ clerkId: CLERK_ID, email: EMAIL_ANTIGO_DA_SOLICITACAO });
    await reconciliarPelaSessao({ clerkId: CLERK_ID, email: EMAIL_ANTIGO_DA_SOLICITACAO });

    const docs = await db.select().from(schema.documentos);
    expect(docs.length, 'três logins geraram três cópias do mesmo documento').toBe(1);
  });

  it('⚠️ sem solicitação aberta, não faz nada — e diz por quê', async () => {
    const r = await reconciliarPelaSessao({ clerkId: CLERK_ID, email: 'ninguem@exemplo.com' });
    expect(r.reconciliou).toBe(false);
    if (!r.reconciliou) expect(r.porque).toBe('sem_solicitacao_aberta');
  });
});
