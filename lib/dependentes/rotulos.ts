/**
 * Rótulos humanos das telas do responsável (ADR-0033). Puro: sem `db`, sem `auth`, sem `next/*`.
 *
 * ⚠️ Os mapas de jornada e de status repetem os do painel do paciente (`app/(paciente)/paciente/page.tsx`),
 * que os declara DENTRO de um componente client e por isso não os exporta. A ordem das fases é a de
 * `jornadaFaseEnum` (`db/schema/enums.ts`): o guarda `as-telas-do-responsavel-nao-misturam-dependentes`
 * confere que nenhuma fase do enum fica sem rótulo.
 */

export const JORNADA_ORDEM = [
  'acolhimento',
  'avaliacao_medica',
  'burocracia_anvisa',
  'logistica',
  'acompanhamento_continuo',
] as const;

export const LABEL_JORNADA: Record<string, string> = {
  acolhimento: 'Acolhimento',
  avaliacao_medica: 'Avaliação Médica',
  burocracia_anvisa: 'Burocracia ANVISA',
  logistica: 'Logística',
  acompanhamento_continuo: 'Acompanhamento Contínuo',
};

export const LABEL_STATUS_DO_PACIENTE: Record<string, string> = {
  aguardando_consulta: 'Aguardando consulta',
  em_tratamento: 'Em tratamento',
  concluido: 'Concluído',
  arquivado: 'Arquivado',
};

export const LABEL_TRATAMENTO: Record<string, string> = {
  cbd: 'CBD',
  thc: 'THC',
  cbd_thc: 'CBD + THC',
};

export const LABEL_CONSULTA: Record<string, string> = {
  reservada: 'Reservada',
  agendada: 'Agendada',
  confirmada: 'Confirmada',
  realizada: 'Realizada',
  cancelada: 'Cancelada',
};

export const LABEL_RECOMPRA: Record<string, string> = {
  agendada: 'Agendada',
  pedida: 'Pedida',
  entregue: 'Entregue',
};

export const LABEL_ANVISA: Record<string, string> = {
  pendente: 'Pendente',
  documentos_enviados: 'Documentos enviados',
  em_analise: 'Em análise',
  aprovado: 'Aprovada',
  pendencia_documental: 'Pendência documental',
  rejeitado: 'Rejeitada',
};

export const LABEL_DOCUMENTO: Record<string, string> = {
  rg: 'RG',
  rg_responsavel: 'RG do responsável',
  receita_medica: 'Receita médica',
  comprovante_residencia: 'Comprovante de residência',
  autorizacao_anvisa: 'Autorização ANVISA',
  documento_pessoal: 'Documento pessoal',
  oficio_anvisa: 'Ofício ANVISA',
  procuracao_especifica: 'Procuração',
  laudo_medico: 'Laudo médico',
  contrato_termos: 'Contrato e termos',
};

/** O primeiro nome, para títulos como "Jornada de Ana". */
export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

/** O caminho de cada seção de UM dependente. Um só lugar: a barra lateral e as abas leem daqui. */
export const SECOES_DO_DEPENDENTE = [
  { chave: 'visao-geral', rotulo: 'Visão geral', sufixo: '' },
  { chave: 'medicamentos', rotulo: 'Medicamentos', sufixo: '/medicamentos' },
  { chave: 'documentos', rotulo: 'Documentos', sufixo: '/documentos' },
  { chave: 'solicitacoes', rotulo: 'Solicitações', sufixo: '/solicitacoes' },
  { chave: 'consultas', rotulo: 'Consultas', sufixo: '/consultas' },
] as const;

export function caminhoDoDependente(pacienteId: string, sufixo = ''): string {
  return `/responsavel/dependentes/${pacienteId}${sufixo}`;
}

/** `2016-04-10` → `10/04/2016`. Sem `Date`: uma data de calendário não tem fuso, e o `Date` a deslocaria um dia. */
export function formatarDataISO(data: string | null | undefined): string {
  if (!data) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(data);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : data;
}

/** `quinta-feira, 29 de outubro`, no horário de Brasília. */
export function formatarDiaPorExtenso(instante: string | Date): string {
  return new Date(instante).toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/** `14:30`, no horário de Brasília. */
export function formatarHora(instante: string | Date): string {
  return new Date(instante).toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Data e hora de um instante, no horário de Brasília. */
export function formatarDataHora(instante: string | Date): string {
  return new Date(instante).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
