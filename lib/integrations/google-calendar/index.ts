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

/** Parâmetros para criação de evento via Service Account (sem OAuth por médico). */
export interface CriarEventoServiceAccountParams {
  titulo: string;
  descricao?: string;
  dataInicio: Date;
  dataFim: Date;
  emailPaciente: string;
  emailMedico: string;
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

// ── Helper: cliente OAuth2 por médico (refresh token) ──────────────────

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
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`,
  );

  if (refreshToken) {
    oauth2Client.setCredentials({ refresh_token: refreshToken });
  }

  return oauth2Client;
}

// ── Helper: cliente Service Account ────────────────────────────────────────

/**
 * Cria um cliente autenticado via Service Account.
 * Variáveis necessárias:
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL
 *   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY  (valor com \\n literais da Vercel)
 */
function criarClienteServiceAccount() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!email || !rawKey) {
    throw new Error(
      '[Google] GOOGLE_SERVICE_ACCOUNT_EMAIL e GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY não configuradas.',
    );
  }

  // A Vercel armazena \n como literal; precisamos converter para quebra real
  const privateKey = rawKey.replace(/\\n/g, '\n');

  return new google.auth.GoogleAuth({
    credentials: {
      client_email: email,
      private_key: privateKey,
    },
    scopes: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ],
  });
}

// ── Gerar URL de autorização (OAuth por médico — fluxo legado) ───────────────

/**
 * Gera a URL para o médico autorizar acesso ao Google Calendar.
 * Mantido para compatibilidade; o fluxo principal agora usa service account.
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
    state: medicoId,
  });
}

// ── Criar evento via Service Account (fluxo principal) ────────────────────

/**
 * Cria um evento de consulta no Google Calendar usando a Service Account.
 * Não depende de OAuth individual do médico.
 * O médico e o paciente são convidados como attendees e recebem o convite por e-mail.
 */
export async function criarConsultaServiceAccount(
  params: CriarEventoServiceAccountParams,
): Promise<EventoResult> {
  try {
    const auth = criarClienteServiceAccount();
    const calendar = google.calendar({ version: 'v3', auth });

    const evento = await calendar.events.insert({
      calendarId: 'primary',
      conferenceDataVersion: 1,
      sendUpdates: 'all', // convite por e-mail para médico e paciente
      requestBody: {
        summary: params.titulo,
        description: params.descricao || 'Consulta Be4Hope — Medicina Endocanabinoíde',
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
            // requestId único por evento para evitar duplicatas
            requestId: `be4hope-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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
    console.error('[Google Calendar] Erro ao criar evento via service account:', mensagem);
    return { sucesso: false, erro: mensagem };
  }
}

// ── Trocar código por tokens (OAuth legado) ────────────────────────────────

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
      sendUpdates: 'all', // Envia convite ao paciente + adiciona na agenda dele
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

// ── Atualizar evento (remarcar) ──────────────────────────────

/**
 * Atualiza data/hora de um evento existente no Google Calendar.
 * Mantém o mesmo link do Meet e notifica participantes.
 */
export async function atualizarEventoGoogleCalendar(params: {
  eventId: string;
  refreshToken: string;
  novaDataInicio: Date;
  novaDataFim: Date;
  calendarId?: string;
}): Promise<EventoResult> {
  try {
    const oauth2Client = criarOAuth2Client(params.refreshToken);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const evento = await calendar.events.patch({
      calendarId: params.calendarId || 'primary',
      eventId: params.eventId,
      sendUpdates: 'all',
      requestBody: {
        start: {
          dateTime: params.novaDataInicio.toISOString(),
          timeZone: 'America/Sao_Paulo',
        },
        end: {
          dateTime: params.novaDataFim.toISOString(),
          timeZone: 'America/Sao_Paulo',
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
    console.error('[Google Calendar] Erro ao atualizar evento:', mensagem);
    return { sucesso: false, erro: mensagem };
  }
}

