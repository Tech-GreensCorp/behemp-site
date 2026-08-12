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
  // Problema 4: consultaId pode ser null em consultas avulsas — tratado
  consultaId: string | null;
}

export async function buscarDadosPainelTeleconsulta(
  salaId: string,
): Promise<{ sucesso: boolean; dados?: DadosPainelTeleconsulta; erro?: string }> {
  try {
    const perm = await verificarMedico();
    if (!perm.autorizado) redirect('/entrar');

    // Buscar sala com dados do paciente
    const [sala] = await db
      .select({
        pacienteId: teleconsultas.pacienteId,
        consultaId: teleconsultas.consultaId, // pode ser null em consultas avulsas
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

    // Buscar última prescrição — pode não existir, sem lançar erro
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

    // Buscar última evolução — pode não existir, sem lançar erro
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

    // Contar consultas totais — retorna 0 se nenhuma
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(consultas)
      .where(and(
        eq(consultas.pacienteId, sala.pacienteId),
        isNull(consultas.deletedAt),
      ));

    // Problema 4: dataNascimento pode ser null — proteger todas as conversões de Date
    const dataNascimentoFormatada = pacienteData.dataNascimento
      ? (() => {
          try {
            return new Date(pacienteData.dataNascimento!).toLocaleDateString('pt-BR');
          } catch {
            return null;
          }
        })()
      : null;

    // Problema 4: validade da prescrição pode ser inválida — proteger conversão
    const ultimaPrescricaoFormatada = ultimaPrescricao
      ? (() => {
          try {
            return {
              id: ultimaPrescricao.id,
              medicamentos: (ultimaPrescricao.medicamentos as { nome: string; dose?: string; posologia?: string }[]) ?? [],
              createdAt: new Date(ultimaPrescricao.createdAt).toLocaleDateString('pt-BR'),
              validade: new Date(ultimaPrescricao.validade).toLocaleDateString('pt-BR'),
            };
          } catch {
            return null;
          }
        })()
      : null;

    return {
      sucesso: true,
      dados: {
        paciente: {
          id: pacienteData.id,
          nome: pacienteData.nome,
          dataNascimento: dataNascimentoFormatada,
          cpf: pacienteData.cpf,
          telefone: pacienteData.telefone,
          patologia: pacienteData.patologia,
          alergias: pacienteData.alergias,
          endereco: pacienteData.endereco,
        },
        ultimaPrescricao: ultimaPrescricaoFormatada,
        ultimaEvolucao: ultimaEvolucao
          ? {
              texto: ultimaEvolucao.texto,
              tipo: ultimaEvolucao.tipo,
              createdAt: new Date(ultimaEvolucao.createdAt).toLocaleDateString('pt-BR'),
            }
          : null,
        totalConsultas: count ?? 0,
        // Problema 4: consultaId null é válido para consultas avulsas — retornar como null
        consultaId: sala.consultaId ?? null,
      },
    };
  } catch (err) {
    // Problema 4: nunca lançar exceção não tratada para o cliente
    console.error('[buscarDadosPainelTeleconsulta] Erro interno:', err);
    return { sucesso: false, erro: 'Erro interno ao buscar dados do painel.' };
  }
}
