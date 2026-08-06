import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { prescricoes, users } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { montarHtmlReceituario } from '@/lib/receituario/receituario-service';
import { htmlParaPdf } from '@/lib/receituario/html-para-pdf';

export async function GET(request: NextRequest) {
  try {
    // Auth
    const authReq = await auth();
    const userId = authReq.userId;
    if (!userId) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 });

    const prescricaoId = request.nextUrl.searchParams.get('prescricaoId');
    if (!prescricaoId) return NextResponse.json({ erro: 'prescricaoId obrigatório' }, { status: 400 });

    // Verificar acesso
    const [prescricao] = await db
      .select({ medicoId: prescricoes.medicoId, pacienteId: prescricoes.pacienteId })
      .from(prescricoes)
      .where(and(eq(prescricoes.id, prescricaoId), isNull(prescricoes.deletedAt)))
      .limit(1);
    if (!prescricao) return NextResponse.json({ erro: 'Não encontrado' }, { status: 404 });

    // Verificar se userId tem acesso (admin, médico criador, paciente dono)
    const [user] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.clerkId, userId))
      .limit(1);
    
    if (!user) return NextResponse.json({ erro: 'Não autorizado' }, { status: 403 });

    // Apenas admin e pessoas envolvidas (precisaria check do medicoId / pacienteId vs user.id, simplificando checagem)
    if (user.role !== 'admin') {
      const { medicos, pacientes } = await import('@/db/schema');
      
      const isMedico = await db.select({ id: medicos.id }).from(medicos).where(and(eq(medicos.userId, user.id), eq(medicos.id, prescricao.medicoId))).limit(1).then(res => res.length > 0);
      const isPaciente = await db.select({ id: pacientes.id }).from(pacientes).where(and(eq(pacientes.userId, user.id), eq(pacientes.id, prescricao.pacienteId))).limit(1).then(res => res.length > 0);
      
      if (!isMedico && !isPaciente) {
        return NextResponse.json({ erro: 'Não autorizado para ver esta prescrição' }, { status: 403 });
      }
    }

    // Gerar HTML e PDF
    const html = await montarHtmlReceituario(prescricaoId);
    const pdfBuffer = await htmlParaPdf(html);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="prescricao-${prescricaoId}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    return NextResponse.json({ erro: 'Erro interno ao gerar PDF' }, { status: 500 });
  }
}
