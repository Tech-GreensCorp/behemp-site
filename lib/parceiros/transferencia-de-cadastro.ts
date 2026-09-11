/**
 * P5 — A TRANSFERÊNCIA DE CADASTRO PARA O PARCEIRO (S2 da ADR-0021).
 *
 * Pedida por cinco passos, em quatro fluxos: Greens 4 (5), BeHemp 1 (3), BeHemp 2 (4) e
 * BeHemp 3 (4). Sempre a mesma frase do dono: _"caso seja consentido pelo paciente e
 * recomendado pelo médico … a greens recebe os dados do paciente + documentação e já cria a
 * conta dele na greens"_.
 *
 * 🔴 ISTO NÃO É O AVISO QUE JÁ EXISTE.
 *
 * O S1 (`lib/parceiros/notificar.ts`) carrega quatro campos e diz QUE algo ficou pronto,
 * nunca O QUE — e há guarda impedindo o contrário. Este módulo leva dado do paciente e
 * documento: é transferência de cadastro, na direção inversa do handoff.
 *
 * ⚠️ NASCE DESLIGADO, E DE PROPÓSITO.
 *
 * Sem `PARCEIRO_TRANSFERENCIA_ATIVA=1` nada sai — `prepararTransferencia` devolve o motivo e
 * não enfileira. Duas razões, e nenhuma é técnica:
 *
 *   1. **Base legal e contrato de operador** entre as duas empresas. Dado de saúde, LGPD
 *      art. 11. É decisão do Jurídico, não de TI (`.claude/rules/seguranca-lgpd.md`).
 *   2. **Os documentos daqui ainda vão para store PÚBLICO** (Item 6). Enquanto isso durar,
 *      qualquer URL assinada que mandarmos é teatro: o objeto já é legível por quem tiver o
 *      endereço. O lado da Greens mediu o bucket deles e provou que é privado — 403 e não 404.
 *      Nós ainda não podemos afirmar o mesmo.
 *
 * Ficar pronto e desligado permite que a Greens implemente o receptor deles agora, contra um
 * contrato real, em vez de esperar por uma decisão que não é de engenharia.
 */

import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/lib/db';
import { solicitacoesCadastro } from '@/db/schema';

import { FINALIDADES, type Finalidade } from './consentimento';
import { consentimentosVigentes } from './consentimento-registrado';
import { podeTransferir, transferenciaAtiva, type MotivoDeRecusa } from './pode-transferir';

/**
 * O corpo que a Greens recebe.
 *
 * ⚠️ O desenho final é DELES — a regra que os dois lados adotaram é que **quem recebe define
 * o formato**. Isto é a proposta da BeHemp, para eles acertarem ou recusarem por escrito.
 */
export interface CorpoDaTransferencia {
  /** O nosso id da solicitação — o que eles já gravam como `behempReferralId`. */
  referralId: string;
  paciente: {
    nomeCompleto: string | null;
    email: string | null;
    telefone: string | null;
    cpf: string | null;
  };
  /**
   * Os documentos, por REFERÊNCIA e não embutidos.
   *
   * URL assinada de vida curta, como a Greens faz conosco. Mandar o arquivo em base64 dobraria
   * o tamanho do corpo e deixaria dado de saúde num log de requisição se alguém o registrar.
   */
  documentos: Array<{ tipo: string; url: string; nomeArquivo: string | null }>;
  consentimento: {
    versao: string;
    finalidades: Finalidade[];
    /** O texto que o paciente LEU. Eles precisam poder provar a que ele disse sim. */
    texto: string;
    concedidoEm: string;
  };
}

/**
 * Monta a transferência se — e só se — tudo que a autoriza estiver presente.
 *
 * 🔴 NUNCA PRESUME O CONSENTIMENTO. Um envio que acontece porque "o paciente clicou em algum
 * momento" é o que transforma consentimento em formalidade. Aqui ele é lido, e a finalidade
 * específica (`retorno_ao_parceiro`) precisa estar entre as que ele aceitou — consentir com a
 * avaliação médica não é consentir com o compartilhamento.
 */
export async function prepararTransferencia(params: {
  solicitacaoId: string;
}): Promise<
  { pronta: true; corpo: CorpoDaTransferencia } | { pronta: false; motivo: MotivoDeRecusa }
> {
  /**
   * A trava vem antes de tocar o banco: desligado é desligado, e nem a consulta acontece.
   */
  if (!transferenciaAtiva()) return { pronta: false, motivo: 'desligada' };

  const [solicitacao] = await db
    .select({
      id: solicitacoesCadastro.id,
      parceiro: solicitacoesCadastro.parceiro,
      pacienteId: solicitacoesCadastro.pacienteId,
      nomeCompleto: solicitacoesCadastro.nomeCompleto,
      email: solicitacoesCadastro.email,
      telefone: solicitacoesCadastro.telefone,
      cpf: solicitacoesCadastro.cpf,
    })
    .from(solicitacoesCadastro)
    .where(
      and(
        eq(solicitacoesCadastro.id, params.solicitacaoId),
        isNull(solicitacoesCadastro.deletedAt),
      ),
    )
    .limit(1);

  if (!solicitacao) return { pronta: false, motivo: 'paciente_nao_encontrado' };
  if (!solicitacao.parceiro) return { pronta: false, motivo: 'sem_parceiro' };
  // Sem ficha de paciente não há a quem atribuir consentimento — e sem ele nada sai.
  if (!solicitacao.pacienteId) return { pronta: false, motivo: 'sem_consentimento' };

  const vigentes = await consentimentosVigentes(solicitacao.pacienteId);
  const permissao = podeTransferir(vigentes.map((c) => c.finalidade));
  if (!permissao.pode) return { pronta: false, motivo: permissao.motivo! };

  /**
   * A versão e a data saem do REGISTRO da finalidade que autoriza o envio, não da constante
   * do módulo. Se a redação mudou depois que ele consentiu, o que vale — e o que a Greens
   * precisa poder provar — é a versão que ele leu (art. 8º §6º).
   */
  const autorizadora = vigentes.find((c) => c.finalidade === FINALIDADES.retornoAoParceiro);
  // `podeTransferir` já garantiu que ela existe. A checagem fica porque um `!` aqui viraria
  // um estouro em produção no dia em que a regra mudar de forma.
  if (!autorizadora) return { pronta: false, motivo: 'sem_consentimento' };

  return {
    pronta: true,
    corpo: {
      referralId: solicitacao.id,
      paciente: {
        nomeCompleto: solicitacao.nomeCompleto,
        email: solicitacao.email,
        telefone: solicitacao.telefone,
        cpf: solicitacao.cpf,
      },
      /**
       * ⚠️ AINDA VAZIO, e o motivo mudou — vale registrar a diferença.
       *
       * Até 10/09 o motivo era o store público: mandar URL assinada de um bucket aberto seria
       * enfeite. Isso foi corrigido — os caminhos novos gravam privado, e a entrega passa por
       * `/api/documentos/<id>/arquivo`, com escopo de objeto e auditoria.
       *
       * O que falta agora é outra coisa: **decidir COMO a Greens acessa**. Duas opções, e a
       * escolha é do lado que recebe:
       *
       *   a) URL assinada de vida curta, como eles fazem conosco — exige gerar a assinatura
       *      aqui e aceitar que quem tiver o link lê, pela validade
       *   b) a nossa rota autenticada, com credencial de máquina para eles — mais controle,
       *      mas exige um caminho de autenticação que não existe entre as empresas hoje
       *
       * Preencher antes dessa decisão seria escolher por eles. Está no §6 da ADR-0021.
       */
      documentos: [],
      consentimento: {
        versao: autorizadora.versao,
        finalidades: vigentes.map((c) => c.finalidade),
        texto: autorizadora.textoApresentado,
        concedidoEm: autorizadora.concedidoEm.toISOString(),
      },
    },
  };
}
