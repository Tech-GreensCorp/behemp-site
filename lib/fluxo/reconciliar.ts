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
import { documentos, pacientes, solicitacoesCadastro, users } from '@/db/schema';
import { materializarDocumentosDoParceiro } from '@/lib/parceiros/materializar-documentos';

export type ResultadoDaReconciliacao =
  | { reconciliou: true; pacienteId: string; documentosMaterializados: number }
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

/**
 * RECONCILIA PELO E-MAIL, SEM TOKEN — o caminho de quem entra pela conta.
 *
 * 🔴 ESTA FUNÇÃO NASCEU DE UM ERRO MEU, medido pelo dono em produção em 13/09/2026.
 *
 * A primeira versão da reconciliação vivia só em `/cadastro/[token]`: ela só rodava se o
 * paciente **abrisse o link**. Ele fez o que qualquer pessoa faria — entrou na conta e navegou
 * pelo menu até a ANVISA — e encontrou a tela pedindo os quatro documentos que ele já tinha
 * mandado pela Greens. Palavras dele: _"a falsa reconciliação está acontecendo"_.
 *
 * E ele tinha pedido exatamente isto antes: _"era pra fazer isso automaticamente ANTES DE LOGAR
 * na conta, já que a conta já tá criada e validada"_. Eu pus no lugar errado.
 *
 * ⚠️ POR QUE NÃO DÁ PARA REUSAR `concluirCadastroPorLink` AQUI: ela exige o token, que é a
 * credencial do link. Quem entra pela conta não o tem — e não deveria precisar. O que autentica
 * neste caminho é a **sessão**, que é mais forte: o Clerk já verificou o e-mail.
 *
 * ## O que ela faz, e o que deliberadamente NÃO faz
 *
 * Preenche a ficha com o que a Greens mandou, materializa os documentos e liga a solicitação ao
 * paciente. **Não** consente, **não** responde pergunta clínica, **não** apaga nada.
 *
 * 🔴 E NÃO CONSOME O LINK. O token continua válido: se o paciente abrir o link depois, a tela
 * do cadastro ainda funciona, agora com a ficha já preenchida. Queimar o link aqui tiraria dele
 * um caminho que ele não pediu para perder.
 */
export async function reconciliarPelaSessao(params: {
  clerkId: string;
  email: string;
}): Promise<ResultadoDaReconciliacao> {
  const solicitacao = await solicitacaoAbertaDoEmail(params.email);
  if (!solicitacao) return { reconciliou: false, porque: 'sem_solicitacao_aberta' };

  const [usuario] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, params.clerkId))
    .limit(1);

  if (!usuario) return { reconciliou: false, porque: 'sem_usuario' };

  const [ficha] = await db
    .select({ id: pacientes.id, cpf: pacientes.cpf, origem: pacientes.origem })
    .from(pacientes)
    .where(and(eq(pacientes.userId, usuario.id), isNull(pacientes.deletedAt)))
    .limit(1);

  if (!ficha) return { reconciliou: false, porque: 'sem_ficha' };

  /**
   * ⚠️ SÓ PREENCHE O QUE ESTÁ VAZIO. A ficha pode ter sido completada pelo próprio paciente
   * depois — sobrescrever com o dado do parceiro apagaria a correção que ele fez à mão, que é
   * o oposto de reconciliar.
   */
  const aPreencher = {
    ...(ficha.cpf ? {} : { cpf: solicitacao.cpf ?? undefined }),
    ...(ficha.origem ? {} : { origem: solicitacao.origem, solicitacaoId: solicitacao.id }),
  };

  /**
   * ⚠️ SÓ ATUALIZA SE HOUVER O QUE ATUALIZAR — e isto é outro defeito que a execução achou.
   *
   * Na SEGUNDA passada (esta função roda em todo login), a ficha já tem CPF e procedência, então
   * o objeto fica vazio e o Drizzle recusa com `No values to set`. O erro subia, o `try/catch` do
   * `/redirect` engolia, e a reconciliação parava de funcionar do segundo login em diante — em
   * silêncio, que é o pior modo de falhar.
   */
  if (Object.keys(aPreencher).length > 0) {
    await db.update(pacientes).set(aPreencher).where(eq(pacientes.id, ficha.id));
  }

  /**
   * 🔴 O QUE O DONO FOI PROCURAR E NÃO ACHOU: os documentos da Greens viram documentos dele.
   *
   * ⚠️ E AQUI ESTAVA UM DEFEITO MEU, achado pelo teste de integração antes de chegar a produção.
   *
   * Eu havia escrito no comentário que `materializarDocumentosDoParceiro` "é idempotente".
   * **Não é** — ele sempre insere. Isso era inofensivo enquanto ele rodava uma vez só, dentro do
   * cadastro por link, que consome o token no caminho. Esta função roda em **todo login**: três
   * visitas produziriam três cópias da mesma receita, e a tela da ANVISA viraria uma lista de
   * duplicatas.
   *
   * A idempotência entra aqui, não lá: mexer no materializador mudaria o comportamento do
   * cadastro por link, que tem guardas próprios e não pediu essa mudança.
   */
  const jaMaterializados = await db
    .select({ urlBlob: documentos.urlBlob })
    .from(documentos)
    .where(and(eq(documentos.pacienteId, ficha.id), isNull(documentos.deletedAt)));

  const urlsExistentes = new Set(jaMaterializados.map((d) => d.urlBlob));
  const manifesto = Array.isArray(solicitacao.documentosDoParceiro)
    ? solicitacao.documentosDoParceiro
    : [];

  /**
   * A `urlBlob` é o identificador real do arquivo: mesma URL, mesmo documento. Comparar por
   * TIPO recusaria um segundo RG legítimo (frente e verso chegam separados).
   */
  const aindaNaoCopiados = manifesto.filter(
    (d) =>
      typeof d === 'object' &&
      d !== null &&
      !urlsExistentes.has((d as { urlBlob?: string }).urlBlob ?? ''),
  );

  const copiados = await materializarDocumentosDoParceiro({
    pacienteId: ficha.id,
    documentosDoParceiro: aindaNaoCopiados,
    protocolo: solicitacao.protocolo,
  });

  // O vínculo, para o painel e a sentinela pararem de ver a solicitação como órfã.
  if (!solicitacao.pacienteId) {
    await db
      .update(solicitacoesCadastro)
      .set({ pacienteId: ficha.id })
      .where(eq(solicitacoesCadastro.id, solicitacao.id));
  }

  return {
    reconciliou: true,
    pacienteId: ficha.id,
    documentosMaterializados: copiados.inseridos,
  };
}
