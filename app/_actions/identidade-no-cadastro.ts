'use server';

/**
 * A CONFERÊNCIA DA ETAPA 1 DO CADASTRO POR LINK — ADR-0028 D-02, D-08.
 *
 * Roda quando o paciente clica em "Continuar" na etapa 1, com o que ele DIGITOU ou CORRIGIU —
 * o bot do ChatPro não manda CPF, e o identificador mais forte só existe depois que ele digita.
 *
 * 🔴 ESTA ACTION RODA SEM AUTENTICAÇÃO. `/cadastro(.*)` é público (`middleware.ts`), porque o
 * paciente ainda não tem conta. A credencial é o TOKEN do link, conferido aqui antes de
 * qualquer consulta. E por ela aceitar dado digitado, é um oráculo em potencial — daí as três
 * travas, nesta ordem:
 *
 *   1. token válido, ou nada é consultado
 *   2. limite por SOLICITAÇÃO e por IP (`OWASP-02`) — testar CPFs um a um fica caro
 *   3. a resposta é um VEREDITO, nunca o dado encontrado (`OWASP-01`, `LGPD-06`)
 *
 * E o que não é `livre` fica AUDITADO — sem CPF, e-mail ou telefone no registro.
 */

import { auth, currentUser } from '@clerk/nextjs/server';
import { headers } from 'next/headers';
import { z } from 'zod';

import { falha, ok, type ResultadoAction } from '@/lib/ia-clinica/resultado';
import { validarTokenDeCadastro } from '@/lib/chatpro/token-de-cadastro';
import {
  conferirIdentidade,
  dentroDoLimiteDaConferencia,
  type Veredito,
} from '@/lib/cadastro/conferir-identidade';
import { registrarAuditoria } from '@/lib/utils/audit';

const esquema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/i, 'Link inválido'),
  cpf: z.string().trim().max(20).optional().nullable(),
  email: z.string().trim().max(320).optional().nullable(),
  telefone: z.string().trim().max(30).optional().nullable(),
});

/**
 * O protocolo vai em todo registro: é por ele que o suporte acha o caso quando a pessoa chama no
 * WhatsApp, e ele não é dado pessoal.
 */
async function auditar(
  solicitacao: { id: string; protocolo: string },
  dadosDepois: Record<string, unknown>,
) {
  await registrarAuditoria({
    // Não há `users.id` de quem está no link — ele ainda não tem conta. Quem agiu vai em
    // `dadosDepois`, e o registro não inventa autor.
    userId: null,
    acao: 'visualizar',
    entidade: 'solicitacoes_cadastro',
    entidadeId: solicitacao.id,
    dadosDepois: { ...dadosDepois, protocolo: solicitacao.protocolo },
  });
}

export async function conferirIdentidadeNaEtapa1(
  entrada: z.input<typeof esquema>,
): Promise<ResultadoAction<{ veredito: Veredito }>> {
  const analise = esquema.safeParse(entrada);
  if (!analise.success) return falha('Link inválido.');
  const dados = analise.data;

  // 1 ── O token primeiro. Link recusado não consulta nada e não diz nada.
  const solicitacao = await validarTokenDeCadastro(dados.token);
  if (!solicitacao.valida) return falha('Este link não está mais válido.');

  // 2 ── O limite, antes de tocar em `users` e `pacientes`.
  if (!dentroDoLimiteDaConferencia('identidade', solicitacao.id, await headers())) {
    await auditar(solicitacao, { evento: 'conferencia_de_identidade', veredito: 'limite' });
    return ok({ veredito: 'limite' });
  }

  // 3 ── A conferência. A sessão entra porque decide de quem são os dados (`DO-60`).
  const { userId: clerkId } = await auth();
  const usuario = clerkId ? await currentUser() : null;

  const veredito = await conferirIdentidade({
    entrada: { cpf: dados.cpf, email: dados.email, telefone: dados.telefone },
    emailDoLink: solicitacao.email,
    sessao: {
      clerkId,
      emailDaSessao: usuario?.emailAddresses?.[0]?.emailAddress,
      emailsDoCadastro: [solicitacao.email, dados.email],
    },
  });

  if (veredito !== 'livre') {
    await auditar(solicitacao, { evento: 'conferencia_de_identidade', veredito, porta: 'etapa_1' });
  }

  return ok({ veredito });
}
