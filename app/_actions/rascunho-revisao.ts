'use server';

/**
 * O RASCUNHO DA REVISÃO — salvo no servidor, com histórico.
 *
 * `DO-41`: *"o médico pode sair sem querer e esse dado precisa ficar salvo, ou seja precisa ter
 * um historico assim como tem no vid-ai"*.
 *
 * 🛑 `localStorage` FOI REJEITADO COM MOTIVO (ADR-0011 D-03): é dado de saúde num navegador de
 * consultório que pode ser compartilhado, e não sobrevive a trocar de máquina — que é
 * exatamente o caso que o `DO-41` descreve.
 *
 * 🔴 CADA SALVAMENTO É LINHA NOVA. Não há `update` aqui. Histórico que se sobrescreve não é
 * histórico — a mesma regra de `medidasDesfecho` e `ajustesDosagem`.
 *
 * 🔴 ESCOPO DE OBJETO EM TODA FUNÇÃO, mais um segundo filtro por `medicoId`: rascunho é
 * pensamento a meio caminho, e o de um médico não aparece para outro nem dentro do mesmo
 * paciente.
 */

import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';

import { rascunhosRevisaoIa } from '@/db/schema';
import { db } from '@/lib/db';
import { garantirMedicoDoPaciente } from '@/lib/auth/escopo-paciente';
import { falha, ok, type ResultadoAction } from '@/lib/ia-clinica/resultado';

const salvarSchema = z
  .object({
    pacienteId: z.string().min(1).max(64),
    anamneseId: z.string().min(1).max(64).optional(),
    teleconsultaId: z.string().min(1).max(64).optional(),
    /** O formulário como está. JSONB porque a tela evolui e o rascunho de hoje precisa abrir amanhã. */
    conteudo: z.record(z.string(), z.unknown()),
  })
  .refine((d) => Boolean(d.anamneseId || d.teleconsultaId), {
    message: 'O rascunho precisa estar ligado a uma anamnese ou a uma teleconsulta',
  });

export interface VersaoDoRascunho {
  id: string;
  versao: number;
  conteudo: Record<string, unknown>;
  criadoEm: string;
}

/**
 * Salva uma versão nova. **Sempre insere.**
 *
 * A versão é calculada a partir da última do mesmo médico + paciente + origem. Não há `update`,
 * então duas abas abertas produzem duas versões — o que é o comportamento certo: as duas
 * existiram, e o médico escolhe.
 */
export async function salvarRascunhoRevisao(
  entrada: z.infer<typeof salvarSchema>,
): Promise<ResultadoAction<{ rascunhoId: string; versao: number }>> {
  const parsed = salvarSchema.safeParse(entrada);
  if (!parsed.success) return falha(parsed.error.issues[0]?.message ?? 'Dados inválidos');
  const d = parsed.data;

  const escopo = await garantirMedicoDoPaciente(d.pacienteId);
  if (!escopo.ok) return falha(escopo.erro);

  try {
    const [ultima] = await db
      .select({ versao: rascunhosRevisaoIa.versao })
      .from(rascunhosRevisaoIa)
      .where(
        and(
          eq(rascunhosRevisaoIa.pacienteId, escopo.escopo.pacienteId),
          eq(rascunhosRevisaoIa.medicoId, escopo.escopo.medicoId),
        ),
      )
      .orderBy(desc(rascunhosRevisaoIa.versao))
      .limit(1);

    const [nova] = await db
      .insert(rascunhosRevisaoIa)
      .values({
        pacienteId: escopo.escopo.pacienteId,
        medicoId: escopo.escopo.medicoId,
        anamneseId: d.anamneseId ?? null,
        teleconsultaId: d.teleconsultaId ?? null,
        versao: (ultima?.versao ?? 0) + 1,
        conteudo: d.conteudo,
        // 🔴 `retencaoAte` fica NULO: o prazo é decisão do Jurídico e não se chuta
        // (`.claude/rules/seguranca-lgpd.md`).
      })
      .returning({ id: rascunhosRevisaoIa.id, versao: rascunhosRevisaoIa.versao });

    if (!nova?.id) return falha('Falha ao salvar o rascunho');
    return ok({ rascunhoId: nova.id, versao: nova.versao });
  } catch (erro) {
    console.error('[rascunho-revisao] salvar', erro);
    return falha('Erro ao salvar o rascunho');
  }
}

/**
 * O histórico completo, da versão mais nova para a mais antiga.
 *
 * A primeira da lista é o rascunho atual; as demais são o histórico que o `DO-41` pede. Devolver
 * as duas coisas na mesma chamada evita que a tela precise decidir qual pedir.
 */
export async function listarRascunhosRevisao(
  pacienteId: string,
): Promise<ResultadoAction<VersaoDoRascunho[]>> {
  const escopo = await garantirMedicoDoPaciente(pacienteId);
  if (!escopo.ok) return falha(escopo.erro);

  try {
    const linhas = await db
      .select({
        id: rascunhosRevisaoIa.id,
        versao: rascunhosRevisaoIa.versao,
        conteudo: rascunhosRevisaoIa.conteudo,
        criadoEm: rascunhosRevisaoIa.createdAt,
      })
      .from(rascunhosRevisaoIa)
      .where(
        and(
          eq(rascunhosRevisaoIa.pacienteId, escopo.escopo.pacienteId),
          // O segundo filtro: rascunho de um médico não aparece para outro.
          eq(rascunhosRevisaoIa.medicoId, escopo.escopo.medicoId),
        ),
      )
      .orderBy(desc(rascunhosRevisaoIa.versao));

    return ok(
      linhas.map((l) => ({
        id: l.id,
        versao: l.versao,
        conteudo: (l.conteudo ?? {}) as Record<string, unknown>,
        criadoEm: l.criadoEm.toISOString(),
      })),
    );
  } catch (erro) {
    console.error('[rascunho-revisao] listar', erro);
    return falha('Erro ao carregar o rascunho');
  }
}
