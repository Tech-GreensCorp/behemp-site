import { pgTable, text, boolean, timestamp, index, integer } from 'drizzle-orm/pg-core';
import { baseColumns, softDeleteColumn } from './_helpers';
import { medicos } from './medicos';
import { pacientes } from './pacientes';
import { consultas } from './consultas';
import { users } from './users';
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
    medicoId: text('medico_id')
      .notNull()
      .references(() => medicos.id),
    pacienteId: text('paciente_id')
      .notNull()
      .references(() => pacientes.id),
    roomId: text('room_id').notNull().unique(),
    status: teleconsultaStatusEnum('status').notNull().default('aguardando'),
    iniciadaEm: timestamp('iniciada_em', { withTimezone: true }),
    encerradaEm: timestamp('encerrada_em', { withTimezone: true }),
    duracaoSegundos: integer('duracao_segundos'),
    // ── Consentimento LGPD ────────────────────────────────────────────────────
    // Os dois campos abaixo são os ORIGINAIS. Ficam para não quebrar o que já lê deles,
    // mas o consentimento real passou a ser o par paciente/médico logo abaixo.
    // Até 20/08/2026 `consentimentoLgpd` era gravado sempre como `true` a partir de um
    // `useState(true)` sem tela — Item 11 de docs/04-LISTA-DE-AFAZERES.md.
    consentimentoLgpd: boolean('consentimento_lgpd').default(false),
    consentimentoEm: timestamp('consentimento_em', { withTimezone: true }),

    // 🔴 ACRESCENTADO EM 20/08/2026 — ADR-0007, `DO-23`.
    // O aceite é BLOQUEANTE para a transcrição por IA, não para a consulta: a videochamada
    // tem base legal própria (LGPD art. 11, II, "f" — tutela da saúde). Exige os DOIS lados
    // porque o áudio capta a voz do médico também: ele é titular de dado, não só operador.
    consentimentoPacienteEm: timestamp('consentimento_paciente_em', { withTimezone: true }),
    consentimentoPacientePor: text('consentimento_paciente_por').references(() => users.id),
    consentimentoMedicoEm: timestamp('consentimento_medico_em', { withTimezone: true }),
    consentimentoMedicoPor: text('consentimento_medico_por').references(() => users.id),
    /** Versão do texto que a pessoa leu. Sem isto, o aceite não prova a que ela disse sim. */
    consentimentoVersaoTexto: text('consentimento_versao_texto'),
    /** A LGPD dá direito de revogar (art. 8º, §5º). Revogação sem registro não existe. */
    consentimentoRevogadoEm: timestamp('consentimento_revogado_em', { withTimezone: true }),
    consentimentoRevogadoPor: text('consentimento_revogado_por').references(() => users.id),

    // ⚠️ Os campos acima são do consentimento de **IA/transcrição** (LGPD art. 11, I). Os de
    // baixo são de outro consentimento, com outra origem e outro efeito — ver ADR-0007 D-08.

    // 🔴 CONSENTIMENTO DE TELECONSULTA — CFM 2.314/2022, Art. 15 (`CFM-01`).
    // *"O paciente ou seu representante legal deverá autorizar o atendimento por telemedicina e
    // a transmissão das suas imagens e dados (…) devendo fazer parte do SRES do paciente."*
    // Só do PACIENTE: a norma nomeia o titular, não o médico. E **bloqueia o atendimento
    // remoto** — ao contrário do consentimento de IA, que bloqueia apenas a IA.
    consentTeleconsultaEm: timestamp('consent_teleconsulta_em', { withTimezone: true }),
    consentTeleconsultaPor: text('consent_teleconsulta_por').references(() => users.id),
    consentTeleconsultaVersao: text('consent_teleconsulta_versao'),
    /**
     * Emergência médica — a única exceção que o Art. 15 § único admite ao consentimento prévio.
     * Quando marcada, o atendimento acontece sem aceite, e **o motivo fica registrado**: a norma
     * permite dispensar o aceite, não dispensar o registro.
     */
    emergenciaMedica: boolean('emergencia_medica').default(false),
    emergenciaMotivo: text('emergencia_motivo'),
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
    teleconsultaId: text('teleconsulta_id')
      .notNull()
      .references(() => teleconsultas.id),
    medicoId: text('medico_id')
      .notNull()
      .references(() => medicos.id),
    pacienteId: text('paciente_id')
      .notNull()
      .references(() => pacientes.id),
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
