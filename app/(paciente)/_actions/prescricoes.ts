'use server';

import { db } from '@/lib/db';
import { prescricoes, pacientes, users, medicos } from '@/db/schema';
import { verificarPaciente } from '@/lib/auth/permissions';
import { redirect } from 'next/navigation';
import { eq, and, isNull, desc } from 'drizzle-orm';

export interface PrescricaoPaciente {
  id: string;
  tipo: string;
  status: string;          // calculado: 'ativa' | 'expirada' | 'cancelada'
  medicamentos: {
    nome: string;
    dose?: string;
    forma?: string;
    posologia?: string;
    quantidade?: string;
  }[];
  diagnostico: string | null;
  cid: string | null;
  observacoes: string | null;
  orientacoes: string | null;
  validade: string;         // ISO string
  urlPdf: string | null;    // Vercel Blob URL para download
  urlPdfAssinado: string | null;
  assinadaDigital: boolean;
  medicoNome: string;
  medicoCrm: string;
  medicoEspecialidade: string | null;
  createdAt: string;
  validadeStatus: 'valida' | 'expirada' | 'expira_em_breve'; // calculado
  diasRestantes: number | null; // null se expirada
}

export async function listarMinhasPrescricoes(): Promise<{
  sucesso: boolean;
  dados?: PrescricaoPaciente[];
  erro?: string;
}> {
  const perm = await verificarPaciente();
  if (!perm.autorizado || !perm.clerkId) redirect('/entrar');

  // Buscar paciente
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, perm.clerkId))
    .limit(1);
  if (!user) return { sucesso: false, erro: 'Não autorizado' };

  const [paciente] = await db
    .select({ id: pacientes.id })
    .from(pacientes)
    .where(and(eq(pacientes.userId, user.id), isNull(pacientes.deletedAt)))
    .limit(1);
  if (!paciente) return { sucesso: false, erro: 'Paciente não encontrado' };

  // Buscar prescrições com dados do médico
  const lista = await db
    .select({
      id: prescricoes.id,
      tipo: prescricoes.tipo,
      status: prescricoes.status,
      medicamentos: prescricoes.medicamentos,
      diagnostico: prescricoes.diagnostico,
      cid: prescricoes.cid,
      observacoes: prescricoes.observacoes,
      orientacoes: prescricoes.orientacoes,
      validade: prescricoes.validade,
      urlPdf: prescricoes.urlPdf,
      urlPdfAssinado: prescricoes.urlPdfAssinado,
      assinadaDigital: prescricoes.assinadaDigital,
      createdAt: prescricoes.createdAt,
      medicoNome: users.nome,
      medicoCrm: medicos.crm,
      medicoEspecialidade: medicos.especialidade,
    })
    .from(prescricoes)
    .innerJoin(medicos, eq(prescricoes.medicoId, medicos.id))
    .innerJoin(users, eq(medicos.userId, users.id))
    .where(
      and(
        eq(prescricoes.pacienteId, paciente.id),
        isNull(prescricoes.deletedAt),
      ),
    )
    .orderBy(desc(prescricoes.createdAt));

  // Calcular status de validade para cada prescrição
  const agora = new Date();
  const dados: PrescricaoPaciente[] = lista.map((p) => {
    const validade = new Date(p.validade);
    const diffMs = validade.getTime() - agora.getTime();
    const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    let validadeStatus: 'valida' | 'expirada' | 'expira_em_breve';
    let diasRestantes: number | null;

    if (p.status === 'cancelada') {
      validadeStatus = 'expirada';
      diasRestantes = null;
    } else if (diffDias <= 0) {
      validadeStatus = 'expirada';
      diasRestantes = null;
    } else if (diffDias <= 7) {
      validadeStatus = 'expira_em_breve';
      diasRestantes = diffDias;
    } else {
      validadeStatus = 'valida';
      diasRestantes = diffDias;
    }

    return {
      id: p.id,
      tipo: p.tipo,
      status: p.status === 'cancelada' ? 'cancelada' : diffDias <= 0 ? 'expirada' : 'ativa',
      medicamentos: (p.medicamentos as PrescricaoPaciente['medicamentos']) ?? [],
      diagnostico: p.diagnostico,
      cid: p.cid,
      observacoes: p.observacoes,
      orientacoes: p.orientacoes,
      validade: p.validade instanceof Date ? p.validade.toISOString() : String(p.validade),
      urlPdf: p.urlPdf,
      urlPdfAssinado: p.urlPdfAssinado,
      assinadaDigital: p.assinadaDigital ?? false,
      medicoNome: p.medicoNome,
      medicoCrm: p.medicoCrm ?? '',
      medicoEspecialidade: p.medicoEspecialidade,
      createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : String(p.createdAt),
      validadeStatus,
      diasRestantes,
    };
  });

  return { sucesso: true, dados };
}
