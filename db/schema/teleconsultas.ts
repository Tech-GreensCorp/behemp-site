import { pgTable, text, boolean, timestamp, index, integer } from 'drizzle-orm/pg-core';
import { baseColumns, softDeleteColumn } from './_helpers';
import { medicos } from './medicos';
import { pacientes } from './pacientes';
import { consultas } from './consultas';
import { teleconsultaStatusEnum, transcricaoStatusEnum } from './enums';

/**
 * Teleconsultas — sessões de videochamada WebRTC.
 * roomId: código único da sala (6 chars alphanumeric).
 * Soft delete: histórico clínico preservado por LGPD.
 */
export const teleconsultas = pgTable(
  'teleconsultas',
  {
    ...baseColumns,
    consultaId: text('consulta_id').references(() => consultas.id),
    medicoId: text('medico_id').notNull().references(() => medicos.id),
    pacienteId: text('paciente_id').notNull().references(() => pacientes.id),
    roomId: text('room_id').notNull().unique(),
    status: teleconsultaStatusEnum('status').notNull().default('aguardando'),
    iniciadaEm: timestamp('iniciada_em', { withTimezone: true }),
    encerradaEm: timestamp('encerrada_em', { withTimezone: true }),
    duracaoSegundos: integer('duracao_segundos'),
    consentimentoLgpd: boolean('consentimento_lgpd').default(false),
    consentimentoEm: timestamp('consentimento_em', { withTimezone: true }),
    ...softDeleteColumn,
  },
  (t) => [
    index('teleconsultas_medico_idx').on(t.medicoId),
    index('teleconsultas_paciente_idx').on(t.pacienteId),
    index('teleconsultas_room_idx').on(t.roomId),
    index('teleconsultas_status_idx').on(t.status),
  ],
);

/**
 * Transcrições — resultado do pipeline Gemini 2.5 Flash.
 * textoCompleto: transcrição bruta (ASR).
 * narrativa: texto normalizado pelo Gemini (clínico estruturado).
 * consentimentoObtido: LGPD — obrigatório antes de qualquer processamento LLM.
 */
export const transcricoes = pgTable(
  'transcricoes',
  {
    ...baseColumns,
    teleconsultaId: text('teleconsulta_id').notNull().references(() => teleconsultas.id),
    medicoId: text('medico_id').notNull().references(() => medicos.id),
    pacienteId: text('paciente_id').notNull().references(() => pacientes.id),
    status: transcricaoStatusEnum('status').notNull().default('pendente'),
    consentimentoObtido: boolean('consentimento_obtido').notNull().default(false),
    textoCompleto: text('texto_completo'),
    narrativa: text('narrativa'),
    hashTexto: text('hash_texto'),
    duracaoSegundos: integer('duracao_segundos'),
    modeloUsado: text('modelo_usado').default('gemini-2.5-flash'),
    erroMensagem: text('erro_mensagem'),
    ...softDeleteColumn,
  },
  (t) => [
    index('transcricoes_teleconsulta_idx').on(t.teleconsultaId),
    index('transcricoes_medico_idx').on(t.medicoId),
    index('transcricoes_status_idx').on(t.status),
  ],
);
