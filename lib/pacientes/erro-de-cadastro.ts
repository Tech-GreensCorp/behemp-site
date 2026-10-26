/**
 * Tradução do erro do banco no cadastro de paciente para uma mensagem que a tela pode mostrar.
 *
 * 🔴 Por que existe (26/10/2026): o `catch` de `criarPaciente` devolvia sempre "Erro ao criar paciente",
 * e quem cadastrava não sabia se faltava um campo, se o dado já existia ou se era falha nossa. O
 * Drizzle embrulha o erro do Postgres em `DrizzleQueryError` e a causa fica em `.cause`.
 *
 * ⚠️ A mensagem do Postgres NÃO vai para a tela nem para o log: o Drizzle monta `message` com a query
 * e os valores (CPF, nome, telefone). Só o código SQLSTATE, a constraint e a tabela saem — o que
 * diagnostica e não carrega dado pessoal.
 *
 * Sem `db`, sem `auth`, sem `next/*`.
 */

export const ERRO_GENERICO_DE_CADASTRO =
  'Não foi possível cadastrar o paciente. Tente novamente; se persistir, avise o suporte.';

type ErroDoPostgres = { code?: unknown; constraint?: unknown; table?: unknown };

/** Acha o erro do `pg` (com `code`) na cadeia de `cause`, com teto para não girar em ciclo. */
function erroDoPostgres(erro: unknown): ErroDoPostgres | null {
  let atual: unknown = erro;
  for (let i = 0; i < 5 && atual && typeof atual === 'object'; i++) {
    const { code } = atual as ErroDoPostgres;
    if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return atual as ErroDoPostgres;
    atual = (atual as { cause?: unknown }).cause;
  }
  return null;
}

/** O que é seguro registrar em log: `code:constraint:table`, nunca a mensagem. */
export function diagnosticoDoErro(erro: unknown): string {
  const pg = erroDoPostgres(erro);
  if (!pg) return erro instanceof Error ? erro.name : 'desconhecido';
  return [pg.code, pg.constraint, pg.table].filter((p) => typeof p === 'string').join(':');
}

/** Mensagem para a tela. Nunca contém dado do paciente nem texto cru do banco. */
export function mensagemDoErroDeCadastro(erro: unknown): string {
  const pg = erroDoPostgres(erro);
  switch (pg?.code) {
    case '22007': // invalid_datetime_format
    case '22008': // datetime_field_overflow
      return 'Alguma data é inválida. Confira a data de nascimento e a data de associação.';
    case '23505': // unique_violation
      return 'Já existe um cadastro com esses dados (e-mail ou CPF).';
    case '22001': // string_data_right_truncation
      return 'Algum campo ultrapassa o tamanho permitido. Confira os textos e tente de novo.';
    case '22P02': // invalid_text_representation
      return 'Algum campo está em formato inválido. Confira os dados e tente de novo.';
    case '23502': // not_null_violation
      return 'Falta um dado obrigatório para concluir o cadastro.';
    default:
      return ERRO_GENERICO_DE_CADASTRO;
  }
}
