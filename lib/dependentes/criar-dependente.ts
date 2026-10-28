/**
 * Cria um dependente E o vínculo dele ao responsável, numa transação — ADR-0033 D-09.
 *
 * 🔴 É A ÚNICA PORTA QUE CRIA VÍNCULO. O responsável cria o registro do dependente e o vínculo no mesmo
 * ato; ele NUNCA informa um paciente que já existe para "reivindicá-lo" (qualquer logado leria o
 * prontuário de um paciente alheio, OWASP API1 por declaração). Ligar pacientes já cadastrados é só do
 * admin (ADR-0033 D-13). Por isso esta função não recebe `pacienteId` nenhum.
 *
 * ⚠️ Mais um criador de ficha (D-09 conta 9 pontos de inserção em `pacientes`). Fica centralizado AQUI,
 * e não solto num décimo lugar.
 *
 * O que ela grava: um `users` técnico (D-04: papel `paciente`, SEM `clerkId`, e-mail que não existe), a
 * ficha em `pacientes`, o vínculo `ativo`, e o CPF do responsável em `responsaveis` (P-16).
 *
 * `dbTransacional()` e NÃO `db`: `db` resolve para `neon-http` em produção, que não implementa
 * `transaction()` (o método é um `throw`), e foi a causa raiz do Fluxo 1 · Portão 1.
 */
import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';

import { pacientes, responsaveis, responsaveisPacientes, users } from '@/db/schema';
import { dbTransacional } from '@/lib/db/transacional';
import { emailTecnicoDoDependente } from '@/lib/dependentes/regras';
import { somenteDigitosDoCpf } from '@/lib/validacao/cpf';

/** Erro com mensagem SEGURA para o usuário (sem detalhe interno, sem dado pessoal). */
export class ErroDoDependente extends Error {}

export interface EntradaDoDependente {
  /** id interno de `users` do responsável, já PROVADO pela action (papel `responsavel`). */
  responsavelUserId: string;
  nome: string;
  /** `AAAA-MM-DD`, já validada como data plausível. O dependente pode ter QUALQUER idade. */
  dataNascimento: string;
  parentesco: string;
  /** CPF do responsável (qualquer formatação). Já validado pela action. */
  cpfDoResponsavel: string;
}

export interface DependenteCriado {
  pacienteId: string;
  vinculoId: string;
}

export async function criarDependente(entrada: EntradaDoDependente): Promise<DependenteCriado> {
  const cpf = somenteDigitosDoCpf(entrada.cpfDoResponsavel);

  return dbTransacional().transaction(async (tx) => {
    // ── O responsável (1:1 com users). `onConflictDoNothing` cobre a corrida entre dois cadastros.
    await tx
      .insert(responsaveis)
      .values({ userId: entrada.responsavelUserId, cpf })
      .onConflictDoNothing({ target: responsaveis.userId });

    const [resp] = await tx
      .select({ id: responsaveis.id, cpf: responsaveis.cpf })
      .from(responsaveis)
      .where(eq(responsaveis.userId, entrada.responsavelUserId))
      .limit(1);

    if (!resp) throw new Error('responsável não encontrado após o upsert');
    if (!resp.cpf) {
      await tx.update(responsaveis).set({ cpf }).where(eq(responsaveis.id, resp.id));
    } else if (resp.cpf !== cpf) {
      // Nunca sobrescreve em silêncio o CPF já cadastrado (proibição 4 do CLAUDE.md).
      throw new ErroDoDependente(
        'O CPF informado é diferente do CPF já cadastrado para você. Fale com o suporte para corrigi-lo.',
      );
    }

    // ── O dependente: um `users` técnico, sem credencial (D-04).
    const [tecnico] = await tx
      .insert(users)
      .values({
        email: emailTecnicoDoDependente(createId()),
        nome: entrada.nome,
        role: 'paciente',
      })
      .returning({ id: users.id });

    const [ficha] = await tx
      .insert(pacientes)
      .values({
        userId: tecnico.id,
        medicoId: null,
        dataNascimento: entrada.dataNascimento,
        status: 'aguardando_consulta',
        jornadaFase: 'acolhimento',
      })
      .returning({ id: pacientes.id });

    // ── O vínculo, ativo. O índice único parcial do banco garante um só responsável por paciente.
    const [vinculo] = await tx
      .insert(responsaveisPacientes)
      .values({
        responsavelUserId: entrada.responsavelUserId,
        pacienteId: ficha.id,
        parentesco: entrada.parentesco,
      })
      .returning({ id: responsaveisPacientes.id });

    return { pacienteId: ficha.id, vinculoId: vinculo.id };
  });
}
