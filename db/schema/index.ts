/**
 * Barrel file — reexportação centralizada de todos os schemas e relations.
 * Este é o ponto de entrada único para o Drizzle ORM.
 */

// Enums
export * from './enums';

// Tabelas
export * from './users';
export * from './medicos';
export * from './pacientes';
export * from './triagens';
export * from './contatos';

export * from './documentos';
export * from './consultas';
export * from './anamneses';
export * from './evolucoes';
export * from './medicamentos';
export * from './dosagens';
export * from './recompras';
export * from './emails-notificacao';
export * from './grupos-chat';
export * from './mensagens';
export * from './notificacoes';
export * from './logs-auditoria';
export * from './exames';
export * from './ajustes-dosagem';
export * from './relatorios';
export * from './invoices';
export * from './leads-ebook';

// Relations
export * from './relations';
