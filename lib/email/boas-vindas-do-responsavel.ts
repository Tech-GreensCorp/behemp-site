/**
 * E-mail de boas-vindas ao RESPONSÁVEL que o admin cadastrou (ADR-0033, pedido de Dryelle em 29/10/2026).
 *
 * 🔴 Este e-mail NÃO leva a senha. A senha temporária é passada pela equipe por OUTRO canal (telefone, pessoalmente),
 * a mesma regra do acesso do paciente (`components/admin/acesso-do-paciente`): credencial junto do login no mesmo
 * e-mail é credencial para quem lê a caixa de entrada errada. O e-mail diz que a conta existe, onde entrar e como
 * trocar a senha pela tela de entrada ("Esqueci minha senha").
 *
 * Função de montagem pura (testável sem Brevo); o envio é `enviarBoasVindasDoResponsavel`.
 */
import { enviarEmailGenerico } from '@/lib/email/brevo';

const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

function esc(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function montarEmailBoasVindasResponsavel(dados: { nome: string }): {
  assunto: string;
  html: string;
} {
  const entrar = `${APP_URL()}/entrar`;
  const primeiroNome = dados.nome.trim().split(/\s+/)[0] ?? '';
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Sua conta Be4Hope</title></head>
<body style="margin:0;padding:0;background:#faf6ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td style="padding:32px 16px;">
<table align="center" width="560" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;width:100%;margin:0 auto;">
  <tr><td align="center" style="padding:0 0 24px;"><img src="${APP_URL()}/logo.png" alt="Be4Hope" width="120" style="display:block;border:0;max-width:120px;"></td></tr>
  <tr><td style="background:#ffffff;border-radius:16px;border:1px solid #e8dfd0;padding:36px;">
    <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#2b2a26;text-align:center;line-height:1.35;">Olá, ${esc(primeiroNome)}! Sua conta de responsável foi criada</h1>
    <p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#4a4740;">A equipe da Be4Hope criou o seu acesso como <strong>responsável</strong>. Com ele você cadastra e acompanha as pessoas sob os seus cuidados: medicamentos, documentos, solicitações e consultas de cada uma, separadamente.</p>
    <p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#4a4740;"><strong>Como entrar:</strong> use este e-mail e a <strong>senha temporária que a equipe passou a você</strong> (por telefone ou pessoalmente &mdash; ela não vai neste e-mail, por segurança).</p>
    <p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#4a4740;">Se preferir ter a sua própria senha, na tela de entrada clique em <strong>Esqueci minha senha</strong> e siga as instruções enviadas ao seu e-mail.</p>
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin:24px auto 0;"><tr><td align="center">
      <a href="${esc(entrar)}" style="display:inline-block;background:#b5532b;color:#ffffff;font-size:14px;font-weight:600;padding:14px 32px;border-radius:50px;text-decoration:none;">Entrar na minha conta</a>
    </td></tr></table>
  </td></tr>
  <tr><td style="padding:24px 0 0;text-align:center;"><p style="margin:0;font-size:12px;color:#8a857a;">Be4Hope &mdash; Cuidar de quem cuida é nosso ato de amor</p></td></tr>
</table>
</td></tr></table>
</body></html>`;
  return { assunto: 'Sua conta de responsável na Be4Hope foi criada', html };
}

/** Envia e devolve se saiu. Falha de e-mail NUNCA derruba o cadastro: a conta já existe e o admin é avisado na tela. */
export async function enviarBoasVindasDoResponsavel(destino: {
  email: string;
  nome: string;
}): Promise<boolean> {
  try {
    const { assunto, html } = montarEmailBoasVindasResponsavel({ nome: destino.nome });
    await enviarEmailGenerico([{ email: destino.email, name: destino.nome }], assunto, html);
    return true;
  } catch {
    // Sem o erro cru no log: a mensagem do SDK pode trazer o endereço de destino.
    console.error('[Admin] Falha ao enviar o e-mail de boas-vindas do responsável.');
    return false;
  }
}
