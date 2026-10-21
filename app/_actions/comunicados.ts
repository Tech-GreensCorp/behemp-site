'use server';

import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';

import { comunicadosAssinatura, pacientes, triagens, users } from '@/db/schema';
import { verificarAdmin, obterUsuarioAtual } from '@/lib/auth';
import {
  enviarAvisoPorEmail,
  enviarComunicado,
  gerarLinkDeAssinatura,
  listarParaAdmin,
  listarParaPaciente,
  reiniciarComunicado,
  sincronizarComunicado,
  type ComunicadoParaAdmin,
  type ComunicadoParaPaciente,
} from '@/lib/comunicados/assinatura';
import { TIPO_ATUALIZACAO_PROGRAMA_DOACAO } from '@/lib/comunicados/catalogo';
import {
  LIMITE_DO_LOTE,
  situacaoNoLote,
  type AlvoDaPrevia,
  type TriagemResolvida,
} from '@/lib/comunicados/lote';
import { db } from '@/lib/db';
import { normalizarEmail } from '@/lib/triagens/e-paciente';
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

/** Disparo manual de UM paciente. O lote (telas Pacientes e Triagens) chama esta mesma action, um por vez. */
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

const idsDoLoteSchema = z.array(idSchema).min(1).max(LIMITE_DO_LOTE);

/**
 * Pré-checagem do lote: diz, para cada paciente, se o envio vai acontecer ou por que não. Só LÊ —
 * nada é enviado aqui. O envio de cada um é feito depois, um a um, por
 * `enviarComunicadoAtualizacaoDoacao`, que repete estas mesmas conferências no servidor.
 */
export async function previaDoLoteDeComunicados(
  pacienteIds: string[],
): Promise<Resposta<AlvoDaPrevia[]>> {
  const admin = await adminAtual();
  if (!admin) return { sucesso: false, erro: 'Apenas administradores podem enviar comunicados.' };
  const ids = idsDoLoteSchema.safeParse(pacienteIds);
  if (!ids.success) {
    return { sucesso: false, erro: `Selecione de 1 a ${LIMITE_DO_LOTE} pacientes por envio.` };
  }
  const unicos = [...new Set(ids.data)];

  const fichas = await db
    .select({ id: pacientes.id, nome: users.nome, email: users.email, cpf: pacientes.cpf })
    .from(pacientes)
    .innerJoin(users, eq(pacientes.userId, users.id))
    .where(
      and(inArray(pacientes.id, unicos), isNull(pacientes.deletedAt), isNull(users.deletedAt)),
    );
  const ativos = await db
    .select({ pacienteId: comunicadosAssinatura.pacienteId })
    .from(comunicadosAssinatura)
    .where(
      and(
        inArray(comunicadosAssinatura.pacienteId, unicos),
        eq(comunicadosAssinatura.tipo, TIPO_ATUALIZACAO_PROGRAMA_DOACAO),
        inArray(comunicadosAssinatura.status, ['pendente', 'assinado']),
      ),
    );
  const comEnvioAtivo = new Set(ativos.map((a) => a.pacienteId));
  const porId = new Map(fichas.map((f) => [f.id, f]));

  return {
    sucesso: true,
    dados: unicos.map((pacienteId) => {
      const f = porId.get(pacienteId);
      return {
        pacienteId,
        nome: f?.nome ?? null,
        situacao: situacaoNoLote({
          existe: !!f,
          email: f?.email ?? null,
          cpf: f?.cpf ?? null,
          temEnvioAtivo: comEnvioAtivo.has(pacienteId),
        }),
      };
    }),
  };
}

/**
 * Triagem não tem FK para paciente: o único elo é o e-mail (mesma regra de
 * `lib/triagens/e-paciente.ts` — ficha ATIVA, ignorando caixa e espaços). Devolve, para cada
 * triagem escolhida, a ficha a que ela corresponde ou `null` quando não há cadastro.
 */
export async function resolverPacientesDasTriagens(
  triagemIds: string[],
): Promise<Resposta<TriagemResolvida[]>> {
  const admin = await adminAtual();
  if (!admin) return { sucesso: false, erro: 'Apenas administradores podem enviar comunicados.' };
  const ids = idsDoLoteSchema.safeParse(triagemIds);
  if (!ids.success) {
    return { sucesso: false, erro: `Selecione de 1 a ${LIMITE_DO_LOTE} triagens por envio.` };
  }

  const linhas = await db
    .select({ id: triagens.id, emailContato: triagens.emailContato })
    .from(triagens)
    .where(inArray(triagens.id, ids.data));
  const emailDe = new Map(linhas.map((t) => [t.id, normalizarEmail(t.emailContato)]));
  const emails = [...new Set([...emailDe.values()].filter((e): e is string => e !== null))];

  const pacientePorEmail = new Map<string, string>();
  if (emails.length > 0) {
    const fichas = await db
      .select({ pacienteId: pacientes.id, email: sql<string>`lower(trim(${users.email}))` })
      .from(pacientes)
      .innerJoin(users, eq(pacientes.userId, users.id))
      .where(
        and(
          isNull(pacientes.deletedAt),
          isNull(users.deletedAt),
          sql`lower(trim(${users.email})) IN (${sql.join(
            emails.map((e) => sql`${e}`),
            sql`, `,
          )})`,
        ),
      );
    for (const f of fichas)
      if (!pacientePorEmail.has(f.email)) pacientePorEmail.set(f.email, f.pacienteId);
  }

  return {
    sucesso: true,
    dados: ids.data.map((triagemId) => {
      const email = emailDe.get(triagemId) ?? null;
      return { triagemId, pacienteId: email ? (pacientePorEmail.get(email) ?? null) : null };
    }),
  };
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

const motivoSchema = z
  .string()
  .trim()
  .min(5, 'Informe o motivo (mínimo de 5 caracteres).')
  .max(500, 'O motivo pode ter no máximo 500 caracteres.');

/**
 * Reinicia o fluxo de um comunicado JÁ ASSINADO, para permitir um novo envio ao paciente.
 *
 * Nada é apagado: a linha e o PDF assinado ficam como histórico de auditoria, com quem reiniciou,
 * quando e o motivo. Só admin.
 */
export async function reiniciarFluxoDoComunicado(
  comunicadoId: string,
  motivo: string,
): Promise<Resposta<{ reiniciado: true }>> {
  const admin = await adminAtual();
  if (!admin) return { sucesso: false, erro: 'Apenas administradores podem reiniciar o fluxo.' };
  const id = idSchema.safeParse(comunicadoId);
  if (!id.success) return { sucesso: false, erro: 'Comunicado inválido.' };
  const m = motivoSchema.safeParse(motivo);
  if (!m.success) return { sucesso: false, erro: m.error.issues[0]?.message ?? 'Motivo inválido.' };

  const r = await reiniciarComunicado({
    comunicadoId: id.data,
    adminUserId: admin.userId,
    motivo: m.data,
  });
  if (!r.sucesso) return { sucesso: false, erro: r.erro };
  return { sucesso: true, dados: { reiniciado: true } };
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
