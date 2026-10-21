'use server';

/**
 * ANAMNESE COMO BASELINE — actions de medida repetível e de rastreio de uso.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * [ADR-0004](../../docs/adr/ADR-0004-anamnese-e-baseline-de-acompanhamento-longitudinal.md)
 * D-01: a anamnese é **série temporal**, não registro sobrescrito. Sem isso não há como
 * responder à única pergunta que importa no tratamento com canabidiol — *"melhorou?"*.
 *
 * 🔴 NADA AQUI ATUALIZA MEDIDA ANTERIOR. Cada remedição é `insert`, nunca `update`. É a
 * Proibição 3 do `CLAUDE.md` e o guarda `anamnese-e-serie-nao-sobrescrita` cobra por `rg`.
 *
 * 🔴 TODA FUNÇÃO PROVA ESCOPO DE OBJETO. Verificar que é médico não basta — médico com id de
 * paciente alheio é OWASP API1 (BOLA), a classe de defeito que a Sprint 1 corrigiu em 7 lugares.
 * Aqui nasce certo: `garantirMedicoDoPaciente` em cada função.
 */

import { and, desc, eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import {
  anamneses,
  medicos,
  medidasDesfecho,
  pacientes,
  rastreioUsoCannabis,
  users,
} from '@/db/schema';
import { db } from '@/lib/db';
import { falha, ok, type ResultadoAction } from '@/lib/ia-clinica/resultado';
import { obterUsuarioAtual } from '@/lib/auth/permissions';
import { registrarAuditoria } from '@/lib/utils/audit';

// ═══════════════════════════════════════════════════════════════════════════════
// ESCOPO DE OBJETO — o médico só toca em paciente que é dele
// ═══════════════════════════════════════════════════════════════════════════════

interface EscopoMedico {
  medicoId: string;
  userId: string;
  pacienteId: string;
}

/**
 * Garante que quem chama é médico **deste** paciente.
 *
 * `pacientes.medicoId` é a ligação. Sem esta conjunção, um médico autenticado leria e escreveria
 * a série de qualquer paciente da plataforma — exatamente o defeito do Item 11.
 */
async function garantirMedicoDoPaciente(
  pacienteId: string,
): Promise<{ ok: true; escopo: EscopoMedico } | { ok: false; erro: string }> {
  const perm = await obterUsuarioAtual();
  if (!perm.autorizado || !perm.clerkId) return { ok: false, erro: 'Não autenticado' };

  const [user] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.clerkId, perm.clerkId))
    .limit(1);
  if (!user) return { ok: false, erro: 'Usuário não encontrado' };
  if (user.role !== 'medico' && user.role !== 'admin') {
    return { ok: false, erro: 'Apenas o médico registra anamnese' };
  }

  const [medico] = await db
    .select({ id: medicos.id })
    .from(medicos)
    .where(eq(medicos.userId, user.id))
    .limit(1);
  if (!medico) return { ok: false, erro: 'Perfil de médico não encontrado' };

  // A conjunção que importa: o paciente tem de ser deste médico.
  const [paciente] = await db
    .select({ id: pacientes.id })
    .from(pacientes)
    .where(
      and(
        eq(pacientes.id, pacienteId),
        eq(pacientes.medicoId, medico.id),
        isNull(pacientes.deletedAt),
      ),
    )
    .limit(1);
  // 404 indistinto: responder diferente para "não existe" e "não é seu" transforma a action em
  // oráculo de enumeração de pacientes.
  if (!paciente) return { ok: false, erro: 'Paciente não encontrado' };

  return { ok: true, escopo: { medicoId: medico.id, userId: user.id, pacienteId: paciente.id } };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MEDIDAS DE DESFECHO — as cinco de DO-24
// ═══════════════════════════════════════════════════════════════════════════════

/** 0–10 para as escalas; faixas plausíveis para os vitais (ADR-0004 D-05). */
const medidaSchema = z.object({
  pacienteId: z.string().min(1).max(64),
  consultaId: z.string().min(1).max(64).optional(),
  anamneseId: z.string().min(1).max(64).optional(),
  medidoEm: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data inválida'),

  nivelDor: z.number().int().min(0).max(10).optional(),
  qualidadeSono: z.number().int().min(0).max(10).optional(),
  nivelAnsiedade: z.number().int().min(0).max(10).optional(),
  qualidadeVidaGlobal: z.number().int().min(0).max(10).optional(),

  crisesContagem: z.number().int().min(0).max(1000).optional(),
  crisesPeriodo: z.enum(['dia', 'semana', 'mes']).optional(),

  // Faixas plausíveis, não "qualquer número". Um `input type=number` aceitaria 700/400.
  pressaoSistolica: z.number().int().min(50).max(300).optional(),
  pressaoDiastolica: z.number().int().min(30).max(200).optional(),
  pesoKg: z.number().min(1).max(400).optional(),

  observacao: z.string().max(2000).optional(),
});

export type NovaMedida = z.infer<typeof medidaSchema>;

/**
 * Registra uma medição. **Sempre insere** — jamais atualiza a anterior.
 *
 * Se a contagem de crises vier, o período vem junto: contagem sem janela não é comparável, e
 * "12 crises" sem dizer em quanto tempo é dado que engana quem lê depois.
 */
export async function registrarMedida(
  entrada: NovaMedida,
): Promise<ResultadoAction<{ medidaId: string }>> {
  const parsed = medidaSchema.safeParse(entrada);
  if (!parsed.success) return falha('Dados inválidos');
  const d = parsed.data;

  if ((d.crisesContagem === undefined) !== (d.crisesPeriodo === undefined)) {
    return falha('Contagem de crises exige o período, e o período exige a contagem');
  }

  const escopo = await garantirMedicoDoPaciente(d.pacienteId);
  if (!escopo.ok) return falha(escopo.erro);

  const [medida] = await db
    .insert(medidasDesfecho)
    .values({
      pacienteId: escopo.escopo.pacienteId,
      consultaId: d.consultaId ?? null,
      anamneseId: d.anamneseId ?? null,
      medidoEm: d.medidoEm,
      nivelDor: d.nivelDor ?? null,
      qualidadeSono: d.qualidadeSono ?? null,
      nivelAnsiedade: d.nivelAnsiedade ?? null,
      qualidadeVidaGlobal: d.qualidadeVidaGlobal ?? null,
      crisesContagem: d.crisesContagem ?? null,
      crisesPeriodo: d.crisesPeriodo ?? null,
      pressaoSistolica: d.pressaoSistolica ?? null,
      pressaoDiastolica: d.pressaoDiastolica ?? null,
      pesoKg: d.pesoKg !== undefined ? String(d.pesoKg) : null,
      observacao: d.observacao ?? null,
      registradoPor: escopo.escopo.medicoId,
    })
    .returning();

  await registrarAuditoria({
    userId: escopo.escopo.userId,
    acao: 'criar',
    entidade: 'medidas_desfecho',
    entidadeId: medida.id,
    dadosDepois: { pacienteId: escopo.escopo.pacienteId, medidoEm: d.medidoEm },
  });

  revalidatePath('/medico/ia-clinica/anamnese');
  return ok({ medidaId: medida.id });
}

export interface SerieMedidas {
  /** Da mais recente para a mais antiga. */
  medidas: Array<{
    id: string;
    medidoEm: string;
    nivelDor: number | null;
    qualidadeSono: number | null;
    nivelAnsiedade: number | null;
    qualidadeVidaGlobal: number | null;
    crisesContagem: number | null;
    crisesPeriodo: 'dia' | 'semana' | 'mes' | null;
    pressaoSistolica: number | null;
    pressaoDiastolica: number | null;
    pesoKg: string | null;
    observacao: string | null;
  }>;
}

/**
 * A série do paciente. **Leitura de dado clínico é auditada** — a regra das três perguntas de
 * `.claude/rules/seguranca-lgpd.md` inclui "o acesso é auditado".
 */
export async function buscarSerieMedidas(
  pacienteId: string,
  limite = 24,
): Promise<ResultadoAction<SerieMedidas>> {
  const escopo = await garantirMedicoDoPaciente(pacienteId);
  if (!escopo.ok) return falha(escopo.erro);

  const medidas = await db
    .select({
      id: medidasDesfecho.id,
      medidoEm: medidasDesfecho.medidoEm,
      nivelDor: medidasDesfecho.nivelDor,
      qualidadeSono: medidasDesfecho.qualidadeSono,
      nivelAnsiedade: medidasDesfecho.nivelAnsiedade,
      qualidadeVidaGlobal: medidasDesfecho.qualidadeVidaGlobal,
      crisesContagem: medidasDesfecho.crisesContagem,
      crisesPeriodo: medidasDesfecho.crisesPeriodo,
      pressaoSistolica: medidasDesfecho.pressaoSistolica,
      pressaoDiastolica: medidasDesfecho.pressaoDiastolica,
      pesoKg: medidasDesfecho.pesoKg,
      observacao: medidasDesfecho.observacao,
    })
    .from(medidasDesfecho)
    .where(
      and(
        eq(medidasDesfecho.pacienteId, escopo.escopo.pacienteId),
        isNull(medidasDesfecho.deletedAt),
      ),
    )
    .orderBy(desc(medidasDesfecho.medidoEm))
    .limit(limite);

  await registrarAuditoria({
    userId: escopo.escopo.userId,
    acao: 'visualizar',
    entidade: 'medidas_desfecho',
    entidadeId: escopo.escopo.pacienteId,
  });

  return ok({ medidas });
}

// ═══════════════════════════════════════════════════════════════════════════════
// RASTREIO DE USO — DO-26 e DO-27
// ═══════════════════════════════════════════════════════════════════════════════

const rastreioSchema = z
  .object({
    pacienteId: z.string().min(1).max(64),
    anamneseId: z.string().min(1).max(64).optional(),
    situacao: z.enum(['primeiro_uso', 'usa_atualmente', 'usou_e_parou']),

    produtoDescrito: z.string().max(300).optional(),
    medicamentoId: z.string().min(1).max(64).optional(),
    proporcaoCbdThc: z.string().max(40).optional(),
    doseRelatada: z.string().max(200).optional(),
    mgDiaEstimado: z.number().min(0).max(10_000).optional(),
    viaAdministracao: z.enum(['oral', 'sublingual', 'inalada', 'topica', 'outra']).optional(),
    origem: z
      .enum(['importado', 'nacional_registrado', 'associacao', 'artesanal', 'desconhecida'])
      .optional(),
    usoDesde: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    respostaPercebida: z
      .enum(['melhorou_muito', 'melhorou_pouco', 'sem_mudanca', 'piorou', 'nao_sabe'])
      .optional(),
    efeitoAdversoRelatado: z.string().max(2000).optional(),
    adesao: z
      .enum(['tomou_como_prescrito', 'tomou_menos', 'tomou_mais', 'interrompeu', 'nao_iniciou'])
      .optional(),
    motivoNaoAdesao: z.string().max(2000).optional(),

    expectativa: z.string().max(2000).optional(),
    receio: z.string().max(2000).optional(),
    usoRecreativoConcomitante: z.boolean().optional(),
    observacao: z.string().max(2000).optional(),
  })
  // 🔴 A ramificação de DO-27 é validada NO SERVIDOR, não só escondida na tela.
  // Gravar dose de quem declarou primeiro uso é contradição em dado clínico, e quem lê depois
  // não tem como saber qual dos dois campos acreditar.
  .refine(
    (d) =>
      d.situacao !== 'primeiro_uso' ||
      (!d.produtoDescrito && !d.doseRelatada && !d.medicamentoId && !d.adesao),
    { message: 'Primeiro uso não pode ter produto, dose ou adesão' },
  );

export type NovoRastreio = z.infer<typeof rastreioSchema>;

/** Registra o rastreio. Insere sempre: o rastreio do retorno não apaga o da primeira consulta. */
export async function registrarRastreioUso(
  entrada: NovoRastreio,
): Promise<ResultadoAction<{ rastreioId: string }>> {
  const parsed = rastreioSchema.safeParse(entrada);
  if (!parsed.success) {
    return falha(parsed.error.issues[0]?.message ?? 'Dados inválidos');
  }
  const d = parsed.data;

  const escopo = await garantirMedicoDoPaciente(d.pacienteId);
  if (!escopo.ok) return falha(escopo.erro);

  const [rastreio] = await db
    .insert(rastreioUsoCannabis)
    .values({
      pacienteId: escopo.escopo.pacienteId,
      anamneseId: d.anamneseId ?? null,
      situacao: d.situacao,
      produtoDescrito: d.produtoDescrito ?? null,
      medicamentoId: d.medicamentoId ?? null,
      proporcaoCbdThc: d.proporcaoCbdThc ?? null,
      doseRelatada: d.doseRelatada ?? null,
      mgDiaEstimado: d.mgDiaEstimado !== undefined ? String(d.mgDiaEstimado) : null,
      viaAdministracao: d.viaAdministracao ?? null,
      origem: d.origem ?? null,
      usoDesde: d.usoDesde ?? null,
      respostaPercebida: d.respostaPercebida ?? null,
      efeitoAdversoRelatado: d.efeitoAdversoRelatado ?? null,
      adesao: d.adesao ?? null,
      motivoNaoAdesao: d.motivoNaoAdesao ?? null,
      expectativa: d.expectativa ?? null,
      receio: d.receio ?? null,
      usoRecreativoConcomitante: d.usoRecreativoConcomitante ?? null,
      observacao: d.observacao ?? null,
      registradoPor: escopo.escopo.medicoId,
    })
    .returning();

  await registrarAuditoria({
    userId: escopo.escopo.userId,
    acao: 'criar',
    entidade: 'rastreio_uso_cannabis',
    entidadeId: rastreio.id,
    dadosDepois: { pacienteId: escopo.escopo.pacienteId, situacao: d.situacao },
  });

  revalidatePath('/medico/ia-clinica/anamnese');
  return ok({ rastreioId: rastreio.id });
}

/** O rastreio mais recente do paciente — é o ponto de partida da titulação. */
export async function buscarUltimoRastreio(
  pacienteId: string,
): Promise<ResultadoAction<{ rastreio: typeof rastreioUsoCannabis.$inferSelect | null }>> {
  const escopo = await garantirMedicoDoPaciente(pacienteId);
  if (!escopo.ok) return falha(escopo.erro);

  const [rastreio] = await db
    .select()
    .from(rastreioUsoCannabis)
    .where(
      and(
        eq(rastreioUsoCannabis.pacienteId, escopo.escopo.pacienteId),
        isNull(rastreioUsoCannabis.deletedAt),
      ),
    )
    .orderBy(desc(rastreioUsoCannabis.createdAt))
    .limit(1);

  await registrarAuditoria({
    userId: escopo.escopo.userId,
    acao: 'visualizar',
    entidade: 'rastreio_uso_cannabis',
    entidadeId: escopo.escopo.pacienteId,
  });

  return ok({ rastreio: rastreio ?? null });
}

/**
 * O paciente já tem anamnese? Decide entre **primeira avaliação** e **retorno** (ADR-0004 D-02).
 *
 * Não é preferência de tela: no retorno, só as medidas repetíveis aparecem, com o valor anterior
 * ao lado. Pedir história familiar de novo a cada consulta é o que a ADR rejeita como
 * "transformar comparação em arqueologia".
 */
export async function ehPrimeiraAvaliacao(
  pacienteId: string,
): Promise<ResultadoAction<{ primeira: boolean; anamneseId: string | null }>> {
  const escopo = await garantirMedicoDoPaciente(pacienteId);
  if (!escopo.ok) return falha(escopo.erro);

  const [existente] = await db
    .select({ id: anamneses.id })
    .from(anamneses)
    .where(and(eq(anamneses.pacienteId, escopo.escopo.pacienteId), isNull(anamneses.deletedAt)))
    .orderBy(desc(anamneses.createdAt))
    .limit(1);

  return ok({ primeira: !existente, anamneseId: existente?.id ?? null });
}
