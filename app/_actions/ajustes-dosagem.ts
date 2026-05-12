'use server';

import { db } from '@/lib/db';
import { ajustesDosagem, itensAjusteDosagem } from '@/db/schema';
import { eq, and, isNull, desc, sql } from 'drizzle-orm';
import { z } from 'zod';
import { verificarMedicoOuAdmin } from '@/lib/auth';

async function obterMedicoId(clerkId: string): Promise<string | null> {
  const res = await db.execute(
    sql`SELECT m.id FROM medicos m INNER JOIN users u ON m.user_id = u.id WHERE u.clerk_id = ${clerkId} LIMIT 1`,
  );
  return (res.rows[0]?.id as string) ?? null;
}

const itemSchema = z.object({
  tipoCanabinoide: z.string().min(1, 'Tipo de canabinóide é obrigatório'),
  novaDosagem: z.string().min(1, 'Nova dosagem é obrigatória'),
  dosagemAnterior: z.string().optional(),
  frequencia: z.string().min(1, 'Frequência é obrigatória'),
  concentracaoTHC: z.string().optional(),
  concentracaoCBD: z.string().optional(),
  viaAdministracao: z.string().optional(),
});

const criarAjusteSchema = z.object({
  pacienteId: z.string().min(1),
  dataAjuste: z.string().min(1, 'Data do ajuste é obrigatória'),
  proximaRevisao: z.string().optional(),
  motivoAjuste: z.string().min(1, 'Motivo do ajuste é obrigatório'),
  itens: z.array(itemSchema).min(1, 'Adicione pelo menos um medicamento'),
});

export async function criarAjusteDosagem(dados: z.infer<typeof criarAjusteSchema>) {
  try {
    const auth = await verificarMedicoOuAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };
    const parsed = criarAjusteSchema.safeParse(dados);
    if (!parsed.success) return { sucesso: false, erro: parsed.error.errors[0].message };
    const medicoId = await obterMedicoId(auth.clerkId!);
    if (!medicoId) return { sucesso: false, erro: 'Médico não encontrado' };

    const [ajuste] = await db.insert(ajustesDosagem).values({
      pacienteId: parsed.data.pacienteId,
      dataAjuste: parsed.data.dataAjuste,
      proximaRevisao: parsed.data.proximaRevisao || null,
      motivoAjuste: parsed.data.motivoAjuste,
      criadoPor: medicoId,
    }).returning();

    // Inserir itens
    for (const item of parsed.data.itens) {
      await db.insert(itensAjusteDosagem).values({
        ajusteId: ajuste.id,
        tipoCanabinoide: item.tipoCanabinoide,
        novaDosagem: item.novaDosagem,
        dosagemAnterior: item.dosagemAnterior || null,
        frequencia: item.frequencia,
        concentracaoTHC: item.concentracaoTHC || null,
        concentracaoCBD: item.concentracaoCBD || null,
        viaAdministracao: item.viaAdministracao || null,
      });
    }

    return { sucesso: true, dados: ajuste };
  } catch (error) {
    console.error('[Action] Erro ao criar ajuste de dosagem:', error);
    return { sucesso: false, erro: 'Erro ao criar ajuste de dosagem' };
  }
}

export async function listarAjustesDosagem(pacienteId: string) {
  try {
    const auth = await verificarMedicoOuAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const ajustes = await db.select().from(ajustesDosagem)
      .where(and(eq(ajustesDosagem.pacienteId, pacienteId), isNull(ajustesDosagem.deletedAt)))
      .orderBy(desc(ajustesDosagem.dataAjuste));

    // Buscar itens de cada ajuste
    const resultado = [];
    for (const aj of ajustes) {
      const itens = await db.select().from(itensAjusteDosagem)
        .where(eq(itensAjusteDosagem.ajusteId, aj.id));
      resultado.push({ ...aj, itens });
    }

    return { sucesso: true, dados: resultado };
  } catch (error) {
    console.error('[Action] Erro ao listar ajustes:', error);
    return { sucesso: false, erro: 'Erro ao listar ajustes' };
  }
}

const editarAjusteSchema = z.object({
  ajusteId: z.string().min(1),
  dataAjuste: z.string().min(1, 'Data do ajuste é obrigatória'),
  proximaRevisao: z.string().optional(),
  motivoAjuste: z.string().min(1, 'Motivo do ajuste é obrigatório'),
  itens: z.array(itemSchema).min(1, 'Adicione pelo menos um medicamento'),
});

/**
 * Edita um ajuste de dosagem existente.
 * Substitui todos os itens anteriores pelos novos.
 */
export async function editarAjusteDosagem(dados: z.infer<typeof editarAjusteSchema>) {
  try {
    const auth = await verificarMedicoOuAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const parsed = editarAjusteSchema.safeParse(dados);
    if (!parsed.success) return { sucesso: false, erro: parsed.error.errors[0].message };

    // Atualizar campos principais do ajuste
    await db
      .update(ajustesDosagem)
      .set({
        dataAjuste: parsed.data.dataAjuste,
        proximaRevisao: parsed.data.proximaRevisao || null,
        motivoAjuste: parsed.data.motivoAjuste,
      })
      .where(and(eq(ajustesDosagem.id, parsed.data.ajusteId), isNull(ajustesDosagem.deletedAt)));

    // Remover itens antigos e reinserir (estratégia replace)
    await db.delete(itensAjusteDosagem).where(eq(itensAjusteDosagem.ajusteId, parsed.data.ajusteId));

    for (const item of parsed.data.itens) {
      await db.insert(itensAjusteDosagem).values({
        ajusteId: parsed.data.ajusteId,
        tipoCanabinoide: item.tipoCanabinoide,
        novaDosagem: item.novaDosagem,
        dosagemAnterior: item.dosagemAnterior || null,
        frequencia: item.frequencia,
        concentracaoTHC: item.concentracaoTHC || null,
        concentracaoCBD: item.concentracaoCBD || null,
        viaAdministracao: item.viaAdministracao || null,
      });
    }

    return { sucesso: true };
  } catch (error) {
    console.error('[Action] Erro ao editar ajuste de dosagem:', error);
    return { sucesso: false, erro: 'Erro ao editar ajuste de dosagem' };
  }
}

/**
 * Exclui um ajuste de dosagem via soft delete.
 */
export async function excluirAjusteDosagem(ajusteId: string) {
  try {
    const auth = await verificarMedicoOuAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    await db
      .update(ajustesDosagem)
      .set({ deletedAt: new Date() })
      .where(and(eq(ajustesDosagem.id, ajusteId), isNull(ajustesDosagem.deletedAt)));

    return { sucesso: true };
  } catch (error) {
    console.error('[Action] Erro ao excluir ajuste de dosagem:', error);
    return { sucesso: false, erro: 'Erro ao excluir ajuste de dosagem' };
  }
}
