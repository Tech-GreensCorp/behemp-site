/**
 * NÚCLEO DO WORKER DAS FILAS — ADR-0027.
 *
 * O QUE FAZ
 * ---------
 * Chama, em sequência, as três rotas que o `filas.yml` já chama, com o `CRON_SECRET` do
 * ambiente, e registra uma linha por chamada. Não processa fila nenhuma: todo o trabalho
 * continua dentro do `behemp-site`, nas rotas, que reivindicam com `FOR UPDATE SKIP LOCKED`.
 *
 * Separado de `worker-filas.mjs` para ser importável sem efeito colateral: importar este
 * arquivo não agenda nada, e é assim que o guarda o executa.
 *
 * COMO SE DESFAZ / IDEMPOTENTE
 * ----------------------------
 * `pm2 stop behemp-filas` para o laço; o `filas.yml` segue esvaziando as filas (D-06).
 * Chamar uma rota duas vezes não duplica trabalho: quem perde a corrida não reivindica nada.
 */

/** As mesmas rotas do `filas.yml`, na mesma ordem. O guarda confere que as duas listas batem. */
export const ROTAS = Object.freeze([
  '/api/chatpro/processar',
  '/api/parceiros/enviar',
  '/api/mercadopago/processar',
]);

/**
 * 60 s entre o FIM de uma rodada e o começo da próxima (D-03). Constante no código, não
 * variável de ambiente: mudar a cadência é um commit, não um valor que só existe no servidor.
 */
export const INTERVALO_MS = 60_000;

/** O mesmo teto do passo mais lento do `filas.yml` (`--max-time 90`). */
export const TIMEOUT_MS = 90_000;

/**
 * A primeira rodada espera o site: o deploy reinicia o `behemp-site` no mesmo passo, logo
 * antes de subir o worker, e chamar antes de o Next escutar só produziria `ECONNREFUSED`.
 */
export const ESPERA_INICIAL_MS = 15_000;

/**
 * `127.0.0.1`, nunca o domínio público (D-02): a chamada não sai da máquina, não passa por
 * DNS, TLS nem nginx. E nunca `localhost`, que no Node 17+ pode resolver primeiro para `::1`,
 * enquanto o standalone escuta em `0.0.0.0` (só IPv4). A porta segue a regra do `server.js`
 * do standalone — `parseInt(PORT) || 3000` — para os dois nunca discordarem.
 *
 * @param {Record<string, string | undefined>} [env]
 */
export function destino(env = process.env) {
  const porta = Number.parseInt(env.PORT ?? '', 10) || 3000;
  return `http://127.0.0.1:${porta}`;
}

/**
 * Resumo do corpo para o log: SÓ números e booleanos de `dados`, até um nível de
 * aninhamento. Texto nunca entra — hoje as rotas devolvem só contadores, e esta regra
 * garante que uma rota que um dia devolva texto não o faça chegar ao log.
 */
export function resumir(corpo) {
  const dados = corpo && typeof corpo === 'object' ? corpo.dados : undefined;
  if (!dados || typeof dados !== 'object' || Array.isArray(dados)) return '';

  const escalar = (v) => typeof v === 'number' || typeof v === 'boolean';
  const partes = [];
  for (const [chave, valor] of Object.entries(dados)) {
    if (escalar(valor)) {
      partes.push(`${chave}=${valor}`);
    } else if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
      for (const [sub, v] of Object.entries(valor)) {
        if (escalar(v)) partes.push(`${chave}.${sub}=${v}`);
      }
    }
  }
  return partes.join(' ');
}

/** Motivo de uma falha de rede, sem a mensagem (que pode carregar a URL ou dado de terceiro). */
function motivo(erro, sinalExterno) {
  if (sinalExterno?.aborted) return 'interrompido';
  if (erro?.name === 'AbortError' || erro?.name === 'TimeoutError') return 'timeout';
  return erro?.cause?.code ?? erro?.code ?? erro?.name ?? 'desconhecido';
}

/**
 * Chama UMA rota. Nunca lança: erro de rede, timeout ou corpo inválido viram resultado.
 * É o que impede uma rota de travar as outras.
 */
export async function chamar(rota, opcoes) {
  const {
    base,
    segredo,
    fetch: buscar = globalThis.fetch,
    timeoutMs = TIMEOUT_MS,
    sinal,
    agora = Date.now,
  } = opcoes;
  const inicio = agora();

  // Timeout próprio + sinal de desligamento, sem `AbortSignal.any` (Node ≥ 20.3), porque a
  // versão do Node da EC2 não está medida.
  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), timeoutMs);
  const aoDesligar = () => controle.abort();
  sinal?.addEventListener('abort', aoDesligar, { once: true });

  try {
    const resposta = await buscar(`${base}${rota}`, {
      method: 'GET',
      headers: { authorization: `Bearer ${segredo ?? ''}` },
      // 🔴 `manual`: seguir redirect transformaria o 307 → `/entrar` do middleware (Item 41)
      // num 200 da página de login, e o worker registraria sucesso com a fila parada.
      redirect: 'manual',
      signal: controle.signal,
    });
    let corpo = null;
    try {
      corpo = await resposta.json();
    } catch {
      // corpo não-JSON (página de erro do nginx, redirect): o status já diz o que houve
    }
    const ok = resposta.status === 200 && corpo?.sucesso === true;
    return {
      rota,
      ok,
      status: resposta.status,
      ms: agora() - inicio,
      resumo: ok ? resumir(corpo) : '',
    };
  } catch (erro) {
    return { rota, ok: false, status: null, ms: agora() - inicio, falha: motivo(erro, sinal) };
  } finally {
    clearTimeout(relogio);
    sinal?.removeEventListener('abort', aoDesligar);
  }
}

/** Uma linha de log por chamada. Com horário, porque o `error.log` do PM2 não tem. */
export function linha(r, quando = new Date()) {
  const desfecho = r.status === null ? `falha:${r.falha}` : `HTTP ${r.status}`;
  const resumo = r.resumo ? ` ${r.resumo}` : '';
  return `${quando.toISOString()} [filas] ${r.rota} ${desfecho} ${r.ms}ms${resumo}`;
}

/**
 * Uma rodada: as rotas EM SEQUÊNCIA (D-03), uma linha por rota. Sucesso vai para o
 * `out.log`, falha para o `error.log`. Uma rota falhar não impede a próxima.
 */
export async function rodada(opcoes) {
  const { log = console.log, logErro = console.error, rotas = ROTAS } = opcoes;
  const resultados = [];
  for (const rota of rotas) {
    // Desligando: não começa chamada nova. O `abort` não dispara de novo para quem ouvir
    // depois, então sem esta linha as rotas seguintes rodariam até o timeout.
    if (opcoes.sinal?.aborted) break;
    const r = await chamar(rota, opcoes);
    (r.ok ? log : logErro)(linha(r));
    resultados.push(r);
  }
  return resultados;
}

/**
 * O laço: `setTimeout` ENCADEADO — a próxima rodada só é agendada quando a anterior
 * termina, então uma rota lenta nunca empilha rodadas (D-03 rejeita `setInterval`).
 *
 * SIGTERM/SIGINT (o PM2 manda SIGINT no `stop`/`delete`): cancela o próximo agendamento e
 * aborta a chamada em curso. Sem nada pendente, o processo sai sozinho, com código 0.
 */
export function iniciar(opcoes = {}) {
  const {
    env = process.env,
    processo = process,
    agendar = setTimeout,
    cancelar = clearTimeout,
    log = console.log,
    esperaInicialMs = ESPERA_INICIAL_MS,
    ...resto
  } = opcoes;

  const controle = new AbortController();
  let parando = false;
  let proximo = null;

  const ciclo = async () => {
    proximo = null;
    if (parando) return;
    await rodada({
      base: destino(env),
      segredo: env.CRON_SECRET?.trim(),
      sinal: controle.signal,
      log,
      ...resto,
    });
    if (!parando) proximo = agendar(ciclo, INTERVALO_MS);
  };

  const parar = (nome) => {
    if (parando) return;
    parando = true;
    if (proximo !== null) cancelar(proximo);
    proximo = null;
    controle.abort();
    log(`${new Date().toISOString()} [filas] encerrando (${nome})`);
  };

  processo.once('SIGTERM', () => parar('SIGTERM'));
  processo.once('SIGINT', () => parar('SIGINT'));

  log(
    `${new Date().toISOString()} [filas] iniciado · destino ${destino(env)} · ` +
      `${ROTAS.length} rotas · intervalo ${INTERVALO_MS / 1000}s`,
  );
  proximo = agendar(ciclo, esperaInicialMs);

  return { parar, ciclo };
}
