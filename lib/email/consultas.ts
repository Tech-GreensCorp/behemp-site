/**
 * Templates de e-mail para consultas via Brevo.
 * Agendamento, remarcação e cancelamento.
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
  red: '#e74c3c',
  redBg: '#fdf0ef',
};

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatarData(data: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(data);
}

function criarClienteBrevo() {
  return new BrevoClient({ apiKey: process.env.BREVO_API_KEY! });
}

// ── Template base ─────────────────────────────────────────────

function templateBase(opts: {
  emoji: string;
  badge: string;
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

// ── E-mail: Consulta Agendada ─────────────────────────────────

export async function enviarEmailConsultaAgendada(params: {
  pacienteNome: string;
  pacienteEmail: string;
  medicoNome: string;
  dataHora: Date;
  meetLink: string | null;
}): Promise<void> {
  const corpo = `
    <p style="margin:0 0 24px;font-size:14px;color:${CORES.textSecondary};text-align:center;line-height:1.6;">
      Olá, <strong style="color:${CORES.textPrimary};">${escapeHtml(params.pacienteNome)}</strong>! Sua consulta foi agendada com sucesso.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr><td style="background:${CORES.bg};border-radius:12px;padding:20px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:6px 0;border-bottom:1px solid ${CORES.divider};">
            <p style="margin:0;font-size:11px;font-weight:600;text-transform:uppercase;color:${CORES.textMuted};">Médico</p>
            <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:${CORES.textPrimary};">${escapeHtml(params.medicoNome)}</p>
          </td></tr>
          <tr><td style="padding:12px 0 0;">
            <p style="margin:0;font-size:11px;font-weight:600;text-transform:uppercase;color:${CORES.textMuted};">Data e Horário</p>
            <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:${CORES.textPrimary};">${formatarData(params.dataHora)}</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
    ${params.meetLink ? `<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
      <a href="${params.meetLink}" style="display:inline-block;background:${CORES.gold};color:#fff;font-size:13px;font-weight:600;padding:12px 28px;border-radius:50px;text-decoration:none;">📹 Acessar Google Meet</a>
    </td></tr></table>` : ''}`;

  const html = templateBase({
    emoji: '📅',
    badge: 'Consulta agendada',
    badgeCor: CORES.greenBg,
    titulo: 'Consulta agendada!',
    corpo,
  });

  const client = criarClienteBrevo();
  await client.transactionalEmails.sendTransacEmail({
    subject: `Consulta agendada — ${formatarData(params.dataHora)}`,
    htmlContent: html,
    sender: { name: 'Be4Hope', email: process.env.BREVO_FROM_EMAIL ?? 'tech@be4hope.org' },
    to: [{ email: params.pacienteEmail, name: params.pacienteNome }],
  });
}

// ── E-mail: Consulta Remarcada ────────────────────────────────

export async function enviarEmailConsultaRemarcada(params: {
  pacienteNome: string;
  pacienteEmail: string;
  medicoNome: string;
  dataHoraAnterior: Date;
  dataHoraNova: Date;
}): Promise<void> {
  const corpo = `
    <p style="margin:0 0 24px;font-size:14px;color:${CORES.textSecondary};text-align:center;line-height:1.6;">
      Olá, <strong>${escapeHtml(params.pacienteNome)}</strong>! Sua consulta com <strong>${escapeHtml(params.medicoNome)}</strong> foi remarcada.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr><td style="background:${CORES.bg};border-radius:12px;padding:20px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:6px 0;border-bottom:1px solid ${CORES.divider};">
            <p style="margin:0;font-size:11px;font-weight:600;text-transform:uppercase;color:${CORES.textMuted};">Data Anterior</p>
            <p style="margin:4px 0 0;font-size:14px;color:${CORES.textSecondary};text-decoration:line-through;">${formatarData(params.dataHoraAnterior)}</p>
          </td></tr>
          <tr><td style="padding:12px 0 0;">
            <p style="margin:0;font-size:11px;font-weight:600;text-transform:uppercase;color:${CORES.textMuted};">Nova Data</p>
            <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:${CORES.green};">${formatarData(params.dataHoraNova)}</p>
          </td></tr>
        </table>
      </td></tr>
    </table>`;

  const html = templateBase({
    emoji: '🔄',
    badge: 'Consulta remarcada',
    badgeCor: CORES.goldBg,
    titulo: 'Consulta remarcada',
    corpo,
  });

  const client = criarClienteBrevo();
  await client.transactionalEmails.sendTransacEmail({
    subject: `Consulta remarcada — Nova data: ${formatarData(params.dataHoraNova)}`,
    htmlContent: html,
    sender: { name: 'Be4Hope', email: process.env.BREVO_FROM_EMAIL ?? 'tech@be4hope.org' },
    to: [{ email: params.pacienteEmail, name: params.pacienteNome }],
  });
}

// ── E-mail: Consulta Cancelada ────────────────────────────────

export async function enviarEmailConsultaCancelada(params: {
  pacienteNome: string;
  pacienteEmail: string;
  medicoNome: string;
  dataHora: Date;
  motivo: string;
}): Promise<void> {
  const corpo = `
    <p style="margin:0 0 24px;font-size:14px;color:${CORES.textSecondary};text-align:center;line-height:1.6;">
      Olá, <strong>${escapeHtml(params.pacienteNome)}</strong>. Infelizmente sua consulta foi cancelada.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr><td style="background:${CORES.redBg};border-radius:12px;padding:20px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:6px 0;border-bottom:1px solid ${CORES.divider};">
            <p style="margin:0;font-size:11px;font-weight:600;text-transform:uppercase;color:${CORES.textMuted};">Consulta de</p>
            <p style="margin:4px 0 0;font-size:14px;color:${CORES.textSecondary};text-decoration:line-through;">${formatarData(params.dataHora)}</p>
          </td></tr>
          <tr><td style="padding:12px 0 0;">
            <p style="margin:0;font-size:11px;font-weight:600;text-transform:uppercase;color:${CORES.textMuted};">Motivo</p>
            <p style="margin:4px 0 0;font-size:14px;color:${CORES.red};">${escapeHtml(params.motivo)}</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
      <a href="${APP_URL()}/agendamento" style="display:inline-block;background:${CORES.gold};color:#fff;font-size:13px;font-weight:600;padding:12px 28px;border-radius:50px;text-decoration:none;">📅 Reagendar consulta</a>
    </td></tr></table>`;

  const html = templateBase({
    emoji: '❌',
    badge: 'Consulta cancelada',
    badgeCor: CORES.redBg,
    titulo: 'Consulta cancelada',
    corpo,
  });

  const client = criarClienteBrevo();
  await client.transactionalEmails.sendTransacEmail({
    subject: `Consulta cancelada — ${formatarData(params.dataHora)}`,
    htmlContent: html,
    sender: { name: 'Be4Hope', email: process.env.BREVO_FROM_EMAIL ?? 'tech@be4hope.org' },
    to: [{ email: params.pacienteEmail, name: params.pacienteNome }],
  });
}
