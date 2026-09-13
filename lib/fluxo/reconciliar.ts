/**
 * RECONCILIAÇÃO — o sistema termina sozinho o cadastro que só falta ligar.
 *
 * 🔴 ADR-0022, D-09 (S8.6). Decisão do dono em 13/09/2026, com ele preso no próprio fluxo:
 *
 *   _"a reconciliação deve ser automática, não faz sentido ir novamente para o link que já foi
 *   preenchido, que veio de outro formulário preenchido… ele vai de novo preencher esses dados
 *   por conta de um erro NOSSO na ÚLTIMA ETAPA DE VALIDAÇÃO? não faz sentido."_
 *
 * **Ele está certo, e o argumento é de experiência, não de conveniência.** O paciente preencheu
 * o formulário da Greens, confirmou os dados aqui, respondeu as perguntas e verificou o e-mail.
 * A conta existe e está validada. O que falhou foi a última etapa — e falhou por defeito nosso.
 * Mandá-lo refazer é cobrar dele o preço do nosso erro.
 *
 * ## O que torna isto possível, e foi MEDIDO antes de decidir
 *
 * Eu havia dito que consentimento e resposta clínica impediriam a conclusão automática. Estava
 * errado nos dois:
 *
 *   - **consentimento nunca foi pedágio do cadastro** — há guarda proibindo
 *     (`o-consentimento-e-colhido-antes-de-sair`), porque aceite obtido como condição é viciado
 *     (LGPD art. 8º §3º). Ele governa o ENVIO à Greens, não a existência da ficha
 *   - **`jaFazTratamentoCannabis` é `boolean()` sem `notNull`** — "não informado" é um estado
 *     previsto, não uma lacuna
 *
 * ## O que esta função NÃO faz, de propósito
 *
 * ⚠️ **Não inventa consentimento.** Nenhuma finalidade é marcada aqui. Consentir é ato do
 * titular, e gravar por ele seria pior que não ter.
 *
 * ⚠️ **Não responde por ele.** A pergunta clínica fica `null` — e a tela seguinte pode pedir,
 * porque pedir uma resposta é diferente de pedir tudo de novo.
 *
 * ⚠️ **Não decide identidade.** Só reconcilia quando a conta da sessão é reconhecidamente a
 * dona daquele cadastro; a divergência continua indo para a escolha explícita na tela.
 */

import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/lib/db';
import { solicitacoesCadastro } from '@/db/schema';

export type ResultadoDaReconciliacao =
  | { reconciliou: true; pacienteId: string; destino: string }
  | { reconciliou: false; porque: string };

/**
 * Decide se a sessão pode concluir sozinha aquele cadastro.
 *
 * 🔴 FALHA FECHADA: qualquer dúvida devolve `false` e a tela assume. Concluir automaticamente
 * para a pessoa errada gravaria documento clínico na conta de outro — o custo de errar aqui é
 * muito maior que o de mostrar um formulário a mais.
 */
export function podeReconciliarSozinho(params: {
  emailDaSessao: string | null | undefined;
  emailDaSolicitacao: string | null | undefined;
  emailVerificado: boolean;
}): { pode: boolean; porque: string } {
  const sessao = params.emailDaSessao?.trim().toLowerCase() ?? '';
  const solicitacao = params.emailDaSolicitacao?.trim().toLowerCase() ?? '';

  if (!sessao) return { pode: false, porque: 'sem_sessao' };
  if (!params.emailVerificado) return { pode: false, porque: 'email_nao_verificado' };
  if (!solicitacao) return { pode: false, porque: 'solicitacao_sem_email' };
  if (sessao !== solicitacao) return { pode: false, porque: 'email_diverge' };

  return { pode: true, porque: 'sessao_e_do_dono_do_cadastro' };
}

/**
 * A solicitação aberta desta pessoa, se houver.
 *
 * ⚠️ Só lê. A escrita acontece na action, que é uma só — duas rotas gravando ficha é como
 * nasce a divergência que a ADR-0022 documenta em SETE criadores.
 */
export async function solicitacaoAbertaDoEmail(email: string | null | undefined) {
  const alvo = email?.trim().toLowerCase();
  if (!alvo) return null;

  const [linha] = await db
    .select()
    .from(solicitacoesCadastro)
    .where(
      and(
        eq(solicitacoesCadastro.email, alvo),
        isNull(solicitacoesCadastro.usadoEm),
        isNull(solicitacoesCadastro.deletedAt),
      ),
    )
    .limit(1);

  return linha ?? null;
}
