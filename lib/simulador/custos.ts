/**
 * Regras de custo do simulador público de tratamento (/simulador).
 *
 * Helper puro: sem `db`, sem `auth`, sem `next/*`. Valores informados pelo dono em
 * 13/10/2026 — frete de R$ 240,00 por remessa de até 6 frascos, teto de R$ 390,00 por frasco.
 */

export const PRECO_MIN = 0;
export const PRECO_MAX = 390;
export const PRECO_PASSO = 10;
export const PRECO_INICIAL = 0;

export const FRASCOS_MIN = 0;
export const FRASCOS_MAX = 24;
export const FRASCOS_INICIAL = 0;

export const FRETE_VALOR = 240;
export const FRASCOS_POR_FRETE = 6;

export const CONSULTA_SOCIAL_VALOR = 90;
export const CONSULTAS_INICIAL = 0;

export const PRODUTOS = [
  {
    id: 'broad',
    nome: 'Life 6000 Broad Spectrum',
    concentracao: 'CBD 200 mg/mL – 6000 mg',
  },
  {
    id: 'isolated',
    nome: 'Life 6000 Isolated',
    concentracao: 'CBD 200 mg/mL – 6000 mg',
  },
  {
    id: 'full',
    nome: 'Life 6000 Full Spectrum 0,3% THC',
    concentracao: 'CBD 200 mg/mL – 6000 mg',
  },
] as const;

export type ProdutoId = (typeof PRODUTOS)[number]['id'];

/** Cada remessa de até 6 frascos paga um frete: 1–6 → 1, 7–12 → 2, 13–18 → 3… */
export function quantidadeDeFretes(frascos: number): number {
  if (frascos <= 0) return 0;
  return Math.ceil(frascos / FRASCOS_POR_FRETE);
}

export function calcularCustos(entrada: {
  precoPorFrasco: number;
  frascos: number;
  consultas: number;
}) {
  const fretes = quantidadeDeFretes(entrada.frascos);
  const produtos = entrada.precoPorFrasco * entrada.frascos;
  const frete = fretes * FRETE_VALOR;
  const consultas = entrada.consultas * CONSULTA_SOCIAL_VALOR;
  const total = produtos + frete + consultas;
  return { fretes, produtos, frete, consultas, total, mensal: total / 12 };
}
