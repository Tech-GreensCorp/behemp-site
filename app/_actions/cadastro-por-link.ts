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
import { registrarAuditoria } from '@/lib/utils/audit';
import { cpfEhValido, somenteDigitosDoCpf } from '@/lib/validacao/cpf';
import { normalizarTelefoneWhatsapp } from '@/lib/chatpro/telefone';
import { marcarComoUtilizada, validarTokenDeCadastro } from '@/lib/chatpro/token-de-cadastro';

/** O formato de um anexo enviado pelo próprio paciente no cadastro. */
const anexoSchema = z
  .object({
    nomeArquivo: z.string().trim().min(1).max(200),
    tipoMime: z.string().trim().max(100),
    conteudoBase64: z.string().min(1),
  })
  .optional()
  .nullable();

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
  /** O arquivo, quando ele respondeu que tem e anexou ali mesmo. */
  anexoAnvisa: anexoSchema,
  /**
   * 🔴 A MESMA DECLARAÇÃO, PARA A RECEITA — e é ela que decide o destino.
   *
   * Sem saber se ele tem receita, o sistema considera que falta tudo e manda todo mundo para
   * o agendamento — inclusive quem só precisa da procuração. Era o buraco do fluxo BeHemp 1.
   */
  temReceitaMedica: z.boolean().optional().nullable(),
  anexoReceita: anexoSchema,
  tratamentoAtual: z.string().trim().max(2000).optional().nullable(),
});

export type EntradaDoCadastro = z.input<typeof esquema>;

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

  try {
    const usuarioClerk = await currentUser();
    // O e-mail que vale é o do Clerk: é o que ele confirmou com o código, e é o login.
    const emailConfirmado =
      usuarioClerk?.emailAddresses?.[0]?.emailAddress?.toLowerCase() ?? dados.email;

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
        .returning({ id: pacientes.id });

      return ficha.id;
    });

    // 6 ── Consome o link. Depois de gravar: se o envio falhasse antes, o paciente
    // ficaria sem link E sem cadastro.
    const consumiu = await marcarComoUtilizada(solicitacao.id);

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
      })
      .where(eq(solicitacoesCadastro.id, solicitacao.id));

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
    let anexouAnvisa = false;
    if (dados.anexoAnvisa) {
      anexouAnvisa = await anexarDocumentoDoCadastro({
        pacienteId,
        tipo: 'autorizacao_anvisa',
        anexo: dados.anexoAnvisa,
        protocolo: solicitacao.protocolo,
      });
    }

    let anexouReceita = false;
    if (dados.anexoReceita) {
      anexouReceita = await anexarDocumentoDoCadastro({
        pacienteId,
        tipo: 'receita_medica',
        anexo: dados.anexoReceita,
        protocolo: solicitacao.protocolo,
      });
    }

    const copiados = await materializarDocumentosDoParceiro({
      pacienteId,
      documentosDoParceiro: solicitacao.documentosDoParceiro,
      protocolo: solicitacao.protocolo,
    });

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
        anexouAutorizacaoAnvisa: anexouAnvisa,
        declarouTerReceitaMedica: dados.temReceitaMedica ?? null,
        anexouReceitaMedica: anexouReceita,
        declarouTratamentoEmCurso: dados.jaFazTratamento,
        linkConsumidoAgora: consumiu,
      },
    });

    revalidatePath('/paciente');

    return ok({ protocolo: solicitacao.protocolo });
  } catch (erro) {
    console.error('[cadastro-por-link] falha ao concluir', {
      // Nome do erro apenas. A mensagem pode carregar valor de coluna — e as colunas
      // aqui são CPF, telefone e texto clínico.
      erro: erro instanceof Error ? erro.name : 'desconhecido',
    });
    return falha('Não conseguimos concluir seu cadastro. Tente novamente em instantes.');
  }
}
