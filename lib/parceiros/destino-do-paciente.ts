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

/**
 * Os destinos possíveis — e cada um é uma rota que EXISTE no disco.
 *
 * 🔴 RETRATAÇÃO, 12/09/2026. Este comentário dizia "todos rotas que já existem", e uma não
 * existia: `agendamento` apontava para `/agendamento`, e o único diretório é
 * `app/(paciente)/paciente/agendamento`. Medido no manifesto do build: a única rota com esse
 * nome é `/paciente/agendamento`, e não há rewrite no `next.config.ts`.
 *
 * ⚠️ QUEM CAÍA NISSO ERA A MAIORIA. `destinoDepoisDoCadastro` devolve `agendamento` sempre que
 * falta a receita — o passo 4 do fluxo 2 e o passo 3 do fluxo 4 da Greens. O paciente
 * terminava o cadastro, via "pronto", e a tela seguinte era 404.
 *
 * 🔴 A LIÇÃO: comentário que afirma um fato sobre o disco não é verificação. Agora há um
 * guarda que confere cada destino contra as pastas de `app/` — se alguém acrescentar um
 * destino sem rota, o build fica vermelho nomeando qual.
 */
export const DESTINOS = {
  agendamento: '/paciente/agendamento',
  anvisa: '/paciente/anvisa',
  /**
   * 🔴 SEGUNDO DESTINO QUEBRADO, achado pelo guarda ao nascer vermelho, 12/09/2026.
   *
   * Valia `'/paciente/teleconsulta'`, e essa rota **não existe**: o disco só tem
   * `app/(paciente)/paciente/teleconsulta/[roomId]` — uma sala precisa de um id, e quem
   * acabou de se cadastrar não tem sala nenhuma. Quem caía aqui era o paciente **sem
   * pendência alguma**: a recompra do fluxo 3, que é justamente quem já trouxe tudo.
   *
   * ⚠️ O destino certo é o agendamento, e a própria tela já dizia isso: o texto deste ramo
   * promete _"agendar a teleconsulta com um médico prescritor"_ e o botão diz _"Criar conta e
   * agendar consulta"_ (`textosDoDestino`, abaixo). A promessa estava certa; o destino é que
   * mandava para uma sala inexistente.
   */
  teleconsulta: '/paciente/agendamento',
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
