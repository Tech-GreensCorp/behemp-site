/**
 * Regras PURAS da edição de um paciente (telas /admin/pacientes/[id] e /medico/pacientes/[id]).
 *
 * 🔴 Por que existe (20/10/2026): a tela de edição manda o formulário INTEIRO, e todo campo sem
 * valor vai como `''` (`syncForm` faz `p.campo ?? ''`). Num paciente antigo, sem dado nenhum,
 * isso derrubava QUALQUER salvamento:
 *   · `tratamentoTipo: ''` não passava no enum Zod — "Invalid enum value. Expected 'cbd' | 'thc' |
 *     'cbd_thc', received ''";
 *   · `dataNascimento: ''` e `dataAssociacao: ''` iriam a colunas `date`, que o Postgres recusa;
 *   · os campos de texto gravariam `''` em vez de NULL, e "sem dado" passaria a ter dois valores.
 *
 * A regra: `''` (ou só espaços) significa "campo esvaziado" e grava NULL. O `status` é a exceção:
 * a coluna é obrigatória, então `''` é ignorado e o status atual fica. Valor preenchido segue
 * validado como antes — o enum não foi afrouxado.
 *
 * Sem `db`, sem `auth`, sem `next/*`.
 */
import { z } from 'zod';

export const TRATAMENTOS = ['cbd', 'thc', 'cbd_thc'] as const;
export const STATUS_DO_PACIENTE = [
  'aguardando_consulta',
  'em_tratamento',
  'concluido',
  'arquivado',
] as const;

/** Tratamento na EDIÇÃO: um valor válido, ou `''` para limpar. */
export const tratamentoDaEdicaoSchema = z.enum(TRATAMENTOS).or(z.literal(''));

/** Status na EDIÇÃO: um valor válido, ou `''` (formulário sem status), que é ignorado. */
export const statusDaEdicaoSchema = z.enum(STATUS_DO_PACIENTE).or(z.literal(''));

const vazio = (v: unknown): v is string => typeof v === 'string' && v.trim() === '';

/**
 * O que vai no `UPDATE`. Campo ausente (`undefined`) não é tocado; `''` vira NULL; o resto passa
 * como veio. `status` vazio nunca entra.
 */
export function valoresParaGravar(
  dados: Record<string, unknown>,
  campos: readonly string[],
): Record<string, unknown> {
  const saida: Record<string, unknown> = {};
  for (const campo of campos) {
    const valor = dados[campo];
    if (valor === undefined) continue;
    if (vazio(valor)) {
      if (campo !== 'status') saida[campo] = null;
      continue;
    }
    saida[campo] = valor;
  }
  return saida;
}
