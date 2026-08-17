'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import { evolucoes, anamneses, logsAuditoria } from '@/db/schema';
import { verificarMedico } from '@/lib/auth/permissions';
import { resolverContextoSala, resolverMedicoIdInterno } from '@/lib/teleconsulta/contexto-sala';
import { eq, and, isNull, desc } from 'drizzle-orm';

// ── Schemas de Validação ──────────────────────────────────────────────────

const evolucaoSchema = z.object({
  salaId: z.string().min(1, 'salaId é obrigatório'),
  data: z.string().optional(),
  tipo: z.enum(['positiva', 'estavel', 'negativa']),
  sintomasAtuais: z.string().optional().nullable(),
  efeitosColaterais: z.string().optional().nullable(),
  conteudo: z.string().min(1, 'O conteúdo da evolução é obrigatório'),
  nivelDor: z.number().min(0).max(10).optional().nullable(),
  qualidadeSono: z.enum(['ruim', 'regular', 'boa', 'excelente']).optional().nullable(),
  bemEstar: z.enum(['ruim', 'regular', 'boa', 'excelente']).optional().nullable(),
});

const anamneseSchema = z.object({
  salaId: z.string().min(1, 'salaId é obrigatório'),
  queixaPrincipal: z.string().min(1, 'Queixa principal é obrigatória'),
  historiaDoencaAtual: z.string().min(1, 'História da doença atual é obrigatória'),
  doencasPrevias: z.string().optional().nullable(),
  medicamentosEmUso: z.string().optional().nullable(),
  alergias: z.string().optional().nullable(),
  historicoFamiliar: z.string().optional().nullable(),
  historiaSocial: z.string().optional().nullable(),
  tabagismo: z.enum(['nunca_fumou', 'ex_fumante', 'fumante']),
  consumoAlcool: z.enum(['nao_consome', 'regular', 'ocasional']),
  qualidadeSono: z.enum(['ruim', 'regular', 'boa', 'excelente']),
  atividadeFisica: z.string().optional().nullable(),
  nivelDor: z.number().min(0).max(10).optional().nullable(),
  objetivosTratamento: z.string().optional().nullable(),
  usoPrevioCannabis: z.boolean().default(false),
});

// ── Actions ──────────────────────────────────────────────────────────────

export async function criarEvolucaoInline(input: unknown): Promise<{
  sucesso: boolean;
  evolucaoId?: string;
  erro?: string;
}> {
  try {
    const perm = await verificarMedico();
    if (!perm.autorizado || !perm.clerkId) return { sucesso: false, erro: 'Não autorizado' };

    const parsed = evolucaoSchema.safeParse(input);
    if (!parsed.success) return { sucesso: false, erro: parsed.error.errors[0]?.message ?? 'Dados inválidos' };
    const req = parsed.data;

    const medicoCtx = await resolverMedicoIdInterno(perm.clerkId);
    if (!medicoCtx) return { sucesso: false, erro: 'Médico não encontrado' };

    const salaCtx = await resolverContextoSala(req.salaId);
    if (!salaCtx) return { sucesso: false, erro: 'Sala não encontrada' };
    if (salaCtx.medicoIdDaSala !== medicoCtx.medicoId) {
      return { sucesso: false, erro: 'Você não é o médico responsável por esta sala' };
    }

    const dataRegistro = req.data ? new Date(req.data) : new Date();

    const [novaEvolucao] = await db.insert(evolucoes).values({
      pacienteId: salaCtx.pacienteId,
      criadoPor: medicoCtx.medicoId,
      data: dataRegistro.toISOString(),
      tipo: req.tipo,
      sintomasAtuais: req.sintomasAtuais,
      efeitosColaterais: req.efeitosColaterais,
      conteudo: req.conteudo,
      nivelDor: req.nivelDor,
      qualidadeSono: req.qualidadeSono,
      bemEstar: req.bemEstar,
    }).returning({ id: evolucoes.id });

    if (!novaEvolucao?.id) return { sucesso: false, erro: 'Falha ao inserir evolução' };

    // Auditoria LGPD
    await db.insert(logsAuditoria).values({
      userId: medicoCtx.userIdInterno,
      acao: 'evolucao_criada',
      entidade: 'evolucoes',
      entidadeId: novaEvolucao.id,
      dadosDepois: {
        pacienteId: salaCtx.pacienteId,
        salaId: req.salaId,
        origem: 'teleconsulta',
        resumo: req.conteudo.substring(0, 100),
      },
      ip: 'SERVER_ACTION',
    }).catch(e => console.error('[criarEvolucaoInline] Auditoria erro:', e));

    return { sucesso: true, evolucaoId: novaEvolucao.id };
  } catch (err) {
    console.error('[criarEvolucaoInline]', err);
    return { sucesso: false, erro: 'Erro interno ao criar evolução' };
  }
}

export async function salvarAnamneseInline(input: unknown): Promise<{
  sucesso: boolean;
  anamneseId?: string;
  erro?: string;
}> {
  try {
    const perm = await verificarMedico();
    if (!perm.autorizado || !perm.clerkId) return { sucesso: false, erro: 'Não autorizado' };

    const parsed = anamneseSchema.safeParse(input);
    if (!parsed.success) return { sucesso: false, erro: parsed.error.errors[0]?.message ?? 'Dados inválidos' };
    const req = parsed.data;

    const medicoCtx = await resolverMedicoIdInterno(perm.clerkId);
    if (!medicoCtx) return { sucesso: false, erro: 'Médico não encontrado' };

    const salaCtx = await resolverContextoSala(req.salaId);
    if (!salaCtx) return { sucesso: false, erro: 'Sala não encontrada' };
    if (salaCtx.medicoIdDaSala !== medicoCtx.medicoId) {
      return { sucesso: false, erro: 'Você não é o médico responsável por esta sala' };
    }

    // Identificar a anamnese anterior (se houver) para histórico/auditoria
    const [anamneseAnterior] = await db.select({ id: anamneses.id })
      .from(anamneses)
      .where(and(eq(anamneses.pacienteId, salaCtx.pacienteId), isNull(anamneses.deletedAt)))
      .orderBy(desc(anamneses.createdAt))
      .limit(1);

    // O padrão CFM e do sistema pede sempre INSERT para preservar a história longitudinal (softDelete? Não, mantemos todas)
    // O sistema de prontuário exibirá todas por data.
    const [novaAnamnese] = await db.insert(anamneses).values({
      pacienteId: salaCtx.pacienteId,
      criadoPor: medicoCtx.medicoId,
      queixaPrincipal: req.queixaPrincipal,
      historiaDoencaAtual: req.historiaDoencaAtual,
      doencasPrevias: req.doencasPrevias,
      medicamentosEmUso: req.medicamentosEmUso,
      alergias: req.alergias,
      historicoFamiliar: req.historicoFamiliar,
      historiaSocial: req.historiaSocial,
      tabagismo: req.tabagismo,
      consumoAlcool: req.consumoAlcool,
      qualidadeSono: req.qualidadeSono,
      atividadeFisica: req.atividadeFisica,
      nivelDor: req.nivelDor,
      objetivosTratamento: req.objetivosTratamento,
      usoPrevioCannabis: req.usoPrevioCannabis,
    }).returning({ id: anamneses.id });

    if (!novaAnamnese?.id) return { sucesso: false, erro: 'Falha ao salvar anamnese' };

    // Auditoria LGPD
    await db.insert(logsAuditoria).values({
      userId: medicoCtx.userIdInterno,
      acao: 'anamnese_registrada',
      entidade: 'anamneses',
      entidadeId: novaAnamnese.id,
      dadosAntes: anamneseAnterior ? { id_anterior: anamneseAnterior.id } : null,
      dadosDepois: {
        pacienteId: salaCtx.pacienteId,
        salaId: req.salaId,
        origem: 'teleconsulta',
        id_nova: novaAnamnese.id,
      },
      ip: 'SERVER_ACTION',
    }).catch(e => console.error('[salvarAnamneseInline] Auditoria erro:', e));

    return { sucesso: true, anamneseId: novaAnamnese.id };
  } catch (err) {
    console.error('[salvarAnamneseInline]', err);
    return { sucesso: false, erro: 'Erro interno ao salvar anamnese' };
  }
}

export async function buscarAnamneseAtual(salaId: string) {
  try {
    const perm = await verificarMedico();
    if (!perm.autorizado || !perm.clerkId) return { sucesso: false, erro: 'Não autorizado' };

    const medicoCtx = await resolverMedicoIdInterno(perm.clerkId);
    if (!medicoCtx) return { sucesso: false, erro: 'Médico não encontrado' };

    const salaCtx = await resolverContextoSala(salaId);
    if (!salaCtx) return { sucesso: false, erro: 'Sala não encontrada' };
    if (salaCtx.medicoIdDaSala !== medicoCtx.medicoId) {
      return { sucesso: false, erro: 'Não autorizado para esta sala' };
    }

    const [anamnese] = await db.select()
      .from(anamneses)
      .where(and(eq(anamneses.pacienteId, salaCtx.pacienteId), isNull(anamneses.deletedAt)))
      .orderBy(desc(anamneses.createdAt))
      .limit(1);

    if (!anamnese) return { sucesso: true, dados: null };

    return { sucesso: true, dados: anamnese };
  } catch (err) {
    console.error('[buscarAnamneseAtual]', err);
    return { sucesso: false, erro: 'Erro interno ao buscar anamnese' };
  }
}
