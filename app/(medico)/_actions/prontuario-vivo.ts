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
import { resolverContextoSala, resolverMedicoIdInterno } from '@/lib/teleconsulta/contexto-sala';
import { eq, and, isNull, desc } from 'drizzle-orm';

const isoSafe = (d: unknown): string | null => {
  if (!d) return null;
  const dt = new Date(d as string | Date);
  return isNaN(dt.getTime()) ? null : dt.toISOString();
};

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

    const medicoCtx = await resolverMedicoIdInterno(perm.clerkId);
    if (!medicoCtx) return { sucesso: false, erro: 'Médico não encontrado' };
    if (salaCtx.medicoIdDaSala !== medicoCtx.medicoId) {
      return { sucesso: false, erro: 'Você não é o médico responsável por esta sala' };
    }

    const pacienteId = salaCtx.pacienteId;
    let eventosRaw: EventoProntuario[] = [];

    // --- 1. Evoluções ---
    try {
      if (filtro === 'todos' || filtro === 'evolucao') {
        const rows = await db.select().from(evolucoes)
          .where(and(eq(evolucoes.pacienteId, pacienteId), isNull(evolucoes.deletedAt)));
        for (const r of rows) {
          eventosRaw.push({
            id: r.id,
            tipo: 'evolucao',
            data: isoSafe(r.data) ?? isoSafe(r.createdAt) ?? new Date(0).toISOString(),
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
    } catch (e) {
      console.error('[prontuario][evolucoes]', e);
    }

    // --- 2. Consultas ---
    try {
      if (filtro === 'todos' || filtro === 'consulta') {
        const rows = await db.select().from(consultas)
          .where(and(eq(consultas.pacienteId, pacienteId), isNull(consultas.deletedAt)));
        for (const r of rows) {
          eventosRaw.push({
            id: r.id,
            tipo: 'consulta',
            data: isoSafe(r.dataHora) ?? isoSafe(r.createdAt) ?? new Date(0).toISOString(),
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
    } catch (e) {
      console.error('[prontuario][consultas]', e);
    }

    // --- 3. Prescrições ---
    try {
      if (filtro === 'todos' || filtro === 'prescricao') {
        const rows = await db.select().from(prescricoes)
          .where(and(eq(prescricoes.pacienteId, pacienteId), isNull(prescricoes.deletedAt)));
        for (const r of rows) {
          const meds = Array.isArray(r.medicamentos) ? r.medicamentos : [];
          eventosRaw.push({
            id: r.id,
            tipo: 'prescricao',
            data: isoSafe(r.createdAt) ?? new Date(0).toISOString(),
            titulo: `Prescrição Emitida`,
            resumo: `${meds.length} medicamento(s) prescrito(s)`,
            detalhes: {
              medicamentos: r.medicamentos,
              status: r.status,
              validade: isoSafe(r.validade),
            }
          });
        }
      }
    } catch (e) {
      console.error('[prontuario][prescricoes]', e);
    }

    // --- 4. Exames ---
    try {
      if (filtro === 'todos' || filtro === 'exame') {
        const rows = await db.select().from(exames)
          .where(and(eq(exames.pacienteId, pacienteId), isNull(exames.deletedAt)));
        for (const r of rows) {
          eventosRaw.push({
            id: r.id,
            tipo: 'exame',
            data: isoSafe(r.dataExame) ?? isoSafe(r.createdAt) ?? new Date(0).toISOString(),
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
    } catch (e) {
      console.error('[prontuario][exames]', e);
    }

    // --- 5. Ajustes de Dosagem ---
    try {
      if (filtro === 'todos' || filtro === 'ajuste_dosagem') {
        const rows = await db.select().from(ajustesDosagem)
          .where(and(eq(ajustesDosagem.pacienteId, pacienteId), isNull(ajustesDosagem.deletedAt)));
        
        // TODO(perf): itensAjusteDosagem em loop = N+1; trocar por inArray quando o volume de ajustes crescer.
        for (const r of rows) {
          const itens = await db.select().from(itensAjusteDosagem).where(eq(itensAjusteDosagem.ajusteId, r.id));
          eventosRaw.push({
            id: r.id,
            tipo: 'ajuste_dosagem',
            data: isoSafe(r.dataAjuste) ?? isoSafe(r.createdAt) ?? new Date(0).toISOString(),
            titulo: `Ajuste de Dosagem`,
            resumo: r.motivoAjuste,
            detalhes: {
              motivo: r.motivoAjuste,
              itens: itens,
            }
          });
        }
      }
    } catch (e) {
      console.error('[prontuario][ajuste_dosagem]', e);
    }

    // --- 6. Documentos ---
    try {
      if (filtro === 'todos' || filtro === 'documento') {
        const rows = await db.select().from(documentos)
          .where(and(eq(documentos.pacienteId, pacienteId), isNull(documentos.deletedAt)));
        for (const r of rows) {
          const tipoLabel = r.tipo.replace(/_/g, ' ').toUpperCase();
          eventosRaw.push({
            id: r.id,
            tipo: 'documento',
            data: isoSafe(r.dataEmissao) ?? isoSafe(r.createdAt) ?? new Date(0).toISOString(),
            titulo: `Documento: ${tipoLabel}`,
            resumo: r.nomeArquivo || r.observacoes || 'Anexado ao prontuário',
            detalhes: {
              tipo: r.tipo,
              validade: isoSafe(r.dataValidade),
              url: r.urlBlob,
              observacoes: r.observacoes,
            }
          });
        }
      }
    } catch (e) {
      console.error('[prontuario][documentos]', e);
    }

    // --- 7. Anamneses ---
    try {
      if (filtro === 'todos' || filtro === 'anamnese') {
        const rows = await db.select().from(anamneses)
          .where(and(eq(anamneses.pacienteId, pacienteId), isNull(anamneses.deletedAt)));
        for (const r of rows) {
          eventosRaw.push({
            id: r.id,
            tipo: 'anamnese',
            data: isoSafe(r.createdAt) ?? new Date(0).toISOString(),
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
    } catch (e) {
      console.error('[prontuario][anamneses]', e);
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
