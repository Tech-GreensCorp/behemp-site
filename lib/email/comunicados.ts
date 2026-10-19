/**
 * E-mails do fluxo "comunicado para assinatura" (Atualização do Programa de Doação).
 *
 * Mesmo serviço (Brevo) e mesma identidade visual dos outros e-mails do produto; o remetente é
 * `docs@be4hope.org` (`REMETENTE_DOCUMENTOS`). Três mensagens:
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

export function montarEmailDeEnvio(dados: { nome: string; titulo: string }): {
  assunto: string;
  html: string;
} {
  const link = `${APP_URL()}/paciente/documentos`;
  const html = moldura({
    titulo: dados.titulo,
    emoji: '💌',
    badgeCor: CORES.douradoBg,
    rodape:
      'Você recebeu este e-mail porque a equipe Be4Hope enviou um comunicado para a sua conta.',
    corpo: [
      h1('Você recebeu um comunicado importante'),
      par(
        `Olá, <strong style="color:${CORES.texto};">${esc(dados.nome)}</strong>! A equipe Be4Hope preparou o comunicado <strong style="color:${CORES.texto};">${esc(dados.titulo)}</strong> especialmente para você.`,
      ),
      par(
        'Para ler e assinar eletronicamente, é preciso acessá-lo pelo nosso sistema. É rápido e seguro:',
      ),
      `<ol style="margin:0 0 14px;padding-left:20px;font-size:14px;line-height:1.8;color:${CORES.texto2};">
        <li>Clique no botão abaixo e entre na sua conta Be4Hope.</li>
        <li>Na página <strong>Documentos</strong>, abra o comunicado e leia com calma.</li>
        <li>Clique em <strong>Abrir e assinar</strong> e siga as instruções na tela.</li>
      </ol>`,
      botao(link, 'Acessar meus documentos'),
      `<p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:${CORES.muted};text-align:center;">Este e-mail não traz o documento anexado: a leitura e a assinatura acontecem dentro do sistema, para que fiquem registradas. Dúvidas? Responda a este e-mail ou fale com a gente pelo WhatsApp (11) 93204-7360, de segunda a sexta, das 9h às 18h.</p>`,
    ].join(''),
  });
  return { assunto: `Be4Hope — Você recebeu um comunicado para assinar: ${dados.titulo}`, html };
}

// ── 2. Conclusão: confirmação ao paciente ─────────────────────

export function montarEmailConfirmacaoPaciente(dados: {
  nome: string;
  titulo: string;
  assinadoEmTexto: string;
}): { assunto: string; html: string } {
  const link = `${APP_URL()}/paciente/documentos`;
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
  return new BrevoClient({ apiKey });
}

const sender = () => ({ name: REMETENTE_DOCUMENTOS.name, email: REMETENTE_DOCUMENTOS.email });

export async function enviarEmailDeEnvio(dados: {
  para: { email: string; nome: string };
  titulo: string;
}): Promise<void> {
  const { assunto, html } = montarEmailDeEnvio({ nome: dados.para.nome, titulo: dados.titulo });
  await cliente().transactionalEmails.sendTransacEmail({
    subject: assunto,
    htmlContent: html,
    sender: sender(),
    replyTo: sender(),
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
  await cliente().transactionalEmails.sendTransacEmail({
    subject: assunto,
    htmlContent: html,
    sender: sender(),
    replyTo: sender(),
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
  await cliente().transactionalEmails.sendTransacEmail({
    subject: assunto,
    htmlContent: html,
    sender: sender(),
    to: [{ email: REMETENTE_DOCUMENTOS.email, name: REMETENTE_DOCUMENTOS.name }],
    attachment: [{ name: dados.nomeDoAnexo, content: dados.pdfAssinado.toString('base64') }],
  });
}
