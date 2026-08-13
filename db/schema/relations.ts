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
import { prescricoes } from './prescricoes';
import { receituarioTemplates } from './receituario-templates';
import { teleconsultas, transcricoes } from './teleconsultas';
import { autorizacoesAnvisa } from './autorizacoes-anvisa';
import { procuracoesEspecificas } from './procuracoes-especificas';
import { produtos } from './produtos';
import { produtoArquivos } from './produto-arquivos';

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
  prescricoes: many(prescricoes),
  receituarioTemplates: many(receituarioTemplates),
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
  recompras: many(recompras),
  prescricoes: many(prescricoes),
  procuracoesEspecificas: many(procuracoesEspecificas),
}));

// ── Documentos ────────────────────────────────────────────────
export const documentosRelations = relations(documentos, ({ one }) => ({
  paciente: one(pacientes, {
    fields: [documentos.pacienteId],
    references: [pacientes.id],
  }),
}));

// ── Consultas ─────────────────────────────────────────────────
export const consultasRelations = relations(consultas, ({ one, many }) => ({
  paciente: one(pacientes, {
    fields: [consultas.pacienteId],
    references: [pacientes.id],
  }),
  medico: one(medicos, {
    fields: [consultas.medicoId],
    references: [medicos.id],
  }),
  prescricoes: many(prescricoes),
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
  solicitante: one(users, {
    fields: [recompras.solicitanteId],
    references: [users.id],
  }),
  paciente: one(pacientes, {
    fields: [recompras.pacienteId],
    references: [pacientes.id],
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

// ── Prescrições ───────────────────────────────────────────────
export const prescricoesRelations = relations(prescricoes, ({ one }) => ({
  medico: one(medicos, {
    fields: [prescricoes.medicoId],
    references: [medicos.id],
  }),
  paciente: one(pacientes, {
    fields: [prescricoes.pacienteId],
    references: [pacientes.id],
  }),
  consulta: one(consultas, {
    fields: [prescricoes.consultaId],
    references: [consultas.id],
  }),
  template: one(receituarioTemplates, {
    fields: [prescricoes.templateId],
    references: [receituarioTemplates.id],
  }),
}));

// ── Receituário Templates ─────────────────────────────────────
export const receituarioTemplatesRelations = relations(
  receituarioTemplates,
  ({ one, many }) => ({
    medico: one(medicos, {
      fields: [receituarioTemplates.medicoId],
      references: [medicos.id],
    }),
    prescricoes: many(prescricoes),
  }),
);

// ── Teleconsultas ─────────────────────────────────────────────
export const teleconsultasRelations = relations(teleconsultas, ({ one, many }) => ({
  medico: one(medicos, {
    fields: [teleconsultas.medicoId],
    references: [medicos.id],
  }),
  paciente: one(pacientes, {
    fields: [teleconsultas.pacienteId],
    references: [pacientes.id],
  }),
  consulta: one(consultas, {
    fields: [teleconsultas.consultaId],
    references: [consultas.id],
  }),
  transcricoes: many(transcricoes),
}));

// ── Transcrições ──────────────────────────────────────────────
export const transcricoesRelations = relations(transcricoes, ({ one }) => ({
  teleconsulta: one(teleconsultas, {
    fields: [transcricoes.teleconsultaId],
    references: [teleconsultas.id],
  }),
  medico: one(medicos, {
    fields: [transcricoes.medicoId],
    references: [medicos.id],
  }),
  paciente: one(pacientes, {
    fields: [transcricoes.pacienteId],
    references: [pacientes.id],
  }),
}));

// ── Autorizações ANVISA ────────────────────────────────────────
export const autorizacoesAnvisaRelations = relations(autorizacoesAnvisa, ({ one, many }) => ({
  paciente: one(pacientes, {
    fields: [autorizacoesAnvisa.pacienteId],
    references: [pacientes.id],
  }),
  medico: one(medicos, {
    fields: [autorizacoesAnvisa.medicoId],
    references: [medicos.id],
  }),
  prescricao: one(prescricoes, {
    fields: [autorizacoesAnvisa.prescricaoId],
    references: [prescricoes.id],
  }),
  procuracoesEspecificas: many(procuracoesEspecificas),
}));

// ── Procurações Específicas ───────────────────────────────────
export const procuracoesEspecificasRelations = relations(procuracoesEspecificas, ({ one }) => ({
  paciente: one(pacientes, {
    fields: [procuracoesEspecificas.pacienteId],
    references: [pacientes.id],
  }),
  autorizacao: one(autorizacoesAnvisa, {
    fields: [procuracoesEspecificas.autorizacaoId],
    references: [autorizacoesAnvisa.id],
  }),
}));

// ── Produtos (Catálogo) ────────────────────────────────────────
export const produtosRelations = relations(produtos, ({ one, many }) => ({
  excluidoPorUser: one(users, {
    fields: [produtos.excluidoPor],
    references: [users.id],
  }),
  arquivos: many(produtoArquivos),
}));

// ── Arquivos de Produto ─────────────────────────────────────────
export const produtoArquivosRelations = relations(produtoArquivos, ({ one }) => ({
  produto: one(produtos, {
    fields: [produtoArquivos.produtoId],
    references: [produtos.id],
  }),
}));

