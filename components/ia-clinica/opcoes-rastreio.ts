/**
 * As listas de opção do rastreio de uso — `DO-26` e `DO-27`.
 *
 * Extraídas do componente por dois motivos: `RastreioUso.tsx` passava do limite de 400 linhas do
 * critério de aceite da Sprint 3, e **lista de opção é dado, não UI**. Aqui elas podem ser lidas
 * e conferidas contra os enums do schema sem abrir o JSX.
 *
 * ⚠️ Os valores precisam casar com `db/schema/enums.ts`. Se divergirem, a Zod da action recusa —
 * é falha visível, não silenciosa.
 */

export type SituacaoUso = 'primeiro_uso' | 'usa_atualmente' | 'usou_e_parou';

/** As três situações, com o texto que o médico lê ao escolher. */
export const SITUACOES: Array<{ valor: SituacaoUso; rotulo: string; descricao: string }> = [
  {
    valor: 'primeiro_uso',
    rotulo: 'Nunca usou',
    descricao: 'Vai iniciar agora. É o caso de quem vem à consulta para conseguir o medicamento.',
  },
  {
    valor: 'usa_atualmente',
    rotulo: 'Já está usando',
    descricao: 'Trouxe um produto de fora, ou já usa por prescrição anterior.',
  },
  {
    valor: 'usou_e_parou',
    rotulo: 'Já usou e parou',
    descricao: 'Importa saber por que parou — muda a conduta de reinício.',
  },
];

export const VIAS = [
  ['oral', 'Oral (cápsula, comprimido)'],
  ['sublingual', 'Sublingual (gotas)'],
  ['inalada', 'Inalada / vaporizada'],
  ['topica', 'Tópica'],
  ['outra', 'Outra'],
] as const;

/** Origem importa clinicamente: produto sem rótulo não permite calcular mg com confiança. */
export const ORIGENS = [
  ['importado', 'Importado'],
  ['nacional_registrado', 'Nacional registrado'],
  ['associacao', 'Associação'],
  ['artesanal', 'Artesanal'],
  ['desconhecida', 'Não sabe'],
] as const;

export const RESPOSTAS = [
  ['melhorou_muito', 'Melhorou muito'],
  ['melhorou_pouco', 'Melhorou pouco'],
  ['sem_mudanca', 'Sem mudança'],
  ['piorou', 'Piorou'],
  ['nao_sabe', 'Não sabe dizer'],
] as const;

/** Adesão: o que foi TOMADO, contra o que `dosagens` guarda como prescrito. */
export const ADESOES = [
  ['tomou_como_prescrito', 'Tomou como prescrito'],
  ['tomou_menos', 'Tomou menos que o prescrito'],
  ['tomou_mais', 'Tomou mais que o prescrito'],
  ['interrompeu', 'Interrompeu por conta'],
  ['nao_iniciou', 'Não chegou a iniciar'],
] as const;
