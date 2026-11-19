/**
 * GUARDA — o Plano de Tratamento (Adesão Collab) fecha o total do modelo ao centavo, e os
 * rótulos do documento acompanham as quantidades.
 *
 * O documento é financeiro e vai para o paciente. A referência é o PDF editável
 * `Collab_Adesao_ao_Tratamento_editavel.pdf` (19/11/2026):
 *
 *     6 × R$ 890,00 = 5.340,00 · subsídio 40% = 2.136,00 · líquido 3.204,00
 *     4 × R$ 90,00 = 360,00 · 2 × R$ 240,00 = 480,00
 *     TOTAL ANUAL DA ADESÃO = R$ 4.044,00 · 12 parcelas mensais de R$ 337,00
 *
 * 🔴 O cálculo é em centavos inteiros. Em ponto flutuante, `0.1 + 0.2 !== 0.3` — e um total
 * de R$ 4.043,99 num documento que o paciente vai pagar é defeito, não arredondamento.
 *
 * ⚠️ Os rótulos ("semestrais", "ao ano", "cerca de 3 meses") são DERIVADOS. Se o admin muda
 * para 4 entregas, o documento não pode continuar dizendo "semestrais".
 */

import { describe, expect, it } from 'vitest';

import {
  calcularAdesao,
  formatarValor,
  paraReais,
  textosDaAdesao,
} from '@/lib/planos-tratamento/calculo';

const MODELO = {
  qtdFrascos: 6,
  valorFrasco: 890,
  descontoPct: 40,
  qtdConsultas: 4,
  valorConsulta: 90,
  qtdFretes: 2,
  valorFrete: 240,
  parcelas: 12,
};

const brl = (centavos: number) => formatarValor(paraReais(centavos));

describe('o cálculo reproduz o modelo Collab ao centavo', () => {
  const r = calcularAdesao(MODELO);

  it('cada linha da composição bate com o PDF', () => {
    expect(brl(r.subtotalMedicamentos)).toBe('5.340,00');
    expect(brl(r.valorSubsidio)).toBe('2.136,00');
    expect(brl(r.medicamentosLiquido)).toBe('3.204,00');
    expect(brl(r.totalConsultas)).toBe('360,00');
    expect(brl(r.totalFretes)).toBe('480,00');
  });

  it('total anual e parcela batem com o PDF', () => {
    expect(brl(r.totalAdesao)).toBe('4.044,00');
    expect(brl(r.valorParcela)).toBe('337,00');
  });

  it('não acumula erro de ponto flutuante', () => {
    // 3 × 0,10 em float dá 0.30000000000000004; em centavos dá 30.
    const c = calcularAdesao({ ...MODELO, qtdFrascos: 3, valorFrasco: 0.1, descontoPct: 0 });
    expect(c.subtotalMedicamentos).toBe(30);
  });

  it('subsídio fracionário arredonda ao centavo', () => {
    // 1 × 10,01 × 33,33% = 3,336333 → 3,34
    const c = calcularAdesao({ ...MODELO, qtdFrascos: 1, valorFrasco: 10.01, descontoPct: 33.33 });
    expect(c.valorSubsidio).toBe(334);
    expect(c.medicamentosLiquido).toBe(1001 - 334);
  });

  it('meio centavo exato arredonda para cima, sem erro de float', () => {
    // 1 × 501,25 × 38,8% = 194,485 exatos → 194,49. Em float, 50125 * 38.8 / 100 dá
    // 19448.4999…, e Math.round entregava 194,48.
    const a = calcularAdesao({ ...MODELO, qtdFrascos: 1, valorFrasco: 501.25, descontoPct: 38.8 });
    expect(a.valorSubsidio).toBe(19449);
    // 6 × 547,50 × 2,3% = 75,555 → 75,56
    const b = calcularAdesao({ ...MODELO, qtdFrascos: 6, valorFrasco: 547.5, descontoPct: 2.3 });
    expect(b.valorSubsidio).toBe(7556);
  });

  it('🔴 as parcelas SOMAM o total, ao centavo, em qualquer divisão', () => {
    // O documento imprime "N parcelas de X" sob o total: N × X (+ ajuste da última) tem de fechar.
    const casos = [
      { ...MODELO, parcelas: 7 },
      { ...MODELO, parcelas: 3, descontoPct: 37.5 },
      { ...MODELO, descontoPct: 33.33 },
      { ...MODELO, valorFrete: 250 },
      { ...MODELO, parcelas: 60, valorFrasco: 999.99 },
    ];
    for (const caso of casos) {
      const c = calcularAdesao(caso);
      expect(c.valorParcela * (caso.parcelas - 1) + c.valorUltimaParcela).toBe(c.totalAdesao);
      expect(c.valorUltimaParcela - c.valorParcela).toBeGreaterThanOrEqual(0);
      expect(c.valorUltimaParcela - c.valorParcela).toBeLessThan(caso.parcelas);
    }
  });

  it('divisão exata não cria "última parcela" diferente', () => {
    const c = calcularAdesao(MODELO);
    expect(c.valorUltimaParcela).toBe(c.valorParcela);
  });
});

describe('os rótulos do documento seguem as quantidades', () => {
  const base = {
    periodoMeses: 12,
    medicamento: 'Balance 1:1 - 900 mg, CBD + CBG, nanotecnologia',
    qtdFrascos: 6,
    qtdFretes: 2,
    qtdConsultas: 4,
    parcelas: 12,
    descontoPct: 40,
  };

  it('o caso do modelo produz os textos do PDF', () => {
    const t = textosDaAdesao(base);
    expect(t.periodo).toBe('12 meses');
    expect(t.frascosLinha1).toBe('frascos ao ano');
    expect(t.frascosLinha2).toBe('em entregas semestrais');
    expect(t.entregasLinha2).toBe('uma a cada semestre');
    expect(t.consultasLinha2).toBe('intervalo de cerca de 3 meses');
    expect(t.linhaFrascos).toBe('Frascos de Balance 1:1');
    expect(t.linhaFretes).toBe('Fretes semestrais');
    expect(t.linhaFretesDescricao).toBe('Entregas ao longo do ano');
    expect(t.rotuloTotal).toBe('TOTAL ANUAL DA ADESÃO');
    expect(t.parcelasTexto).toBe('parcelas mensais de');
    expect(t.beneficioDesconto).toBe('40% de desconto nos medicamentos');
  });

  it('4 entregas no ano viram "trimestrais", não "semestrais"', () => {
    const t = textosDaAdesao({ ...base, qtdFretes: 4 });
    expect(t.frascosLinha2).toBe('em entregas trimestrais');
    expect(t.entregasLinha2).toBe('uma a cada trimestre');
    expect(t.linhaFretes).toBe('Fretes trimestrais');
  });

  it('período diferente de 12 meses não diz "anual"', () => {
    const t = textosDaAdesao({ ...base, periodoMeses: 6, qtdFretes: 1 });
    expect(t.rotuloTotal).toBe('TOTAL DA ADESÃO (6 MESES)');
    expect(t.frascosLinha1).toBe('frascos em 6 meses');
    expect(t.frascosLinha2).toBe('em entrega única');
    expect(t.linhaFretes).toBe('Fretes');
  });

  it('singular quando a quantidade é 1', () => {
    const t = textosDaAdesao({ ...base, qtdFrascos: 1, qtdConsultas: 1, parcelas: 1 });
    expect(t.frascosLinha1).toBe('frasco ao ano');
    expect(t.consultasLinha1).toBe('consulta com neurologista');
    expect(t.parcelasTexto).toBe('parcela mensal de');
  });

  it('nunca escreve "cerca de 0 meses" com mais consultas que meses', () => {
    for (const [periodoMeses, qtdConsultas] of [
      [12, 25],
      [12, 48],
      [1, 3],
      [6, 13],
    ]) {
      const t = textosDaAdesao({ ...base, periodoMeses, qtdConsultas });
      expect(t.consultasLinha2).not.toMatch(/\b0 meses/);
      expect(t.consultasLinha2).toBe('mais de uma consulta por mês');
    }
  });

  it('medicamento sem " - " usa o nome inteiro', () => {
    expect(textosDaAdesao({ ...base, medicamento: 'Greens MED 6300mg' }).linhaFrascos).toBe(
      'Frascos de Greens MED 6300mg',
    );
  });
});
