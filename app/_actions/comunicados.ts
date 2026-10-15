'use server';

import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

import { comunicadosAssinatura, pacientes, users } from '@/db/schema';
import { verificarAdmin, obterUsuarioAtual } from '@/lib/auth';
import {
  enviarAvisoPorEmail,
  enviarComunicado,
  gerarLinkDeAssinatura,
  listarParaAdmin,
  listarParaPaciente,
  sincronizarComunicado,
  type ComunicadoParaAdmin,
  type ComunicadoParaPaciente,
} from '@/lib/comunicados/assinatura';
import { db } from '@/lib/db';
import { registrarAuditoria } from '@/lib/utils/audit';

/**
 * Server Actions do comunicado "Atualização do Programa de Doação".
 *
 * Fluxo seguro (CLAUDE.md): autenticar → autorizar por papel → validar com Zod → ESCOPO DE
 * OBJETO → executar → auditar. O `pacienteId` e o `comunicadoId` que chegam do cliente são só
 * pedidos: o admin pode agir sobre qualquer paciente, mas o paciente só alcança comunicado cuja
 * linha pertence ao `pacientes.userId` da SUA sessão.
 */

const idSchema = z.string().min(1).max(64);

type Resposta<T> = { sucesso: true; dados: T } | { sucesso: false; erro: string };

async function adminAtual(): Promise<{ userId: string } | null> {
  const perm = await verificarAdmin();
  if (!perm.autorizado || !perm.clerkId) return null;
  const [u] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.clerkId, perm.clerkId), isNull(users.deletedAt)))
    .limit(1);
  return u ? { userId: u.id } : null;
}

/** O paciente da sessão. Sem esta conjunção (sessão → user → paciente) não há escopo. */
async function pacienteDaSessao(): Promise<{ userId: string; pacienteId: string } | null> {
  const perm = await obterUsuarioAtual();
  if (!perm.autorizado || !perm.clerkId) return null;
  const [linha] = await db
    .select({ userId: users.id, pacienteId: pacientes.id })
    .from(users)
    .innerJoin(pacientes, eq(pacientes.userId, users.id))
    .where(
      and(eq(users.clerkId, perm.clerkId), isNull(users.deletedAt), isNull(pacientes.deletedAt)),
    )
    .limit(1);
  return linha ?? null;
}

// ── Admin ─────────────────────────────────────────────────────

/** Histórico do comunicado deste paciente. Médico e paciente recebem erro, e a aba esconde o cartão. */
export async function listarComunicadosDoPaciente(
  pacienteId: string,
): Promise<Resposta<ComunicadoParaAdmin[]>> {
  const admin = await adminAtual();
  if (!admin) return { sucesso: false, erro: 'Apenas administradores acessam os comunicados.' };
  const id = idSchema.safeParse(pacienteId);
  if (!id.success) return { sucesso: false, erro: 'Paciente inválido.' };
  return { sucesso: true, dados: await listarParaAdmin(id.data) };
}

/** Disparo manual e individual: um clique, um paciente. */
export async function enviarComunicadoAtualizacaoDoacao(
  pacienteId: string,
): Promise<Resposta<{ comunicadoId: string; emailEnviado: boolean }>> {
  const admin = await adminAtual();
  if (!admin) return { sucesso: false, erro: 'Apenas administradores podem enviar comunicados.' };
  const id = idSchema.safeParse(pacienteId);
  if (!id.success) return { sucesso: false, erro: 'Paciente inválido.' };

  const r = await enviarComunicado({ pacienteId: id.data, adminUserId: admin.userId });
  if (!r.sucesso) return { sucesso: false, erro: r.erro };
  return { sucesso: true, dados: { comunicadoId: r.comunicadoId, emailEnviado: r.emailEnviado } };
}

/** Reenvia só o e-mail de aviso (o envelope não muda). */
export async function reenviarEmailDoComunicado(
  comunicadoId: string,
): Promise<Resposta<{ emailEnviado: boolean }>> {
  const admin = await adminAtual();
  if (!admin) return { sucesso: false, erro: 'Apenas administradores podem reenviar.' };
  const id = idSchema.safeParse(comunicadoId);
  if (!id.success) return { sucesso: false, erro: 'Comunicado inválido.' };

  const emailEnviado = await enviarAvisoPorEmail(id.data);
  await registrarAuditoria({
    userId: admin.userId,
    acao: 'atualizar',
    entidade: 'comunicados_assinatura',
    entidadeId: id.data,
    dadosDepois: { reenvioDeEmail: true, emailEnviado },
  });
  if (!emailEnviado) return { sucesso: false, erro: 'O e-mail não pôde ser enviado agora.' };
  return { sucesso: true, dados: { emailEnviado } };
}

/** "Atualizar status": pergunta ao DocuSign e retoma qualquer passo que tenha ficado pela metade. */
export async function atualizarStatusDoComunicado(
  comunicadoId: string,
): Promise<Resposta<{ status: string | null }>> {
  const admin = await adminAtual();
  if (!admin) return { sucesso: false, erro: 'Apenas administradores podem atualizar o status.' };
  const id = idSchema.safeParse(comunicadoId);
  if (!id.success) return { sucesso: false, erro: 'Comunicado inválido.' };

  const r = await sincronizarComunicado(id.data);
  if (!r.consultou && r.status === 'pendente') {
    return { sucesso: false, erro: 'Não foi possível consultar o DocuSign agora.' };
  }
  return { sucesso: true, dados: { status: r.status } };
}

// ── Paciente ──────────────────────────────────────────────────

/** Os comunicados JÁ enviados ao paciente da sessão. Quem não recebeu o disparo recebe []. */
export async function listarMeusComunicados(): Promise<Resposta<ComunicadoParaPaciente[]>> {
  const eu = await pacienteDaSessao();
  if (!eu) return { sucesso: true, dados: [] };
  return { sucesso: true, dados: await listarParaPaciente(eu.pacienteId) };
}

/** Gera o link do DocuSign para o paciente da sessão assinar o PRÓPRIO comunicado. */
export async function iniciarAssinaturaDoComunicado(
  comunicadoId: string,
): Promise<Resposta<{ url: string }>> {
  const eu = await pacienteDaSessao();
  if (!eu) return { sucesso: false, erro: 'Não autorizado.' };
  const id = idSchema.safeParse(comunicadoId);
  if (!id.success) return { sucesso: false, erro: 'Comunicado inválido.' };

  // Escopo de objeto: o comunicado precisa ser DESTE paciente. Não achar e não ser seu
  // respondem igual, para a ação não virar oráculo de ids.
  const [c] = await db
    .select({ id: comunicadosAssinatura.id })
    .from(comunicadosAssinatura)
    .where(
      and(
        eq(comunicadosAssinatura.id, id.data),
        eq(comunicadosAssinatura.pacienteId, eu.pacienteId),
      ),
    )
    .limit(1);
  if (!c) return { sucesso: false, erro: 'Comunicado não encontrado.' };

  const r = await gerarLinkDeAssinatura(c.id);
  if (!r.sucesso) return { sucesso: false, erro: r.erro };

  await registrarAuditoria({
    userId: eu.userId,
    acao: 'visualizar',
    entidade: 'comunicados_assinatura',
    entidadeId: c.id,
    dadosDepois: { abriuAssinatura: true },
  });
  return { sucesso: true, dados: { url: r.url } };
}
