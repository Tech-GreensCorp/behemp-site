'use server';

import { db } from '@/lib/db';
import { dosagens, medicamentos } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import { verificarMedicoOuAdmin } from '@/lib/auth';
import { calcularDosagem } from '@/lib/utils/dosagem';

export async function listarRastreios(pacienteId: string) {
  try {
    await verificarMedicoOuAdmin();
    const resultados = await db
      .select({
        id: dosagens.id,
        pacienteId: dosagens.pacienteId,
        medicamentoId: dosagens.medicamentoId,
        medicamentoNome: medicamentos.nome,
        gotasPorDia: dosagens.gotasPorDia,
        mlFrasco: dosagens.mlFrasco,
        dataInicio: dosagens.dataInicio,
        dataFimPrevista: dosagens.dataFimPrevista,
        ativa: dosagens.ativa,
        createdAt: dosagens.createdAt,
      })
      .from(dosagens)
      .innerJoin(medicamentos, eq(dosagens.medicamentoId, medicamentos.id))
      .where(eq(dosagens.pacienteId, pacienteId))
      .orderBy(desc(dosagens.createdAt));

    return { sucesso: true, dados: resultados };
  } catch (error: any) {
    console.error('Erro ao listar rastreios:', error);
    return { sucesso: false, erro: error.message };
  }
}

const criarSchema = z.object({
  pacienteId: z.string().min(1),
  medicamentoId: z.string().min(1, 'Medicamento é obrigatório'),
  gotasPorDia: z.number().min(1, 'Gotas por dia deve ser maior que 0'),
  mlFrasco: z.number().min(1, 'Volume do frasco deve ser maior que 0'),
  dataInicio: z.string().min(1, 'Data de início é obrigatória'),
});

export async function criarRastreio(dados: z.infer<typeof criarSchema>) {
  try {
    await verificarMedicoOuAdmin();
    const req = criarSchema.parse(dados);

    // Usa a mesma matemática utilitária para prever o fim (considerando padrão 30 gotas/ml para BeHemp)
    const { dataFimPrevista } = calcularDosagem({
      mlFrasco: req.mlFrasco,
      gotasPorDia: req.gotasPorDia,
      gotasPorMl: 30, // Padrão BeHemp
      dataInicio: new Date(req.dataInicio + 'T12:00:00'),
    });

    await db.insert(dosagens).values({
      pacienteId: req.pacienteId,
      medicamentoId: req.medicamentoId,
      gotasPorDia: req.gotasPorDia,
      mlFrasco: req.mlFrasco,
      dataInicio: req.dataInicio,
      dataFimPrevista: dataFimPrevista.toISOString().split('T')[0],
      ativa: true,
    });

    return { sucesso: true };
  } catch (error: any) {
    console.error('Erro ao criar rastreio:', error);
    return { sucesso: false, erro: error.message };
  }
}

export async function encerrarRastreio(id: string) {
  try {
    await verificarMedicoOuAdmin();
    await db.update(dosagens).set({ ativa: false }).where(eq(dosagens.id, id));
    return { sucesso: true };
  } catch (error: any) {
    console.error('Erro ao encerrar rastreio:', error);
    return { sucesso: false, erro: error.message };
  }
}
