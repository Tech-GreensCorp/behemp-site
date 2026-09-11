import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/lib/db';
import { solicitacoesCadastro } from '@/db/schema';

import { hashDoToken } from './solicitacao';

/**
 * O QUE A PÁGINA DE CADASTRO PRECISA SABER SOBRE UM LINK.
 *
 * Este módulo é a ponte entre o link que o bot entrega e a tela que o paciente abre.
 * A tela é trabalho da Dryelle; o que está aqui é o contrato que ela consome — para que
 * a regra de validade do token more num lugar só, e não seja reimplementada na página.
 */
export type MotivoDeRecusa = 'invalido' | 'expirado' | 'ja_utilizado' | 'cancelado';

export interface SolicitacaoValidada {
  valida: true;
  id: string;
  protocolo: string;
  /** Pré-preenchimento da tela. Qualquer um pode vir vazio — ver o aviso abaixo. */
  nomeCompleto: string | null;
  email: string | null;
  telefone: string | null;
  /** Só existe quando veio do parceiro — o bot do WhatsApp não pede CPF. */
  cpf: string | null;
  /**
   * Qual parceiro encaminhou, ou `null` quando o paciente veio direto pelo nosso WhatsApp.
   *
   * 🔴 É o que decide se a tela PEDE os dados ou apenas os CONFIRMA: quem preencheu o
   * formulário da Greens já digitou nome, CPF, telefone e e-mail lá.
   */
  parceiro: string | null;
  /**
   * 🔴 DE ONDE A SOLICITAÇÃO NASCEU — e é o que decide o que PERGUNTAR.
   *
   * `greens_handoff` = o paciente preencheu o formulário do parceiro. Lá ele já declarou o
   * que tem e o que não tem, e já anexou o que tinha. Perguntar de novo aqui é pedir que ele
   * responda duas vezes a mesma coisa — foi o apontamento do dono em 10/09/2026.
   *
   * Qualquer outra origem (o bot do WhatsApp, de qualquer conta) não coletou nada disso: aí
   * a pergunta é a única forma de saber.
   *
   * ⚠️ Não confundir com `parceiro`. O bot da Greens também grava `parceiro: 'greens'` —
   * mas não passou por formulário nenhum. Quem responde "ele já declarou?" é a ORIGEM.
   */
  origem: string;
  expiraEm: Date;
  /** Quais dos 5 documentos o parceiro já tem. `null` quando não veio de parceiro. */
  /**
   * Lista mista: nome puro, ou objeto com o arquivo já re-hospedado aqui. Quem só precisa
   * saber o que falta usa `normalizarManifesto`, que lê as duas formas.
   */
  documentosDoParceiro: Array<
    | string
    | { tipo: string; urlBlob: string; nomeArquivo: string | null; dataEmissao: string | null }
  > | null;
  /** Destino de volta, JÁ conferido contra a lista de origens quando foi gravado. */
  urlDeRetorno: string | null;
}

export interface SolicitacaoRecusada {
  valida: false;
  motivo: MotivoDeRecusa;
}

/**
 * VALIDA O TOKEN DO LINK E DEVOLVE O QUE PRÉ-PREENCHE A TELA.
 *
 * 🔴 A BUSCA É PELO HASH, NUNCA PELO TOKEN.
 * O banco guarda apenas o SHA-256. Isso significa que o link original não é recuperável
 * nem por quem tem acesso ao banco — e é também por isso que "reenviar o mesmo link" não
 * existe como operação: pedir de novo emite um token novo, e a mensagem do bot avisa que
 * vale sempre o mais recente.
 *
 * ⚠️ TODO CAMPO DE PRÉ-PREENCHIMENTO PODE VIR VAZIO, e a tela precisa aguentar isso.
 * Medido na conta real do greens-corp: existe lead com `name`, `push_name` e
 * `contact_name` TODOS nulos. Assumir nome presente produz "Olá, null!" — ou pior, um
 * formulário que trava porque esperava um dado que a plataforma não tem.
 *
 * 🔴 NÃO REGISTRA O ACESSO. Validar é leitura pura, e a validação roda também em
 * pré-render e em recarga de página. Quem marca o primeiro acesso é
 * `registrarPrimeiroAcesso`, chamada uma vez, do lado do servidor.
 */
export async function validarTokenDeCadastro(
  token: string,
): Promise<SolicitacaoValidada | SolicitacaoRecusada> {
  const limpo = token?.trim();
  // 64 hex é o formato que `gerarToken` emite. Recusar antes de consultar evita que a
  // tabela seja sondada com lixo.
  if (!limpo || !/^[a-f0-9]{64}$/i.test(limpo)) return { valida: false, motivo: 'invalido' };

  const [linha] = await db
    .select()
    .from(solicitacoesCadastro)
    .where(eq(solicitacoesCadastro.tokenHash, hashDoToken(limpo)))
    .limit(1);

  // Não existe e foi apagada respondem igual: distinguir os dois confirmaria a
  // existência de um protocolo a quem chutou o token.
  if (!linha || linha.deletedAt) return { valida: false, motivo: 'invalido' };
  if (linha.status === 'cancelada') return { valida: false, motivo: 'cancelado' };
  if (linha.usadoEm) return { valida: false, motivo: 'ja_utilizado' };
  if (linha.expiraEm.getTime() <= Date.now()) return { valida: false, motivo: 'expirado' };

  return {
    valida: true,
    id: linha.id,
    protocolo: linha.protocolo,
    nomeCompleto: linha.nomeCompleto,
    email: linha.email,
    telefone: linha.telefone,
    cpf: linha.cpf,
    parceiro: linha.parceiro,
    origem: linha.origem,
    expiraEm: linha.expiraEm,
    documentosDoParceiro: linha.documentosDoParceiro ?? null,
    urlDeRetorno: linha.urlDeRetorno ?? null,
  };
}

/**
 * Marca o primeiro acesso ao link.
 *
 * Distingue "o paciente nunca abriu" de "abriu e desistiu no meio" — dois problemas
 * diferentes, com respostas diferentes do atendimento. Só grava na primeira vez: o
 * `is null` no WHERE faz recarregar a página não reescrever o carimbo.
 */
export async function registrarPrimeiroAcesso(id: string): Promise<void> {
  await db
    .update(solicitacoesCadastro)
    .set({ primeiroAcessoEm: new Date(), status: 'link_acessado' })
    .where(and(eq(solicitacoesCadastro.id, id), isNull(solicitacoesCadastro.primeiroAcessoEm)));
}

/**
 * Consome o link, no envio do formulário.
 *
 * 🔴 A CONDIÇÃO `usadoEm is null` FAZ PARTE DO UPDATE, não de um `if` antes dele.
 * Ler-depois-escrever abriria janela para dois envios simultâneos (o duplo clique do
 * paciente é o caso comum) gravarem duas vezes. Aqui o banco decide, e quem perder a
 * corrida recebe `false` — que a tela trata como "já recebemos seus dados".
 */
export async function marcarComoUtilizada(id: string): Promise<boolean> {
  const linhas = await db
    .update(solicitacoesCadastro)
    .set({ usadoEm: new Date(), status: 'enviada' })
    .where(and(eq(solicitacoesCadastro.id, id), isNull(solicitacoesCadastro.usadoEm)))
    .returning({ id: solicitacoesCadastro.id });
  return linhas.length > 0;
}
