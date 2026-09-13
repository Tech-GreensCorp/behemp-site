/**
 * O CONSENTIMENTO AINDA VALE, AGORA? — a pergunta que o enviador não fazia.
 *
 * 🔴 ADR-0022, G9 e D-14. É o achado mais grave da investigação, e é de LGPD.
 *
 * O consentimento era conferido **uma vez**, quando o evento entrava na fila
 * (`enfileirar-transferencia.ts` → `pode-transferir.ts`). O `enviador` pegava o `payload`
 * gravado e mandava. **Entre os dois momentos, o paciente pode revogar — e o dado saía assim
 * mesmo.**
 *
 * ⚠️ E A JANELA NÃO É TEÓRICA. A fila anda por GitHub Actions a cada 5 minutos, com até 6
 * tentativas e backoff de até 60 minutos (`enviador.ts`). Um evento pode sair **horas** depois
 * de enfileirado.
 *
 * 🔴 LGPD art. 8º §5º: a revogação é _"a qualquer momento, mediante manifestação expressa, por
 * procedimento gratuito e facilitado"_. Um consentimento que só vale até a fila rodar **não é
 * revogável a qualquer momento** — é revogável até um instante que o paciente não conhece.
 *
 * ⚠️ LÊ DO BANCO, SEMPRE. O `payload` do evento é imutável de propósito (é o que o parceiro
 * vai receber, e reescrevê-lo mudaria o que foi autorizado). Por isso a checagem não pode sair
 * dele: tem de ir à tabela, agora, no momento do envio.
 */

import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/lib/db';
import { pacientes, solicitacoesCadastro } from '@/db/schema';

import { FINALIDADES, type Finalidade } from './consentimento';
import { finalidadesVigentes } from './consentimento-registrado';
import type { TipoDeEvento } from './destinos-do-envio';

/**
 * Que finalidade cada tipo de evento exige.
 *
 * 🔴 OS TRÊS EXIGEM `retorno_ao_parceiro`, e é a mesma razão: todos levam informação do
 * paciente **para fora da BeHemp**. O que muda é o conteúdo, não a natureza do ato — e é a
 * natureza que o consentimento autoriza.
 *
 * ⚠️ Tipo novo sem entrada aqui **não é enviado**. Falha fechada: é melhor um aviso preso na
 * fila, visível, do que dado saindo sob uma finalidade que ninguém declarou.
 */
const FINALIDADE_POR_TIPO: Record<TipoDeEvento, Finalidade> = {
  receita_emitida: FINALIDADES.retornoAoParceiro,
  anvisa_aprovada: FINALIDADES.retornoAoParceiro,
  cadastro_transferido: FINALIDADES.retornoAoParceiro,
};

export type VeredictoDoEnvio =
  | { pode: true }
  | { pode: false; motivo: 'revogado' | 'sem_paciente' | 'tipo_desconhecido' };

/**
 * Pode enviar este evento agora?
 *
 * @param solicitacaoId a solicitação que originou o evento — é por ela que se chega ao paciente
 * @param tipo o tipo do evento na fila
 */
export async function consentimentoAindaVale(
  solicitacaoId: string,
  tipo: TipoDeEvento,
): Promise<VeredictoDoEnvio> {
  const finalidade = FINALIDADE_POR_TIPO[tipo];
  if (!finalidade) return { pode: false, motivo: 'tipo_desconhecido' };

  /**
   * O evento guarda a solicitação; o consentimento é do paciente. A ponte é o `pacienteId`
   * que o cadastro gravou na solicitação — e é por isso que gravá-lo **antes** de queimar o
   * link importa (G10): sem ele, esta consulta não chega a lugar nenhum.
   */
  const [linha] = await db
    .select({ pacienteId: solicitacoesCadastro.pacienteId })
    .from(solicitacoesCadastro)
    .where(eq(solicitacoesCadastro.id, solicitacaoId))
    .limit(1);

  if (!linha?.pacienteId) return { pode: false, motivo: 'sem_paciente' };

  /**
   * ⚠️ A ficha pode ter sido apagada entre o enfileiramento e agora. Enviar dado de quem
   * pediu exclusão seria o mesmo erro da revogação, por outra porta.
   */
  const [ficha] = await db
    .select({ id: pacientes.id })
    .from(pacientes)
    .where(and(eq(pacientes.id, linha.pacienteId), isNull(pacientes.deletedAt)))
    .limit(1);

  if (!ficha) return { pode: false, motivo: 'sem_paciente' };

  /**
   * `finalidadesVigentes` já filtra `revogadoEm IS NULL` — é a mesma leitura que o cadastro
   * usa, e reusá-la é o que impede as duas de divergirem.
   */
  const vigentes = await finalidadesVigentes(ficha.id);
  if (!vigentes.includes(finalidade)) return { pode: false, motivo: 'revogado' };

  return { pode: true };
}
