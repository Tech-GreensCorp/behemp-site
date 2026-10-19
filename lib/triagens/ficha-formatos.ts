/**
 * Formatação de valores para o PDF da triagem.
 *
 * Puro de propósito: sem `db`, sem `auth`, sem `next/*`, sem React. Cada função existe porque o
 * dado cru erra de um jeito específico no papel:
 *   · a fonte do PDF (Helvetica, WinAnsi) não tem emoji nem a maioria dos símbolos: o glifo
 *     ausente sai como lixo no meio do texto;
 *   · palavra sem espaço (URL, e-mail comprido) não quebra e atravessa a margem;
 *   · data e hora precisam sair no fuso de São Paulo, não no do servidor.
 */

const FUSO = 'America/Sao_Paulo';

export function formatarDataHora(valor: Date | string | null | undefined): string {
  if (!valor) return '';
  const d = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(d.getTime())) return '';
  const data = new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO,
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(d);
  const hora = new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO,
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
  return `${data} às ${hora}`;
}

/** Idade a partir de `DD/MM/YYYY` (formulário novo) ou ISO (importação legada). */
export function calcularIdade(nascimento: string | null | undefined, hoje = new Date()): number | null {
  if (!nascimento) return null;
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(nascimento);
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(nascimento);
  const [a, m, d] = br
    ? [Number(br[3]), Number(br[2]), Number(br[1])]
    : iso
      ? [Number(iso[1]), Number(iso[2]), Number(iso[3])]
      : [NaN, NaN, NaN];
  if (Number.isNaN(a)) return null;
  let idade = hoje.getFullYear() - a;
  const mes = hoje.getMonth() + 1 - m;
  if (mes < 0 || (mes === 0 && hoje.getDate() < d)) idade--;
  return idade >= 0 && idade < 130 ? idade : null;
}

/**
 * Remove o que a Helvetica não desenha e quebra palavra longa demais.
 *
 * Mantém Latin-1 (acentos), pontuação tipográfica comum e `€`; descarta emoji, controle e o
 * resto. Mais de 40 caracteres sem espaço ganham um espaço de quebra — sem isto uma URL
 * atravessa a margem e some do papel.
 */
export function limparTexto(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  const bruto = typeof valor === 'string' ? valor : String(valor);
  const semGlifoAusente = bruto
    .replace(/\r\n?/g, '\n')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/\u2022/g, '·')
    .replace(/[^\n\t\u0020-\u007E\u00A0-\u00FF\u2013\u2014\u20AC]/g, '');
  return semGlifoAusente.replace(/\S{40,}/g, (palavra) => palavra.replace(/(.{40})/g, '$1 ').trim());
}

/**
 * Nome do arquivo: o do paciente, sem o que o sistema de arquivos recusa.
 *
 * Mantém acento e espaço (é nome de gente). Tira separador de caminho, caractere reservado do
 * Windows, controle e ponto final; sem nome utilizável cai em "Paciente".
 */
export function nomeDoArquivoDaFicha(nome: string | null | undefined): string {
  const base = (nome ?? '')
    .normalize('NFC')
    .replace(/[\\/:*?"<>|\u0000-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, 80)
    .trim();
  return `${base || 'Paciente'}.pdf`;
}

/** Versão ASCII do nome, para o parâmetro `filename=` que clientes antigos ainda leem. */
export function nomeAscii(nomeArquivo: string): string {
  return nomeArquivo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/["\\]/g, '')
    .trim();
}
