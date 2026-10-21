/**
 * POR QUANTO TEMPO CADA DOCUMENTO VALE.
 *
 * Extraída de `app/_actions/documentos.ts` em 10/09/2026, sem mudar o comportamento. O motivo
 * é técnico e vale registrar: aquele arquivo é `'use server'`, e um módulo de Server Actions
 * **só pode exportar função async**. Regra de domínio pura não é action — o lugar dela é aqui,
 * onde o upload manual e o recebimento de documento do parceiro leem a MESMA função.
 *
 * 🔴 Uma segunda regra de validade seria uma segunda verdade sobre o mesmo documento.
 */

/**
 * ANVISA vale 2 anos; receita, 6 meses; o resto não tem validade prática.
 *
 * 🔴 OS 6 MESES DA RECEITA NÃO TÊM FONTE, E DIVERGEM DA FARMÁCIA.
 *
 * Levantado pelo lado da Greens em 10/09/2026 e confirmado por pesquisa: a **RDC 1.015/2026**
 * dá **30 dias** de validade à receita de produto de Cannabis para dispensação em farmácia —
 * é Receita de Controle Especial, não receita simples. Seis meses é o prazo de praxe da
 * receita **comum**, e produto de Cannabis não é receita comum.
 *
 * A consequência é concreta: no dia 45 este sistema diz "válida" e a Greens diz "vencida",
 * bloqueando o despacho. O paciente descobre no balcão.
 *
 * ⚠️ NÃO MUDEI O NÚMERO. Validade de receita é ato médico com consequência assistencial —
 * encurtar faz o paciente voltar mais cedo, alongar faz ele ser recusado na compra. É decisão
 * do dono com o médico responsável (`DO-17`: dúvida de negócio se pergunta).
 *
 * As três opções, com o custo de cada uma, estão em `docs/02-CATALOGO-DE-REGRAS.md`,
 * `VAL-01`/`VAL-02`. Os 2 anos da ANVISA estão certos: `IMP-03`, RDC 660/2022 Art. 8º.
 */
export function calcularValidade(tipo: string, dataEmissao: string): string {
  const data = new Date(dataEmissao);

  switch (tipo) {
    case 'autorizacao_anvisa':
      data.setMonth(data.getMonth() + 24);
      break;
    case 'receita_medica':
      data.setMonth(data.getMonth() + 6);
      break;
    default:
      // Documentos sem validade: 100 anos
      data.setFullYear(data.getFullYear() + 100);
      break;
  }

  return data.toISOString().split('T')[0];
}
