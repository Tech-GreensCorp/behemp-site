/**
 * LIMITE DE REQUISIÇÃO — OWASP API4:2023, "Unrestricted Resource Consumption".
 *
 * Levantado pelo dono em 10/09/2026: _"a cybersegurança tem que ser levada em conta pela
 * quantidade de dados sensíveis que estaremos passando"_. A auditoria contra o OWASP API
 * Security Top 10 (2023) mostrou que este era o único item sem defesa alguma no projeto —
 * BOLA, autenticação, replay e exposição de propriedade já tinham.
 *
 * 🔴 O QUE UM ENDPOINT SEM LIMITE PERMITE, CONCRETAMENTE
 *
 * `/api/documentos/<id>/arquivo` responde 404 tanto para "não existe" quanto para "não é
 * seu" — de propósito. Mas sem limite, alguém autenticado percorre ids até achar os que
 * respondem 200. O cuid2 torna isso caro; sem limite, caro não é impossível.
 *
 * `/api/parceiros/greens/cadastro` e `/api/chatpro/bot-link` conferem segredo em tempo
 * constante. Tempo constante protege contra ataque de temporização — **não** contra tentar
 * um milhão de vezes.
 *
 * ⚠️ O QUE ESTA IMPLEMENTAÇÃO NÃO É, E PRECISA SER DITO
 *
 * O contador vive na MEMÓRIA DO PROCESSO. Funciona porque hoje há um processo só (PM2, uma
 * instância — DT-006/DT-008). Com duas instâncias, cada uma conta metade e o limite efetivo
 * dobra; num reinício, tudo zera.
 *
 * Não é desculpa, é o alcance declarado: **é melhor que nada por uma margem enorme, e pior
 * que um contador compartilhado por uma margem conhecida.** Trocar por Redis quando houver
 * mais de uma instância é substituir esta função, não reescrever quem a chama. Catalogado.
 */

interface Janela {
  contagem: number;
  expiraEm: number;
}

/**
 * ⚠️ Um Map cresce para sempre se ninguém o limpar — e um "limitador" que estoura a memória
 * do processo vira o ataque que ele deveria impedir. A limpeza acontece na própria chamada,
 * de forma amortizada, em vez de um timer que ninguém vê.
 */
const janelas = new Map<string, Janela>();
let proximaLimpeza = 0;

function limparExpirados(agora: number): void {
  if (agora < proximaLimpeza) return;
  for (const [chave, janela] of janelas) {
    if (janela.expiraEm <= agora) janelas.delete(chave);
  }
  proximaLimpeza = agora + 60_000;
}

export interface ResultadoDoLimite {
  permitido: boolean;
  /** Quantas ainda cabem nesta janela. Vai no cabeçalho, para quem chama se ajustar. */
  restantes: number;
  /** Em quantos segundos a janela reabre. */
  reabreEm: number;
}

/**
 * Consome uma unidade da janela e diz se pode seguir.
 *
 * @param chave  quem está sendo limitado. **Nunca use dado pessoal aqui** — o Map vira um
 *               registro de quem acessou o quê, sem controle de acesso nem prazo.
 * @param limite quantas requisições cabem na janela
 * @param janelaEmSegundos tamanho da janela
 */
export function consumir(
  chave: string,
  limite: number,
  janelaEmSegundos: number,
): ResultadoDoLimite {
  const agora = Date.now();
  limparExpirados(agora);

  const atual = janelas.get(chave);

  if (!atual || atual.expiraEm <= agora) {
    janelas.set(chave, { contagem: 1, expiraEm: agora + janelaEmSegundos * 1000 });
    return { permitido: true, restantes: limite - 1, reabreEm: janelaEmSegundos };
  }

  atual.contagem += 1;
  const reabreEm = Math.ceil((atual.expiraEm - agora) / 1000);

  if (atual.contagem > limite) {
    return { permitido: false, restantes: 0, reabreEm };
  }

  return { permitido: true, restantes: limite - atual.contagem, reabreEm };
}

/**
 * De quem é a requisição, para efeito de limite.
 *
 * 🔴 O IP VEM DO CABEÇALHO, E CABEÇALHO SE FORJA.
 *
 * `x-forwarded-for` é preenchido pelo proxy — e por qualquer um que o mande, se o proxy não
 * o sobrescrever. Aqui ele serve para AGRUPAR requisições, não para autorizar nada: quem
 * forja o cabeçalho consegue, no máximo, escapar do próprio limite. Não obtém acesso.
 *
 * ⚠️ Pegamos o PRIMEIRO da lista, que é o cliente original numa cadeia bem configurada. Em
 * uma cadeia mal configurada, esse valor é controlado pelo cliente — o que reforça que ele
 * nunca deve decidir permissão.
 */
export function identificarChamador(cabecalhos: Headers, prefixo: string): string {
  const encaminhado = cabecalhos.get('x-forwarded-for')?.split(',')[0]?.trim();
  const real = cabecalhos.get('x-real-ip')?.trim();
  return `${prefixo}:${encaminhado || real || 'desconhecido'}`;
}

/** Os cabeçalhos que dizem a quem chama o que está acontecendo. */
export function cabecalhosDoLimite(r: ResultadoDoLimite, limite: number): HeadersInit {
  return {
    'ratelimit-limit': String(limite),
    'ratelimit-remaining': String(r.restantes),
    'ratelimit-reset': String(r.reabreEm),
    ...(r.permitido ? {} : { 'retry-after': String(r.reabreEm) }),
  };
}
