/**
 * Serviço DocuSign — Procuração Específica Be4Hope.
 * Embedded Signing: assinatura dentro da plataforma via iframe.
 *
 * Implementação via REST API direta (fetch) — compatível com Next.js App Router.
 * O SDK docusign-esign usa AMD define() incompatível com o bundler do Next.js.
 *
 * Autenticação: JWT Grant (server-to-server, sem interação do usuário)
 * Documentação: https://developers.docusign.com/docs/esign-rest-api/
 *
 * Fluxo:
 * 1. obterAccessToken() → JWT → access token via RSA-SHA256
 * 2. criarEnvelopeEmbedded() → envelopeId + signingUrl
 * 3. Frontend abre signingUrl em iframe/modal
 * 4. Webhook recebe "envelope-completed" → PDF assinado disponível
 */

import { SignJWT } from 'jose';
import { env } from '@/lib/env';

// ── Tipos ─────────────────────────────────────────────────────

export interface DadosEmbeddedSigning {
  pacienteNome: string;
  pacienteEmail: string;
  pacienteCpf: string;
  pdfBuffer: Buffer;
  procuracaoId: string;
  returnUrl: string;
}

export interface ResultadoEmbeddedSigning {
  sucesso: boolean;
  envelopeId: string | null;
  signingUrl: string | null;
  erro?: string;
}

// ── Verificação de configuração ───────────────────────────────

export function docusignConfigurado(): boolean {
  return !!(
    env.DOCUSIGN_INTEGRATION_KEY &&
    env.DOCUSIGN_ACCOUNT_ID &&
    env.DOCUSIGN_USER_ID &&
    env.DOCUSIGN_PRIVATE_KEY
  );
}

// ── Autenticação JWT Grant ────────────────────────────────────

let cachedToken: { token: string; expiraEm: number } | null = null;

/**
 * Converte chave RSA PKCS#1 (BEGIN RSA PRIVATE KEY) para PKCS#8 (BEGIN PRIVATE KEY).
 * O DocuSign gera chaves no formato PKCS#1, mas o jose@5 exige PKCS#8.
 * Usa o módulo crypto nativo do Node.js para a conversão — zero dependências extras.
 */
async function converterParaPkcs8(pkcs1Pem: string): Promise<string> {
  const { createPrivateKey } = await import('crypto');

  // Criar objeto de chave privada a partir do PEM PKCS#1
  const privateKey = createPrivateKey({
    key: pkcs1Pem,
    format: 'pem',
    type: 'pkcs1',
  });

  // Exportar no formato PKCS#8 PEM
  const pkcs8Pem = privateKey.export({
    format: 'pem',
    type: 'pkcs8',
  }) as string;

  return pkcs8Pem;
}

export async function obterAccessToken(): Promise<string> {
  // Usar token em cache se ainda válido (com 5min de margem)
  if (cachedToken && Date.now() < cachedToken.expiraEm - 5 * 60 * 1000) {
    return cachedToken.token;
  }

  // Processar chave RSA — converter \n literais para quebras reais
  const rawKey = env.DOCUSIGN_PRIVATE_KEY ?? '';
  const privateKeyPem = rawKey
    .replace(/\\n/g, '\n')
    .replace(/^["']|["']$/g, '')
    .trim();

  if (!privateKeyPem.includes('BEGIN')) {
    throw new Error('[DocuSign] DOCUSIGN_PRIVATE_KEY não encontrada ou inválida no .env');
  }

  const { SignJWT, importPKCS8 } = await import('jose');

  // Converter para PKCS#8 se necessário (DocuSign gera PKCS#1)
  let pemParaImportar = privateKeyPem;
  if (privateKeyPem.includes('BEGIN RSA PRIVATE KEY')) {
    pemParaImportar = await converterParaPkcs8(privateKeyPem);
  }

  // Importar chave no formato PKCS#8
  let privateKey: CryptoKey;
  try {
    privateKey = await importPKCS8(pemParaImportar, 'RS256');
  } catch (err) {
    throw new Error(
      `[DocuSign] Falha ao importar chave RSA após conversão: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Montar e assinar JWT para DocuSign
  const oauthBase = (env.DOCUSIGN_OAUTH_BASE_URL ?? 'https://account-d.docusign.com')
    .replace('https://', '');

  const agora = Math.floor(Date.now() / 1000);

  const jwt = await new SignJWT({
    sub: env.DOCUSIGN_USER_ID!,
    iss: env.DOCUSIGN_INTEGRATION_KEY!,
    aud: oauthBase,
    scope: 'signature impersonation',
    iat: agora,
    exp: agora + 3600,
  })
    .setProtectedHeader({ alg: 'RS256' })
    .sign(privateKey);

  // Trocar JWT por access token
  const tokenUrl = `https://${oauthBase}/oauth/token`;
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const erro = await response.text();
    if (erro.includes('consent_required')) {
      throw new Error('CONSENT_REQUIRED');
    }
    throw new Error(`[DocuSign] Falha ao obter access token: ${response.status} — ${erro}`);
  }

  const data = await response.json() as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    expiraEm: Date.now() + (data.expires_in ?? 3600) * 1000,
  };

  return data.access_token;
}

// ── Criar envelope com Embedded Signing ──────────────────────

export async function criarEnvelopeEmbedded(
  dados: DadosEmbeddedSigning,
): Promise<ResultadoEmbeddedSigning> {
  if (!docusignConfigurado()) {
    console.warn('[DocuSign] Credenciais não configuradas');
    return {
      sucesso: false,
      envelopeId: null,
      signingUrl: null,
      erro: 'DocuSign não configurado. Configure as variáveis de ambiente.',
    };
  }

  try {
    const accessToken = await obterAccessToken();
    const baseUrl = env.DOCUSIGN_BASE_URL ?? 'https://demo.docusign.net/restapi';
    const accountId = env.DOCUSIGN_ACCOUNT_ID!;
    const clientUserId = `be4hope-${dados.procuracaoId}`;

    // 1. Criar envelope via REST
    const envelopeBody = {
      emailSubject: 'Be4Hope — Assine sua Procuração Específica ANVISA',
      status: 'sent',
      documents: [
        {
          documentBase64: dados.pdfBuffer.toString('base64'),
          name: 'Procuração Específica Be4Hope',
          fileExtension: 'pdf',
          documentId: '1',
        },
      ],
      recipients: {
        signers: [
          {
            email: dados.pacienteEmail,
            name: dados.pacienteNome,
            recipientId: '1',
            routingOrder: '1',
            clientUserId, // obrigatório para embedded signing
            tabs: {
              signHereTabs: [
                {
                  documentId: '1',
                  pageNumber: '2',
                  // Assinatura SOBRE a linha — ajustado para centralizar e ficar o código acima da linha
                  xPosition: '260',
                  yPosition: '412',
                  scaleValue: '0.8', // menor para não sobrepor o texto
                  tabLabel: 'Assinatura do Outorgante',
                },
              ],
              // Remover fullNameTabs e dateSignedTabs — deixar apenas signHereTabs
              // O nome e CPF já estão no HTML do documento
            },
          },
        ],
      },
    };

    const envelopeRes = await fetch(`${baseUrl}/v2.1/accounts/${accountId}/envelopes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(envelopeBody),
    });

    if (!envelopeRes.ok) {
      const errText = await envelopeRes.text();
      throw new Error(`Erro ao criar envelope: ${envelopeRes.status} — ${errText}`);
    }

    const envelopeData = (await envelopeRes.json()) as { envelopeId: string };
    const envelopeId = envelopeData.envelopeId;

    // 2. Obter URL de assinatura embedded (válida por ~5 minutos)
    const viewBody = {
      returnUrl: dados.returnUrl,
      authenticationMethod: 'none',
      email: dados.pacienteEmail,
      userName: dados.pacienteNome,
      clientUserId,
      recipientId: '1',
    };

    const viewRes = await fetch(
      `${baseUrl}/v2.1/accounts/${accountId}/envelopes/${envelopeId}/views/recipient`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(viewBody),
      },
    );

    if (!viewRes.ok) {
      const errText = await viewRes.text();
      throw new Error(`Erro ao obter URL de assinatura: ${viewRes.status} — ${errText}`);
    }

    const viewData = (await viewRes.json()) as { url: string };

    return {
      sucesso: true,
      envelopeId,
      signingUrl: viewData.url,
    };
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[DocuSign] Erro ao criar envelope embedded:', mensagem);

    if (mensagem === 'CONSENT_REQUIRED' || mensagem.includes('consent_required')) {
      return {
        sucesso: false,
        envelopeId: null,
        signingUrl: null,
        erro: 'CONSENT_REQUIRED',
      };
    }

    return {
      sucesso: false,
      envelopeId: null,
      signingUrl: null,
      erro: mensagem,
    };
  }
}

// ── Download PDF assinado após conclusão ──────────────────────

export async function downloadPdfAssinado(envelopeId: string): Promise<Buffer | null> {
  if (!docusignConfigurado()) return null;

  try {
    const accessToken = await obterAccessToken();
    const baseUrl = env.DOCUSIGN_BASE_URL ?? 'https://demo.docusign.net/restapi';
    const accountId = env.DOCUSIGN_ACCOUNT_ID!;

    const res = await fetch(
      `${baseUrl}/v2.1/accounts/${accountId}/envelopes/${envelopeId}/documents/1`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch (error) {
    console.error('[DocuSign] Erro ao baixar PDF assinado:', error);
    return null;
  }
}

// ── Comunicados enviados pelo admin (Atualização do Programa de Doação) ───────
//
// Mesma conta, mesmo JWT, mesma API da procuração — só funções novas. Nada acima mudou.
// O envelope é "embedded": o DocuSign NÃO manda e-mail ao paciente. O e-mail é nosso (docs@) e
// leva ao sistema, onde o link de assinatura é gerado na hora, depois de conferir quem pede.

export interface DadosEnvelopeComunicado {
  pacienteNome: string;
  pacienteEmail: string;
  /** Identificador do signatário dentro do envelope. Precisa ser o mesmo ao pedir o link. */
  clientUserId: string;
  pdfBuffer: Buffer;
  tituloDoDocumento: string;
  assuntoDoEnvelope: string;
  ancoraAssinatura: string;
  ancoraData: string;
  /** URL pública que o DocuSign chama quando o envelope muda (gatilho; o status vem da API). */
  urlDoWebhook?: string;
}

export type ResultadoEnvelopeComunicado =
  | { sucesso: true; envelopeId: string }
  | { sucesso: false; erro: string };

function baseDocusign() {
  return {
    baseUrl: env.DOCUSIGN_BASE_URL ?? 'https://demo.docusign.net/restapi',
    accountId: env.DOCUSIGN_ACCOUNT_ID!,
  };
}

/** Cria o envelope do comunicado, já enviado, com a assinatura ancorada no texto do PDF. */
export async function criarEnvelopeComunicado(
  dados: DadosEnvelopeComunicado,
): Promise<ResultadoEnvelopeComunicado> {
  if (!docusignConfigurado()) {
    return { sucesso: false, erro: 'DocuSign não configurado neste ambiente.' };
  }
  try {
    const accessToken = await obterAccessToken();
    const { baseUrl, accountId } = baseDocusign();

    const corpo: Record<string, unknown> = {
      emailSubject: dados.assuntoDoEnvelope,
      status: 'sent',
      documents: [
        {
          documentBase64: dados.pdfBuffer.toString('base64'),
          name: dados.tituloDoDocumento,
          fileExtension: 'pdf',
          documentId: '1',
        },
      ],
      recipients: {
        signers: [
          {
            email: dados.pacienteEmail,
            name: dados.pacienteNome,
            recipientId: '1',
            routingOrder: '1',
            clientUserId: dados.clientUserId,
            tabs: {
              signHereTabs: [
                {
                  documentId: '1',
                  anchorString: dados.ancoraAssinatura,
                  anchorUnits: 'pixels',
                  anchorXOffset: '0',
                  anchorYOffset: '-6',
                  tabLabel: 'Assinatura do paciente',
                },
              ],
              dateSignedTabs: [
                {
                  documentId: '1',
                  anchorString: dados.ancoraData,
                  anchorUnits: 'pixels',
                  anchorXOffset: '0',
                  anchorYOffset: '0',
                  tabLabel: 'Data da assinatura',
                },
              ],
            },
          },
        ],
      },
    };

    if (dados.urlDoWebhook) {
      corpo.eventNotification = {
        url: dados.urlDoWebhook,
        loggingEnabled: 'true',
        requireAcknowledgment: 'true',
        useSoapInterface: 'false',
        includeCertificateWithSoap: 'false',
        signMessageWithX509Cert: 'false',
        includeDocuments: 'false',
        includeEnvelopeVoidReason: 'true',
        includeTimeZone: 'true',
        includeSenderAccountAsCustomField: 'false',
        includeDocumentFields: 'false',
        includeCertificateOfCompletion: 'false',
        envelopeEvents: ['sent', 'delivered', 'completed', 'declined', 'voided'].map((s) => ({
          envelopeEventStatusCode: s,
        })),
        eventData: { version: 'restv2.1', format: 'json' },
      };
    }

    const res = await fetch(`${baseUrl}/v2.1/accounts/${accountId}/envelopes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    });
    if (!res.ok) {
      // Só o status sobe para a tela; o detalhe fica no log do servidor.
      const detalhe = await res.text();
      console.error('[DocuSign] criar envelope do comunicado:', res.status, detalhe.slice(0, 500));
      return { sucesso: false, erro: `DocuSign recusou o envelope (HTTP ${res.status}).` };
    }
    const { envelopeId } = (await res.json()) as { envelopeId: string };
    return { sucesso: true, envelopeId };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'erro desconhecido';
    console.error('[DocuSign] criar envelope do comunicado:', msg);
    if (msg === 'CONSENT_REQUIRED' || msg.includes('consent_required')) {
      return { sucesso: false, erro: 'CONSENT_REQUIRED' };
    }
    return { sucesso: false, erro: 'Falha ao falar com o DocuSign.' };
  }
}

/** Link de assinatura do signatário — vale poucos minutos; gere um novo a cada clique. */
export async function gerarUrlAssinaturaComunicado(dados: {
  envelopeId: string;
  clientUserId: string;
  pacienteNome: string;
  pacienteEmail: string;
  returnUrl: string;
}): Promise<{ sucesso: true; url: string } | { sucesso: false; erro: string }> {
  if (!docusignConfigurado()) return { sucesso: false, erro: 'DocuSign não configurado.' };
  try {
    const accessToken = await obterAccessToken();
    const { baseUrl, accountId } = baseDocusign();
    const res = await fetch(
      `${baseUrl}/v2.1/accounts/${accountId}/envelopes/${dados.envelopeId}/views/recipient`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          returnUrl: dados.returnUrl,
          authenticationMethod: 'none',
          email: dados.pacienteEmail,
          userName: dados.pacienteNome,
          clientUserId: dados.clientUserId,
          recipientId: '1',
        }),
      },
    );
    if (!res.ok) {
      console.error('[DocuSign] link de assinatura do comunicado:', res.status);
      return { sucesso: false, erro: `DocuSign recusou o link (HTTP ${res.status}).` };
    }
    const { url } = (await res.json()) as { url: string };
    return { sucesso: true, url };
  } catch (error) {
    console.error('[DocuSign] link de assinatura do comunicado:', error);
    return { sucesso: false, erro: 'Falha ao falar com o DocuSign.' };
  }
}

export interface StatusDoEnvelope {
  /** sent | delivered | completed | declined | voided | … — como o DocuSign devolve. */
  status: string;
  completedDateTime: string | null;
}

/**
 * Lê o status do envelope DIRETO da API.
 *
 * É a fonte de verdade da conclusão: o corpo de um webhook ou o parâmetro `event` da URL de
 * retorno são entrada de quem chama e não provam nada.
 */
export async function consultarStatusDoEnvelope(
  envelopeId: string,
): Promise<{ sucesso: true; dados: StatusDoEnvelope } | { sucesso: false; erro: string }> {
  if (!docusignConfigurado()) return { sucesso: false, erro: 'DocuSign não configurado.' };
  try {
    const accessToken = await obterAccessToken();
    const { baseUrl, accountId } = baseDocusign();
    const res = await fetch(`${baseUrl}/v2.1/accounts/${accountId}/envelopes/${envelopeId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return { sucesso: false, erro: `DocuSign respondeu HTTP ${res.status}.` };
    const j = (await res.json()) as { status?: string; completedDateTime?: string };
    if (!j.status) return { sucesso: false, erro: 'Resposta do DocuSign sem status.' };
    return {
      sucesso: true,
      dados: { status: j.status, completedDateTime: j.completedDateTime ?? null },
    };
  } catch (error) {
    console.error('[DocuSign] consultar envelope:', error);
    return { sucesso: false, erro: 'Falha ao falar com o DocuSign.' };
  }
}
