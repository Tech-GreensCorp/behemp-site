/**
 * Regra de "a pessoa triada é paciente" — decisão do dono em 30/09/2026.
 *
 * É paciente quem tem **ficha ativa**: o e-mail da triagem bate com um usuário que tem
 * registro em `pacientes` com `deletedAt IS NULL`. Conta sem ficha, ou ficha arquivada
 * (soft delete), **não** conta.
 *
 * Não há FK entre `triagens` e `pacientes`; o único elo é o e-mail. Por isso a comparação
 * ignora caixa e espaços, e triagem sem e-mail nunca é marcada como paciente — ausência de
 * dado não prova vínculo.
 *
 * Puro de propósito: sem `db`, sem `auth`, sem `next/*`.
 */

export function normalizarEmail(email: string | null | undefined): string | null {
  const limpo = email?.trim().toLowerCase();
  return limpo ? limpo : null;
}

export function marcarPacientes<T extends { emailContato: string | null }>(
  triagens: T[],
  emailsDePacientes: Set<string>,
): Array<T & { ehPaciente: boolean }> {
  return triagens.map((t) => {
    const email = normalizarEmail(t.emailContato);
    return { ...t, ehPaciente: email !== null && emailsDePacientes.has(email) };
  });
}
