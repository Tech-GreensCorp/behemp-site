/**
 * A CONFERÊNCIA DE IDENTIDADE DA ETAPA 1 DO CADASTRO — ADR-0028.
 *
 * O que faz: diz se CPF, e-mail ou telefone de quem está no link já existem no sistema, e se a
 * sessão aberta no navegador é dessa pessoa. Responde com um VEREDITO — nunca com o dado que
 * bateu. Só lê: não escreve em tabela nenhuma. Idempotente.
 *
 * Pedido de 28/09/2026 (`DO-59` a `DO-63`): conferir _"logo na etapa 1 do formúlario, não dps
 * que ele preenche tudo"_, por _"cpf, telefone, e-mail"_ (nome parecido não), e o CPF que bate
 * vai _"para o suporte da behemp"_.
 *
 * 🔴 O QUE ESTE MÓDULO NUNCA DEVOLVE: qualquer campo da conta encontrada. A tela recebe
 * `Veredito`, uma palavra. Dizer QUAL dado bateu ("este CPF já está cadastrado") é a resposta
 * que o OWASP chama de incorreta (`OWASP-01`) e, aqui, conta a quem tem o link que aquela pessoa
 * é paciente de cannabis medicinal — dado de saúde (`LGPD-06`). Os ids em `Achados` são
 * internos: nascem e morrem no servidor.
 *
 * ⚠️ A COMPARAÇÃO NORMALIZA OS DOIS LADOS, NO SQL, porque o dado gravado não é uniforme: o CPF
 * vive com e sem pontuação (Item 52), o telefone em quatro formatos (Item 26), e o unique de
 * `users.email` diferencia maiúsculas. Nada é migrado — ADR-0028 D-03.
 */

import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm';

import { pacientes, users } from '@/db/schema';
import { db } from '@/lib/db';
import { consumir, identificarChamador } from '@/lib/seguranca/limite-de-requisicao';

import {
  JANELA_DO_LIMITE_EM_SEGUNDOS,
  LIMITE_POR_IP,
  LIMITE_POR_SOLICITACAO,
  cpfParaConferir,
  decidirVeredito,
  emailParaConferir,
  telefoneParaConferir,
  type Achados,
  type EntradaDaConferencia,
  type EstadoDaSessao,
  type Veredito,
} from './veredito-de-identidade';

export {
  TEXTO_DE_MUITAS_TENTATIVAS,
  TEXTO_DO_SUPORTE,
  TEXTO_DO_TELEFONE_EM_USO,
  telefoneEmUso,
  VEREDITOS,
  VEREDITOS_COM_AVISO,
  decidirVeredito,
  temAviso,
  type Veredito,
  type VereditoComAviso,
} from './veredito-de-identidade';

/**
 * O que o banco sabe sobre estes três dados. Só leitura, e só de linha viva (`deleted_at`).
 */
/** A linha viva de `users` com este e-mail, ignorando maiúsculas. */
async function contaPeloEmail(email: string | null) {
  if (!email) return null;
  const [linha] = await db
    .select({ userId: users.id, clerkId: users.clerkId })
    .from(users)
    .where(and(sql`lower(${users.email}) = ${email}`, isNull(users.deletedAt)))
    .limit(1);
  return linha ?? null;
}

export async function buscarAchados(
  entrada: EntradaDaConferencia,
  /** O e-mail que o LINK trouxe — é a referência do CPF e do telefone (ver `contaDoEmailDoLink`). */
  emailDoLink?: string | null,
): Promise<Achados> {
  const cpf = cpfParaConferir(entrada.cpf);
  const email = emailParaConferir(entrada.email);
  const telefone = telefoneParaConferir(entrada.telefone);
  const doLink = emailParaConferir(emailDoLink);

  const contaDoEmail = await contaPeloEmail(email);
  const contaDoLink = doLink === email ? contaDoEmail : await contaPeloEmail(doLink);

  const donosDoCpf = cpf
    ? await db
        .select({ userId: pacientes.userId })
        .from(pacientes)
        .innerJoin(users, eq(users.id, pacientes.userId))
        .where(
          and(
            sql`regexp_replace(coalesce(${pacientes.cpf}, ''), '[^0-9]', '', 'g') = ${cpf}`,
            isNull(pacientes.deletedAt),
            isNull(users.deletedAt),
          ),
        )
        .limit(10)
    : [];

  const donosDoTelefone = telefone
    ? await db
        .select({ userId: users.id })
        .from(users)
        .where(
          and(
            isNotNull(users.telefone),
            /**
             * A MESMA regra de `telefoneParaConferir`, do lado do banco: só dígitos, e o DDI 55
             * tirado quando está lá. "Os últimos 11" deixaria o fixo gravado com DDI
             * (`551933334444` → `51933334444`) colidir com o celular de outro DDD.
             */
            sql`regexp_replace(regexp_replace(coalesce(${users.telefone}, ''), '[^0-9]', '', 'g'), '^55([0-9]{10,11})$', '\\1') = ${telefone}`,
            isNull(users.deletedAt),
          ),
        )
        .limit(10)
    : [];

  return {
    contaDoEmail: contaDoEmail
      ? { userId: contaDoEmail.userId, temAcesso: Boolean(contaDoEmail.clerkId) }
      : null,
    contaDoEmailDoLink: contaDoLink?.userId ?? null,
    donosDoCpf: donosDoCpf.map((l) => l.userId),
    donosDoTelefone: donosDoTelefone.map((l) => l.userId),
  };
}

/**
 * De quem é a sessão aberta, em relação a este cadastro.
 *
 * A regra é a MESMA da action (`cadastro-por-link.ts`, `sessaoEDoCadastroEmCurso`): a sessão é
 * da pessoa quando o e-mail dela é o do link **ou** o que ela confirmou no fluxo — "Corrigir meus
 * dados" existe porque o parceiro erra o e-mail, e uma trava que recusasse a correção seria beco.
 */
export async function estadoDaSessao(params: {
  clerkId: string | null | undefined;
  emailDaSessao: string | null | undefined;
  emailsDoCadastro: (string | null | undefined)[];
}): Promise<EstadoDaSessao> {
  if (!params.clerkId) return { estado: 'nenhuma' };

  const daSessao = (params.emailDaSessao ?? '').trim().toLowerCase();
  const doCadastro = params.emailsDoCadastro
    .map((e) => (e ?? '').trim().toLowerCase())
    .filter(Boolean);

  // Sem e-mail no cadastro não há com o que comparar: a sessão não é tratada como de outra
  // pessoa — o bot pode mandar só o telefone, e a action confere de novo no envio.
  if (daSessao && doCadastro.length > 0 && !doCadastro.includes(daSessao)) {
    return { estado: 'alheia' };
  }

  const [linha] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.clerkId, params.clerkId), isNull(users.deletedAt)))
    .limit(1);

  return { estado: 'propria', userId: linha?.id ?? null };
}

/**
 * A conferência inteira. Falha nossa não trava o paciente: qualquer exceção vira
 * `indisponivel`, e a tela segue como seguia antes desta conferência existir. A action final
 * confere o CPF de novo (ADR-0028 D-06), então seguir aqui não pula a regra.
 */
export async function conferirIdentidade(params: {
  entrada: EntradaDaConferencia;
  /** O e-mail que o link trouxe (`solicitacao.email`) — nunca o digitado. */
  emailDoLink: string | null | undefined;
  sessao: Parameters<typeof estadoDaSessao>[0];
}): Promise<Veredito> {
  try {
    const [achados, sessao] = await Promise.all([
      buscarAchados(params.entrada, params.emailDoLink),
      estadoDaSessao(params.sessao),
    ]);
    return decidirVeredito({ achados, sessao });
  } catch (erro) {
    // Só o tipo do erro: a mensagem de erro de banco pode carregar o valor da consulta.
    console.error('[identidade] conferência indisponível', {
      tipo: erro instanceof Error ? erro.constructor.name : typeof erro,
    });
    return 'indisponivel';
  }
}

/**
 * Para a action final: o telefone é de OUTRA conta que não a desta pessoa? (`DO-68`)
 *
 * Sem isto, chamar a action direto gravaria o número que a tela travou.
 */
export async function telefoneEstaEmOutraConta(params: {
  telefone: string;
  userIdDaPessoa: string | null;
}): Promise<boolean> {
  if (!telefoneParaConferir(params.telefone)) return false;
  const { donosDoTelefone } = await buscarAchados({ telefone: params.telefone });
  return donosDoTelefone.some((id) => id !== params.userIdDaPessoa);
}

/**
 * Para a action final: o CPF está numa ficha de OUTRA conta que não a desta pessoa?
 *
 * ⚠️ `userIdDaPessoa` é o `users.id` que a action vai usar (pela sessão ou pelo e-mail). É a
 * mesma regra de `decidirVeredito`, reduzida à pergunta que a action precisa responder antes do
 * `insert` — sem ela, chamar a action direto pularia a tela (ADR-0028 D-06).
 */
export async function cpfEstaEmOutraConta(params: {
  cpf: string;
  userIdDaPessoa: string | null;
}): Promise<boolean> {
  const cpf = cpfParaConferir(params.cpf);
  if (!cpf) return false;
  const { donosDoCpf } = await buscarAchados({ cpf });
  return donosDoCpf.some((id) => id !== params.userIdDaPessoa);
}

/**
 * O LIMITE DA CONFERÊNCIA — uma janela por SOLICITAÇÃO e outra por IP (`OWASP-02`).
 *
 * Mora aqui, e não numa das actions, porque as DUAS precisam dele: a da etapa 1 e a final. Um
 * arquivo `'use server'` que exportasse isto o transformaria em endpoint chamável pelo navegador.
 *
 * ⚠️ `prefixo` separa as janelas: a etapa 1 conta toda conferência; a action final conta só as
 * RECUSAS (ver `cadastro-por-link.ts`), porque a reconciliação da página a chama a cada abertura.
 * Os cabeçalhos vêm de quem chama — este módulo não importa `next/headers`.
 *
 * @returns `false` quando qualquer das duas janelas estourou.
 */
export function dentroDoLimiteDaConferencia(
  prefixo: string,
  solicitacaoId: string,
  cabecalhos: Headers,
): boolean {
  const porSolicitacao = consumir(
    `${prefixo}:sol:${solicitacaoId}`,
    LIMITE_POR_SOLICITACAO,
    JANELA_DO_LIMITE_EM_SEGUNDOS,
  );
  const porIp = consumir(
    identificarChamador(cabecalhos, prefixo),
    LIMITE_POR_IP,
    JANELA_DO_LIMITE_EM_SEGUNDOS,
  );
  return porSolicitacao.permitido && porIp.permitido;
}
