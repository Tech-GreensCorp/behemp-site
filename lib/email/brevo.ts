/**
 * Serviço de envio de e-mail via Brevo API v5.
 * Templates com identidade visual premium Be4Hope.
 */

import { BrevoClient } from '@getbrevo/brevo';

// ── Configuração ───────────────────────────────────────────────

function criarClienteBrevo() {
  return new BrevoClient({ apiKey: process.env.BREVO_API_KEY! });
}

const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const LOGO_URL = () => `${APP_URL()}/logo.png`;

// ── Types ──────────────────────────────────────────────────────

export interface DadosContatoEmail {
  nome: string;
  email: string;
  assunto: string;
  mensagem: string;
}

// ── Cores & Design Tokens ──────────────────────────────────────

const CORES = {
  primary: '#c0392b',
  primaryDark: '#a93226',
  bg: '#f7f5f2',
  cardBg: '#ffffff',
  cardBorder: '#ece8e3',
  textPrimary: '#1a1a1a',
  textSecondary: '#666666',
  textMuted: '#999999',
  accent: '#f4e9e2',
  divider: '#eee9e3',
  green: '#27ae60',
  greenBg: '#e8f8f0',
};

// ── Helper: escape HTML ────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Template: Notificação Admin ────────────────────────────────

function templateNotificacaoAdmin(dados: DadosContatoEmail): string {
  const dataFormatada = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date());

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Nova mensagem — Be4Hope</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${CORES.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">

  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:${CORES.bg};">
    <tr>
      <td style="padding:32px 16px;">
        <table align="center" width="560" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;width:100%;margin:0 auto;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding:0 0 24px;">
              <img src="${LOGO_URL()}" alt="Be4Hope" width="120" height="auto" style="display:block;border:0;outline:none;max-width:120px;" />
            </td>
          </tr>

          <!-- Card principal -->
          <tr>
            <td style="background-color:${CORES.cardBg};border-radius:16px;border:1px solid ${CORES.cardBorder};overflow:hidden;">

              <!-- Header do card -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="background:linear-gradient(135deg, ${CORES.primary} 0%, ${CORES.primaryDark} 100%);padding:32px 36px 28px;">
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td>
                          <table cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:12px;">
                            <tr>
                              <td style="background:rgba(255,255,255,0.18);border-radius:20px;padding:4px 14px;">
                                <span style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#ffffff;">📩 Nova mensagem</span>
                              </td>
                            </tr>
                          </table>
                          <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;line-height:1.35;">
                            ${escapeHtml(dados.nome)} enviou uma mensagem
                          </h1>
                          <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.75);">
                            ${dataFormatada}
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Corpo -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="padding:28px 36px 32px;">

                    <!-- Info do remetente -->
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px;">
                      <tr>
                        <td style="background:${CORES.accent};border-radius:12px;padding:16px 20px;">
                          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                            <tr>
                              <td width="44" valign="top">
                                <div style="width:40px;height:40px;border-radius:50%;background:${CORES.primary};text-align:center;line-height:40px;font-size:16px;font-weight:700;color:#ffffff;">
                                  ${dados.nome.charAt(0).toUpperCase()}
                                </div>
                              </td>
                              <td style="padding-left:14px;" valign="middle">
                                <p style="margin:0;font-size:15px;font-weight:600;color:${CORES.textPrimary};">${escapeHtml(dados.nome)}</p>
                                <p style="margin:2px 0 0;font-size:13px;color:${CORES.textSecondary};">
                                  <a href="mailto:${escapeHtml(dados.email)}" style="color:${CORES.primary};text-decoration:none;">${escapeHtml(dados.email)}</a>
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- Assunto -->
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:20px;">
                      <tr>
                        <td>
                          <p style="margin:0 0 6px;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${CORES.textMuted};">Assunto</p>
                          <p style="margin:0;font-size:16px;font-weight:600;color:${CORES.textPrimary};line-height:1.4;">${escapeHtml(dados.assunto)}</p>
                        </td>
                      </tr>
                    </table>

                    <!-- Divider -->
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:20px;">
                      <tr>
                        <td style="border-top:1px solid ${CORES.divider};"></td>
                      </tr>
                    </table>

                    <!-- Mensagem -->
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:28px;">
                      <tr>
                        <td>
                          <p style="margin:0 0 10px;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${CORES.textMuted};">Mensagem</p>
                          <div style="background:${CORES.bg};border-radius:12px;padding:18px 22px;border-left:3px solid ${CORES.primary};">
                            <p style="margin:0;font-size:14px;line-height:1.75;color:${CORES.textPrimary};white-space:pre-wrap;">${escapeHtml(dados.mensagem)}</p>
                          </div>
                        </td>
                      </tr>
                    </table>

                    <!-- Botões de ação -->
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td align="center">
                          <table cellpadding="0" cellspacing="0" role="presentation">
                            <tr>
                              <!-- Botão Responder -->
                              <td style="padding-right:10px;">
                                <a href="mailto:${escapeHtml(dados.email)}?subject=Re: ${encodeURIComponent(dados.assunto)}"
                                   style="display:inline-block;background:${CORES.primary};color:#ffffff;font-size:13px;font-weight:600;padding:12px 24px;border-radius:50px;text-decoration:none;letter-spacing:0.02em;">
                                  ↩ Responder por e-mail
                                </a>
                              </td>
                              <!-- Botão Admin -->
                              <td>
                                <a href="${APP_URL()}/admin/mensagens"
                                   style="display:inline-block;background:${CORES.bg};color:${CORES.textPrimary};font-size:13px;font-weight:600;padding:12px 24px;border-radius:50px;text-decoration:none;border:1px solid ${CORES.divider};letter-spacing:0.02em;">
                                  Ver no painel →
                                </a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:28px 0 0;text-align:center;">
              <p style="margin:0 0 4px;font-size:12px;color:${CORES.textMuted};">
                Be4Hope — Cuidar de quem cuida é nosso ato de amor
              </p>
              <p style="margin:0;font-size:11px;color:${CORES.textMuted};">
                Esta é uma notificação automática do formulário de contato.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Template: Confirmação para o Usuário ───────────────────────

function templateConfirmacaoUsuario(dados: DadosContatoEmail): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Mensagem recebida — Be4Hope</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${CORES.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">

  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:${CORES.bg};">
    <tr>
      <td style="padding:32px 16px;">
        <table align="center" width="560" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;width:100%;margin:0 auto;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding:0 0 24px;">
              <img src="${LOGO_URL()}" alt="Be4Hope" width="120" height="auto" style="display:block;border:0;outline:none;max-width:120px;" />
            </td>
          </tr>

          <!-- Card principal -->
          <tr>
            <td style="background-color:${CORES.cardBg};border-radius:16px;border:1px solid ${CORES.cardBorder};overflow:hidden;">

              <!-- Ilustração de confirmação -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="padding:40px 36px 8px;text-align:center;">
                    <div style="display:inline-block;width:64px;height:64px;border-radius:50%;background:${CORES.greenBg};text-align:center;line-height:64px;font-size:30px;">
                      💚
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Corpo -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="padding:16px 36px 36px;">

                    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${CORES.textPrimary};text-align:center;line-height:1.35;">
                      Recebemos sua mensagem!
                    </h1>
                    <p style="margin:0 0 28px;font-size:14px;color:${CORES.textSecondary};text-align:center;line-height:1.6;">
                      Olá, <strong style="color:${CORES.textPrimary};">${escapeHtml(dados.nome)}</strong>! Nossa equipe retornará o contato o mais breve possível.
                    </p>

                    <!-- Resumo -->
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:28px;">
                      <tr>
                        <td style="background:${CORES.bg};border-radius:12px;padding:20px 24px;">
                          <p style="margin:0 0 12px;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${CORES.textMuted};">Resumo do seu contato</p>

                          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                            <tr>
                              <td style="padding:8px 0;border-bottom:1px solid ${CORES.divider};">
                                <p style="margin:0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:${CORES.textMuted};">Assunto</p>
                                <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:${CORES.textPrimary};">${escapeHtml(dados.assunto)}</p>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding:12px 0 0;">
                                <p style="margin:0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:${CORES.textMuted};">Mensagem</p>
                                <p style="margin:4px 0 0;font-size:13px;line-height:1.6;color:${CORES.textSecondary};white-space:pre-wrap;">${escapeHtml(dados.mensagem).length > 200 ? escapeHtml(dados.mensagem).slice(0, 200) + '…' : escapeHtml(dados.mensagem)}</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- Divider -->
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px;">
                      <tr>
                        <td style="border-top:1px solid ${CORES.divider};"></td>
                      </tr>
                    </table>

                    <!-- Canais de urgência -->
                    <p style="margin:0 0 16px;font-size:13px;font-weight:600;color:${CORES.textPrimary};text-align:center;">
                      Precisa de resposta mais rápida?
                    </p>

                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td align="center">
                          <table cellpadding="0" cellspacing="0" role="presentation">
                            <tr>
                              <td style="padding-right:10px;">
                                <a href="https://wa.me/5511932047360"
                                   style="display:inline-block;background:#25D366;color:#ffffff;font-size:13px;font-weight:600;padding:12px 24px;border-radius:50px;text-decoration:none;">
                                  💬 WhatsApp
                                </a>
                              </td>
                              <td>
                                <a href="mailto:tech@be4hope.org"
                                   style="display:inline-block;background:${CORES.bg};color:${CORES.textPrimary};font-size:13px;font-weight:600;padding:12px 24px;border-radius:50px;text-decoration:none;border:1px solid ${CORES.divider};">
                                  ✉ E-mail direto
                                </a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:28px 0 0;text-align:center;">
              <p style="margin:0 0 4px;font-size:12px;color:${CORES.textMuted};">
                Be4Hope — Cuidar de quem cuida é nosso ato de amor
              </p>
              <p style="margin:0;font-size:11px;color:${CORES.textMuted};">
                Você recebeu este e-mail porque preencheu nosso formulário de contato.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Funções de envio ───────────────────────────────────────────

/**
 * Envia e-mail de notificação para o admin da Be4Hope.
 */
export async function enviarEmailNotificacaoAdmin(
  dados: DadosContatoEmail,
): Promise<void> {
  const client = criarClienteBrevo();

  await client.transactionalEmails.sendTransacEmail({
    subject: `[Contato] ${dados.assunto} — ${dados.nome}`,
    htmlContent: templateNotificacaoAdmin(dados),
    sender: {
      name: process.env.BREVO_FROM_NAME ?? 'Be4Hope',
      email: process.env.BREVO_FROM_EMAIL ?? 'tech@be4hope.org',
    },
    to: [
      {
        email: process.env.BREVO_TO_EMAIL ?? 'tech@be4hope.org',
        name: 'Be4Hope',
      },
    ],
    replyTo: { email: dados.email, name: dados.nome },
  });
}

/**
 * Envia e-mail de confirmação para quem enviou o contato.
 */
export async function enviarEmailConfirmacaoUsuario(
  dados: DadosContatoEmail,
): Promise<void> {
  const client = criarClienteBrevo();

  await client.transactionalEmails.sendTransacEmail({
    subject: 'Be4Hope — Recebemos sua mensagem! 💚',
    htmlContent: templateConfirmacaoUsuario(dados),
    sender: {
      name: process.env.BREVO_FROM_NAME ?? 'Be4Hope',
      email: process.env.BREVO_FROM_EMAIL ?? 'tech@be4hope.org',
    },
    to: [{ email: dados.email, name: dados.nome }],
  });
}

// ── Template: Resposta do Admin ao Usuário ─────────────────────

function templateRespostaAdmin(dados: DadosContatoEmail, resposta: string): string {
  const dataFormatada = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date());

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Resposta da Be4Hope</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${CORES.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">

  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:${CORES.bg};">
    <tr>
      <td style="padding:32px 16px;">
        <table align="center" width="560" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;width:100%;margin:0 auto;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding:0 0 24px;">
              <img src="${LOGO_URL()}" alt="Be4Hope" width="120" height="auto" style="display:block;border:0;outline:none;max-width:120px;" />
            </td>
          </tr>

          <!-- Card principal -->
          <tr>
            <td style="background-color:${CORES.cardBg};border-radius:16px;border:1px solid ${CORES.cardBorder};overflow:hidden;">

              <!-- Header -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="background:linear-gradient(135deg, ${CORES.primary} 0%, ${CORES.primaryDark} 100%);padding:32px 36px 28px;">
                    <table cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:12px;">
                      <tr>
                        <td style="background:rgba(255,255,255,0.18);border-radius:20px;padding:4px 14px;">
                          <span style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#ffffff;">✉ Resposta da equipe</span>
                        </td>
                      </tr>
                    </table>
                    <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;line-height:1.35;">
                      Olá, ${escapeHtml(dados.nome)}!
                    </h1>
                    <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.75);">
                      ${dataFormatada}
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Corpo -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="padding:28px 36px 32px;">

                    <!-- Intro -->
                    <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:${CORES.textSecondary};">
                      A equipe Be4Hope respondeu sua mensagem sobre <strong style="color:${CORES.textPrimary};">${escapeHtml(dados.assunto)}</strong>.
                    </p>

                    <!-- Resposta em destaque -->
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:28px;">
                      <tr>
                        <td>
                          <p style="margin:0 0 10px;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${CORES.textMuted};">Nossa resposta</p>
                          <div style="background:${CORES.bg};border-radius:12px;padding:20px 24px;border-left:3px solid ${CORES.primary};">
                            <p style="margin:0;font-size:14px;line-height:1.8;color:${CORES.textPrimary};white-space:pre-wrap;">${escapeHtml(resposta)}</p>
                          </div>
                        </td>
                      </tr>
                    </table>

                    <!-- Divider -->
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:20px;">
                      <tr>
                        <td style="border-top:1px solid ${CORES.divider};"></td>
                      </tr>
                    </table>

                    <!-- Mensagem original -->
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:28px;">
                      <tr>
                        <td>
                          <p style="margin:0 0 10px;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${CORES.textMuted};">Sua mensagem original</p>
                          <div style="background:${CORES.accent};border-radius:12px;padding:16px 20px;opacity:0.85;">
                            <p style="margin:0;font-size:13px;line-height:1.7;color:${CORES.textSecondary};white-space:pre-wrap;">${escapeHtml(dados.mensagem).length > 300 ? escapeHtml(dados.mensagem).slice(0, 300) + '…' : escapeHtml(dados.mensagem)}</p>
                          </div>
                        </td>
                      </tr>
                    </table>

                    <!-- CTA -->
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td align="center">
                          <a href="https://wa.me/5511932047360"
                             style="display:inline-block;background:#25D366;color:#ffffff;font-size:13px;font-weight:600;padding:12px 28px;border-radius:50px;text-decoration:none;letter-spacing:0.02em;">
                            💬 Continuar pelo WhatsApp
                          </a>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:28px 0 0;text-align:center;">
              <p style="margin:0 0 4px;font-size:12px;color:${CORES.textMuted};">
                Be4Hope — Cuidar de quem cuida é nosso ato de amor
              </p>
              <p style="margin:0;font-size:11px;color:${CORES.textMuted};">
                Esta é uma resposta da equipe Be4Hope ao seu formulário de contato.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Envia a resposta do admin diretamente para o e-mail do usuário.
 */
export async function enviarRespostaAdmin(
  dados: DadosContatoEmail,
  resposta: string,
): Promise<void> {
  const client = criarClienteBrevo();

  await client.transactionalEmails.sendTransacEmail({
    subject: `Re: ${dados.assunto} — Be4Hope`,
    htmlContent: templateRespostaAdmin(dados, resposta),
    sender: {
      name: process.env.BREVO_FROM_NAME ?? 'Be4Hope',
      email: process.env.BREVO_FROM_EMAIL ?? 'tech@be4hope.org',
    },
    to: [{ email: dados.email, name: dados.nome }],
    replyTo: {
      email: process.env.BREVO_FROM_EMAIL ?? 'tech@be4hope.org',
      name: process.env.BREVO_FROM_NAME ?? 'Be4Hope',
    },
  });
}

