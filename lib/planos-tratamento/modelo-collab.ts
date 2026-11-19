/**
 * Textos FIXOS do documento "Adesão ao Tratamento" (Programa de Acesso Collab).
 *
 * Fixos por decisão do dono (19/11/2026): são institucionais e iguais em todo plano. O único
 * trecho variável — o percentual do benefício 1 — vem de `textosDaAdesao().beneficioDesconto`.
 * Fonte: o PDF editável `Collab_Adesao_ao_Tratamento_editavel.pdf`.
 */
export const MODELO_COLLAB = {
  programa: 'Programa de Acesso Collab',
  eyebrow: 'PROGRAMA DE ACESSO COLLAB',
  titulo: 'Adesão ao Tratamento',
  cardTitulo: 'DADOS DA ADESÃO',

  secaoComoFunciona: 'Como funciona o Programa Collab',
  intro:
    'O Collab é o programa de acesso da BE HEMP para que você possa seguir o tratamento com ' +
    'continuidade, com acolhimento e com condições facilitadas. Ao aderir, você conta com:',
  beneficioDescontoTexto:
    'O subsídio Collab é aplicado diretamente sobre o valor dos frascos, já considerado na ' +
    'composição de valores.',
  beneficios: [
    {
      titulo: 'Consulta que também é social',
      texto:
        'Cada consulta do programa une o acompanhamento clínico com neurologista e uma escuta ' +
        'social: entendemos a sua realidade e a da sua rede de apoio para que o tratamento seja ' +
        'sustentável para você e para a sua família.',
    },
    {
      titulo: 'Acolhimento próximo',
      texto:
        'A equipe da BE HEMP orienta você em cada etapa, da documentação à entrega do ' +
        'medicamento.',
    },
  ],

  secaoFornecimento: 'Fornecimento e acompanhamento',
  secaoComposicao: 'Composição da adesão',
  linhaFrascosDescricao: 'Medicamento, valor por frasco',
  linhaSubsidio: 'Subsídio Collab',
  linhaSubsidioDescricao: 'Desconto sobre o valor dos medicamentos',
  linhaMedicamentosLiquido: 'Medicamentos após o subsídio',
  linhaConsultas: 'Consultas neurológicas',
  linhaConsultasDescricao: 'Com triagem social',

  ajudaTitulo: 'Dúvidas ou precisa de ajuda?',
  ajudaTexto:
    'Fale com o nosso acolhimento: acolhimento@b4hope.org. Se tiver dificuldade em manter as ' +
    'condições acima, escreva para nós: cada caso é avaliado individualmente.',
  observacao:
    'Observação: a adesão está sujeita à prescrição médica, à continuidade do programa e às ' +
    'condições de pagamento acordadas. Eventuais encargos não estão incluídos.',

  rodape: 'BE HEMP  ·  Programa de Acesso Collab  ·  acolhimento@b4hope.org',
} as const;
