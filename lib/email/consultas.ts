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

// ── E-mail: Consulta Agendada (Template Premium) ──────────────

export async function enviarEmailConsultaAgendada(params: {
  pacienteNome: string;
  pacienteEmail: string;
  medicoNome: string;
  dataHora: Date;
  meetLink: string | null;
}): Promise<void> {
  const dataFormatada = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  }).format(params.dataHora);

  const horaFormatada = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit', minute: '2-digit',
  }).format(params.dataHora);

  const primeiroNome = escapeHtml(params.pacienteNome.split(' ')[0]);
  const medicoNomeEscapado = escapeHtml(params.medicoNome);

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Consulta Agendada — Be4Hope</title>
</head>
<body style="margin:0;padding:0;background:#f4f1ed;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">

<!-- Container principal -->
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ed;">
<tr><td style="padding:40px 16px;">
<table align="center" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;margin:0 auto;">

  <!-- Logo -->
  <tr><td align="center" style="padding:0 0 32px;">
    <img src="${LOGO_URL()}" alt="Be4Hope" width="140" style="display:block;border:0;max-width:140px;">
  </td></tr>

  <!-- Card principal -->
  <tr><td style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
    <table width="100%" cellpadding="0" cellspacing="0">

      <!-- Header com gradiente -->
      <tr><td style="background:linear-gradient(135deg,${CORES.primary} 0%,#d4574e 50%,${CORES.gold} 100%);padding:40px 36px 32px;text-align:center;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td align="center">
            <div style="display:inline-block;width:72px;height:72px;border-radius:50%;background:rgba(255,255,255,0.2);text-align:center;line-height:72px;font-size:36px;margin-bottom:16px;">✅</div>
          </td></tr>
          <tr><td align="center">
            <h1 style="margin:0 0 8px;font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Consulta Confirmada!</h1>
            <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.9);font-weight:400;">Sua consulta foi agendada com sucesso</p>
          </td></tr>
        </table>
      </td></tr>

      <!-- Saudação -->
      <tr><td style="padding:32px 36px 0;">
        <p style="margin:0;font-size:16px;color:${CORES.textPrimary};line-height:1.7;">
          Olá, <strong>${primeiroNome}</strong>! 👋
        </p>
        <p style="margin:8px 0 0;font-size:15px;color:${CORES.textSecondary};line-height:1.7;">
          Temos boas notícias! Sua consulta está confirmada. Confira os detalhes abaixo:
        </p>
      </td></tr>

      <!-- Card de detalhes -->
      <tr><td style="padding:24px 36px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f5;border-radius:16px;border:1px solid ${CORES.cardBorder};overflow:hidden;">
          
          <!-- Médico -->
          <tr><td style="padding:20px 24px 16px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="40" valign="top">
                  <div style="width:40px;height:40px;border-radius:12px;background:${CORES.greenBg};text-align:center;line-height:40px;font-size:18px;">🩺</div>
                </td>
                <td style="padding-left:14px;">
                  <p style="margin:0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:${CORES.textMuted};">Profissional</p>
                  <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:${CORES.textPrimary};">Dr(a). ${medicoNomeEscapado}</p>
                </td>
              </tr>
            </table>
          </td></tr>

          <!-- Divider -->
          <tr><td style="padding:0 24px;"><div style="border-top:1px solid ${CORES.divider};"></div></td></tr>

          <!-- Data -->
          <tr><td style="padding:16px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="40" valign="top">
                  <div style="width:40px;height:40px;border-radius:12px;background:${CORES.goldBg};text-align:center;line-height:40px;font-size:18px;">📅</div>
                </td>
                <td style="padding-left:14px;">
                  <p style="margin:0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:${CORES.textMuted};">Data</p>
                  <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:${CORES.textPrimary};">${dataFormatada}</p>
                </td>
              </tr>
            </table>
          </td></tr>

          <!-- Divider -->
          <tr><td style="padding:0 24px;"><div style="border-top:1px solid ${CORES.divider};"></div></td></tr>

          <!-- Horário + Duração -->
          <tr><td style="padding:16px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="50%">
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td width="40" valign="top">
                        <div style="width:40px;height:40px;border-radius:12px;background:#eef0ff;text-align:center;line-height:40px;font-size:18px;">⏰</div>
                      </td>
                      <td style="padding-left:14px;">
                        <p style="margin:0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:${CORES.textMuted};">Horário</p>
                        <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:${CORES.textPrimary};">${horaFormatada}</p>
                      </td>
                    </tr>
                  </table>
                </td>
                <td width="50%">
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td width="40" valign="top">
                        <div style="width:40px;height:40px;border-radius:12px;background:#fff0f0;text-align:center;line-height:40px;font-size:18px;">⏱️</div>
                      </td>
                      <td style="padding-left:14px;">
                        <p style="margin:0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:${CORES.textMuted};">Duração</p>
                        <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:${CORES.textPrimary};">1 hora</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td></tr>

          <!-- Divider -->
          <tr><td style="padding:0 24px;"><div style="border-top:1px solid ${CORES.divider};"></div></td></tr>

          <!-- Plataforma -->
          <tr><td style="padding:16px 24px 20px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="40" valign="top">
                  <div style="width:40px;height:40px;border-radius:12px;background:#e8f5e9;text-align:center;line-height:40px;font-size:18px;">💻</div>
                </td>
                <td style="padding-left:14px;">
                  <p style="margin:0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:${CORES.textMuted};">Plataforma</p>
                  <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:${CORES.textPrimary};">Google Meet (online)</p>
                </td>
              </tr>
            </table>
          </td></tr>

        </table>
      </td></tr>

      ${params.meetLink ? `
      <!-- Botão Google Meet -->
      <tr><td style="padding:8px 36px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td align="center">
            <a href="${params.meetLink}" target="_blank" style="display:inline-block;background:#1a73e8;color:#ffffff;font-size:16px;font-weight:700;padding:16px 48px;border-radius:14px;text-decoration:none;letter-spacing:0.3px;box-shadow:0 4px 14px rgba(26,115,232,0.35);">
              📹&nbsp;&nbsp;Entrar na Reunião
            </a>
          </td></tr>
          <tr><td align="center" style="padding-top:10px;">
            <p style="margin:0;font-size:12px;color:${CORES.textMuted};">
              Clique no botão acima no dia e horário da consulta
            </p>
          </td></tr>
        </table>
      </td></tr>
      ` : ''}

      <!-- Dicas pré-consulta -->
      <tr><td style="padding:0 36px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#fdf8f0 0%,#f8f4ee 100%);border-radius:16px;border:1px solid ${CORES.cardBorder};">
          <tr><td style="padding:24px;">
            <p style="margin:0 0 16px;font-size:14px;font-weight:700;color:${CORES.textPrimary};">📋 Prepare-se para sua consulta</p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="padding:6px 0;">
                <p style="margin:0;font-size:13px;color:${CORES.textSecondary};line-height:1.6;">
                  <span style="color:${CORES.green};font-weight:700;">✓</span>&nbsp;&nbsp;Tenha em mãos seus exames recentes
                </p>
              </td></tr>
              <tr><td style="padding:6px 0;">
                <p style="margin:0;font-size:13px;color:${CORES.textSecondary};line-height:1.6;">
                  <span style="color:${CORES.green};font-weight:700;">✓</span>&nbsp;&nbsp;Liste os medicamentos que está usando
                </p>
              </td></tr>
              <tr><td style="padding:6px 0;">
                <p style="margin:0;font-size:13px;color:${CORES.textSecondary};line-height:1.6;">
                  <span style="color:${CORES.green};font-weight:700;">✓</span>&nbsp;&nbsp;Anote suas dúvidas e sintomas
                </p>
              </td></tr>
              <tr><td style="padding:6px 0;">
                <p style="margin:0;font-size:13px;color:${CORES.textSecondary};line-height:1.6;">
                  <span style="color:${CORES.green};font-weight:700;">✓</span>&nbsp;&nbsp;Esteja em local tranquilo com boa conexão de internet
                </p>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </td></tr>

    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:32px 20px 0;text-align:center;">
    <p style="margin:0 0 8px;font-size:13px;color:${CORES.textMuted};font-weight:500;">
      Be4Hope — Cuidar de quem cuida é nosso ato de amor 💚
    </p>
    <p style="margin:0 0 4px;font-size:11px;color:${CORES.textMuted};">
      Dúvidas? Responda este e-mail ou entre em contato pelo nosso suporte.
    </p>
    <p style="margin:8px 0 0;font-size:11px;color:#cccccc;">
      Este é um e-mail automático. Por favor, não descarte.
    </p>
  </td></tr>

</table>
</td></tr></table>

</body>
</html>`;

  const client = criarClienteBrevo();
  await client.transactionalEmails.sendTransacEmail({
    subject: `✅ Consulta confirmada — ${dataFormatada} às ${horaFormatada}`,
    htmlContent: html,
    sender: { name: 'Be4Hope', email: process.env.BREVO_FROM_EMAIL ?? 'tech@be4hope.org' },
    to: [{ email: params.pacienteEmail, name: params.pacienteNome }],
  });
}

// ── E-mail: Consulta Remarcada (Template Premium) ─────────────

export async function enviarEmailConsultaRemarcada(params: {
  pacienteNome: string;
  pacienteEmail: string;
  medicoNome: string;
  dataHoraAnterior: Date;
  dataHoraNova: Date;
}): Promise<void> {
  const dataAnteriorFormatada = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(params.dataHoraAnterior);

  const dataNovaFormatada = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  }).format(params.dataHoraNova);

  const horaNovaFormatada = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit', minute: '2-digit',
  }).format(params.dataHoraNova);

  const primeiroNome = escapeHtml(params.pacienteNome.split(' ')[0]);
  const medicoNomeEscapado = escapeHtml(params.medicoNome);

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Consulta Remarcada — Be4Hope</title>
</head>
<body style="margin:0;padding:0;background:#f4f1ed;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ed;">
<tr><td style="padding:40px 16px;">
<table align="center" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;margin:0 auto;">

  <!-- Logo -->
  <tr><td align="center" style="padding:0 0 32px;">
    <img src="${LOGO_URL()}" alt="Be4Hope" width="140" style="display:block;border:0;max-width:140px;">
  </td></tr>

  <!-- Card principal -->
  <tr><td style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
    <table width="100%" cellpadding="0" cellspacing="0">

      <!-- Header com gradiente dourado -->
      <tr><td style="background:linear-gradient(135deg,${CORES.gold} 0%,#d4a84a 50%,#b8892e 100%);padding:40px 36px 32px;text-align:center;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td align="center">
            <div style="display:inline-block;width:72px;height:72px;border-radius:50%;background:rgba(255,255,255,0.2);text-align:center;line-height:72px;font-size:36px;margin-bottom:16px;">🔄</div>
          </td></tr>
          <tr><td align="center">
            <h1 style="margin:0 0 8px;font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Consulta Remarcada</h1>
            <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.9);font-weight:400;">Sua consulta foi reagendada para uma nova data</p>
          </td></tr>
        </table>
      </td></tr>

      <!-- Saudação -->
      <tr><td style="padding:32px 36px 0;">
        <p style="margin:0;font-size:16px;color:${CORES.textPrimary};line-height:1.7;">
          Olá, <strong>${primeiroNome}</strong>! 👋
        </p>
        <p style="margin:8px 0 0;font-size:15px;color:${CORES.textSecondary};line-height:1.7;">
          Sua consulta com <strong style="color:${CORES.textPrimary};">Dr(a). ${medicoNomeEscapado}</strong> foi remarcada. Veja a nova data abaixo:
        </p>
      </td></tr>

      <!-- Card de detalhes -->
      <tr><td style="padding:24px 36px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f5;border-radius:16px;border:1px solid ${CORES.cardBorder};overflow:hidden;">

          <!-- Data anterior (riscada) -->
          <tr><td style="padding:20px 24px 16px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="40" valign="top">
                  <div style="width:40px;height:40px;border-radius:12px;background:${CORES.redBg};text-align:center;line-height:40px;font-size:18px;">📅</div>
                </td>
                <td style="padding-left:14px;">
                  <p style="margin:0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:${CORES.textMuted};">Data Anterior</p>
                  <p style="margin:4px 0 0;font-size:15px;color:${CORES.textMuted};text-decoration:line-through;">${dataAnteriorFormatada}</p>
                </td>
              </tr>
            </table>
          </td></tr>

          <!-- Divider -->
          <tr><td style="padding:0 24px;"><div style="border-top:1px solid ${CORES.divider};"></div></td></tr>

          <!-- Nova data -->
          <tr><td style="padding:16px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="40" valign="top">
                  <div style="width:40px;height:40px;border-radius:12px;background:${CORES.greenBg};text-align:center;line-height:40px;font-size:18px;">✅</div>
                </td>
                <td style="padding-left:14px;">
                  <p style="margin:0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:${CORES.green};">Nova Data</p>
                  <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:${CORES.green};">${dataNovaFormatada}</p>
                </td>
              </tr>
            </table>
          </td></tr>

          <!-- Divider -->
          <tr><td style="padding:0 24px;"><div style="border-top:1px solid ${CORES.divider};"></div></td></tr>

          <!-- Horário -->
          <tr><td style="padding:16px 24px 20px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="40" valign="top">
                  <div style="width:40px;height:40px;border-radius:12px;background:#eef0ff;text-align:center;line-height:40px;font-size:18px;">⏰</div>
                </td>
                <td style="padding-left:14px;">
                  <p style="margin:0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:${CORES.textMuted};">Novo Horário</p>
                  <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:${CORES.textPrimary};">${horaNovaFormatada}</p>
                </td>
              </tr>
            </table>
          </td></tr>

        </table>
      </td></tr>

      <!-- Aviso -->
      <tr><td style="padding:0 36px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#fdf8f0 0%,#f8f4ee 100%);border-radius:16px;border:1px solid ${CORES.cardBorder};">
          <tr><td style="padding:20px 24px;">
            <p style="margin:0;font-size:13px;color:${CORES.textSecondary};line-height:1.7;">
              💡 <strong style="color:${CORES.textPrimary};">Importante:</strong> O link do Google Meet e o evento na sua agenda serão atualizados automaticamente. Não é necessário nenhuma ação adicional da sua parte.
            </p>
          </td></tr>
        </table>
      </td></tr>

    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:32px 20px 0;text-align:center;">
    <p style="margin:0 0 8px;font-size:13px;color:${CORES.textMuted};font-weight:500;">
      Be4Hope — Cuidar de quem cuida é nosso ato de amor 💚
    </p>
    <p style="margin:0 0 4px;font-size:11px;color:${CORES.textMuted};">
      Dúvidas? Responda este e-mail ou entre em contato pelo nosso suporte.
    </p>
    <p style="margin:8px 0 0;font-size:11px;color:#cccccc;">
      Este é um e-mail automático. Por favor, não descarte.
    </p>
  </td></tr>

</table>
</td></tr></table>

</body>
</html>`;

  const client = criarClienteBrevo();
  await client.transactionalEmails.sendTransacEmail({
    subject: `🔄 Consulta remarcada — ${dataNovaFormatada} às ${horaNovaFormatada}`,
    htmlContent: html,
    sender: { name: 'Be4Hope', email: process.env.BREVO_FROM_EMAIL ?? 'tech@be4hope.org' },
    to: [{ email: params.pacienteEmail, name: params.pacienteNome }],
  });
}

// ── E-mail: Consulta Cancelada (Template Premium) ─────────────

export async function enviarEmailConsultaCancelada(params: {
  pacienteNome: string;
  pacienteEmail: string;
  medicoNome: string;
  dataHora: Date;
  motivo: string;
}): Promise<void> {
  const dataFormatada = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  }).format(params.dataHora);

  const horaFormatada = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit', minute: '2-digit',
  }).format(params.dataHora);

  const primeiroNome = escapeHtml(params.pacienteNome.split(' ')[0]);
  const medicoNomeEscapado = escapeHtml(params.medicoNome);
  const motivoEscapado = escapeHtml(params.motivo);

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Consulta Cancelada — Be4Hope</title>
</head>
<body style="margin:0;padding:0;background:#f4f1ed;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ed;">
<tr><td style="padding:40px 16px;">
<table align="center" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;margin:0 auto;">

  <!-- Logo -->
  <tr><td align="center" style="padding:0 0 32px;">
    <img src="${LOGO_URL()}" alt="Be4Hope" width="140" style="display:block;border:0;max-width:140px;">
  </td></tr>

  <!-- Card principal -->
  <tr><td style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
    <table width="100%" cellpadding="0" cellspacing="0">

      <!-- Header com gradiente vermelho -->
      <tr><td style="background:linear-gradient(135deg,${CORES.red} 0%,#c0392b 50%,#962d22 100%);padding:40px 36px 32px;text-align:center;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td align="center">
            <div style="display:inline-block;width:72px;height:72px;border-radius:50%;background:rgba(255,255,255,0.2);text-align:center;line-height:72px;font-size:36px;margin-bottom:16px;">😔</div>
          </td></tr>
          <tr><td align="center">
            <h1 style="margin:0 0 8px;font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Consulta Cancelada</h1>
            <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.9);font-weight:400;">Infelizmente sua consulta foi cancelada</p>
          </td></tr>
        </table>
      </td></tr>

      <!-- Saudação -->
      <tr><td style="padding:32px 36px 0;">
        <p style="margin:0;font-size:16px;color:${CORES.textPrimary};line-height:1.7;">
          Olá, <strong>${primeiroNome}</strong>.
        </p>
        <p style="margin:8px 0 0;font-size:15px;color:${CORES.textSecondary};line-height:1.7;">
          Lamentamos informar que sua consulta com <strong style="color:${CORES.textPrimary};">Dr(a). ${medicoNomeEscapado}</strong> foi cancelada. Veja os detalhes abaixo:
        </p>
      </td></tr>

      <!-- Card de detalhes -->
      <tr><td style="padding:24px 36px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f5;border-radius:16px;border:1px solid ${CORES.cardBorder};overflow:hidden;">

          <!-- Médico -->
          <tr><td style="padding:20px 24px 16px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="40" valign="top">
                  <div style="width:40px;height:40px;border-radius:12px;background:${CORES.greenBg};text-align:center;line-height:40px;font-size:18px;">🩺</div>
                </td>
                <td style="padding-left:14px;">
                  <p style="margin:0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:${CORES.textMuted};">Profissional</p>
                  <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:${CORES.textPrimary};">Dr(a). ${medicoNomeEscapado}</p>
                </td>
              </tr>
            </table>
          </td></tr>

          <!-- Divider -->
          <tr><td style="padding:0 24px;"><div style="border-top:1px solid ${CORES.divider};"></div></td></tr>

          <!-- Data cancelada -->
          <tr><td style="padding:16px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="40" valign="top">
                  <div style="width:40px;height:40px;border-radius:12px;background:${CORES.redBg};text-align:center;line-height:40px;font-size:18px;">📅</div>
                </td>
                <td style="padding-left:14px;">
                  <p style="margin:0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:${CORES.textMuted};">Data da Consulta</p>
                  <p style="margin:4px 0 0;font-size:15px;color:${CORES.textMuted};text-decoration:line-through;">${dataFormatada} às ${horaFormatada}</p>
                </td>
              </tr>
            </table>
          </td></tr>

          <!-- Divider -->
          <tr><td style="padding:0 24px;"><div style="border-top:1px solid ${CORES.divider};"></div></td></tr>

          <!-- Motivo -->
          <tr><td style="padding:16px 24px 20px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="40" valign="top">
                  <div style="width:40px;height:40px;border-radius:12px;background:#fff3e0;text-align:center;line-height:40px;font-size:18px;">💬</div>
                </td>
                <td style="padding-left:14px;">
                  <p style="margin:0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:${CORES.textMuted};">Motivo do Cancelamento</p>
                  <p style="margin:4px 0 0;font-size:15px;font-weight:600;color:${CORES.red};line-height:1.6;">${motivoEscapado}</p>
                </td>
              </tr>
            </table>
          </td></tr>

        </table>
      </td></tr>

      <!-- Botão reagendar -->
      <tr><td style="padding:8px 36px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td align="center">
            <a href="${APP_URL()}/agendamento" target="_blank" style="display:inline-block;background:${CORES.gold};color:#ffffff;font-size:16px;font-weight:700;padding:16px 48px;border-radius:14px;text-decoration:none;letter-spacing:0.3px;box-shadow:0 4px 14px rgba(192,142,58,0.35);">
              📅&nbsp;&nbsp;Reagendar Consulta
            </a>
          </td></tr>
          <tr><td align="center" style="padding-top:10px;">
            <p style="margin:0;font-size:12px;color:${CORES.textMuted};">
              Clique acima para agendar uma nova data
            </p>
          </td></tr>
        </table>
      </td></tr>

      <!-- Mensagem de apoio -->
      <tr><td style="padding:0 36px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#fdf8f0 0%,#f8f4ee 100%);border-radius:16px;border:1px solid ${CORES.cardBorder};">
          <tr><td style="padding:20px 24px;">
            <p style="margin:0;font-size:13px;color:${CORES.textSecondary};line-height:1.7;">
              💚 <strong style="color:${CORES.textPrimary};">Estamos aqui por você.</strong> Sabemos que imprevistos acontecem. Não se preocupe — você pode reagendar sua consulta a qualquer momento pelo botão acima ou diretamente pelo nosso site.
            </p>
          </td></tr>
        </table>
      </td></tr>

    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:32px 20px 0;text-align:center;">
    <p style="margin:0 0 8px;font-size:13px;color:${CORES.textMuted};font-weight:500;">
      Be4Hope — Cuidar de quem cuida é nosso ato de amor 💚
    </p>
    <p style="margin:0 0 4px;font-size:11px;color:${CORES.textMuted};">
      Dúvidas? Responda este e-mail ou entre em contato pelo nosso suporte.
    </p>
    <p style="margin:8px 0 0;font-size:11px;color:#cccccc;">
      Este é um e-mail automático. Por favor, não descarte.
    </p>
  </td></tr>

</table>
</td></tr></table>

</body>
</html>`;

  const client = criarClienteBrevo();
  await client.transactionalEmails.sendTransacEmail({
    subject: `❌ Consulta cancelada — ${dataFormatada} às ${horaFormatada}`,
    htmlContent: html,
    sender: { name: 'Be4Hope', email: process.env.BREVO_FROM_EMAIL ?? 'tech@be4hope.org' },
    to: [{ email: params.pacienteEmail, name: params.pacienteNome }],
  });
}

// ── E-mail: Notificação ao Médico — Consulta Agendada ─────────

export async function enviarEmailConsultaMedico(params: {
  medicoNome: string;
  medicoEmail: string;
  pacienteNome: string;
  pacienteEmail: string;
  dataHora: Date;
  meetLink: string | null;
  tipo?: string;
}): Promise<void> {
  const dataFormatada = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  }).format(params.dataHora);

  const horaFormatada = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit', minute: '2-digit',
  }).format(params.dataHora);

  const tipoLabel =
    params.tipo === 'retorno' ? 'Retorno' :
    params.tipo === 'urgencia' ? 'Urgência ⚠️' :
    'Consulta';

  const primeiroNomeMedico = escapeHtml(params.medicoNome.split(' ')[0]);
  const pacienteNomeEscapado = escapeHtml(params.pacienteNome);

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Nova Consulta Agendada — Be4Hope</title>
</head>
<body style="margin:0;padding:0;background:#f4f1ed;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ed;">
<tr><td style="padding:40px 16px;">
<table align="center" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;margin:0 auto;">

  <!-- Logo -->
  <tr><td align="center" style="padding:0 0 32px;">
    <img src="${LOGO_URL()}" alt="Be4Hope" width="140" style="display:block;border:0;max-width:140px;">
  </td></tr>

  <!-- Card principal -->
  <tr><td style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
    <table width="100%" cellpadding="0" cellspacing="0">

      <!-- Header com gradiente violeta/indigo (identidade médica) -->
      <tr><td style="background:linear-gradient(135deg,#5b21b6 0%,#7c3aed 50%,#4f46e5 100%);padding:40px 36px 32px;text-align:center;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td align="center">
            <div style="display:inline-block;width:72px;height:72px;border-radius:50%;background:rgba(255,255,255,0.2);text-align:center;line-height:72px;font-size:36px;margin-bottom:16px;">📋</div>
          </td></tr>
          <tr><td align="center">
            <h1 style="margin:0 0 8px;font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Nova Consulta Agendada</h1>
            <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.9);font-weight:400;">Você tem uma nova consulta confirmada</p>
          </td></tr>
        </table>
      </td></tr>

      <!-- Saudação -->
      <tr><td style="padding:32px 36px 0;">
        <p style="margin:0;font-size:16px;color:${CORES.textPrimary};line-height:1.7;">
          Olá, <strong>${primeiroNomeMedico}</strong>! 👋
        </p>
        <p style="margin:8px 0 0;font-size:15px;color:${CORES.textSecondary};line-height:1.7;">
          Uma nova consulta foi agendada na sua agenda. Confira os detalhes abaixo:
        </p>
      </td></tr>

      <!-- Card de detalhes -->
      <tr><td style="padding:24px 36px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f5;border-radius:16px;border:1px solid ${CORES.cardBorder};overflow:hidden;">

          <!-- Tipo de consulta -->
          <tr><td style="padding:20px 24px 16px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="40" valign="top">
                  <div style="width:40px;height:40px;border-radius:12px;background:#ede9fe;text-align:center;line-height:40px;font-size:18px;">🏷️</div>
                </td>
                <td style="padding-left:14px;">
                  <p style="margin:0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:${CORES.textMuted};">Tipo</p>
                  <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#5b21b6;">${tipoLabel}</p>
                </td>
              </tr>
            </table>
          </td></tr>

          <!-- Divider -->
          <tr><td style="padding:0 24px;"><div style="border-top:1px solid ${CORES.divider};"></div></td></tr>

          <!-- Paciente -->
          <tr><td style="padding:16px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="40" valign="top">
                  <div style="width:40px;height:40px;border-radius:12px;background:${CORES.greenBg};text-align:center;line-height:40px;font-size:18px;">👤</div>
                </td>
                <td style="padding-left:14px;">
                  <p style="margin:0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:${CORES.textMuted};">Paciente</p>
                  <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:${CORES.textPrimary};">${pacienteNomeEscapado}</p>
                  <p style="margin:2px 0 0;font-size:12px;color:${CORES.textMuted};">${escapeHtml(params.pacienteEmail)}</p>
                </td>
              </tr>
            </table>
          </td></tr>

          <!-- Divider -->
          <tr><td style="padding:0 24px;"><div style="border-top:1px solid ${CORES.divider};"></div></td></tr>

          <!-- Data -->
          <tr><td style="padding:16px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="40" valign="top">
                  <div style="width:40px;height:40px;border-radius:12px;background:${CORES.goldBg};text-align:center;line-height:40px;font-size:18px;">📅</div>
                </td>
                <td style="padding-left:14px;">
                  <p style="margin:0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:${CORES.textMuted};">Data</p>
                  <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:${CORES.textPrimary};">${dataFormatada}</p>
                </td>
              </tr>
            </table>
          </td></tr>

          <!-- Divider -->
          <tr><td style="padding:0 24px;"><div style="border-top:1px solid ${CORES.divider};"></div></td></tr>

          <!-- Horário -->
          <tr><td style="padding:16px 24px 20px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="40" valign="top">
                  <div style="width:40px;height:40px;border-radius:12px;background:#eef0ff;text-align:center;line-height:40px;font-size:18px;">⏰</div>
                </td>
                <td style="padding-left:14px;">
                  <p style="margin:0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:${CORES.textMuted};">Horário</p>
                  <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:${CORES.textPrimary};">${horaFormatada} — duração de 1 hora</p>
                </td>
              </tr>
            </table>
          </td></tr>

        </table>
      </td></tr>

      ${params.meetLink ? `
      <!-- Botão Google Meet -->
      <tr><td style="padding:8px 36px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td align="center">
            <a href="${params.meetLink}" target="_blank" style="display:inline-block;background:#1a73e8;color:#ffffff;font-size:16px;font-weight:700;padding:16px 48px;border-radius:14px;text-decoration:none;letter-spacing:0.3px;box-shadow:0 4px 14px rgba(26,115,232,0.35);">
              📹&nbsp;&nbsp;Acessar Google Meet
            </a>
          </td></tr>
          <tr><td align="center" style="padding-top:10px;">
            <p style="margin:0;font-size:12px;color:${CORES.textMuted};">
              Link da reunião — disponível para uso no horário agendado
            </p>
          </td></tr>
        </table>
      </td></tr>
      ` : ''}

      <!-- Acesso rápido à agenda -->
      <tr><td style="padding:0 36px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#f5f3ff 0%,#ede9fe 100%);border-radius:16px;border:1px solid #ddd6fe;">
          <tr><td style="padding:20px 24px;">
            <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#5b21b6;">📌 Acesso rápido</p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="padding:5px 0;">
                <p style="margin:0;font-size:13px;color:${CORES.textSecondary};line-height:1.6;">
                  <span style="color:#5b21b6;font-weight:700;">→</span>&nbsp;&nbsp;
                  <a href="${APP_URL()}/medico/agenda" style="color:#5b21b6;text-decoration:none;font-weight:600;">Ver sua agenda completa</a>
                </p>
              </td></tr>
              <tr><td style="padding:5px 0;">
                <p style="margin:0;font-size:13px;color:${CORES.textSecondary};line-height:1.6;">
                  <span style="color:#5b21b6;font-weight:700;">→</span>&nbsp;&nbsp;
                  <a href="${APP_URL()}/medico/pacientes" style="color:#5b21b6;text-decoration:none;font-weight:600;">Ver prontuário do paciente</a>
                </p>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </td></tr>

    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:32px 20px 0;text-align:center;">
    <p style="margin:0 0 8px;font-size:13px;color:${CORES.textMuted};font-weight:500;">
      Be4Hope — Cuidar de quem cuida é nosso ato de amor 💚
    </p>
    <p style="margin:0 0 4px;font-size:11px;color:${CORES.textMuted};">
      Este e-mail foi gerado automaticamente pelo sistema Be4Hope.
    </p>
    <p style="margin:8px 0 0;font-size:11px;color:#cccccc;">
      Você recebe este e-mail por ser um profissional cadastrado na plataforma.
    </p>
  </td></tr>

</table>
</td></tr></table>

</body>
</html>`;

  const client = criarClienteBrevo();
  await client.transactionalEmails.sendTransacEmail({
    subject: `📋 Nova consulta — ${pacienteNomeEscapado} em ${dataFormatada} às ${horaFormatada}`,
    htmlContent: html,
    sender: { name: 'Be4Hope', email: process.env.BREVO_FROM_EMAIL ?? 'tech@be4hope.org' },
    to: [{ email: params.medicoEmail, name: params.medicoNome }],
  });
}

// ── E-mail: Notificação ao Médico — Consulta Cancelada ────────

export async function enviarEmailCancelamentoMedico(params: {
  medicoNome: string;
  medicoEmail: string;
  pacienteNome: string;
  dataHora: Date;
  motivo: string;
}): Promise<void> {
  const primeiroNomeMedico = escapeHtml(params.medicoNome.split(' ')[0]);
  const pacienteNomeEscapado = escapeHtml(params.pacienteNome);
  const motivoEscapado = escapeHtml(params.motivo);
  const dataHoraFormatada = formatarData(params.dataHora);

  const corpo = `
    <p style="margin:0 0 20px;font-size:14px;color:${CORES.textSecondary};text-align:center;line-height:1.6;">
      Olá, <strong>${primeiroNomeMedico}</strong>. Uma consulta foi cancelada na sua agenda.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr><td style="background:${CORES.bg};border-radius:12px;padding:20px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:8px 0;border-bottom:1px solid ${CORES.divider};">
            <p style="margin:0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:${CORES.textMuted};">Paciente</p>
            <p style="margin:4px 0 0;font-size:15px;font-weight:700;color:${CORES.textPrimary};">${pacienteNomeEscapado}</p>
          </td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid ${CORES.divider};">
            <p style="margin:0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:${CORES.textMuted};">Data da Consulta</p>
            <p style="margin:4px 0 0;font-size:14px;color:${CORES.textSecondary};text-decoration:line-through;">${dataHoraFormatada}</p>
          </td></tr>
          <tr><td style="padding:8px 0 0;">
            <p style="margin:0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:${CORES.textMuted};">Motivo do Cancelamento</p>
            <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:${CORES.red};">${motivoEscapado}</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
      <a href="${APP_URL()}/medico/agenda" style="display:inline-block;background:${CORES.gold};color:#fff;font-size:13px;font-weight:600;padding:12px 28px;border-radius:50px;text-decoration:none;">📅 Ver Agenda</a>
    </td></tr></table>`;

  const html = templateBase({
    emoji: '🚫',
    badge: 'Consulta cancelada',
    badgeCor: CORES.redBg,
    titulo: 'Consulta Cancelada',
    corpo,
  });

  const client = criarClienteBrevo();
  await client.transactionalEmails.sendTransacEmail({
    subject: `🚫 Consulta cancelada — ${pacienteNomeEscapado} (${dataHoraFormatada})`,
    htmlContent: html,
    sender: { name: 'Be4Hope', email: process.env.BREVO_FROM_EMAIL ?? 'tech@be4hope.org' },
    to: [{ email: params.medicoEmail, name: params.medicoNome }],
  });
}

export async function enviarEmailTeleconsultaIniciada(params: {
  pacienteNome: string;
  pacienteEmail: string;
  medicoNome: string;
  linkSala: string;
}): Promise<void> {
  const primeiroNome = escapeHtml(params.pacienteNome.split(' ')[0]);
  const medicoNomeEscapado = escapeHtml(params.medicoNome);
  const horaAtual = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit', minute: '2-digit',
  }).format(new Date());

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Teleconsulta Iniciada — Be4Hope</title>
</head>
<body style="margin:0;padding:0;background:#f4f1ed;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ed;">
<tr><td style="padding:40px 16px;">
<table align="center" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;margin:0 auto;">

  <!-- Logo -->
  <tr><td align="center" style="padding:0 0 32px;">
    <img src="${APP_URL()}/logo.png" alt="Be4Hope" width="140" style="display:block;border:0;max-width:140px;">
  </td></tr>

  <!-- Card principal -->
  <tr><td style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
    <table width="100%" cellpadding="0" cellspacing="0">

      <!-- Header vermelho urgente -->
      <tr><td style="background:linear-gradient(135deg,#EF4444 0%,#DC2626 50%,#B91C1C 100%);padding:40px 36px 32px;text-align:center;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td align="center">
            <div style="display:inline-block;width:72px;height:72px;border-radius:50%;background:rgba(255,255,255,0.2);text-align:center;line-height:72px;font-size:36px;margin-bottom:16px;">🔴</div>
          </td></tr>
          <tr><td align="center">
            <h1 style="margin:0 0 8px;font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Teleconsulta Começando!</h1>
            <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.9);">Dr(a). ${medicoNomeEscapado} está aguardando você agora</p>
          </td></tr>
        </table>
      </td></tr>

      <!-- Saudação -->
      <tr><td style="padding:32px 36px 0;">
        <p style="margin:0;font-size:16px;color:#1a1a1a;line-height:1.7;">
          Olá, <strong>${primeiroNome}</strong>! 👋
        </p>
        <p style="margin:8px 0 0;font-size:15px;color:#666666;line-height:1.7;">
          Seu médico iniciou a teleconsulta. Entre agora para não perder sua consulta!
        </p>
      </td></tr>

      <!-- Card detalhes -->
      <tr><td style="padding:24px 36px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f5;border-radius:16px;border:1px solid #ece8e3;overflow:hidden;">
          <tr><td style="padding:20px 24px 16px;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td width="40"><div style="width:40px;height:40px;border-radius:12px;background:#e8f8f0;text-align:center;line-height:40px;font-size:18px;">🩺</div></td>
                <td style="padding-left:14px;">
                  <p style="margin:0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#999;">Médico</p>
                  <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#1a1a1a;">Dr(a). ${medicoNomeEscapado}</p>
                </td>
              </tr>
            </table>
          </td></tr>
          <tr><td style="padding:0 24px;"><div style="border-top:1px solid #eee9e3;"></div></td></tr>
          <tr><td style="padding:16px 24px;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td width="40"><div style="width:40px;height:40px;border-radius:12px;background:#fdf6ec;text-align:center;line-height:40px;font-size:18px;">⏰</div></td>
                <td style="padding-left:14px;">
                  <p style="margin:0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#999;">Horário</p>
                  <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#EF4444;">Agora — ${horaAtual}</p>
                </td>
              </tr>
            </table>
          </td></tr>
          <tr><td style="padding:0 24px;"><div style="border-top:1px solid #eee9e3;"></div></td></tr>
          <tr><td style="padding:16px 24px 20px;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td width="40"><div style="width:40px;height:40px;border-radius:12px;background:#fef3f2;text-align:center;line-height:40px;font-size:18px;">💻</div></td>
                <td style="padding-left:14px;">
                  <p style="margin:0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#999;">Plataforma</p>
                  <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#1a1a1a;">Be4Hope — Online</p>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>
      </td></tr>

      <!-- Botão ENTRAR (laranja Be4Hope) -->
      <tr><td style="padding:8px 36px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td align="center">
            <a href="${params.linkSala}" target="_blank"
               style="display:inline-block;background:#EA5429;color:#ffffff;font-size:17px;font-weight:800;padding:18px 52px;border-radius:14px;text-decoration:none;letter-spacing:0.3px;box-shadow:0 4px 20px rgba(234,84,41,0.4);">
              📹&nbsp;&nbsp;Entrar na Consulta Agora
            </a>
          </td></tr>
          <tr><td align="center" style="padding-top:12px;">
            <p style="margin:0;font-size:12px;color:#999999;">
              ⚠️ Este link é exclusivo para você e expira quando a consulta encerrar
            </p>
          </td></tr>
        </table>
      </td></tr>

    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:32px 20px 0;text-align:center;">
    <p style="margin:0 0 8px;font-size:13px;color:#999999;font-weight:500;">
      Be4Hope — Cuidar de quem cuida é nosso ato de amor 💚
    </p>
  </td></tr>

</table>
</td></tr></table>
</body>
</html>`;

  const client = criarClienteBrevo();
  await client.transactionalEmails.sendTransacEmail({
    subject: `🔴 Sua teleconsulta está começando agora — Dr(a). ${params.medicoNome}`,
    htmlContent: html,
    sender: { name: 'Be4Hope', email: process.env.BREVO_FROM_EMAIL ?? 'tech@be4hope.org' },
    to: [{ email: params.pacienteEmail, name: params.pacienteNome }],
  });
}
