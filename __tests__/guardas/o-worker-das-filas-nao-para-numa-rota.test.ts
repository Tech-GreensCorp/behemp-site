/**
 * GUARDA — o worker das filas não para numa rota, não mente sucesso e não vaza segredo.
 *
 * A CLASSE DE ERRO: o `behemp-filas` (ADR-0027) é o que faz as três filas andarem em minutos
 * em vez de horas. Ele falha em silêncio de quatro jeitos, e nenhum quebra o build:
 *
 *   1. uma rota lança (rede, timeout) e a rodada morre ali — as filas seguintes param;
 *   2. o `fetch` segue o 307 → `/entrar` do middleware (Item 41) e registra 200 da página
 *      de login — o log diz "ok" com a fila parada;
 *   3. o laço vira `setInterval` e uma rota lenta empilha rodadas (D-03);
 *   4. o `CRON_SECRET`, ou texto do corpo, chega ao log do PM2.
 *
 * E dois estruturais: as rotas do worker divergirem das do `filas.yml` (a rede de segurança
 * passaria a cobrir outra coisa), e o deploy subir o worker com `restart`, ou depois do
 * `pm2 save` — aí o reboot não o traz de volta.
 *
 * Os casos de comportamento EXECUTAM o núcleo com um `fetch` falso. Não leem o código.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  chamar,
  destino,
  iniciar,
  INTERVALO_MS,
  resumir,
  rodada,
  ROTAS,
} from '../../scripts/worker-filas-nucleo.mjs';

const raiz = process.cwd();
const ler = (p: string) => readFileSync(path.join(raiz, p), 'utf8');

const NUCLEO = 'scripts/worker-filas-nucleo.mjs';
const DEPLOY = '.github/workflows/deploy.yml';
const FILAS = '.github/workflows/filas.yml';

const SEGREDO = 'segredo-que-nao-pode-aparecer-0123456789';
const BASE = 'http://127.0.0.1:3000';

type Chamada = { url: string; init: RequestInit };

function json(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** `fetch` falso: cada rota responde o que o mapa manda; registra toda chamada. */
function fetchFalso(respostas: Record<string, (init: RequestInit) => Promise<Response>>) {
  const chamadas: Chamada[] = [];
  const buscar = async (url: string, init: RequestInit) => {
    chamadas.push({ url, init });
    const rota = new URL(url).pathname;
    const responder = respostas[rota];
    if (!responder) throw new Error(`rota inesperada no teste: ${rota}`);
    return responder(init);
  };
  return { buscar, chamadas };
}

const recusaConexao = () =>
  Promise.reject(Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } }));

/** Nunca responde; só rejeita quando o sinal aborta — é como uma rota pendurada se comporta. */
const pendura = (init: RequestInit) =>
  new Promise<Response>((_, rejeitar) => {
    init.signal?.addEventListener('abort', () =>
      rejeitar(Object.assign(new Error('aborted'), { name: 'AbortError' })),
    );
  });

function capturarLog() {
  const linhas: string[] = [];
  return { linhas, log: (l: string) => linhas.push(l), logErro: (l: string) => linhas.push(l) };
}

describe('uma rota falhar não impede as outras', () => {
  it('rede recusada, 500 e 200: as três rotas são chamadas, na ordem', async () => {
    const { buscar, chamadas } = fetchFalso({
      '/api/chatpro/processar': recusaConexao,
      '/api/parceiros/enviar': async () => json(500, { sucesso: false, erro: 'Falha ao enviar' }),
      '/api/mercadopago/processar': async () =>
        json(200, { sucesso: true, dados: { falharam: 0 } }),
    });
    const { log, logErro } = capturarLog();

    const r = await rodada({ base: BASE, segredo: SEGREDO, fetch: buscar, log, logErro });

    expect(chamadas.map((c) => new URL(c.url).pathname)).toEqual([...ROTAS]);
    expect(r.map((x) => x.ok)).toEqual([false, false, true]);
    expect(r[0]).toMatchObject({ status: null, falha: 'ECONNREFUSED' });
    expect(r[1]).toMatchObject({ status: 500 });
  });

  it('uma rota pendurada vira `timeout` e a próxima ainda roda', async () => {
    const { buscar, chamadas } = fetchFalso({
      '/api/chatpro/processar': pendura,
      '/api/parceiros/enviar': async () => json(200, { sucesso: true, dados: {} }),
      '/api/mercadopago/processar': async () => json(200, { sucesso: true, dados: {} }),
    });
    const { log, logErro } = capturarLog();

    const r = await rodada({
      base: BASE,
      segredo: SEGREDO,
      fetch: buscar,
      log,
      logErro,
      timeoutMs: 20,
    });

    expect(chamadas).toHaveLength(3);
    expect(r[0]).toMatchObject({ ok: false, status: null, falha: 'timeout' });
    expect(r[2].ok).toBe(true);
  });

  it('`chamar` nunca lança, nem quando o `fetch` lança algo que não é Error', async () => {
    const buscar = async () => {
      throw 'string lançada';
    };
    await expect(
      chamar('/api/chatpro/processar', { base: BASE, segredo: SEGREDO, fetch: buscar }),
    ).resolves.toMatchObject({ ok: false, status: null });
  });
});

describe('o worker não registra sucesso que não houve', () => {
  it('não segue redirect — o 307 do middleware (Item 41) é falha, não a página de login', async () => {
    const { buscar, chamadas } = fetchFalso({
      '/api/chatpro/processar': async () =>
        new Response(null, { status: 307, headers: { location: '/entrar' } }),
    });
    const r = await chamar('/api/chatpro/processar', {
      base: BASE,
      segredo: SEGREDO,
      fetch: buscar,
    });

    expect(chamadas[0].init.redirect).toBe('manual');
    expect(r).toMatchObject({ ok: false, status: 307 });
  });

  it('200 com `sucesso: false` não é sucesso', async () => {
    const { buscar } = fetchFalso({
      '/api/chatpro/processar': async () => json(200, { sucesso: false }),
    });
    const r = await chamar('/api/chatpro/processar', {
      base: BASE,
      segredo: SEGREDO,
      fetch: buscar,
    });
    expect(r.ok).toBe(false);
  });

  it('200 com corpo que não é JSON (página do nginx) não é sucesso', async () => {
    const { buscar } = fetchFalso({
      '/api/chatpro/processar': async () => new Response('<html>ok</html>', { status: 200 }),
    });
    const r = await chamar('/api/chatpro/processar', {
      base: BASE,
      segredo: SEGREDO,
      fetch: buscar,
    });
    expect(r.ok).toBe(false);
  });
});

describe('nada sensível chega ao log', () => {
  it('o CRON_SECRET vai no cabeçalho Bearer e em nenhuma linha de log', async () => {
    const { buscar, chamadas } = fetchFalso({
      '/api/chatpro/processar': async () => json(401, { sucesso: false, erro: 'Não autorizado' }),
      '/api/parceiros/enviar': recusaConexao,
      '/api/mercadopago/processar': async () => json(200, { sucesso: true, dados: { a: 1 } }),
    });
    const { linhas, log, logErro } = capturarLog();

    await rodada({ base: BASE, segredo: SEGREDO, fetch: buscar, log, logErro });

    const cabecalhos = chamadas.map(
      (c) => (c.init.headers as Record<string, string>).authorization,
    );
    expect(cabecalhos).toEqual(ROTAS.map(() => `Bearer ${SEGREDO}`));
    expect(linhas).toHaveLength(3);
    for (const l of linhas) expect(l).not.toContain(SEGREDO);
  });

  it('o resumo leva só número e booleano — texto do corpo nunca entra', () => {
    const texto = resumir({
      sucesso: true,
      dados: {
        processados: 3,
        configurado: true,
        email: 'paciente@exemplo.com',
        diretorio: { departamentos: 2, nome: 'Recepção', lista: ['x'] },
        lista: [1, 2],
      },
    });
    expect(texto).toBe('processados=3 configurado=true diretorio.departamentos=2');
    expect(texto).not.toMatch(/paciente|Recepção/);
  });

  it('as linhas têm horário ISO — o `error.log` do PM2 não tem', async () => {
    const { buscar } = fetchFalso({
      '/api/chatpro/processar': async () => json(200, { sucesso: true, dados: {} }),
    });
    const { linhas, log, logErro } = capturarLog();
    await rodada({
      base: BASE,
      segredo: SEGREDO,
      fetch: buscar,
      log,
      logErro,
      rotas: ['/api/chatpro/processar'],
    });
    expect(linhas[0]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[filas\] /);
  });

  it('o núcleo só lê `PORT` e `CRON_SECRET` do ambiente', () => {
    const lidas = new Set([...ler(NUCLEO).matchAll(/\benv\.([A-Z_]+)/g)].map((m) => m[1]));
    expect(lidas.size, 'vacuidade: o núcleo deixou de ler o ambiente').toBeGreaterThan(0);
    expect([...lidas].sort()).toEqual(['CRON_SECRET', 'PORT']);
  });
});

describe('o destino é local, pela mesma regra de porta do server.js', () => {
  it('sem PORT: 127.0.0.1:3000', () => {
    expect(destino({})).toBe('http://127.0.0.1:3000');
  });

  it('com PORT: a porta dela', () => {
    expect(destino({ PORT: '4123' })).toBe('http://127.0.0.1:4123');
  });

  it('PORT inválida cai em 3000, como `parseInt(PORT) || 3000` do standalone', () => {
    expect(destino({ PORT: 'abc' })).toBe('http://127.0.0.1:3000');
  });
});

describe('o laço é setTimeout encadeado e desliga limpo', () => {
  /** Relógio falso: guarda o que foi agendado sem disparar. */
  function relogio() {
    const agendados: { fn: () => Promise<void> | void; ms: number; id: number }[] = [];
    let id = 0;
    const cancelados = new Set<number>();
    return {
      agendados,
      cancelados,
      agendar: (fn: () => Promise<void> | void, ms: number) => {
        agendados.push({ fn, ms, id: ++id });
        return id;
      },
      cancelar: (i: number) => cancelados.add(i),
    };
  }

  function processoFalso() {
    const ouvintes: Record<string, () => void> = {};
    return {
      ouvintes,
      once: (evento: string, fn: () => void) => {
        ouvintes[evento] = fn;
      },
    };
  }

  it('a próxima rodada só é agendada DEPOIS que a anterior termina, com 60 s', async () => {
    let liberar!: () => void;
    const segura = new Promise<void>((r) => (liberar = r));
    const buscar = async () => {
      await segura;
      return json(200, { sucesso: true, dados: {} });
    };
    const r = relogio();
    const { log, logErro } = capturarLog();

    iniciar({
      env: { CRON_SECRET: SEGREDO },
      processo: processoFalso(),
      agendar: r.agendar,
      cancelar: r.cancelar,
      fetch: buscar,
      log,
      logErro,
    });
    expect(r.agendados).toHaveLength(1); // só a espera inicial

    const emCurso = r.agendados[0].fn();
    await Promise.resolve();
    expect(r.agendados, 'agendou a próxima com a rodada ainda em curso').toHaveLength(1);

    liberar();
    await emCurso;
    expect(r.agendados).toHaveLength(2);
    expect(r.agendados[1].ms).toBe(INTERVALO_MS);
    expect(INTERVALO_MS).toBe(60_000);
  });

  it('SIGINT e SIGTERM cancelam o próximo agendamento', () => {
    for (const sinal of ['SIGINT', 'SIGTERM']) {
      const r = relogio();
      const p = processoFalso();
      const { log, logErro } = capturarLog();
      iniciar({ env: {}, processo: p, agendar: r.agendar, cancelar: r.cancelar, log, logErro });

      p.ouvintes[sinal]();

      expect(r.cancelados.has(r.agendados[0].id), `${sinal} não cancelou`).toBe(true);
    }
  });

  it('desligar no meio da rodada aborta a chamada em curso e não começa as seguintes', async () => {
    const r = relogio();
    const p = processoFalso();
    const { buscar, chamadas } = fetchFalso({ '/api/chatpro/processar': pendura });
    const { log, logErro } = capturarLog();
    iniciar({
      env: {},
      processo: p,
      agendar: r.agendar,
      cancelar: r.cancelar,
      fetch: buscar,
      log,
      logErro,
    });

    const emCurso = r.agendados[0].fn();
    await Promise.resolve();
    p.ouvintes.SIGINT();
    await emCurso;

    expect(chamadas).toHaveLength(1);
    expect(r.agendados, 'reagendou depois de desligar').toHaveLength(1);
  });

  it('o núcleo não usa setInterval', () => {
    const codigo = ler(NUCLEO)
      .split('\n')
      .filter((l) => !/^\s*(\*|\/\/)/.test(l))
      .join('\n');
    expect(codigo).toMatch(/agendar\(ciclo, INTERVALO_MS\)/);
    expect(codigo).not.toMatch(/setInterval\s*\(/);
  });
});

describe('o worker e o filas.yml chamam as mesmas rotas', () => {
  it('as rotas do worker são exatamente as do filas.yml, na mesma ordem', () => {
    const doFilas = [...ler(FILAS).matchAll(/https:\/\/be4hope\.org(\/api\/[\w/-]+)/g)].map(
      (m) => m[1],
    );
    expect(doFilas.length, 'vacuidade: nenhuma URL extraída do filas.yml').toBeGreaterThan(0);
    expect([...ROTAS]).toEqual(doFilas);
  });
});

describe('o deploy sobe o worker de um jeito que sobrevive a deploy e a reboot', () => {
  const yaml = ler(DEPLOY)
    .split('\n')
    .filter((l) => !/^\s*#/.test(l))
    .join('\n');

  it('o script que o deploy sobe existe', () => {
    expect(yaml).toMatch(/scripts\/worker-filas\.mjs/);
    expect(() => ler('scripts/worker-filas.mjs')).not.toThrow();
  });

  it('sempre `delete` + `start`, nunca `restart` (Unitech/pm2#3054, D-04)', () => {
    expect(yaml).toContain('pm2 delete behemp-filas');
    expect(yaml).toMatch(/pm2 start [^\n]*worker-filas\.mjs[^\n]*--name "behemp-filas"/);
    expect(yaml).not.toMatch(/pm2 (restart|reload) behemp-filas/);
  });

  it('`delete` antes de `start`, e os dois antes do `pm2 save` — é o dump que o boot restaura', () => {
    const deletar = yaml.indexOf('pm2 delete behemp-filas');
    const subir = yaml.search(/pm2 start [^\n]*worker-filas\.mjs/);
    const salvar = yaml.lastIndexOf('pm2 save');
    expect(deletar).toBeGreaterThan(-1);
    expect(deletar).toBeLessThan(subir);
    expect(subir).toBeLessThan(salvar);
  });

  it('sobe DEPOIS do `behemp-site`, que é quem as rotas precisam de pé', () => {
    const site = yaml.search(/pm2 start server\.js --name "behemp-site"/);
    const worker = yaml.search(/pm2 start [^\n]*worker-filas\.mjs/);
    expect(site).toBeGreaterThan(-1);
    expect(worker).toBeGreaterThan(site);
  });

  it('o worker falhar ao subir não pula o `pm2 save` do site', () => {
    // Com `set -e`, um `pm2 start` do worker que falhasse abortaria antes do save, e o dump
    // ficaria com o caminho ANTIGO do behemp-site — o reboot o ressuscitaria no build velho.
    const subir = yaml.match(/^[^\n]*pm2 start [^\n]*worker-filas\.mjs[^\n]*$/m)?.[0] ?? '';
    expect(subir, 'vacuidade: linha do start do worker não achada').not.toBe('');
    expect(subir).toMatch(/\|\|\s*WORKER_FALHOU=1/);
    const salvar = yaml.lastIndexOf('pm2 save');
    const denunciar = yaml.search(/if \[ -n "\$WORKER_FALHOU" \]/);
    expect(denunciar, 'a falha do worker não é denunciada depois do save').toBeGreaterThan(salvar);
  });
});

/**
 * O worker NÃO herda o ambiente do site.
 *
 * O shell do deploy carrega o `.env` inteiro com `set -a`, e o PM2 dá ao processo o ambiente
 * de quem chamou o `pm2 start` — e o grava no `dump.pm2`. Herdar duplicaria no dump todos os
 * segredos do site (a exposição do Item 43). Medido em 24/09/2026 com PM2 7.0.4: herdando, o
 * processo recebeu o segredo falso do shell; com `env -i`, só PATH, HOME, PORT e CRON_SECRET.
 */
describe('o worker sobe com ambiente mínimo, não com os segredos do site', () => {
  const yaml = ler(DEPLOY)
    .split('\n')
    .filter((l) => !/^\s*#/.test(l))
    .join('\n');
  const linhaDoStart = yaml.match(/^[^\n]*pm2 start [^\n]*worker-filas\.mjs[^\n]*$/m)?.[0] ?? '';

  /** O que fica entre `env -i` e `pm2 start`: as variáveis que o processo recebe. */
  const repassadas = (() => {
    const trecho = linhaDoStart.match(/env -i (.*?) pm2 start /)?.[1] ?? '';
    return [...trecho.matchAll(/(?:^|\s|:\+)([A-Z_][A-Z0-9_]*)=/g)].map((m) => m[1]);
  })();

  /** O que o worker precisa, e nada além. PM2_HOME só para não falar com outro daemon. */
  const PERMITIDAS = ['CRON_SECRET', 'HOME', 'PATH', 'PM2_HOME', 'PORT'];

  it('o `pm2 start` do worker roda sob `env -i`', () => {
    expect(linhaDoStart, 'vacuidade: linha do start do worker não achada').not.toBe('');
    expect(linhaDoStart).toMatch(/^\s*env -i .* pm2 start /);
  });

  it('só repassa variáveis da lista permitida', () => {
    expect(repassadas.length, 'vacuidade: nenhuma variável extraída do env -i').toBeGreaterThan(0);
    const fora = repassadas.filter((v) => !PERMITIDAS.includes(v));
    expect(fora, `variáveis a mais no ambiente do worker: ${fora.join(', ')}`).toEqual([]);
  });

  it('repassa as que o worker e o `pm2` precisam: CRON_SECRET, PORT, PATH e HOME', () => {
    for (const v of ['CRON_SECRET', 'PORT', 'PATH', 'HOME']) expect(repassadas).toContain(v);
  });

  it('a lista permitida cobre tudo que o núcleo lê do ambiente', () => {
    // Se o núcleo passar a ler uma variável nova, ela precisa entrar no `env -i` — e esta
    // lista precisa ser revista de propósito, não por acidente.
    const lidas = [...ler(NUCLEO).matchAll(/\benv\.([A-Z_]+)/g)].map((m) => m[1]);
    for (const v of lidas)
      expect(repassadas, `o núcleo lê ${v} e o deploy não repassa`).toContain(v);
  });
});
