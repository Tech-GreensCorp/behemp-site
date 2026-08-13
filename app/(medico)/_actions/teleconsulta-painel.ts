'use server';

import { db } from '@/lib/db';
import { teleconsultas, pacientes, users, medicos, consultas,
         prescricoes, documentos, evolucoes, dosagens, medicamentos, autorizacoesAnvisa, exames, anamneses, triagens } from '@/db/schema';
import { verificarMedico } from '@/lib/auth/permissions';
import { redirect } from 'next/navigation';
import { eq, and, isNull, desc, asc, sql } from 'drizzle-orm';
import { calcularDiasRestantes } from '@/lib/utils/dosagem';

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

  tratamentoAtual: {
    medicamentoNome: string;
    gotasPorDia: number;
    mlFrasco: number;
    dataInicio: string;
    dataFimPrevista: string;
    diasRestantes: number;
    percentualConsumido: number;
    statusFrasco: 'ok' | 'atencao' | 'critico';
  } | null;

  statusAnvisa: {
    status: string;
    dataValidade: string | null;
    prazoEstimado: string | null;
    statusVencimento: 'valida' | 'vencendo' | 'vencida' | 'sem_autorizacao';
  } | null;

  evolucaoGraficos: {
    data: string;
    nivelDor: number | null;
    qualidadeSono: number | null;
    bemEstar: number | null;
  }[];

  sinaisRapidos: {
    ultimaConsultaData: string | null;
    proximaConsultaData: string | null;
    examesRecentes: { nomeExame: string; dataExame: string }[];
    documentosVencendo: number;
    idade: number | null;
  };

  panoramaIA: {
    ultimaAnamneseResumo: string | null;
    ultimaTriagemResumo: string | null;
  };
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
        email: users.email,
        dataNascimento: pacientes.dataNascimento,
        cpf: pacientes.cpf,
        telefone: users.telefone,
        patologia: pacientes.patologia,
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
        texto: evolucoes.conteudo,
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

    // Buscar tratamento atual (dosagem ativa)
    const [dosagemAtiva] = await db
      .select({
        gotasPorDia: dosagens.gotasPorDia,
        mlFrasco: dosagens.mlFrasco,
        dataInicio: dosagens.dataInicio,
        dataFimPrevista: dosagens.dataFimPrevista,
        medicamentoNome: medicamentos.nome,
      })
      .from(dosagens)
      .innerJoin(medicamentos, eq(dosagens.medicamentoId, medicamentos.id))
      .where(and(
        eq(dosagens.pacienteId, sala.pacienteId),
        eq(dosagens.ativa, true)
      ))
      .limit(1);

    // Buscar status Anvisa mais recente
    const [anvisa] = await db
      .select({
        status: autorizacoesAnvisa.status,
        dataValidade: autorizacoesAnvisa.dataValidade,
        prazoEstimado: autorizacoesAnvisa.prazoEstimado,
      })
      .from(autorizacoesAnvisa)
      .where(and(
        eq(autorizacoesAnvisa.pacienteId, sala.pacienteId),
        isNull(autorizacoesAnvisa.deletedAt)
      ))
      .orderBy(desc(autorizacoesAnvisa.createdAt))
      .limit(1);

    // Buscar últimas 10 evoluções p/ gráfico
    const evolucoesRaw = await db
      .select({
        data: evolucoes.data,
        nivelDor: evolucoes.nivelDor,
        qualidadeSono: evolucoes.qualidadeSono,
        bemEstar: evolucoes.bemEstar,
      })
      .from(evolucoes)
      .where(and(
        eq(evolucoes.pacienteId, sala.pacienteId),
        isNull(evolucoes.deletedAt)
      ))
      .orderBy(desc(evolucoes.data))
      .limit(10);
    evolucoesRaw.reverse(); // Ordem cronológica ASC

    // Consultas para sinais rápidos
    const now = new Date();
    const isoNow = now.toISOString();

    const [ultimaConsulta] = await db
      .select({ dataHora: consultas.dataHora })
      .from(consultas)
      .where(and(
        eq(consultas.pacienteId, sala.pacienteId),
        sql`${consultas.dataHora} < ${isoNow}`,
        isNull(consultas.deletedAt)
      ))
      .orderBy(desc(consultas.dataHora))
      .limit(1);

    const [proximaConsulta] = await db
      .select({ dataHora: consultas.dataHora })
      .from(consultas)
      .where(and(
        eq(consultas.pacienteId, sala.pacienteId),
        sql`${consultas.dataHora} >= ${isoNow}`,
        isNull(consultas.deletedAt)
      ))
      .orderBy(asc(consultas.dataHora))
      .limit(1);

    // Exames recentes
    const examesRecentesRaw = await db
      .select({
        nomeExame: exames.nomeExame,
        dataExame: exames.dataExame,
      })
      .from(exames)
      .where(and(
        eq(exames.pacienteId, sala.pacienteId),
        isNull(exames.deletedAt)
      ))
      .orderBy(desc(exames.dataExame))
      .limit(3);

    // Documentos vencendo (validade <= 30 dias e validade >= hoje)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);
    const iso30Days = thirtyDaysFromNow.toISOString();
    const [{ docsVencendo }] = await db
      .select({ docsVencendo: sql<number>`count(*)::int` })
      .from(documentos)
      .where(and(
        eq(documentos.pacienteId, sala.pacienteId),
        isNull(documentos.deletedAt),
        sql`${documentos.dataValidade} <= ${iso30Days}`,
        sql`${documentos.dataValidade} >= ${isoNow}`
      ));

    // Anamnese e Triagem
    const [ultimaAnamnese] = await db
      .select({ 
        queixa: anamneses.queixaPrincipal, 
        historia: anamneses.historiaDoencaAtual,
        alergias: anamneses.alergias
      })
      .from(anamneses)
      .where(and(
        eq(anamneses.pacienteId, sala.pacienteId),
        isNull(anamneses.deletedAt)
      ))
      .orderBy(desc(anamneses.createdAt))
      .limit(1);

    const [ultimaTriagem] = await db
      .select({ dados: triagens.dados })
      .from(triagens)
      .where(eq(triagens.emailContato, pacienteData.email))
      .orderBy(desc(triagens.createdAt))
      .limit(1);

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
          alergias: ultimaAnamnese?.alergias ?? null,
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

        tratamentoAtual: (() => {
          if (!dosagemAtiva) return null;
          try {
            const dFim = new Date(dosagemAtiva.dataFimPrevista);
            const dInicio = new Date(dosagemAtiva.dataInicio);
            const diasRest = calcularDiasRestantes(dFim);
            const totalDias = Math.max(1, (dFim.getTime() - dInicio.getTime()) / (1000 * 60 * 60 * 24));
            const consumido = Math.max(0, Math.min(100, ((totalDias - diasRest) / totalDias) * 100));
            const statusF = diasRest <= 10 ? 'critico' : diasRest <= 30 ? 'atencao' : 'ok';
            return {
              medicamentoNome: dosagemAtiva.medicamentoNome,
              gotasPorDia: dosagemAtiva.gotasPorDia,
              mlFrasco: dosagemAtiva.mlFrasco,
              dataInicio: dInicio.toLocaleDateString('pt-BR'),
              dataFimPrevista: dFim.toLocaleDateString('pt-BR'),
              diasRestantes: diasRest,
              percentualConsumido: Math.round(consumido),
              statusFrasco: statusF,
            };
          } catch { return null; }
        })(),

        statusAnvisa: (() => {
          if (!anvisa) return { status: 'none', dataValidade: null, prazoEstimado: null, statusVencimento: 'sem_autorizacao' };
          let statusV: 'valida' | 'vencendo' | 'vencida' | 'sem_autorizacao' = 'sem_autorizacao';
          if (anvisa.dataValidade) {
            const dVal = new Date(anvisa.dataValidade);
            const today = new Date();
            const diffDias = (dVal.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
            if (diffDias < 0) statusV = 'vencida';
            else if (diffDias <= 60) statusV = 'vencendo';
            else statusV = 'valida';
          }
          return {
            status: anvisa.status,
            dataValidade: anvisa.dataValidade ? new Date(anvisa.dataValidade).toLocaleDateString('pt-BR') : null,
            prazoEstimado: anvisa.prazoEstimado ? new Date(anvisa.prazoEstimado).toLocaleDateString('pt-BR') : null,
            statusVencimento: statusV,
          };
        })(),

        evolucaoGraficos: evolucoesRaw.map(ev => {
          const mapQualidade: Record<string, number> = { 'ruim': 1, 'regular': 2, 'boa': 3, 'excelente': 4 };
          const mapBemEstar: Record<string, number> = { 'ruim': 1, 'regular': 2, 'boa': 3, 'excelente': 4 }; // Assumindo similar
          return {
            data: new Date(ev.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
            nivelDor: ev.nivelDor ?? null,
            qualidadeSono: ev.qualidadeSono ? mapQualidade[ev.qualidadeSono] || null : null,
            bemEstar: ev.bemEstar ? mapBemEstar[ev.bemEstar.toLowerCase()] || null : null,
          };
        }),

        sinaisRapidos: {
          ultimaConsultaData: ultimaConsulta ? new Date(ultimaConsulta.dataHora).toLocaleDateString('pt-BR') : null,
          proximaConsultaData: proximaConsulta ? new Date(proximaConsulta.dataHora).toLocaleDateString('pt-BR') : null,
          examesRecentes: examesRecentesRaw.map(ex => ({
            nomeExame: ex.nomeExame,
            dataExame: new Date(ex.dataExame).toLocaleDateString('pt-BR'),
          })),
          documentosVencendo: docsVencendo ?? 0,
          idade: pacienteData.dataNascimento ? Math.floor((new Date().getTime() - new Date(pacienteData.dataNascimento).getTime()) / 31557600000) : null,
        },

        panoramaIA: {
          ultimaAnamneseResumo: ultimaAnamnese ? `${ultimaAnamnese.queixa} - ${ultimaAnamnese.historia}`.substring(0, 300) : null,
          ultimaTriagemResumo: ultimaTriagem ? JSON.stringify(ultimaTriagem.dados).substring(0, 300) : null,
        },
      },
    };
  } catch (err) {
    // Problema 4: nunca lançar exceção não tratada para o cliente
    console.error('[buscarDadosPainelTeleconsulta] Erro interno:', err);
    return { sucesso: false, erro: 'Erro interno ao buscar dados do painel.' };
  }
}
