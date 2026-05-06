import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * Enums do sistema Be4Hope.
 * Todos os enums são declarados aqui e importados nos schemas correspondentes.
 */

/** Role do usuário no sistema */
export const userRoleEnum = pgEnum('user_role', ['admin', 'medico', 'paciente']);

/** Status do paciente no tratamento */
export const pacienteStatusEnum = pgEnum('paciente_status', [
  'aguardando_consulta',
  'em_tratamento',
  'concluido',
  'arquivado',
]);

/** Tipo de tratamento do paciente */
export const tratamentoTipoEnum = pgEnum('tratamento_tipo', [
  'cbd',
  'thc',
  'cbd_thc',
]);

/** Tipo de documento do paciente */
export const documentoTipoEnum = pgEnum('documento_tipo', [
  'rg',
  'rg_responsavel',
  'receita_medica',
  'comprovante_residencia',
  'autorizacao_anvisa',
]);

/** Status da consulta */
export const consultaStatusEnum = pgEnum('consulta_status', [
  'agendada',
  'confirmada',
  'realizada',
  'cancelada',
]);

/** Tipo de notificação */
export const notificacaoTipoEnum = pgEnum('notificacao_tipo', [
  'renovacao_documento',
  'recompra_medicamento',
  'consulta_agendada',
  'consulta_cancelada',
  'nova_mensagem',
  'geral',
]);

/** Status da recompra de medicamento */
export const recompraStatusEnum = pgEnum('recompra_status', [
  'agendada',
  'pedida',
  'entregue',
]);

/** Tipo de grupo de chat */
export const grupoChatTipoEnum = pgEnum('grupo_chat_tipo', ['direto', 'grupo']);

/** Status de visualização da triagem pelo admin */
export const triagemStatusEnum = pgEnum('triagem_status', [
  'pendente',
  'visualizada',
  'respondida',
]);
