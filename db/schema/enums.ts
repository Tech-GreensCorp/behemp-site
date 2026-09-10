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
export const tratamentoTipoEnum = pgEnum('tratamento_tipo', ['cbd', 'thc', 'cbd_thc']);

/** Tipo de documento do paciente */
export const documentoTipoEnum = pgEnum('documento_tipo', [
  'rg',
  'rg_responsavel',
  'receita_medica',
  'comprovante_residencia',
  'autorizacao_anvisa',
  'documento_pessoal',
  'oficio_anvisa',
  'procuracao_especifica',
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
  'teleconsulta_iniciada',
]);

/** Status da recompra de medicamento */
export const recompraStatusEnum = pgEnum('recompra_status', ['agendada', 'pedida', 'entregue']);

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
export const tabagismoEnum = pgEnum('tabagismo', ['nunca_fumou', 'ex_fumante', 'fumante']);

/** Consumo de álcool */
export const consumoAlcoolEnum = pgEnum('consumo_alcool', ['nao_consome', 'regular', 'ocasional']);

/** Qualidade do sono */
export const qualidadeSonoEnum = pgEnum('qualidade_sono_enum', [
  'ruim',
  'regular',
  'boa',
  'excelente',
]);

/** Tipo de evolução clínica */
export const evolucaoTipoEnum = pgEnum('evolucao_tipo', ['positiva', 'estavel', 'negativa']);

/** Tipo de invoice médica */
export const invoiceTipoEnum = pgEnum('invoice_tipo', [
  'donation',
  'judicialization',
  'collab',
  'retail',
]);

/** Status da invoice */
export const invoiceStatusEnum = pgEnum('invoice_status', ['draft', 'completed']);

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
export const provedorAssinaturaEnum = pgEnum('provedor_assinatura', ['vidaas', 'birdid']);

/** Tipo de estampa do template de receituário */
export const estampaTipoEnum = pgEnum('estampa_tipo', ['nenhuma', 'medico']);

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
  'guiada', // paciente faz sozinho no Gov.br
  'representacao', // Be4Hope faz via Procuração Específica
]);

/** Status do envelope DocuSign da Procuração Específica */
export const docusignStatusEnum = pgEnum('docusign_status', [
  'nao_enviado', // ainda não foi enviado
  'enviado', // envelope enviado ao paciente
  'visualizado', // paciente abriu o email
  'assinado', // paciente assinou
  'concluido', // todas as partes assinaram
  'recusado', // paciente recusou assinar
  'expirado', // envelope expirou sem assinatura
]);

/** Tipo de espectro do medicamento de Cannabis */
export const tipoEspectroEnum = pgEnum('tipo_espectro', ['isolado', 'broad', 'full']);

/** Tipo de alerta do motor de alertas */
export const alertaTipoEnum = pgEnum('alerta_tipo', ['medicacao', 'licenca_anvisa', 'mensalidade']);

/** Destinatário do alerta enviado */
export const alertaDestinatarioEnum = pgEnum('alerta_destinatario', ['admin', 'paciente']);

// ═══════════════════════════════════════════════════════════════════════════════
// IA CLÍNICA — acrescentados na Sprint 2 (20/08/2026)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Ciclo de revisão humana (HITL) de uma análise da IA.
 *
 * P1 do `09-FRONTEND-VIDAI-MEDIDO.md`: a IA **produz**, o humano **decide**. Um estado de
 * `aguardando_validacao` é o que impede a saída do modelo de virar registro clínico sem
 * alguém ter olhado.
 */
export const analiseStatusEnum = pgEnum('analise_status', [
  'em_andamento',
  'aguardando_validacao',
  'concluido',
]);

/**
 * Resultado da validação clínica de uma análise.
 *
 * P5: **divergência é dado**, não erro a esconder. Registrar que o médico discordou da IA é o
 * que permite medir a qualidade do modelo depois — e é o que distingue apoio à decisão de
 * automação silenciosa.
 */
export const validacaoClinicaEnum = pgEnum('validacao_clinica', ['validado', 'divergente']);

// ═══════════════════════════════════════════════════════════════════════════════
// ANAMNESE COMO BASELINE — Sprint 3 (20/08/2026), ADR-0004
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Janela de contagem de crises/espasmos.
 *
 * Existe para não FIXAR a janela: epilepsia e espasticidade têm frequências de ordem muito
 * diferente, e escolher "por semana" no schema seria presumir regra clínica. Quem registra
 * escolhe, e a comparação normaliza na leitura (`DO-24`).
 */
export const periodoContagemEnum = pgEnum('periodo_contagem', ['dia', 'semana', 'mes']);

/**
 * Situação do paciente quanto ao uso de cannabis — `DO-27`.
 *
 * 🔴 **Enum, não boolean, de propósito.** `primeiro_uso` é um estado DECLARADO, distinto de
 * "ninguém perguntou" (que é o `null`). O boolean `anamneses.usoPrevioCannabis` não distinguia
 * as duas coisas — e a diferença muda a conversa da consulta. O dono foi explícito: o paciente
 * de primeiro uso é caso comum, porque vem à consulta justamente para conseguir o remédio.
 */
export const situacaoUsoCannabisEnum = pgEnum('situacao_uso_cannabis', [
  'primeiro_uso',
  'usa_atualmente',
  'usou_e_parou',
]);

/** Via de administração. Espelha os valores usados em `itensAjusteDosagem.viaAdministracao`,
 *  que hoje é texto livre — aqui nasce fechado, para o novo não repetir o problema antigo. */
export const viaAdministracaoEnum = pgEnum('via_administracao', [
  'oral',
  'sublingual',
  'inalada',
  'topica',
  'outra',
]);

/** Origem do produto que o paciente já usa. Importa clinicamente: produto sem rótulo não permite
 *  calcular mg, e isso muda o quanto se pode confiar na dose relatada. */
export const origemProdutoEnum = pgEnum('origem_produto', [
  'importado',
  'nacional_registrado',
  'associacao',
  'artesanal',
  'desconhecida',
]);

/** Resposta que o paciente percebeu ao produto que já usava. Relato, não desfecho medido. */
export const respostaPercebidaEnum = pgEnum('resposta_percebida', [
  'melhorou_muito',
  'melhorou_pouco',
  'sem_mudanca',
  'piorou',
  'nao_sabe',
]);

/**
 * Adesão relatada — o que o paciente DE FATO tomou.
 *
 * Vive no rastreio, não em `dosagens`: `dosagens` guarda o **prescrito**, e é ele que a titulação
 * compara. Guardar os dois no mesmo campo faria o ajuste de dose ser calculado sobre um número
 * que talvez nunca tenha acontecido (`DO-26`).
 */
export const adesaoRelatadaEnum = pgEnum('adesao_relatada', [
  'tomou_como_prescrito',
  'tomou_menos',
  'tomou_mais',
  'interrompeu',
  'nao_iniciou',
]);

// ═══════════════════════════════════════════════════════════════════════════════
// CHATPRO — o paciente que chega pelo WhatsApp (09/09/2026)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * De onde nasceu a solicitação de cadastro.
 *
 * Distinguir a origem não é telemetria: é o que permite responder "por que este paciente
 * não recebeu o link" sem adivinhar. `chatpro_start_nao_verificado` é o caso em que a
 * identidade do contato NÃO pôde ser confirmada na API do ChatPro — e por isso o nome não
 * é pré-preenchido no formulário.
 */
export const solicitacaoCadastroOrigemEnum = pgEnum('solicitacao_cadastro_origem', [
  'painel_admin',
  'chatpro_bot',
  'chatpro_start',
  'chatpro_start_nao_verificado',
  'chatpro_webhook',
  /**
   * O paciente preencheu o formulário de intake NA GREENS e escolheu continuar aqui.
   * Os dados chegaram por back-channel assinado; com ele veio só o token (ADR-0016).
   */
  'greens_handoff',
]);

/** Onde a solicitação está. `link_gerado` é o estado em que ela nasce. */
export const solicitacaoCadastroStatusEnum = pgEnum('solicitacao_cadastro_status', [
  'link_gerado',
  'link_acessado',
  'enviada',
  'expirada',
  'cancelada',
]);

/**
 * Estado de um evento do webhook na fila.
 *
 * `descartado` é diferente de `falhou`: descartado é a decisão deliberada de não processar
 * (evento fora da janela de tempo, contato não confirmado na API, tipo sem interesse);
 * falhou é erro nosso, e é reprocessável.
 */
export const chatproEventoStatusEnum = pgEnum('chatpro_evento_status', [
  'pendente',
  /**
   * Estado do CLAIM ATÔMICO. Sem ele, duas execuções concorrentes do processador
   * listam os mesmos pendentes e processam o evento duas vezes — defeito real
   * observado no greens-corp (armadilha 7), onde 4 etapas de funil foram gravadas
   * onde deviam existir 3. A transição `pendente -> processando` acontece dentro
   * de `FOR UPDATE SKIP LOCKED`, então quem perder a corrida simplesmente não vê a linha.
   */
  'processando',
  'processado',
  'descartado',
  'falhou',
]);

/** Os dois catálogos que o ChatPro expõe e que chegam como UUID nos webhooks. */
export const chatproDiretorioTipoEnum = pgEnum('chatpro_diretorio_tipo', [
  'departamento',
  'motivo_encerramento',
]);
