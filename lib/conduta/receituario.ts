/**
 * O QUE O TEOR DE THC DECIDE — e o que ele NÃO decide.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * O `CAN-04` (RDC 1.015/2026, Art. 37, §§ 1º e 2º) faz o tipo de receituário depender do teor
 * de THC do produto: <= 0,2% Receita de Controle Especial; acima disso, Notificação de Receita
 * "A". Se esse limiar morasse na tela, dois lugares o escreveriam e um deles ficaria para trás
 * — foi exatamente o que aconteceu com o mapa 7->4 da urgência (`DO-42`), que até hoje não
 * está escrito. Aqui é a constante única.
 *
 * 🔴 O QUE ESTE MÓDULO NÃO FAZ, POR DECISÃO DO DONO (`DO-46`, `DO-47`)
 * Ele NÃO decide, NÃO trava e NÃO deriva o teor de nada. Ele traduz um teor **que o médico
 * informou** no aviso correspondente. A frase que fixa isso:
 *
 *   "isso é opcional com aviso, o médico quem deve seguir o procedimento correto, o sistema
 *    avisa."
 *   "além de que isso é algo que o 'MÉDICO' preenche não o SISTEMA."
 *
 * É a fronteira `IMD-01` (informar) x `IMD-02` (dirigir) do IMDRF N12:2014, e a proibição nº 2
 * do `CLAUDE.md`. Ver ADR-0012 D-02, rejeitados R-04 e R-05.
 *
 * 🛑 NÃO derivar o teor de `thcMgPorGota`: chega-se a mg/ml, mas o percentual depende de a base
 * ser m/m ou m/v e, na primeira, da densidade — que o schema não tem. E `CAN-03` diz que a
 * concentração válida é a da Autorização Sanitária da ANVISA, não uma conta nossa.
 */

/**
 * O limiar do `CAN-04`, em pontos percentuais. **Uma constante, um lugar.**
 * Mudá-la aqui muda o aviso, o rótulo e o guarda ao mesmo tempo — que é o objetivo.
 */
export const LIMIAR_THC_PERCENTUAL = 0.2;

/**
 * `indeterminado` NÃO é um estado de erro — é o estado normal enquanto o catálogo não tiver
 * teores (`DO-46`: levantá-los é trabalho do chefe, fora desta sprint). A tela DIZ que não sabe
 * em vez de assumir a faixa mais confortável. Silêncio que parece aprovação é a pior saída.
 */
export type TipoReceituario = 'controle_especial' | 'notificacao_a' | 'indeterminado';

export interface AvisoDeReceituario {
  tipo: TipoReceituario;
  /** Rótulo humano, o mesmo em toda tela que mostrar isto. */
  rotulo: string;
  /** Uma frase, para o médico ler sem abrir norma. */
  explicacao: string;
  /** A regra citável, para quem quiser conferir. Vazio quando indeterminado. */
  fundamento: string;
  /** `true` quando o produto exige Notificação de Receita "A" — a faixa restrita. */
  exigeNotificacaoA: boolean;
}

const AVISOS: Record<TipoReceituario, Omit<AvisoDeReceituario, 'tipo'>> = {
  controle_especial: {
    rotulo: 'Receita de Controle Especial',
    explicacao: 'Teor de THC de até 0,2%. O produto é prescrito em Receita de Controle Especial.',
    fundamento: 'CAN-04 — RDC 1.015/2026, Art. 37, § 1º',
    exigeNotificacaoA: false,
  },
  notificacao_a: {
    rotulo: 'Notificação de Receita "A"',
    explicacao:
      'Teor de THC acima de 0,2%. A prescrição deve ser acompanhada de Notificação de Receita "A".',
    fundamento: 'CAN-04 — RDC 1.015/2026, Art. 37, § 2º',
    exigeNotificacaoA: true,
  },
  indeterminado: {
    rotulo: 'Teor de THC não informado',
    explicacao:
      'Sem o teor de THC do produto não é possível indicar qual receituário se aplica. Informe o teor conforme a Autorização Sanitária da ANVISA.',
    fundamento: '',
    exigeNotificacaoA: false,
  },
};

/**
 * Traduz o teor percentual informado no aviso correspondente.
 *
 * @param teorThcPercentual valor informado pelo médico, ou `null`/`undefined` quando não há.
 *   Aceita `string` porque `numeric` do Drizzle chega como string.
 */
export function avisoDeReceituario(
  teorThcPercentual: number | string | null | undefined,
): AvisoDeReceituario {
  const tipo = tipoDeReceituario(teorThcPercentual);
  return { tipo, ...AVISOS[tipo] };
}

/** O mesmo cálculo, sem o texto — para quem só precisa do discriminante. */
export function tipoDeReceituario(
  teorThcPercentual: number | string | null | undefined,
): TipoReceituario {
  const teor = normalizarTeor(teorThcPercentual);
  if (teor === null) return 'indeterminado';
  return teor > LIMIAR_THC_PERCENTUAL ? 'notificacao_a' : 'controle_especial';
}

/**
 * `null` significa "não informado". Vazio, `NaN` e negativo caem aqui de propósito: um teor que
 * não dá para ler é um teor que não temos, e inventar zero afirmaria a faixa permissiva.
 */
export function normalizarTeor(valor: number | string | null | undefined): number | null {
  if (valor === null || valor === undefined) return null;

  if (typeof valor === 'number') {
    return Number.isFinite(valor) && valor >= 0 ? valor : null;
  }

  // ⚠️ `Number('')` e `Number('   ')` são **0**, não NaN. Sem esta guarda, um campo em branco
  // viraria teor zero e, por consequência, "Receita de Controle Especial" — a faixa permissiva
  // afirmada a partir de nada. O guarda `a-conduta-avisa-e-nao-decide` pegou este defeito antes
  // de a tela existir.
  const texto = valor.trim();
  if (texto === '') return null;

  const n = Number(texto.replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TROCA DE FAIXA NO AJUSTE — `DO-47`: avisa, não impõe
// ═══════════════════════════════════════════════════════════════════════════════

export interface AvisoDeTrocaDeFaixa {
  /** `true` quando o tipo de receituário muda entre o produto anterior e o novo. */
  mudouDeFaixa: boolean;
  de: AvisoDeReceituario;
  para: AvisoDeReceituario;
  /** Texto pronto para a tela. Vazio quando não há o que avisar. */
  mensagem: string;
}

/**
 * Compara as faixas do produto que sai e do que entra num ajuste de dose.
 *
 * 🔴 O resultado é **aviso**, nunca bloqueio. A pergunta "troca de faixa torna a prescrição nova
 * obrigatória?" foi feita ao dono em 24/08/2026 e respondida com **não**: continua opcional, com
 * aviso. ADR-0005 D-03, terceira versão.
 *
 * Quando qualquer um dos dois lados é `indeterminado`, NÃO se afirma que mudou — não se sabe.
 * A mensagem então diz o que falta, em vez de fingir uma comparação.
 */
export function avisoDeTrocaDeFaixa(
  teorAnterior: number | string | null | undefined,
  teorNovo: number | string | null | undefined,
): AvisoDeTrocaDeFaixa {
  const de = avisoDeReceituario(teorAnterior);
  const para = avisoDeReceituario(teorNovo);

  const algumIndeterminado = de.tipo === 'indeterminado' || para.tipo === 'indeterminado';

  if (algumIndeterminado) {
    return {
      mudouDeFaixa: false,
      de,
      para,
      mensagem:
        'Não é possível comparar o tipo de receituário: falta o teor de THC de pelo menos um dos produtos.',
    };
  }

  if (de.tipo === para.tipo) {
    return { mudouDeFaixa: false, de, para, mensagem: '' };
  }

  return {
    mudouDeFaixa: true,
    de,
    para,
    mensagem:
      `Este produto muda o tipo de receituário: de ${de.rotulo} para ${para.rotulo} ` +
      `(${para.fundamento}). Gerar prescrição nova continua sendo decisão sua.`,
  };
}
