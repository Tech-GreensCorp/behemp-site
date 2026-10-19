/**
 * Preenche os campos da carta e marca onde o DocuSign procura a assinatura.
 *
 * 🔴 Só os CAMPOS A PREENCHER mudam — o resto do texto é o do .docx, intacto. Um campo a
 * preencher é o que o autor da carta marcou em amarelo e entre colchetes: a data, o nome do
 * paciente e o bloco de atendimento. Qualquer coisa entre colchetes que sobrar depois da troca
 * faz `aplicarDados` LANÇAR: carta com "[TELEFONE]" no PDF nunca chega ao paciente.
 *
 * Função pura (sem rede, sem banco), por isso o guarda a executa.
 */
import {
  trocarNosRuns,
  type Bloco,
  type Celula,
  type Modelo,
  type Paragrafo,
} from '@/lib/comunicados/docx-para-modelo';

export interface DadosDaCarta {
  nomePaciente: string;
  /** E-mail do paciente (a carta o mostra logo abaixo do nome). */
  emailPaciente: string;
  /** CPF do paciente, como está cadastrado. */
  cpfPaciente: string;
  /** Data do envio, já por extenso ("19 de outubro de 2026"). */
  dataPorExtenso: string;
  /** Os quatro abaixo são o bloco "Fale com a gente": atendimento, WhatsApp, e-mail e horário da Behemp. */
  atendimento: string;
  whatsapp: string;
  email: string;
  horario: string;
}

/** Parágrafo já preenchido, com as marcas da assinatura. */
export interface ParagrafoPreenchido extends Paragrafo {
  /** O DocuSign põe o campo de assinatura acima deste parágrafo. */
  ancoraAssinatura?: boolean;
  /** O DocuSign põe a data da assinatura neste parágrafo. */
  ancoraData?: boolean;
}

/** Cada texto do .docx que é um campo a preencher, e por quem ele é trocado. */
function trocas(d: DadosDaCarta): { achar: string; por: string; assinatura?: boolean }[] {
  return [
    { achar: '[DATA]', por: d.dataPorExtenso },
    { achar: '[NOME DO PACIENTE / RESPONSÁVEL]', por: d.nomePaciente },
    { achar: '(Nome do Paciente - Preencher)', por: d.nomePaciente, assinatura: true },
    { achar: '[E-MAIL DO PACIENTE]', por: d.emailPaciente },
    { achar: '[CPF DO PACIENTE]', por: d.cpfPaciente },
    { achar: '[NOME DO RESPONSÁVEL]', por: d.atendimento },
    { achar: '[TELEFONE]', por: d.whatsapp },
    { achar: '[E-MAIL]', por: d.email },
    { achar: '[HORÁRIO DE ATENDIMENTO]', por: d.horario },
  ];
}

const textoDe = (p: Paragrafo) => p.runs.map((r) => r.t).join('');

export function aplicarDados(modelo: Modelo, dados: DadosDaCarta): Bloco[] {
  // Campo vazio não pode "preencher" a carta: ela sairia com "Querido(a) ,".
  for (const [campo, valor] of Object.entries(dados)) {
    if (!valor.trim()) throw new Error(`Carta sem o campo "${campo}".`);
  }
  const lista = trocas(dados);
  const indiceDaAssinatura = lista.findIndex((t) => t.assinatura);
  const trocar = (runs: Parameters<typeof trocarNosRuns>[0]) => {
    const r = trocarNosRuns(runs, lista, { manterRealce: false });
    return { runs: r.runs, assinatura: r.trocados.includes(indiceDaAssinatura) };
  };

  const preencherCelula = (c: Celula): Celula => {
    let depoisDoGovBr = false;
    const paragrafos: ParagrafoPreenchido[] = c.paragrafos.map((p) => {
      const { runs, assinatura } = trocar(p.runs);
      const novo: ParagrafoPreenchido = { ...p, runs };
      if (assinatura) novo.ancoraAssinatura = true;
      // a data da assinatura vai no parágrafo vazio logo abaixo de "(assinar pelo GovBr)"
      if (depoisDoGovBr && runs.length === 0) {
        novo.ancoraData = true;
        depoisDoGovBr = false;
      }
      if (/assinar pelo/i.test(runs.map((r) => r.t).join(''))) depoisDoGovBr = true;
      return novo;
    });
    return { ...c, paragrafos };
  };

  const blocos: Bloco[] = modelo.blocos.map((b) => {
    if (b.k === 'p') {
      const { runs, assinatura } = trocar(b.runs);
      const novo: ParagrafoPreenchido = { ...b, runs };
      if (assinatura) novo.ancoraAssinatura = true;
      return novo;
    }
    return { ...b, linhas: b.linhas.map((linha) => linha.map(preencherCelula)) };
  });

  // Rede de segurança: o que ainda estiver entre colchetes é campo que ninguém preencheu.
  const restos = textosPreenchidos(blocos).filter(
    (t) => /\[[^\]]*\]/.test(t) || /Preencher/.test(t),
  );
  if (restos.length > 0) {
    throw new Error(
      `Carta com campo sem preencher: ${restos.map((t) => t.slice(0, 40)).join(' | ')}`,
    );
  }
  if (!blocos.some(temAncora('ancoraAssinatura')) || !blocos.some(temAncora('ancoraData'))) {
    throw new Error(
      'Carta sem o ponto da assinatura ou da data: o DocuSign não acharia onde assinar.',
    );
  }
  return blocos;
}

const temAncora =
  (qual: 'ancoraAssinatura' | 'ancoraData') =>
  (b: Bloco): boolean =>
    b.k === 'p'
      ? !!(b as ParagrafoPreenchido)[qual]
      : b.linhas.some((l) =>
          l.some((c) => c.paragrafos.some((p) => !!(p as ParagrafoPreenchido)[qual])),
        );

/** Textos de todos os parágrafos de um conjunto de blocos, sem os vazios. */
export function textosPreenchidos(blocos: Bloco[]): string[] {
  const saida: string[] = [];
  const empurra = (p: Paragrafo) => {
    const t = textoDe(p);
    if (t.trim()) saida.push(t);
  };
  for (const b of blocos) {
    if (b.k === 'p') empurra(b);
    else b.linhas.forEach((l) => l.forEach((c) => c.paragrafos.forEach(empurra)));
  }
  return saida;
}
