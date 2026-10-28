/**
 * E-mails do fluxo "comunicado para assinatura" (Atualização do Programa de Doação).
 *
 * Mesmo serviço (Brevo), mesmo remetente e mesma identidade visual dos outros e-mails do produto
 * (`BREVO_FROM_EMAIL`); `docs@be4hope.org` é o lugar onde o paciente responde e onde chega a
 * notificação de conclusão. Três mensagens:
 *   1. ao paciente, quando o admin envia — só o aviso e o link para o sistema;
 *   2. ao paciente, quando o DocuSign confirma a assinatura — link seguro, sem anexo;
 *   3. a docs@, quando o paciente conclui — com o PDF assinado em anexo.
 *
 * 🔴 Nunca se anexa o comunicado NÃO assinado: ele só existe dentro do DocuSign. O único anexo
 * deste módulo é o PDF assinado, e só na mensagem 3.
 *
 * Funções `montar*` são puras (testáveis); `enviar*` falam com o Brevo e LANÇAM em falha — quem
 * chama decide o que fazer, porque o efeito de uma falha de e-mail difere em cada ponto do fluxo.
 */
import { BrevoClient } from '@getbrevo/brevo';
import { comFiltroDeDestinatarios } from '@/lib/email/destinatarios-tecnicos';

import { REMETENTE_DOCUMENTOS } from '@/lib/comunicados/catalogo';

const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

const CORES = {
  primary: '#c0392b',
  bg: '#f7f5f2',
  card: '#ffffff',
  borda: '#ece8e3',
  texto: '#1a1a1a',
  texto2: '#666666',
  muted: '#999999',
  verdeBg: '#e8f8f0',
  douradoBg: '#fdf6ec',
};

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function moldura(opts: {
  titulo: string;
  emoji: string;
  badgeCor: string;
  corpo: string;
  rodape: string;
}): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${esc(opts.titulo)}</title></head>
<body style="margin:0;padding:0;background:${CORES.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${CORES.bg};">
<tr><td style="padding:32px 16px;">
<table align="center" width="560" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;width:100%;margin:0 auto;">
  <tr><td align="center" style="padding:0 0 24px;">
    <img src="${APP_URL()}/logo.png" alt="Be4Hope" width="120" style="display:block;border:0;max-width:120px;">
  </td></tr>
  <tr><td style="background:${CORES.card};border-radius:16px;border:1px solid ${CORES.borda};">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr><td style="padding:36px 36px 8px;text-align:center;">
        <div style="display:inline-block;width:64px;height:64px;border-radius:50%;background:${opts.badgeCor};text-align:center;line-height:64px;font-size:30px;">${opts.emoji}</div>
      </td></tr>
      <tr><td style="padding:12px 36px 36px;">${opts.corpo}</td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:24px 0 0;text-align:center;">
    <p style="margin:0 0 4px;font-size:12px;color:${CORES.muted};">Be4Hope — Cuidar de quem cuida é nosso ato de amor</p>
    <p style="margin:0;font-size:11px;color:${CORES.muted};">${opts.rodape}</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function botao(href: string, texto: string): string {
  return `<table cellpadding="0" cellspacing="0" role="presentation" style="margin:24px auto 0;"><tr><td align="center">
    <a href="${esc(href)}" style="display:inline-block;background:${CORES.primary};color:#ffffff;font-size:14px;font-weight:600;padding:14px 32px;border-radius:50px;text-decoration:none;">${esc(texto)}</a>
  </td></tr></table>`;
}

const h1 = (t: string) =>
  `<h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:${CORES.texto};text-align:center;line-height:1.35;">${esc(t)}</h1>`;
const par = (t: string) =>
  `<p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:${CORES.texto2};">${t}</p>`;

// ── 1. Envio: aviso ao paciente ───────────────────────────────

/** Onde o comunicado aparece no site: a página Documentos, na seção Comunicados. */
export const LINK_DOS_COMUNICADOS = () => `${APP_URL()}/paciente/documentos#comunicados`;

export function montarEmailDeEnvio(dados: { nome: string; titulo: string }): {
  assunto: string;
  html: string;
  texto: string;
} {
  const link = LINK_DOS_COMUNICADOS();
  const passos = [
    'Clique no botão <strong>Ler e assinar o comunicado</strong> e entre na sua conta Be4Hope (com o e-mail e a senha que você usa no site).',
    'No <strong>menu lateral esquerdo</strong>, clique em <strong>Documentos</strong>. No celular, toque no ícone de menu (≡) no topo da tela para abrir o menu.',
    `Na página Documentos, procure o cartão <strong>${esc(dados.titulo)}</strong>, com a etiqueta <em>Pendente de assinatura</em>.`,
    'Clique em <strong>Abrir e assinar</strong>, leia o documento e siga as instruções da tela de assinatura eletrônica (DocuSign) até confirmar.',
    'Pronto: você recebe um e-mail confirmando a assinatura, e o documento assinado fica guardado na página Documentos.',
  ];
  const html = moldura({
    titulo: dados.titulo,
    emoji: '💌',
    badgeCor: CORES.douradoBg,
    rodape:
      'Você recebeu este e-mail porque a equipe Be4Hope enviou um comunicado para a sua conta.',
    corpo: [
      h1('Você recebeu um comunicado importante'),
      par(
        `Olá, <strong style="color:${CORES.texto};">${esc(dados.nome)}</strong>! A equipe Be4Hope enviou para você o comunicado <strong style="color:${CORES.texto};">${esc(dados.titulo)}</strong>. Ele traz informações importantes sobre o seu tratamento e precisa da sua <strong>ciência e assinatura eletrônica</strong>.`,
      ),
      botao(link, 'Ler e assinar o comunicado'),
      `<p style="margin:26px 0 8px;font-size:13px;font-weight:700;color:${CORES.texto};">Como encontrar e assinar, passo a passo</p>
      <ol style="margin:0 0 16px;padding-left:20px;font-size:14px;line-height:1.75;color:${CORES.texto2};">${passos.map((p) => `<li style="margin-bottom:6px;">${p}</li>`).join('')}</ol>`,
      `<p style="margin:0 0 14px;font-size:12px;line-height:1.6;color:${CORES.muted};">Se o botão não abrir, copie e cole este endereço no navegador:<br><a href="${esc(link)}" style="color:${CORES.primary};word-break:break-all;">${esc(link)}</a></p>`,
      `<p style="margin:0;font-size:12px;line-height:1.6;color:${CORES.muted};">O documento não vai anexado a este e-mail: a leitura e a assinatura acontecem dentro do sistema, para que fiquem registradas. Dúvidas ou dificuldade para encontrar? Responda este e-mail ou fale com a gente pelo WhatsApp (11) 93204-7360, de segunda a sexta, das 9h às 18h.</p>`,
    ].join(''),
  });
  const texto = [
    `Olá, ${dados.nome}!`,
    '',
    `A equipe Be4Hope enviou para você o comunicado "${dados.titulo}". Ele traz informações importantes sobre o seu tratamento e precisa da sua ciência e assinatura eletrônica.`,
    '',
    `Acesse: ${link}`,
    '',
    'Como encontrar e assinar:',
    '1. Abra o link acima e entre na sua conta Be4Hope.',
    '2. No menu lateral esquerdo, clique em "Documentos" (no celular, toque no ícone de menu no topo da tela).',
    `3. Procure o cartão "${dados.titulo}", com a etiqueta "Pendente de assinatura".`,
    '4. Clique em "Abrir e assinar", leia o documento e siga as instruções da tela até confirmar.',
    '5. Você recebe um e-mail de confirmação, e o documento assinado fica guardado em Documentos.',
    '',
    'Dúvidas? Responda este e-mail ou chame no WhatsApp (11) 93204-7360, de segunda a sexta, das 9h às 18h.',
    '',
    'Be4Hope',
  ].join('\n');
  return {
    assunto: `Be4Hope — Você recebeu um comunicado para assinar: ${dados.titulo}`,
    html,
    texto,
  };
}

// ── 2. Conclusão: confirmação ao paciente ─────────────────────

export function montarEmailConfirmacaoPaciente(dados: {
  nome: string;
  titulo: string;
  assinadoEmTexto: string;
}): { assunto: string; html: string } {
  const link = LINK_DOS_COMUNICADOS();
  const html = moldura({
    titulo: 'Assinatura confirmada',
    emoji: '✅',
    badgeCor: CORES.verdeBg,
    rodape: 'Você recebeu este e-mail porque assinou um comunicado na plataforma Be4Hope.',
    corpo: [
      h1('Recebemos a sua assinatura'),
      par(
        `Olá, <strong style="color:${CORES.texto};">${esc(dados.nome)}</strong>! Confirmamos que o comunicado <strong style="color:${CORES.texto};">${esc(dados.titulo)}</strong> foi assinado em ${esc(dados.assinadoEmTexto)}.`,
      ),
      par(
        'O documento assinado fica guardado na sua conta, na página <strong>Documentos</strong>, e você pode abri-lo quando quiser. Por segurança, ele não segue anexado neste e-mail.',
      ),
      botao(link, 'Ver documento assinado'),
    ].join(''),
  });
  return { assunto: `Be4Hope — Assinatura confirmada: ${dados.titulo}`, html };
}

// ── 3. Conclusão: notificação a docs@ ─────────────────────────

export function montarEmailNotificacaoDocs(dados: {
  pacienteNome: string;
  pacienteEmail: string;
  pacienteId: string;
  titulo: string;
  assinadoEmTexto: string;
  envelopeId: string;
  nomeDoAnexo: string;
}): { assunto: string; html: string } {
  const linha = (rotulo: string, valor: string) =>
    `<tr><td style="padding:8px 0;border-bottom:1px solid ${CORES.borda};font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${CORES.muted};width:38%;">${esc(rotulo)}</td><td style="padding:8px 0;border-bottom:1px solid ${CORES.borda};font-size:14px;color:${CORES.texto};">${esc(valor)}</td></tr>`;
  const link = `${APP_URL()}/admin/pacientes/${encodeURIComponent(dados.pacienteId)}`;
  const html = moldura({
    titulo: 'Paciente concluiu a assinatura',
    emoji: '🖋️',
    badgeCor: CORES.verdeBg,
    rodape: 'Notificação automática do fluxo de comunicados da plataforma Be4Hope.',
    corpo: [
      h1('Um paciente concluiu a assinatura'),
      `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:8px 0 8px;">
        ${linha('Paciente', dados.pacienteNome)}
        ${linha('E-mail', dados.pacienteEmail)}
        ${linha('Documento', dados.titulo)}
        ${linha('Concluído em', dados.assinadoEmTexto)}
        ${linha('Envelope DocuSign', dados.envelopeId)}
      </table>`,
      par(`O documento assinado segue em anexo (<strong>${esc(dados.nomeDoAnexo)}</strong>).`),
      botao(link, 'Abrir paciente no painel'),
    ].join(''),
  });
  return {
    assunto: `[Assinatura concluída] ${dados.titulo} — ${dados.pacienteNome}`,
    html,
  };
}

// ── Envio ─────────────────────────────────────────────────────

function cliente() {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error('BREVO_API_KEY ausente — e-mail não enviado.');
  return comFiltroDeDestinatarios(new BrevoClient({ apiKey }));
}

/**
 * 🔴 O REMETENTE É O PADRÃO DO PRODUTO, o mesmo de `lib/email/brevo.ts`, `notificacoes.ts` e dos
 * alertas: `BREVO_FROM_EMAIL` / `BREVO_FROM_NAME`. Esses e-mails já chegam em produção.
 *
 * A primeira versão deste fluxo enviava por `docs@be4hope.org`, endereço que o Brevo não
 * reconhecia como remetente — e o aviso ao paciente não chegou (19/10/2026). `docs@` continua
 * existindo, mas só como o lugar para onde o paciente RESPONDE (`replyTo`) e onde chega a
 * notificação de assinatura concluída (destinatário). Virar remetente de novo exige antes
 * cadastrá-lo como remetente no Brevo.
 */
const sender = () => ({
  name: process.env.BREVO_FROM_NAME?.trim() || 'Be4Hope',
  email: process.env.BREVO_FROM_EMAIL?.trim() || 'tech@be4hope.org',
});

/** Para onde o paciente responde. */
const respostasPara = () => ({
  name: REMETENTE_DOCUMENTOS.name,
  email: REMETENTE_DOCUMENTOS.email,
});

/**
 * Diz, em uma linha e SEM dado pessoal, por que o Brevo recusou — é o que o admin lê no cartão e o
 * que fica no log. O corpo de erro do Brevo traz `code` e `message` da API, nunca o destinatário.
 */
export function descreverErroDoBrevo(erro: unknown): string {
  const e = erro as {
    statusCode?: number;
    body?: { code?: string; message?: string };
    message?: string;
  } | null;
  const partes: string[] = [];
  if (e?.statusCode) partes.push(`HTTP ${e.statusCode}`);
  if (e?.body?.code) partes.push(String(e.body.code));
  const msg = e?.body?.message ?? e?.message;
  if (msg) partes.push(String(msg));
  return (partes.join(' · ') || 'erro desconhecido').slice(0, 200);
}

type CorpoDoEmail = Omit<
  Parameters<ReturnType<typeof cliente>['transactionalEmails']['sendTransacEmail']>[0],
  'sender'
>;

/** Envia pelo remetente padrão. LANÇA com o motivo da recusa (sem dado pessoal) se o Brevo recusar. */
async function enviar(corpo: CorpoDoEmail): Promise<void> {
  try {
    await cliente().transactionalEmails.sendTransacEmail({ ...corpo, sender: sender() });
  } catch (erro) {
    const motivo = descreverErroDoBrevo(erro);
    console.error(`[comunicados] Brevo recusou o envio: ${motivo}`);
    throw new Error(`Brevo recusou o envio (${motivo})`);
  }
}

export async function enviarEmailDeEnvio(dados: {
  para: { email: string; nome: string };
  titulo: string;
}): Promise<void> {
  const { assunto, html, texto } = montarEmailDeEnvio({
    nome: dados.para.nome,
    titulo: dados.titulo,
  });
  await enviar({
    subject: assunto,
    htmlContent: html,
    textContent: texto,
    replyTo: respostasPara(),
    to: [{ email: dados.para.email, name: dados.para.nome }],
  });
}

export async function enviarEmailConfirmacaoPaciente(dados: {
  para: { email: string; nome: string };
  titulo: string;
  assinadoEmTexto: string;
}): Promise<void> {
  const { assunto, html } = montarEmailConfirmacaoPaciente({
    nome: dados.para.nome,
    titulo: dados.titulo,
    assinadoEmTexto: dados.assinadoEmTexto,
  });
  await enviar({
    subject: assunto,
    htmlContent: html,
    replyTo: respostasPara(),
    to: [{ email: dados.para.email, name: dados.para.nome }],
  });
}

export async function enviarEmailNotificacaoDocs(dados: {
  pacienteNome: string;
  pacienteEmail: string;
  pacienteId: string;
  titulo: string;
  assinadoEmTexto: string;
  envelopeId: string;
  pdfAssinado: Buffer;
  nomeDoAnexo: string;
}): Promise<void> {
  const { assunto, html } = montarEmailNotificacaoDocs(dados);
  await enviar({
    subject: assunto,
    htmlContent: html,
    to: [{ email: REMETENTE_DOCUMENTOS.email, name: REMETENTE_DOCUMENTOS.name }],
    attachment: [{ name: dados.nomeDoAnexo, content: dados.pdfAssinado.toString('base64') }],
  });
}
