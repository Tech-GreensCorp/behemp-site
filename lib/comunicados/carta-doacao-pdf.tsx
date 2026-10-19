/**
 * PDF da carta "Atualização do Programa de Doação" (Comunicado nº 001/2026).
 *
 * Texto transcrito de CARTA-PACIENTES-DOACAO.docx. Só três coisas mudam por paciente: a data, o
 * nome e a assinatura — o resto é o comunicado como foi aprovado. Mesmo motor do restante do
 * produto (`@react-pdf/renderer`, sem navegador), por isso roda na VPS sem dependência nova.
 *
 * A assinatura NÃO é desenhada aqui: o DocuSign procura as âncoras de texto (`ANCORA_*`), que são
 * impressas em branco, e põe o campo de assinatura em cima delas.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';

import {
  ANCORA_ASSINATURA,
  ANCORA_DATA,
  CONTATO_DA_CARTA,
  NUMERO_DO_COMUNICADO,
} from '@/lib/comunicados/catalogo';

const COR = '#EA5429';

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10.5,
    lineHeight: 1.55,
    color: '#1a1a1a',
    paddingTop: 48,
    paddingBottom: 64,
    paddingHorizontal: 56,
  },
  cabecalho: { borderBottomWidth: 2, borderBottomColor: COR, paddingBottom: 8, marginBottom: 14 },
  programa: { fontFamily: 'Helvetica-Bold', fontSize: 15, color: COR },
  meta: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 2 },
  metaRotulo: { fontFamily: 'Helvetica-Bold', width: 86 },
  assunto: { fontFamily: 'Helvetica-Bold', fontSize: 12, marginTop: 8, marginBottom: 12 },
  p: { marginBottom: 8, textAlign: 'justify' },
  h2: { fontFamily: 'Helvetica-Bold', fontSize: 12, color: COR, marginTop: 12, marginBottom: 6 },
  negrito: { fontFamily: 'Helvetica-Bold' },
  exemplo: {
    borderWidth: 1,
    borderColor: '#e6d9d0',
    backgroundColor: '#faf5f1',
    borderRadius: 4,
    padding: 10,
    marginVertical: 8,
  },
  exemploLinha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e6d9d0',
  },
  etapa: { marginBottom: 6 },
  pergunta: { fontFamily: 'Helvetica-Bold', marginTop: 6 },
  assinaturaBloco: { marginTop: 18, alignItems: 'center' },
  linha: { borderTopWidth: 1, borderTopColor: '#000', width: 290, marginTop: 34, marginBottom: 4 },
  ancora: { fontSize: 1, color: '#FFFFFF' },
  nota: { fontSize: 8.5, color: '#444', textAlign: 'justify', marginTop: 14 },
  rodape: {
    position: 'absolute',
    bottom: 26,
    left: 56,
    right: 56,
    textAlign: 'center',
    fontSize: 8,
    color: '#555',
  },
});

export interface DadosCartaDoacao {
  nomePaciente: string;
  /** Data do envio, já formatada ("15 de outubro de 2026"). */
  dataPorExtenso: string;
}

function P({ children }: { children: React.ReactNode }) {
  return <Text style={s.p}>{children}</Text>;
}

function Linha({ a, b }: { a: string; b: string }) {
  return (
    <View style={s.exemploLinha}>
      <Text>{a}</Text>
      <Text style={s.negrito}>{b}</Text>
    </View>
  );
}

function CartaDocument({ dados }: { dados: DadosCartaDoacao }) {
  return (
    <Document title="Atualização do Programa de Doação" author="Associação Behemp | Be4Hope">
      <Page size="A4" style={s.page} wrap>
        <View style={s.cabecalho}>
          <Text style={s.programa}>Programa de Acesso Humanitário</Text>
        </View>

        <View style={s.meta}>
          <Text style={s.metaRotulo}>Comunicado nº:</Text>
          <Text>{NUMERO_DO_COMUNICADO}</Text>
        </View>
        <View style={s.meta}>
          <Text style={s.metaRotulo}>Data:</Text>
          <Text>{dados.dataPorExtenso}</Text>
        </View>
        <View style={s.meta}>
          <Text style={s.metaRotulo}>Para:</Text>
          <Text>{dados.nomePaciente}</Text>
        </View>
        <View style={s.meta}>
          <Text style={s.metaRotulo}>Programa:</Text>
          <Text>Programa de Doação</Text>
        </View>

        <Text style={s.assunto}>
          Assunto: Atualização do Programa de Doação — Transição para o Programa COLLAB
        </Text>

        <P>Querido(a) {dados.nomePaciente},</P>

        <P>
          Antes de qualquer coisa, queremos que você saiba: esta carta é escrita com muito carinho,
          e com a mesma sinceridade que sempre marcou a nossa relação com você e com sua família.
        </P>
        <P>
          Há anos caminhamos juntos. Desde o início do tratamento, a Behemp esteve ao seu lado,
          oferecendo tratamento de forma totalmente gratuita, sem nenhum custo para você. Foram
          meses, muitos deles anos, em que pudemos contribuir para que o tratamento acontecesse sem
          interrupção, sem barreiras financeiras, sem que o custo do remédio fosse um peso a mais
          numa rotina que já exige tanto.
        </P>
        <P>
          Isso foi possível porque, por muito tempo, tivemos uma parceria com o laboratório que nos
          permitia oferecer o tratamento a você como doação integral. E foi uma alegria enorme poder
          fazer isso, e sabemos o quanto isso significou para a continuidade do tratamento e para a
          qualidade de vida de cada paciente que acompanhamos.
        </P>
        <P>
          Só que essa parceria com o laboratório mudou. O acordo que nos permitia fornecer o
          medicamento sem custo não existe mais da mesma forma, e isso está fora do nosso controle.
          A partir de agora, existe um custo real do produto que precisa ser coberto — e, para que o
          tratamento de vocês não seja interrompido, precisamos contar com a colaboração de cada
          paciente.
        </P>
        <P>
          Queremos ser bem transparentes com você: o preço cheio desse medicamento no mercado é de
          R$ 1.190,00 por frasco. A Behemp não mediu esforços para negociar a melhor condição
          possível, e conseguimos fazer com que você pague apenas R$ 210,00 por frasco — ou seja,
          menos de 20% do valor real do produto. Todo o restante continua sendo absorvido pela nossa
          instituição, junto com o laboratório, para que o acesso ao tratamento continue sendo
          viável para você.
        </P>

        <Text style={s.h2}>Como vai funcionar</Text>
        <P>
          Vamos fazer um único envio para cobrir os 6 meses (o semestre) de tratamento — assim você
          não precisa se preocupar em ficar pedindo frasco a frasco.
        </P>
        <P>
          O valor cobrado é referente à quantidade total de frascos do seu semestre, ao preço de R$
          210,00 cada frasco.
        </P>
        <P>
          O frete desse envio único é de R$240,00 para pedidos de até 6 frascos. O valor total
          (frascos + frete) é dividido em 12 parcelas iguais (tratamento anual), pagas mensalmente
          via Pix, cartão de crédito (pode conter juros da operadora) ou boleto — para caber melhor
          no seu orçamento.
        </P>
        <P>
          Pra ficar bem fácil de entender, aqui vai um exemplo prático (paciente que toma 6 frascos
          por semestre no tratamento anual):
        </P>
        <View style={s.exemplo} wrap={false}>
          <Linha a="12 frascos × R$ 210,00" b="R$ 2.520,00" />
          <Linha a="+ 2 Fretes" b="R$ 480,00" />
          <Linha a="= Total do semestre" b="R$ 3.000,00" />
          <Linha a="÷ 12 parcelas mensais no Pix" b="R$ 250,00 / mês" />
        </View>
        <P>
          Assim que o seu envio for calculado, vamos te mandar o valor certinho, do jeitinho de
          vocês.
        </P>
        <P>
          Ou seja: nenhuma surpresa, nenhuma cobrança escondida. Você já vai saber exatamente quanto
          vai pagar por mês, com bastante antecedência, e sempre terá o suporte da nossa equipe para
          tirar qualquer dúvida.
        </P>

        <Text style={s.h2}>Um ponto muito importante</Text>
        <P>
          Esse valor não fica com a Behemp. Somos transparentes com você: o pagamento é feito
          diretamente com o laboratório, não conosco — é o custo real do produto subsidiado por
          eles, e nada mais. A nossa instituição continua trabalhando por você exatamente como
          sempre trabalhou: sem custo, com o mesmo propósito de sempre, cuidando do acompanhamento,
          da orientação e do suporte no seu tratamento.
        </P>
        <P>
          E as consultas de acompanhamento continuam gratuitas, exatamente como sempre foram. O
          paciente segue tendo direito a 2 consultas por ano — uma a cada 6 meses — sem nenhum
          custo, para garantir que o tratamento continue sendo acompanhado de perto. Existindo a
          necessidade de consultas extras, o valor será de R$ 90,00 pagos diretamente aos médicos
          parceiros e escolhidos por vocês.
        </P>
        <P>
          E para deixar tudo ainda mais fácil, vamos cuidar de te enviar, todo mês, o link de
          pagamento, com tudo o que você precisar para pagar sem complicação.
        </P>
        <P>
          Além disso, estamos aqui como avalistas desse processo: se em algum momento você não
          conseguir arcar com a parcela, não se preocupe — vamos te ajudar a encontrar uma solução,
          dar um tempo a mais, o que for preciso. Nosso foco continua sendo um só: que o tratamento
          não pare, e que o paciente continue bem.
        </P>
        <P>
          E tem mais uma boa notícia: quem passar a contribuir com o valor do medicamento não
          precisará mais pagar a contribuição mensal de apoio à Behemp. Isso mesmo — abrimos mão
          dessa contribuição para você, porque entendemos que, a partir de agora, o que está sendo
          direcionado é para o próprio tratamento. Não queremos que você pague duas vezes.
        </P>

        <Text style={s.h2}>O que acontece agora — linha do tempo</Text>
        <Text style={s.etapa}>
          <Text style={s.negrito}>Agora — </Text>
          Você recebe este comunicado. Manifesta ciência e estabelece contato com a BeHemp.
        </Text>
        <Text style={s.etapa}>
          <Text style={s.negrito}>Etapa 1 — </Text>
          Chega o Termo de Adesão do Programa COLLAB para assinatura e adesão (se você aderir ao
          tratamento conosco).
        </Text>
        <Text style={s.etapa}>
          <Text style={s.negrito}>Após assinar — </Text>
          Início do envio semestral e da primeira parcela, já com valor conhecido com antecedência.
        </Text>

        <Text style={s.h2}>Perguntas frequentes</Text>
        <Text style={s.pergunta}>P: E se eu não conseguir pagar uma parcela em algum mês?</Text>
        <P>
          R: Fique tranquilo(a). A Behemp atua como intermediadora desse processo: vamos te ajudar a
          encontrar uma solução, com mais tempo ou o que for preciso. O importante é conversar com a
          gente antes — o tratamento não será interrompido por isso.
        </P>
        <Text style={s.pergunta}>
          P: Se eu não aderir, o tratamento é interrompido imediatamente?
        </Text>
        <P>R: Não. Faremos o fornecimento por mais 1 mês.</P>
        <Text style={s.pergunta}>P: Posso cancelar minha participação depois da adesão?</Text>
        <P>
          R: Sim, a qualquer momento, mediante aviso prévio de 30 dias. Todavia, se os produtos já
          estiverem na sua posse e o tratamento em andamento, o pagamento proporcional deverá ser
          realizado (tendo em vista que são produtos importados não podemos aceitar qualquer tipo de
          devolução - nos termos da RDC 660/20 da Anvisa - uso pessoal, intransferível de produto
          importado).
        </P>
        <Text style={s.pergunta}>P: Os valores podem aumentar no meio do caminho?</Text>
        <P>
          R: Não e o valor do tratamento fica garantido por 12 meses, ou seja, estamos garantindo
          para vocês que não terão aumento no valor do tratamento durante 1 ano. Qualquer ajuste
          futuro será sempre comunicado com antecedência mínima de 30 dias.
        </P>

        <P>
          Sabemos que qualquer mudança assim pode gerar receio, e é por isso que queremos ser as
          pessoas mais claras e cuidadosas possíveis com você nesse momento. Foram muitos anos de
          doação — para muitos de vocês, anos de acesso gratuito ao tratamento — e esse tempo também
          foi precioso para que cada família pudesse se organizar e, aos poucos, passar a enxergar o
          tratamento como uma prioridade dentro do orçamento familiar, assim como qualquer outro
          cuidado essencial de saúde.
        </P>
        <P>
          O que estamos propondo hoje é, sinceramente, o máximo que conseguimos fazer para que o seu
          tratamento continue acontecendo sem nenhuma interrupção, com o menor custo possível e da
          forma mais leve possível para o seu orçamento. Continuamos, como sempre, ao seu lado.
        </P>

        <Text style={s.h2}>Fale com a gente</Text>
        <P>
          Qualquer dúvida, estamos aqui — pode nos chamar a qualquer momento, vamos explicar cada
          detalhe com toda a paciência do mundo, porque o mais importante para nós sempre foi, e
          continua sendo, você e a continuidade do seu tratamento.
        </P>
        <View wrap={false}>
          <View style={s.meta}>
            <Text style={s.metaRotulo}>Atendimento:</Text>
            <Text>{CONTATO_DA_CARTA.atendimento}</Text>
          </View>
          <View style={s.meta}>
            <Text style={s.metaRotulo}>WhatsApp:</Text>
            <Text>{CONTATO_DA_CARTA.whatsapp}</Text>
          </View>
          <View style={s.meta}>
            <Text style={s.metaRotulo}>E-mail:</Text>
            <Text>{CONTATO_DA_CARTA.email}</Text>
          </View>
          <View style={s.meta}>
            <Text style={s.metaRotulo}>Horário:</Text>
            <Text>{CONTATO_DA_CARTA.horario}</Text>
          </View>
        </View>

        <View wrap={false} style={{ marginTop: 14 }}>
          <P>Com carinho e gratidão por tantos anos de confiança,</P>
          <Text style={s.negrito}>Equipe Behemp</Text>
          <Text>Cristiana P Taddeo</Text>
          <Text>Vice-Presidente</Text>
          <Text>vp@behemp.org</Text>
        </View>

        <View style={s.assinaturaBloco} wrap={false}>
          <Text style={s.ancora}>{ANCORA_ASSINATURA}</Text>
          <View style={s.linha} />
          <Text style={s.negrito}>{dados.nomePaciente}</Text>
          <Text>Ciente dos novos termos para fornecimento do medicamento.</Text>
          <Text style={{ fontSize: 9, color: '#555' }}>(assinatura eletrônica via DocuSign)</Text>
          <Text style={[s.ancora, { marginTop: 6 }]}>{ANCORA_DATA}</Text>
        </View>

        <Text style={s.nota}>Lei 10.406/02 (arts. 53 seguintes; 421 e 422) e Lei 8.078/90.</Text>
        <Text style={s.nota}>
          Nota importante: Esta carta tem caráter informativo e não constitui, por si só,
          instrumento contratual. Os termos aqui descritos serão formalizados em Termo de Adesão
          específico, a ser oportunamente disponibilizado a cada paciente/responsável. A colaboração
          financeira mencionada refere-se exclusivamente ao ressarcimento parcial do custo do
          produto junto ao laboratório fornecedor, não configurando venda de medicamento pela
          Associação Behemp/Be4Hope, cuja atuação assistencial — orientação, acompanhamento e
          suporte ao paciente — permanece gratuita, em conformidade com seu propósito estatutário e
          sem fins lucrativos. A eventual impossibilidade de pagamento por parte do
          paciente/responsável não resultará em interrupção do acompanhamento assistencial oferecido
          pela instituição, tampouco no desligamento do paciente do programa. Os valores e condições
          ora informados poderão ser revistos mediante comunicação prévia, em razão de eventuais
          alterações nas condições comerciais praticadas pelo laboratório fornecedor, sem que isso
          implique alteração retroativa de valores já acordados. Toda e qualquer decisão sobre o
          tratamento, dosagem e formulação permanece de exclusiva responsabilidade médica, cabendo à
          Associação Behemp/Be4Hope tão somente a facilitação do acesso e do suporte logístico ao
          paciente.
        </Text>

        <Text style={s.rodape} fixed>
          Associação Behemp — CNPJ/MF 07.578.940/0001-01 · www.be4hope.org
        </Text>
      </Page>
    </Document>
  );
}

/** Gera o PDF do comunicado, personalizado com o nome do paciente e a data do envio. */
export async function gerarPdfCartaDoacao(dados: DadosCartaDoacao): Promise<Buffer> {
  const blob = await pdf(<CartaDocument dados={dados} />).toBlob();
  return Buffer.from(await blob.arrayBuffer());
}
