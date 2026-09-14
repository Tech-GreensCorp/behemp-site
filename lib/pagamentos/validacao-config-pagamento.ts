import { z } from 'zod';

/**
 * Campos de DADO de recebimento (PIX/boleto) — quem pode cadastrar: admin E o próprio
 * médico. Separado dos campos de HABILITAÇÃO de propósito: só o admin decide o que fica
 * ativo na tela de pagamento do paciente (`camposHabilitacaoPagamentoMedico`), o médico
 * só alimenta o dado. Um médico não pode se auto-habilitar mexendo só nesses campos.
 */
export const camposDadosPagamentoMedico = {
  pixTipoChave: z.enum(['cpf', 'cnpj', 'email', 'telefone', 'aleatoria']).nullable(),
  pixChave: z.string().nullable(),
  bancoNome: z.string().nullable(),
  bancoAgencia: z.string().nullable(),
  bancoConta: z.string().nullable(),
  bancoContaTipo: z.enum(['corrente', 'poupanca']).nullable(),
  bancoTitularNome: z.string().nullable(),
  bancoTitularDocumento: z.string().nullable(),
  observacoes: z.string().nullable(),
} as const;

/** Campos de HABILITAÇÃO — exclusivos do admin (decide o que o paciente vê como opção). */
export const camposHabilitacaoPagamentoMedico = {
  pixHabilitado: z.boolean(),
  boletoHabilitado: z.boolean(),
  cartaoCreditoHabilitado: z.boolean(),
  cartaoDebitoHabilitado: z.boolean(),
} as const;

/** União dos dois — usado pela action do admin, que continua controlando tudo. */
export const camposConfigPagamentoMedico = {
  ...camposHabilitacaoPagamentoMedico,
  ...camposDadosPagamentoMedico,
} as const;

interface CamposParaValidarHabilitacao {
  pixHabilitado: boolean;
  pixTipoChave: string | null;
  pixChave: string | null;
  boletoHabilitado: boolean;
  bancoNome: string | null;
  bancoAgencia: string | null;
  bancoConta: string | null;
  bancoContaTipo: string | null;
  bancoTitularNome: string | null;
  bancoTitularDocumento: string | null;
}

/** Regra do ADMIN: PIX habilitado exige chave; boleto habilitado exige os dados bancários completos. */
export function validarRegrasConfigPagamento(dados: CamposParaValidarHabilitacao, ctx: z.RefinementCtx) {
  if (dados.pixHabilitado && (!dados.pixTipoChave || !dados.pixChave?.trim())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Informe o tipo e a chave PIX para habilitar este método',
      path: ['pixChave'],
    });
  }
  if (
    dados.boletoHabilitado &&
    (!dados.bancoNome?.trim() ||
      !dados.bancoAgencia?.trim() ||
      !dados.bancoConta?.trim() ||
      !dados.bancoContaTipo ||
      !dados.bancoTitularNome?.trim() ||
      !dados.bancoTitularDocumento?.trim())
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Preencha os dados bancários completos para habilitar boleto',
      path: ['bancoNome'],
    });
  }
}

interface CamposParaValidarDados {
  pixTipoChave: string | null;
  pixChave: string | null;
  bancoNome: string | null;
  bancoAgencia: string | null;
  bancoConta: string | null;
  bancoContaTipo: string | null;
  bancoTitularNome: string | null;
  bancoTitularDocumento: string | null;
}

/**
 * Regra do MÉDICO (sem habilitação): só coerência do dado em si — não dá pra ter chave
 * PIX sem tipo (ou vice-versa), e dados bancários são tudo-ou-nada, pra não gerar boleto
 * com conta pela metade quando o admin habilitar depois.
 */
export function validarCoerenciaDadosPagamento(dados: CamposParaValidarDados, ctx: z.RefinementCtx) {
  const temChave = Boolean(dados.pixChave?.trim());
  const temTipo = Boolean(dados.pixTipoChave);
  if (temChave !== temTipo) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Informe o tipo e a chave PIX juntos',
      path: ['pixChave'],
    });
  }

  const camposBanco = [
    dados.bancoNome,
    dados.bancoAgencia,
    dados.bancoConta,
    dados.bancoContaTipo,
    dados.bancoTitularNome,
    dados.bancoTitularDocumento,
  ];
  const algumPreenchido = camposBanco.some((c) => c && String(c).trim());
  const todosPreenchidos = camposBanco.every((c) => c && String(c).trim());
  if (algumPreenchido && !todosPreenchidos) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Preencha todos os dados bancários, ou deixe todos em branco',
      path: ['bancoNome'],
    });
  }
}
