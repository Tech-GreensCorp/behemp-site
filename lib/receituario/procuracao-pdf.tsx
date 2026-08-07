/**
 * Gerador de PDF da Procuração Específica Be4Hope.
 * Usa @react-pdf/renderer — sem Chrome, sem browser.
 * Funciona em qualquer ambiente: Vercel, AWS Lambda, EC2, Docker.
 *
 * Layout baseado no documento oficial Be4Hope verificado página a página.
 * Ver: docs/DECISOES_TECNICAS.md DT-001
 */

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from '@react-pdf/renderer';

// Estilos idênticos ao documento original Be4Hope
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Times-Roman',
    fontSize: 11,
    lineHeight: 1.6,
    color: '#000000',
    paddingTop: 60,
    paddingBottom: 80,
    paddingHorizontal: 72, // ~2.5cm cada lado
  },
  titulo: {
    fontSize: 13,
    fontFamily: 'Times-Bold',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  subtitulo: {
    fontSize: 10,
    textAlign: 'center',
    marginBottom: 24,
  },
  secao: {
    fontSize: 11,
    fontFamily: 'Times-Bold',
    marginTop: 16,
    marginBottom: 6,
  },
  paragrafo: {
    fontSize: 11,
    textAlign: 'justify',
    marginBottom: 8,
    lineHeight: 1.6,
  },
  listaContainer: {
    marginTop: 4,
    marginBottom: 10,
    paddingLeft: 16,
  },
  listaItem: {
    fontSize: 11,
    textAlign: 'justify',
    marginBottom: 8,
    lineHeight: 1.6,
  },
  dataLocal: {
    fontSize: 11,
    marginTop: 16,
    marginBottom: 50,
  },
  assinaturaTitulo: {
    fontSize: 11,
    fontFamily: 'Times-Bold',
    marginBottom: 60,
  },
  linhaAssinatura: {
    borderTopWidth: 1,
    borderTopColor: '#000000',
    width: 280,
    alignSelf: 'center',
    marginBottom: 8,
  },
  assinaturaInfo: {
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 1.8,
  },
  rodape: {
    position: 'absolute',
    bottom: 30,
    left: 72,
    right: 72,
    textAlign: 'center',
    fontSize: 8,
    lineHeight: 1.5,
    color: '#000000',
  },
  rodapeNegrito: {
    fontFamily: 'Times-Bold',
    fontSize: 8,
  },
  rodapeLaranja: {
    color: '#EA5429',
    fontSize: 8,
  },
});

export interface DadosProcuracao {
  nomeCompleto: string;
  nacionalidade: string;
  estadoCivil: string;
  profissao: string;
  rg: string;
  cpf: string;
  email: string;
  telefone: string;
  endereco: string;
  cep: string;
  cidade: string;
  uf: string;
  dia: string;
  mes: string;
  ano: string;
}

// Componente do Rodapé (reutilizado nas duas páginas)
const Rodape = () => (
  <View style={styles.rodape}>
    <Text style={styles.rodapeNegrito}>
      Associação Behemp de Desenvolvimento Pesquisa e Fomento em Cannabis no Brasil
    </Text>
    <Text>R. Gomes de Carvalho, 1629, Vila Olímpia - São Paulo</Text>
    <Text>www.be4hope.org  -  contato@be4hope.org</Text>
    <Text style={styles.rodapeLaranja}>be.4hope</Text>
  </View>
);

// Componente principal do documento
const ProcuracaoDocument = ({ dados }: { dados: DadosProcuracao }) => (
  <Document
    title="Procuração Específica Be4Hope"
    author="Be4Hope"
    subject="Autorização para solicitação de uso de produtos à base de canabidiol via GOV.BR/ANVISA"
  >
    {/* PÁGINA 1 */}
    <Page size="A4" style={styles.page}>
      <Text style={styles.titulo}>PROCURAÇÃO</Text>
      <Text style={styles.subtitulo}>
        (Autorização para solicitação de uso de produtos à base de canabidiol via GOV.BR/ANVISA)
      </Text>

      <Text style={styles.secao}>OUTORGANTE</Text>
      <Text style={styles.paragrafo}>
        {dados.nomeCompleto}, {dados.nacionalidade || 'brasileiro(a)'},{' '}
        {dados.estadoCivil || '[estado civil]'},{' '}
        {dados.profissao || '[profissão]'}, RG nº {dados.rg || '[________]'}, CPF nº{' '}
        {dados.cpf || '[________]'}, e-mail {dados.email}, telefone{' '}
        {dados.telefone || '[________]'}, residente à{' '}
        {dados.endereco || '[endereço completo]'}, CEP {dados.cep || '[________]'}.
      </Text>

      <Text style={styles.secao}>OUTORGADO</Text>
      <Text style={styles.paragrafo}>
        ASSOCIAÇÃO BEHEMP DE DESENVOLVIMENTO, PESQUISA E FOMENTO EM CANNABIS NO BRASIL – ABH,
        CNPJ nº 07.578.940/0001-01, com sede na R. Gomes de Carvalho, 1629 – Vila Olímpia –
        São Paulo/SP, e-mail contato@be4hope.org, doravante denominada ASSOCIAÇÃO.
      </Text>

      <Text style={styles.secao}>OBJETO</Text>
      <Text style={styles.paragrafo}>
        A presente procuração tem por objeto outorgar poderes específicos à ASSOCIAÇÃO para
        emitir/solicitar a autorização da ANVISA para uso de produtos à base de canabidiol por
        meio do acesso GOV.BR do Outorgante (ou, se menor, do Representante Legal),
        exclusivamente para fins de tratamento de saúde, nos termos da regulamentação sanitária
        aplicável.
      </Text>

      <Text style={styles.secao}>PODERES ESPECÍFICOS</Text>
      <View style={styles.listaContainer}>
        <Text style={styles.listaItem}>
          1.  Acessar e operar a conta GOV.BR do Outorgante, exclusivamente para solicitar, emitir,
          renovar e acompanhar autorização sanitária perante a ANVISA para produtos à base de
          canabidiol;
        </Text>
        <Text style={styles.listaItem}>
          2.  Preencher, anexar e protocolar formulários, requerimentos, receitas e demais documentos
          necessários à solicitação/renovação da autorização, inclusive assinar eletronicamente
          quando cabível;
        </Text>
        <Text style={styles.listaItem}>
          3.  Acompanhar o processo administrativo, receber comunicações e intimações, prestar
          esclarecimentos e corrigir/complementar informações;
        </Text>
        <Text style={styles.listaItem}>
          4.  Obter cópias e certidões relacionadas ao processo e compartilhar documentos com
          profissionais de saúde vinculados ao tratamento, observada a confidencialidade.
        </Text>
      </View>

      <Rodape />
    </Page>

    {/* PÁGINA 2 */}
    <Page size="A4" style={styles.page}>
      <Text style={styles.paragrafo}>
        Limitação: Os poderes ora concedidos restringem-se ao objetivo descrito neste instrumento,
        vedado qualquer uso para finalidades diversas.
      </Text>

      <Text style={styles.secao}>PROTEÇÃO DE DADOS</Text>
      <Text style={styles.paragrafo}>
        O Outorgante autoriza o tratamento dos dados pessoais e documentos estritamente necessários
        ao trâmite do pedido junto à ANVISA e ao GOV.BR, nos termos da legislação aplicável,
        exclusivamente para a finalidade desta procuração.
      </Text>

      <Text style={styles.secao}>VALIDADE</Text>
      <Text style={styles.paragrafo}>
        Esta procuração é válida por 24 (vinte e quatro) meses contados da data de assinatura,
        expirando automaticamente ao término desse prazo. Poderá ser revogada a qualquer tempo,
        mediante comunicação por escrito à ASSOCIAÇÃO.
      </Text>

      <Text style={styles.dataLocal}>
        {dados.cidade}/{dados.uf}, {dados.dia} de {dados.mes} de {dados.ano}.
      </Text>

      <Text style={styles.assinaturaTitulo}>
        ASSINATURA DO OUTORGANTE (ou do REPRESENTANTE LEGAL, se menor):
      </Text>

      <View style={styles.linhaAssinatura} />
      <Text style={styles.assinaturaInfo}>Nome: {dados.nomeCompleto}</Text>
      <Text style={styles.assinaturaInfo}>CPF: {dados.cpf || ''}</Text>

      <Rodape />
    </Page>
  </Document>
);

/**
 * Gera o PDF da Procuração Específica como Buffer.
 * Funciona em qualquer ambiente Node.js sem Chrome.
 */
export async function gerarPdfProcuracao(dados: DadosProcuracao): Promise<Buffer> {
  const blob = await pdf(<ProcuracaoDocument dados={dados} />).toBlob();
  const arrayBuffer = await blob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
