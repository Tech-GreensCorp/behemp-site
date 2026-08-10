import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { prescricoes, users } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { gerarPdfReceituario, type DadosReceituario } from '@/lib/receituario/receituario-pdf';

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

    const { medicos, pacientes } = await import('@/db/schema');

    // Apenas admin e pessoas envolvidas (precisaria check do medicoId / pacienteId vs user.id, simplificando checagem)
    if (user.role !== 'admin') {
      const isMedico = await db.select({ id: medicos.id }).from(medicos).where(and(eq(medicos.userId, user.id), eq(medicos.id, prescricao.medicoId))).limit(1).then(res => res.length > 0);
      const isPaciente = await db.select({ id: pacientes.id }).from(pacientes).where(and(eq(pacientes.userId, user.id), eq(pacientes.id, prescricao.pacienteId))).limit(1).then(res => res.length > 0);
      
      if (!isMedico && !isPaciente) {
        return NextResponse.json({ erro: 'Não autorizado para ver esta prescrição' }, { status: 403 });
      }
    }

    const [prescData] = await db
      .select({
        medicamentos: prescricoes.medicamentos,
        diagnostico: prescricoes.diagnostico,
        cid: prescricoes.cid,
        observacoes: prescricoes.observacoes,
        orientacoes: prescricoes.orientacoes,
        createdAt: prescricoes.createdAt,
        validade: prescricoes.validade,
        tipo: prescricoes.tipo,
        medicoCrm: medicos.crm,
        medicoEspecialidade: medicos.especialidade,
        medicoUserId: medicos.userId,
        pacienteNascimento: pacientes.dataNascimento,
        pacienteCpf: pacientes.cpf,
        pacienteEndereco: pacientes.endereco,
        pacienteCep: pacientes.cep,
        pacienteCidade: pacientes.cidade,
        pacienteUf: pacientes.uf,
        pacienteUserId: pacientes.userId,
      })
      .from(prescricoes)
      .innerJoin(medicos, eq(prescricoes.medicoId, medicos.id))
      .innerJoin(pacientes, eq(prescricoes.pacienteId, pacientes.id))
      .where(and(eq(prescricoes.id, prescricaoId), isNull(prescricoes.deletedAt)))
      .limit(1);

    if (!prescData) return NextResponse.json({ erro: 'Prescrição não encontrada' }, { status: 404 });

    // Buscar nomes dos usuários
    const [medicoUser] = await db.select({ nome: users.nome }).from(users)
      .where(eq(users.id, prescData.medicoUserId)).limit(1);
    const [pacienteUser] = await db.select({ nome: users.nome }).from(users)
      .where(eq(users.id, prescData.pacienteUserId)).limit(1);

    // Normalizar medicamentos
    const meds = Array.isArray(prescData.medicamentos)
      ? (prescData.medicamentos as Record<string, unknown>[]).map((m) => ({
          nome: String(m.nome ?? ''),
          dose: String(m.dose ?? ''),
          forma: String(m.forma ?? ''),
          posologia: String(m.posologia ?? ''),
          quantidade: String(m.quantidade ?? ''),
          usoContinuo: true,
        }))
      : [];

    // Formatar data de emissão
    const emissao = new Date(prescData.createdAt).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    // Montar dados do receituário
    const dadosReceituario: DadosReceituario = {
      medicoNome: `Dr(a). ${medicoUser?.nome ?? 'Médico'}`,
      medicoCrm: prescData.medicoCrm ?? '',
      medicoEspecialidade: prescData.medicoEspecialidade ?? '',
      pacienteNome: pacienteUser?.nome ?? 'Paciente',
      pacienteNascimento: prescData.pacienteNascimento
        ? new Date(prescData.pacienteNascimento).toLocaleDateString('pt-BR')
        : undefined,
      pacienteCpf: prescData.pacienteCpf ?? undefined,
      pacienteEndereco: prescData.pacienteEndereco ?? undefined,
      pacienteCep: prescData.pacienteCep ?? undefined,
      pacienteCidade: prescData.pacienteCidade ?? undefined,
      pacienteUf: prescData.pacienteUf ?? undefined,
      tipo: prescData.tipo as 'simples' | 'controle_especial' | 'personalizado',
      medicamentos: meds,
      emissao,
      tokenReceita: 'XXXXXXX',  // Substituir por token real quando ICP-Brasil ativo
      codigoAcesso: '0000',     // Substituir por código real quando ICP-Brasil ativo
      assinadoDigitalmente: false,
      medicoAssinaturaTexto: `por ${medicoUser?.nome ?? 'médico'} em ${emissao}`,
    };

    const pdfBuffer = await gerarPdfReceituario(dadosReceituario);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="receituario-${prescricaoId}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    return NextResponse.json({ erro: 'Erro interno ao gerar PDF' }, { status: 500 });
  }
}
