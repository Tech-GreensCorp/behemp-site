'use server';

/**
 * CONCLUSÃO DO CADASTRO QUE VEIO DO WHATSAPP.
 *
 * O paciente chegou pelo bot, recebeu um link de uso único e preencheu a tela
 * `/cadastro/{token}`. A conta de acesso é criada pelo Clerk **no navegador** (e-mail é o
 * login, senha é dele, confirmada por código). Esta action é o passo seguinte: grava o que
 * ele declarou e transforma a solicitação em paciente do sistema.
 *
 * 🔴 A ORDEM É DELIBERADA — CONTA PRIMEIRO, DADOS DEPOIS.
 * Se gravássemos o paciente antes da conta existir, uma falha na verificação do e-mail
 * deixaria no banco um paciente sem dono, invisível e impossível de acessar. Do jeito
 * atual, uma falha aqui deixa o paciente **com conta e sem ficha** — que é recuperável:
 * ele entra, e a ficha se completa.
 *
 * 🔴 O TOKEN É REVALIDADO AQUI, mesmo já tendo sido validado para pintar a tela.
 * A tela é client-side: entre abrir e enviar existe uma janela em que o link pode expirar,
 * ser consumido em outra aba, ou ser cancelado pelo atendimento. Confiar na validação da
 * renderização é confiar no cliente.
 */

import { and, eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth, currentUser } from '@clerk/nextjs/server';

import { pacientes, solicitacoesCadastro, users } from '@/db/schema';
import { db } from '@/lib/db';
import { falha, ok, type ResultadoAction } from '@/lib/ia-clinica/resultado';
import { anexarDocumentoDoCadastro } from '@/lib/documentos/anexo-do-cadastro';
import { materializarDocumentosDoParceiro } from '@/lib/parceiros/materializar-documentos';
import { FINALIDADES } from '@/lib/parceiros/consentimento';
import { conceder } from '@/lib/parceiros/consentimento-registrado';
import { enfileirarTransferencia } from '@/lib/parceiros/enfileirar-transferencia';
import { registrarAuditoria } from '@/lib/utils/audit';
import { cpfEhValido, somenteDigitosDoCpf } from '@/lib/validacao/cpf';
import { normalizarTelefoneWhatsapp } from '@/lib/chatpro/telefone';
import { marcarComoUtilizada, validarTokenDeCadastro } from '@/lib/chatpro/token-de-cadastro';

const esquema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/i, 'Link inválido'),
  nomeCompleto: z
    .string()
    .trim()
    .min(3, 'Informe seu nome completo')
    // Duas palavras, porque o nome vai para a prescrição e para o SNCR — e "Maria"
    // sozinho não identifica ninguém num documento controlado.
    .refine((v) => v.split(/\s+/).filter(Boolean).length >= 2, 'Informe nome e sobrenome'),
  cpf: z.string().refine((v) => cpfEhValido(v), 'CPF inválido'),
  telefone: z.string().trim().min(8, 'Informe seu telefone'),
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  jaFazTratamento: z.boolean(),
  /**
   * 🔴 O PACIENTE DECLARA SE JÁ TEM A AUTORIZAÇÃO DA ANVISA.
   *
   * `null` = não respondeu (o fluxo do parceiro que já mandou a autorização nem pergunta).
   * `false` = declarou que NÃO tem — e é justamente essa informação que permite oferecer a
   * procuração depois da consulta, sem perguntar de novo.
   */
  temAutorizacaoAnvisa: z.boolean().optional().nullable(),
  /**
   * 🔴 OS ANEXOS VÊM COMO LISTA, UM POR TIPO.
   *
   * A primeira versão tinha um campo por documento (`anexoAnvisa`, `anexoReceita`). Cinco dos
   * oito fluxos pedem o "formulário completo", com os cinco documentos — e cinco campos
   * nomeados viram cinco lugares para esquecer um.
   *
   * A lista também deixa o contrato estável: documento novo no fluxo não muda a assinatura da
   * action, só a lista de tipos aceitos.
   */
  anexos: z
    .array(
      z.object({
        tipo: z.enum([
          'receita_medica',
          'laudo_medico',
          'comprovante_residencia',
          'autorizacao_anvisa',
          'documento_identidade',
        ]),
        nomeArquivo: z.string().trim().min(1).max(200),
        tipoMime: z.string().trim().max(100),
        conteudoBase64: z.string().min(1),
      }),
    )
    .max(5)
    .optional()
    .nullable(),
  /**
   * 🔴 A MESMA DECLARAÇÃO, PARA A RECEITA — e é ela que decide o destino.
   *
   * Sem saber se ele tem receita, o sistema considera que falta tudo e manda todo mundo para
   * o agendamento — inclusive quem só precisa da procuração. Era o buraco do fluxo BeHemp 1.
   */
  temReceitaMedica: z.boolean().optional().nullable(),
  tratamentoAtual: z.string().trim().max(2000).optional().nullable(),
  /**
   * 🔴 O QUE ELE AUTORIZOU, uma finalidade por vez (LGPD art. 11, I).
   *
   * `z.enum` fecha a lista de propósito: `z.string()` aceitaria uma finalidade que nenhum
   * consumidor lê, e gravaria um consentimento inerte — que parece registro e não autoriza
   * nada. Lista vazia é resposta válida: ele leu e não autorizou.
   */
  finalidadesConsentidas: z
    .array(
      z.enum([FINALIDADES.avaliacaoMedica, FINALIDADES.apoioAnvisa, FINALIDADES.retornoAoParceiro]),
    )
    .optional(),
});

export type EntradaDoCadastro = z.input<typeof esquema>;

/**
 * A primeira linha do stack — `arquivo:linha`, sem a mensagem.
 *
 * A mensagem de um erro do Postgres cita o valor que violou a restrição, e aqui os valores
 * são CPF e telefone. O stack diz ONDE sem dizer O QUÊ, que é o que um log pode carregar.
 */
function primeiraLinhaDoStack(erro: unknown): string | null {
  if (!(erro instanceof Error) || !erro.stack) return null;
  const linhas = erro.stack.split('\n');
  // Índice 0 é `Error: <mensagem>` — justamente a parte que não pode entrar no log.
  return linhas[1]?.trim() ?? null;
}

export async function concluirCadastroPorLink(
  entrada: EntradaDoCadastro,
): Promise<ResultadoAction<{ protocolo: string }>> {
  // 1 ── A conta precisa existir. Sem isso não há a quem vincular a ficha.
  const { userId: clerkId } = await auth();
  if (!clerkId) return falha('Sua sessão não foi criada. Recarregue a página e tente de novo.');

  // 2 ── Validação de forma.
  const analise = esquema.safeParse(entrada);
  if (!analise.success) {
    return falha(analise.error.issues[0]?.message ?? 'Dados inválidos');
  }
  const dados = analise.data;

  // 3 ── O token, revalidado (ver o bloco no topo).
  const solicitacao = await validarTokenDeCadastro(dados.token);
  if (!solicitacao.valida) {
    const motivos: Record<string, string> = {
      invalido: 'Link inválido.',
      expirado: 'Este link expirou. Peça um novo pelo WhatsApp.',
      ja_utilizado: 'Este link já foi utilizado.',
      cancelado: 'Esta solicitação foi cancelada. Fale com o atendimento.',
    };
    return falha(motivos[solicitacao.motivo] ?? 'Link inválido.');
  }

  const cpf = somenteDigitosDoCpf(dados.cpf);
  // Se a normalização recusar (número de país impossível, por exemplo), guarda o que ele
  // digitou em vez de perder o dado — o atendimento consegue ligar mesmo assim.
  const telefone = normalizarTelefoneWhatsapp(dados.telefone) ?? dados.telefone.trim();

  /**
   * 🔴 ONDE FALHOU, e se o cadastro já estava feito quando falhou.
   *
   * O log deste bloco registrava `erro.name` e nada mais — e `erro.name` de um `new Error(…)`
   * é a string `'Error'`. Medido em produção em 11/09/2026: o paciente viu "não conseguimos
   * concluir", e o servidor escreveu `{ erro: 'Error' }`. Não dava para saber nem em que
   * etapa. O cuidado de não vazar CPF no log tinha, sem querer, jogado fora a informação
   * inteira.
   *
   * ⚠️ `etapa` é um rótulo NOSSO, escrito por nós — nunca vem de entrada do usuário e nunca
   * carrega valor de coluna. É o que se pode logar com segurança.
   */
  let etapa = 'transacao-usuario-e-ficha';

  /**
   * 🔴 A PARTIR DA TRANSAÇÃO, O CADASTRO EXISTE — e nada depois pode desfazê-lo.
   *
   * Os blocos 8a/8b/8c já dizem isso em prosa ("anexo que falha não desfaz cadastro que deu
   * certo"), e cada um se protege por dentro. Mas a garantia não valia para o que está ENTRE
   * eles: uma exceção em qualquer ponto pós-transação caía neste catch e devolvia `falha`.
   *
   * O paciente ficava no pior estado possível: conta criada, sessão ativa, link já consumido,
   * ficha gravada — e a tela dizendo que não deu certo. Sem caminho de volta, porque o token
   * é de uso único (ADR-0016 D-04), e a ADR não previu a gravação falhar depois dele.
   *
   * Aconteceu em produção em 11/09/2026, com o dono testando o protocolo SOL-000046.
   */
  let cadastroGravado = false;

  try {
    const usuarioClerk = await currentUser();
    // O e-mail que vale é o do Clerk: é o que ele confirmou com o código, e é o login.
    const emailConfirmado =
      usuarioClerk?.emailAddresses?.[0]?.emailAddress?.toLowerCase() ?? dados.email;

    /**
     * 🔴 A SESSÃO PRECISA SER DE QUEM O LINK CHAMA. Achado em 12/09/2026, pelo dono, com
     * três contas de teste no mesmo navegador: ele abriu um link emitido para
     * `…1110@` estando logado como `…1100@`.
     *
     * ⚠️ O QUE ACONTECERIA SEM ESTA TRAVA: logo abaixo, `users` é resolvido pelo `clerkId`
     * DA SESSÃO. A ficha do paciente do link — CPF, telefone, documentos que o parceiro
     * mandou — seria gravada na conta de quem está logado. Numa plataforma de saúde isso é
     * o pior tipo de erro: dado clínico na pessoa errada, e sem nenhum sinal de que houve
     * troca.
     *
     * 🔴 E É EXPLORÁVEL, não só acidental. O link chega por WhatsApp e vale 7 dias. Quem
     * receber um link alheio e abrir logado passa a ter, na própria conta, a ficha e os
     * documentos de outra pessoa — OWASP API1 (BOLA) por um caminho novo.
     *
     * A comparação é entre o e-mail da SESSÃO e o e-mail da SOLICITAÇÃO (o que o parceiro
     * mandou e o paciente confirmou na tela), não o do formulário: o campo é editável, e
     * deixar o cliente escolher o alvo é justamente o que se quer impedir.
     *
     * ⚠️ FALHA FECHADA. Sem e-mail na sessão, não dá para provar que é a pessoa certa —
     * então recusa. É mais seguro pedir que entre de novo do que gravar na conta errada.
     */
    const emailDaSolicitacao = (solicitacao.email ?? dados.email).trim().toLowerCase();
    const emailDaSessao = usuarioClerk?.emailAddresses?.[0]?.emailAddress?.toLowerCase() ?? '';

    if (!emailDaSessao || emailDaSessao !== emailDaSolicitacao) {
      console.warn('[cadastro-por-link] sessão de outro e-mail', {
        // Nunca os endereços — só o FATO. O e-mail é dado pessoal, e log não é lugar dele.
        temSessao: Boolean(emailDaSessao),
        confere: false,
      });
      return falha(
        'Este link foi enviado para outro e-mail. Saia da conta atual e entre com o e-mail que recebeu o link.',
      );
    }

    const pacienteId = await db.transaction(async (tx) => {
      /**
       * 4 ── Garantir o `users`.
       *
       * ⚠️ O webhook `user.created` do Clerk também cria esta linha, e é ASSÍNCRONO —
       * pode chegar antes, depois, ou (se a entrega falhar) nunca. Depender dele aqui
       * faria o cadastro quebrar por corrida. Então esta action garante a linha, e as
       * duas rotas convergem: quem chegar primeiro cria, o segundo atualiza.
       */
      const [porClerk] = await tx.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);

      let usuario = porClerk;

      if (!usuario) {
        // `users.email` é único: um cadastro repetido com o mesmo e-mail encontra a
        // linha existente e apenas amarra o `clerkId`, em vez de estourar a constraint.
        const [porEmail] = await tx
          .select()
          .from(users)
          .where(eq(users.email, emailConfirmado))
          .limit(1);

        if (porEmail) {
          const [atualizado] = await tx
            .update(users)
            .set({ clerkId, nome: dados.nomeCompleto, telefone })
            .where(eq(users.id, porEmail.id))
            .returning();
          usuario = atualizado;
        } else {
          const [criado] = await tx
            .insert(users)
            .values({
              email: emailConfirmado,
              nome: dados.nomeCompleto,
              telefone,
              clerkId,
              // 🔴 SEMPRE `paciente`. O papel nunca vem do formulário — se viesse, quem
              // abrisse o link escolheria ser admin. É OWASP API3 na forma mais direta.
              role: 'paciente',
            })
            .returning();
          usuario = criado;
        }
      } else {
        await tx
          .update(users)
          .set({ nome: dados.nomeCompleto, telefone })
          .where(eq(users.id, usuario.id));
      }

      /**
       * 5 ── A ficha do paciente. `pacientes.userId` é único, então o caminho de
       * atualização não é luxo: é o que acontece quando alguém abre um segundo link.
       */
      const [fichaExistente] = await tx
        .select({ id: pacientes.id })
        .from(pacientes)
        .where(and(eq(pacientes.userId, usuario.id), isNull(pacientes.deletedAt)))
        .limit(1);

      if (fichaExistente) {
        await tx
          .update(pacientes)
          .set({
            cpf,
            jaFazTratamentoCannabis: dados.jaFazTratamento,
            tratamentoAtualDescricao: dados.jaFazTratamento
              ? dados.tratamentoAtual?.trim() || null
              : null,
          })
          .where(eq(pacientes.id, fichaExistente.id));
        return fichaExistente.id;
      }

      const [ficha] = await tx
        .insert(pacientes)
        .values({
          userId: usuario.id,
          cpf,
          jaFazTratamentoCannabis: dados.jaFazTratamento,
          // Só guarda a descrição se ele disse que faz tratamento. Texto órfão de um
          // "não" é ruído na ficha, e ruído numa tela clínica custa atenção.
          tratamentoAtualDescricao: dados.jaFazTratamento
            ? dados.tratamentoAtual?.trim() || null
            : null,
        })
        /**
         * 🔴 A CORRIDA COM O WEBHOOK DO CLERK — ADR-0022, G11.
         *
         * O webhook `user.created` também cria esta linha, e é **assíncrono**: pode chegar
         * entre o `SELECT` acima e este `INSERT`. Sem isto, o unique de `pacientes.userId`
         * é violado, **a transação inteira aborta**, e o paciente lê "não conseguimos
         * concluir seu cadastro" — com a conta já criada e sem caminho de volta.
         *
         * ⚠️ O webhook já tinha `onConflictDoNothing`; esta ponta não tinha. O lado que
         * chega segundo precisa ceder, e aqui ceder é não estourar.
         *
         * É candidato ao erro que o dono viu em 11/09 (SOL-000046): o log dizia
         * `{ erro: 'Error' }` e não distinguia violação de unique de qualquer outra coisa.
         */
        .onConflictDoNothing({ target: pacientes.userId })
        .returning({ id: pacientes.id });

      /**
       * 🔴 `onConflictDoNothing` DEVOLVE VAZIO quando o conflito acontece — e aí a ficha
       * existe, mas não é esta. Buscar de novo é o que fecha a corrida: quem perdeu a
       * disputa usa a linha de quem ganhou, em vez de seguir com `undefined`.
       */
      if (ficha?.id) return ficha.id;

      const [doWebhook] = await tx
        .select({ id: pacientes.id })
        .from(pacientes)
        .where(eq(pacientes.userId, usuario.id))
        .limit(1);

      if (!doWebhook?.id) {
        // Nem inseriu nem achou: não há ficha, e seguir daria erro pior adiante.
        throw new Error('ficha_nao_criada');
      }
      return doWebhook.id;
    });

    // Daqui para a frente, falhar é acessório: a conta e a ficha existem.
    cadastroGravado = true;

    /**
     * 🔴 O VÍNCULO VEM ANTES DE QUEIMAR O LINK — invertido em 13/09/2026 (ADR-0022, G10).
     *
     * A ordem anterior consumia o link primeiro. Se a gravação seguinte falhasse, o paciente
     * ficava com o **link morto** e o `pacienteId` **nulo** ao mesmo tempo — e esse par
     * apaga duas coisas de uma vez:
     *
     *   - o aviso de cadastro pendente nunca aparece (`cadastro-pendente.ts` exige
     *     `usadoEm IS NULL`), então ele não tem como voltar;
     *   - `notificar.ts` procura a solicitação **pelo paciente**, e sem o vínculo o parceiro
     *     nunca é avisado quando a receita ficar pronta.
     *
     * ⚠️ Invertendo, o pior caso muda de lado: se algo falhar entre as duas, sobra um link
     * ainda válido de um cadastro já vinculado — recuperável, e visível pelo aviso. **Estado
     * recuperável é melhor que estado perdido**, e essa é a escolha aqui.
     */
    etapa = 'gravar-declaracao-na-solicitacao';

    // 7 ── O que ele declarou fica na solicitação também — é o registro do ato, e a
    // ficha do paciente pode ser editada depois por outra pessoa.
    await db
      .update(solicitacoesCadastro)
      .set({
        nomeCompleto: dados.nomeCompleto,
        email: emailConfirmado,
        telefone,
        cpf,
        // 🔴 Fecha o ciclo: é por aqui que o aviso de volta descobre de qual parceiro
        // este paciente veio, quando a receita dele ficar pronta.
        pacienteId,
        jaFazTratamento: dados.jaFazTratamento,
        tratamentoAtual: dados.jaFazTratamento ? dados.tratamentoAtual?.trim() || null : null,
        /**
         * 🔴 A DECLARAÇÃO VIRA COLUNA (Item 33). Até 11/09 ela só existia no log de
         * auditoria, e log não é fonte de leitura de produto.
         *
         * ⚠️ `?? null` preserva os TRÊS estados. `Boolean(undefined)` seria `false`, e aí
         * quem nunca foi perguntado ficaria gravado como "declarou que não tem" — a
         * distinção que faz a próxima tela não repetir a pergunta.
         */
        declarouTerAutorizacaoAnvisa: dados.temAutorizacaoAnvisa ?? null,
        declarouTerReceitaMedica: dados.temReceitaMedica ?? null,
      })
      .where(eq(solicitacoesCadastro.id, solicitacao.id));

    /**
     * 6 ── SÓ AGORA o link é consumido — depois de o vínculo existir (ADR-0022, G10).
     *
     * A ordem importa e foi invertida em 13/09/2026. Queimar antes deixava o par
     * "link morto + `pacienteId` nulo", que apaga o aviso de pendência e o retorno ao
     * parceiro de uma vez. Queimando depois, o pior caso é um link ainda válido de um
     * cadastro já vinculado — recuperável, e visível.
     *
     * ⚠️ `marcarComoUtilizada` já é de uso único por construção (o `UPDATE` filtra
     * `usadoEm IS NULL`), então consumir mais tarde não abre janela para dois cadastros:
     * quem chegar segundo recebe `false` e o valor vira campo de auditoria.
     */
    etapa = 'consumir-o-link';
    const consumiu = await marcarComoUtilizada(solicitacao.id);

    /**
     * 8 ── Os arquivos que o parceiro mandou junto viram documentos DESTE paciente.
     *
     * Só agora existe `pacienteId`, e `documentos.paciente_id` é `notNull`. O arquivo já está
     * re-hospedado aqui desde o handoff — a URL do parceiro é de vida curta e teria expirado
     * nos 7 dias que o paciente tem para abrir o link.
     *
     * ⚠️ Fora da transação de propósito, e depois de `marcarComoUtilizada`: um erro ao copiar
     * documento não pode desfazer um cadastro que já deu certo. A função nunca lança; no pior
     * caso o paciente envia o documento manualmente, como sempre pôde.
     */
    /**
     * 8b ── O documento que ELE anexou no formulário, quando anexou.
     *
     * Mesma posição e mesmo motivo do bloco acima: `documentos.paciente_id` é `notNull`, e a
     * ficha só existe agora. Fora da transação — anexo que falha não desfaz cadastro que deu
     * certo.
     */
    etapa = 'anexar-documentos-do-formulario';
    const tiposAnexados: string[] = [];
    for (const anexo of dados.anexos ?? []) {
      const gravou = await anexarDocumentoDoCadastro({
        pacienteId,
        tipo: anexo.tipo,
        anexo,
        protocolo: solicitacao.protocolo,
      });
      if (gravou) tiposAnexados.push(anexo.tipo);
    }

    /**
     * 8c ── O CONSENTIMENTO, gravado como ato.
     *
     * ⚠️ Fora da transação, pelo mesmo motivo dos blocos acima — e com o erro caindo para o
     * lado seguro: se esta gravação falhar, o que acontece é que **nada é enviado à Greens**
     * (a P5 lê daqui antes de montar qualquer envio). Um cadastro sem consentimento gravado
     * custa ao paciente marcar de novo no painel; o inverso custaria dado de saúde saindo da
     * empresa sem registro que o autorize.
     */
    if (dados.finalidadesConsentidas?.length) {
      try {
        await conceder({
          pacienteId,
          finalidades: dados.finalidadesConsentidas,
          origem: 'cadastro_por_link',
        });
      } catch (erroDoConsentimento) {
        console.error('[cadastro] consentimento não gravado', {
          protocolo: solicitacao.protocolo,
          erro: erroDoConsentimento instanceof Error ? erroDoConsentimento.name : 'desconhecida',
        });
      }

      /**
       * 🔴 O GATILHO DO S2 (§7 do contrato-ponte, 11/09/2026).
       *
       * `prepararTransferencia` existia e **ninguém a chamava** — a Greens achou isso com
       * `grep` antes de nós. Este é o primeiro dos dois gatilhos: o paciente acabou de
       * consentir durante o cadastro.
       *
       * ⚠️ DEPOIS de `conceder`, nunca antes: a transferência LÊ o consentimento do banco, e
       * antes da gravação ela recusaria por `sem_consentimento` — recusa que é definitiva
       * dentro desta passagem.
       *
       * ⚠️ Nunca lança, e a trava de ambiente continua valendo: sem
       * `PARCEIRO_TRANSFERENCIA_ATIVA=1` nada é enfileirado.
       */
      if (solicitacao.parceiro) {
        await enfileirarTransferencia({
          solicitacaoId: solicitacao.id,
          parceiro: solicitacao.parceiro,
        });
      }
    }

    etapa = 'materializar-documentos-do-parceiro';
    const copiados = await materializarDocumentosDoParceiro({
      pacienteId,
      documentosDoParceiro: solicitacao.documentosDoParceiro,
      protocolo: solicitacao.protocolo,
    });

    etapa = 'auditoria';
    await registrarAuditoria({
      userId: clerkId,
      acao: 'criar',
      entidade: 'pacientes',
      entidadeId: pacienteId,
      // 🔴 SEM CPF, SEM TELEFONE, SEM O TEXTO DO TRATAMENTO. A auditoria registra QUE o
      // cadastro aconteceu e por qual protocolo; o conteúdo já está na ficha, com
      // controle de acesso. Repeti-lo aqui cria uma segunda cópia sem esse controle.
      dadosDepois: {
        protocolo: solicitacao.protocolo,
        origem: 'link_whatsapp',
        documentosRecebidosDoParceiro: copiados.inseridos,
        // Registra a DECLARAÇÃO, não só o arquivo: "não tenho" é o que permite oferecer a
        // procuração depois sem perguntar de novo.
        declarouTerAutorizacaoAnvisa: dados.temAutorizacaoAnvisa ?? null,
        declarouTerReceitaMedica: dados.temReceitaMedica ?? null,
        // As finalidades autorizadas. Sem o texto — ele está na tabela `consentimentos`.
        finalidadesConsentidas: dados.finalidadesConsentidas ?? [],
        // Só os TIPOS — nunca o nome do arquivo, que costuma trazer o nome da pessoa.
        documentosAnexadosNoCadastro: tiposAnexados,
        declarouTratamentoEmCurso: dados.jaFazTratamento,
        linkConsumidoAgora: consumiu,
      },
    });

    etapa = 'revalidar-painel';
    revalidatePath('/paciente');

    return ok({ protocolo: solicitacao.protocolo });
  } catch (erro) {
    console.error('[cadastro-por-link] falha ao concluir', {
      /** Rótulo escrito por nós. Nunca vem de entrada, nunca carrega valor de coluna. */
      etapa,
      cadastroGravado,
      /**
       * O nome do erro continua aqui, mas ele sozinho não bastava: `erro.name` de um
       * `new Error(…)` é sempre `'Error'`, e foi exatamente o que produção registrou.
       */
      erro: erro instanceof Error ? erro.name : 'desconhecido',
      /**
       * ONDE, sem O QUÊ. A primeira linha do stack traz `arquivo:linha`; a MENSAGEM é que
       * pode trazer valor de coluna — e as colunas aqui são CPF, telefone e texto clínico.
       * Por isso o stack entra e a mensagem fica de fora.
       */
      em: primeiraLinhaDoStack(erro),
    });

    /**
     * 🔴 CADASTRO FEITO NÃO VIRA FALHA POR CAUSA DE UM PASSO ACESSÓRIO.
     *
     * Se a transação commitou, o paciente TEM conta e ficha, e o link já foi consumido.
     * Devolver `falha` aqui mandaria refazer o que não pode ser refeito — o token é de uso
     * único — e foi o que aconteceu em produção em 11/09/2026.
     *
     * ⚠️ O que se perde ao seguir é acessório e recuperável pelo painel: anexo que não
     * subiu, documento do parceiro não copiado, revalidação de cache. O consentimento tem
     * catch próprio e a decisão dele continua valendo: sem consentimento gravado, nada é
     * enviado à Greens.
     */
    if (cadastroGravado) {
      return ok({ protocolo: solicitacao.protocolo });
    }

    return falha('Não conseguimos concluir seu cadastro. Tente novamente em instantes.');
  }
}
