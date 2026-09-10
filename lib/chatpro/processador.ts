import { and, eq, sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import { chatproEventos, chatproSessoes, solicitacoesCadastro } from '@/db/schema';

import { ServicoDeDiretorio } from './diretorio';
import { ClienteChatpro } from './cliente';
import { mascararTelefone, normalizarTelefoneWhatsapp, removerSufixoWhatsapp } from './telefone';

/**
 * Acima disto o evento vira `falhou` e para de ser tentado.
 *
 * O número é baixo de propósito: reprocessar indefinidamente um evento que sempre falha
 * consome a janela do cron e esconde os eventos novos atrás dele. Cinco tentativas com
 * intervalo de cron dão folga suficiente para uma indisponibilidade passageira da API.
 */
const MAXIMO_DE_TENTATIVAS = 5;

/** Quantos eventos um disparo do processador reivindica. */
const TAMANHO_DO_LOTE = 25;

/**
 * Eventos que o ChatPro emite e que NÃO alteram o funil. Chegam, são registrados para
 * auditoria e viram `descartado` sem custo — melhor que ficarem pendentes para sempre
 * fingindo que há trabalho a fazer.
 */
const EVENTOS_SEM_EFEITO = new Set(['ping', 'test', 'webhook_test']);

export interface ResultadoDoProcessamento {
  reivindicados: number;
  processados: number;
  descartados: number;
  falharam: number;
}

/**
 * CONSOME A FILA DE EVENTOS DO WEBHOOK.
 *
 * 🔴 POR QUE ISTO NÃO ACONTECE DENTRO DO REQUEST DO WEBHOOK
 * O handler grava e responde `202` em milissegundos. Se ele processasse aqui, uma
 * chamada lenta à API do ChatPro estouraria o timeout da plataforma, que reentregaria o
 * mesmo evento — multiplicando exatamente o problema que a deduplicação existe para
 * resolver. Regra de ouro: recebe, grava, responde; processa depois.
 *
 * 🔴 E POR QUE O CLAIM É ATÔMICO
 * Armadilha 7 do greens-corp, um defeito real: o worker listava os pendentes e só mudava
 * o status ao TERMINAR. Duas execuções concorrentes pegavam a mesma linha e o funil
 * registrou 4 etapas onde deviam existir 3. Aqui a reivindicação é um único `UPDATE ...
 * WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED)`: quem perde a corrida não enxerga a
 * linha, em vez de enxergar e duplicar.
 */
export class ProcessadorDeEventos {
  constructor(
    private cliente = new ClienteChatpro(),
    private diretorio = new ServicoDeDiretorio(cliente),
  ) {}

  async processarLote(limite = TAMANHO_DO_LOTE): Promise<ResultadoDoProcessamento> {
    const eventos = await this.reivindicar(limite);
    const resultado: ResultadoDoProcessamento = {
      reivindicados: eventos.length,
      processados: 0,
      descartados: 0,
      falharam: 0,
    };

    for (const evento of eventos) {
      try {
        const efeito = await this.aplicar(evento);
        await db
          .update(chatproEventos)
          .set({ status: efeito, processadoEm: new Date(), ultimoErro: null })
          .where(eq(chatproEventos.id, evento.id));
        if (efeito === 'processado') resultado.processados++;
        else resultado.descartados++;
      } catch (erro) {
        const esgotou = evento.tentativas + 1 >= MAXIMO_DE_TENTATIVAS;
        await db
          .update(chatproEventos)
          .set({
            // Não esgotou: volta para a fila e o próximo disparo tenta de novo.
            status: esgotou ? 'falhou' : 'pendente',
            // 🔴 Mensagem do erro, NUNCA o payload — ele carrega dado do paciente.
            ultimoErro: erro instanceof Error ? erro.message.slice(0, 500) : 'erro desconhecido',
            processadoEm: esgotou ? new Date() : null,
          })
          .where(eq(chatproEventos.id, evento.id));
        if (esgotou) resultado.falharam++;
        console.error('[chatpro] processador: evento falhou', {
          evento: evento.evento,
          tentativa: evento.tentativas + 1,
          esgotou,
        });
      }
    }

    return resultado;
  }

  /**
   * Reivindica até `limite` eventos pendentes, marcando-os `processando` no MESMO comando.
   *
   * `FOR UPDATE SKIP LOCKED` é o que torna seguro rodar dois processadores ao mesmo tempo
   * — cenário que acontece sozinho quando um cron atrasa e o seguinte dispara. Sem ele, a
   * segunda execução leria as mesmas linhas antes da primeira as marcar.
   */
  private async reivindicar(limite: number) {
    const linhas = await db.execute<{
      id: string;
      evento: string;
      session_id: string;
      lead_id: string | null;
      payload: unknown;
      tentativas: number;
    }>(sql`
      UPDATE chatpro_eventos
         SET status = 'processando',
             tentativas = tentativas + 1,
             updated_at = now()
       WHERE id IN (
             SELECT id
               FROM chatpro_eventos
              WHERE status = 'pendente'
              ORDER BY created_at
              LIMIT ${limite}
                FOR UPDATE SKIP LOCKED
       )
   RETURNING id, evento, session_id, lead_id, payload, tentativas
    `);

    const registros = Array.isArray(linhas)
      ? linhas
      : ((linhas as { rows?: unknown[] }).rows ?? []);
    return (registros as Record<string, unknown>[]).map((l) => ({
      id: String(l.id),
      evento: String(l.evento),
      sessionId: String(l.session_id),
      leadId: l.lead_id ? String(l.lead_id) : null,
      payload: (l.payload ?? {}) as Record<string, unknown>,
      // O `tentativas` que volta já está incrementado pelo próprio UPDATE.
      tentativas: Number(l.tentativas ?? 1) - 1,
    }));
  }

  /**
   * Aplica um evento à projeção da conversa.
   *
   * 🔴 CONFIRMAÇÃO REVERSA (ADR-0002 do greens-corp): o payload é PONTEIRO, não verdade.
   * O ChatPro não assina os webhooks — não há HMAC, segredo de corpo nem lista de IPs
   * publicada. Então nada que venha no corpo é gravado como fato sobre o paciente: o
   * corpo diz QUAL conversa olhar, e quem responde quem é o paciente é uma chamada
   * autenticada de volta à API. Nome, telefone e vínculo com a solicitação vêm de lá.
   */
  private async aplicar(evento: {
    id: string;
    evento: string;
    sessionId: string;
    leadId: string | null;
    payload: Record<string, unknown>;
  }): Promise<'processado' | 'descartado'> {
    if (EVENTOS_SEM_EFEITO.has(evento.evento)) return 'descartado';

    const dados = this.dadosDaSessao(evento.payload);

    // O `lead_id` do corpo é só uma pista. Se não veio, pergunta à API qual é.
    let leadId = evento.leadId ?? dados.leadId;
    if (!leadId && evento.sessionId) {
      leadId = await this.cliente.buscarLeadIdPorSessao(evento.sessionId);
    }

    const [departamentoNome, motivoNome] = await Promise.all([
      this.diretorio.nomeDe('departamento', dados.departamentoId),
      this.diretorio.nomeDe('motivo_encerramento', dados.motivoId),
    ]);

    const solicitacaoId = await this.vincularSolicitacao(leadId, evento.sessionId);
    const agora = new Date();
    const fechou = evento.evento === 'closed_session';
    const abriu = evento.evento === 'opened_session';

    await db
      .insert(chatproSessoes)
      .values({
        sessionId: evento.sessionId,
        leadId,
        solicitacaoId,
        departamentoId: dados.departamentoId,
        departamentoNome,
        motivoEncerramentoId: dados.motivoId,
        motivoEncerramentoNome: motivoNome,
        aberta: !fechou,
        abertaEm: abriu ? agora : null,
        fechadaEm: fechou ? agora : null,
        ultimoEvento: evento.evento,
        ultimoEventoEm: agora,
        mensagensRecebidas: evento.evento === 'received_message' ? 1 : 0,
        mensagensEnviadas: evento.evento === 'sent_message' ? 1 : 0,
      })
      .onConflictDoUpdate({
        target: chatproSessoes.sessionId,
        set: {
          // `sql` com COALESCE: um evento sem departamento não apaga o que já se sabia.
          leadId: sql`coalesce(${leadId ?? null}, ${chatproSessoes.leadId})`,
          solicitacaoId: sql`coalesce(${solicitacaoId ?? null}, ${chatproSessoes.solicitacaoId})`,
          departamentoId: sql`coalesce(${dados.departamentoId ?? null}, ${chatproSessoes.departamentoId})`,
          departamentoNome: sql`coalesce(${departamentoNome ?? null}, ${chatproSessoes.departamentoNome})`,
          motivoEncerramentoId: sql`coalesce(${dados.motivoId ?? null}, ${chatproSessoes.motivoEncerramentoId})`,
          motivoEncerramentoNome: sql`coalesce(${motivoNome ?? null}, ${chatproSessoes.motivoEncerramentoNome})`,
          aberta: fechou ? false : abriu ? true : chatproSessoes.aberta,
          fechadaEm: fechou ? agora : chatproSessoes.fechadaEm,
          ultimoEvento: evento.evento,
          ultimoEventoEm: agora,
          mensagensRecebidas:
            evento.evento === 'received_message'
              ? sql`${chatproSessoes.mensagensRecebidas} + 1`
              : chatproSessoes.mensagensRecebidas,
          mensagensEnviadas:
            evento.evento === 'sent_message'
              ? sql`${chatproSessoes.mensagensEnviadas} + 1`
              : chatproSessoes.mensagensEnviadas,
          updatedAt: agora,
        },
      });

    return 'processado';
  }

  /**
   * Liga a conversa à solicitação de cadastro, quando existir uma.
   *
   * Preferência pelo `leadId`, que é a chave de idempotência do ADR-0003 e é estável entre
   * conversas. O telefone é a alternativa, e vem da API — nunca do payload.
   */
  private async vincularSolicitacao(
    leadId: string | null,
    sessionId: string,
  ): Promise<string | null> {
    if (leadId) {
      const [porLead] = await db
        .select({ id: solicitacoesCadastro.id })
        .from(solicitacoesCadastro)
        .where(eq(solicitacoesCadastro.chatproLeadId, leadId))
        .limit(1);
      if (porLead) {
        // A conversa mais recente é a que vale para reconstituir o caminho.
        await db
          .update(solicitacoesCadastro)
          .set({ chatproSessionId: sessionId })
          .where(
            and(
              eq(solicitacoesCadastro.id, porLead.id),
              sql`${solicitacoesCadastro.chatproSessionId} is distinct from ${sessionId}`,
            ),
          );
        return porLead.id;
      }

      const contato = await this.cliente.buscarContatoPorId(leadId);
      const telefone = normalizarTelefoneWhatsapp(removerSufixoWhatsapp(contato?.telefone ?? ''));
      if (telefone) {
        const [porTelefone] = await db
          .select({ id: solicitacoesCadastro.id })
          .from(solicitacoesCadastro)
          .where(eq(solicitacoesCadastro.telefone, telefone))
          .limit(1);
        if (porTelefone) {
          await db
            .update(solicitacoesCadastro)
            .set({ chatproLeadId: leadId, chatproSessionId: sessionId })
            .where(eq(solicitacoesCadastro.id, porTelefone.id));
          return porTelefone.id;
        }
        console.warn('[chatpro] evento sem solicitação correspondente', {
          telefone: mascararTelefone(telefone),
        });
      }
    }

    // Sem vínculo é situação NORMAL: a maior parte das conversas nunca pede o link.
    return null;
  }

  /** Extrai os campos do funil de onde quer que o ChatPro os tenha colocado. */
  private dadosDaSessao(payload: Record<string, unknown>) {
    const sessao =
      payload.session_data && typeof payload.session_data === 'object'
        ? (payload.session_data as Record<string, unknown>)
        : payload;

    const texto = (valor: unknown): string | null =>
      typeof valor === 'string' && valor.trim() ? valor.trim() : null;

    return {
      leadId: texto(sessao.lead_id) ?? texto(payload.lead_id),
      departamentoId: texto(sessao.department_id) ?? texto(payload.department_id),
      // `close_tag` é o UUID do motivo de encerramento.
      motivoId: texto(sessao.close_tag) ?? texto(payload.close_tag),
    };
  }
}
