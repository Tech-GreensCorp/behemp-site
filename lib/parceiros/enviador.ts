import { eq, sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import { parceiroEventosSaida } from '@/db/schema';

import { assinar } from './assinatura';
import { destinoDoEvento, type TipoDeEvento } from './destinos-do-envio';
import { consentimentoAindaVale } from './consentimento-ainda-vale';

/**
 * ENTREGA OS AVISOS PENDENTES AO PARCEIRO (ADR-0016 D-09).
 *
 * 🔴 CLAIM ATÔMICO, pelo mesmo motivo do processador do ChatPro: dois disparos de cron
 * concorrentes — o que acontece sozinho quando um atrasa — pegariam a mesma linha e
 * enviariam o aviso duas vezes. `FOR UPDATE SKIP LOCKED` faz quem perde a corrida não
 * enxergar a linha, em vez de enxergar e duplicar.
 */
const MAXIMO_DE_TENTATIVAS = 6;
const TAMANHO_DO_LOTE = 20;
const TIMEOUT_MS = 10_000;

/**
 * Status HTTP que vale tentar de novo. 4xx costuma ser erro nosso — corpo ou assinatura
 * errados não se consertam insistindo.
 *
 * 🔴 O 404 É A EXCEÇÃO, E ENTROU DEPOIS DE UMA MEDIÇÃO.
 *
 * A regra "4xx não se retenta" está certa em geral e erra justamente aqui, porque 404 tem
 * duas causas que a resposta não distingue:
 *
 *   · caminho errado no nosso lado    → permanente; insistir não resolve
 *   · a rota ainda não foi publicada  → TEMPORÁRIO, e é o estado real da Greens hoje:
 *     `api.greens-corp.com/health` responde 200 e a rota de retorno responde 404, porque
 *     ela existe na branch e não em produção
 *
 * E há um terceiro caso, que acontece toda semana: **um deploy em andamento devolve 404
 * por alguns segundos**. Sem retry, um aviso que caísse nessa janela morreria.
 *
 * Retentar custa pouco — seis tentativas com backoff até 60 min dão ~2 h — e no fim vira
 * `falhou` visível do mesmo jeito. Não retentar custa o aviso.
 */
const VALE_TENTAR_DE_NOVO = new Set([404, 408, 429, 500, 502, 503, 504]);

export interface ResultadoDoEnvio {
  reivindicados: number;
  entregues: number;
  reagendados: number;
  falharam: number;
  configurado: boolean;
}

/**
 * Espera antes da próxima tentativa: 1min, 2, 4, 8, 16, 32.
 *
 * Cresce rápido de propósito. Se a Greens está fora, insistir de minuto em minuto não a
 * traz de volta — só enche o log e gasta a janela do cron com o mesmo evento.
 */
function esperaEmMinutos(tentativa: number): number {
  return Math.min(2 ** Math.max(0, tentativa - 1), 60);
}

export class EnviadorDeAvisos {
  constructor(
    private baseUrl = process.env.PARCEIRO_GREENS_API_URL,
    private segredo = process.env.PARCEIRO_GREENS_SEGREDO_SAIDA,
    /**
     * O caminho da rota do parceiro.
     *
     * ⚠️ CONFIGURÁVEL PORQUE EU JÁ ERREI ESTE VALOR UMA VEZ. Escrevi
     * `/api/parceiros/behemp/atualizacao` no contrato; a Greens versiona a API e
     * implementou em `/api/v1/...`. O default abaixo é o caminho real, acordado com eles
     * em 09/09/2026 — e a variável existe para que a próxima divergência de rota seja um
     * ajuste de ambiente, não um deploy.
     *
     * Um caminho errado se manifesta como 404, que **não** é retentável: o evento vira
     * `falhou` na primeira tentativa e aparece no diagnóstico em vez de girar em silêncio.
     */
    private caminho = process.env.PARCEIRO_GREENS_CAMINHO_RETORNO?.trim() ||
      '/api/v1/parceiros/behemp/atualizacao',
  ) {}

  /**
   * ⚠️ AGORA HÁ DOIS PARES (§7 do contrato-ponte, 11/09/2026): o aviso e o cadastro. A fila é
   * uma só, então basta **um** deles estar configurado para valer a pena reivindicar — o
   * evento cujo par falta espera, em vez de gastar tentativa contra um destino inexistente.
   */
  estaConfigurado(): boolean {
    return Boolean(
      this.baseUrl?.trim() &&
        (this.segredo?.trim() || process.env.PARCEIRO_GREENS_SEGREDO_CADASTRO?.trim()),
    );
  }

  async enviarLote(limite = TAMANHO_DO_LOTE): Promise<ResultadoDoEnvio> {
    if (!this.estaConfigurado()) {
      /**
       * 🔴 NÃO REIVINDICA NADA quando falta configuração.
       *
       * Se reivindicasse, cada disparo do cron gastaria uma tentativa de cada evento
       * contra um destino que não existe — e em seis disparos a fila inteira estaria
       * `falhou`, com avisos legítimos perdidos porque uma variável não foi preenchida.
       * Sem configuração, a fila espera.
       */
      console.warn('[parceiros] envio não configurado — a fila aguarda');
      return { reivindicados: 0, entregues: 0, reagendados: 0, falharam: 0, configurado: false };
    }

    const eventos = await this.reivindicar(limite);
    const resultado: ResultadoDoEnvio = {
      reivindicados: eventos.length,
      entregues: 0,
      reagendados: 0,
      falharam: 0,
      configurado: true,
    };

    for (const evento of eventos) {
      const desfecho = await this.entregar(evento);
      if (desfecho === 'entregue') resultado.entregues++;
      else if (desfecho === 'reagendado') resultado.reagendados++;
      else resultado.falharam++;
    }

    return resultado;
  }

  /** Reivindica os pendentes cuja hora já chegou, marcando-os no mesmo comando. */
  private async reivindicar(limite: number) {
    const linhas = await db.execute(sql`
      UPDATE parceiro_eventos_saida
         SET status = 'enviando',
             tentativas = tentativas + 1,
             updated_at = now()
       WHERE id IN (
             SELECT id
               FROM parceiro_eventos_saida
              WHERE status = 'pendente'
                AND (proxima_tentativa_em IS NULL OR proxima_tentativa_em <= now())
              ORDER BY created_at
              LIMIT ${limite}
                FOR UPDATE SKIP LOCKED
       )
   RETURNING id, parceiro, tipo, payload, tentativas, solicitacao_id
    `);

    const registros = Array.isArray(linhas)
      ? linhas
      : ((linhas as { rows?: unknown[] }).rows ?? []);
    return (registros as Record<string, unknown>[]).map((l) => ({
      id: String(l.id),
      tipo: l.tipo as TipoDeEvento,
      payload: l.payload as Record<string, unknown>,
      tentativas: Number(l.tentativas ?? 1),
      /** Por ela se chega ao paciente, e por ele ao consentimento (D-14). */
      solicitacaoId: l.solicitacao_id == null ? null : String(l.solicitacao_id),
    }));
  }

  private async entregar(evento: {
    id: string;
    tipo: TipoDeEvento;
    payload: Record<string, unknown>;
    tentativas: number;
    solicitacaoId: string | null;
  }): Promise<'entregue' | 'reagendado' | 'falhou'> {
    /**
     * 🔴 O CONSENTIMENTO É RELIDO AQUI, IMEDIATAMENTE ANTES DO POST — ADR-0022 D-14.
     *
     * Ele era conferido UMA VEZ, ao enfileirar, e o `payload` ficava congelado. Entre
     * enfileirar e enviar passam **horas** (fila a cada 5 min, backoff de até 60 min): se o
     * paciente revogasse nesse intervalo, o dado saía assim mesmo.
     *
     * ⚠️ LGPD art. 8º §5º — a revogação é "a qualquer momento". Sem esta releitura era "até
     * a fila rodar", e o paciente não tinha como saber quando isso foi.
     *
     * ⚠️ NÃO REAGENDA: revogação não é falha transitória. Reagendar faria o sistema tentar de
     * novo, e de novo, contra uma decisão do paciente que não vai mudar sozinha.
     */
    if (evento.solicitacaoId) {
      const veredicto = await consentimentoAindaVale(evento.solicitacaoId, evento.tipo);
      if (!veredicto.pode) {
        console.warn('[parceiros] envio barrado pelo consentimento', {
          // Nunca o paciente nem o conteúdo — só o fato e o motivo.
          tipo: evento.tipo,
          motivo: veredicto.motivo,
        });
        return this.marcarFalha(evento.id, `consentimento: ${veredicto.motivo}`);
      }
    }

    const corpo = JSON.stringify(evento.payload);
    const timestamp = String(Math.floor(Date.now() / 1000));

    /**
     * 🔴 CADA TIPO TEM O SEU DESTINO E O SEU SEGREDO. O aviso vai para a rota de atualização;
     * o cadastro (S2) vai para outra rota, com outra chave. Ver `destinos-do-envio.ts`.
     */
    const destino = destinoDoEvento(evento.tipo);
    if (!destino.segredo?.trim()) {
      /**
       * ⚠️ REAGENDA, NÃO FALHA. Falta de configuração é estado nosso e temporário — marcar
       * `falhou` perderia o evento por uma variável que alguém ainda vai preencher.
       */
      return this.reagendar(evento.id, evento.tentativas, `sem ${destino.nomeDaVariavelDoSegredo}`);
    }

    /**
     * 🔴 O ID DO EVENTO É O ID DA LINHA — e portanto ESTÁVEL entre tentativas.
     *
     * Se fosse gerado a cada envio, cada retry chegaria como fato novo do outro lado, e a
     * deduplicação deles não teria por onde pegar. Um evento reenviado cinco vezes viraria
     * cinco avisos.
     */
    const assinatura = assinar(evento.id, timestamp, corpo, destino.segredo);

    try {
      const resposta = await fetch(`${this.baseUrl!.replace(/\/+$/, '')}${destino.caminho}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-parceiro-evento-id': evento.id,
          'x-parceiro-timestamp': timestamp,
          'x-parceiro-assinatura': assinatura,
        },
        body: corpo,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (resposta.ok) {
        await db
          .update(parceiroEventosSaida)
          .set({ status: 'enviado', enviadoEm: new Date(), ultimoErro: null })
          .where(eq(parceiroEventosSaida.id, evento.id));
        return 'entregue';
      }

      // 4xx que não seja 429: o corpo ou a assinatura estão errados, e insistir não muda
      // isso. Vira falha definitiva para aparecer no diagnóstico em vez de girar em vão.
      if (!VALE_TENTAR_DE_NOVO.has(resposta.status)) {
        return this.marcarFalha(evento.id, `http ${resposta.status}`);
      }
      return this.reagendar(evento.id, evento.tentativas, `http ${resposta.status}`);
    } catch (erro) {
      const motivo = erro instanceof Error ? erro.name : 'erro de rede';
      return this.reagendar(evento.id, evento.tentativas, motivo);
    }
  }

  private async reagendar(
    id: string,
    tentativas: number,
    motivo: string,
  ): Promise<'reagendado' | 'falhou'> {
    if (tentativas >= MAXIMO_DE_TENTATIVAS) return this.marcarFalha(id, motivo);

    const proxima = new Date(Date.now() + esperaEmMinutos(tentativas) * 60 * 1000);
    await db
      .update(parceiroEventosSaida)
      .set({ status: 'pendente', proximaTentativaEm: proxima, ultimoErro: motivo.slice(0, 300) })
      .where(eq(parceiroEventosSaida.id, id));
    return 'reagendado';
  }

  private async marcarFalha(id: string, motivo: string): Promise<'falhou'> {
    await db
      .update(parceiroEventosSaida)
      // Fica como `falhou` no banco, não some: alguém precisa poder ver o que não chegou.
      .set({ status: 'falhou', ultimoErro: motivo.slice(0, 300) })
      .where(eq(parceiroEventosSaida.id, id));
    console.error('[parceiros] aviso não entregue, esgotou as tentativas', { motivo });
    return 'falhou';
  }
}
