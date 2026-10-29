'use server';

/**
 * O responsável cadastra um dependente — ADR-0033 D-09.
 *
 * Fluxo seguro (CLAUDE.md): autenticar e provar o PAPEL (lido do banco) → validar com Zod → criar o
 * dependente E o vínculo numa transação → auditar → revalidar.
 *
 * 🔴 A action NÃO recebe `pacienteId`. O responsável cria o dependente do zero; ele nunca informa um
 * paciente que já existe para ligá-lo a si (OWASP API1 por declaração). Ligar pacientes já cadastrados
 * é só do admin (D-13).
 *
 * ⚠️ A auditoria leva ids e o parentesco, NUNCA o nome, o CPF nem a data de nascimento do dependente.
 */
import { revalidatePath } from 'next/cache';

import { responsavelDaSessao } from '@/lib/auth/escopo-do-responsavel';
import { criarDependente, ErroDoDependente } from '@/lib/dependentes/criar-dependente';
import { cadastroDeDependenteSchema } from '@/lib/dependentes/ficha-do-dependente';
import { motivoLegivel } from '@/lib/erros/motivo-legivel';
import { registrarAuditoria } from '@/lib/utils/audit';

export type ResultadoDoCadastroDeDependente = {
  sucesso: boolean;
  dados?: { pacienteId: string };
  erro?: string;
};

export async function cadastrarDependente(
  entrada: unknown,
): Promise<ResultadoDoCadastroDeDependente> {
  try {
    const responsavel = await responsavelDaSessao();
    if (!responsavel) return { sucesso: false, erro: 'Acesso negado.' };

    const parsed = cadastroDeDependenteSchema.safeParse(entrada);
    if (!parsed.success) {
      return { sucesso: false, erro: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
    }

    // O Zod DESCARTA o que o schema não conhece: os campos internos da associação nunca chegam aqui.
    const { parentesco, cpfDoResponsavel, ...ficha } = parsed.data;
    const criado = await criarDependente({
      responsavelUserId: responsavel.id,
      responsavelNome: responsavel.nome,
      cpfDoResponsavel,
      parentesco,
      ficha,
    });

    await registrarAuditoria({
      userId: responsavel.id,
      acao: 'criar',
      entidade: 'pacientes',
      entidadeId: criado.pacienteId,
      dadosDepois: {
        atuandoComo: 'responsavel',
        dependente: true,
        pacienteId: criado.pacienteId,
        vinculoId: criado.vinculoId,
        parentesco,
      },
    });

    // O menu lateral (layout) lista os dependentes: revalida o layout, não só a página.
    revalidatePath('/responsavel', 'layout');
    return { sucesso: true, dados: { pacienteId: criado.pacienteId } };
  } catch (erro) {
    if (erro instanceof ErroDoDependente) return { sucesso: false, erro: erro.message };
    // Sem PII e sem a query: o `motivoLegivel` reduz o erro do banco a código, restrição e tabela.
    console.error('[Action] Erro ao cadastrar dependente:', motivoLegivel(erro));
    return { sucesso: false, erro: 'Não foi possível cadastrar o dependente. Tente novamente.' };
  }
}
