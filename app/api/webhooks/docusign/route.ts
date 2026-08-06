import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { procuracoesEspecificas, notificacoes, logsAuditoria } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getPusherServer } from '@/lib/integrations/pusher/server';

/**
 * Webhook DocuSign — recebe eventos de assinatura em tempo real.
 * Quando paciente assina → atualiza status + notifica admin + salva PDF assinado.
 *
 * STUB: endpoint pronto, sem validação de assinatura HMAC (implementar quando
 * DOCUSIGN_HMAC_KEY estiver configurada).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // TODO produção: validar assinatura HMAC do DocuSign
    // const hmacKey = env.DOCUSIGN_HMAC_KEY;
    // const signature = request.headers.get('x-docusign-signature-1');
    // validarAssinaturaDocuSign(body, signature, hmacKey);

    const { event, data } = body as {
      event: string;
      data: {
        envelopeId: string;
        envelopeSummary?: {
          status: string;
          documentsUri?: string;
        };
      };
    };

    if (!data?.envelopeId) {
      return NextResponse.json({ erro: 'envelopeId ausente' }, { status: 400 });
    }

    // Buscar procuração pelo envelopeId
    const [procuracao] = await db
      .select({
        id: procuracoesEspecificas.id,
        pacienteId: procuracoesEspecificas.pacienteId,
        email: procuracoesEspecificas.email,
      })
      .from(procuracoesEspecificas)
      .where(eq(procuracoesEspecificas.docusignEnvelopeId, data.envelopeId))
      .limit(1);

    if (!procuracao) {
      return NextResponse.json({ erro: 'Procuração não encontrada' }, { status: 404 });
    }

    // Mapear evento DocuSign → status interno
    const statusMap: Record<string, string> = {
      'envelope-sent': 'enviado',
      'envelope-delivered': 'visualizado',
      'envelope-completed': 'concluido',
      'envelope-declined': 'recusado',
      'envelope-voided': 'expirado',
      'recipient-completed': 'assinado',
    };

    const novoStatus = statusMap[event] ?? 'enviado';
    const assinadoEm = novoStatus === 'concluido' ? new Date() : undefined;

    // Atualizar status
    await db.update(procuracoesEspecificas)
      .set({
        docusignStatus: novoStatus as 'enviado' | 'visualizado' | 'assinado' | 'concluido' | 'recusado' | 'expirado',
        ...(assinadoEm ? { assinadoEm } : {}),
      })
      .where(eq(procuracoesEspecificas.id, procuracao.id));

    // Notificar admin via Pusher quando concluído
    if (novoStatus === 'concluido') {
      const pusherServer = getPusherServer();
      await pusherServer.trigger(
        'private-admin',
        'procuracao:assinada',
        {
          procuracaoId: procuracao.id,
          pacienteId: procuracao.pacienteId,
          mensagem: 'Nova Procuração Específica assinada pelo paciente.',
        },
      ).catch(() => {});

      // Notificação in-app para admins
      const { users } = await import('@/db/schema');
      const admins = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.role, 'admin'));

      for (const admin of admins) {
        await db.insert(notificacoes).values({
          userId: admin.id,
          tipo: 'geral',
          titulo: 'Procuração Específica assinada',
          mensagem: 'Um paciente assinou a Procuração Específica. Acesse o painel para visualizar.',
          lida: false,
          linkAcao: '/admin/procuracoes',
        }).catch(() => {});
      }

      // Baixar PDF assinado e salvar no Vercel Blob
      if (data.envelopeId) {
        try {
          const { downloadPdfAssinado } = await import('@/lib/docusign/docusign-service');
          const { put } = await import('@vercel/blob');

          const pdfAssinado = await downloadPdfAssinado(data.envelopeId);
          if (pdfAssinado) {
            const nomeArquivo = `procuracoes/assinadas/${procuracao.id}-assinada-${Date.now()}.pdf`;
            const blob = await put(nomeArquivo, pdfAssinado, { access: 'public' });

            await db
              .update(procuracoesEspecificas)
              .set({ urlPdfAssinado: blob.url })
              .where(eq(procuracoesEspecificas.id, procuracao.id));
          }
        } catch (err) {
          console.error('[DocuSign Webhook] Erro ao baixar PDF assinado:', err);
        }
      }
    }

    // Auditoria
    await db.insert(logsAuditoria).values({
      acao: `DOCUSIGN_${event.toUpperCase().replace(/-/g, '_')}`,
      entidade: 'procuracoes_especificas',
      entidadeId: procuracao.id,
    }).catch(() => {});

    return NextResponse.json({ recebido: true });
  } catch (error) {
    console.error('[DocuSign Webhook] Erro:', error);
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 });
  }
}
