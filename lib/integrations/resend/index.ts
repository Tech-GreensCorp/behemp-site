import { Resend } from 'resend';

/**
 * Cliente Resend para envio de e-mails transacionais.
 *
 * Configuração necessária: RESEND_API_KEY no .env
 * Domínio verificado: be4hope.org (configurar no painel Resend)
 */

let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error(
        '[Resend] RESEND_API_KEY não configurada. Adicione ao .env',
      );
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

// ── Constantes ────────────────────────────────────────────────

const REMETENTE_PADRAO = 'Be4Hope <noreply@be4hope.org>';

// ── Tipos ─────────────────────────────────────────────────────

interface EmailParams {
  para: string | string[];
  assunto: string;
  html: string;
  textoPlano?: string;
}

interface EmailResult {
  sucesso: boolean;
  id?: string;
  erro?: string;
}

// ── Função de envio genérica ──────────────────────────────────

export async function enviarEmail(params: EmailParams): Promise<EmailResult> {
  try {
    const resend = getResendClient();

    const { data, error } = await resend.emails.send({
      from: REMETENTE_PADRAO,
      to: Array.isArray(params.para) ? params.para : [params.para],
      subject: params.assunto,
      html: params.html,
      text: params.textoPlano,
    });

    if (error) {
      console.error('[Resend] Erro ao enviar e-mail:', error);
      return { sucesso: false, erro: error.message };
    }

    return { sucesso: true, id: data?.id };
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[Resend] Exceção ao enviar e-mail:', mensagem);
    return { sucesso: false, erro: mensagem };
  }
}

// ── Templates de e-mail ───────────────────────────────────────

/**
 * E-mail de confirmação de consulta agendada.
 */
export async function enviarEmailConfirmacaoConsulta(params: {
  emailPaciente: string;
  nomePaciente: string;
  nomeMedico: string;
  dataHora: string;
  linkMeet: string;
}): Promise<EmailResult> {
  const html = `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #10b981; font-size: 24px; margin: 0;">Be4Hope</h1>
        <p style="color: #6b7280; margin-top: 4px;">Medicina Endocanabinóide</p>
      </div>

      <h2 style="color: #1f2937; font-size: 20px;">Consulta Confirmada ✅</h2>

      <p style="color: #374151;">Olá, <strong>${params.nomePaciente}</strong>!</p>
      <p style="color: #374151;">Sua consulta foi agendada com sucesso.</p>

      <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin: 24px 0;">
        <p style="margin: 8px 0; color: #374151;"><strong>Médico:</strong> ${params.nomeMedico}</p>
        <p style="margin: 8px 0; color: #374151;"><strong>Data e horário:</strong> ${params.dataHora}</p>
        <p style="margin: 8px 0; color: #374151;">
          <strong>Link da consulta:</strong>
          <a href="${params.linkMeet}" style="color: #10b981;">${params.linkMeet}</a>
        </p>
      </div>

      <p style="color: #6b7280; font-size: 14px;">
        Acesse o link do Google Meet no horário agendado. Recomendamos testar sua câmera e microfone antes da consulta.
      </p>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
      <p style="color: #9ca3af; font-size: 12px; text-align: center;">
        Be4Hope — Plataforma de Medicina Endocanabinóide<br />
        Este é um e-mail automático. Não responda.
      </p>
    </div>
  `;

  return enviarEmail({
    para: params.emailPaciente,
    assunto: `Consulta confirmada — ${params.dataHora}`,
    html,
  });
}

/**
 * E-mail de alerta de renovação de documento.
 */
export async function enviarEmailRenovacaoDocumento(params: {
  emailPaciente: string;
  nomePaciente: string;
  tipoDocumento: string;
  dataValidade: string;
}): Promise<EmailResult> {
  const html = `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #10b981; font-size: 24px; margin: 0;">Be4Hope</h1>
        <p style="color: #6b7280; margin-top: 4px;">Medicina Endocanabinóide</p>
      </div>

      <h2 style="color: #f59e0b; font-size: 20px;">⚠️ Documento próximo do vencimento</h2>

      <p style="color: #374151;">Olá, <strong>${params.nomePaciente}</strong>!</p>
      <p style="color: #374151;">
        Seu documento <strong>${params.tipoDocumento}</strong> vence em <strong>${params.dataValidade}</strong>.
      </p>
      <p style="color: #374151;">
        Por favor, providencie a renovação o mais rápido possível para manter seu tratamento ativo.
      </p>

      <div style="text-align: center; margin: 32px 0;">
        <a href="https://be4hope.org/paciente/documentos" style="background: #10b981; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Acessar meus documentos
        </a>
      </div>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
      <p style="color: #9ca3af; font-size: 12px; text-align: center;">
        Be4Hope — Plataforma de Medicina Endocanabinóide<br />
        Este é um e-mail automático. Não responda.
      </p>
    </div>
  `;

  return enviarEmail({
    para: params.emailPaciente,
    assunto: `⚠️ Documento ${params.tipoDocumento} próximo do vencimento`,
    html,
  });
}

/**
 * E-mail de alerta de recompra de medicamento.
 */
export async function enviarEmailRecompraMedicamento(params: {
  emailPaciente: string;
  nomePaciente: string;
  nomeMedicamento: string;
  dataPrevista: string;
}): Promise<EmailResult> {
  const html = `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #10b981; font-size: 24px; margin: 0;">Be4Hope</h1>
        <p style="color: #6b7280; margin-top: 4px;">Medicina Endocanabinóide</p>
      </div>

      <h2 style="color: #3b82f6; font-size: 20px;">💊 Hora de renovar seu medicamento</h2>

      <p style="color: #374151;">Olá, <strong>${params.nomePaciente}</strong>!</p>
      <p style="color: #374151;">
        De acordo com sua dosagem atual, seu medicamento <strong>${params.nomeMedicamento}</strong>
        está previsto para acabar em <strong>${params.dataPrevista}</strong>.
      </p>
      <p style="color: #374151;">
        Recomendamos fazer o pedido de recompra com antecedência para não interromper o tratamento.
      </p>

      <div style="text-align: center; margin: 32px 0;">
        <a href="https://be4hope.org/paciente/recompra" style="background: #10b981; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Ver detalhes da recompra
        </a>
      </div>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
      <p style="color: #9ca3af; font-size: 12px; text-align: center;">
        Be4Hope — Plataforma de Medicina Endocanabinóide<br />
        Este é um e-mail automático. Não responda.
      </p>
    </div>
  `;

  return enviarEmail({
    para: params.emailPaciente,
    assunto: `💊 Recompra de ${params.nomeMedicamento} — ${params.dataPrevista}`,
    html,
  });
}
