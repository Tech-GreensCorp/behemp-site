/**
 * Escopo de objeto para paciente.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * Verificar que quem chama é médico NÃO basta. Médico autenticado + `pacienteId` alheio é
 * OWASP API1:2023 (BOLA) — o que `.claude/rules/seguranca-lgpd.md` chama de "o risco número
 * um deste projeto". A Sprint 1 corrigiu essa classe em 7 lugares da teleconsulta com
 * `garantirDonoDaSala`; este é o equivalente para a cadeia clínica do paciente.
 *
 * A norma diz o mesmo, e é mais forte que a boa prática: `CAN-02` (RDC 1.015/2026, Art. 36)
 * restringe a prescrição de produtos de Cannabis aos profissionais "que acompanham
 * clinicamente o paciente".
 *
 * POR QUE AQUI, E NÃO COPIADO PELA TERCEIRA VEZ
 * O mesmo helper já existe DUAS vezes, declarado localmente em `app/_actions/revisao-ia.ts:33`
 * e `app/_actions/anamnese-baseline.ts:52`. Duas cópias já divergem no texto do erro; três
 * divergiriam na regra. ADR-0012 D-05, rejeitado R-10.
 *
 * ⚠️ Os dois arquivos acima NÃO foram alterados — refatorá-los é trabalho próprio, catalogado
 * em `docs/04-LISTA-DE-AFAZERES.md` Item 13.5. Este módulo nasce para o caminho NOVO.
 */
import { and, eq, isNull } from 'drizzle-orm';

import { medicos, pacientes, users } from '@/db/schema';
import { db } from '@/lib/db';
import { obterUsuarioAtual } from '@/lib/auth/permissions';

export interface EscopoDoPaciente {
  /** id interno de `medicos`, nunca o do Clerk. */
  medicoId: string;
  /** id interno de `users` — é o que `registrarAuditoria` espera. */
  userId: string;
  /** id de `pacientes` já PROVADO como deste médico. Use este, nunca o que veio do cliente. */
  pacienteId: string;
  /** `true` quando quem passou foi um admin, não o médico responsável. */
  viaAdmin: boolean;
}

export type ResultadoEscopo = { ok: true; escopo: EscopoDoPaciente } | { ok: false; erro: string };

/**
 * Garante que quem chama é o médico DESTE paciente.
 *
 * `pacientes.medicoId` é a ligação. Sem esta conjunção, um médico autenticado lê e escreve o
 * plano terapêutico de qualquer paciente da plataforma.
 *
 * ⚠️ ADMIN PASSA — e isso é deliberado, não descuido: é o comportamento de
 * `verificarMedicoOuAdmin`, usado por todas as actions clínicas de hoje, e mudá-lo aqui
 * criaria duas regras de admin no mesmo produto. Quem passou por essa porta vem marcado
 * (`viaAdmin`) para que a auditoria registre a diferença. **Se o admin deve ou não ver
 * dosagem de qualquer paciente é regra de negócio, e está na fila para o dono**
 * (`docs/04-LISTA-DE-AFAZERES.md` Item 13.5).
 */
export async function garantirMedicoDoPaciente(pacienteId: string): Promise<ResultadoEscopo> {
  const perm = await obterUsuarioAtual();
  if (!perm.autorizado || !perm.clerkId) return { ok: false, erro: 'Não autenticado' };

  const [user] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.clerkId, perm.clerkId))
    .limit(1);
  if (!user) return { ok: false, erro: 'Usuário não encontrado' };
  if (user.role !== 'medico' && user.role !== 'admin') {
    return { ok: false, erro: 'Apenas o médico responsável registra conduta' };
  }

  const [medico] = await db
    .select({ id: medicos.id })
    .from(medicos)
    .where(eq(medicos.userId, user.id))
    .limit(1);

  const ehAdmin = user.role === 'admin';
  if (!medico && !ehAdmin) return { ok: false, erro: 'Perfil de médico não encontrado' };

  // A conjunção que importa: o paciente tem de ser deste médico.
  const condicoes = [eq(pacientes.id, pacienteId), isNull(pacientes.deletedAt)];
  if (medico && !ehAdmin) condicoes.push(eq(pacientes.medicoId, medico.id));

  const [paciente] = await db
    .select({ id: pacientes.id, medicoId: pacientes.medicoId })
    .from(pacientes)
    .where(and(...condicoes))
    .limit(1);

  // 404 indistinto: responder diferente para "não existe" e "não é seu" transforma a action
  // em oráculo de enumeração de pacientes.
  if (!paciente) return { ok: false, erro: 'Paciente não encontrado' };

  // Admin sem perfil de médico opera em nome do médico responsável pelo paciente.
  const medicoIdEfetivo = medico?.id ?? paciente.medicoId;
  if (!medicoIdEfetivo) return { ok: false, erro: 'Paciente sem médico responsável' };

  return {
    ok: true,
    escopo: {
      medicoId: medicoIdEfetivo,
      userId: user.id,
      pacienteId: paciente.id,
      viaAdmin: ehAdmin && (!medico || medico.id !== paciente.medicoId),
    },
  };
}
