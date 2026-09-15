'use server';

import { z } from 'zod';

import { db } from '@/lib/db';
import { solicitacoesCadastro, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verificarAdmin } from '@/lib/auth/permissions';
import { registrarAuditoria } from '@/lib/utils/audit';
import { gerarToken, montarLink, validadeEmHoras, proximoProtocolo } from '@/lib/chatpro/solicitacao';
import { normalizarTelefoneWhatsapp } from '@/lib/chatpro/telefone';

/**
 * "PORTA 3" — o link do admin, agora com tela (ADR-0022 §27/§34.1, D-15).
 *
 * Até aqui essa porta só existia por acidente: nenhuma tela chamava
 * `solicitacoesCadastro.insert` com `origem: 'painel_admin'` declarado — o valor só
 * apareceria se alguém confiasse no `default()` da coluna, e o D-15 do dono (13/09/2026,
 * "sim, deve gravar") exige que a origem seja explícita, não implícita.
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

  const protocolo = await proximoProtocolo();
  const { token, hash } = gerarToken();
  const expiraEm = new Date(Date.now() + validadeEmHoras() * 60 * 60 * 1000);
  const telefoneNormalizado = dados.telefone
    ? (normalizarTelefoneWhatsapp(dados.telefone) ?? dados.telefone)
    : null;

  const [criada] = await db
    .insert(solicitacoesCadastro)
    .values({
      protocolo,
      nomeCompleto: dados.nomeCompleto || null,
      email: dados.email || null,
      telefone: telefoneNormalizado,
      tokenHash: hash,
      expiraEm,
      status: 'link_gerado',
      // D-15 — declarado aqui, nunca por default() da coluna.
      origem: 'painel_admin',
      // Nenhum documento do parceiro: as 5 pendências ficam abertas, incluindo a receita —
      // é o que ativa o fluxo da teleconsulta na tela de cadastro.
      documentosDoParceiro: null,
      canalDeEntrega: 'manual',
    })
    .returning({ id: solicitacoesCadastro.id });

  const userId = await obterUserIdInterno(permissao.clerkId);
  await registrarAuditoria({
    userId,
    acao: 'criar',
    entidade: 'solicitacoes_cadastro',
    entidadeId: criada.id,
    dadosDepois: { protocolo, origem: 'painel_admin', canalDeEntrega: 'manual' },
  });

  return { sucesso: true, dados: { link: montarLink(token), protocolo } };
}
