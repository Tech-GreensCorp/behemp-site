import type { RespostaDoPaciente } from './triagem';

/**
 * INTERPRETA O QUE O PACIENTE ESCREVEU.
 *
 * 🔴 POR QUE ISTO NÃO É UM `switch` DE TRÊS PALAVRAS
 *
 * A primeira versão usava `/^(sim|nao|não|n|s)$/` — âncora total, palavra exata. Um teste
 * ao vivo derrubou: **"Não, ainda não"** — como uma pessoa de verdade responde — não casava
 * com nada, virava "não sei", e o sistema seguia o que a base dizia. Resultado: o link
 * **não era oferecido a quem precisava**, que é o erro exato que este fluxo existe para não
 * cometer.
 *
 * O paciente não escolhe entre opções; ele **conversa**. "Não, ainda não", "acho que não",
 * "tenho sim mas venceu", "só a antiga" — tudo isso chega por aqui.
 *
 * 🔴 A NEGAÇÃO É PROCURADA PRIMEIRO, e a ordem não é detalhe: **"não tenho" contém
 * "tenho"**. Procurando afirmação antes, toda negação viraria afirmação.
 */

/** Tira acento e baixa a caixa, para "NÃO" e "nao" chegarem no mesmo lugar. */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

const NEGA = /\b(nao|nunca|ainda nao|negativo|jamais)\b|\bn\b/;
const AFIRMA = /\b(sim|tenho|possuo|ja tenho|positivo|claro|isso)\b|\bs\b/;

/**
 * ⚠️ Menção a vencimento é tratada como NÃO TER.
 *
 * "tenho, mas venceu" é afirmação seguida de uma informação que a anula: uma receita
 * vencida não serve para dispensação, por norma. Ler isso como "tem" mandaria o paciente
 * para o caminho errado — com ele tendo dito, em palavras, o motivo de precisar do outro.
 */
const VENCIMENTO = /\b(venc|expir|atrasad|antig|velh|passad)/;

export function interpretarResposta(cru: string | null | undefined): RespostaDoPaciente {
  const t = normalizar(cru ?? '');
  if (!t) return null;

  // Botão numerado do painel, se o fluxo usar opções.
  if (t === '1') return 'tem_receita';
  if (t === '2') return 'nao_tem';

  if (VENCIMENTO.test(t)) return 'nao_tem';
  // 🔴 Negação ANTES de afirmação — "não tenho" contém "tenho".
  if (NEGA.test(t)) return 'nao_tem';
  if (AFIRMA.test(t)) return 'tem_receita';

  return 'nao_sabe';
}
