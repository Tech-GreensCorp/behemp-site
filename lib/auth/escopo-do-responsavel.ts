/**
 * Escopo de objeto do RESPONSÁVEL — ADR-0033 D-03.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * Ser `responsavel` NÃO dá acesso a paciente nenhum. Papel certo + `pacienteId` alheio é OWASP API1:2023
 * (BOLA), o risco número um deste projeto. O acesso a cada dependente é PROVADO aqui, pelo vínculo
 * `ativo` em `responsaveis_pacientes`, e NENHUMA action que aceite um `pacienteId` do cliente pode
 * pular esta porta. É o equivalente, para o responsável, de `garantirMedicoDoPaciente`
 * (`lib/auth/escopo-paciente.ts`).
 *
 * 🔴 DUAS REGRAS QUE ESTE ARQUIVO SUSTENTA
 *   1. **404 indistinto.** "Não existe", "não é seu" e "o vínculo encerrou" respondem IGUAL: responder
 *      diferente transformaria a action em oráculo de enumeração de pacientes.
 *   2. **Quem passa é quem tem vínculo, e só ele.** Admin e médico têm as próprias portas; aqui, quem não é
 *      `responsavel` nem `paciente` (lido do BANCO, não do claim da sessão) é recusado. Ser `paciente` não basta:
 *      sem vínculo ativo com ESTE dependente, a resposta é a mesma de "não existe".
 *
 * ⚠️ O vínculo encerrado NÃO abre acesso: o filtro é `status = 'ativo'`, e o índice único parcial do
 * banco garante que só há um responsável ativo por paciente (P-07).
 */
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

import { pacientes, responsaveisPacientes, users } from '@/db/schema';
import { db } from '@/lib/db';
import { obterUsuarioAtual } from '@/lib/auth/permissions';

export interface EscopoDoResponsavel {
  /** id interno de `users` do responsável — é o que `registrarAuditoria` espera. */
  responsavelUserId: string;
  /** id de `pacientes` já PROVADO como dependente deste responsável. Use este, nunca o do cliente. */
  pacienteId: string;
  /** id de `users` do dependente (o registro técnico, sem credencial). */
  pacienteUserId: string;
  vinculoId: string;
}

export type ResultadoEscopoResponsavel =
  | { ok: true; escopo: EscopoDoResponsavel }
  | { ok: false; erro: string };

/** A mensagem é UMA só, de propósito (404 indistinto). */
const NAO_ENCONTRADO = 'Paciente não encontrado';

/**
 * Quem pode RESPONDER por dependentes: o `responsavel` (que não faz o próprio tratamento) E o `paciente`
 * (que faz o próprio tratamento e também cuida de outra pessoa). Regra de Dryelle em 28/10/2026, que
 * revogou a P-02 ("um usuário só pode ser uma coisa"). Admin e médico NÃO entram aqui: têm as próprias portas.
 *
 * ⚠️ O papel NÃO é o que prova o acesso a um dependente: é o vínculo `ativo`. Um `paciente` sem vínculo
 * continua sem enxergar nada que não seja dele.
 */
const PAPEIS_QUE_PODEM_RESPONDER: string[] = ['responsavel', 'paciente'];

/** O responsável da sessão, lido do banco. `null` para quem não pode responder por ninguém. */
export async function responsavelDaSessao(): Promise<{ id: string } | null> {
  const perm = await obterUsuarioAtual();
  if (!perm.autorizado || !perm.clerkId) return null;

  const [user] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(and(eq(users.clerkId, perm.clerkId), isNull(users.deletedAt)))
    .limit(1);

  return user && PAPEIS_QUE_PODEM_RESPONDER.includes(user.role) ? { id: user.id } : null;
}

/**
 * Garante que o usuário logado é o responsável DESTE dependente. O `pacienteId` vem do cliente: é
 * validado e provado pelo vínculo antes de qualquer uso.
 */
export async function garantirResponsavelDoPaciente(
  pacienteId: string,
): Promise<ResultadoEscopoResponsavel> {
  const parsed = z.string().min(1).max(64).safeParse(pacienteId);
  if (!parsed.success) return { ok: false, erro: NAO_ENCONTRADO };

  const responsavel = await responsavelDaSessao();
  if (!responsavel) return { ok: false, erro: NAO_ENCONTRADO };

  const [achado] = await db
    .select({
      vinculoId: responsaveisPacientes.id,
      pacienteId: pacientes.id,
      pacienteUserId: pacientes.userId,
    })
    .from(responsaveisPacientes)
    .innerJoin(pacientes, eq(pacientes.id, responsaveisPacientes.pacienteId))
    .where(
      and(
        eq(responsaveisPacientes.pacienteId, parsed.data),
        eq(responsaveisPacientes.responsavelUserId, responsavel.id),
        eq(responsaveisPacientes.status, 'ativo'),
        isNull(pacientes.deletedAt),
      ),
    )
    .limit(1);

  if (!achado) return { ok: false, erro: NAO_ENCONTRADO };

  return {
    ok: true,
    escopo: {
      responsavelUserId: responsavel.id,
      pacienteId: achado.pacienteId,
      pacienteUserId: achado.pacienteUserId,
      vinculoId: achado.vinculoId,
    },
  };
}

export interface DependenteDoResponsavel {
  vinculoId: string;
  pacienteId: string;
  nome: string;
  dataNascimento: string | null;
  parentesco: string;
}

/** Os dependentes do responsável logado, só os de vínculo ativo. Vazio para quem não é responsável. */
export async function listarDependentesDoResponsavel(): Promise<DependenteDoResponsavel[]> {
  const responsavel = await responsavelDaSessao();
  if (!responsavel) return [];

  return db
    .select({
      vinculoId: responsaveisPacientes.id,
      pacienteId: pacientes.id,
      nome: users.nome,
      dataNascimento: pacientes.dataNascimento,
      parentesco: responsaveisPacientes.parentesco,
    })
    .from(responsaveisPacientes)
    .innerJoin(pacientes, eq(pacientes.id, responsaveisPacientes.pacienteId))
    .innerJoin(users, eq(users.id, pacientes.userId))
    .where(
      and(
        eq(responsaveisPacientes.responsavelUserId, responsavel.id),
        eq(responsaveisPacientes.status, 'ativo'),
        isNull(pacientes.deletedAt),
      ),
    )
    .orderBy(users.nome);
}
