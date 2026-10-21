/**
 * A CONTA DE MERCADO PAGO DO MÉDICO — ler, conectar e desconectar.
 *
 * Este módulo é o ÚNICO lugar que decifra os tokens. Quem precisar deles chama daqui; quem
 * só precisa saber se o médico está conectado usa `estaConectado`, que não decifra nada.
 *
 * ## 🔴 A REGRA DE AUDITORIA (ADR-0024 §5, item 7)
 *
 * **Decifrar é o evento auditável, não ler a linha.** Saber que existe vínculo não expõe
 * credencial nenhuma; decifrar expõe o token que cobra em nome do médico. Por isso
 * `obterContaConectada` exige `userId` para auditar, e `estaConectado` não exige nada.
 *
 * ⚠️ Auditar a leitura da linha em vez da decifragem seria o pior dos dois mundos: infla o
 * registro com eventos inócuos — e registro inflado é pior que ausente, porque parece
 * prova — enquanto o acesso que importa se perde no meio.
 *
 * ## 🔴 AVISO PARA QUEM FOR IMPLEMENTAR A RENOVAÇÃO (não está aqui — Parte 2)
 *
 * O `refresh_token` do Mercado Pago **ROTACIONA**. A doc oficial é literal:
 *
 *   _"every time you refresh the `access_token`, the `refresh_token` will also be
 *   refreshed, so you will need to store it again."_
 *
 * Portanto a função de renovação precisa regravar **OS DOIS** campos cifrados. Salvar só o
 * `accessTokenCifrado` — que é o que a intuição manda, porque "o que expirou foi o access"
 * — deixa gravado um refresh token **já invalidado**: a renovação seguinte falha, e o
 * médico precisa refazer o OAuth inteiro sem ninguém entender por quê. O sintoma aparece
 * 180 dias depois, que é quando ninguém lembra desta decisão.
 *
 * Fonte:
 *   https://www.mercadopago.com.br/developers/en/docs/split-payments/additional-content/security/oauth/renewal
 */

import { and, eq, isNull } from 'drizzle-orm';

import { medicosMercadopagoConta } from '@/db/schema';
import { db } from '@/lib/db';
import { cifrar, decifrar } from '@/lib/seguranca/cifra';
import { registrarAuditoria } from '@/lib/utils/audit';

/** O que a tela precisa saber — e nada além disso. Nenhum campo cifrado aparece aqui. */
export interface StatusDaConta {
  conectado: boolean;
  mpUserId: string | null;
  conectadoEm: Date | null;
  desconectadoEm: Date | null;
}

/**
 * O médico tem vínculo ATIVO?
 *
 * 🔴 NÃO DECIFRA NADA, e é por isso que pode ser chamada de qualquer lugar — inclusive do
 * fluxo público de agendamento, onde não há médico logado para auditar. Ela responde
 * "existe linha, sem `desconectadoEm` e sem `deletedAt`", que é uma pergunta sobre
 * configuração, não sobre credencial.
 */
export async function estaConectado(medicoId: string): Promise<boolean> {
  if (!medicoId?.trim()) return false;
  const [linha] = await db
    .select({ id: medicosMercadopagoConta.id })
    .from(medicosMercadopagoConta)
    .where(
      and(
        eq(medicosMercadopagoConta.medicoId, medicoId),
        isNull(medicosMercadopagoConta.desconectadoEm),
        isNull(medicosMercadopagoConta.deletedAt),
      ),
    )
    .limit(1);
  return Boolean(linha);
}

/**
 * 🔴 O INTERRUPTOR DO ROLLOUT — só `'ativo'` bloqueia agendamento.
 *
 * Mora aqui, e não em `app/(public)/_actions/agendamento.ts`, por dois motivos:
 *
 *   1. **cobertura de guarda.** `o-segredo-cadastrado-chega-ao-servidor` deriva as
 *      variáveis do código, mas só dentro das áreas que ele varre — e `app/(public)` não é
 *      uma delas. Lida daqui, a variável nasce coberta, e a falha de "cadastrei o secret e
 *      ele nunca chegou ao processo" — três vezes neste repositório — não se repete;
 *   2. quem decide sobre a conta do Mercado Pago é este módulo.
 *
 * Lida a cada chamada, de propósito: virar a flag é trocar o secret e reiniciar, sem um
 * módulo segurando o valor antigo numa constante de topo.
 */
export function bloqueioDeAgendamentoAtivo(): boolean {
  return process.env.MERCADOPAGO_BLOQUEIO_AGENDAMENTO_ATIVO?.trim() === 'ativo';
}

export interface PermissaoDeAgendamento {
  /** `false` só quando o bloqueio está ATIVO e o médico não conectou. */
  permitido: boolean;
  /** O fato, independente da flag — é o que o log precisa para o rollout ser medido. */
  conectado: boolean;
  bloqueioAtivo: boolean;
}

/**
 * O paciente pode agendar com este médico?
 *
 * ⚠️ SEPARA O FATO DA DECISÃO de propósito. `conectado` diz o que É; `permitido` diz o que
 * FAZEMOS com isso hoje. Com a flag inativa, os dois divergem — e é essa divergência que
 * permite medir quantos médicos ainda faltam ANTES de ligar o bloqueio, em vez de
 * descobrir pelo paciente.
 *
 * 🛑 NÃO DECIFRA NADA. Chamada de fluxo público, onde não há médico logado para auditar o
 * acesso (ADR-0024 §5).
 */
export async function podeAgendarCom(medicoId: string): Promise<PermissaoDeAgendamento> {
  const conectado = await estaConectado(medicoId);
  const bloqueioAtivo = bloqueioDeAgendamentoAtivo();
  return { permitido: conectado || !bloqueioAtivo, conectado, bloqueioAtivo };
}

/** O status para a tela. Também não decifra — só metadado. */
export async function obterStatus(medicoId: string): Promise<StatusDaConta> {
  const [linha] = await db
    .select({
      mpUserId: medicosMercadopagoConta.mpUserId,
      conectadoEm: medicosMercadopagoConta.conectadoEm,
      desconectadoEm: medicosMercadopagoConta.desconectadoEm,
    })
    .from(medicosMercadopagoConta)
    .where(
      and(
        eq(medicosMercadopagoConta.medicoId, medicoId),
        isNull(medicosMercadopagoConta.deletedAt),
      ),
    )
    .limit(1);

  if (!linha) {
    return { conectado: false, mpUserId: null, conectadoEm: null, desconectadoEm: null };
  }
  return {
    conectado: linha.desconectadoEm === null,
    mpUserId: linha.mpUserId,
    conectadoEm: linha.conectadoEm,
    desconectadoEm: linha.desconectadoEm,
  };
}

export interface CredenciaisDoMedico {
  accessToken: string;
  refreshToken: string;
  mpUserId: string | null;
  expiraEm: Date | null;
}

/**
 * 🔴 O ÚNICO PONTO QUE DECIFRA. Toda chamada é AUDITADA — ADR-0024 §5.
 *
 * Devolve `null` quando não há vínculo ativo ou quando os campos estão vazios (uma conta
 * desconectada preserva a linha e zera os cifrados).
 *
 * ⚠️ O retorno tem o token EM CLARO. Ele existe só dentro da chamada de servidor que fala
 * com o Mercado Pago: não vai para client component, log, tela ou mensagem de erro.
 *
 * @param userId o `users.id` de quem está acessando — é o que a auditoria registra. `null`
 *   quando NÃO há pessoa: o webhook do Mercado Pago confirmando um pagamento (Decisão 6 da
 *   Parte 2). O `motivo` diz quem agiu; inventar um id faria o registro mentir.
 */
export async function obterContaConectada(
  medicoId: string,
  userId: string | null,
  motivo: string,
): Promise<CredenciaisDoMedico | null> {
  const [linha] = await db
    .select()
    .from(medicosMercadopagoConta)
    .where(
      and(
        eq(medicosMercadopagoConta.medicoId, medicoId),
        isNull(medicosMercadopagoConta.desconectadoEm),
        isNull(medicosMercadopagoConta.deletedAt),
      ),
    )
    .limit(1);

  if (!linha?.accessTokenCifrado || !linha.refreshTokenCifrado) return null;

  // A auditoria vem ANTES da decifragem: se `decifrar` lançar (chave trocada, conteúdo
  // adulterado), a tentativa de acesso continua registrada. Registro que só existe no
  // caminho feliz não serve para investigar incidente.
  await registrarAuditoria({
    userId,
    acao: 'visualizar',
    entidade: 'medicos_mercadopago_conta',
    entidadeId: linha.id,
    // ⚠️ Nada de token aqui, nem cifrado. Só o porquê e o identificador público da conta.
    dadosDepois: { motivo, mpUserId: linha.mpUserId },
  });

  return {
    accessToken: decifrar(linha.accessTokenCifrado),
    refreshToken: decifrar(linha.refreshTokenCifrado),
    mpUserId: linha.mpUserId,
    expiraEm: linha.tokenExpiraEm,
  };
}

export interface TokensParaGravar {
  accessToken: string;
  refreshToken: string;
  mpUserId: string;
  expiraEm: Date;
}

/**
 * Grava o vínculo — CIFRANDO os dois tokens.
 *
 * ⚠️ `cifrar` LANÇA sem `MERCADOPAGO_TOKEN_ENCRYPTION_KEY`, e é o comportamento certo: a
 * conexão falha em vez de gravar credencial em claro. Quem chama trata e mostra erro.
 *
 * Upsert pela unique de `medicoId`: reconectar depois de desconectar REUSA a linha e
 * limpa `desconectadoEm` — a linha é o histórico do vínculo, não de uma sessão dele.
 */
export async function conectar(
  medicoId: string,
  tokens: TokensParaGravar,
  userId: string,
): Promise<void> {
  const valores = {
    mpUserId: tokens.mpUserId,
    accessTokenCifrado: cifrar(tokens.accessToken),
    refreshTokenCifrado: cifrar(tokens.refreshToken),
    tokenExpiraEm: tokens.expiraEm,
    conectadoEm: new Date(),
    desconectadoEm: null,
  };

  await db
    .insert(medicosMercadopagoConta)
    .values({ medicoId, ...valores })
    .onConflictDoUpdate({ target: medicosMercadopagoConta.medicoId, set: valores });

  await registrarAuditoria({
    userId,
    acao: 'criar',
    entidade: 'medicos_mercadopago_conta',
    entidadeId: medicoId,
    // Só metadado: qual conta do MP e até quando o token vale. Nunca o token.
    dadosDepois: { mpUserId: tokens.mpUserId, tokenExpiraEm: tokens.expiraEm.toISOString() },
  });
}

/**
 * Desfaz o vínculo.
 *
 * 🔴 A LINHA NÃO É APAGADA — carimba `desconectadoEm` e zera os dois cifrados. O registro
 * de que houve vínculo, e quando terminou, é auditoria e sobrevive; a credencial, que é o
 * que dá poder, não. Proibição 4 do CLAUDE.md e D-05 da ADR-0024.
 *
 * ⚠️ Zerar os cifrados é o que torna isto diferente de "marcar como inativo": um registro
 * inativo com o token ainda gravado continua sendo uma credencial guardada sem finalidade.
 */
export async function desconectar(medicoId: string, userId: string): Promise<void> {
  await db
    .update(medicosMercadopagoConta)
    .set({
      desconectadoEm: new Date(),
      accessTokenCifrado: null,
      refreshTokenCifrado: null,
      tokenExpiraEm: null,
    })
    .where(eq(medicosMercadopagoConta.medicoId, medicoId));

  await registrarAuditoria({
    userId,
    acao: 'atualizar',
    entidade: 'medicos_mercadopago_conta',
    entidadeId: medicoId,
    dadosDepois: { desconectado: true },
  });
}
