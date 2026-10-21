/**
 * PDF da carta "Atualização do Programa de Doação" (Comunicado nº 001/2026).
 *
 * 🔴 O TEXTO NÃO MORA AQUI. Ele vem do .docx aprovado (`modelo/CARTA-PACIENTES-DOACAO_VF.docx`),
 * extraído para `modelo/carta-doacao.json` por `scripts/gerar-modelo-da-carta.ts`. Este arquivo
 * só DESENHA: tabelas, caixas, listas e o cabeçalho com a logo, que se repete em TODAS as páginas.
 * O guarda `o-comunicado-assina-so-pelo-docusign` compara o texto do PDF com o do .docx.
 *
 * Mesmo motor do restante do produto (`@react-pdf/renderer`, sem navegador), por isso roda na VPS.
 *
 * A assinatura NÃO é desenhada aqui: o DocuSign procura as âncoras de texto (`ANCORA_*`), impressas
 * em branco, e põe o campo de assinatura em cima delas.
 */
import React from 'react';
import { Document, Image, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';

import {
  aplicarDados,
  type DadosDaCarta,
  type ParagrafoPreenchido,
} from '@/lib/comunicados/carta-doacao-dados';
import { ANCORA_ASSINATURA, ANCORA_DATA, CONTATO_DA_CARTA } from '@/lib/comunicados/catalogo';
import type { Bloco, Celula, Modelo, Run } from '@/lib/comunicados/docx-para-modelo';
import modeloJson from '@/lib/comunicados/modelo/carta-doacao.json';
import { LOGO_JPG_BASE64 } from '@/lib/comunicados/modelo/logo';

const modelo = modeloJson as unknown as Modelo;

/** Twips (vigésimos de ponto) → pontos. */
const pt = (twips: number) => twips / 20;

/** O Word grava `sz` em meios-pontos; sem `sz`, o padrão do documento é 10 pt. */
const TAMANHO_PADRAO = 10;
const TAMANHO_TITULO3 = 12;

/** Arial → Helvetica (a fonte padrão do PDF que se parece com ela). */
const fonte = (r: Run) =>
  r.b && r.i
    ? 'Helvetica-BoldOblique'
    : r.b
      ? 'Helvetica-Bold'
      : r.i
        ? 'Helvetica-Oblique'
        : 'Helvetica';

const estiloDoRun = (r: Run, padrao: number) => ({
  fontFamily: fonte(r),
  fontSize: r.sz ? r.sz / 2 : padrao,
  ...(r.c ? { color: `#${r.c}` } : {}),
  ...(r.u ? { textDecoration: 'underline' as const } : {}),
});

const s = StyleSheet.create({
  pagina: {
    fontFamily: 'Helvetica',
    fontSize: TAMANHO_PADRAO,
    color: '#000000',
    // o cabeçalho fixo ocupa o topo de toda página
    paddingTop: 128,
    paddingBottom: pt(modelo.pagina.margemInf),
    paddingLeft: pt(modelo.pagina.margemEsq),
    paddingRight: pt(modelo.pagina.margemDir),
  },
  cabecalho: {
    position: 'absolute',
    top: 32,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  logo: { width: 82.5, height: 57 },
  nomeNoCabecalho: { marginTop: 4, textAlign: 'center' },
  ancora: { fontSize: 1, color: '#FFFFFF' },
});

function Paragrafo({ p }: { p: ParagrafoPreenchido }) {
  const padrao = p.titulo3 ? TAMANHO_TITULO3 : TAMANHO_PADRAO;
  const vazio = p.runs.length === 0;
  const texto = (
    <Text
      style={{
        textAlign: p.jc === 'both' ? 'justify' : (p.jc ?? 'left'),
        // linha "auto" 300 do Word = 1,25 × a linha simples (~1,15 × o corpo)
        lineHeight: p.linha ? (p.linha / 240) * 1.15 : 1.15,
        fontSize: padrao,
      }}
    >
      {vazio ? (
        p.ancoraData ? (
          <Text style={s.ancora}>{ANCORA_DATA}</Text>
        ) : (
          ' '
        )
      ) : (
        p.runs.map((r, i) => (
          <Text key={i} style={estiloDoRun(r, padrao)}>
            {r.t}
          </Text>
        ))
      )}
    </Text>
  );

  return (
    <View
      wrap={p.titulo3 ? false : undefined}
      minPresenceAhead={p.titulo3 ? 40 : undefined}
      style={{
        marginTop: p.antes ? pt(p.antes) : 0,
        marginBottom: p.depois ? pt(p.depois) : 0,
        ...(p.recuo && !p.marcador ? { paddingLeft: pt(p.recuo) } : {}),
        ...(p.bordaInferior
          ? {
              borderBottomWidth: p.bordaInferior.espessura / 8,
              borderBottomColor: `#${p.bordaInferior.cor}`,
              paddingBottom: 8,
            }
          : {}),
      }}
    >
      {p.ancoraAssinatura && (
        // espaço para o campo de assinatura, com a âncora em branco no topo
        <View style={{ height: 40 }}>
          <Text style={s.ancora}>{ANCORA_ASSINATURA}</Text>
        </View>
      )}
      {p.marcador ? (
        <View style={{ flexDirection: 'row', paddingLeft: p.recuo ? pt(p.recuo) - 12 : 0 }}>
          {/* "●" do Word não existe na fonte padrão do PDF; "•" existe */}
          <Text style={{ width: 12, fontSize: 10, lineHeight: 1.44 }}>•</Text>
          <View style={{ flex: 1 }}>{texto}</View>
        </View>
      ) : (
        texto
      )}
    </View>
  );
}

function CelulaDaTabela({ c }: { c: Celula }) {
  return (
    <View
      style={{
        width: pt(c.w),
        paddingVertical: 2,
        paddingHorizontal: 5.4,
        ...(c.fundo ? { backgroundColor: `#${c.fundo}` } : {}),
      }}
    >
      {c.paragrafos.map((p, i) => (
        <Paragrafo key={i} p={p as ParagrafoPreenchido} />
      ))}
    </View>
  );
}

/**
 * Uma coluna que não tem texto nenhum (o Word a usa de respiro) encolhe, e a largura que sobra vai
 * para a última coluna — sem isso "R$ 250,00 / mês" quebra em duas linhas no quadro do exemplo.
 */
const textoDaCelula = (c: Celula) =>
  c.paragrafos.map((p) => p.runs.map((r) => r.t).join('')).join(' ');

function larguras(linhas: Celula[][]): number[] {
  // O quadro do cabeçalho agora leva nome, e-mail e CPF na 2ª coluna; a 4ª só tem "Programa de
  // Doação" e a data. Alarga a 2ª para o e-mail não quebrar no meio (a soma continua 9600 twips).
  if (linhas[0]?.length === 4 && /^Comunicado/.test(textoDaCelula(linhas[0][0]))) {
    return [1815, 4085, 1300, 2400];
  }
  const n = Math.max(...linhas.map((l) => l.length));
  const base = Array.from({ length: n }, (_, j) => linhas[0]?.[j]?.w ?? 0);
  const vazia = base.map((_, j) =>
    linhas.every((l) => (l[j]?.paragrafos ?? []).every((p) => p.runs.every((r) => !r.t.trim()))),
  );
  if (!vazia.some(Boolean) || vazia[n - 1]) return base;
  const novas = base.map((w, j) => (vazia[j] ? w * 0.25 : w));
  novas[n - 1] += base.reduce((acc, w, j) => acc + (vazia[j] ? w * 0.75 : 0), 0);
  return novas;
}

function BlocoDoModelo({ b }: { b: Bloco }) {
  if (b.k === 'p') return <Paragrafo p={b as ParagrafoPreenchido} />;
  const colunas = larguras(b.linhas);
  return (
    // Quadro curto não se parte entre duas páginas (a linha "Após assinar" ficava sozinha).
    <View wrap={b.linhas.length > 4 ? undefined : false} style={{ marginBottom: 8 }}>
      {b.linhas.map((linha, i) => (
        <View key={i} wrap={false} style={{ flexDirection: 'row' }}>
          {linha.map((c, j) => (
            <CelulaDaTabela key={j} c={{ ...c, w: colunas[j] ?? c.w }} />
          ))}
        </View>
      ))}
    </View>
  );
}

function CartaDocument({ blocos }: { blocos: Bloco[] }) {
  const logo = Buffer.from(LOGO_JPG_BASE64, 'base64');
  return (
    <Document title="Atualização do Programa de Doação" author="Associação Behemp | Be4Hope">
      <Page size="A4" style={s.pagina}>
        {/* Logo e nome da Behemp no topo de TODAS as páginas */}
        <View fixed style={s.cabecalho}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- `Image` do @react-pdf/renderer, não é <img>: PDF não tem atributo alt */}
          <Image src={{ data: logo, format: 'jpg' }} style={s.logo} />
          <Text
            style={[
              s.nomeNoCabecalho,
              {
                fontFamily: 'Helvetica-Bold',
                fontSize: modelo.cabecalho.sz / 2,
                color: `#${modelo.cabecalho.cor}`,
              },
            ]}
          >
            {modelo.cabecalho.texto}
          </Text>
        </View>

        {blocos.map((b, i) => (
          <BlocoDoModelo key={i} b={b} />
        ))}
      </Page>
    </Document>
  );
}

/** Gera o PDF do comunicado, com o nome do paciente, a data do envio e o contato da Behemp. */
export async function gerarPdfCartaDoacao(dados: {
  nomePaciente: string;
  emailPaciente: string;
  cpfPaciente: string;
  dataPorExtenso: string;
}): Promise<Buffer> {
  const blocos = aplicarDados(modelo, {
    nomePaciente: dados.nomePaciente,
    emailPaciente: dados.emailPaciente,
    cpfPaciente: dados.cpfPaciente,
    dataPorExtenso: dados.dataPorExtenso,
    ...CONTATO_DA_CARTA,
  } satisfies DadosDaCarta);
  const blob = await pdf(<CartaDocument blocos={blocos} />).toBlob();
  return Buffer.from(await blob.arrayBuffer());
}
