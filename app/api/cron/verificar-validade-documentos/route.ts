import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { documentos, pacientes, medicos, users, notificacoes } from '@/db/schema';
import { eq, and, isNull, lte, gte, inArray, sql } from 'drizzle-orm';
import { enviarEmailRenovacaoDocumentoEquipe } from '@/lib/email/notificacoes';
import { enviarNotificacaoRealtime } from '@/lib/integrations/pusher';

/**
 * Cron Job — Verificação diária de validade de documentos.
 * Executado pela Vercel às 9h UTC (6h BRT).
 *
 * Verifica documentos do tipo receita_medica, autorizacao_anvisa e oficio_anvisa
 * que estão vencendo dentro dos thresholds: 30, 15, 5 ou 1 dia restante.
 *
 * Para cada documento encontrado:
 * 1. Cria notificação in-app para o médico responsável
 * 2. Cria notificação in-app para todos os admins
 * 3. Envia e-mail consolidado (por destinatário) via Brevo
 *
 * Anti-duplicata: não reenvia se já existe notificação para o mesmo documento
 * e threshold criada nos últimos 7 dias.
 */

// Tipos de documento que exigem renovação
const TIPOS_RENOVAVEIS = ['receita_medica', 'autorizacao_anvisa', 'oficio_anvisa'] as const;

// Marcos de alerta em dias antes do vencimento
const THRESHOLDS_DIAS = [30, 15, 5, 1] as const;

// Intervalo anti-duplicata em dias
const ANTI_DUPLICATA_DIAS = 7;

const TIPO_LABELS: Record<string, string> = {
  receita_medica: 'Receita Médica',
  autorizacao_anvisa: 'Autorização ANVISA',
  oficio_anvisa: 'Ofício da ANVISA',
};

export async function GET(request: Request) {
  // Validar que a request vem do Vercel Cron ou de um admin em dev
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    // ── 1. Buscar documentos renováveis não deletados ─────────────
    const docsRenovaveis = await db
      .select({
        docId: documentos.id,
        docTipo: documentos.tipo,
        docValidade: documentos.dataValidade,
        pacienteId: documentos.pacienteId,
        pacienteNome: users.nome,
        pacienteEmail: users.email,
        medicoId: pacientes.medicoId,
      })
      .from(documentos)
      .innerJoin(pacientes, eq(documentos.pacienteId, pacientes.id))
      .innerJoin(users, eq(pacientes.userId, users.id))
      .where(
        and(
          inArray(documentos.tipo, [...TIPOS_RENOVAVEIS]),
          isNull(documentos.deletedAt),
          isNull(pacientes.deletedAt),
          // Só documentos que vencem nos próximos 30 dias (maior threshold)
          lte(documentos.dataValidade, sql`CURRENT_DATE + INTERVAL '31 days'`),
          // Ignora documentos já vencidos há mais de 7 dias (não enviar alerta infinito)
          gte(documentos.dataValidade, sql`CURRENT_DATE - INTERVAL '7 days'`),
        ),
      );

    if (docsRenovaveis.length === 0) {
      return NextResponse.json({
        sucesso: true,
        mensagem: 'Nenhum documento próximo do vencimento',
        verificados: 0,
        timestamp: new Date().toISOString(),
      });
    }

    // ── 2. Classificar documentos por threshold ──────────────────
    interface DocComThreshold {
      docId: string;
      docTipo: string;
      docValidade: string;
      pacienteId: string;
      pacienteNome: string;
      pacienteEmail: string;
      medicoId: string | null;
      diasRestantes: number;
      threshold: number;
    }

    const docsParaNotificar: DocComThreshold[] = [];

    for (const doc of docsRenovaveis) {
      const validade = new Date(doc.docValidade + 'T00:00:00');
      const diffMs = validade.getTime() - hoje.getTime();
      const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      // Encontrar o threshold ativo (o menor threshold >= diasRestantes)
      // Ex: 28 dias restantes → threshold 30 (faixa 28-30)
      // Ex: 14 dias restantes → threshold 15 (faixa 13-15)
      // Ex: 4 dias restantes → threshold 5 (faixa 4-5)
      // Ex: 0-1 dias → threshold 1
      let threshold: number | null = null;
      for (const t of THRESHOLDS_DIAS) {
        const limiteInferior = t === 1 ? -7 : t - 2; // tolerância de 2 dias, exceto threshold 1
        if (diasRestantes >= limiteInferior && diasRestantes <= t) {
          threshold = t;
          break;
        }
      }

      if (threshold !== null) {
        docsParaNotificar.push({
          ...doc,
          diasRestantes: Math.max(0, diasRestantes),
          threshold,
        });
      }
    }

    if (docsParaNotificar.length === 0) {
      return NextResponse.json({
        sucesso: true,
        mensagem: 'Documentos encontrados mas fora dos thresholds de alerta',
        verificados: docsRenovaveis.length,
        alertados: 0,
        timestamp: new Date().toISOString(),
      });
    }

    // ── 3. Anti-duplicata: filtrar docs já notificados ────────────
    const limiteAntiDuplicata = new Date(hoje);
    limiteAntiDuplicata.setDate(limiteAntiDuplicata.getDate() - ANTI_DUPLICATA_DIAS);

    // Buscar notificações recentes do tipo renovacao_documento
    const notificacoesRecentes = await db
      .select({
        mensagem: notificacoes.mensagem,
      })
      .from(notificacoes)
      .where(
        and(
          eq(notificacoes.tipo, 'renovacao_documento'),
          gte(notificacoes.createdAt, limiteAntiDuplicata),
        ),
      );

    // Criar set de chaves já notificadas (docId + threshold)
    const jaNotificados = new Set(
      notificacoesRecentes
        .map((n) => {
          // A mensagem contem [DOC:xxx|TH:xx] como tag de rastreamento
          const match = n.mensagem.match(/\[DOC:([^\|]+)\|TH:(\d+)\]/);
          return match ? `${match[1]}|${match[2]}` : null;
        })
        .filter(Boolean),
    );

    const docsFiltrados = docsParaNotificar.filter(
      (doc) => !jaNotificados.has(`${doc.docId}|${doc.threshold}`),
    );

    if (docsFiltrados.length === 0) {
      return NextResponse.json({
        sucesso: true,
        mensagem: 'Todos os documentos já foram notificados neste ciclo',
        verificados: docsRenovaveis.length,
        alertados: 0,
        jaNotificados: docsParaNotificar.length,
        timestamp: new Date().toISOString(),
      });
    }

    // ── 4. Buscar destinatários (médicos + admins) ───────────────
    // Buscar todos os admins
    const admins = await db
      .select({ id: users.id, nome: users.nome, email: users.email })
      .from(users)
      .where(and(eq(users.role, 'admin'), isNull(users.deletedAt)));

    // Buscar médicos únicos vinculados aos documentos
    const medicosIds = [...new Set(docsFiltrados.map((d) => d.medicoId).filter(Boolean))] as string[];
    const medicosMap = new Map<string, { userId: string; nome: string; email: string }>();

    if (medicosIds.length > 0) {
      const medicosData = await db
        .select({
          medicoId: medicos.id,
          userId: users.id,
          nome: users.nome,
          email: users.email,
        })
        .from(medicos)
        .innerJoin(users, eq(medicos.userId, users.id))
        .where(inArray(medicos.id, medicosIds));

      for (const m of medicosData) {
        medicosMap.set(m.medicoId, { userId: m.userId, nome: m.nome, email: m.email });
      }
    }

    // ── 5. Criar notificações in-app ─────────────────────────────
    let notificacoesCriadas = 0;

    for (const doc of docsFiltrados) {
      const tipoLabel = TIPO_LABELS[doc.docTipo] ?? doc.docTipo;
      const dataFormatada = new Date(doc.docValidade + 'T00:00:00').toLocaleDateString('pt-BR');
      const urgencia = doc.diasRestantes <= 1
        ? '⚠️ VENCE AMANHÃ'
        : `${doc.diasRestantes} dias restantes`;

      const titulo = `Documento próximo do vencimento`;
      const mensagem = `${tipoLabel} de ${doc.pacienteNome} — ${urgencia} (vence ${dataFormatada}). [DOC:${doc.docId}|TH:${doc.threshold}]`;
      const linkAcao = `/medico/pacientes/${doc.pacienteId}`;

      // Notificar médico responsável
      if (doc.medicoId && medicosMap.has(doc.medicoId)) {
        const medicoInfo = medicosMap.get(doc.medicoId)!;
        await db.insert(notificacoes).values({
          userId: medicoInfo.userId,
          tipo: 'renovacao_documento',
          titulo,
          mensagem,
          linkAcao,
        });
        notificacoesCriadas++;

        // Tentar enviar via Pusher (não bloqueia em caso de falha)
        try {
          await enviarNotificacaoRealtime({
            userId: medicoInfo.userId,
            tipo: 'renovacao_documento',
            titulo,
            mensagem,
            linkAcao,
          });
        } catch {
          // Pusher indisponível, notificação já salva no banco
        }
      }

      // Notificar todos os admins
      for (const admin of admins) {
        await db.insert(notificacoes).values({
          userId: admin.id,
          tipo: 'renovacao_documento',
          titulo,
          mensagem,
          linkAcao,
        });
        notificacoesCriadas++;

        try {
          await enviarNotificacaoRealtime({
            userId: admin.id,
            tipo: 'renovacao_documento',
            titulo,
            mensagem,
            linkAcao,
          });
        } catch {
          // Pusher indisponível
        }
      }
    }

    // ── 6. Enviar e-mails consolidados ───────────────────────────
    let emailsEnviados = 0;

    // Preparar dados dos documentos para o template
    const docsParaEmail = docsFiltrados.map((doc) => ({
      pacienteNome: doc.pacienteNome,
      pacienteId: doc.pacienteId,
      tipoDocumento: doc.docTipo,
      dataValidade: new Date(doc.docValidade + 'T00:00:00').toLocaleDateString('pt-BR'),
      diasRestantes: doc.diasRestantes,
    }));

    // Agrupar docs por médico para enviar 1 email por médico
    const docsPorMedico = new Map<string, typeof docsParaEmail>();
    for (const doc of docsFiltrados) {
      if (doc.medicoId && medicosMap.has(doc.medicoId)) {
        const key = doc.medicoId;
        if (!docsPorMedico.has(key)) docsPorMedico.set(key, []);
        docsPorMedico.get(key)!.push({
          pacienteNome: doc.pacienteNome,
          pacienteId: doc.pacienteId,
          tipoDocumento: doc.docTipo,
          dataValidade: new Date(doc.docValidade + 'T00:00:00').toLocaleDateString('pt-BR'),
          diasRestantes: doc.diasRestantes,
        });
      }
    }

    // Email para cada médico
    for (const [medicoId, docs] of docsPorMedico) {
      const medicoInfo = medicosMap.get(medicoId)!;
      try {
        await enviarEmailRenovacaoDocumentoEquipe({
          emailDestinatario: medicoInfo.email,
          nomeDestinatario: medicoInfo.nome,
          documentos: docs,
        });
        emailsEnviados++;
      } catch (error) {
        console.error(`[CRON] Erro ao enviar e-mail para médico ${medicoInfo.email}:`, error);
      }
    }

    // Email para cada admin (todos recebem todos os documentos)
    for (const admin of admins) {
      try {
        await enviarEmailRenovacaoDocumentoEquipe({
          emailDestinatario: admin.email,
          nomeDestinatario: admin.nome,
          documentos: docsParaEmail,
        });
        emailsEnviados++;
      } catch (error) {
        console.error(`[CRON] Erro ao enviar e-mail para admin ${admin.email}:`, error);
      }
    }

    // ── 7. Resposta ──────────────────────────────────────────────
    console.log(
      `[CRON] Verificação de documentos concluída: ${docsFiltrados.length} docs alertados, ${notificacoesCriadas} notificações, ${emailsEnviados} e-mails`,
    );

    return NextResponse.json({
      sucesso: true,
      mensagem: 'Verificação de validade de documentos concluída',
      verificados: docsRenovaveis.length,
      alertados: docsFiltrados.length,
      notificacoesCriadas,
      emailsEnviados,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CRON] Erro ao verificar validade de documentos:', error);
    return NextResponse.json(
      { error: 'Erro interno ao verificar documentos' },
      { status: 500 },
    );
  }
}
