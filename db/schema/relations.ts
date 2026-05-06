import { relations } from 'drizzle-orm';
import { users } from './users';
import { medicos } from './medicos';
import { pacientes } from './pacientes';
import { documentos } from './documentos';
import { consultas } from './consultas';
import { anamneses } from './anamneses';
import { evolucoes } from './evolucoes';
import { medicamentos } from './medicamentos';
import { dosagens } from './dosagens';
import { recompras } from './recompras';
import { gruposChat, participantesGrupo } from './grupos-chat';
import { mensagens } from './mensagens';
import { notificacoes } from './notificacoes';
import { logsAuditoria } from './logs-auditoria';

/**
 * Declaração centralizada de todas as relations do Drizzle ORM.
 * Isso evita dependências circulares entre os arquivos de schema.
 */

// ── Users ─────────────────────────────────────────────────────
export const usersRelations = relations(users, ({ one, many }) => ({
  medico: one(medicos, {
    fields: [users.id],
    references: [medicos.userId],
  }),
  paciente: one(pacientes, {
    fields: [users.id],
    references: [pacientes.userId],
  }),
  participacoesGrupo: many(participantesGrupo),
  mensagensEnviadas: many(mensagens),
  notificacoes: many(notificacoes),
  logsAuditoria: many(logsAuditoria),
}));

// ── Médicos ───────────────────────────────────────────────────
export const medicosRelations = relations(medicos, ({ one, many }) => ({
  user: one(users, {
    fields: [medicos.userId],
    references: [users.id],
  }),
  pacientes: many(pacientes),
  consultas: many(consultas),
  anamneses: many(anamneses),
  evolucoes: many(evolucoes),
}));

// ── Pacientes ─────────────────────────────────────────────────
export const pacientesRelations = relations(pacientes, ({ one, many }) => ({
  user: one(users, {
    fields: [pacientes.userId],
    references: [users.id],
  }),
  medico: one(medicos, {
    fields: [pacientes.medicoId],
    references: [medicos.id],
  }),
  documentos: many(documentos),
  consultas: many(consultas),
  anamneses: many(anamneses),
  evolucoes: many(evolucoes),
  dosagens: many(dosagens),
}));

// ── Documentos ────────────────────────────────────────────────
export const documentosRelations = relations(documentos, ({ one }) => ({
  paciente: one(pacientes, {
    fields: [documentos.pacienteId],
    references: [pacientes.id],
  }),
}));

// ── Consultas ─────────────────────────────────────────────────
export const consultasRelations = relations(consultas, ({ one }) => ({
  paciente: one(pacientes, {
    fields: [consultas.pacienteId],
    references: [pacientes.id],
  }),
  medico: one(medicos, {
    fields: [consultas.medicoId],
    references: [medicos.id],
  }),
}));

// ── Anamneses ─────────────────────────────────────────────────
export const anamnesesRelations = relations(anamneses, ({ one }) => ({
  paciente: one(pacientes, {
    fields: [anamneses.pacienteId],
    references: [pacientes.id],
  }),
  criadoPorMedico: one(medicos, {
    fields: [anamneses.criadoPor],
    references: [medicos.id],
  }),
}));

// ── Evoluções ─────────────────────────────────────────────────
export const evolucoesRelations = relations(evolucoes, ({ one }) => ({
  paciente: one(pacientes, {
    fields: [evolucoes.pacienteId],
    references: [pacientes.id],
  }),
  criadoPorMedico: one(medicos, {
    fields: [evolucoes.criadoPor],
    references: [medicos.id],
  }),
}));

// ── Medicamentos ──────────────────────────────────────────────
export const medicamentosRelations = relations(medicamentos, ({ many }) => ({
  dosagens: many(dosagens),
}));

// ── Dosagens ──────────────────────────────────────────────────
export const dosagensRelations = relations(dosagens, ({ one, many }) => ({
  paciente: one(pacientes, {
    fields: [dosagens.pacienteId],
    references: [pacientes.id],
  }),
  medicamento: one(medicamentos, {
    fields: [dosagens.medicamentoId],
    references: [medicamentos.id],
  }),
  recompras: many(recompras),
}));

// ── Recompras ─────────────────────────────────────────────────
export const recomprasRelations = relations(recompras, ({ one }) => ({
  dosagem: one(dosagens, {
    fields: [recompras.dosagemId],
    references: [dosagens.id],
  }),
}));

// ── Grupos de Chat ────────────────────────────────────────────
export const gruposChatRelations = relations(gruposChat, ({ one, many }) => ({
  criador: one(users, {
    fields: [gruposChat.criadoPor],
    references: [users.id],
  }),
  participantes: many(participantesGrupo),
  mensagens: many(mensagens),
}));

// ── Participantes do Grupo ────────────────────────────────────
export const participantesGrupoRelations = relations(participantesGrupo, ({ one }) => ({
  grupo: one(gruposChat, {
    fields: [participantesGrupo.grupoId],
    references: [gruposChat.id],
  }),
  user: one(users, {
    fields: [participantesGrupo.userId],
    references: [users.id],
  }),
}));

// ── Mensagens ─────────────────────────────────────────────────
export const mensagensRelations = relations(mensagens, ({ one }) => ({
  grupo: one(gruposChat, {
    fields: [mensagens.grupoId],
    references: [gruposChat.id],
  }),
  autor: one(users, {
    fields: [mensagens.autorId],
    references: [users.id],
  }),
}));

// ── Notificações ──────────────────────────────────────────────
export const notificacoesRelations = relations(notificacoes, ({ one }) => ({
  user: one(users, {
    fields: [notificacoes.userId],
    references: [users.id],
  }),
}));

// ── Logs de Auditoria ─────────────────────────────────────────
export const logsAuditoriaRelations = relations(logsAuditoria, ({ one }) => ({
  user: one(users, {
    fields: [logsAuditoria.userId],
    references: [users.id],
  }),
}));
