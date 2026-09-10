import { eq, sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import { parceiroEventosSaida } from '@/db/schema';

import { assinar } from './assinatura';

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

/** Status HTTP que vale tentar de novo. 4xx (menos 429) é erro nosso: insistir não conserta. */
const VALE_TENTAR_DE_NOVO = new Set([408, 429, 500, 502, 503, 504]);

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

  estaConfigurado(): boolean {
    return Boolean(this.baseUrl?.trim() && this.segredo?.trim());
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
   RETURNING id, parceiro, tipo, payload, tentativas
    `);

    const registros = Array.isArray(linhas)
      ? linhas
      : ((linhas as { rows?: unknown[] }).rows ?? []);
    return (registros as Record<string, unknown>[]).map((l) => ({
      id: String(l.id),
      tipo: String(l.tipo),
      payload: l.payload as Record<string, unknown>,
      tentativas: Number(l.tentativas ?? 1),
    }));
  }

  private async entregar(evento: {
    id: string;
    tipo: string;
    payload: Record<string, unknown>;
    tentativas: number;
  }): Promise<'entregue' | 'reagendado' | 'falhou'> {
    const corpo = JSON.stringify(evento.payload);
    const timestamp = String(Math.floor(Date.now() / 1000));

    /**
     * 🔴 O ID DO EVENTO É O ID DA LINHA — e portanto ESTÁVEL entre tentativas.
     *
     * Se fosse gerado a cada envio, cada retry chegaria como fato novo do outro lado, e a
     * deduplicação deles não teria por onde pegar. Um evento reenviado cinco vezes viraria
     * cinco avisos.
     */
    const assinatura = assinar(evento.id, timestamp, corpo, this.segredo!);

    try {
      const resposta = await fetch(`${this.baseUrl!.replace(/\/+$/, '')}${this.caminho}`, {
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
