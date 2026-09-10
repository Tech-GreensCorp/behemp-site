/**
 * VALIDAÇÃO DE CPF PELO DÍGITO VERIFICADOR.
 *
 * POR QUE VALIDAR, E NÃO SÓ CONTAR ONZE DÍGITOS
 * O CPF do paciente vai parar na prescrição e no SNCR. Um número com onze dígitos que
 * não fecha o verificador é rejeitado lá na frente — quando o paciente já saiu da tela,
 * já teve a consulta, e corrigir custa uma pessoa ligando para ele.
 *
 * ⚠️ O QUE ESTA FUNÇÃO **NÃO** FAZ: dizer que o CPF EXISTE, ou que é DESTA pessoa.
 * O dígito verificador é aritmética — prova apenas que o número é bem formado. Só a
 * Receita Federal responde se ele existe, e só documento com foto liga o número à
 * pessoa. Tratar "válido" como "conferido" seria a mesma classe de erro que tratar
 * sugestão de IA como diagnóstico.
 */

/** Remove tudo que não é dígito. */
export function somenteDigitosDoCpf(valor: string | null | undefined): string {
  return (valor ?? '').replace(/\D/g, '');
}

export function cpfEhValido(valor: string | null | undefined): boolean {
  const cpf = somenteDigitosDoCpf(valor);
  if (cpf.length !== 11) return false;

  // 🔴 OS ONZE REPETIDOS PASSAM NA ARITMÉTICA e precisam de recusa explícita.
  // `111.111.111-11` fecha os dois verificadores. Sem esta linha, o placeholder mais
  // comum do Brasil entraria como CPF válido — e `000.000.000-00` também.
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const digitoEsperado = (ate: number): number => {
    let soma = 0;
    for (let i = 0; i < ate; i++) {
      soma += Number(cpf[i]) * (ate + 1 - i);
    }
    const resto = (soma * 10) % 11;
    // Resto 10 e 11 valem zero — regra da Receita, e a fonte do erro mais comum
    // em implementação caseira.
    return resto === 10 || resto === 11 ? 0 : resto;
  };

  return digitoEsperado(9) === Number(cpf[9]) && digitoEsperado(10) === Number(cpf[10]);
}

/** `12345678901` → `123.456.789-01`. Só para exibir; o banco guarda os dígitos. */
export function formatarCpf(valor: string | null | undefined): string {
  const cpf = somenteDigitosDoCpf(valor);
  if (cpf.length !== 11) return valor ?? '';
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
}

/**
 * Máscara para LOG e para tela de quem não é o dono do dado: `123.***.***-01`.
 * CPF é dado pessoal, e log é lugar onde ele fica anos sem ninguém olhar.
 */
export function mascararCpf(valor: string | null | undefined): string {
  const cpf = somenteDigitosDoCpf(valor);
  if (cpf.length !== 11) return '***';
  return `${cpf.slice(0, 3)}.***.***-${cpf.slice(9)}`;
}
