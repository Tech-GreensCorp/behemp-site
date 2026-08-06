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

async function obterAccessToken(): Promise<string> {
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
