/**
 * HÁ UM CADASTRO ESPERANDO ESTA PESSOA? — a pergunta que ninguém fazia.
 *
 * 🔴 ADR-0022, D-02. O dono percorreu o fluxo 1 da Greens, ficou com uma conta funcionando e
 * um painel vazio, e resumiu o que faltava: _"a forma de contornar isso é o sistema saber
 * quando tiver faltando algo de uma etapa e continuar a partir disso"_.
 *
 * ⚠️ O CADASTRO NÃO SE PERDEU — e é isso que torna o painel vazio tão ruim. A solicitação
 * continua em `solicitacoes_cadastro`, com os dados e os documentos que a Greens entregou, e o
 * token só é consumido **depois** da ficha gravar. Medido em produção em 12/09/2026: o link do
 * dono ainda respondia `Confirme seus dados` enquanto o painel dele dizia "nenhum documento
 * enviado". As duas coisas eram verdade ao mesmo tempo, e nenhuma tela ligava uma à outra.
 *
 * 🔴 CASA PELO E-MAIL, e é a única chave possível aqui. A solicitação nasce **antes** da conta
 * — quando a Greens manda o cadastro, não há `clerkId` nem `pacienteId` para amarrar. O e-mail
 * é o que atravessa os dois mundos, e `users.email` é único.
 *
 * ⚠️ SÓ LÊ. Não cria, não consome, não decide destino: informa que existe algo pendente e
 * diz que existe algo pendente para a tela orientar. Pendência avisa, não bloqueia (ADR-0016
 * D-06).
 */

import { and, desc, eq, isNull, gt } from 'drizzle-orm';

import { db } from '@/lib/db';
import { solicitacoesCadastro } from '@/db/schema';

export interface CadastroPendente {
  protocolo: string;
  /** De qual parceiro veio, quando veio de um. */
  parceiro: string | null;
  /** Até quando o link dele ainda vale — a tela diz isso, para dar urgência honesta. */
  expiraEm: Date;
}

/**
 * 🔴 O LINK NÃO É RECONSTRUÍVEL, e isso é de propósito.
 *
 * O banco guarda `tokenHash`, nunca o token em claro (ADR-0016 D-04): quem lê o banco não
 * consegue abrir o cadastro de ninguém. É a mitigação que a OWASP pede para token de acesso,
 * e **preservar isso vale mais** do que a conveniência de remontar a URL aqui.
 *
 * ⚠️ Então o aviso informa e orienta — protocolo, prazo, e o caminho de pedir o link de novo
 * pelo WhatsApp —, em vez de prometer um botão que não pode existir. Dizer "continue aqui" e
 * levar a lugar nenhum seria pior que não avisar.
 */

/**
 * A solicitação aberta deste e-mail, se houver.
 *
 * @param email o e-mail da conta que acabou de entrar
 */
export async function cadastroPendenteDoEmail(
  email: string | null | undefined,
): Promise<CadastroPendente | null> {
  const alvo = email?.trim().toLowerCase();
  if (!alvo) return null;

  try {
    const [linha] = await db
      .select({
        protocolo: solicitacoesCadastro.protocolo,
        parceiro: solicitacoesCadastro.parceiro,
        expiraEm: solicitacoesCadastro.expiraEm,
      })
      .from(solicitacoesCadastro)
      .where(
        and(
          eq(solicitacoesCadastro.email, alvo),
          /**
           * 🔴 AS TRÊS CONDIÇÕES QUE FAZEM "PENDENTE" SIGNIFICAR ALGO:
           *
           * - `usadoEm IS NULL` — quem já concluiu não tem nada esperando. Sem isto, o
           *   aviso apareceria para sempre, e aviso que não some ninguém lê.
           * - `expiraEm > agora` — link vencido não é caminho, é frustração: o paciente
           *   clicaria para ouvir que expirou.
           * - `pacienteId IS NULL` — a ficha ainda não foi vinculada. É o que separa
           *   "cadastro pela metade" de "cadastro feito".
           */
          isNull(solicitacoesCadastro.usadoEm),
          gt(solicitacoesCadastro.expiraEm, new Date()),
          isNull(solicitacoesCadastro.pacienteId),
        ),
      )
      .orderBy(desc(solicitacoesCadastro.createdAt))
      .limit(1);

    if (!linha?.protocolo) return null;

    return {
      protocolo: linha.protocolo,
      parceiro: linha.parceiro ?? null,
      expiraEm: linha.expiraEm,
    };
  } catch (erro) {
    /**
     * ⚠️ NUNCA DERRUBA O PAINEL. Isto é um aviso; se a consulta falhar, o paciente entra
     * como entrava antes. Um enfeite que quebra a tela é pior que a ausência dele.
     */
    console.error('[parceiros] falha ao procurar cadastro pendente', {
      // Nunca o e-mail — é dado pessoal, e log não é lugar dele.
      erro: erro instanceof Error ? erro.name : 'desconhecido',
    });
    return null;
  }
}
