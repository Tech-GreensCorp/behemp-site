/**
 * Cálculo da Adesão ao Tratamento (Programa de Acesso Collab).
 *
 * Função PURA, usada em três lugares que precisam concordar ao centavo: a prévia ao vivo do
 * formulário, a action (que grava os totais — o client nunca manda total) e o documento.
 *
 * Tudo em CENTAVOS inteiros. `0.1 + 0.2` em ponto flutuante não fecha, e um documento financeiro
 * com R$ 4.043,99 no lugar de R$ 4.044,00 é pior que nenhum.
 *
 * Fórmula (a do modelo `Collab_Adesao_ao_Tratamento`):
 *   medicamentos        = frascos × valor do frasco
 *   subsídio            = medicamentos × desconto%           (arredondado ao centavo)
 *   medicamentos líq.   = medicamentos − subsídio
 *   consultas           = qtd × valor da consulta
 *   fretes              = qtd × valor do frete
 *   total da adesão     = medicamentos líq. + consultas + fretes
 *   parcela             = total ÷ parcelas                   (para baixo, ao centavo)
 *   última parcela      = total − parcela × (parcelas − 1)   (absorve o resto)
 */

export interface EntradaAdesao {
  qtdFrascos: number;
  valorFrasco: number; // reais
  descontoPct: number; // 0–100
  qtdConsultas: number;
  valorConsulta: number; // reais
  qtdFretes: number;
  valorFrete: number; // reais
  parcelas: number;
}

export interface ResultadoAdesao {
  subtotalMedicamentos: number; // centavos
  valorSubsidio: number;
  medicamentosLiquido: number;
  totalConsultas: number;
  totalFretes: number;
  totalAdesao: number;
  valorParcela: number;
  valorUltimaParcela: number;
}

export const paraCentavos = (reais: number): number => Math.round(reais * 100);
export const paraReais = (centavos: number): number => centavos / 100;

export function calcularAdesao(e: EntradaAdesao): ResultadoAdesao {
  const subtotalMedicamentos = e.qtdFrascos * paraCentavos(e.valorFrasco);
  // Percentual em centésimos de ponto (38,8% → 3880) e divisão INTEIRA com meio-para-cima.
  // `Math.round(50125 * 38.8 / 100)` dá 19448 porque o float vira 19448.4999…; o certo é 19449.
  const descontoCentesimos = Math.round(e.descontoPct * 100);
  const valorSubsidio = Math.floor((subtotalMedicamentos * descontoCentesimos + 5000) / 10000);
  const medicamentosLiquido = subtotalMedicamentos - valorSubsidio;
  const totalConsultas = e.qtdConsultas * paraCentavos(e.valorConsulta);
  const totalFretes = e.qtdFretes * paraCentavos(e.valorFrete);
  const totalAdesao = medicamentosLiquido + totalConsultas + totalFretes;
  // Parcela arredondada PARA BAIXO e a diferença vai para a última: N × parcela + resto fecha o
  // total ao centavo. Arredondar cada parcela ao mais próximo imprimiria "3 × R$ 333,33" sob um
  // total de R$ 1.000,00 — o paciente pagaria R$ 999,99.
  const valorParcela = e.parcelas > 0 ? Math.floor(totalAdesao / e.parcelas) : 0;
  const valorUltimaParcela = ultimaParcela(totalAdesao, valorParcela, e.parcelas);

  return {
    subtotalMedicamentos,
    valorSubsidio,
    medicamentosLiquido,
    totalConsultas,
    totalFretes,
    totalAdesao,
    valorParcela,
    valorUltimaParcela,
  };
}

/** Em centavos: a última parcela absorve o resto da divisão. Igual à parcela quando é exata. */
export function ultimaParcela(totalCentavos: number, parcelaCentavos: number, parcelas: number) {
  return parcelas > 0 ? totalCentavos - parcelaCentavos * (parcelas - 1) : 0;
}

// ── Formatação ─────────────────────────────────────────────────

/** 4044 → "4.044,00" (sem o "R$", que o documento põe em coluna própria). */
export function formatarValor(reais: number): string {
  return reais.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** 40 → "40"; 37.5 → "37,5". */
export function formatarPercentual(pct: number): string {
  return pct.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

/** "2026-05-08" → "08/05/2026", sem passar por fuso horário. */
export function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : iso;
}

// ── Textos que dependem das quantidades ────────────────────────

/** Intervalo exato em meses entre eventos distribuídos no período, ou null se não for inteiro. */
function intervaloExato(periodoMeses: number, quantidade: number): number | null {
  if (quantidade <= 0) return null;
  const intervalo = periodoMeses / quantidade;
  return Number.isInteger(intervalo) ? intervalo : null;
}

const ADJETIVO_FREQUENCIA: Record<number, string> = {
  1: 'mensais',
  2: 'bimestrais',
  3: 'trimestrais',
  4: 'quadrimestrais',
  6: 'semestrais',
  12: 'anuais',
};

const UNIDADE_INTERVALO: Record<number, string> = {
  1: 'mês',
  2: 'bimestre',
  3: 'trimestre',
  4: 'quadrimestre',
  6: 'semestre',
  12: 'ano',
};

const plural = (n: number, singular: string, pluralForm: string) =>
  n === 1 ? singular : pluralForm;

export interface TextosAdesao {
  periodo: string;
  nomeCurtoMedicamento: string;
  frascosLinha1: string;
  frascosLinha2: string;
  entregasLinha1: string;
  entregasLinha2: string;
  consultasLinha1: string;
  consultasLinha2: string;
  linhaFrascos: string;
  linhaFretes: string;
  linhaFretesDescricao: string;
  rotuloTotal: string;
  parcelasTexto: string;
  beneficioDesconto: string;
}

/**
 * Os rótulos do documento que o modelo escreve "semestrais", "ao ano", "cerca de 3 meses".
 * São DERIVADOS do período e das quantidades — se o admin muda para 4 entregas, o texto vira
 * "trimestrais" em vez de mentir "semestrais".
 */
export function textosDaAdesao(d: {
  periodoMeses: number;
  medicamento: string;
  qtdFrascos: number;
  qtdFretes: number;
  qtdConsultas: number;
  parcelas: number;
  descontoPct: number;
}): TextosAdesao {
  const anual = d.periodoMeses === 12;
  const noPeriodo = anual
    ? 'ao ano'
    : `em ${d.periodoMeses} ${plural(d.periodoMeses, 'mês', 'meses')}`;

  const intervaloEntregas = intervaloExato(d.periodoMeses, d.qtdFretes);
  const adjetivoEntregas =
    intervaloEntregas !== null ? (ADJETIVO_FREQUENCIA[intervaloEntregas] ?? null) : null;

  let frascosLinha2: string;
  if (d.qtdFretes === 1) frascosLinha2 = 'em entrega única';
  else if (adjetivoEntregas) frascosLinha2 = `em entregas ${adjetivoEntregas}`;
  else if (d.qtdFretes > 1) frascosLinha2 = `em ${d.qtdFretes} entregas`;
  else frascosLinha2 = 'sem entregas previstas';

  let entregasLinha2: string;
  if (d.qtdFretes === 1) entregasLinha2 = 'entrega única';
  else if (intervaloEntregas !== null && UNIDADE_INTERVALO[intervaloEntregas])
    entregasLinha2 = `uma a cada ${UNIDADE_INTERVALO[intervaloEntregas]}`;
  else if (intervaloEntregas !== null) entregasLinha2 = `uma a cada ${intervaloEntregas} meses`;
  else entregasLinha2 = anual ? 'ao longo do ano' : 'ao longo do período';

  let consultasLinha2: string;
  if (d.qtdConsultas <= 0) consultasLinha2 = 'sem consultas previstas';
  else if (d.qtdConsultas === 1) consultasLinha2 = 'consulta única no período';
  else if (d.periodoMeses / d.qtdConsultas < 1) {
    // Mais consultas que meses: "cerca de 0 meses" seria falso no documento do paciente.
    consultasLinha2 = 'mais de uma consulta por mês';
  } else {
    const meses = Math.round(d.periodoMeses / d.qtdConsultas);
    consultasLinha2 = `intervalo de cerca de ${meses} ${plural(meses, 'mês', 'meses')}`;
  }

  const nomeCurto = d.medicamento.split(' - ')[0]?.trim() || d.medicamento.trim();

  return {
    periodo: `${d.periodoMeses} ${plural(d.periodoMeses, 'mês', 'meses')}`,
    nomeCurtoMedicamento: nomeCurto,
    frascosLinha1: `${plural(d.qtdFrascos, 'frasco', 'frascos')} ${noPeriodo}`,
    frascosLinha2,
    entregasLinha1: plural(d.qtdFretes, 'entrega', 'entregas'),
    entregasLinha2,
    consultasLinha1: plural(
      d.qtdConsultas,
      'consulta com neurologista',
      'consultas com neurologista',
    ),
    consultasLinha2,
    linhaFrascos: `Frascos de ${nomeCurto}`,
    linhaFretes: adjetivoEntregas && d.qtdFretes > 1 ? `Fretes ${adjetivoEntregas}` : 'Fretes',
    linhaFretesDescricao: anual ? 'Entregas ao longo do ano' : 'Entregas ao longo do período',
    rotuloTotal: anual
      ? 'TOTAL ANUAL DA ADESÃO'
      : `TOTAL DA ADESÃO (${d.periodoMeses} ${plural(d.periodoMeses, 'MÊS', 'MESES')})`,
    parcelasTexto: plural(d.parcelas, 'parcela mensal de', 'parcelas mensais de'),
    beneficioDesconto: `${formatarPercentual(d.descontoPct)}% de desconto nos medicamentos`,
  };
}
