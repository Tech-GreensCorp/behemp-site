/**
 * O CONSENTIMENTO DO COMPARTILHAMENTO ENTRE AS EMPRESAS.
 *
 * Texto e estrutura vindos do formulário completo da Greens, a pedido do dono em 10/09/2026 —
 * _"utilize o mesmo modelo existente no formulário da greens completo, ele fez um
 * consentimento bom lá"_. Ele é bom, e a razão está na tabela abaixo: cada escolha de redação
 * responde a um artigo.
 *
 * | norma          | o que exige                                              | como o texto atende            |
 * | -------------- | -------------------------------------------------------- | ------------------------------ |
 * | art. 11, I     | consentimento "específico e destacado, para finalidades   | as duas finalidades são        |
 * |                | específicas" para dado sensível                          | **nomeadas e numeradas**       |
 * | art. 8º, §4º   | "autorizações genéricas serão nulas"                     | não diz "meus dados": diz      |
 * |                |                                                          | quais dados, para quem, e para |
 * |                |                                                          | quê                            |
 * | art. 9º, V     | informar "o uso compartilhado… e a finalidade"           | o retorno à Greens está        |
 * |                |                                                          | declarado, com o porquê        |
 * | art. 9º, §1º   | consentimento é **nulo** se a informação não foi clara    | estrutura numerada, não frase  |
 * |                |                                                          | corrida                        |
 * | art. 8º, §6º   | mudança de finalidade obriga a informar e permite revogar | a versão fica gravada          |
 *
 * 🔴 A VERSÃO NÃO É ENFEITE. O art. 8º §6º só funciona se soubermos a QUE texto a pessoa disse
 * sim: mudar a redação sem trocar a versão transforma o registro numa afirmação que não se
 * pode provar.
 */

/** Sobe a cada mudança de redação. Nunca se edita um texto mantendo a versão. */
export const VERSAO_DO_CONSENTIMENTO = '2026-09-10.v1';

/**
 * O texto exato apresentado ao paciente.
 *
 * ⚠️ Vive aqui, e não na tela, porque é ele que se grava junto ao aceite: o que vale é o que a
 * pessoa LEU, não o que está na tela hoje.
 */
export const TEXTO_DO_CONSENTIMENTO =
  'Autorizo o compartilhamento dos meus dados e documentos pessoais e de saúde com a ' +
  'Be4Hope, organização parceira da Greens Corp, para duas finalidades: (1) a avaliação ' +
  'médica por profissional da Be4Hope, quando eu precisar de receita; e (2) o apoio na ' +
  'obtenção da autorização da Anvisa. Autorizo também que a Be4Hope informe à Greens Corp ' +
  'os documentos que emitir para mim, para que o meu pedido possa seguir.';

/**
 * As duas finalidades, separadas — porque consentimento é **específico** (art. 11, I).
 *
 * Guardar as duas juntas num booleano impediria o caso real de alguém aceitar a avaliação
 * médica e recusar o retorno à Greens.
 */
export const FINALIDADES = {
  avaliacaoMedica: 'avaliacao_medica',
  apoioAnvisa: 'apoio_anvisa',
  retornoAoParceiro: 'retorno_ao_parceiro',
} as const;

export type Finalidade = (typeof FINALIDADES)[keyof typeof FINALIDADES];

/** O que se grava a cada aceite. Sem `revogadoEm`, não é consentimento: é autorização perpétua. */
export interface RegistroDeConsentimento {
  pacienteId: string;
  finalidades: Finalidade[];
  versao: string;
  /** O TEXTO APRESENTADO, não uma referência a ele. A redação muda; o registro não pode. */
  textoApresentado: string;
  concedidoEm: Date;
  revogadoEm: Date | null;
  /** De qual tela partiu — o mesmo texto pode ser oferecido em lugares diferentes. */
  origem: string;
}

/**
 * O rótulo de cada finalidade na tela, e o efeito real de recusá-la.
 *
 * 🔴 O EFEITO É PARTE DA INFORMAÇÃO. O art. 9º §1º diz que o consentimento é **nulo** se a
 * informação não foi clara, e "clara" inclui o que acontece se a pessoa disser não. Uma caixa
 * sem consequência declarada convida a marcar tudo sem ler — que é o oposto do que o artigo
 * quer.
 */
export const ROTULOS_DAS_FINALIDADES: Record<
  Finalidade,
  { titulo: string; efeitoSeRecusar: string }
> = {
  [FINALIDADES.avaliacaoMedica]: {
    titulo: 'Avaliação médica por um profissional da Be4Hope',
    efeitoSeRecusar: 'Sem isto não conseguimos agendar a sua consulta.',
  },
  [FINALIDADES.apoioAnvisa]: {
    titulo: 'Apoio na autorização da Anvisa',
    efeitoSeRecusar: 'Você continua podendo pedir a autorização por conta própria.',
  },
  [FINALIDADES.retornoAoParceiro]: {
    titulo: 'Informar à Greens Corp os documentos emitidos para você',
    efeitoSeRecusar: 'O seu pedido na Greens não avança sozinho: você levaria os documentos.',
  },
};
