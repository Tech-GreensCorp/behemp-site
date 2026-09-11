/**
 * QUEM PODE LER UM DOCUMENTO DE PACIENTE.
 *
 * Irmão de `escopo-sala.ts` e `escopo-paciente.ts`, e pelo mesmo motivo: papel certo com id
 * alheio é **OWASP API1 (BOLA)** — o risco número um deste projeto. Um médico autenticado que
 * chame `/api/documentos/<id qualquer>/arquivo` não pode receber o RG de um paciente que não é
 * dele.
 *
 * 🔴 E ESTE ARQUIVO EXISTE PORQUE O DOCUMENTO SAIU DO STORE PÚBLICO.
 *
 * Enquanto o blob era público, "quem pode ler" era *qualquer um com a URL* — obscuridade não é
 * controle de acesso. Ao gravar privado, a pergunta passa a ter resposta, e ela precisa ser
 * respondida em um lugar só.
 */

import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/lib/db';
import { documentos, medicos, pacientes, users } from '@/db/schema';
import { obterUsuarioAtual } from '@/lib/auth/permissions';

export type ResultadoDeLeitura =
  | {
      ok: true;
      documento: { id: string; urlBlob: string; nomeArquivo: string | null };
      /** Quem leu — a auditoria precisa dele, e buscá-lo de novo seria uma segunda consulta. */
      userId: string;
    }
  | { ok: false; status: 401 | 403 | 404; erro: string };

/**
 * Devolve o documento se — e só se — quem chama pode lê-lo.
 *
 * Três podem: **o próprio paciente**, **o médico responsável por ele**, e **admin**.
 *
 * ⚠️ TUDO O QUE NÃO PODE RESPONDE 404, nunca 403.
 *
 * Distinguir "não existe" de "existe e não é seu" transforma a rota em oráculo: com um laço
 * sobre ids, alguém descobre quantos documentos a plataforma tem e quais existem. É a mesma
 * decisão de `garantirMedicoDoPaciente`, e ela vale ainda mais aqui — o objeto é um arquivo
 * com RG e laudo.
 */
export async function garantirLeitorDoDocumento(documentoId: string): Promise<ResultadoDeLeitura> {
  const perm = await obterUsuarioAtual();
  if (!perm.autorizado || !perm.clerkId) {
    return { ok: false, status: 401, erro: 'Não autenticado' };
  }

  const [user] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.clerkId, perm.clerkId))
    .limit(1);
  if (!user) return { ok: false, status: 404, erro: 'Documento não encontrado' };

  const [doc] = await db
    .select({
      id: documentos.id,
      urlBlob: documentos.urlBlob,
      nomeArquivo: documentos.nomeArquivo,
      pacienteId: documentos.pacienteId,
    })
    .from(documentos)
    .where(and(eq(documentos.id, documentoId), isNull(documentos.deletedAt)))
    .limit(1);
  if (!doc) return { ok: false, status: 404, erro: 'Documento não encontrado' };

  if (user.role === 'admin') {
    return { ok: true, documento: doc, userId: user.id };
  }

  const [paciente] = await db
    .select({ id: pacientes.id, userId: pacientes.userId, medicoId: pacientes.medicoId })
    .from(pacientes)
    .where(and(eq(pacientes.id, doc.pacienteId), isNull(pacientes.deletedAt)))
    .limit(1);
  if (!paciente) return { ok: false, status: 404, erro: 'Documento não encontrado' };

  // 1) o próprio paciente
  if (paciente.userId === user.id) return { ok: true, documento: doc, userId: user.id };

  // 2) o médico DESTE paciente — a conjunção é o que importa
  if (user.role === 'medico') {
    const [medico] = await db
      .select({ id: medicos.id })
      .from(medicos)
      .where(eq(medicos.userId, user.id))
      .limit(1);
    if (medico && paciente.medicoId === medico.id) {
      return { ok: true, documento: doc, userId: user.id };
    }
  }

  // Qualquer outro caso responde igual a "não existe".
  return { ok: false, status: 404, erro: 'Documento não encontrado' };
}
