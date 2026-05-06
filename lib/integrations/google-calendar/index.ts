import { google } from 'googleapis';

/**
 * Integração com Google Calendar + Google Meet.
 *
 * Credenciais necessárias:
 * - GOOGLE_CLIENT_ID
 * - GOOGLE_CLIENT_SECRET
 *
 * Cada médico precisa autorizar o acesso via OAuth2.
 * O refresh_token é armazenado na tabela `medicos`.
 */

// ── Tipos ─────────────────────────────────────────────────────

export interface CriarEventoParams {
  titulo: string;
  descricao?: string;
  dataInicio: Date;
  dataFim: Date;
  emailPaciente: string;
  emailMedico: string;
  refreshToken: string;
  calendarId?: string;
}

export interface EventoCriado {
  eventId: string;
  meetLink: string;
  htmlLink: string;
}

export interface EventoResult {
  sucesso: boolean;
  dados?: EventoCriado;
  erro?: string;
}

// ── Helper: criar cliente OAuth2 ──────────────────────────────

function criarOAuth2Client(refreshToken?: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      '[Google] GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET não configuradas. Adicione ao .env',
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/google/callback`,
  );

  if (refreshToken) {
    oauth2Client.setCredentials({ refresh_token: refreshToken });
  }

  return oauth2Client;
}

// ── Gerar URL de autorização ──────────────────────────────────

/**
 * Gera a URL para o médico autorizar acesso ao Google Calendar.
 * Deve ser chamada no onboarding do médico.
 */
export function gerarUrlAutorizacaoGoogle(medicoId: string): string {
  const oauth2Client = criarOAuth2Client();

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ],
    state: medicoId, // Para vincular o callback ao médico
  });
}

// ── Trocar código por tokens ──────────────────────────────────

/**
 * Troca o authorization code por tokens de acesso.
 * Chamada pelo callback do OAuth2.
 */
export async function trocarCodigoPorTokens(
  code: string,
): Promise<{ refreshToken: string; accessToken: string }> {
  const oauth2Client = criarOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error(
      '[Google] Refresh token não retornado. Certifique-se de usar prompt=consent.',
    );
  }

  return {
    refreshToken: tokens.refresh_token,
    accessToken: tokens.access_token || '',
  };
}

// ── Criar evento no Calendar com Meet ─────────────────────────

/**
 * Cria um evento no Google Calendar com link do Google Meet.
 * Retorna o eventId e o link do Meet.
 */
export async function criarConsultaGoogleCalendar(
  params: CriarEventoParams,
): Promise<EventoResult> {
  try {
    const oauth2Client = criarOAuth2Client(params.refreshToken);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const evento = await calendar.events.insert({
      calendarId: params.calendarId || 'primary',
      conferenceDataVersion: 1, // Necessário para criar Meet
      requestBody: {
        summary: params.titulo,
        description: params.descricao || 'Consulta Be4Hope — Medicina Endocanabinóide',
        start: {
          dateTime: params.dataInicio.toISOString(),
          timeZone: 'America/Sao_Paulo',
        },
        end: {
          dateTime: params.dataFim.toISOString(),
          timeZone: 'America/Sao_Paulo',
        },
        attendees: [
          { email: params.emailMedico },
          { email: params.emailPaciente },
        ],
        conferenceData: {
          createRequest: {
            requestId: `be4hope-${Date.now()}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 60 },
            { method: 'popup', minutes: 15 },
          ],
        },
      },
    });

    const meetLink =
      evento.data.conferenceData?.entryPoints?.find(
        (ep) => ep.entryPointType === 'video',
      )?.uri || '';

    return {
      sucesso: true,
      dados: {
        eventId: evento.data.id || '',
        meetLink,
        htmlLink: evento.data.htmlLink || '',
      },
    };
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[Google Calendar] Erro ao criar evento:', mensagem);
    return { sucesso: false, erro: mensagem };
  }
}

// ── Cancelar evento ───────────────────────────────────────────

/**
 * Cancela um evento no Google Calendar.
 */
export async function cancelarEventoGoogleCalendar(params: {
  eventId: string;
  refreshToken: string;
  calendarId?: string;
}): Promise<{ sucesso: boolean; erro?: string }> {
  try {
    const oauth2Client = criarOAuth2Client(params.refreshToken);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    await calendar.events.delete({
      calendarId: params.calendarId || 'primary',
      eventId: params.eventId,
      sendUpdates: 'all', // Notifica todos os participantes
    });

    return { sucesso: true };
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[Google Calendar] Erro ao cancelar evento:', mensagem);
    return { sucesso: false, erro: mensagem };
  }
}
