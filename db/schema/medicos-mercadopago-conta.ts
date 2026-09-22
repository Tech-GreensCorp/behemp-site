import { pgTable, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { baseColumns, softDeleteColumn } from './_helpers';
import { medicos } from './medicos';

/**
 * A conta do médico no Mercado Pago — o vínculo OAuth, não a cobrança.
 *
 * ## Por que tabela própria, e não colunas em `pagamentos`
 *
 * São conceitos de cardinalidade diferente, e misturá-los é o erro clássico:
 *
 * | | `pagamentos` | esta tabela |
 * | - | ------------ | ----------- |
 * | uma linha por | **consulta** (`uniqueIndex` em `consultaId`) | **médico** (`unique` em `medicoId`) |
 * | natureza | transacional — nasce e termina com a cobrança | configuração — persiste entre cobranças |
 * | guarda | `gatewayReferenciaId`, `gatewayCheckoutUrl` | credencial de acesso à conta |
 *
 * `pagamentos.gatewayProvider/gatewayReferenciaId/gatewayCheckoutUrl` continuam sendo o lugar
 * do lado transacional e **serão reaproveitadas** — hoje são `NULL` em toda linha e nenhum
 * fluxo as escreve (medido em 22/09/2026: 7 pontos de `insert`/`update` em `pagamentos`,
 * nenhum as menciona). O comentário de `pagamentos.ts` ainda diz "para quando o Gather
 * existir"; ele muda no commit em que passarem a ser escritas, não antes.
 *
 * A irmã mais próxima é `medicos_pagamento_config` — mesma cardinalidade, mesmo papel de
 * configuração por médico —, e esta tabela segue a convenção dela.
 *
 * ## 🔴 As três perguntas de `.claude/rules/seguranca-lgpd.md`
 *
 * **1. Quem pode ler?** `admin` e o próprio médico dono da linha. Papel não basta: toda
 * leitura resolve o `medicoId` pela SESSÃO, nunca por id vindo do cliente — papel certo com id
 * alheio é OWASP API1 (BOLA), o risco número um deste projeto. O token decifrado não vai para
 * client component, nem para log, nem para tela: ele existe só dentro da chamada de servidor
 * que fala com o Mercado Pago.
 *
 * **2. Quanto tempo fica?** Enquanto o vínculo existir. Ao desconectar, a linha **não se
 * apaga**: grava-se `desconectadoEm` e os dois campos cifrados vão a `NULL` — o registro de
 * que houve vínculo é auditoria e sobrevive; a credencial, que é o que dá poder, não. O prazo
 * de retenção do registro em si é decisão do Jurídico e por isso não está chutado aqui.
 *
 * **3. O acesso é auditado?** ⏳ **PENDENTE, e de propósito.** `registrarAuditoria` entra nos
 * pontos que DECIFRAM o token, e esses pontos ainda não existem — eles nascem com o endpoint
 * de cobrança. Um `registrarAuditoria` aqui no schema não teria o que registrar. A regra a
 * cumprir quando chegar a hora: **decifrar é o evento auditável**, não ler a linha.
 *
 * ## Por que `*Cifrado` no nome da coluna
 *
 * O nome declara o conteúdo. `db/schema/medicos.ts:27` mostra o custo de não fazer isso: lá a
 * coluna se chama `googleRefreshToken` e um comentário afirma `// Criptografado em produção`
 * — e não é, em nenhum dos 13 pontos que a usam. Comentário não é garantia; nome que mente
 * é pior que nome ausente, porque quem lê acredita. Aqui, um valor em claro nestas colunas
 * contradiz o próprio nome.
 *
 * A cifra é AES-256-GCM, em `lib/seguranca/cifra.ts`, e é a primeira do repositório.
 *
 * ⚠️ **Sem `MERCADOPAGO_TOKEN_ENCRYPTION_KEY` no processo, `cifrar()` LANÇA** — a conexão
 * falha em vez de gravar credencial em claro. A variável precisa entrar na lista `gravar` do
 * `.github/workflows/deploy.yml`: cadastrar o secret no GitHub **não basta**, e neste
 * repositório essa exata falha já aconteceu três vezes.
 */
export const medicosMercadopagoConta = pgTable(
  'medicos_mercadopago_conta',
  {
    ...baseColumns,
    /** `unique`: um médico tem no máximo uma conta do Mercado Pago vinculada por vez. */
    medicoId: text('medico_id')
      .notNull()
      .unique()
      .references(() => medicos.id),

    /** O `user_id` da conta no Mercado Pago. Público por natureza — identifica, não autoriza. */
    mpUserId: text('mp_user_id'),

    /**
     * 🔴 CIFRADO. Autoriza cobrar em nome do médico — é o campo de maior poder desta tabela.
     * Gravado só por `lib/seguranca/cifra.ts`; nunca recebe valor em claro.
     */
    accessTokenCifrado: text('access_token_cifrado'),

    /** 🔴 CIFRADO. Renova o access token sem o médico reautorizar — vida longa, poder igual. */
    refreshTokenCifrado: text('refresh_token_cifrado'),

    /** Quando o access token expira, segundo o Mercado Pago. Guia a renovação. */
    tokenExpiraEm: timestamp('token_expira_em', { withTimezone: true }),

    /** Quando o vínculo foi estabelecido. */
    conectadoEm: timestamp('conectado_em', { withTimezone: true }).notNull().defaultNow(),

    /**
     * Quando o médico desconectou a conta. `NULL` = vínculo ativo.
     *
     * 🔴 A LINHA NUNCA É APAGADA. Desconectar preenche esta coluna e zera os dois campos
     * cifrados. Assim o histórico de que houve vínculo — e quando terminou — sobrevive, e a
     * credencial não. É a regra 4 do `CLAUDE.md`: alteração preserva o anterior e a data.
     */
    desconectadoEm: timestamp('desconectado_em', { withTimezone: true }),

    ...softDeleteColumn,
  },
  (table) => [
    uniqueIndex('medicos_mercadopago_conta_medico_idx').on(table.medicoId),
    index('medicos_mercadopago_conta_mp_user_idx').on(table.mpUserId),
  ],
);
