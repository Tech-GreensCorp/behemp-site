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
 * 🔴 DUAS COISAS DIFERENTES QUE O FORMULÁRIO DA GREENS CHAMA DE "OPCIONAL".
 *
 * Corrigido em 09/09/2026, quando o lado da Greens informou que `autorizacao_anvisa`
 * passou a ser opcional lá. A palavra é a mesma; o significado, não:
 *
 * - **laudo_medico** — opcional de verdade: pode nunca existir, e ninguém vai cobrar.
 * - **autorizacao_anvisa** — opcional *no formulário deles*, e **necessária** para o
 *   paciente importar. Ela falta justamente porque ele ainda não tem — e é um dos dois
 *   motivos de ele estar vindo para cá. A procuração daqui existe para resolvê-la.
 *
 * Marcar as duas como "(opcional)" na tela diria ao paciente que a ANVISA é dispensável.
 * Não é: nós é que vamos tirá-la com ele.
 */
export const DOCUMENTOS_OPCIONAIS: readonly DocumentoDoFluxo[] = ['laudo_medico'];

/** O que não falta por descuido: falta porque é o que o paciente vem buscar aqui. */
export const DOCUMENTOS_QUE_RESOLVEMOS: readonly DocumentoDoFluxo[] = [
  'autorizacao_anvisa',
  'receita_medica',
];

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
  /** Pode nunca existir, e ninguém vai cobrar. */
  opcional: boolean;
  /** Falta porque é o que ele veio buscar — a consulta e a procuração resolvem. */
  resolvemosAqui: boolean;
}

/** O que ainda falta, dado o que o parceiro declarou ter. */
export function pendenciasDe(manifesto: string[] | null | undefined): Pendencia[] {
  const tem = new Set(manifesto ?? []);
  return DOCUMENTOS_DO_FLUXO.filter((d) => !tem.has(d)).map((chave) => ({
    chave,
    rotulo: rotuloDoDocumento(chave),
    opcional: DOCUMENTOS_OPCIONAIS.includes(chave),
    resolvemosAqui: DOCUMENTOS_QUE_RESOLVEMOS.includes(chave),
  }));
}
