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
  'documento_pessoal',
  'oficio_anvisa',
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
  'novo_paciente',
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

/** Fase da jornada do paciente no fluxo operacional (Kanban CRM) */
export const jornadaFaseEnum = pgEnum('jornada_fase', [
  'acolhimento',
  'avaliacao_medica',
  'burocracia_anvisa',
  'logistica',
  'acompanhamento_continuo',
]);

/** Status de visualização da triagem pelo admin */
export const triagemStatusEnum = pgEnum('triagem_status', [
  'pendente',
  'visualizada',
  'respondida',
]);

/** Tabagismo do paciente */
export const tabagismoEnum = pgEnum('tabagismo', [
  'nunca_fumou',
  'ex_fumante',
  'fumante',
]);

/** Consumo de álcool */
export const consumoAlcoolEnum = pgEnum('consumo_alcool', [
  'nao_consome',
  'regular',
  'ocasional',
]);

/** Qualidade do sono */
export const qualidadeSonoEnum = pgEnum('qualidade_sono_enum', [
  'ruim',
  'regular',
  'boa',
  'excelente',
]);

/** Tipo de evolução clínica */
export const evolucaoTipoEnum = pgEnum('evolucao_tipo', [
  'positiva',
  'estavel',
  'negativa',
]);

/** Tipo de invoice médica */
export const invoiceTipoEnum = pgEnum('invoice_tipo', [
  'donation',
  'judicialization',
  'collab',
  'retail',
]);

/** Status da invoice */
export const invoiceStatusEnum = pgEnum('invoice_status', [
  'draft',
  'completed',
]);

// ── Receituário / Assinatura ICP-Brasil ───────────────────────

/** Tipo de receituário / prescrição */
export const prescricaoTipoEnum = pgEnum('prescricao_tipo', [
  'simples',
  'controle_especial',
  'personalizado',
]);

/** Status da prescrição */
export const prescricaoStatusEnum = pgEnum('prescricao_status', [
  'rascunho',
  'emitida',
  'assinada',
  'cancelada',
]);

/** Provedor de assinatura digital ICP-Brasil */
export const provedorAssinaturaEnum = pgEnum('provedor_assinatura', [
  'vidaas',
  'birdid',
]);

/** Tipo de estampa do template de receituário */
export const estampaTipoEnum = pgEnum('estampa_tipo', [
  'nenhuma',
  'medico',
]);

/** Status da teleconsulta */
export const teleconsultaStatusEnum = pgEnum('teleconsulta_status', [
  'aguardando',
  'em_andamento',
  'encerrada',
  'cancelada',
]);

/** Status da transcrição */
export const transcricaoStatusEnum = pgEnum('transcricao_status', [
  'pendente',
  'processando',
  'concluida',
  'erro',
]);

/** Status do processo de autorização ANVISA */
export const anvisaStatusEnum = pgEnum('anvisa_status', [
  'pendente',
  'documentos_enviados',
  'em_analise',
  'aprovado',
  'pendencia_documental',
  'rejeitado',
]);

/** Tipo de item do checklist ANVISA */
export const anvisaDocumentoTipoEnum = pgEnum('anvisa_documento_tipo', [
  'receita_medica',
  'rg_paciente',
  'rg_responsavel',
  'comprovante_residencia',
  'laudo_medico',
  'termo_responsabilidade',
  'certidao_nascimento',
]);

/** Modalidade da autorização ANVISA escolhida pelo paciente */
export const anvisaModalidadeEnum = pgEnum('anvisa_modalidade', [
  'guiada',        // paciente faz sozinho no Gov.br
  'representacao', // Be4Hope faz via Procuração Específica
]);

/** Status do envelope DocuSign da Procuração Específica */
export const docusignStatusEnum = pgEnum('docusign_status', [
  'nao_enviado',    // ainda não foi enviado
  'enviado',        // envelope enviado ao paciente
  'visualizado',    // paciente abriu o email
  'assinado',       // paciente assinou
  'concluido',      // todas as partes assinaram
  'recusado',       // paciente recusou assinar
  'expirado',       // envelope expirou sem assinatura
  'erro',           // erro no envio
]);
