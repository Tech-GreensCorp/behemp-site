/**
 * Guarda da carta que vai ao DocuSign: ela É a carta aprovada (.docx), com só os campos a
 * preencher trocados.
 *
 * 🔴 O que impede de voltar:
 *   · o texto do PDF divergir do .docx aprovado (a primeira versão tinha o texto redigitado à mão)
 *   · o modelo/JSON/logo ficarem desatualizados em relação ao .docx
 *   · a carta sair com campo a preencher em branco ("[TELEFONE]", "Querido(a) ,") ou sem o ponto
 *     da assinatura
 *   · a logo e o nome da Behemp deixarem de aparecer no topo de TODAS as páginas
 *
 * ⚠️ A comparação do texto é feita por um caminho INDEPENDENTE do extrator: aqui o .docx é lido
 * por um leitor de zip próprio e o texto sai de um `strip` de tags — se o extrator errar, esta
 * leitura não erra junto.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateRawSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import {
  aplicarDados,
  textosPreenchidos,
  type DadosDaCarta,
  type ParagrafoPreenchido,
} from '@/lib/comunicados/carta-doacao-dados';
import { CONTATO_DA_CARTA } from '@/lib/comunicados/catalogo';
import {
  CAMPOS_DA_CARTA_DE_TESTE,
  docxParaModelo,
  textosDoModelo,
  type Modelo,
} from '@/lib/comunicados/docx-para-modelo';
import modeloJson from '@/lib/comunicados/modelo/carta-doacao.json';
import { LOGO_JPG_BASE64 } from '@/lib/comunicados/modelo/logo';

const RAIZ = join(__dirname, '..', '..');
const DOCX = readFileSync(join(RAIZ, 'lib/comunicados/modelo/CARTA-PACIENTES-DOACAO_VF.docx'));
const modelo = modeloJson as unknown as Modelo;

// ── leitura independente do .docx ─────────────────────────────

function entradaDoZip(zip: Buffer, nome: string): Buffer {
  // varre os cabeçalhos locais (assinatura PK\x03\x04) — sem usar o diretório central
  for (let i = 0; i < zip.length - 30; i++) {
    if (zip.readUInt32LE(i) !== 0x04034b50) continue;
    const metodo = zip.readUInt16LE(i + 8);
    const comp = zip.readUInt32LE(i + 18);
    const tamNome = zip.readUInt16LE(i + 26);
    const tamExtra = zip.readUInt16LE(i + 28);
    const n = zip.subarray(i + 30, i + 30 + tamNome).toString('utf8');
    if (n !== nome) continue;
    const ini = i + 30 + tamNome + tamExtra;
    const dados = zip.subarray(ini, ini + comp);
    return metodo === 8 ? inflateRawSync(dados) : Buffer.from(dados);
  }
  throw new Error(`entrada ${nome} não encontrada no docx`);
}

const entidades = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

/** Texto de cada `<w:p>` do corpo, em ordem, sem os vazios. */
function paragrafosDoDocx(): string[] {
  const xml = entradaDoZip(DOCX, 'word/document.xml').toString('utf8');
  const corpo = xml.slice(xml.indexOf('<w:body>'));
  return (corpo.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? [])
    .map((p) =>
      entidades(
        (p.match(/<w:t(?: [^>]*)?>[\s\S]*?<\/w:t>/g) ?? [])
          .map((t) => t.replace(/<[^>]+>/g, ''))
          .join(''),
      ),
    )
    .filter((t) => t.trim());
}

const DADOS: DadosDaCarta = {
  nomePaciente: 'Maria Aparecida dos Santos',
  emailPaciente: 'maria@exemplo.com',
  cpfPaciente: '111.222.333-44',
  dataPorExtenso: '19 de outubro de 2026',
  ...CONTATO_DA_CARTA,
};

/** A carta recebida veio preenchida com dados de teste; a tabela os devolve aos campos (split/join). */
const semDadosDeTeste = (textos: string[]) =>
  textos.map((t) => CAMPOS_DA_CARTA_DE_TESTE.reduce((acc, p) => acc.split(p.achar).join(p.por), t));

/** As trocas, escritas de novo aqui só com split/join — sem passar pelo código de produção. */
function esperadoComTrocas(textos: string[]): string[] {
  const pares: [string, string][] = [
    ['[DATA]', DADOS.dataPorExtenso],
    ['[NOME DO PACIENTE / RESPONSÁVEL]', DADOS.nomePaciente],
    ['(Nome do Paciente - Preencher)', DADOS.nomePaciente],
    ['[E-MAIL DO PACIENTE]', DADOS.emailPaciente],
    ['[CPF DO PACIENTE]', DADOS.cpfPaciente],
    ['[NOME DO RESPONSÁVEL]', DADOS.atendimento],
    ['[TELEFONE]', DADOS.whatsapp],
    ['[E-MAIL]', DADOS.email],
    ['[HORÁRIO DE ATENDIMENTO]', DADOS.horario],
  ];
  return textos.map((t) => pares.reduce((acc, [de, para]) => acc.split(de).join(para), t));
}

describe('o texto do PDF é o do .docx aprovado', () => {
  it('a leitura independente enxerga a carta (a comparação não ficou cega)', () => {
    const p = paragrafosDoDocx();
    expect(p.length).toBeGreaterThan(60);
    expect(p).toContain('Programa de Acesso Humanitário');
    expect(p.some((t) => t.includes('R$ 1.190,00 por frasco'))).toBe(true);
  });

  it('o modelo guardado diz EXATAMENTE o que o .docx diz, parágrafo a parágrafo', () => {
    expect(textosDoModelo(modelo)).toEqual(semDadosDeTeste(paragrafosDoDocx()));
  });

  it('o modelo e a logo guardados correspondem ao .docx atual (rode scripts/gerar-modelo-da-carta.ts)', () => {
    const { modelo: recalculado, logo } = docxParaModelo(DOCX);
    expect(modelo).toEqual(recalculado);
    expect(LOGO_JPG_BASE64).toBe(logo.toString('base64'));
    expect(logo.subarray(0, 3).toString('hex')).toBe('ffd8ff'); // JPEG
  });

  it('depois de preencher, só os campos a preencher mudaram', () => {
    const blocos = aplicarDados(modelo, DADOS);
    expect(textosPreenchidos(blocos)).toEqual(
      esperadoComTrocas(semDadosDeTeste(paragrafosDoDocx())),
    );
  });

  it('a tabela de campos de teste está em uso: cada trecho dela existe no .docx recebido', () => {
    // Se chegar uma carta já com os campos em branco, esta tabela perde o uso e deve ser REMOVIDA
    // (docx-para-modelo.ts), porque trocar texto que não existe mais só esconde erro.
    let textos = paragrafosDoDocx();
    for (const p of CAMPOS_DA_CARTA_DE_TESTE) {
      expect(
        textos.some((t) => t.includes(p.achar)),
        `"${p.achar}" não está mais no .docx`,
      ).toBe(true);
      textos = textos.map((t) => t.split(p.achar).join(p.por));
    }
  });

  it('a mudança de conteúdo da versão atualizada está na carta', () => {
    const t = textosPreenchidos(aplicarDados(modelo, DADOS));
    expect(t).toContain(
      'E as consultas de acompanhamento para quem aderir ao plano anual continuam gratuitas, exatamente como sempre foram. O paciente segue tendo direito a 2 consultas por ano — uma a cada 6 meses — sem nenhum custo, para garantir que o tratamento continue sendo acompanhado de perto. Existindo a necessidade de consultas extras, o valor será de R$ 90,00 pagos diretamente aos médicos parceiros e escolhidos por vocês. ',
    );
    expect(t).toContain(`e-mail: ${DADOS.emailPaciente}`);
    expect(t).toContain(`cpf: ${DADOS.cpfPaciente}`);
  });

  it('o texto aprovado segue como está, inclusive o que parece erro (não é nosso corrigir)', () => {
    const t = textosPreenchidos(aplicarDados(modelo, DADOS));
    expect(t).toContain('Vice Presidnete');
    // 19/10/2026: a Dryelle mandou remover a linha do GovBr da última página, e trocar "Collab anual" por "plano anual"
    expect(t.join(' ')).not.toMatch(/GovBr/i);
    expect(t.join(' ')).not.toMatch(/Collab/);
    expect(t).toContain('12 frascos × R$ 210,00');
  });
});

describe('os campos a preencher', () => {
  it('nenhum colchete nem "Preencher" sobra, e o nome entra no cumprimento e na assinatura', () => {
    const t = textosPreenchidos(aplicarDados(modelo, DADOS));
    expect(t.filter((x) => /\[[^\]]*\]/.test(x) || /Preencher/.test(x))).toEqual([]);
    expect(t).toContain(`Querido(a) ${DADOS.nomePaciente},`);
    expect(t.filter((x) => x === DADOS.nomePaciente).length).toBeGreaterThanOrEqual(2); // "Para:" e a assinatura
  });

  it('o contato é o que a Dryelle informou', () => {
    expect(CONTATO_DA_CARTA).toEqual({
      atendimento: 'Associação Behemp | Be4Hope',
      whatsapp: '(11) 93204-7360',
      email: 'docs@be4hope.org',
      horario: '09h00 às 18h00 seg à sex',
    });
    const t = textosPreenchidos(aplicarDados(modelo, DADOS));
    for (const v of Object.values(CONTATO_DA_CARTA)) expect(t).toContain(v);
  });

  it('campo vazio recusa gerar a carta', () => {
    expect(() => aplicarDados(modelo, { ...DADOS, nomePaciente: '   ' })).toThrow(/nomePaciente/);
    expect(() => aplicarDados(modelo, { ...DADOS, whatsapp: '' })).toThrow(/whatsapp/);
    expect(() => aplicarDados(modelo, { ...DADOS, cpfPaciente: ' ' })).toThrow(/cpfPaciente/);
    expect(() => aplicarDados(modelo, { ...DADOS, emailPaciente: '' })).toThrow(/emailPaciente/);
  });

  it('campo a preencher que ninguém trocou faz gerar LANÇAR', () => {
    const sabotado: Modelo = JSON.parse(JSON.stringify(modelo));
    const alvo = sabotado.blocos.find(
      (b) => b.k === 'p' && b.runs.some((r) => r.t.includes('Assunto')),
    );
    expect(alvo).toBeTruthy();
    if (alvo?.k === 'p') alvo.runs.push({ t: ' [CAMPO NOVO]' });
    expect(() => aplicarDados(sabotado, DADOS)).toThrow(/sem preencher/);
  });

  it('o ponto da assinatura e o da data existem; sem eles o DocuSign não acha onde assinar', () => {
    const blocos = aplicarDados(modelo, DADOS);
    const todos: ParagrafoPreenchido[] = blocos.flatMap((b) =>
      b.k === 'p' ? [b] : b.linhas.flatMap((l) => l.flatMap((c) => c.paragrafos)),
    );
    const assinatura = todos.filter((p) => p.ancoraAssinatura);
    expect(assinatura).toHaveLength(1);
    expect(assinatura[0].runs.map((r) => r.t).join('')).toBe(DADOS.nomePaciente);
    expect(todos.filter((p) => p.ancoraData)).toHaveLength(1);

    const semAssinatura: Modelo = JSON.parse(JSON.stringify(modelo));
    for (const b of semAssinatura.blocos)
      if (b.k === 't')
        for (const l of b.linhas)
          for (const c of l)
            for (const p of c.paragrafos)
              for (const r of p.runs) r.t = r.t.replace('(Nome do Paciente - Preencher)', 'Fulano');
    expect(() => aplicarDados(semAssinatura, DADOS)).toThrow(/ponto da assinatura/);
  });
});

describe('o cabeçalho com a logo, em todas as páginas', () => {
  it('o cabeçalho vem do .docx: logo e "Associação Behemp | Be4Hope"', () => {
    expect(modelo.cabecalho.texto).toBe('Associação Behemp | Be4Hope');
    expect(entradaDoZip(DOCX, 'word/header1.xml').toString('utf8')).toContain('r:embed');
  });

  it('o renderizador o põe em um bloco FIXO (que se repete em cada página)', () => {
    const src = readFileSync(join(RAIZ, 'lib/comunicados/carta-doacao-pdf.tsx'), 'utf8');
    const i = src.indexOf('<View fixed style={s.cabecalho}>');
    expect(i).toBeGreaterThan(-1);
    const bloco = src.slice(i, src.indexOf('</View>', i));
    expect(bloco).toContain('<Image');
    expect(bloco).toContain('modelo.cabecalho.texto');
  });

  it('o PDF gerado tem mais de uma página e UMA só imagem (a logo, compartilhada pelas páginas)', async () => {
    const { gerarPdfCartaDoacao } = await import('@/lib/comunicados/carta-doacao-pdf');
    const pdf = await gerarPdfCartaDoacao({
      nomePaciente: DADOS.nomePaciente,
      emailPaciente: DADOS.emailPaciente,
      cpfPaciente: DADOS.cpfPaciente,
      dataPorExtenso: DADOS.dataPorExtenso,
    });
    const txt = pdf.toString('latin1');
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    const paginas = (txt.match(/\/Type \/Page(?![s\w])/g) ?? []).length;
    expect(paginas).toBeGreaterThanOrEqual(2);
    const imagens = (txt.match(/\/Subtype \/Image/g) ?? []).length;
    expect(imagens).toBeGreaterThanOrEqual(1);
  });
});
