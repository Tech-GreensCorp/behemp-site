/**
 * O fluxo de assinatura do comunicado, de ponta a ponta: envio pelo admin, link de assinatura
 * do paciente, confirmação da conclusão e os e-mails que dela decorrem.
 *
 * Reaproveita a integração DocuSign da procuração (`lib/docusign/docusign-service.ts`) e o
 * Brevo (`lib/email/comunicados.ts`). Não há uma segunda integração.
 *
 * 🔴 QUEM DIZ QUE ASSINOU É O DOCUSIGN, e só ele. O retorno do paciente à tela e o corpo do
 * webhook são GATILHOS: ao recebê-los, `sincronizarComunicado` pergunta o status à API do
 * DocuSign, com as nossas credenciais, e é a resposta dela que muda o banco. Um webhook forjado
 * ou um `?event=signing_complete` digitado à mão não conseguem marcar nada como assinado.
 *
 * 🔴 IDEMPOTÊNCIA: cada passo posterior à assinatura (guardar o PDF, e-mail ao paciente, e-mail
 * a docs@) reivindica a sua trava com um UPDATE atômico (`... WHERE marcador IS NULL RETURNING`).
 * Webhook reentregue, retorno do paciente e clique do admin no mesmo instante: só um vence cada
 * trava. Se o envio falha, a trava é devolvida e o próximo gatilho tenta de novo.
 */
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import { comunicadosAssinatura, pacientes, users } from '@/db/schema';
import type { ComunicadoAssinatura } from '@/db/schema';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import {
  consultarStatusDoEnvelope,
  criarEnvelopeComunicado,
  docusignConfigurado,
  downloadPdfAssinado,
  gerarUrlAssinaturaComunicado,
} from '@/lib/docusign/docusign-service';
import {
  apagarDocumentoPrivado,
  guardarDocumentoPrivado,
  lerDocumentoPrivado,
} from '@/lib/documentos/store-privado';
import {
  enviarEmailConfirmacaoPaciente,
  enviarEmailDeEnvio,
  enviarEmailNotificacaoDocs,
  LINK_DOS_COMUNICADOS,
} from '@/lib/email/comunicados';
import { registrarAuditoria } from '@/lib/utils/audit';
import { gerarPdfCartaDoacao } from '@/lib/comunicados/carta-doacao-pdf';
import {
  ANCORA_ASSINATURA,
  ANCORA_DATA,
  TIPO_ATUALIZACAO_PROGRAMA_DOACAO,
  TITULO_ATUALIZACAO_PROGRAMA_DOACAO,
} from '@/lib/comunicados/catalogo';

const ENTIDADE = 'comunicados_assinatura';
import {
  clientUserIdDoComunicado,
  dataEHoraPorExtenso,
  dataPorExtenso,
  ehViolacaoDeUnico,
  situacaoPeloStatusDoDocusign,
} from '@/lib/comunicados/puro';

export {
  clientUserIdDoComunicado,
  dataEHoraPorExtenso,
  dataPorExtenso,
  ehViolacaoDeUnico,
  situacaoPeloStatusDoDocusign,
};
export type { SituacaoNossa } from '@/lib/comunicados/puro';

/** Mensagem curta e SEM dado pessoal para guardar em `erro` e mostrar ao admin. */
function mensagemSegura(erro: unknown, padrao: string): string {
  if (erro instanceof Error && erro.name === 'StorePrivadoNaoConfigurado') {
    return 'O armazenamento privado de documentos não está configurado (BLOB_TOKEN_PRIVADO).';
  }
  return padrao;
}

// ── Envio (admin) ─────────────────────────────────────────────

export type ResultadoDoEnvio =
  | { sucesso: true; comunicadoId: string; emailEnviado: boolean }
  | { sucesso: false; erro: string };

/**
 * Cria o comunicado, o envelope no DocuSign e manda o e-mail ao paciente.
 *
 * Quem chama JÁ provou que é admin. A linha é gravada ANTES do envelope: o índice único parcial
 * `comunicados_assinatura_ativo_unq` faz o BANCO recusar o segundo envio simultâneo, então um
 * clique duplo não cria dois envelopes.
 */
export async function enviarComunicado(params: {
  pacienteId: string;
  adminUserId: string;
}): Promise<ResultadoDoEnvio> {
  if (!docusignConfigurado()) {
    return {
      sucesso: false,
      erro: 'O DocuSign não está configurado neste ambiente. Nada foi enviado.',
    };
  }

  const [alvo] = await db
    .select({ pacienteId: pacientes.id, nome: users.nome, email: users.email, cpf: pacientes.cpf })
    .from(pacientes)
    .innerJoin(users, eq(pacientes.userId, users.id))
    .where(
      and(
        eq(pacientes.id, params.pacienteId),
        isNull(pacientes.deletedAt),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);
  if (!alvo) return { sucesso: false, erro: 'Paciente não encontrado.' };
  if (!alvo.email?.trim()) {
    return { sucesso: false, erro: 'O paciente não tem e-mail cadastrado.' };
  }
  // A carta mostra o CPF logo abaixo do nome: sem ele, sairia com a linha em branco. Falha ANTES
  // de reservar a vaga e de criar o envelope, para não deixar rastro de um envio que não existiu.
  if (!alvo.cpf?.trim()) {
    return {
      sucesso: false,
      erro: 'O paciente não tem CPF cadastrado, e a carta o exibe. Complete o cadastro e envie de novo.',
    };
  }

  // 1) Reserva a vaga. Se já há um pendente ou assinado, o banco recusa.
  let linha: ComunicadoAssinatura;
  try {
    [linha] = await db
      .insert(comunicadosAssinatura)
      .values({
        pacienteId: alvo.pacienteId,
        tipo: TIPO_ATUALIZACAO_PROGRAMA_DOACAO,
        titulo: TITULO_ATUALIZACAO_PROGRAMA_DOACAO,
        status: 'pendente',
        enviadoPorUserId: params.adminUserId,
        nomeDestino: alvo.nome,
        emailDestino: alvo.email.trim(),
      })
      .returning();
  } catch (erro) {
    if (ehViolacaoDeUnico(erro)) {
      return {
        sucesso: false,
        erro: 'Este comunicado já foi enviado a este paciente e está pendente ou assinado.',
      };
    }
    console.error('[comunicados] reservar envio:', erro instanceof Error ? erro.name : 'erro');
    return { sucesso: false, erro: 'Não foi possível registrar o envio.' };
  }

  const falhar = async (mensagem: string): Promise<ResultadoDoEnvio> => {
    await db
      .update(comunicadosAssinatura)
      .set({ status: 'erro', erro: mensagem, erroEm: new Date() })
      .where(eq(comunicadosAssinatura.id, linha.id));
    await registrarAuditoria({
      userId: params.adminUserId,
      acao: 'criar',
      entidade: ENTIDADE,
      entidadeId: linha.id,
      dadosDepois: { resultado: 'erro', motivo: mensagem },
    });
    return { sucesso: false, erro: mensagem };
  };

  // 2) O PDF, com nome e data.
  let pdf: Buffer;
  try {
    pdf = await gerarPdfCartaDoacao({
      nomePaciente: alvo.nome,
      emailPaciente: alvo.email.trim(),
      cpfPaciente: alvo.cpf.trim(),
      dataPorExtenso: dataPorExtenso(new Date()),
    });
  } catch (erro) {
    console.error('[comunicados] gerar PDF:', erro instanceof Error ? erro.name : 'erro');
    return falhar('Não foi possível gerar o PDF do comunicado.');
  }

  // 3) O envelope no DocuSign.
  const envelope = await criarEnvelopeComunicado({
    pacienteNome: alvo.nome,
    pacienteEmail: alvo.email.trim(),
    clientUserId: clientUserIdDoComunicado(linha.id),
    pdfBuffer: pdf,
    tituloDoDocumento: TITULO_ATUALIZACAO_PROGRAMA_DOACAO,
    assuntoDoEnvelope: `Be4Hope — ${TITULO_ATUALIZACAO_PROGRAMA_DOACAO}`,
    ancoraAssinatura: ANCORA_ASSINATURA,
    ancoraData: ANCORA_DATA,
    urlDoWebhook: `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')}/api/webhooks/docusign`,
  });
  if (!envelope.sucesso) {
    return falhar(
      envelope.erro === 'CONSENT_REQUIRED'
        ? 'O DocuSign pede a autorização inicial do aplicativo (consentimento JWT). Nada foi enviado.'
        : `O DocuSign não aceitou o envio. ${envelope.erro}`,
    );
  }

  await db
    .update(comunicadosAssinatura)
    .set({ docusignEnvelopeId: envelope.envelopeId, docusignStatus: 'sent' })
    .where(eq(comunicadosAssinatura.id, linha.id));

  // 4) O e-mail. Falha aqui NÃO desfaz nada: o envelope existe e o comunicado já aparece em
  //    Documentos; o admin vê o aviso e pode reenviar o e-mail.
  const emailEnviado = await enviarAvisoPorEmail(linha.id);

  await registrarAuditoria({
    userId: params.adminUserId,
    acao: 'criar',
    entidade: ENTIDADE,
    entidadeId: linha.id,
    dadosDepois: {
      tipo: TIPO_ATUALIZACAO_PROGRAMA_DOACAO,
      pacienteId: alvo.pacienteId,
      emailEnviado,
    },
  });

  return { sucesso: true, comunicadoId: linha.id, emailEnviado };
}

/** Manda (ou reenvia) o e-mail de aviso. Devolve se chegou ao Brevo. Nunca lança. */
export async function enviarAvisoPorEmail(comunicadoId: string): Promise<boolean> {
  const [c] = await db
    .select()
    .from(comunicadosAssinatura)
    .where(eq(comunicadosAssinatura.id, comunicadoId))
    .limit(1);
  if (!c || c.status !== 'pendente') return false;
  try {
    await enviarEmailDeEnvio({
      para: { email: c.emailDestino, nome: c.nomeDestino },
      titulo: c.titulo,
    });
    await db
      .update(comunicadosAssinatura)
      .set({ emailEnvioEnviadoEm: new Date(), emailEnvioErro: null })
      .where(eq(comunicadosAssinatura.id, c.id));
    return true;
  } catch (erro) {
    console.error('[comunicados] e-mail de envio:', erro instanceof Error ? erro.message : 'erro');
    await db
      .update(comunicadosAssinatura)
      // O motivo real (HTTP, código e mensagem do Brevo, sem dado pessoal) vai para o cartão do admin:
      // sem ele, "falhou" não diz se é remetente, chave ou rede.
      .set({
        emailEnvioErro:
          `O e-mail de aviso não foi enviado. ${erro instanceof Error ? erro.message : 'Falha no serviço de e-mail.'}`.slice(
            0,
            400,
          ),
      })
      .where(eq(comunicadosAssinatura.id, c.id));
    return false;
  }
}

// ── Link de assinatura (paciente) ─────────────────────────────

export type ResultadoDoLink =
  | { sucesso: true; url: string }
  | { sucesso: false; erro: string; jaAssinado?: boolean };

/**
 * O link para o paciente assinar. Quem chama JÁ provou que o comunicado é deste paciente.
 * Antes de gerar, consulta o DocuSign: se já foi concluído, não abre assinatura de novo.
 */
export async function gerarLinkDeAssinatura(comunicadoId: string): Promise<ResultadoDoLink> {
  const sync = await sincronizarComunicado(comunicadoId);
  const [c] = await db
    .select()
    .from(comunicadosAssinatura)
    .where(eq(comunicadosAssinatura.id, comunicadoId))
    .limit(1);
  if (!c) return { sucesso: false, erro: 'Comunicado não encontrado.' };
  if (c.status === 'assinado') {
    return { sucesso: false, erro: 'Este comunicado já foi assinado.', jaAssinado: true };
  }
  if (c.status !== 'pendente' || !c.docusignEnvelopeId) {
    return { sucesso: false, erro: 'Este comunicado não está disponível para assinatura.' };
  }
  if (!sync.consultou) {
    // Sem confirmar o estado real no DocuSign, não se entrega link: poderia estar anulado.
    return {
      sucesso: false,
      erro: 'Não foi possível falar com o DocuSign agora. Tente de novo em instantes.',
    };
  }

  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  const link = await gerarUrlAssinaturaComunicado({
    envelopeId: c.docusignEnvelopeId,
    clientUserId: clientUserIdDoComunicado(c.id),
    pacienteNome: c.nomeDestino,
    pacienteEmail: c.emailDestino,
    returnUrl: `${base}/api/comunicados/${c.id}/retorno`,
  });
  if (!link.sucesso) return { sucesso: false, erro: link.erro };
  return { sucesso: true, url: link.url };
}

// ── Confirmação da conclusão ──────────────────────────────────

export interface ResultadoDaSincronizacao {
  /** A API do DocuSign respondeu. */
  consultou: boolean;
  status: ComunicadoAssinatura['status'] | null;
  /** Falta algum passo pós-assinatura (PDF guardado ou e-mail). Quem recebe webhook responde 500. */
  finalizacaoPendente: boolean;
  erro?: string;
}

/**
 * Pergunta o status ao DocuSign, atualiza o banco e, se concluído, finaliza (PDF + e-mails).
 * Pode ser chamada quantas vezes quiser: cada passo é idempotente.
 */
export async function sincronizarComunicado(
  comunicadoId: string,
): Promise<ResultadoDaSincronizacao> {
  const [c] = await db
    .select()
    .from(comunicadosAssinatura)
    .where(eq(comunicadosAssinatura.id, comunicadoId))
    .limit(1);
  if (!c)
    return { consultou: false, status: null, finalizacaoPendente: false, erro: 'não encontrado' };

  // Já assinado: só garante que a finalização não ficou pela metade.
  if (c.status === 'assinado') {
    const f = await finalizarAssinatura(c.id);
    return { consultou: true, status: 'assinado', finalizacaoPendente: !f.completo };
  }
  if (c.status !== 'pendente' || !c.docusignEnvelopeId) {
    // Recusado/erro/cancelado já são estados finais: nada a perguntar, e nada a reentregar.
    return { consultou: c.status !== 'pendente', status: c.status, finalizacaoPendente: false };
  }

  const leitura = await consultarStatusDoEnvelope(c.docusignEnvelopeId);
  if (!leitura.sucesso) {
    return { consultou: false, status: c.status, finalizacaoPendente: false, erro: leitura.erro };
  }

  const nova = situacaoPeloStatusDoDocusign(leitura.dados.status);
  if (nova === 'pendente') {
    if (c.docusignStatus !== leitura.dados.status) {
      await db
        .update(comunicadosAssinatura)
        .set({ docusignStatus: leitura.dados.status })
        .where(eq(comunicadosAssinatura.id, c.id));
    }
    return { consultou: true, status: 'pendente', finalizacaoPendente: false };
  }

  if (nova === 'recusado') {
    // Só sai de pendente: um assinado nunca regride.
    await db
      .update(comunicadosAssinatura)
      .set({ status: 'recusado', docusignStatus: leitura.dados.status })
      .where(and(eq(comunicadosAssinatura.id, c.id), eq(comunicadosAssinatura.status, 'pendente')));
    await registrarAuditoria({
      userId: null,
      acao: 'atualizar',
      entidade: ENTIDADE,
      entidadeId: c.id,
      dadosDepois: { status: 'recusado', docusign: leitura.dados.status },
    });
    return { consultou: true, status: 'recusado', finalizacaoPendente: false };
  }

  // assinado
  const quando = leitura.dados.completedDateTime
    ? new Date(leitura.dados.completedDateTime)
    : new Date();
  const [virou] = await db
    .update(comunicadosAssinatura)
    .set({
      status: 'assinado',
      docusignStatus: leitura.dados.status,
      assinadoEm: Number.isNaN(quando.getTime()) ? new Date() : quando,
      erro: null,
      erroEm: null,
    })
    .where(and(eq(comunicadosAssinatura.id, c.id), eq(comunicadosAssinatura.status, 'pendente')))
    .returning({ id: comunicadosAssinatura.id });
  if (virou) {
    await registrarAuditoria({
      userId: null,
      acao: 'atualizar',
      entidade: ENTIDADE,
      entidadeId: c.id,
      dadosDepois: { status: 'assinado', docusign: leitura.dados.status },
    });
  }
  const f = await finalizarAssinatura(c.id);
  return { consultou: true, status: 'assinado', finalizacaoPendente: !f.completo };
}

async function bytesDoPdfAssinado(url: string): Promise<Buffer | null> {
  const lido = await lerDocumentoPrivado(url);
  if (!lido) return null;
  return Buffer.from(await new Response(lido.stream).arrayBuffer());
}

/**
 * Guarda o PDF assinado e dispara os dois e-mails, cada um no máximo uma vez.
 * Devolve `completo: false` se algum passo falhou — a próxima chamada retoma dali.
 */
export async function finalizarAssinatura(comunicadoId: string): Promise<{ completo: boolean }> {
  let [c] = await db
    .select()
    .from(comunicadosAssinatura)
    .where(eq(comunicadosAssinatura.id, comunicadoId))
    .limit(1);
  if (!c || c.status !== 'assinado' || !c.docusignEnvelopeId) return { completo: false };
  const envelopeId = c.docusignEnvelopeId;

  const registrarFalha = async (mensagem: string) => {
    await db
      .update(comunicadosAssinatura)
      .set({ erro: mensagem, erroEm: new Date() })
      .where(eq(comunicadosAssinatura.id, comunicadoId));
  };

  // a) o PDF assinado, em store privado
  let bytes: Buffer | null = null;
  if (!c.urlPdfAssinado) {
    const baixado = await downloadPdfAssinado(envelopeId);
    if (!baixado) {
      await registrarFalha(
        'Não foi possível baixar o PDF assinado do DocuSign. Tentaremos de novo.',
      );
      return { completo: false };
    }
    try {
      const guardado = await guardarDocumentoPrivado(
        `comunicados/${c.pacienteId}/${c.id}-assinado.pdf`,
        baixado,
        { contentType: 'application/pdf' },
      );
      const [gravou] = await db
        .update(comunicadosAssinatura)
        .set({ urlPdfAssinado: guardado.url })
        .where(
          and(eq(comunicadosAssinatura.id, c.id), isNull(comunicadosAssinatura.urlPdfAssinado)),
        )
        .returning({ id: comunicadosAssinatura.id });
      if (!gravou) {
        // Outro processo gravou primeiro: este blob é sobra.
        await apagarDocumentoPrivado(guardado.url).catch(() => {});
      }
      bytes = baixado;
    } catch (erro) {
      // Se a falha foi "já existe" porque outro processo guardou agora, o passo está feito.
      const [atual] = await db
        .select({ url: comunicadosAssinatura.urlPdfAssinado })
        .from(comunicadosAssinatura)
        .where(eq(comunicadosAssinatura.id, c.id))
        .limit(1);
      if (!atual?.url) {
        await registrarFalha(mensagemSegura(erro, 'Não foi possível guardar o PDF assinado.'));
        return { completo: false };
      }
    }
    [c] = await db
      .select()
      .from(comunicadosAssinatura)
      .where(eq(comunicadosAssinatura.id, comunicadoId))
      .limit(1);
  }
  if (!c.urlPdfAssinado) return { completo: false };

  const assinadoEmTexto = dataEHoraPorExtenso(c.assinadoEm ?? new Date());
  let completo = true;

  // b) e-mail de confirmação ao paciente (link seguro, sem anexo)
  const [travaPaciente] = await db
    .update(comunicadosAssinatura)
    .set({ emailConfirmacaoPacienteEm: new Date() })
    .where(
      and(
        eq(comunicadosAssinatura.id, c.id),
        isNull(comunicadosAssinatura.emailConfirmacaoPacienteEm),
      ),
    )
    .returning({ id: comunicadosAssinatura.id });
  if (travaPaciente) {
    try {
      await enviarEmailConfirmacaoPaciente({
        para: { email: c.emailDestino, nome: c.nomeDestino },
        titulo: c.titulo,
        assinadoEmTexto,
      });
    } catch (erro) {
      console.error(
        '[comunicados] e-mail ao paciente:',
        erro instanceof Error ? erro.message : 'erro',
      );
      await db
        .update(comunicadosAssinatura)
        .set({ emailConfirmacaoPacienteEm: null })
        .where(eq(comunicadosAssinatura.id, c.id));
      await registrarFalha(
        'O e-mail de confirmação ao paciente não foi enviado. Tentaremos de novo.',
      );
      completo = false;
    }
  }

  // c) e-mail a docs@ com o PDF assinado em anexo
  const [travaDocs] = await db
    .update(comunicadosAssinatura)
    .set({ emailNotificacaoDocsEm: new Date() })
    .where(
      and(eq(comunicadosAssinatura.id, c.id), isNull(comunicadosAssinatura.emailNotificacaoDocsEm)),
    )
    .returning({ id: comunicadosAssinatura.id });
  if (travaDocs) {
    try {
      const pdf = bytes ?? (await bytesDoPdfAssinado(c.urlPdfAssinado));
      if (!pdf) throw new Error('PDF assinado não encontrado no armazenamento');
      await enviarEmailNotificacaoDocs({
        pacienteNome: c.nomeDestino,
        pacienteEmail: c.emailDestino,
        pacienteId: c.pacienteId,
        titulo: c.titulo,
        assinadoEmTexto,
        envelopeId,
        pdfAssinado: pdf,
        nomeDoAnexo: `${c.titulo} - assinado.pdf`,
      });
    } catch (erro) {
      console.error('[comunicados] e-mail a docs@:', erro instanceof Error ? erro.message : 'erro');
      await db
        .update(comunicadosAssinatura)
        .set({ emailNotificacaoDocsEm: null })
        .where(eq(comunicadosAssinatura.id, c.id));
      await registrarFalha('A notificação para docs@ não foi enviada. Tentaremos de novo.');
      completo = false;
    }
  }

  if (completo) {
    await db
      .update(comunicadosAssinatura)
      .set({ erro: null, erroEm: null })
      .where(
        and(eq(comunicadosAssinatura.id, c.id), sql`${comunicadosAssinatura.erro} is not null`),
      );
  }
  return { completo };
}

/** Webhook: acha o comunicado pelo envelope e sincroniza. `null` = não é um comunicado. */
export async function processarWebhookDoComunicado(
  envelopeId: string,
): Promise<ResultadoDaSincronizacao | null> {
  const [c] = await db
    .select({ id: comunicadosAssinatura.id })
    .from(comunicadosAssinatura)
    .where(eq(comunicadosAssinatura.docusignEnvelopeId, envelopeId))
    .limit(1);
  if (!c) return null;
  return sincronizarComunicado(c.id);
}

// ── Reiniciar o fluxo (admin) ─────────────────────────────────

export type ResultadoDoReinicio = { sucesso: true } | { sucesso: false; erro: string };

/**
 * Volta o comunicado ao estado inicial, para o admin poder enviá-lo de novo ao paciente.
 *
 * 🔴 NADA É APAGADO. A linha passa a `cancelado` com quem, quando e por quê; o PDF assinado
 * continua no store privado e o vínculo com o paciente e o envelope do DocuSign continuam na
 * linha — é o que sustenta a auditoria e a prova de que o paciente assinou aquela versão. O que
 * muda é só o que o índice único parcial enxerga: `cancelado` não é `pendente` nem `assinado`, e
 * por isso um novo envio deixa de ser recusado.
 *
 * Só sai de `assinado`, e com UPDATE condicional: dois admins clicando juntos, ou o webhook
 * chegando no meio, resultam em UMA transição. Quem perde a corrida recebe erro e não duplica nada.
 * Depois do reinício, o paciente deixa de ver o comunicado em Documentos e o envelope antigo
 * (já concluído no DocuSign) não gera mais e-mail: `finalizarAssinatura` só age sobre `assinado`.
 */
export async function reiniciarComunicado(params: {
  comunicadoId: string;
  adminUserId: string;
  motivo: string;
}): Promise<ResultadoDoReinicio> {
  const [c] = await db
    .select()
    .from(comunicadosAssinatura)
    .where(eq(comunicadosAssinatura.id, params.comunicadoId))
    .limit(1);
  if (!c) return { sucesso: false, erro: 'Comunicado não encontrado.' };
  if (c.status !== 'assinado') {
    return {
      sucesso: false,
      erro:
        c.status === 'pendente'
          ? 'Este comunicado ainda está pendente de assinatura. O reinício vale só para comunicado já assinado.'
          : 'Este comunicado não está assinado; não há o que reiniciar.',
    };
  }

  const [virou] = await db
    .update(comunicadosAssinatura)
    .set({
      status: 'cancelado',
      canceladoEm: new Date(),
      canceladoPorUserId: params.adminUserId,
      motivoCancelamento: params.motivo,
    })
    .where(and(eq(comunicadosAssinatura.id, c.id), eq(comunicadosAssinatura.status, 'assinado')))
    .returning({ id: comunicadosAssinatura.id });
  if (!virou) {
    return { sucesso: false, erro: 'O comunicado mudou de situação. Atualize a tela e confira.' };
  }

  await registrarAuditoria({
    userId: params.adminUserId,
    acao: 'atualizar',
    entidade: ENTIDADE,
    entidadeId: c.id,
    dadosAntes: {
      status: 'assinado',
      assinadoEm: c.assinadoEm?.toISOString() ?? null,
      docusignEnvelopeId: c.docusignEnvelopeId,
      arquivoAssinadoGuardado: !!c.urlPdfAssinado,
    },
    dadosDepois: {
      status: 'cancelado',
      motivo: params.motivo,
      arquivoAssinadoPreservado: !!c.urlPdfAssinado,
    },
  });
  return { sucesso: true };
}

// ── Leituras ──────────────────────────────────────────────────

/** Campos que o admin vê. Sem URL de arquivo: o acesso passa pela rota autenticada. */
export interface ComunicadoParaAdmin {
  id: string;
  titulo: string;
  status: ComunicadoAssinatura['status'];
  enviadoEm: Date;
  enviadoPorNome: string | null;
  assinadoEm: Date | null;
  nomeDestino: string;
  emailDestino: string;
  temArquivoAssinado: boolean;
  erro: string | null;
  emailEnvioErro: string | null;
  emailEnviado: boolean;
  /**
   * O MESMO link do e-mail de aviso (página Documentos do site, onde o paciente logado abre o
   * DocuSign). Fixo e sem credencial: quem o abre ainda precisa entrar na própria conta. NUNCA o
   * link direto do DocuSign — esse é de uso único, vale minutos e assina em nome do paciente.
   */
  linkDeAssinatura: string;
  /** Preenchidos quando o admin reiniciou o fluxo (status cancelado). */
  reiniciadoEm: Date | null;
  reiniciadoPorNome: string | null;
  motivoDoReinicio: string | null;
}

const quemReiniciou = alias(users, 'quem_reiniciou');

export async function listarParaAdmin(pacienteId: string): Promise<ComunicadoParaAdmin[]> {
  const linhas = await db
    .select({
      c: comunicadosAssinatura,
      enviadoPorNome: users.nome,
      reiniciadoPorNome: quemReiniciou.nome,
    })
    .from(comunicadosAssinatura)
    .leftJoin(users, eq(comunicadosAssinatura.enviadoPorUserId, users.id))
    .leftJoin(quemReiniciou, eq(comunicadosAssinatura.canceladoPorUserId, quemReiniciou.id))
    .where(
      and(
        eq(comunicadosAssinatura.pacienteId, pacienteId),
        eq(comunicadosAssinatura.tipo, TIPO_ATUALIZACAO_PROGRAMA_DOACAO),
      ),
    )
    .orderBy(desc(comunicadosAssinatura.enviadoEm));
  return linhas.map(({ c, enviadoPorNome, reiniciadoPorNome }) => ({
    id: c.id,
    titulo: c.titulo,
    status: c.status,
    enviadoEm: c.enviadoEm,
    enviadoPorNome,
    assinadoEm: c.assinadoEm,
    nomeDestino: c.nomeDestino,
    emailDestino: c.emailDestino,
    temArquivoAssinado: !!c.urlPdfAssinado,
    erro: c.erro,
    emailEnvioErro: c.emailEnvioErro,
    emailEnviado: !!c.emailEnvioEnviadoEm,
    linkDeAssinatura: LINK_DOS_COMUNICADOS(),
    reiniciadoEm: c.canceladoEm,
    reiniciadoPorNome,
    motivoDoReinicio: c.motivoCancelamento,
  }));
}

export interface ComunicadoParaPaciente {
  id: string;
  titulo: string;
  status: 'pendente' | 'assinado' | 'recusado';
  enviadoEm: Date;
  assinadoEm: Date | null;
  temArquivoAssinado: boolean;
}

/**
 * Só o que JÁ foi enviado a este paciente. Linhas em `erro` ou `cancelado` nunca chegaram a ele
 * e ficam de fora; quem não recebeu o disparo recebe lista vazia.
 */
export async function listarParaPaciente(pacienteId: string): Promise<ComunicadoParaPaciente[]> {
  const linhas = await db
    .select()
    .from(comunicadosAssinatura)
    .where(
      and(
        eq(comunicadosAssinatura.pacienteId, pacienteId),
        inArray(comunicadosAssinatura.status, ['pendente', 'assinado', 'recusado']),
      ),
    )
    .orderBy(desc(comunicadosAssinatura.enviadoEm));
  // Uma recusa antiga não aparece quando já existe um envio mais novo (pendente ou assinado).
  const haAtivo = linhas.some((c) => c.status === 'pendente' || c.status === 'assinado');
  return linhas
    .filter((c) => !(c.status === 'recusado' && haAtivo))
    .map((c) => ({
      id: c.id,
      titulo: c.titulo,
      status: c.status as ComunicadoParaPaciente['status'],
      enviadoEm: c.enviadoEm,
      assinadoEm: c.assinadoEm,
      temArquivoAssinado: !!c.urlPdfAssinado,
    }));
}
