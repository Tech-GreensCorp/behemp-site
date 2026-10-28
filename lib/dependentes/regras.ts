/**
 * Regras puras do dependente — ADR-0033. Sem `db`, sem `auth`, sem `next/*`: roda em teste sem nada.
 */

/**
 * O domínio do e-mail técnico do dependente (ADR-0033 D-04).
 *
 * O dependente (de qualquer idade) não tem login, nem e-mail, nem telefone (P-04 e P-09 de Dryelle), mas `users.email` é
 * `notNull` e único e 45 joins leem o `users` do paciente. Então ele ganha um `users` sem credencial com
 * um endereço que NÃO EXISTE: `.invalid` é TLD reservado para isso (RFC 2606), ou seja, nunca entrega.
 *
 * 🔴 NENHUM envio pode usar este endereço. O aviso vai ao RESPONSÁVEL. O filtro mora em
 * `lib/email/destinatarios-tecnicos.ts` e o guarda `o-dependente-nao-recebe-aviso-no-endereco-tecnico`
 * falha se uma fábrica de cliente de e-mail ficar sem ele.
 */
export const DOMINIO_DO_EMAIL_TECNICO = 'dependente.invalid';

/** `dependente-<id>@dependente.invalid`: único por dependente, e reconhecível. */
export function emailTecnicoDoDependente(id: string): string {
  return `dependente-${id.toLowerCase()}@${DOMINIO_DO_EMAIL_TECNICO}`;
}

/** Este endereço é o técnico de um dependente? (insensível a caixa e a espaços) */
export function ehEmailTecnicoDeDependente(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase().endsWith(`@${DOMINIO_DO_EMAIL_TECNICO}`);
}

/**
 * A data de nascimento é plausível? (ADR-0033, regra de Dryelle em 28/10/2026: o dependente pode ser de
 * QUALQUER idade, inclusive maior de 18 anos; antes valia "só menor de idade".)
 *
 * `dataNascimento` no formato `AAAA-MM-DD`. Aceita data que existe, que não é futura e que não é anterior a
 * 1900. Data inexistente (`2020-02-30`), futura ou absurda: `false`. A data continua obrigatória porque é
 * dado do prontuário, mas NÃO decide mais quem pode ser dependente.
 */
export function dataDeNascimentoPlausivel(
  dataNascimento: string,
  hoje: Date = new Date(),
): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dataNascimento);
  if (!m) return false;
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (ano < 1900) return false;
  const nasc = new Date(Date.UTC(ano, mes - 1, dia));
  // Data que não existe (ex.: 30/02) vira outra no Date: confere de volta.
  if (
    nasc.getUTCFullYear() !== ano ||
    nasc.getUTCMonth() !== mes - 1 ||
    nasc.getUTCDate() !== dia
  ) {
    return false;
  }
  const h = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate());
  return nasc.getTime() <= h;
}

/** Parentescos sugeridos na tela. É rótulo, não regra de negócio: o campo aceita texto livre curto. */
export const PARENTESCOS_SUGERIDOS = [
  'Mãe',
  'Pai',
  'Avó',
  'Avô',
  'Tio(a)',
  'Tutor(a) legal',
  'Outro',
] as const;

/** Idade em anos completos em `hoje`. `null` se a data for inválida, inexistente ou futura. */
export function idadeEmAnos(dataNascimento: string | null, hoje: Date = new Date()): number | null {
  if (!dataNascimento) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dataNascimento);
  if (!m) return null;
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const nasc = new Date(Date.UTC(ano, mes - 1, dia));
  if (
    nasc.getUTCFullYear() !== ano ||
    nasc.getUTCMonth() !== mes - 1 ||
    nasc.getUTCDate() !== dia
  ) {
    return null;
  }
  let idade = hoje.getUTCFullYear() - ano;
  const aindaNaoFezAniversario =
    hoje.getUTCMonth() < mes - 1 || (hoje.getUTCMonth() === mes - 1 && hoje.getUTCDate() < dia);
  if (aindaNaoFezAniversario) idade -= 1;
  return idade < 0 ? null : idade;
}
