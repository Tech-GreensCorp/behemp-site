/**
 * Lê o .docx da carta e devolve um MODELO (blocos, runs, formatação) que o gerador do PDF desenha.
 *
 * 🔴 POR QUE O PDF NASCE DO DOCX E NÃO DE UM TEXTO REDIGITADO À MÃO
 *
 * O texto do comunicado é aprovado pelo jurídico e não pode mudar uma vírgula. A primeira versão
 * do PDF tinha o texto copiado para dentro do TSX — e copiar é o que deixa erro entrar sem ninguém
 * ver. Aqui o texto é EXTRAÍDO do arquivo aprovado, e o guarda
 * `o-comunicado-assina-so-pelo-docusign` compara, parágrafo a parágrafo, o que o PDF desenha com o
 * que o .docx diz.
 *
 * ⚠️ É um leitor MÍNIMO de OOXML: cobre o que esta carta usa (parágrafos, runs, tabelas, marcador
 * de lista, borda inferior de título). Não é um conversor de docx genérico — recusa nada em
 * silêncio: um elemento que ele não entende fica de fora e o guarda de texto acusa a diferença.
 */
import { inflateRawSync } from 'node:zlib';

export interface Run {
  t: string;
  b?: boolean;
  i?: boolean;
  u?: boolean;
  /** Cor em hex sem `#`. */
  c?: string;
  /** Tamanho em meios-pontos (como o Word grava): 22 = 11 pt. */
  sz?: number;
  /** Realce do Word. `yellow` marca campo a preencher. */
  hl?: string;
}

export interface Paragrafo {
  k: 'p';
  jc?: 'left' | 'center' | 'right' | 'both';
  /** Espaço antes e depois, em vigésimos de ponto (twips). */
  antes?: number;
  depois?: number;
  /** Altura de linha em 240avos (300 = 1,25). */
  linha?: number;
  /** Estilo "Título 3" do Word. */
  titulo3?: boolean;
  /** Item de lista com marcador. */
  marcador?: boolean;
  recuo?: number;
  bordaInferior?: { cor: string; espessura: number };
  runs: Run[];
}

export interface Celula {
  /** Largura em twips. */
  w: number;
  fundo?: string;
  paragrafos: Paragrafo[];
}

export interface Tabela {
  k: 't';
  linhas: Celula[][];
}

export type Bloco = Paragrafo | Tabela;

export interface Modelo {
  pagina: {
    largura: number;
    altura: number;
    margemSup: number;
    margemDir: number;
    margemInf: number;
    margemEsq: number;
  };
  cabecalho: { texto: string; cor: string; sz: number };
  blocos: Bloco[];
}

// ── ZIP mínimo (só o que o .docx usa: entradas deflate ou store) ──

function lerEntradas(zip: Buffer): Map<string, Buffer> {
  // Fim do diretório central
  let fim = -1;
  for (let i = zip.length - 22; i >= 0; i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) {
      fim = i;
      break;
    }
  }
  if (fim < 0) throw new Error('docx inválido: diretório central não encontrado');
  const total = zip.readUInt16LE(fim + 10);
  let p = zip.readUInt32LE(fim + 16);
  const saida = new Map<string, Buffer>();
  for (let n = 0; n < total; n++) {
    if (zip.readUInt32LE(p) !== 0x02014b50) throw new Error('docx inválido: entrada corrompida');
    const metodo = zip.readUInt16LE(p + 10);
    const tamComp = zip.readUInt32LE(p + 20);
    const tamNome = zip.readUInt16LE(p + 28);
    const tamExtra = zip.readUInt16LE(p + 30);
    const tamCom = zip.readUInt16LE(p + 32);
    const deslocamento = zip.readUInt32LE(p + 42);
    const nome = zip.subarray(p + 46, p + 46 + tamNome).toString('utf8');
    const lhNome = zip.readUInt16LE(deslocamento + 26);
    const lhExtra = zip.readUInt16LE(deslocamento + 28);
    const ini = deslocamento + 30 + lhNome + lhExtra;
    const bruto = zip.subarray(ini, ini + tamComp);
    saida.set(nome, metodo === 8 ? inflateRawSync(bruto) : Buffer.from(bruto));
    p += 46 + tamNome + tamExtra + tamCom;
  }
  return saida;
}

// ── XML ──

function decodificar(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&');
}

function atributo(xml: string, nome: string): string | undefined {
  const m = xml.match(new RegExp(`${nome}="([^"]*)"`));
  return m ? m[1] : undefined;
}

function ligado(rpr: string, tag: string): boolean {
  const m = rpr.match(new RegExp(`<w:${tag}(?: [^>]*)?/>`));
  if (!m) return false;
  const v = atributo(m[0], 'w:val');
  return v === undefined || v === '1' || v === 'true';
}

function lerRuns(p: string): Run[] {
  const runs: Run[] = [];
  for (const r of p.match(/<w:r[ >][\s\S]*?<\/w:r>/g) ?? []) {
    let t = '';
    for (const parte of r.match(/<w:t(?: [^>]*)?>[\s\S]*?<\/w:t>|<w:tab\/>|<w:br\/>/g) ?? []) {
      if (parte === '<w:tab/>') t += '\t';
      else if (parte === '<w:br/>') t += '\n';
      else t += decodificar(parte.replace(/<[^>]+>/g, ''));
    }
    if (!t) continue;
    const rpr = r.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0] ?? '';
    const run: Run = { t };
    if (ligado(rpr, 'b')) run.b = true;
    if (ligado(rpr, 'i')) run.i = true;
    if (/<w:u /.test(rpr) && atributo(rpr.match(/<w:u [^>]*>/)![0], 'w:val') !== 'none')
      run.u = true;
    const cor = atributo(rpr.match(/<w:color [^>]*>/)?.[0] ?? '', 'w:val');
    if (cor && cor !== 'auto') run.c = cor;
    const sz = atributo(rpr.match(/<w:sz [^>]*>/)?.[0] ?? '', 'w:val');
    if (sz) run.sz = Number(sz);
    const hl = atributo(rpr.match(/<w:highlight [^>]*>/)?.[0] ?? '', 'w:val');
    if (hl) run.hl = hl;
    runs.push(run);
  }
  return juntar(runs);
}

const mesmoFormato = (a: Run, b: Run) =>
  a.b === b.b && a.i === b.i && a.u === b.u && a.c === b.c && a.sz === b.sz && a.hl === b.hl;

/** O Word parte uma frase em vários runs a cada correção ortográfica; junta os de mesmo formato. */
function juntar(runs: Run[]): Run[] {
  const saida: Run[] = [];
  for (const r of runs) {
    const ult = saida[saida.length - 1];
    if (ult && mesmoFormato(ult, r)) ult.t += r.t;
    else saida.push({ ...r });
  }
  return saida;
}

function lerParagrafo(p: string): Paragrafo {
  const ppr = p.match(/<w:pPr>[\s\S]*?<\/w:pPr>/)?.[0] ?? '';
  const para: Paragrafo = { k: 'p', runs: lerRuns(p) };
  const jc = atributo(ppr.match(/<w:jc [^>]*>/)?.[0] ?? '', 'w:val');
  if (jc === 'center' || jc === 'right' || jc === 'both') para.jc = jc;
  const esp = ppr.match(/<w:spacing [^>]*>/)?.[0] ?? '';
  const antes = atributo(esp, 'w:before');
  const depois = atributo(esp, 'w:after');
  const linha = atributo(esp, 'w:line');
  if (antes) para.antes = Number(antes);
  if (depois) para.depois = Number(depois);
  if (linha && atributo(esp, 'w:lineRule') === 'auto') para.linha = Number(linha);
  if (atributo(ppr.match(/<w:pStyle [^>]*>/)?.[0] ?? '', 'w:val') === 'Ttulo3') para.titulo3 = true;
  if (/<w:numPr>/.test(ppr)) para.marcador = true;
  const recuo = atributo(ppr.match(/<w:ind [^>]*>/)?.[0] ?? '', 'w:left');
  if (recuo) para.recuo = Number(recuo);
  const inf = ppr.match(/<w:bottom [^>]*>/)?.[0];
  if (inf && atributo(inf, 'w:val') === 'single') {
    para.bordaInferior = {
      cor: atributo(inf, 'w:color') ?? '000000',
      espessura: Number(atributo(inf, 'w:sz') ?? 4),
    };
  }
  return para;
}

function lerTabela(t: string): Tabela {
  const linhas: Celula[][] = [];
  for (const tr of t.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) ?? []) {
    const celulas: Celula[] = [];
    for (const tc of tr.match(/<w:tc>[\s\S]*?<\/w:tc>/g) ?? []) {
      const w = Number(atributo(tc.match(/<w:tcW [^>]*>/)?.[0] ?? '', 'w:w') ?? 0);
      const fundo = atributo(tc.match(/<w:shd [^>]*>/)?.[0] ?? '', 'w:fill');
      celulas.push({
        w,
        ...(fundo && fundo !== 'auto' ? { fundo } : {}),
        paragrafos: (tc.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? []).map(lerParagrafo),
      });
    }
    linhas.push(celulas);
  }
  return { k: 't', linhas };
}

// ── troca de texto preservando a formatação ──

type Caractere = { ch: string; fmt: Run };

function indiceDe(chars: Caractere[], procurado: string[], desde = 0): number {
  for (let i = desde; i + procurado.length <= chars.length; i++) {
    let ok = true;
    for (let j = 0; j < procurado.length; j++) {
      if (chars[i + j].ch !== procurado[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return i;
  }
  return -1;
}

/**
 * Troca textos dentro dos runs de um parágrafo, mesmo quando o trecho atravessa vários runs.
 * O trecho trocado ganha a formatação do primeiro caractere que ele substitui.
 *
 * O índice é em CARACTERES (pontos de código), não em unidades UTF-16.
 * `trocados` diz quais pares casaram, na ordem da lista.
 */
export function trocarNosRuns(
  runs: Run[],
  pares: readonly { achar: string; por: string }[],
  opcoes: { manterRealce: boolean },
): { runs: Run[]; trocados: number[] } {
  let chars: Caractere[] = runs.flatMap((r) => [...r.t].map((ch) => ({ ch, fmt: r })));
  const trocados: number[] = [];
  pares.forEach(({ achar, por }, n) => {
    const procurado = [...achar];
    // Procura sempre DEPOIS do que acabou de trocar: o texto novo pode conter o antigo
    // ("e-mail: " → "e-mail: [E-MAIL DO PACIENTE]") e, sem isto, a troca nunca terminaria.
    let desde = 0;
    for (;;) {
      const i = indiceDe(chars, procurado, desde);
      if (i < 0) break;
      desde = i + [...por].length;
      const fmt = chars[i].fmt;
      chars = [
        ...chars.slice(0, i),
        ...[...por].map((ch) => ({ ch, fmt })),
        ...chars.slice(i + procurado.length),
      ];
      if (!trocados.includes(n)) trocados.push(n);
    }
  });
  const saida: Run[] = [];
  for (const { ch, fmt } of chars) {
    const { hl, ...resto } = fmt;
    const novo: Run = opcoes.manterRealce && hl ? { ...resto, hl, t: ch } : { ...resto, t: ch };
    const ult = saida[saida.length - 1];
    if (ult && mesmoFormato(ult, novo)) ult.t += ch;
    else saida.push(novo);
  }
  return { runs: saida, trocados };
}

/**
 * 🔴 A CARTA RECEBIDA EM 19/10/2026 VEIO PREENCHIDA COM DADOS DE TESTE.
 *
 * O arquivo "CARTA PACIENTES DOACAO _VF atualizada teste.docx" tem a data "15/10/2026" e o nome
 * "André Laragnoit Fernande" no lugar dos campos, um "Querido(a) [" sem o fim do campo e as duas
 * linhas novas "e-mail:" e "cpf:" sem valor. O .docx guardado no repositório é EXATAMENTE o que
 * foi recebido; esta tabela devolve cada trecho ao campo que ele ocupava, para o PDF poder
 * colocar os dados do paciente de verdade. Nenhum outro texto é tocado.
 *
 * Se um dia chegar uma carta já com os campos em branco, esta tabela perde o uso e o guarda
 * `a-carta-do-docusign-e-a-carta-aprovada` avisa para removê-la.
 */
export const CAMPOS_DA_CARTA_DE_TESTE: readonly { achar: string; por: string }[] = [
  // a ordem importa: a frase inteira antes do nome sozinho
  {
    achar: 'Querido(a) [André Laragnoit Fernande',
    por: 'Querido(a) [NOME DO PACIENTE / RESPONSÁVEL],',
  },
  { achar: '[15/10/2026]', por: '[DATA]' },
  { achar: 'André Laragnoit Fernande', por: '[NOME DO PACIENTE / RESPONSÁVEL]' },
  { achar: 'e-mail: ', por: 'e-mail: [E-MAIL DO PACIENTE]' },
  { achar: 'cpf: ', por: 'cpf: [CPF DO PACIENTE]' },
];

function devolverCamposAoModelo(blocos: Bloco[]): Bloco[] {
  const trata = (p: Paragrafo): Paragrafo => ({
    ...p,
    runs: trocarNosRuns(p.runs, CAMPOS_DA_CARTA_DE_TESTE, { manterRealce: true }).runs,
  });
  return blocos.map((b) =>
    b.k === 'p'
      ? trata(b)
      : {
          ...b,
          linhas: b.linhas.map((l) =>
            l.map((c) => ({ ...c, paragrafos: c.paragrafos.map(trata) })),
          ),
        },
  );
}

/** O .docx da carta → modelo desenhável. */
export function docxParaModelo(docx: Buffer): { modelo: Modelo; logo: Buffer } {
  const arq = lerEntradas(docx);
  const doc = arq.get('word/document.xml')?.toString('utf8');
  const cab = arq.get('word/header1.xml')?.toString('utf8');
  const imagem = arq.get('word/media/image1.jpg');
  if (!doc || !cab || !imagem) throw new Error('docx sem document.xml, header1.xml ou a logo');

  const corpo = doc.slice(doc.indexOf('<w:body>'));
  const blocos: Bloco[] = [];
  const re = /<w:tbl>[\s\S]*?<\/w:tbl>|<w:p[ >][\s\S]*?<\/w:p>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(corpo))) {
    blocos.push(m[0].startsWith('<w:tbl>') ? lerTabela(m[0]) : lerParagrafo(m[0]));
  }

  const sect = corpo.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/)?.[0] ?? '';
  const num = (tag: string, a: string) =>
    Number(atributo(sect.match(new RegExp(`<w:${tag} [^>]*>`))?.[0] ?? '', a));
  const textoDoCab = lerRuns(cab.replace(/<w:drawing>[\s\S]*?<\/w:drawing>/g, ''))
    .map((r) => r.t)
    .join('')
    .trim();
  const rprCab = cab.match(/<w:rPr>[\s\S]*?<\/w:rPr>/g)?.find((x) => /<w:sz /.test(x)) ?? '';

  return {
    logo: Buffer.from(imagem),
    modelo: {
      pagina: {
        largura: num('pgSz', 'w:w'),
        altura: num('pgSz', 'w:h'),
        margemSup: num('pgMar', 'w:top'),
        margemDir: num('pgMar', 'w:right'),
        margemInf: num('pgMar', 'w:bottom'),
        margemEsq: num('pgMar', 'w:left'),
      },
      cabecalho: {
        texto: textoDoCab,
        cor: atributo(rprCab.match(/<w:color [^>]*>/)?.[0] ?? '', 'w:val') ?? '1F4E5F',
        sz: Number(atributo(rprCab.match(/<w:sz [^>]*>/)?.[0] ?? '', 'w:val') ?? 26),
      },
      blocos: devolverCamposAoModelo(blocos),
    },
  };
}

/** Textos de todos os parágrafos, em ordem, sem os vazios — o que o guarda compara. */
export function textosDoModelo(modelo: Modelo): string[] {
  const saida: string[] = [];
  const empurra = (p: Paragrafo) => {
    const t = p.runs.map((r) => r.t).join('');
    if (t.trim()) saida.push(t);
  };
  for (const b of modelo.blocos) {
    if (b.k === 'p') empurra(b);
    else for (const linha of b.linhas) for (const c of linha) c.paragrafos.forEach(empurra);
  }
  return saida;
}
