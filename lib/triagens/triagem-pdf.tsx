/**
 * PDF DA TRIAGEM — o mesmo conteúdo do modal de detalhes de `/admin/triagens`, em papel.
 *
 * Nada além do que o modal mostra (sem o selo de status, que é controle interno da fila): nome, contato, idade, diagnóstico, data, os quatro
 * destaques (diagnóstico, urgência, estado, moradia) e os campos agrupados por seção, mais
 * "Outras informações". A ordem e os rótulos vêm de `rotulos-da-triagem.ts`, que espelha a tela.
 *
 * Mesmo motor do restante do produto (`@react-pdf/renderer`, sem navegador), por isso roda na
 * VPS sem dependência nova. Identidade da BeHemp/Be4Hope: laranja `#EA5429`, verde musgo
 * `#2D4F3C`, creme `#F5F2ED` e a logo `public/logo.png` — os tokens de `app/globals.css`.
 *
 * ⚠️ NUNCA ponha `lineHeight` no `Page` nem num container. O react-pdf herda o valor e o
 * MULTIPLICA a cada relayout; "Página X de Y" (`render`) dispara o relayout, e 1.4 vira 1e21
 * ("unsupported number: 4.5e+21") assim que o conteúdo passa de uma página. Medido em
 * 19/10/2026, por bisseção. Fica só nos estilos de texto folha.
 *
 * Tamanho: resposta longa (histórico de tratamentos, relato) divide entre páginas; campo curto é
 * indivisível, e o título de seção nunca fica sozinho no pé da página (`minPresenceAhead`).
 */
import React from 'react';
import {
  Document,
  Image as ImagemPdf,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from '@react-pdf/renderer';

import type { triagens } from '@/db/schema';
import { calcularIdade, formatarDataHora, limparTexto } from '@/lib/triagens/ficha-formatos';
import {
  CAMPOS_INTERNOS_DA_TRIAGEM,
  SECOES_DA_TRIAGEM,
  rotuloDoCampo,
  valorLegivelDaTriagem,
} from '@/lib/triagens/rotulos-da-triagem';

export type TriagemParaPdf = typeof triagens.$inferSelect;

const COR = {
  primaria: '#EA5429',
  primariaSuave: '#FCE9E2',
  verde: '#2D4F3C',
  verdeSuave: '#E6EEE9',
  creme: '#F5F2ED',
  texto: '#1A1612',
  mudo: '#6B645C',
  borda: '#E3DCD1',
  violetaSuave: '#EDE9FE',
  violeta: '#6D28D9',
} as const;

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: COR.texto,
    paddingTop: 62,
    paddingBottom: 54,
    paddingHorizontal: 40,
  },
  cabecalhoCorrente: {
    position: 'absolute',
    top: 22,
    left: 40,
    right: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cabecalhoMiolo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: COR.borda,
    paddingBottom: 6,
  },
  cabecalhoLogo: { width: 20, height: 17 },
  cabecalhoTexto: { fontSize: 8, color: COR.mudo },
  cabecalhoNome: { fontFamily: 'Helvetica-Bold', fontSize: 8, color: COR.texto },
  rodapeTexto: { position: 'absolute', bottom: 22, left: 40, fontSize: 7.5, color: COR.mudo },
  rodapePagina: { position: 'absolute', bottom: 22, right: 40, fontSize: 7.5, color: COR.mudo },

  capa: {
    backgroundColor: COR.creme,
    borderRadius: 8,
    borderTopWidth: 5,
    borderTopColor: COR.primaria,
    padding: 18,
    marginBottom: 14,
  },
  capaTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  capaLogo: { width: 52, height: 45 },
  capaTipo: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    letterSpacing: 1.6,
    color: COR.primaria,
    textAlign: 'right',
  },
  capaTipoSub: { fontSize: 8, color: COR.mudo, textAlign: 'right', marginTop: 2 },
  selos: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 14 },
  selo: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
    paddingVertical: 2.5,
    paddingHorizontal: 7,
    borderRadius: 8,
    marginRight: 5,
  },
  nome: { fontFamily: 'Helvetica-Bold', fontSize: 24, marginTop: 8 },
  contatos: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  contato: { fontSize: 9.5, color: COR.mudo, marginRight: 16, marginBottom: 2 },
  capaMeta: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COR.borda,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  capaMetaTexto: { fontSize: 8, color: COR.mudo },

  destaques: { flexDirection: 'row', marginBottom: 6 },
  destaque: {
    flex: 1,
    backgroundColor: COR.creme,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginRight: 6,
  },
  destaqueUltimo: { marginRight: 0 },
  destaqueRotulo: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    letterSpacing: 1,
    color: COR.mudo,
    textTransform: 'uppercase',
  },
  destaqueValor: { fontFamily: 'Helvetica-Bold', fontSize: 10, marginTop: 3, lineHeight: 1.3 },

  secaoTitulo: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: COR.primaria,
    paddingBottom: 5,
    marginBottom: 8,
    marginTop: 14,
  },
  secaoMarca: {
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: COR.primaria,
    marginRight: 8,
  },
  secaoNome: { fontFamily: 'Helvetica-Bold', fontSize: 13, color: COR.verde },

  grade: { flexDirection: 'row', flexWrap: 'wrap' },
  campo: { width: '50%', paddingRight: 10, paddingBottom: 8 },
  campoLargo: { width: '100%', paddingRight: 0 },
  campoCaixa: {
    backgroundColor: COR.creme,
    borderRadius: 6,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  campoRotulo: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    letterSpacing: 0.9,
    color: COR.mudo,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  campoValor: { fontSize: 10, lineHeight: 1.4 },
});

type Par = [rotulo: string, valor: string];

/** Link do store de arquivos abre RG/receita SEM autenticação; um PDF é cópia que anda. */
function valorDoCampo(valor: unknown): string {
  return valorLegivelDaTriagem(valor).replace(
    /https?:\/\/[^\s]*blob\.vercel-storage\.com[^\s]*/gi,
    '[arquivo guardado no sistema]',
  );
}

const dadosDe = (t: TriagemParaPdf) => t.dados as Record<string, unknown>;

/** Primeiro valor legível entre as chaves — o formulário novo e a importação legada divergem. */
function primeiro(dados: Record<string, unknown>, chaves: string[]): string {
  for (const c of chaves) {
    const v = valorLegivelDaTriagem(dados[c]);
    if (v) return v;
  }
  return '';
}

/** Nome que dá título ao documento e ao arquivo. */
export function nomeDaTriagem(t: TriagemParaPdf): string {
  return (
    t.nomeContato?.trim() ||
    primeiro(dadosDe(t), ['nome_paciente', 'Nome completo do Paciente:', 'Nome do paciente']) ||
    'Paciente sem nome'
  );
}

function Sub({ titulo }: { titulo: string }) {
  return (
    <View style={s.secaoTitulo} minPresenceAhead={80}>
      <View style={s.secaoMarca} />
      <Text style={s.secaoNome}>{limparTexto(titulo)}</Text>
    </View>
  );
}

function Campos({ itens }: { itens: Par[] }) {
  return (
    <View style={s.grade}>
      {itens.map(([rotulo, valor]) => {
        const largo = valor.length > 80 || valor.includes('\n');
        return (
          <View
            key={rotulo}
            style={largo ? [s.campo, s.campoLargo] : s.campo}
            // Resposta longa pode dividir entre páginas; o resto não racha.
            wrap={valor.length > 500}
          >
            <View style={s.campoCaixa}>
              <Text style={s.campoRotulo}>{limparTexto(rotulo)}</Text>
              <Text style={s.campoValor}>{limparTexto(valor)}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Capa({
  t,
  logo,
  geradaPor,
  geradaEm,
}: {
  t: TriagemParaPdf;
  logo: Buffer | null;
  geradaPor: string;
  geradaEm: Date;
}) {
  const dados = dadosDe(t);
  const importada = Boolean(valorLegivelDaTriagem(dados._formulario));
  const idade = calcularIdade(primeiro(dados, ['data_nascimento', 'Data de nascimento:']));
  const patologia = primeiro(dados, [
    'diagnostico_principal',
    'Diagnóstico principal: ',
    'Patologia do paciente',
    'Patologia',
  ]);
  const contatos = [
    t.emailContato,
    t.telefoneContato,
    idade !== null ? `${idade} anos` : '',
    patologia,
    formatarDataHora(t.createdAt),
  ].filter((x): x is string => Boolean(x));

  return (
    <View style={s.capa}>
      <View style={s.capaTopo}>
        {logo ? <ImagemPdf src={{ data: logo, format: 'png' }} style={s.capaLogo} /> : <Text />}
        <View>
          <Text style={s.capaTipo}>FICHA DE TRIAGEM</Text>
          <Text style={s.capaTipoSub}>Be4Hope · BeHemp</Text>
        </View>
      </View>
      {importada ? (
        <View style={s.selos}>
          <Text style={[s.selo, { backgroundColor: COR.violetaSuave, color: COR.violeta }]}>
            Importado · Elementor
          </Text>
        </View>
      ) : null}
      <Text style={s.nome}>{limparTexto(nomeDaTriagem(t))}</Text>
      <View style={s.contatos}>
        {contatos.map((c) => (
          <Text key={c} style={s.contato}>
            {limparTexto(c)}
          </Text>
        ))}
      </View>
      <View style={s.capaMeta}>
        <Text style={s.capaMetaTexto}>Gerada em {formatarDataHora(geradaEm)}</Text>
        <Text style={s.capaMetaTexto}>Por {limparTexto(geradaPor)}</Text>
      </View>
    </View>
  );
}

function TriagemDocument({
  t,
  logo,
  geradaPor,
  geradaEm,
}: {
  t: TriagemParaPdf;
  logo: Buffer | null;
  geradaPor: string;
  geradaEm: Date;
}) {
  const dados = dadosDe(t);
  const nome = nomeDaTriagem(t);

  const destaques = [
    {
      rotulo: 'Diagnóstico',
      valor: primeiro(dados, [
        'diagnostico_principal',
        'Diagnóstico principal: ',
        'Patologia do paciente',
        'Patologia',
      ]),
    },
    { rotulo: 'Urgência', valor: primeiro(dados, ['nivel_tratamento', 'Tratamento:']) },
    { rotulo: 'Estado', valor: primeiro(dados, ['estado', 'Estado:', 'Estado']) },
    { rotulo: 'Moradia', valor: primeiro(dados, ['condicao_moradia', 'Condições de Moradia']) },
  ].filter((x) => x.valor);

  const mapeados = new Set(SECOES_DA_TRIAGEM.flatMap((x) => x.campos));
  const extras = Object.keys(dados).filter(
    (k) =>
      !mapeados.has(k) && !CAMPOS_INTERNOS_DA_TRIAGEM.has(k) && valorLegivelDaTriagem(dados[k]),
  );

  const secoes = SECOES_DA_TRIAGEM.map((sec) => ({
    titulo: sec.titulo,
    itens: sec.campos
      .map((c): Par => [rotuloDoCampo(c), valorDoCampo(dados[c])])
      .filter(([, v]) => v),
  })).filter((sec) => sec.itens.length > 0);
  if (extras.length > 0) {
    secoes.push({
      titulo: 'Outras informações',
      itens: extras.map((c): Par => [rotuloDoCampo(c), valorDoCampo(dados[c])]),
    });
  }

  return (
    <Document
      title={`Triagem — ${limparTexto(nome)}`}
      author="Be4Hope · BeHemp"
      subject="Ficha de triagem"
    >
      <Page size="A4" style={s.page} wrap>
        {/* Cabeçalho corrente: some na primeira página, que tem a capa. */}
        <View
          fixed
          style={s.cabecalhoCorrente}
          render={({ pageNumber }) =>
            pageNumber === 1 ? (
              <View />
            ) : (
              <View style={s.cabecalhoMiolo}>
                {logo ? (
                  <ImagemPdf src={{ data: logo, format: 'png' }} style={s.cabecalhoLogo} />
                ) : (
                  <Text />
                )}
                <Text style={s.cabecalhoTexto}>
                  Triagem · <Text style={s.cabecalhoNome}>{limparTexto(nome)}</Text>
                </Text>
              </View>
            )
          }
        />

        <Capa t={t} logo={logo} geradaPor={geradaPor} geradaEm={geradaEm} />

        {destaques.length > 0 ? (
          <View style={s.destaques} wrap={false}>
            {destaques.map((d, i) => (
              <View
                key={d.rotulo}
                style={i === destaques.length - 1 ? [s.destaque, s.destaqueUltimo] : s.destaque}
              >
                <Text style={s.destaqueRotulo}>{d.rotulo}</Text>
                <Text style={s.destaqueValor}>{limparTexto(d.valor)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {secoes.map((sec) => (
          <React.Fragment key={sec.titulo}>
            <Sub titulo={sec.titulo} />
            <Campos itens={sec.itens} />
          </React.Fragment>
        ))}

        <Text fixed style={s.rodapeTexto}>
          Documento confidencial · contém dados pessoais sensíveis de saúde (LGPD, art. 11)
        </Text>
        <Text
          fixed
          style={s.rodapePagina}
          render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
        />
      </Page>
    </Document>
  );
}

/** Gera o PDF. `logo` é o `public/logo.png` já lido; `null` gera o documento sem a marca. */
export async function gerarPdfDaTriagem(
  t: TriagemParaPdf,
  geradaPor: string,
  logo: Buffer | null,
): Promise<Buffer> {
  const blob = await pdf(
    <TriagemDocument t={t} logo={logo} geradaPor={geradaPor} geradaEm={new Date()} />,
  ).toBlob();
  return Buffer.from(await blob.arrayBuffer());
}
