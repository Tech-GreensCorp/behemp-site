/**
 * Corpo do e-mail de boas-vindas do paciente (ver boas-vindas.ts). Puro de propósito: sem `db`,
 * sem Clerk, sem `next/*` — por isso testável sem ambiente.
 */

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function montarEmailDeBoasVindas(params: { nome: string; link: string }): {
  assunto: string;
  html: string;
} {
  const primeiroNome = params.nome.trim().split(/\s+/)[0] || 'paciente';
  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Bem-vindo à Be4Hope</title></head>
<body style="margin:0;padding:0;background:#f7f5f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:32px 16px;">
<table align="center" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;margin:0 auto;background:#ffffff;border:1px solid #ece8e3;border-radius:16px;">
<tr><td style="padding:36px;">
  <h1 style="margin:0 0 12px;font-size:22px;color:#1a1a1a;text-align:center;">Bem-vindo(a), ${esc(primeiroNome)}!</h1>
  <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#666666;text-align:center;">
    Seu acesso à plataforma Be4Hope foi criado. Para entrar, escolha a sua senha pelo botão abaixo.
  </p>
  <p style="margin:0 0 24px;text-align:center;">
    <a href="${esc(params.link)}" style="display:inline-block;background:#c0392b;color:#ffffff;font-size:14px;font-weight:600;padding:13px 30px;border-radius:50px;text-decoration:none;">Definir minha senha</a>
  </p>
  <p style="margin:0;font-size:12px;line-height:1.6;color:#999999;text-align:center;">
    O link vale por 7 dias e só pode ser usado uma vez. Se ele expirar, use "Esqueci minha senha" na tela de entrada.
    Não pedimos sua senha por e-mail nem por mensagem. Se você não esperava este e-mail, ignore-o.
  </p>
</td></tr></table>
</td></tr></table></body></html>`;
  return { assunto: 'Seu acesso à Be4Hope foi criado', html };
}
