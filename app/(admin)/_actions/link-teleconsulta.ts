'use server';

import { z } from 'zod';

import { db } from '@/lib/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verificarAdmin } from '@/lib/auth/permissions';
import { registrarAuditoria } from '@/lib/utils/audit';
import { ServicoDeSolicitacao } from '@/lib/chatpro/solicitacao';

/**
 * "PORTA 3" — o link do admin, agora com tela (ADR-0022 §27/§34.1, D-15).
 *
 * Até aqui essa porta só existia por acidente: nenhuma tela chamava
 * `solicitacoesCadastro.insert` com `origem: 'painel_admin'` declarado — o valor só
 * apareceria se alguém confiasse no `default()` da coluna, e o D-15 do dono (13/09/2026,
 * "sim, deve gravar") exige que a origem seja explícita, não implícita.
 *
 * 🔴 O INSERT MORA EM `lib/chatpro/solicitacao.ts` (método `admin` de
 * `ServicoDeSolicitacao`), não aqui — é o que o guarda `toda-porta-declara-de-onde-veio`
 * exige: só dois arquivos podem inserir em `solicitacoes_cadastro`, para que o TypeScript
 * force toda porta nova a passar pelo mesmo caminho tipado (nunca um insert solto que
 * escape da obrigatoriedade de `origem`). Esta action só autentica/autoriza, valida e
 * audita — a criação em si é delegada.
 *
 * Uso: fluxo interno/secundário — o admin gera o link do cadastro sem esperar o ChatPro,
 * para agilizar teste e atendimento manual. Sempre nasce SEM documento do parceiro, então
 * as 5 pendências (incluindo receita médica) ficam abertas e a tela em `/cadastro/[token]`
 * entra no `fluxoDaTeleconsulta` (ADR-0023, DO-57/DO-58).
 */

const esquema = z.object({
  nomeCompleto: z.string().trim().max(200).optional(),
  telefone: z.string().trim().max(30).optional(),
  email: z.string().trim().max(200).email('E-mail inválido').optional().or(z.literal('')),
});

export type EntradaLinkTeleconsulta = z.infer<typeof esquema>;

interface ResultadoAction<T = unknown> {
  sucesso: boolean;
  dados?: T;
  erro?: string;
}

/** `verificarAdmin()` só devolve `clerkId` — resolve o id interno, para a auditoria. */
async function obterUserIdInterno(clerkId: string): Promise<string | null> {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  return user?.id ?? null;
}

export async function gerarLinkTeleconsultaAdmin(
  entrada: EntradaLinkTeleconsulta,
): Promise<ResultadoAction<{ link: string; protocolo: string }>> {
  const permissao = await verificarAdmin();
  if (!permissao.autorizado || !permissao.clerkId) {
    return { sucesso: false, erro: permissao.erro ?? 'Acesso negado.' };
  }

  const analise = esquema.safeParse(entrada);
  if (!analise.success) {
    return { sucesso: false, erro: analise.error.issues[0]?.message ?? 'Dados inválidos.' };
  }
  const dados = analise.data;

  const resultado = await new ServicoDeSolicitacao().admin({
    nomeCompleto: dados.nomeCompleto || null,
    email: dados.email || null,
    telefone: dados.telefone || null,
  });

  const userId = await obterUserIdInterno(permissao.clerkId);
  await registrarAuditoria({
    userId,
    acao: 'criar',
    entidade: 'solicitacoes_cadastro',
    entidadeId: resultado.solicitacaoId,
    dadosDepois: {
      protocolo: resultado.protocolo,
      origem: 'painel_admin',
      canalDeEntrega: 'manual',
      reaproveitou: resultado.reaproveitou,
    },
  });

  return { sucesso: true, dados: { link: resultado.linkDeAcesso, protocolo: resultado.protocolo } };
}
