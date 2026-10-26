/**
 * Regras PURAS do contato (e-mail e telefone) na EDIÇÃO de um paciente.
 *
 * 🔴 Por que existe (26/10/2026): a tela de edição não tinha campo de e-mail nem de telefone — eram
 * `InfoItem` fixos —, e a action só gravava `telefone` se viesse preenchido, o que impedia apagá-lo.
 *
 * Decisões:
 *   · E-mail é a identidade de login no Clerk. Sem conta de acesso (cadastro feito pela equipe), só o
 *     banco muda. COM conta, a troca vai ao Clerk também (lib/pacientes/clerk-email.ts) — só o banco
 *     mudaria e o próximo webhook `user.updated` o devolveria ao antigo, em silêncio — e é ato de
 *     ADMIN: quem controla o e-mail de login redefine a senha e assume a conta.
 *   · E-mail é único no banco (`users_email_idx`, sensível a maiúsculas); a conferência de conflito
 *     é feita sem diferenciar maiúsculas, e o valor novo é gravado em minúsculas, como o Clerk faz.
 *   · Telefone vazio apaga (NULL), como em `atualizarUsuario`; ausente não toca.
 *
 * Sem `db`, sem `auth`, sem `next/*`.
 */

export type PapelDeQuemEdita = { eAdmin: boolean };
export type ContatoAtual = { email: string; telefone: string | null; temContaDeAcesso: boolean };
export type ContatoEnviado = { email?: string; telefone?: string };

export type DecisaoDeContato =
  | {
      ok: true;
      gravar: { email?: string; telefone?: string | null };
      /** O e-mail mudou e o paciente tem conta de acesso: o Clerk precisa trocar junto. */
      trocarNoClerk: boolean;
    }
  | { ok: false; erro: string };

export const normalizarEmail = (e: string) => e.trim().toLowerCase();

export function decidirContato(
  atual: ContatoAtual,
  enviado: ContatoEnviado,
  quem: PapelDeQuemEdita,
): DecisaoDeContato {
  const gravar: { email?: string; telefone?: string | null } = {};
  let trocarNoClerk = false;

  if (enviado.email !== undefined && enviado.email.trim() !== '') {
    const novo = normalizarEmail(enviado.email);
    if (novo !== normalizarEmail(atual.email)) {
      if (atual.temContaDeAcesso) {
        if (!quem.eAdmin) {
          return {
            ok: false,
            erro: 'Só um administrador pode alterar o e-mail de login de quem já tem conta de acesso.',
          };
        }
        trocarNoClerk = true;
      }
      gravar.email = novo;
    }
  }

  if (enviado.telefone !== undefined) {
    const novo = enviado.telefone.trim() === '' ? null : enviado.telefone.trim();
    if (novo !== (atual.telefone?.trim() || null)) gravar.telefone = novo;
  }

  return { ok: true, gravar, trocarNoClerk };
}
