'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import {
  evolucoes,
  consultas,
  prescricoes,
  exames,
  ajustesDosagem,
  itensAjusteDosagem,
  documentos,
  anamneses,
} from '@/db/schema';
import { verificarMedico } from '@/lib/auth/permissions';
import { resolverContextoSala } from '@/lib/teleconsulta/contexto-sala';
import { eq, and, isNull, desc } from 'drizzle-orm';

// Tipos 
export type TipoEventoProntuario = 'evolucao' | 'consulta' | 'prescricao' | 'exame' | 'ajuste_dosagem' | 'documento' | 'anamnese';

export interface EventoProntuario {
  id: string;
  tipo: TipoEventoProntuario;
  data: string; // ISO
  titulo: string;
  resumo: string | null;
  detalhes: Record<string, unknown>;
}

const buscarSchema = z.object({
  salaId: z.string().min(1),
  cursor: z.string().optional().nullable(),
  filtro: z.enum(['todos', 'evolucao', 'consulta', 'prescricao', 'exame', 'ajuste_dosagem', 'documento', 'anamnese']).default('todos'),
  busca: z.string().optional().nullable(),
});

export async function buscarProntuarioCompleto(input: unknown): Promise<{
  sucesso: boolean;
  eventos?: EventoProntuario[];
  proximoCursor?: string | null;
  erro?: string;
}> {
  try {
    const perm = await verificarMedico();
    if (!perm.autorizado || !perm.clerkId) return { sucesso: false, erro: 'Não autorizado' };

    const parsed = buscarSchema.safeParse(input);
    if (!parsed.success) return { sucesso: false, erro: 'Dados inválidos' };
    const { salaId, cursor, filtro, busca } = parsed.data;

    // Resolve contexto da sala
    const salaCtx = await resolverContextoSala(salaId);
    if (!salaCtx) return { sucesso: false, erro: 'Sala não encontrada' };

    const pacienteId = salaCtx.pacienteId;
    let eventosRaw: EventoProntuario[] = [];

    // --- 1. Evoluções ---
    if (filtro === 'todos' || filtro === 'evolucao') {
      const rows = await db.select().from(evolucoes)
        .where(and(eq(evolucoes.pacienteId, pacienteId), isNull(evolucoes.deletedAt)));
      for (const r of rows) {
        eventosRaw.push({
          id: r.id,
          tipo: 'evolucao',
          data: new Date(r.createdAt).toISOString(),
          titulo: `Evolução — ${r.tipo.charAt(0).toUpperCase() + r.tipo.slice(1)}`,
          resumo: r.sintomasAtuais || r.conteudo.substring(0, 100) + '...',
          detalhes: {
            conteudo: r.conteudo,
            sintomasAtuais: r.sintomasAtuais,
            efeitosColaterais: r.efeitosColaterais,
            nivelDor: r.nivelDor,
            qualidadeSono: r.qualidadeSono,
            bemEstar: r.bemEstar,
          }
        });
      }
    }

    // --- 2. Consultas ---
    if (filtro === 'todos' || filtro === 'consulta') {
      const rows = await db.select().from(consultas)
        .where(and(eq(consultas.pacienteId, pacienteId), isNull(consultas.deletedAt)));
      for (const r of rows) {
        eventosRaw.push({
          id: r.id,
          tipo: 'consulta',
          data: new Date(r.dataHora).toISOString(),
          titulo: `Consulta — ${r.status.charAt(0).toUpperCase() + r.status.slice(1)}`,
          resumo: r.observacoes || 'Teleconsulta',
          detalhes: {
            status: r.status,
            observacoes: r.observacoes,
            meetLink: r.googleMeetLink
          }
        });
      }
    }

    // --- 3. Prescrições ---
    if (filtro === 'todos' || filtro === 'prescricao') {
      const rows = await db.select().from(prescricoes)
        .where(and(eq(prescricoes.pacienteId, pacienteId), isNull(prescricoes.deletedAt)));
      for (const r of rows) {
        const meds = Array.isArray(r.medicamentos) ? r.medicamentos : [];
        eventosRaw.push({
          id: r.id,
          tipo: 'prescricao',
          data: new Date(r.createdAt).toISOString(),
          titulo: `Prescrição Emitida`,
          resumo: `${meds.length} medicamento(s) prescrito(s)`,
          detalhes: {
            medicamentos: r.medicamentos,
            status: r.status,
            validade: r.validade ? new Date(r.validade).toISOString() : null,
          }
        });
      }
    }

    // --- 4. Exames ---
    if (filtro === 'todos' || filtro === 'exame') {
      const rows = await db.select().from(exames)
        .where(and(eq(exames.pacienteId, pacienteId), isNull(exames.deletedAt)));
      for (const r of rows) {
        eventosRaw.push({
          id: r.id,
          tipo: 'exame',
          data: new Date(r.dataExame).toISOString(), // ou createdAt
          titulo: `Exame: ${r.nomeExame}`,
          resumo: r.observacoes || 'Sem observações',
          detalhes: {
            nomeArquivo: r.nomeArquivo,
            urlArquivo: r.urlArquivo,
            observacoes: r.observacoes,
          }
        });
      }
    }

    // --- 5. Ajustes de Dosagem ---
    if (filtro === 'todos' || filtro === 'ajuste_dosagem') {
      const rows = await db.select().from(ajustesDosagem)
        .where(and(eq(ajustesDosagem.pacienteId, pacienteId), isNull(ajustesDosagem.deletedAt)));
      
      // Buscar itens p/ cada
      for (const r of rows) {
        const itens = await db.select().from(itensAjusteDosagem).where(eq(itensAjusteDosagem.ajusteId, r.id));
        eventosRaw.push({
          id: r.id,
          tipo: 'ajuste_dosagem',
          data: new Date(r.dataAjuste).toISOString(),
          titulo: `Ajuste de Dosagem`,
          resumo: r.motivoAjuste,
          detalhes: {
            motivo: r.motivoAjuste,
            itens: itens,
          }
        });
      }
    }

    // --- 6. Documentos ---
    if (filtro === 'todos' || filtro === 'documento') {
      const rows = await db.select().from(documentos)
        .where(and(eq(documentos.pacienteId, pacienteId), isNull(documentos.deletedAt)));
      for (const r of rows) {
        const tipoLabel = r.tipo.replace(/_/g, ' ').toUpperCase();
        eventosRaw.push({
          id: r.id,
          tipo: 'documento',
          data: new Date(r.dataEmissao).toISOString(),
          titulo: `Documento: ${tipoLabel}`,
          resumo: r.nomeArquivo || r.observacoes || 'Anexado ao prontuário',
          detalhes: {
            tipo: r.tipo,
            validade: new Date(r.dataValidade).toISOString(),
            url: r.urlBlob,
            observacoes: r.observacoes,
          }
        });
      }
    }

    // --- 7. Anamneses ---
    if (filtro === 'todos' || filtro === 'anamnese') {
      const rows = await db.select().from(anamneses)
        .where(and(eq(anamneses.pacienteId, pacienteId), isNull(anamneses.deletedAt)));
      for (const r of rows) {
        eventosRaw.push({
          id: r.id,
          tipo: 'anamnese',
          data: new Date(r.createdAt).toISOString(),
          titulo: `Anamnese Registrada`,
          resumo: r.queixaPrincipal,
          detalhes: {
            queixaPrincipal: r.queixaPrincipal,
            historiaDoencaAtual: r.historiaDoencaAtual,
            alergias: r.alergias,
            tabagismo: r.tabagismo,
            consumoAlcool: r.consumoAlcool,
            qualidadeSono: r.qualidadeSono,
            nivelDor: r.nivelDor,
          }
        });
      }
    }

    // Filtro de Busca Local (Case Insensitive)
    if (busca) {
      const term = busca.toLowerCase();
      eventosRaw = eventosRaw.filter(e => {
        const str = `${e.titulo} ${e.resumo} ${JSON.stringify(e.detalhes)}`.toLowerCase();
        return str.includes(term);
      });
    }

    // Ordenação (mais recentes primeiro)
    eventosRaw.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

    // Paginação baseada no Cursor (Data do último elemento exibido)
    let startIndex = 0;
    if (cursor) {
      const cursorIndex = eventosRaw.findIndex(e => new Date(e.data).getTime() < new Date(cursor).getTime());
      if (cursorIndex !== -1) {
        startIndex = cursorIndex;
      } else {
        startIndex = eventosRaw.length; // cursor não achado ou fim
      }
    }

    const pageSize = 20;
    const paginated = eventosRaw.slice(startIndex, startIndex + pageSize);
    
    let proximoCursor = null;
    if (startIndex + pageSize < eventosRaw.length) {
      // Pega a data do último cara que foi entregue
      proximoCursor = paginated[paginated.length - 1].data;
    }

    return { sucesso: true, eventos: paginated, proximoCursor };
  } catch (error) {
    console.error('[buscarProntuarioCompleto]', error);
    return { sucesso: false, erro: 'Erro ao buscar prontuário' };
  }
}
