/**
 * OS CINCO DOCUMENTOS DO FLUXO, E O QUE FAZER COM O QUE FALTA.
 *
 * O parceiro manda o MANIFESTO — quais ele já tem. O que não vier na lista é pendência.
 *
 * 🔴 PENDÊNCIA NÃO BLOQUEIA NADA (ADR-0016 D-06). Ela aparece para o paciente saber o que
 * ainda precisa enviar, e para o atendimento saber o que cobrar. Nenhuma delas impede
 * criar a conta, nem seguir para a procuração.
 */
export const DOCUMENTOS_DO_FLUXO = [
  'receita_medica',
  'laudo_medico',
  'comprovante_residencia',
  'autorizacao_anvisa',
  'documento_identidade',
] as const;

export type DocumentoDoFluxo = (typeof DOCUMENTOS_DO_FLUXO)[number];

/**
 * O laudo é o único opcional — declarado pelo dono em 09/09/2026. Ele entra na lista de
 * pendências como "opcional", e não como falta.
 */
export const DOCUMENTOS_OPCIONAIS: readonly DocumentoDoFluxo[] = ['laudo_medico'];

const ROTULOS: Record<DocumentoDoFluxo, string> = {
  receita_medica: 'Receita médica',
  laudo_medico: 'Laudo médico',
  comprovante_residencia: 'Comprovante de residência',
  autorizacao_anvisa: 'Autorização da ANVISA',
  documento_identidade: 'Documento com foto',
};

export function rotuloDoDocumento(chave: string): string {
  return ROTULOS[chave as DocumentoDoFluxo] ?? chave;
}

/** Filtra o que o parceiro mandou, descartando o que não reconhecemos. */
export function normalizarManifesto(cru: unknown): DocumentoDoFluxo[] {
  if (!Array.isArray(cru)) return [];
  const validos = new Set<string>(DOCUMENTOS_DO_FLUXO);
  // ⚠️ Descarta o desconhecido em silêncio em vez de recusar a chamada inteira: um
  // documento novo do lado deles não pode derrubar o cadastro de um paciente aqui.
  return [
    ...new Set(cru.filter((d): d is DocumentoDoFluxo => typeof d === 'string' && validos.has(d))),
  ];
}

export interface Pendencia {
  chave: DocumentoDoFluxo;
  rotulo: string;
  opcional: boolean;
}

/** O que ainda falta, dado o que o parceiro declarou ter. */
export function pendenciasDe(manifesto: string[] | null | undefined): Pendencia[] {
  const tem = new Set(manifesto ?? []);
  return DOCUMENTOS_DO_FLUXO.filter((d) => !tem.has(d)).map((chave) => ({
    chave,
    rotulo: rotuloDoDocumento(chave),
    opcional: DOCUMENTOS_OPCIONAIS.includes(chave),
  }));
}
