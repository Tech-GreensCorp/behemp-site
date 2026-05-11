/**
 * Templates de e-mail para notificações via Brevo.
 * Renovação de documentos e recompra de medicamentos.
 */

import { BrevoClient } from '@getbrevo/brevo';

const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const LOGO_URL = () => `${APP_URL()}/logo.png`;

const CORES = {
  primary: '#c0392b',
  primaryDark: '#a93226',
  bg: '#f7f5f2',
  cardBg: '#ffffff',
  cardBorder: '#ece8e3',
  textPrimary: '#1a1a1a',
  textSecondary: '#666666',
  textMuted: '#999999',
  divider: '#eee9e3',
  green: '#27ae60',
  greenBg: '#e8f8f0',
  gold: '#C08E3A',
  goldBg: '#fdf6ec',
  blue: '#2980b9',
  blueBg: '#eaf2f8',
};

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function criarClienteBrevo() {
  return new BrevoClient({ apiKey: process.env.BREVO_API_KEY! });
}

// ── Template base ─────────────────────────────────────────────

function templateBase(opts: {
  emoji: string;
  badgeCor: string;
  titulo: string;
  corpo: string;
}): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${opts.titulo}</title></head>
<body style="margin:0;padding:0;background:${CORES.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${CORES.bg};">
<tr><td style="padding:32px 16px;">
<table align="center" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;margin:0 auto;">
  <tr><td align="center" style="padding:0 0 24px;">
    <img src="${LOGO_URL()}" alt="Be4Hope" width="120" style="display:block;border:0;max-width:120px;">
  </td></tr>
  <tr><td style="background:${CORES.cardBg};border-radius:16px;border:1px solid ${CORES.cardBorder};overflow:hidden;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="padding:40px 36px 8px;text-align:center;">
        <div style="display:inline-block;width:64px;height:64px;border-radius:50%;background:${opts.badgeCor};text-align:center;line-height:64px;font-size:30px;">${opts.emoji}</div>
      </td></tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="padding:16px 36px 36px;">
        <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${CORES.textPrimary};text-align:center;">${opts.titulo}</h1>
        ${opts.corpo}
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:28px 0 0;text-align:center;">
    <p style="margin:0 0 4px;font-size:12px;color:${CORES.textMuted};">Be4Hope — Cuidar de quem cuida é nosso ato de amor</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

// ── E-mail: Renovação de Documento ────────────────────────────

const TIPO_DOCUMENTO_LABELS: Record<string, string> = {
  rg: 'RG',
  rg_responsavel: 'RG do Responsável',
  receita_medica: 'Receita Médica',
  comprovante_residencia: 'Comprovante de Residência',
  autorizacao_anvisa: 'Autorização ANVISA',
};

export async function enviarEmailRenovacaoDocumento(params: {
  emailPaciente: string;
  nomePaciente: string;
  tipoDocumento: string;
  dataValidade: string;
}): Promise<void> {
  const tipoLabel = TIPO_DOCUMENTO_LABELS[params.tipoDocumento] ?? params.tipoDocumento;

  const corpo = `
    <p style="margin:0 0 24px;font-size:14px;color:${CORES.textSecondary};text-align:center;line-height:1.6;">
      Olá, <strong style="color:${CORES.textPrimary};">${escapeHtml(params.nomePaciente)}</strong>!
      Seu documento precisa de atenção.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr><td style="background:${CORES.goldBg};border-radius:12px;padding:20px 24px;border-left:3px solid ${CORES.gold};">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:6px 0;border-bottom:1px solid ${CORES.divider};">
            <p style="margin:0;font-size:11px;font-weight:600;text-transform:uppercase;color:${CORES.textMuted};">Documento</p>
            <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:${CORES.textPrimary};">${escapeHtml(tipoLabel)}</p>
          </td></tr>
          <tr><td style="padding:12px 0 0;">
            <p style="margin:0;font-size:11px;font-weight:600;text-transform:uppercase;color:${CORES.textMuted};">Vence em</p>
            <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:${CORES.gold};">${escapeHtml(params.dataValidade)}</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
    <p style="margin:0 0 24px;font-size:13px;color:${CORES.textSecondary};text-align:center;line-height:1.6;">
      Providencie a renovação o mais rápido possível para manter seu tratamento ativo.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
      <a href="${APP_URL()}/paciente/documentos" style="display:inline-block;background:${CORES.gold};color:#fff;font-size:13px;font-weight:600;padding:12px 28px;border-radius:50px;text-decoration:none;">📄 Acessar meus documentos</a>
    </td></tr></table>`;

  const html = templateBase({
    emoji: '⚠️',
    badgeCor: CORES.goldBg,
    titulo: 'Documento próximo do vencimento',
    corpo,
  });

  const client = criarClienteBrevo();
  await client.transactionalEmails.sendTransacEmail({
    subject: `⚠️ ${tipoLabel} próximo do vencimento`,
    htmlContent: html,
    sender: { name: 'Be4Hope', email: process.env.BREVO_FROM_EMAIL ?? 'tech@be4hope.org' },
    to: [{ email: params.emailPaciente, name: params.nomePaciente }],
  });
}

// ── E-mail: Recompra de Medicamento (Paciente) ───────────────

export async function enviarEmailRecompraPaciente(params: {
  emailPaciente: string;
  nomePaciente: string;
  nomeMedicamento: string;
  dataPrevista: string;
}): Promise<void> {
  const corpo = `
    <p style="margin:0 0 24px;font-size:14px;color:${CORES.textSecondary};text-align:center;line-height:1.6;">
      Olá, <strong style="color:${CORES.textPrimary};">${escapeHtml(params.nomePaciente)}</strong>!
      Sua medicação precisa de renovação.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr><td style="background:${CORES.blueBg};border-radius:12px;padding:20px 24px;border-left:3px solid ${CORES.blue};">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:6px 0;border-bottom:1px solid ${CORES.divider};">
            <p style="margin:0;font-size:11px;font-weight:600;text-transform:uppercase;color:${CORES.textMuted};">Medicamento</p>
            <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:${CORES.textPrimary};">${escapeHtml(params.nomeMedicamento)}</p>
          </td></tr>
          <tr><td style="padding:12px 0 0;">
            <p style="margin:0;font-size:11px;font-weight:600;text-transform:uppercase;color:${CORES.textMuted};">Previsão de término</p>
            <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:${CORES.blue};">${escapeHtml(params.dataPrevista)}</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
    <p style="margin:0 0 24px;font-size:13px;color:${CORES.textSecondary};text-align:center;line-height:1.6;">
      Faça o pedido de recompra com antecedência para não interromper o tratamento.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
      <a href="${APP_URL()}/paciente/recompra" style="display:inline-block;background:${CORES.blue};color:#fff;font-size:13px;font-weight:600;padding:12px 28px;border-radius:50px;text-decoration:none;">💊 Ver detalhes da recompra</a>
    </td></tr></table>`;

  const html = templateBase({
    emoji: '💊',
    badgeCor: CORES.blueBg,
    titulo: 'Hora de renovar seu medicamento',
    corpo,
  });

  const client = criarClienteBrevo();
  await client.transactionalEmails.sendTransacEmail({
    subject: `💊 Recompra de ${params.nomeMedicamento} — ${params.dataPrevista}`,
    htmlContent: html,
    sender: { name: 'Be4Hope', email: process.env.BREVO_FROM_EMAIL ?? 'tech@be4hope.org' },
    to: [{ email: params.emailPaciente, name: params.nomePaciente }],
  });
}

// ── E-mail: Recompra de Medicamento (Equipe) ─────────────────

export async function enviarEmailRecompraEquipe(params: {
  pacienteNome: string;
  nomeMedicamento: string;
  dataPrevista: string;
  gotasPorDia: number;
  mlFrasco: number;
}): Promise<void> {
  const corpo = `
    <p style="margin:0 0 24px;font-size:14px;color:${CORES.textSecondary};text-align:center;line-height:1.6;">
      Um paciente solicitou recompra de medicamento.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr><td style="background:${CORES.bg};border-radius:12px;padding:20px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:6px 0;border-bottom:1px solid ${CORES.divider};">
            <p style="margin:0;font-size:11px;font-weight:600;text-transform:uppercase;color:${CORES.textMuted};">Paciente</p>
            <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:${CORES.textPrimary};">${escapeHtml(params.pacienteNome)}</p>
          </td></tr>
          <tr><td style="padding:12px 0 0;border-bottom:1px solid ${CORES.divider};">
            <p style="margin:0;font-size:11px;font-weight:600;text-transform:uppercase;color:${CORES.textMuted};">Medicamento</p>
            <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:${CORES.textPrimary};">${escapeHtml(params.nomeMedicamento)}</p>
          </td></tr>
          <tr><td style="padding:12px 0 0;border-bottom:1px solid ${CORES.divider};">
            <p style="margin:0;font-size:11px;font-weight:600;text-transform:uppercase;color:${CORES.textMuted};">Dosagem</p>
            <p style="margin:4px 0 0;font-size:14px;color:${CORES.textPrimary};">${params.gotasPorDia} gotas/dia — Frasco ${params.mlFrasco}ml</p>
          </td></tr>
          <tr><td style="padding:12px 0 0;">
            <p style="margin:0;font-size:11px;font-weight:600;text-transform:uppercase;color:${CORES.textMuted};">Previsão de término</p>
            <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:${CORES.primary};">${escapeHtml(params.dataPrevista)}</p>
          </td></tr>
        </table>
      </td></tr>
    </table>`;

  const html = templateBase({
    emoji: '📦',
    badgeCor: CORES.greenBg,
    titulo: 'Solicitação de Recompra',
    corpo,
  });

  const emailDestino = process.env.RECOMPRA_EMAIL_DESTINO ?? process.env.BREVO_TO_EMAIL ?? 'tech@be4hope.org';

  const client = criarClienteBrevo();
  await client.transactionalEmails.sendTransacEmail({
    subject: `📦 Recompra — ${params.pacienteNome} — ${params.nomeMedicamento}`,
    htmlContent: html,
    sender: { name: 'Be4Hope', email: process.env.BREVO_FROM_EMAIL ?? 'tech@be4hope.org' },
    to: [{ email: emailDestino, name: 'Equipe Be4Hope' }],
  });
}
