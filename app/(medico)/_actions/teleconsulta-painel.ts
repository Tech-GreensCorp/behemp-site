'use server';

import { db } from '@/lib/db';
import { teleconsultas, pacientes, users, medicos, consultas,
         prescricoes, documentos, evolucoes } from '@/db/schema';
import { verificarMedico } from '@/lib/auth/permissions';
import { redirect } from 'next/navigation';
import { eq, and, isNull, desc, sql } from 'drizzle-orm';

export interface DadosPainelTeleconsulta {
  paciente: {
    id: string;
    nome: string;
    dataNascimento: string | null;
    cpf: string | null;
    telefone: string | null;
    patologia: string | null;
    alergias: string | null;
    endereco: string | null;
  };
  ultimaPrescricao: {
    id: string;
    medicamentos: { nome: string; dose?: string; posologia?: string }[];
    createdAt: string;
    validade: string;
  } | null;
  ultimaEvolucao: {
    texto: string;
    tipo: string;
    createdAt: string;
  } | null;
  totalConsultas: number;
  consultaId: string | null;
}

export async function buscarDadosPainelTeleconsulta(
  salaId: string,
): Promise<{ sucesso: boolean; dados?: DadosPainelTeleconsulta; erro?: string }> {
  const perm = await verificarMedico();
  if (!perm.autorizado) redirect('/entrar');

  // Buscar sala com dados do paciente
  const [sala] = await db
    .select({
      pacienteId: teleconsultas.pacienteId,
      consultaId: teleconsultas.consultaId,
    })
    .from(teleconsultas)
    .where(and(eq(teleconsultas.id, salaId), isNull(teleconsultas.deletedAt)))
    .limit(1);

  if (!sala) return { sucesso: false, erro: 'Sala não encontrada' };

  // Buscar dados completos do paciente
  const [pacienteData] = await db
    .select({
      id: pacientes.id,
      nome: users.nome,
      dataNascimento: pacientes.dataNascimento,
      cpf: pacientes.cpf,
      telefone: users.telefone,
      patologia: pacientes.patologia,
      alergias: pacientes.alergias,
      endereco: pacientes.endereco,
    })
    .from(pacientes)
    .innerJoin(users, eq(pacientes.userId, users.id))
    .where(and(eq(pacientes.id, sala.pacienteId), isNull(pacientes.deletedAt)))
    .limit(1);

  if (!pacienteData) return { sucesso: false, erro: 'Paciente não encontrado' };

  // Buscar última prescrição
  const [ultimaPrescricao] = await db
    .select({
      id: prescricoes.id,
      medicamentos: prescricoes.medicamentos,
      createdAt: prescricoes.createdAt,
      validade: prescricoes.validade,
    })
    .from(prescricoes)
    .where(and(
      eq(prescricoes.pacienteId, sala.pacienteId),
      isNull(prescricoes.deletedAt),
    ))
    .orderBy(desc(prescricoes.createdAt))
    .limit(1);

  // Buscar última evolução
  const [ultimaEvolucao] = await db
    .select({
      texto: evolucoes.texto,
      tipo: evolucoes.tipo,
      createdAt: evolucoes.createdAt,
    })
    .from(evolucoes)
    .where(and(
      eq(evolucoes.pacienteId, sala.pacienteId),
      isNull(evolucoes.deletedAt),
    ))
    .orderBy(desc(evolucoes.createdAt))
    .limit(1);

  // Contar consultas totais
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(consultas)
    .where(and(
      eq(consultas.pacienteId, sala.pacienteId),
      isNull(consultas.deletedAt),
    ));

  return {
    sucesso: true,
    dados: {
      paciente: {
        id: pacienteData.id,
        nome: pacienteData.nome,
        dataNascimento: pacienteData.dataNascimento
          ? new Date(pacienteData.dataNascimento).toLocaleDateString('pt-BR')
          : null,
        cpf: pacienteData.cpf,
        telefone: pacienteData.telefone,
        patologia: pacienteData.patologia,
        alergias: pacienteData.alergias,
        endereco: pacienteData.endereco,
      },
      ultimaPrescricao: ultimaPrescricao ? {
        id: ultimaPrescricao.id,
        medicamentos: (ultimaPrescricao.medicamentos as any[]) ?? [],
        createdAt: new Date(ultimaPrescricao.createdAt).toLocaleDateString('pt-BR'),
        validade: new Date(ultimaPrescricao.validade).toLocaleDateString('pt-BR'),
      } : null,
      ultimaEvolucao: ultimaEvolucao ? {
        texto: ultimaEvolucao.texto,
        tipo: ultimaEvolucao.tipo,
        createdAt: new Date(ultimaEvolucao.createdAt).toLocaleDateString('pt-BR'),
      } : null,
      totalConsultas: count,
      consultaId: sala.consultaId,
    },
  };
}
