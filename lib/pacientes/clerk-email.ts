/**
 * Troca o e-mail de LOGIN de um paciente no Clerk (admin, via Backend API).
 *
 * Sequência: cria o e-mail novo já verificado e primário → remove o antigo (senão o paciente
 * continuaria entrando por ele, e o webhook `user.updated`, que lê `email_addresses[0]`, poderia
 * devolver o antigo ao banco). Se qualquer passo falha, desfaz o que fez e devolve `ok: false`.
 *
 * `verified: true` é deliberado: quem confirma o novo e-mail é a equipe, que o recebeu do paciente;
 * o fluxo de verificação por código exigiria o paciente logado.
 *
 * Retorna também `desfazer`, para quem grava no banco em seguida poder reverter o Clerk se a
 * gravação falhar.
 */
import { clerkClient } from '@clerk/nextjs/server';

export type TrocaNoClerk =
  | { ok: true; desfazer: () => Promise<void> }
  | { ok: false; erro: string };

const MENSAGEM_GENERICA = 'Não foi possível alterar o e-mail de login. Nada foi alterado; tente novamente.';

function codigosDoClerk(e: unknown): string[] {
  const erros = (e as { errors?: Array<{ code?: string }> } | null)?.errors;
  return Array.isArray(erros) ? erros.map((x) => x.code ?? '') : [];
}

export async function trocarEmailNoClerk(
  clerkId: string,
  emailAntigo: string,
  emailNovo: string,
): Promise<TrocaNoClerk> {
  const client = await clerkClient();
  let idNovo: string;
  let idAntigo: string | undefined;

  try {
    const usuario = await client.users.getUser(clerkId);
    idAntigo = usuario.emailAddresses.find(
      (e) => e.emailAddress.toLowerCase() === emailAntigo.toLowerCase(),
    )?.id;

    const criado = await client.emailAddresses.createEmailAddress({
      userId: clerkId,
      emailAddress: emailNovo,
      verified: true,
      primary: true,
    });
    idNovo = criado.id;
  } catch (e) {
    console.error('[Clerk] Falha ao criar o e-mail novo:', codigosDoClerk(e).join(',') || 'desconhecido');
    return {
      ok: false,
      erro: codigosDoClerk(e).includes('form_identifier_exists')
        ? 'Este e-mail já está em uso por outra conta de acesso.'
        : MENSAGEM_GENERICA,
    };
  }

  const desfazer = async () => {
    try {
      if (idAntigo) await client.emailAddresses.updateEmailAddress(idAntigo, { primary: true });
      await client.emailAddresses.deleteEmailAddress(idNovo);
    } catch (e) {
      console.error('[Clerk] Falha ao desfazer a troca de e-mail:', codigosDoClerk(e).join(',') || 'desconhecido');
    }
  };

  if (idAntigo) {
    try {
      await client.emailAddresses.deleteEmailAddress(idAntigo);
    } catch (e) {
      console.error('[Clerk] Falha ao remover o e-mail antigo:', codigosDoClerk(e).join(',') || 'desconhecido');
      await desfazer();
      return { ok: false, erro: MENSAGEM_GENERICA };
    }
  }

  return {
    ok: true,
    desfazer: async () => {
      // O antigo já foi removido: recria-o verificado e primário, e tira o novo.
      try {
        if (idAntigo) {
          await client.emailAddresses.createEmailAddress({
            userId: clerkId,
            emailAddress: emailAntigo,
            verified: true,
            primary: true,
          });
        }
        await client.emailAddresses.deleteEmailAddress(idNovo);
      } catch (e) {
        console.error('[Clerk] Falha ao desfazer a troca de e-mail:', codigosDoClerk(e).join(',') || 'desconhecido');
      }
    },
  };
}
