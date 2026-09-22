import { z } from 'zod';

/**
 * Validação de variáveis de ambiente com Zod.
 * Se alguma variável obrigatória estiver faltando, o build falha imediatamente.
 *
 * Variáveis com .optional() são de integrações que podem não estar configuradas.
 */

const envSchema = z.object({
  // ── Aplicação ────────────────────────────────────────────────
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),

  // ── Banco de Dados (Neon PostgreSQL) ─────────────────────────
  DATABASE_URL: z.string().url('DATABASE_URL é obrigatória'),

  // ── ChatPro — o paciente que chega pelo WhatsApp (09/09/2026) ────────────────
  /**
   * Segredo do cabeçalho `x-chatpro-intake-secret`, usado por `/bot-link` e `/intake`.
   * Sem ele as duas rotas ficam FECHADAS: endpoint que cria cadastro de paciente nunca
   * deve abrir por falta de configuração.
   */
  CHATPRO_INTAKE_SECRET: z.string().optional(),
  /** Segredo que vai no caminho da URL do webhook. 32+ bytes aleatórios em hexadecimal. */
  CHATPRO_WEBHOOK_PATH_TOKEN: z.string().optional(),
  /** 🔴 Dá acesso a TODAS as conversas da instância. Só `lib/chatpro/cliente.ts` o lê. */
  CHATPRO_INSTANCE_TOKEN: z.string().optional(),
  CHATPRO_INSTANCE_ID: z.string().optional(),
  /**
   * 🔴 A INSTÂNCIA DE CHATPRO DA CONTA DA GREENS — 14/09/2026.
   *
   * Cada conta é uma instância diferente. O `leadId` que chega numa chamada da Greens só
   * existe na instância DELES: procurá-lo na da BeHemp devolve `null`, e `null` vira
   * `throw ErroDeContatoNaoConfirmado` ANTES do insert — a solicitação não nasce, o
   * `/bot-link` responde 422, e o painel transfere o paciente para um atendente.
   *
   * Foi o que travou o Fluxo 2, com dezenas de `contato não confirmado por findById` no log.
   *
   * ⚠️ Sem estas duas, `instanciaDaConta('greens')` devolve `null` e a confirmação
   * simplesmente não acontece — o fluxo segue pelo telefone, que é degradação aceitável
   * porque o segredo do cabeçalho já autenticou a origem.
   */
  CHATPRO_INSTANCE_ID_GREENS: z.string().optional(),
  CHATPRO_INSTANCE_TOKEN_GREENS: z.string().optional(),
  /**
   * 🔴 O host da instância da Greens. O ChatPro dá um subdomínio por conta, e `sparks` é o
   * DELES — por isso o default de `CHATPRO_CHAT_API_URL` acerta a conta da Greens por acaso e
   * erra a nossa. Fica declarada para que a assimetria seja escolha, não descuido.
   */
  CHATPRO_CHAT_API_URL_GREENS: z.string().url().optional(),
  CHATPRO_CHAT_API_URL: z.string().url().default('https://sparks.chatpro.com.br'),
  /** Validade do link em horas. 168 = 7 dias. */
  CHATPRO_LINK_TTL_HORAS: z.coerce.number().int().positive().default(168),
  /** Caminho do formulário de cadastro. Fica em variável porque a rota ainda está sendo definida. */
  CHATPRO_CADASTRO_PATH: z.string().default('/cadastro'),
  /** Confirmar o contato na API do ChatPro também no `/intake` (no `/bot-link` é sempre). */
  CHATPRO_CONFIRMAR_NO_INTAKE: z.string().optional(),
  /**
   * Permite que `/start` crie solicitação sem confirmar o contato — **só** quando a URL traz
   * o identificador, que é um UUID e portanto não adivinhável. Telefone sozinho nunca basta.
   */
  CHATPRO_START_SEM_CONFIRMACAO: z.string().optional(),

  /** ADR-0018: a conta de ChatPro da Greens. Segredo PRÓPRIO — um por conta. */
  CHATPRO_INTAKE_SECRET_GREENS: z.string().optional(),
  /** Destino do paciente que veio pelo bot da Greens. Validado contra as origens. */
  CHATPRO_GREENS_URL_DE_RETORNO: z.string().optional(),

  // ── Parceiros (ADR-0016) ───────────────────────────────────────────────────
  /** Segredo do HMAC das chamadas que a Greens faz PARA CÁ (handoff de cadastro). */
  PARCEIRO_GREENS_SEGREDO_ENTRADA: z.string().optional(),
  /**
   * Segredo do HMAC das chamadas que NÓS fazemos PARA A GREENS (retorno de receita/ANVISA).
   *
   * ⚠️ DIFERENTE do de entrada, de propósito: um por direção. Vazar um não compromete o
   * outro, e rotacionar um não exige parar as duas pontas ao mesmo tempo.
   */
  PARCEIRO_GREENS_SEGREDO_SAIDA: z.string().optional(),
  /** Base da API da Greens, para o retorno. */
  PARCEIRO_GREENS_API_URL: z.string().url().optional(),
  /**
   * Origens para as quais podemos devolver o paciente, separadas por vírgula.
   * Ex.: `https://greens-corp.com,https://app.greens-corp.com`
   *
   * ⚠️ Vazio = nenhum retorno é aceito. Falha fechada de propósito: um redirecionamento
   * aberto é pior que um botão de volta ausente.
   */
  PARCEIRO_ORIGENS_DE_RETORNO: z.string().optional(),
  /**
   * Caminho da rota de retorno no parceiro. Só preencher se ele mudar de lugar — o
   * default no código é o acordado: `/api/v1/parceiros/behemp/atualizacao`.
   */
  PARCEIRO_GREENS_CAMINHO_RETORNO: z.string().optional(),

  // ── Mercado Pago — split de pagamento do médico (ADR-0024) ────────────────
  /**
   * 🔴 QUAL PAR DE CREDENCIAIS ESTÁ ATIVO — e NÃO se deriva do `NODE_ENV`.
   *
   * Produção roda `NODE_ENV=production` e deve usar, hoje, o par de TESTE: ainda não se
   * processa pagamento real. Derivar do ambiente entregaria a credencial de produção
   * exatamente onde não se quer. É a mesma confusão que `lib/auth/instancia-do-clerk.ts`
   * existe para DENUNCIAR — lá o `NODE_ENV` serve para avisar que ambiente e credencial
   * divergiram, nunca para escolher a credencial.
   *
   * Vazio = `teste`, que é o padrão que não cobra ninguém.
   */
  MERCADOPAGO_AMBIENTE: z.enum(['teste', 'producao']).default('teste'),
  /** O número da aplicação no painel do Mercado Pago. Vai no `client_id` do OAuth. */
  MERCADOPAGO_CLIENT_ID: z.string().optional(),
  /** Segredo da aplicação. Só o servidor o vê — nunca chega ao navegador. */
  MERCADOPAGO_CLIENT_SECRET: z.string().optional(),
  /**
   * 🔴 O QUE COBRA DINHEIRO. Dois pares, e `MERCADOPAGO_AMBIENTE` decide qual vale.
   *
   * ⚠️ Estes são da conta da PLATAFORMA. O token que cobra em nome do médico é outro:
   * vem do OAuth, é por médico, e vive CIFRADO em `medicos_mercadopago_conta`.
   */
  MERCADOPAGO_ACCESS_TOKEN_TESTE: z.string().optional(),
  MERCADOPAGO_ACCESS_TOKEN_PRODUCAO: z.string().optional(),
  /**
   * As public keys do Checkout Bricks. São públicas por natureza — identificam a conta,
   * não autorizam cobrança —, mas ficam SEM `NEXT_PUBLIC_` de propósito: o servidor as lê
   * em runtime e entrega a escolhida ao componente por prop, como o ClerkProvider faz.
   * Assim trocar de conta não exige rebuild. Ver o comentário do `deploy.yml`.
   */
  MERCADOPAGO_PUBLIC_KEY_TESTE: z.string().optional(),
  MERCADOPAGO_PUBLIC_KEY_PRODUCAO: z.string().optional(),
  /**
   * 🔴 A CHAVE QUE CIFRA OS TOKENS DE CONTA DO MÉDICO — 64 hexadecimais (32 bytes).
   *
   * `lib/seguranca/cifra.ts` LANÇA sem ela, e é falha fechada de propósito: credencial de
   * terceiro não é gravada em claro porque faltou configuração.
   *
   * ⚠️ PERDÊ-LA É PERDER OS DADOS. Todo `access_token_cifrado` e `refresh_token_cifrado`
   * já gravado vira ilegível, e cada médico precisa reconectar. ADR-0024 §7.
   *
   * ⚠️ `.optional()` aqui NÃO é descuido: o schema é avaliado na importação, e exigi-la
   * derrubaria toda máquina sem ela — inclusive o build do CI. Quem falha fechado é a
   * cifra, no ponto de uso, não o boot do app inteiro.
   */
  MERCADOPAGO_TOKEN_ENCRYPTION_KEY: z.string().optional(),

  // ── Autenticação (Clerk) ──────────────────────────────────────
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().optional(),
  CLERK_SECRET_KEY: z.string().optional(),
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: z.string().default('/entrar'),
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: z.string().default('/registrar-se'),
  NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: z.string().default('/'),
  NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: z.string().default('/'),

  // ── E-mail Transacional (Brevo) ──────────────────────────────
  BREVO_API_KEY: z.string().optional(),
  BREVO_FROM_EMAIL: z.string().email().optional(),
  BREVO_FROM_NAME: z.string().default('Be4Hope'),
  BREVO_TO_EMAIL: z.string().email().optional(),
  RECOMPRA_EMAIL_DESTINO: z.string().email().optional(),

  // ── Google Calendar + Meet (OAuth2) ──────────────────────────
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // ── Google Sheets (Triagens) ─────────────────────────────────
  GOOGLE_SHEETS_SPREADSHEET_ID: z.string().optional(),
  GOOGLE_SHEETS_SHEET_NAME: z.string().default('Página1'),
  NEXT_PUBLIC_SHEETS_SPREADSHEET_ID: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().email().optional(),
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: z.string().optional(),

  // ── Retransmissão de mídia da teleconsulta (Cloudflare Realtime TURN) ──
  // Escolhido pelo dono em 20/08/2026 (Item 8 do 04-LISTA-DE-AFAZERES). Opcionais de
  // propósito: sem elas, a videochamada usa só STUN e o cliente avisa que não há
  // retransmissão — em vez de cair no relay público de terceiro que havia antes.
  CLOUDFLARE_TURN_KEY_ID: z.string().optional(),
  CLOUDFLARE_TURN_API_TOKEN: z.string().optional(),

  // ── Chat em Tempo Real (Pusher) ───────────────────────────────
  NEXT_PUBLIC_PUSHER_KEY: z.string().optional(),
  NEXT_PUBLIC_PUSHER_CLUSTER: z.string().optional(),
  PUSHER_APP_ID: z.string().optional(),
  PUSHER_KEY: z.string().optional(),
  PUSHER_SECRET: z.string().optional(),
  PUSHER_CLUSTER: z.string().optional(),

  // ── Upload de Arquivos (Vercel Blob) ─────────────────────────
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  BLOB_BEHEMP_READ_WRITE_TOKEN: z.string().optional(),
  /**
   * 🔴 O store PRIVADO — e é obrigatoriamente um terceiro.
   *
   * As duas variáveis acima resolvem stores PÚBLICOS: `upload-avatar` e `upload-exame` gravam
   * `access: 'public'` com a `BEHEMP`. Um token resolve um store, e um store tem um único
   * access mode, escolhido na criação e imutável (doc da Vercel: _"provision two separate
   * stores from the start"_). Reaproveitar qualquer uma delas quebraria o que já funciona.
   *
   * Sem ela, `lib/documentos/store-privado.ts` LANÇA — documento de paciente não cai para
   * store público.
   */
  BLOB_TOKEN_PRIVADO: z.string().optional(),

  // ── Jobs Agendados (Inngest) ──────────────────────────────────
  INNGEST_EVENT_KEY: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),

  // ── Cron Jobs (Vercel) ────────────────────────────────────────
  CRON_SECRET: z.string().optional(),

  // ── DocuSign (Assinatura Digital — Procuração Específica) ─────
  // Sandbox: demo.docusign.net | Produção: na4.docusign.net
  DOCUSIGN_INTEGRATION_KEY: z.string().optional(),
  DOCUSIGN_CLIENT_SECRET: z.string().optional(),
  DOCUSIGN_ACCOUNT_ID: z.string().optional(),
  DOCUSIGN_USER_ID: z.string().optional(),
  DOCUSIGN_BASE_URL: z.string().default('https://demo.docusign.net/restapi'),
  DOCUSIGN_OAUTH_BASE_URL: z.string().default('https://account-d.docusign.com'),
  DOCUSIGN_SIGNER_EMAIL_BE4HOPE: z.string().email().default('contato@be4hope.org'),
  DOCUSIGN_SIGNER_NAME_BE4HOPE: z.string().default('Associação Be4Hope'),
  DOCUSIGN_PRIVATE_KEY: z.string().optional(),

  // ── WhatsApp (contato Be4Hope) ────────────────────────────────
  NEXT_PUBLIC_WHATSAPP_BEHEMP: z.string().default('5511932047360'),

  // ── Gemini 2.5 Flash (Transcrição de Teleconsultas) ─────────
  GOOGLE_API_KEY: z.string().optional(),
  GEMINI_NORMALIZE_MODEL: z.string().default('gemini-2.5-flash'),
});

/**
 * Exporta as variáveis de ambiente validadas.
 * Usar `env.DATABASE_URL` ao invés de `process.env.DATABASE_URL` garante type safety.
 */
export const env = envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>;
