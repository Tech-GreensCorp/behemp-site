/**
 * Os DOIS consentimentos da teleconsulta — textos e versões.
 *
 * POR QUE SÃO DOIS, E NÃO UM
 * Origens diferentes, e exigências diferentes (ADR-0007 D-08):
 *
 *   1. **Teleconsulta** — CFM 2.314/2022, Art. 15 (`CFM-01`): o paciente *"deverá autorizar o
 *      atendimento por telemedicina e a transmissão das suas imagens e dados"*, e o aceite
 *      *"deve fazer parte do SRES do paciente"*. **Bloqueia o atendimento remoto.**
 *   2. **Transcrição e IA** — LGPD art. 11, I (`LGPD-05`): dado sensível por consentimento exige
 *      que ele seja específico e destacado. **Bloqueia só a IA**, nunca a consulta.
 *
 * Um consentimento genérico cobrindo os dois seria **menos específico** do que o art. 11, I
 * pede, e ainda misturaria uma coisa que bloqueia com uma que não bloqueia.
 *
 * O QUE CADA TEXTO PRECISA DIZER — checklist literal do art. 9º da LGPD (`LGPD-01`)
 * I finalidade específica · II forma e duração · III identificação do controlador · IV contato
 * do controlador · V uso compartilhado e a finalidade · VI responsabilidades dos agentes ·
 * VII direitos do titular, com menção explícita ao art. 18.
 *
 * 🔴 `LGPD-02`: *"o consentimento será considerado **nulo** caso as informações fornecidas ao
 * titular tenham conteúdo enganoso ou abusivo"* (art. 9º, §1º). Texto que promete menos do que
 * o sistema faz não é um texto ruim — é um aceite **sem valor**. Por isso o texto da IA nomeia
 * **os dois** serviços externos, e diz que o áudio vai ao Google **sem máscara**.
 *
 * POR QUE O TEXTO VIVE NO CÓDIGO
 * Texto que muda sem passar por diff não é auditável, e provar consentimento é poder mostrar **a
 * que** a pessoa disse sim. O banco guarda a **versão** aceita; o texto entra por revisão de
 * código (ADR-0007 D-05).
 */

// ═══════════════════════════════════════════════════════════════════════════════
// 🔴 O QUE AINDA FALTA PARA ESTES TEXTOS VALEREM
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Dados do controlador — exigidos pelo art. 9º, **III e IV** (`LGPD-01`).
 *
 * 🔴 **NÃO PREENCHIDOS: não são dado que se adivinha.** Razão social, CNPJ e o canal de contato
 * do encarregado (DPO) precisam vir de quem responde pela empresa. Enquanto estiverem assim, o
 * texto **não cumpre** os incisos III e IV, e é por isso que
 * `CONSENTIMENTO_PRONTO_PARA_USO` está `false`.
 */
export const CONTROLADOR = {
  razaoSocial: '[PENDENTE — razão social completa]',
  cnpj: '[PENDENTE — CNPJ]',
  /** Canal do encarregado de dados. Art. 9º, IV exige contato, não endereço genérico. */
  contatoEncarregado: '[PENDENTE — e-mail do encarregado/DPO]',
} as const;

/**
 * Prazo de retenção — exigido pelo art. 9º, **II** (forma e **duração** do tratamento).
 *
 * 🔴 **Decisão jurídica, não de engenharia.** O campo existe vazio de propósito: a regra de
 * `.claude/rules/seguranca-lgpd.md` diz que, se o prazo é decisão jurídica, *"o campo existe e
 * fica vazio — nunca se chuta o número"*.
 *
 * ⚠️ Há uma tensão real a resolver com o Jurídico: prontuário tem prazo mínimo de guarda por
 * norma do CFM, e a transcrição, uma vez no prontuário, provavelmente segue esse prazo — não um
 * prazo de dado de marketing. Quem decide precisa saber disso.
 */
export const RETENCAO = {
  transcricao: '[PENDENTE — prazo de guarda da transcrição no prontuário]',
  audio: 'não se aplica: o áudio não é armazenado, só processado ao vivo',
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// CONSENTIMENTO 1 — ATENDIMENTO POR TELEMEDICINA (CFM 2.314/2022, Art. 15)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 🔴 RASCUNHO — NÃO REVISADO PELO JURÍDICO.
 *
 * Escrito em 20/08/2026 a partir do que a norma exige, e apenas dela: cada item abaixo
 * corresponde a uma exigência nomeada do CFM 2.314/2022 ou da LGPD. Não há cláusula inventada,
 * e não há cláusula de proteção da empresa — termo de consentimento não é contrato de adesão, e
 * misturar as duas coisas é o que o art. 9º §1º chama de conteúdo abusivo.
 */
export const TEXTO_CONSENTIMENTO_TELECONSULTA = {
  titulo: 'Autorização para consulta por telemedicina',
  /** `LGPD-04` (art. 9º §3º): o tratamento é condição do serviço, então isso vem com destaque. */
  destaque:
    'Sem esta autorização não é possível realizar a consulta **por vídeo**. Você continua com direito a atendimento presencial — a telemedicina complementa, não substitui.',
  itens: [
    // CFM 2.314 Art. 15: autorizar o atendimento E a transmissão de imagens e dados.
    'Autorizo que esta consulta médica seja realizada **a distância**, por vídeo e áudio, com o médico identificado nesta tela.',
    'Autorizo a **transmissão da minha imagem, da minha voz e dos meus dados de saúde** entre mim e o médico durante a consulta.',
    // CFM 2.314 Art. 15 § único: consciência de que informações podem ser compartilhadas.
    'Estou ciente de que minhas informações de saúde podem ser **compartilhadas com a equipe envolvida no meu cuidado** e com os serviços de tecnologia necessários para a chamada acontecer.',
    // CFM 2.314 Art. 3º §1º: registro em prontuário.
    'Estou ciente de que a consulta e esta autorização ficam **registradas no meu prontuário**.',
    // CFM 2.314 Art. 4º e Art. 19: autonomia do médico e assistência presencial.
    'Estou ciente de que o médico pode **indicar atendimento presencial** a qualquer momento, se entender necessário.',
    // LGPD art. 9º, VII + art. 18: direitos, nomeados.
    'Sei que posso **retirar esta autorização** quando quiser, e que tenho direito a **confirmar o tratamento, acessar, corrigir, pedir a portabilidade e pedir a eliminação** dos meus dados, além de **saber com quem eles foram compartilhados** (LGPD, art. 18).',
  ],
  /** CFM 2.314 Art. 15 § único: o direito de negar é parte da informação, não uma consequência. */
  direitoDeNegar:
    'Você pode recusar. A recusa não impede seu atendimento: ela apenas impede que ele aconteça por vídeo, e a equipe orienta o caminho presencial.',
  /** CFM 2.314 Art. 15 § único: a única exceção prevista na norma. */
  excecao:
    'Em situação de emergência médica, o atendimento acontece sem esta autorização prévia — e isso fica registrado no prontuário.',
} as const;

export const VERSAO_CONSENTIMENTO_TELECONSULTA = 'rascunho-teleconsulta-2026-08-20';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSENTIMENTO 2 — TRANSCRIÇÃO E ANÁLISE POR IA (LGPD art. 11, I)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 🔴 RASCUNHO — NÃO REVISADO PELO JURÍDICO.
 *
 * Descreve **o que o código faz de fato**, medido em `app/api/teleconsulta/transcrever/route.ts`.
 * Cada afirmação é verificável no código, e é assim que se evita o conteúdo enganoso que o art.
 * 9º §1º pune com nulidade.
 */
export const TEXTO_CONSENTIMENTO_IA = {
  titulo: 'Autorização para o resumo automático da consulta',
  destaque:
    'Esta autorização é **opcional**. Sem ela, sua consulta acontece normalmente — apenas sem o resumo automático, e o médico registra as anotações à mão.',
  itens: [
    // Art. 9º, I — finalidade específica.
    'A finalidade é **uma só**: transformar o que foi falado na consulta em um resumo clínico escrito, para o seu médico registrar no prontuário com menos digitação.',
    // Art. 9º, II — forma. E o fato medido: o áudio não é armazenado.
    'O áudio é processado **ao vivo** e **não é gravado nem armazenado** — depois de convertido em texto, é descartado.',
    // Art. 9º, V — uso compartilhado E a finalidade de cada um. Nomeados, sem eufemismo.
    'Para isso, **dois serviços de tecnologia** recebem parte do conteúdo: o **Google Speech-to-Text** recebe o áudio para transcrever, e o **Gemini**, também do Google, recebe o texto para organizá-lo em resumo clínico. Os dois têm servidores fora do Brasil.',
    // Art. 9º §1º: não prometer proteção que o código não dá.
    'Antes de enviar o texto ao serviço que organiza o resumo, o sistema **remove automaticamente CPF, RG, telefone e e-mail** que apareçam na fala. ⚠️ **O áudio vai ao serviço de transcrição sem essa remoção** — não é possível apagar dados de dentro de um áudio.',
    // Art. 9º, VI — responsabilidades.
    'O resumo fica no seu prontuário, sob responsabilidade do médico e da clínica. **Somente você e sua equipe de cuidado** têm acesso.',
    // Art. 9º, II — duração. Marcado como pendente, e é visível na tela.
    'O resumo é guardado junto do seu prontuário. O prazo de guarda segue as regras de prontuário médico.',
    // Art. 9º, VII + art. 18.
    'Posso **retirar esta autorização** quando quiser, e tenho direito a **confirmar o tratamento, acessar, corrigir, pedir a portabilidade, pedir a eliminação** e **saber com quem meus dados foram compartilhados** (LGPD, art. 18).',
  ],
  seRecusar:
    'A consulta acontece normalmente. Sem esta autorização, não haverá resumo automático — seu médico registra as anotações à mão, como sempre.',
} as const;

export const VERSAO_CONSENTIMENTO_IA = 'rascunho-ia-2026-08-20';

/** @deprecated Use `VERSAO_CONSENTIMENTO_IA`. Mantido porque o schema já grava esta chave. */
export const VERSAO_CONSENTIMENTO = VERSAO_CONSENTIMENTO_IA;

// ═══════════════════════════════════════════════════════════════════════════════
// PORTÃO DE PRODUÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 🔴 Enquanto for `false`, nenhum dos dois consentimentos é **coletado em produção** — e a
 * transcrição fica desligada. Coletar aceite sobre texto não revisado produz registro que não
 * vale nada e dá aparência de conformidade sem conformidade.
 *
 * Em desenvolvimento as telas funcionam, para poderem ser vistas e testadas.
 *
 * **Vira `true` quando, e somente quando, os quatro acontecerem:**
 *   1. o Jurídico revisar os dois textos;
 *   2. `CONTROLADOR` estiver preenchido — art. 9º, III e IV;
 *   3. `RETENCAO.transcricao` tiver um prazo — art. 9º, II;
 *   4. as versões perderem o prefixo `rascunho-`.
 */
export const CONSENTIMENTO_PRONTO_PARA_USO = false;

/** Algum dos textos ainda é rascunho? Derivado das versões, para não haver duas verdades. */
export function ehRascunho(): boolean {
  return (
    VERSAO_CONSENTIMENTO_IA.startsWith('rascunho-') ||
    VERSAO_CONSENTIMENTO_TELECONSULTA.startsWith('rascunho-')
  );
}

/** Os dados obrigatórios do art. 9º III, IV e II estão preenchidos? */
export function dadosObrigatoriosPreenchidos(): boolean {
  const pendente = (v: string) => v.startsWith('[PENDENTE');
  return (
    !pendente(CONTROLADOR.razaoSocial) &&
    !pendente(CONTROLADOR.cnpj) &&
    !pendente(CONTROLADOR.contatoEncarregado) &&
    !pendente(RETENCAO.transcricao)
  );
}

/**
 * O consentimento pode ser **pedido** neste ambiente?
 *
 * Em produção exige texto revisado **e** os dados obrigatórios. Fora de produção, sempre — senão
 * não haveria como desenvolver nem demonstrar a tela.
 */
export function consentimentoPodeSerColetado(): boolean {
  if (process.env.NODE_ENV === 'production') {
    return CONSENTIMENTO_PRONTO_PARA_USO && !ehRascunho() && dadosObrigatoriosPreenchidos();
  }
  return true;
}

/** @deprecated Nome antigo, mantido enquanto houver chamador. */
export const transcricaoPodeSerOferecida = consentimentoPodeSerColetado;
