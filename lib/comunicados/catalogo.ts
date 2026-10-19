/**
 * Catálogo dos comunicados que o admin pode enviar ao paciente para assinatura eletrônica.
 *
 * Hoje há um só. O `tipo` é a chave gravada em `comunicados_assinatura.tipo`; o título é o nome
 * que aparece na interface (admin e paciente) — nunca montado a partir de outro texto.
 */

export const TIPO_ATUALIZACAO_PROGRAMA_DOACAO = 'atualizacao_programa_doacao';

export const TITULO_ATUALIZACAO_PROGRAMA_DOACAO = 'Atualização do Programa de Doação';

export const NUMERO_DO_COMUNICADO = '001/2026';

/**
 * Remetente das mensagens deste fluxo. É uma constante e não variável de ambiente de propósito:
 * o endereço faz parte do contrato do fluxo (o admin recebe a notificação NELE) e o remetente
 * precisa estar autenticado no Brevo — ver o relatório de entrega.
 */
export const REMETENTE_DOCUMENTOS = {
  name: 'Be4Hope Documentos',
  email: 'docs@be4hope.org',
} as const;

/** Rodapé de atendimento da carta (informado pela Dryelle em 15/10/2026). */
export const CONTATO_DA_CARTA = {
  atendimento: 'Associação Behemp | Be4Hope',
  whatsapp: '(11) 93204-7360',
  email: 'docs@be4hope.org',
  horario: '09h00 às 18h00, de segunda a sexta',
} as const;

/** Âncoras de texto que o DocuSign procura no PDF para posicionar a assinatura e a data. */
export const ANCORA_ASSINATURA = '/assinatura_paciente/';
export const ANCORA_DATA = '/data_assinatura/';

export function tituloDoComunicado(tipo: string): string {
  return tipo === TIPO_ATUALIZACAO_PROGRAMA_DOACAO ? TITULO_ATUALIZACAO_PROGRAMA_DOACAO : tipo;
}
