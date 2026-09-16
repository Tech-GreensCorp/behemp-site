'use server';

import { db } from '@/lib/db';
import { autorizacoesAnvisa, logsAuditoria, users, pacientes } from '@/db/schema';
import { eq, and, isNull, notInArray } from 'drizzle-orm';
import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';

export async function iniciarRenovacao(autorizacaoId: string) {
  const { userId } = await auth();
  if (!userId) return { sucesso: false, erro: 'Não autenticado' };

  // 1. Identificar usuário atual e role
  const [currentUser] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.clerkId, userId))
    .limit(1);

  if (!currentUser) return { sucesso: false, erro: 'Usuário não encontrado' };

  // 2. Buscar autorização anterior
  const [anterior] = await db
    .select()
    .from(autorizacoesAnvisa)
    .where(and(eq(autorizacoesAnvisa.id, autorizacaoId), isNull(autorizacoesAnvisa.deletedAt)))
    .limit(1);

  if (!anterior) return { sucesso: false, erro: 'Autorização não encontrada' };

  // 3. Validar escopo por role
  if (currentUser.role !== 'admin') {
    if (currentUser.role === 'paciente') {
      const [pac] = await db
        .select({ id: pacientes.id })
        .from(pacientes)
        .where(eq(pacientes.userId, currentUser.id))
        .limit(1);

      if (!pac || pac.id !== anterior.pacienteId) {
        return { sucesso: false, erro: 'Acesso negado' };
      }
    } else {
      return { sucesso: false, erro: 'Acesso negado' };
    }
  }

  // 4. Impedir duplicidade
  const [renovacaoAberta] = await db
    .select({ id: autorizacoesAnvisa.id })
    .from(autorizacoesAnvisa)
    .where(
      and(
        eq(autorizacoesAnvisa.autorizacaoAnteriorId, anterior.id),
        isNull(autorizacoesAnvisa.deletedAt),
        notInArray(autorizacoesAnvisa.status, ['aprovado', 'rejeitado']),
      ),
    )
    .limit(1);

  if (renovacaoAberta) {
    return { sucesso: false, erro: 'Já existe uma renovação em andamento para esta autorização.' };
  }

  // 5. Checklist de documentos
  // Copia não-vencíveis, zera os vencíveis.
  const docsVenciveis = ['receita_medica', 'comprovante_residencia', 'laudo_medico'];
  const docsAntigos =
    (anterior.documentos as {
      tipo: string;
      enviado: boolean;
      urlBlob: string | null;
      nomeArquivo: string | null;
      validado: boolean;
    }[]) || [];

  const novoChecklist = docsAntigos.map((doc) => {
    if (docsVenciveis.includes(doc.tipo)) {
      return { ...doc, enviado: false, validado: false, urlBlob: null, nomeArquivo: null };
    }
    return doc; // Mantém RG, certidões, procuração, etc.
  });

  // 6. Criar nova autorização
  const [novaAutorizacao] = await db
    .insert(autorizacoesAnvisa)
    .values({
      pacienteId: anterior.pacienteId,
      medicoId: anterior.medicoId,
      prescricaoId: anterior.prescricaoId,
      autorizacaoAnteriorId: anterior.id,
      modalidade: anterior.modalidade,
      status: 'pendente',
      documentos: novoChecklist,
      formulario8833: anterior.formulario8833, // Opcional, copiando o form antigo pra facilitar
    })
    .returning();

  // 7. Auditoria
  await db
    .insert(logsAuditoria)
    .values({
      acao: 'CRIAR_RENOVACAO',
      entidade: 'autorizacoes_anvisa',
      entidadeId: novaAutorizacao.id,
      dadosDepois: { autorizacaoAnteriorId: anterior.id },
    })
    .catch(() => {});

  revalidatePath('/admin/monitoramento-anvisa');
  revalidatePath('/paciente/anvisa');

  return { sucesso: true, dados: novaAutorizacao };
}
