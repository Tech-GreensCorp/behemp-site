/**
 * PARA ONDE O PACIENTE VAI DEPOIS DE CRIAR A CONTA — E POR QUÊ.
 *
 * Decisão do dono em 10/09/2026, ao descrever os dois fluxos que a Greens encaminha. Até
 * então o destino era fixo (`/paciente/teleconsulta`), e isso servia mal aos dois:
 *
 *   Fluxo 1 — paciente SEM ANVISA. Ele já tem receita; o que falta é a autorização de
 *   importação. Mandá-lo agendar consulta é pedir que repita um ato médico que já aconteceu.
 *   Vai direto para a procuração.
 *
 *   Fluxo 2 — paciente SEM RECEITA (ou com uma que não serve). A receita só existe depois de
 *   um médico avaliar. Vai direto para o agendamento.
 *
 * 🔴 A ORDEM ENTRE OS DOIS NÃO É ARBITRÁRIA. Quando faltam os dois, a consulta vem primeiro:
 * a procuração da ANVISA instrui um pedido de importação de um medicamento que ainda não foi
 * prescrito. Sem receita, não há o que autorizar.
 *
 * ⚠️ ISTO NÃO BLOQUEIA NADA. É só o primeiro lugar que a tela abre — o paciente continua
 * podendo navegar para qualquer área. Pendência informa, não impede (ADR-0016 D-06).
 */

/** Os destinos possíveis, todos rotas que já existem. */
export const DESTINOS = {
  agendamento: '/agendamento',
  anvisa: '/paciente/anvisa',
  teleconsulta: '/paciente/teleconsulta',
} as const;

export type Destino = (typeof DESTINOS)[keyof typeof DESTINOS];

/**
 * Decide o destino a partir do que o parceiro NÃO mandou.
 *
 * @param pendentes chaves de documento que faltam — o que `pendenciasDe` devolve.
 */
export function destinoDepoisDoCadastro(pendentes: readonly string[]): Destino {
  const falta = new Set(pendentes);

  // 1º — sem receita não há o que autorizar. A consulta vem antes da procuração.
  if (falta.has('receita_medica')) return DESTINOS.agendamento;

  // 2º — tem receita e falta a autorização: é exatamente o caso do fluxo 1.
  if (falta.has('autorizacao_anvisa')) return DESTINOS.anvisa;

  // Sem nenhuma das duas pendências, o caminho de sempre.
  return DESTINOS.teleconsulta;
}

/**
 * O QUE A TELA PROMETE, conforme para onde ela vai levar.
 *
 * Levantado pelo dono em 10/09/2026: os dois fluxos terminavam com o mesmo botão, _"Criar
 * conta e agendar consulta"_ — inclusive o do paciente que **já tem receita** e vai para a
 * procuração da ANVISA. Prometer consulta a quem não vai ter consulta é errado duas vezes:
 * confunde no momento do clique, e desmente a tela seguinte.
 */
export function textosDoDestino(destino: Destino): {
  titulo: string;
  destaque: string;
  subtitulo: string;
  botao: string;
} {
  if (destino === DESTINOS.anvisa) {
    return {
      titulo: 'Falta pouco para sua',
      destaque: 'autorização',
      subtitulo:
        'Crie sua conta para preencher a procuração da ANVISA. Os documentos que você já enviou vêm junto.',
      botao: 'Criar conta e continuar',
    };
  }
  return {
    titulo: 'Falta pouco para sua',
    destaque: 'consulta',
    subtitulo:
      'Preencha seus dados para criar sua conta e agendar a teleconsulta com um médico prescritor.',
    botao: 'Criar conta e agendar consulta',
  };
}
