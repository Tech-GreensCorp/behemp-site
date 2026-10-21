/**
 * O CSP CONHECE O QUE A PÁGINA DE CADASTRO CARREGA — e o Turnstile é o caso que falhou.
 *
 * 🔴 O ACHADO, 11/09/2026. O cadastro em produção respondia `captcha_missing_token` (400), e
 * o console do navegador, aberto pelo dono, reportava:
 *
 *     Content-Security-Policy: (Report-Only) … podem impedir a execução de um script
 *     (script-src-elem) em https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit
 *
 *     Content-Security-Policy: (Report-Only) … podem impedir o carregamento de um recurso
 *     (frame-src) em https://challenges.cloudflare.com/cdn-cgi/challenge-platform/…
 *
 * ⚠️ E ISTO NÃO ERA A CAUSA DO ERRO DAQUELE DIA — o cabeçalho é
 * `Content-Security-Policy-Report-Only`, que **relata e não bloqueia**. Fica escrito porque a
 * tentação, ao ver duas linhas vermelhas no console, é chamá-las de causa. Já gastei dois
 * deploys hoje com causa suposta.
 *
 * 🔴 O QUE ISTO GUARDA, ENTÃO: que o relatório fique **vazio de propósito**, e não vazio por
 * acaso. Um CSP em Report-Only é um CSP que alguém um dia vai promover a enforcing — é para
 * isso que ele existe. No dia em que o cabeçalho perder o sufixo `-Report-Only`, tudo que hoje
 * é "aviso" vira bloqueio, e o cadastro para de funcionar **sem que ninguém tenha mexido no
 * cadastro**. Este guarda exige que a lista já esteja certa antes disso.
 *
 * ⚠️ DERIVADO DO CÓDIGO, não de uma lista paralela: a exigência só vale **se** o produto usa o
 * captcha do Clerk, e isso se descobre procurando o elemento que o SDK exige (`clerk-captcha`).
 * Se um dia o produto deixar de usar bot protection, o guarda deixa de exigir sozinho — e o
 * caso de vacuidade abaixo fica vermelho se o detector parar de achar o que procura.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..', '..');

/** Remove comentários — menção não é uso, e um host citado em comentário não protege ninguém. */
function semComentarios(fonte: string): string {
  return fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function arquivosDe(dir: string, ext: RegExp, achados: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    if (nome === 'node_modules' || nome === '.next' || nome === '.git') continue;
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) arquivosDe(caminho, ext, achados);
    else if (ext.test(nome)) achados.push(caminho);
  }
  return achados;
}

const CONFIG = semComentarios(readFileSync(join(RAIZ, 'next.config.ts'), 'utf8'));

/** Extrai uma diretiva do CSP tal como o arquivo a declara. */
function diretiva(nome: string): string {
  // A aspa de fechamento é a MESMA que abriu (backreference): o valor contém `'self'`, e um
  // conjunto negado simples pararia nessa aspa simples — foi assim que a primeira versão
  // deste extrator devolveu string vazia e deixou os casos passarem por vacuidade.
  const m = CONFIG.match(new RegExp(`(["'\`])${nome}\\s([\\s\\S]*?)\\1`));
  return m ? m[2] : '';
}

/** As telas que pedem ao Clerk para desenhar o captcha — descobertas, não listadas. */
const TELAS_COM_CAPTCHA = arquivosDe(join(RAIZ, 'app'), /\.tsx$/).filter((f) =>
  semComentarios(readFileSync(f, 'utf8')).includes('id="clerk-captcha"'),
);

/**
 * O host do Turnstile. Vem da doc do Clerk e do relatório do próprio navegador, não de
 * suposição: o SDK carrega `challenges.cloudflare.com/turnstile/v0/api.js` e abre um iframe
 * em `challenges.cloudflare.com/cdn-cgi/challenge-platform/…`.
 */
const TURNSTILE = 'https://challenges.cloudflare.com';

describe('o CSP conhece o captcha do Clerk', () => {
  it('⚠️ VACUIDADE: o detector acha as telas que usam o captcha', () => {
    // Se este caso cair, os três abaixo passariam por não terem o que exigir.
    expect(TELAS_COM_CAPTCHA.length).toBeGreaterThan(0);
  });

  it('⚠️ VACUIDADE: as três diretivas existem no next.config.ts', () => {
    for (const d of ['script-src', 'frame-src', 'connect-src']) {
      expect(diretiva(d), `diretiva ${d} não encontrada`).not.toBe('');
    }
  });

  it.each(['script-src', 'frame-src', 'connect-src'])(
    '🔴 `%s` permite o Turnstile — sem isso, promover o CSP a enforcing quebra o cadastro',
    (nome) => {
      expect(diretiva(nome)).toContain(TURNSTILE);
    },
  );

  it('e continua permitindo o próprio Clerk — o conserto não pode trocar um buraco por outro', () => {
    expect(diretiva('script-src')).toContain('clerk.accounts.dev');
    expect(diretiva('frame-src')).toContain('clerk.accounts.dev');
    expect(diretiva('connect-src')).toContain('clerk.accounts.dev');
  });

  it('🔴 o host não vale se estiver só em comentário', () => {
    // `diretiva()` lê de `CONFIG`, que já passou por `semComentarios`. Este caso prova isso:
    // um host citado em prosa não pode satisfazer nenhuma das exigências acima.
    const comentado = semComentarios(`// ${TURNSTILE}\n"script-src 'self'"`);
    expect(comentado).not.toContain(TURNSTILE);
  });
});
