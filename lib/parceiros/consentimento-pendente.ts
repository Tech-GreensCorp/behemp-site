/**
 * O CONSENTIMENTO QUE FALTA SE ANUNCIA — e só quando há compartilhamento em jogo.
 *
 * 🔴 Decisão do dono em 13/09/2026, depois de a reconciliação automática concluir o cadastro
 * dele sem o consentimento que ele tinha marcado e que a recusa da action jogou fora:
 *
 *   _"conserte para isso ser um dado salvo dentro do perfil do paciente, assim evita que esse
 *   erro aconteça e o sistema saiba quando isso tiver faltando durante a reconciliação, e
 *   apareça a mesma parte do consentimento do formulário, só que somente a mensagem de
 *   consentimento com as caixas de seleção… claro que não pode ser bloqueante, mas toda etapa
 *   que é compartilhada com a Greens deve aparecer esse modal de consentimento."_
 *
 * ## Por que isto precisa existir
 *
 * A reconciliação (D-09) conclui o cadastro **sem o paciente presente** — e por isso não pode
 * consentir por ele: `finalidadesConsentidas: []`. Isso é correto, e deixa um buraco previsível:
 * a ficha existe, o fluxo segue, e **nada autoriza o envio à Greens**.
 *
 * Sem este aviso, o buraco é silencioso nos dois sentidos: o paciente não sabe que falta, e o
 * sistema só descobre na hora de enviar — quando `consentimentoAindaVale` barra a fila e o
 * evento morre sem que ninguém entenda por quê.
 *
 * ## As duas regras que ele definiu, e por que cada uma
 *
 * 1. **Só pede quando há compartilhamento.** Paciente que se cadastrou sozinho na BeHemp e cujo
 *    dado não vai a lugar nenhum não tem o que autorizar — e pedir autorização sem finalidade é
 *    coleta sem propósito, que a LGPD trata como vício, não como zelo.
 * 2. 🔴 **NUNCA bloqueia.** Consentimento obtido como condição de acesso é viciado
 *    (LGPD art. 8º §3º) — e há guarda neste repositório proibindo que ele vire pedágio do
 *    cadastro. Um aviso que tranca a tela deixa de ser consentimento e vira extorsão de aceite.
 */

import { FINALIDADES, type Finalidade } from './consentimento';

/**
 * As finalidades que só fazem sentido quando o dado atravessa para o parceiro.
 *
 * ⚠️ DERIVADO das constantes, nunca listado à mão: uma finalidade nova aparece aqui sozinha, e
 * uma removida quebra a compilação de quem a usava. Lista paralela é o que desatualiza e aprova
 * o errado — foi assim que o `type Origem` ficou sem `greens_handoff`.
 */
export const FINALIDADES_DE_COMPARTILHAMENTO: readonly Finalidade[] = [
  FINALIDADES.retornoAoParceiro,
  FINALIDADES.apoioAnvisa,
];

export interface ConsentimentoPendente {
  /** `true` = a tela deve mostrar as caixas. Nunca impedir o uso do sistema. */
  pedir: boolean;
  /** O que ainda não foi autorizado, para a tela marcar só o que falta. */
  faltando: Finalidade[];
  /** Por que pede ou não pede — o D-06 vale aqui: booleano sozinho não se depura. */
  porque: string;
}

/**
 * Decide se a tela deve pedir consentimento a este paciente.
 *
 * 🔴 FUNÇÃO PURA. Recebe o estado e devolve a decisão; não lê banco, não renderiza. É o que
 * permite testá-la de verdade sem subir nada — e o que impede que a regra se espalhe por telas,
 * que é como a ficha casca passou a mentir para todas (ADR-0022, G2).
 */
export function consentimentoPendente(params: {
  /** O que o paciente já autorizou, vindo de `finalidadesVigentes(pacienteId)`. */
  vigentes: readonly Finalidade[];
  /**
   * O dado desta pessoa atravessa para o parceiro? Veio da Greens, de terceiro, ou vai voltar
   * para lá no fim. Sem isso não há finalidade a autorizar.
   */
  haCompartilhamento: boolean;
}): ConsentimentoPendente {
  if (!params.haCompartilhamento) {
    return { pedir: false, faltando: [], porque: 'sem_compartilhamento' };
  }

  const jaTem = new Set(params.vigentes);
  const faltando = FINALIDADES_DE_COMPARTILHAMENTO.filter((f) => !jaTem.has(f));

  if (faltando.length === 0) {
    return { pedir: false, faltando: [], porque: 'ja_consentiu_tudo' };
  }

  return { pedir: true, faltando, porque: 'falta_consentimento_de_compartilhamento' };
}

/**
 * O dado desta pessoa atravessa para o parceiro?
 *
 * ⚠️ A PROCEDÊNCIA RESPONDE ISSO, e é para isto que ela passou a viver no paciente (S8.2, D-08).
 * Antes dela, ninguém sabia de onde o paciente tinha vindo depois que a ficha nascia — e uma
 * tela que não sabe a origem não tem como decidir se há o que autorizar.
 *
 * `null` (ficha antiga, nascida antes da procedência) é tratado como **sem compartilhamento**:
 * não se pede autorização com base em suposição sobre alguém.
 */
export function haCompartilhamentoComParceiro(origem: string | null | undefined): boolean {
  if (!origem) return false;
  return origem === 'greens_handoff' || origem.startsWith('chatpro_');
}
