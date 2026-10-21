'use server';

/**
 * A TRAVA 2 — o ato humano que a saída da IA precisa atravessar antes de existir no prontuário.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * `DO-29`: *"toda ação dela precisa de uma confirmação human in the looping"*. E a CFM diz o
 * mesmo por outro caminho — *"A autonomia médica está diretamente relacionada à responsabilidade
 * pelo ato médico"* (2.314/2022 Art. 4º §2º, `CFM-04`).
 *
 * 🔴 O QUE ESTAS FUNÇÕES SUSTENTAM
 * Que o sistema **informa** em vez de **dirigir** a conduta — a distinção que pesa no
 * enquadramento de software médico (`ANV-01`…`ANV-04`). A linha gravada aqui é a evidência de
 * que houve juízo humano. Sem ela, não há como demonstrar qual dos dois o sistema é.
 *
 * 🔴 DIVERGÊNCIA EXIGE JUSTIFICATIVA, CONCORDÂNCIA TAMBÉM PODE TER
 * Divergir sem dizer por quê é ruído, e ruído não mede a qualidade de modelo nenhuma. A
 * validação é feita aqui, no servidor — não escondendo o botão na tela.
 */

import { and, desc, eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { medicos, pacientes, revisoesIa, users } from '@/db/schema';
import { db } from '@/lib/db';
import { GRAFO_SCHEMA_VERSION } from '@/lib/ia-clinica/contrato';
import { falha, ok, type ResultadoAction } from '@/lib/ia-clinica/resultado';
import { obterUsuarioAtual } from '@/lib/auth/permissions';
import { registrarAuditoria } from '@/lib/utils/audit';

/** Mesmo escopo de objeto da anamnese: o médico só toca em paciente que é dele. */
async function garantirMedicoDoPaciente(pacienteId: string) {
  const perm = await obterUsuarioAtual();
  if (!perm.autorizado || !perm.clerkId) return { ok: false as const, erro: 'Não autenticado' };

  const [user] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.clerkId, perm.clerkId))
    .limit(1);
  if (!user) return { ok: false as const, erro: 'Usuário não encontrado' };
  if (user.role !== 'medico' && user.role !== 'admin') {
    return { ok: false as const, erro: 'Somente o médico revisa a análise' };
  }

  const [medico] = await db
    .select({ id: medicos.id })
    .from(medicos)
    .where(eq(medicos.userId, user.id))
    .limit(1);
  if (!medico) return { ok: false as const, erro: 'Perfil de médico não encontrado' };

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
  if (!paciente) return { ok: false as const, erro: 'Paciente não encontrado' };

  return { ok: true as const, medicoId: medico.id, userId: user.id, pacienteId: paciente.id };
}

const revisaoSchema = z
  .object({
    pacienteId: z.string().min(1).max(64),
    anamneseId: z.string().min(1).max(64).optional(),
    teleconsultaId: z.string().min(1).max(64).optional(),

    validacao: z.enum(['validado', 'divergente']),
    /** A hipótese acatada. Ausente quando o médico divergiu de todas. */
    hipoteseAcatadaId: z.string().min(1).max(64).optional(),
    hipoteseAcatadaTitulo: z.string().max(400).optional(),
    conclusaoMedico: z.string().max(5000).optional(),
    cidMedico: z.string().max(20).optional(),

    // ── O que a divergência alimenta (`DO-40`, ADR-0011 D-01) ────────────────
    /** Por que a IA errou. **OPCIONAL** — exigir de quem tem pressa produz texto vazio. */
    porQueIaErrou: z.string().max(5000).optional(),
    /** O medicamento que o médico vai prescrever. **Obrigatório ao divergir** (refine abaixo). */
    medicamentoPrescritoNome: z.string().max(300).optional(),
    /** Quando veio do catálogo. Nulo para avulso — o nome é que é obrigatório. */
    medicamentoPrescritoId: z.string().min(1).max(64).optional(),
    /** A saída como ela apareceu na tela, congelada. É o que torna a revisão auditável. */
    saidaApresentada: z.record(z.string(), z.unknown()).optional(),
  })
  // 🔴 Divergir sem dizer por quê é ruído. A regra vive no servidor, não na tela: um cliente
  // forjado gravaria divergência vazia, e a série de divergências deixaria de medir qualquer coisa.
  .refine((d) => d.validacao !== 'divergente' || (d.conclusaoMedico ?? '').trim().length >= 10, {
    message: 'Ao divergir, descreva sua conclusão — divergência sem justificativa não mede nada',
  })
  // Validar sem dizer o que foi validado deixa o registro sem objeto.
  .refine((d) => d.validacao !== 'validado' || Boolean(d.hipoteseAcatadaId), {
    message: 'Para validar, escolha qual hipótese você acatou',
  })
  // 🔴 `DO-40`: ao divergir, o medicamento que o médico VAI prescrever é obrigatório.
  // Sem o desfecho, a divergência diz que o modelo errou mas não o que era certo — e é o par
  // (sugerido × escolhido) que ensina o RAG. A regra vive no SERVIDOR, como a de cima: cliente
  // forjado gravaria divergência sem desfecho, e a série deixaria de medir qualquer coisa.
  .refine(
    (d) => d.validacao !== 'divergente' || (d.medicamentoPrescritoNome ?? '').trim().length >= 2,
    {
      message:
        'Ao divergir, informe o medicamento que você vai prescrever — é ele que fecha o par que o RAG aprende',
    },
  );

export type NovaRevisao = z.infer<typeof revisaoSchema>;

/**
 * Registra a decisão do médico sobre a saída da IA.
 *
 * **Insere sempre.** Uma revisão nova não apaga a anterior: se o médico mudou de opinião depois
 * de um exame, as duas leituras importam — e o histórico clínico não se sobrescreve.
 */
export async function registrarRevisao(
  entrada: NovaRevisao,
): Promise<ResultadoAction<{ revisaoId: string }>> {
  const parsed = revisaoSchema.safeParse(entrada);
  if (!parsed.success) return falha(parsed.error.issues[0]?.message ?? 'Dados inválidos');
  const d = parsed.data;

  if (!d.anamneseId && !d.teleconsultaId) {
    return falha('A revisão precisa estar ligada a uma anamnese ou a uma teleconsulta');
  }

  const escopo = await garantirMedicoDoPaciente(d.pacienteId);
  if (!escopo.ok) return falha(escopo.erro);

  const [revisao] = await db
    .insert(revisoesIa)
    .values({
      pacienteId: escopo.pacienteId,
      anamneseId: d.anamneseId ?? null,
      teleconsultaId: d.teleconsultaId ?? null,
      status: 'concluido',
      schemaVersion: GRAFO_SCHEMA_VERSION,
      saidaApresentada: d.saidaApresentada ?? null,
      hipoteseAcatadaId: d.hipoteseAcatadaId ?? null,
      hipoteseAcatadaTitulo: d.hipoteseAcatadaTitulo ?? null,
      validacao: d.validacao,
      conclusaoMedico: d.conclusaoMedico ?? null,
      cidMedico: d.cidMedico ?? null,
      porQueIaErrou: d.porQueIaErrou?.trim() || null,
      medicamentoPrescritoNome: d.medicamentoPrescritoNome?.trim() || null,
      medicamentoPrescritoId: d.medicamentoPrescritoId ?? null,
      fonteRag: 'revisao_humana',
      // 🔴 `ingeridoNoCorpusEm` NÃO é preenchido aqui, e não deve ser em lugar nenhum enquanto
      // o `GAP-16` estiver aberto: construir os campos não é ingerir (ADR-0011 D-02).

      revisadoEm: new Date(),
      revisadoPor: escopo.medicoId,
    })
    .returning();

  // A auditoria diz QUEM decidiu — é metade do valor do registro.
  await registrarAuditoria({
    userId: escopo.userId,
    acao: 'criar',
    entidade: 'revisoes_ia',
    entidadeId: revisao.id,
    dadosDepois: {
      validacao: d.validacao,
      hipoteseAcatada: d.hipoteseAcatadaTitulo ?? null,
      medicamentoPrescrito: d.medicamentoPrescritoNome ?? null,
      explicouPorQueIaErrou: Boolean(d.porQueIaErrou?.trim()),
      fundamento: 'CFM 2.314/2022 Art. 4º §2º — quem responde pelo ato decide',
    },
  });

  revalidatePath('/medico/ia-clinica/anamnese');
  return ok({ revisaoId: revisao.id });
}

export interface RevisaoRegistrada {
  id: string;
  validacao: 'validado' | 'divergente' | null;
  hipoteseAcatadaTitulo: string | null;
  conclusaoMedico: string | null;
  cidMedico: string | null;
  revisadoEm: Date | null;
  schemaVersion: string | null;
}

/** As revisões do paciente, da mais recente para a mais antiga. */
export async function listarRevisoes(
  pacienteId: string,
  limite = 10,
): Promise<ResultadoAction<{ revisoes: RevisaoRegistrada[] }>> {
  const escopo = await garantirMedicoDoPaciente(pacienteId);
  if (!escopo.ok) return falha(escopo.erro);

  const revisoes = await db
    .select({
      id: revisoesIa.id,
      validacao: revisoesIa.validacao,
      hipoteseAcatadaTitulo: revisoesIa.hipoteseAcatadaTitulo,
      conclusaoMedico: revisoesIa.conclusaoMedico,
      cidMedico: revisoesIa.cidMedico,
      revisadoEm: revisoesIa.revisadoEm,
      schemaVersion: revisoesIa.schemaVersion,
    })
    .from(revisoesIa)
    .where(and(eq(revisoesIa.pacienteId, escopo.pacienteId), isNull(revisoesIa.deletedAt)))
    .orderBy(desc(revisoesIa.revisadoEm))
    .limit(limite);

  await registrarAuditoria({
    userId: escopo.userId,
    acao: 'visualizar',
    entidade: 'revisoes_ia',
    entidadeId: escopo.pacienteId,
  });

  return ok({ revisoes });
}
