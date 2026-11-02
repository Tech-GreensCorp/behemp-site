'use server';

import { and, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';

import { pacientes, triagens, users } from '@/db/schema';
import { verificarAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { dadosDoPacienteDaTriagem } from '@/lib/triagens/dados-do-paciente';
import { criarPaciente } from '@/app/_actions/pacientes';

/**
 * Converte uma triagem em paciente, depois da análise da equipe. SÓ ADMIN.
 *
 * Quando acontece: por ato do admin, no botão "Converter em paciente" do detalhe da triagem. Nada
 * converte sozinho — triagem é interesse declarado, ficha é cadastro aceito.
 *
 * O que faz: reaproveita `criarPaciente` (a mesma porta do "Novo paciente"), então ganha de graça
 * o user base, a ficha, a auditoria, a conta de acesso e o e-mail de boas-vindas. A ficha nasce
 * agora (`created_at`), e por isso aparece no TOPO de Pacientes (ordenada do mais recente).
 *
 * O que NÃO faz: apagar ou alterar a triagem. Ela continua na lista e passa a mostrar a flag
 * "Paciente" (derivada do e-mail, lib/triagens/e-paciente.ts) — sem FK, sem estado novo a manter.
 *
 * Idempotência / sem duplicar:
 *  · e-mail já tem ficha ATIVA → não cria nada, devolve a ficha existente (`jaEraPaciente`);
 *  · e-mail tem ficha ARQUIVADA → recusa. A coluna `user_id` é única, então criar outra ficha violaria o unique;
 *    reativar é ato próprio, em Pacientes → filtro "Arquivado" → Reativar (reativarPacienteAdmin);
 *  · e-mail é de admin/médico → recusa (a conta tem outro papel).
 */

const idSchema = z.string().min(1).max(64);

type Resposta =
  | { sucesso: true; dados: { pacienteId: string; jaEraPaciente: boolean; acessoCriado: boolean; boasVindasEnviadas: boolean; aviso?: string } }
  | { sucesso: false; erro: string };

export async function converterTriagemEmPaciente(triagemId: string): Promise<Resposta> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: 'Sem permissão' };
    const id = idSchema.safeParse(triagemId);
    if (!id.success) return { sucesso: false, erro: 'Triagem inválida' };

    const [triagem] = await db
      .select({
        nomeContato: triagens.nomeContato,
        emailContato: triagens.emailContato,
        telefoneContato: triagens.telefoneContato,
        dados: sql<Record<string, unknown>>`${triagens.dados} - 'relatorio_medico_arquivo'::text`,
      })
      .from(triagens)
      .where(eq(triagens.id, id.data))
      .limit(1);
    if (!triagem) return { sucesso: false, erro: 'Triagem não encontrada' };

    const dados = dadosDoPacienteDaTriagem(triagem);
    if (!dados) {
      return {
        sucesso: false,
        erro: 'A triagem não tem nome e e-mail válidos. Cadastre o paciente manualmente.',
      };
    }

    const [existente] = await db
      .select({ userId: users.id, role: users.role, pacienteId: pacientes.id, arquivadoEm: pacientes.deletedAt })
      .from(users)
      .leftJoin(pacientes, eq(pacientes.userId, users.id))
      .where(and(sql`lower(${users.email}) = ${dados.email}`, isNull(users.deletedAt)))
      .limit(1);

    if (existente) {
      if (existente.role !== 'paciente') {
        return { sucesso: false, erro: 'Este e-mail pertence a uma conta de admin ou médico.' };
      }
      if (existente.pacienteId && existente.arquivadoEm === null) {
        return {
          sucesso: true,
          dados: {
            pacienteId: existente.pacienteId,
            jaEraPaciente: true,
            acessoCriado: false,
            boasVindasEnviadas: false,
          },
        };
      }
      if (existente.pacienteId) {
        return {
          sucesso: false,
          erro: 'Este e-mail pertence a um paciente arquivado. Reative-o em Pacientes (filtro "Arquivado") em vez de converter.',
        };
      }
    }

    const r = await criarPaciente(dados);
    if (!r.sucesso || !r.dados) return { sucesso: false, erro: r.erro ?? 'Erro ao converter a triagem' };

    return {
      sucesso: true,
      dados: {
        pacienteId: r.dados.pacienteId,
        jaEraPaciente: false,
        acessoCriado: r.dados.acessoCriado,
        boasVindasEnviadas: r.dados.boasVindasEnviadas,
        aviso: r.dados.avisoDeAcesso,
      },
    };
  } catch (error) {
    console.error('[Action] Erro ao converter triagem em paciente:', error instanceof Error ? error.name : 'desconhecido');
    return { sucesso: false, erro: 'Erro ao converter a triagem' };
  }
}
