import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ajustesDosagem, pacientes, medicos, users, notificacoes } from '@/db/schema';
import { eq, and, isNull, gte, lte, sql } from 'drizzle-orm';
import { enviarNotificacaoRealtime } from '@/lib/integrations/pusher';

/**
 * Cron Job — Verificação diária de próximas revisões de dosagem.
 * Executado pela Vercel às 9h UTC (6h BRT).
 *
 * Verifica ajustes de dosagem com proximaRevisao em 3 dias ou 1 dia.
 * Notifica apenas o médico responsável pelo ajuste via in-app (banco + Pusher).
 * Sem envio de e-mail — apenas notificação no site.
 *
 * Anti-duplicata: não reenvia se já existe notificação para o mesmo
 * ajuste + threshold criada nos últimos 7 dias.
 */

// Marcos de alerta em dias antes da revisão
const THRESHOLDS_DIAS = [3, 1] as const;

// Intervalo anti-duplicata em dias
const ANTI_DUPLICATA_DIAS = 7;

export async function GET(request: Request) {
  // Validar que a request vem do Vercel Cron
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    // ── 1. Buscar ajustes com proximaRevisao nos próximos 3 dias ─
    const ajustesComRevisao = await db
      .select({
        ajusteId: ajustesDosagem.id,
        proximaRevisao: ajustesDosagem.proximaRevisao,
        pacienteId: ajustesDosagem.pacienteId,
        pacienteNome: users.nome,
        medicoId: ajustesDosagem.criadoPor,
        medicoUserId: medicos.userId,
      })
      .from(ajustesDosagem)
      .innerJoin(pacientes, eq(ajustesDosagem.pacienteId, pacientes.id))
      .innerJoin(users, eq(pacientes.userId, users.id))
      .innerJoin(medicos, eq(ajustesDosagem.criadoPor, medicos.id))
      .where(
        and(
          isNull(ajustesDosagem.deletedAt),
          isNull(pacientes.deletedAt),
          // Apenas ajustes com revisão pendente nos próximos 3 dias
          gte(ajustesDosagem.proximaRevisao, sql`CURRENT_DATE`),
          lte(ajustesDosagem.proximaRevisao, sql`CURRENT_DATE + INTERVAL '4 days'`),
        ),
      );

    if (ajustesComRevisao.length === 0) {
      return NextResponse.json({
        sucesso: true,
        mensagem: 'Nenhuma revisão de dosagem próxima',
        verificados: 0,
        timestamp: new Date().toISOString(),
      });
    }

    // ── 2. Classificar por threshold ─────────────────────────────
    interface AjusteComThreshold {
      ajusteId: string;
      proximaRevisao: string;
      pacienteId: string;
      pacienteNome: string;
      medicoId: string;
      medicoUserId: string;
      diasRestantes: number;
      threshold: number;
    }

    const ajustesParaNotificar: AjusteComThreshold[] = [];

    for (const aj of ajustesComRevisao) {
      if (!aj.proximaRevisao) continue;

      const revisao = new Date(aj.proximaRevisao + 'T00:00:00');
      const diffMs = revisao.getTime() - hoje.getTime();
      const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      // Verificar qual threshold se enquadra (tolerância de 1 dia)
      for (const t of THRESHOLDS_DIAS) {
        if (diasRestantes >= t - 1 && diasRestantes <= t) {
          ajustesParaNotificar.push({
            ajusteId: aj.ajusteId,
            proximaRevisao: aj.proximaRevisao,
            pacienteId: aj.pacienteId,
            pacienteNome: aj.pacienteNome,
            medicoId: aj.medicoId,
            medicoUserId: aj.medicoUserId,
            diasRestantes: Math.max(0, diasRestantes),
            threshold: t,
          });
          break;
        }
      }
    }

    if (ajustesParaNotificar.length === 0) {
      return NextResponse.json({
        sucesso: true,
        mensagem: 'Revisões encontradas mas fora dos thresholds de alerta',
        verificados: ajustesComRevisao.length,
        alertados: 0,
        timestamp: new Date().toISOString(),
      });
    }

    // ── 3. Anti-duplicata ─────────────────────────────────────────
    const limiteAntiDuplicata = new Date(hoje);
    limiteAntiDuplicata.setDate(limiteAntiDuplicata.getDate() - ANTI_DUPLICATA_DIAS);

    const notificacoesRecentes = await db
      .select({ mensagem: notificacoes.mensagem })
      .from(notificacoes)
      .where(
        and(
          eq(notificacoes.tipo, 'geral'),
          gte(notificacoes.createdAt, limiteAntiDuplicata),
        ),
      );

    // Criar set de chaves já notificadas (ajusteId + threshold)
    const jaNotificados = new Set(
      notificacoesRecentes
        .map((n) => {
          const match = n.mensagem.match(/\[REVISAO:([^\|]+)\|TH:(\d+)\]/);
          return match ? `${match[1]}|${match[2]}` : null;
        })
        .filter(Boolean),
    );

    const ajustesFiltrados = ajustesParaNotificar.filter(
      (aj) => !jaNotificados.has(`${aj.ajusteId}|${aj.threshold}`),
    );

    if (ajustesFiltrados.length === 0) {
      return NextResponse.json({
        sucesso: true,
        mensagem: 'Todas as revisões já foram notificadas neste ciclo',
        verificados: ajustesComRevisao.length,
        alertados: 0,
        jaNotificados: ajustesParaNotificar.length,
        timestamp: new Date().toISOString(),
      });
    }

    // ── 4. Criar notificações in-app ─────────────────────────────
    let notificacoesCriadas = 0;

    for (const aj of ajustesFiltrados) {
      const dataFormatada = new Date(aj.proximaRevisao + 'T00:00:00').toLocaleDateString('pt-BR');
      const urgencia = aj.diasRestantes <= 1 ? 'AMANHÃ' : `em ${aj.diasRestantes} dias`;

      const titulo = `Revisão de dosagem — ${aj.pacienteNome}`;
      const mensagem = `A revisão de dosagem de ${aj.pacienteNome} é ${urgencia} (${dataFormatada}). [REVISAO:${aj.ajusteId}|TH:${aj.threshold}]`;
      const linkAcao = `/medico/pacientes/${aj.pacienteId}`;

      // Inserir notificação no banco para o médico responsável
      await db.insert(notificacoes).values({
        userId: aj.medicoUserId,
        tipo: 'geral',
        titulo,
        mensagem,
        linkAcao,
      });
      notificacoesCriadas++;

      // Enviar via Pusher (tempo real — não bloqueia se falhar)
      try {
        await enviarNotificacaoRealtime({
          userId: aj.medicoUserId,
          tipo: 'geral',
          titulo,
          mensagem,
          linkAcao,
        });
      } catch {
        // Pusher indisponível — notificação já salva no banco
      }
    }

    console.log(
      `[CRON] Revisões de dosagem: ${ajustesFiltrados.length} alertas, ${notificacoesCriadas} notificações criadas`,
    );

    return NextResponse.json({
      sucesso: true,
      mensagem: 'Verificação de revisões de dosagem concluída',
      verificados: ajustesComRevisao.length,
      alertados: ajustesFiltrados.length,
      notificacoesCriadas,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CRON] Erro ao verificar revisões de dosagem:', error);
    return NextResponse.json(
      { error: 'Erro interno ao verificar revisões de dosagem' },
      { status: 500 },
    );
  }
}
