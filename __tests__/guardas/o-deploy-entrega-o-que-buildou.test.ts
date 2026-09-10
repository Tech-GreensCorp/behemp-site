/**
 * GUARDA — o deploy entrega o que buildou, e falha alto quando não entrega.
 *
 * A CLASSE DE ERRO: entre 14/08 e 10/09/2026 todo deploy passou verde e produção
 * continuou servindo um build antigo. Não houve erro em log nenhum. Três defeitos
 * independentes cooperavam, e cada um sozinho já bastava para esconder o problema:
 *
 *   1. `pnpm build` terminava em `|| true` — build quebrado devolvia exit 0.
 *   2. `pm2 restart` reusa o caminho gravado no `pm2 start` original e NÃO relê o
 *      script (Unitech/pm2#3054): o rsync entregava, o PM2 reiniciava outro arquivo.
 *   3. Nada, em nenhum passo, conferia se o site passou a servir o build novo.
 *
 * O que este guarda garante é o oposto de cada um: falha propaga · o processo aponta
 * para o build deste deploy · e o workflow morre se produção não servir esse build.
 *
 * Fatiado por defeito, não por arquivo — a granularidade do teste é a do erro.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const raiz = process.cwd();
const ler = (p: string) => readFileSync(path.join(raiz, p), 'utf8');

const DEPLOY = '.github/workflows/deploy.yml';
const PACKAGE = 'package.json';
const NEXT_CONFIG = 'next.config.ts';

/**
 * ⚠️ Tira comentários de shell antes de procurar código.
 *
 * Sem isto o guarda confunde MENÇÃO com USO: o `deploy.yml` explica nos comentários
 * exatamente o que não pode voltar a existir, e um `includes()` cru acusaria o próprio
 * texto que documenta a correção. Já aconteceu 8 vezes neste repositório.
 */
function semComentarios(yaml: string): string {
  return yaml
    .split('\n')
    .filter((linha) => !/^\s*#/.test(linha))
    .join('\n');
}

describe('o build não pode perdoar a própria falha', () => {
  const pkg = JSON.parse(ler(PACKAGE)) as { scripts: Record<string, string> };
  const build = pkg.scripts.build;

  it('o script de build existe (vacuidade: sem isto os casos abaixo não testam nada)', () => {
    expect(build).toBeTruthy();
    expect(build).toContain('next build');
  });

  it('não termina em `|| true` — em shell isso perdoa TODA a cadeia, não só o último comando', () => {
    // (((next build && cpA) || true) && cpB) || true  →  exit 0 mesmo com o build quebrado.
    expect(build).not.toMatch(/\|\|\s*true/);
  });

  it('não silencia a saída de erro dos comandos que vêm depois do build', () => {
    expect(build).not.toContain('2>/dev/null');
  });
});

describe('o processo precisa apontar para o build deste deploy', () => {
  const yaml = semComentarios(ler(DEPLOY));

  it('o passo do PM2 existe (vacuidade)', () => {
    expect(yaml).toContain('pm2 save');
  });

  it('não usa `pm2 restart … || pm2 start …` — o fallback esconde o caminho divergente', () => {
    expect(yaml).not.toMatch(/pm2 restart[^\n]*\|\|[^\n]*pm2 start/);
  });

  it('lê o caminho que o processo usa hoje, em vez de supor', () => {
    expect(yaml).toContain('scripts/pm2-do-app.mjs --caminho');
  });

  it('compara esse caminho com o que o deploy entrega', () => {
    expect(yaml).toContain('CAMINHO_ATUAL');
    expect(yaml).toContain('CAMINHO_ESPERADO');
    expect(yaml).toMatch(/if \[ "\$CAMINHO_ATUAL" = "\$CAMINHO_ESPERADO" \]/);
  });

  it('recria o processo quando o caminho diverge — restart não resolveria', () => {
    expect(yaml).toContain('pm2 delete behemp-site');
    expect(yaml).toMatch(/pm2 start server\.js --name "behemp-site"/);
  });

  it('recusa mexer no processo se o server.js novo não chegou', () => {
    expect(yaml).toMatch(/if \[ ! -f server\.js \]/);
    // e a recusa tem de ser fatal, não um aviso
    const trecho = yaml.slice(yaml.indexOf('if [ ! -f server.js ]'));
    expect(trecho.slice(0, 400)).toContain('exit 1');
  });
});

describe('o ambiente é preservado ANTES de o processo ser recriado', () => {
  const yaml = semComentarios(ler(DEPLOY));

  it('o deploy chama o preservador de ambiente', () => {
    expect(yaml).toContain('scripts/preservar-ambiente-do-pm2.mjs');
  });

  /**
   * 🔴 O CASO QUE MEDE A ORDEM, NÃO A PRESENÇA.
   *
   * `pm2 delete` descarta o ambiente vivo do processo. Medido em 10/09/2026: o deploy
   * escreve 12 variáveis no `.env` e o app declara 61 — as outras só existem dentro do
   * processo. Sem `CLERK_SECRET_KEY`, TODA rota responde 500, inclusive as públicas.
   *
   * Preservar depois de deletar é o mesmo que não preservar.
   */
  it('preserva ANTES de deletar — depois seria tarde', () => {
    const preservar = yaml.indexOf('scripts/preservar-ambiente-do-pm2.mjs');
    const deletar = yaml.indexOf('pm2 delete behemp-site');
    expect(preservar).toBeGreaterThan(-1);
    expect(deletar).toBeGreaterThan(-1);
    expect(preservar).toBeLessThan(deletar);
  });

  it('o preservador copia só chaves declaradas — nunca PATH, HOME e afins', () => {
    const script = ler('scripts/preservar-ambiente-do-pm2.mjs');
    expect(script).toContain('chavesDoSchema');
    expect(script).toContain('lib/env.ts');
  });

  it('o preservador nunca imprime VALOR de variável', () => {
    const script = ler('scripts/preservar-ambiente-do-pm2.mjs');
    // a saída vai para o log público do Actions
    expect(script).not.toMatch(/console\.log\([^)]*doProcesso\[[^\]]+\]/);
  });
});

describe('o workflow morre se produção não passar a servir este build', () => {
  const yaml = ler(DEPLOY);

  it('existe um passo que confere produção depois do restart', () => {
    expect(yaml).toContain('Produção está servindo ESTE build?');
  });

  it('a conferência usa um arquivo com hash DESTE build', () => {
    expect(yaml).toContain('.next/static/chunks');
    expect(yaml).toContain('_next/static/chunks/');
  });

  it('e falha o job quando não confirma — senão seria só um aviso', () => {
    const passo = yaml.slice(yaml.indexOf('Produção está servindo ESTE build?'));
    expect(passo).toMatch(/set -e/);

    /**
     * ⚠️ Não basta procurar `exit 1` no passo: ele tem DOIS caminhos de erro (chunk
     * ausente e produção desatualizada) e um `exit 0` de sucesso. Trocar só o último por
     * um `echo` deixaria o portão decorativo — e o guarda passou verde nessa sabotagem,
     * em 10/09/2026, antes deste caso existir.
     *
     * O que importa é o caminho DEPOIS do laço de tentativas terminar em falha.
     */
    const aposODiagnostico = passo.slice(passo.indexOf('NÃO SERVE UM ARQUIVO DESTE BUILD'));
    expect(aposODiagnostico).toBeTruthy();
    expect(aposODiagnostico.trimEnd().endsWith('exit 1')).toBe(true);
  });

  it('e o caminho de sucesso sai com 0, senão o portão nunca deixaria passar', () => {
    const passo = yaml.slice(yaml.indexOf('Produção está servindo ESTE build?'));
    expect(passo).toMatch(/produção está servindo o build deste deploy[\s\S]{0,80}exit 0/i);
  });
});

describe('o build local não pode divergir do build do CI', () => {
  const config = ler(NEXT_CONFIG);

  it('a raiz do empacotamento é fixada, não inferida por lockfile vizinho', () => {
    expect(config).toContain('outputFileTracingRoot');
    expect(config).toContain('__dirname');
  });

  it('o output continua standalone (vacuidade: sem isto nada acima faz sentido)', () => {
    expect(config).toContain("output: 'standalone'");
  });
});

describe('controle — o guarda não pode acusar inocente', () => {
  it('não confunde a MENÇÃO nos comentários com o uso real', () => {
    // O deploy.yml documenta em comentário exatamente o que não pode voltar.
    // Se o filtro de comentários quebrar, este caso fica vermelho.
    const cru = ler(DEPLOY);
    expect(cru).toMatch(/#[^\n]*pm2 restart/);
    expect(semComentarios(cru)).not.toMatch(/#[^\n]*pm2 restart/);
  });

  it('o filtro de comentários não come linha de código que tenha `#` no meio', () => {
    const amostra = 'echo "a#b"\n  # comentario\n    codigo real\n';
    const filtrado = semComentarios(amostra);
    expect(filtrado).toContain('echo "a#b"');
    expect(filtrado).toContain('codigo real');
    expect(filtrado).not.toContain('# comentario');
  });
});
