import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { autorizacoesAnvisa, pacientes, users, procuracoesEspecificas, medicos } from '@/db/schema';
import { eq, desc, isNull } from 'drizzle-orm';

export async function GET(_request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 });

  // Verificar admin
  const [user] = await db.select({ role: users.role }).from(users)
    .where(eq(users.clerkId, userId)).limit(1);
  if (user?.role !== 'admin') return NextResponse.json({ erro: 'Acesso negado' }, { status: 403 });

  // Buscar autorizações com dados do paciente, médico e procuração
  const lista = await db
    .select({
      id: autorizacoesAnvisa.id,
      pacienteId: autorizacoesAnvisa.pacienteId,
      medicoId: autorizacoesAnvisa.medicoId,
      status: autorizacoesAnvisa.status,
      modalidade: autorizacoesAnvisa.modalidade,
      documentos: autorizacoesAnvisa.documentos,
      dataEnvio: autorizacoesAnvisa.dataEnvio,
      dataAprovacao: autorizacoesAnvisa.dataAprovacao,
      prazoEstimado: autorizacoesAnvisa.prazoEstimado,
      numeroProcesso: autorizacoesAnvisa.numeroProcesso,
      observacoesAnvisa: autorizacoesAnvisa.observacoesAnvisa,
      createdAt: autorizacoesAnvisa.createdAt,
      // Paciente
      pacienteNome: users.nome,
      pacienteEmail: users.email,
      pacienteCpf: pacientes.cpf,
      pacienteEndereco: pacientes.endereco,
      pacienteCidade: pacientes.cidade,
      pacienteUf: pacientes.uf,
      pacienteNascimento: pacientes.dataNascimento,
      pacientePatologia: pacientes.patologia,
    })
    .from(autorizacoesAnvisa)
    .innerJoin(pacientes, eq(autorizacoesAnvisa.pacienteId, pacientes.id))
    .innerJoin(users, eq(pacientes.userId, users.id))
    .where(isNull(autorizacoesAnvisa.deletedAt))
    .orderBy(desc(autorizacoesAnvisa.createdAt));

  // Para cada autorização, buscar procuração assinada e médico
  const listaCompleta = await Promise.all(
    lista.map(async (aut) => {
      // Buscar procuração assinada
      const [proc] = await db
        .select({
          id: procuracoesEspecificas.id,
          urlPdfAssinado: procuracoesEspecificas.urlPdfAssinado,
          urlPdfGerado: procuracoesEspecificas.urlPdfGerado,
          docusignStatus: procuracoesEspecificas.docusignStatus,
          assinadoEm: procuracoesEspecificas.assinadoEm,
        })
        .from(procuracoesEspecificas)
        .where(eq(procuracoesEspecificas.autorizacaoId, aut.id))
        .orderBy(desc(procuracoesEspecificas.createdAt))
        .limit(1);

      // Buscar médico
      const [medicoData] = await db
        .select({ nome: users.nome, crm: medicos.crm, especialidade: medicos.especialidade })
        .from(medicos)
        .innerJoin(users, eq(medicos.userId, users.id))
        .where(eq(medicos.id, aut.medicoId ?? ''))
        .limit(1);

      return {
        ...aut,
        medicoNome: medicoData?.nome ?? 'Médico não encontrado',
        medicoCrm: medicoData?.crm ?? '',
        medicoEspecialidade: medicoData?.especialidade ?? '',
        procuracao: proc ?? null,
      };
    })
  );

  return NextResponse.json({ sucesso: true, dados: listaCompleta });
}
