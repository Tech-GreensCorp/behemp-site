/**
 * O LOGIN NÃO LEVA PARA FORA — e o caminho de volta ao cadastro não se perde.
 *
 * 🔴 DOIS DEFEITOS NO MESMO LUGAR, medidos em 12/09/2026 enquanto se corrigia o fluxo 3 da
 * Greens (a recompra).
 *
 * **1. O caminho de volta se perdia.** No cadastro por link, quando o e-mail já tem conta, a
 * tela oferece _"Entrar na minha conta"_ — e o botão apontava para `/entrar`, sem dizer para
 * onde voltar. A tela de login **aceita** `?redirect_url=` e, sem ele, cai no padrão
 * `/redirect`: o paciente ia para o painel, com o token perdido e as caixas de consentimento
 * desmarcadas. É exatamente quem vem da recompra — ele já tem conta, é por isso que voltou.
 *
 * **2. Quem já estava logado ignorava o destino.** O efeito de sessão viva fazia
 * `router.replace('/redirect')` fixo, descartando em silêncio o `redirect_url` que a mesma
 * tela calcula e que o `<SignIn/>` respeita.
 *
 * 🔴 E CORRIGIR O SEGUNDO ABRIU UM TERCEIRO, QUE JÁ EXISTIA: `redirect_url` vem da URL, logo
 * é **entrada do usuário**. Um `/entrar?redirect_url=https://site-falso.com` leva o paciente
 * para fora **depois** de ele digitar a senha — e o link saiu do domínio verdadeiro, com
 * cadeado. É redirecionamento aberto (OWASP A01).
 *
 * ⚠️ DUAS DEFESAS EM SÉRIE, E ISSO CONFUNDIU AS PRIMEIRAS SABOTAGENS. `startsWith('//')` e a
 * prova da origem barram as mesmas entradas por caminhos diferentes: remover **uma** não
 * abre o buraco, e três sabotagens minhas "passaram" por isso — eu tinha sabotado uma defesa
 * redundante, não a defesa. Medido: só removendo **as duas** o guarda acusa (3 casos). A
 * redundância é de propósito; a lição é que sabotagem precisa atingir a garantia, não uma das
 * camadas.
 *
 * ⚠️ A MESMA CLASSE JÁ TINHA SIDO TRATADA DO LADO DO PARCEIRO:
 * `handoff-do-parceiro-e-assinado-e-idempotente` exige que a URL de retorno seja conferida
 * por **origem**, nunca por prefixo — `https://be4hope.org.site-falso.com` começa com o
 * prefixo certo. Aqui a regra é mais dura: **não existe destino externo legítimo** depois do
 * login.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { destinoInternoSeguro, DESTINO_PADRAO } from '@/lib/auth/destino-interno';

const RAIZ = join(__dirname, '..', '..');
const ler = (p: string) => readFileSync(join(RAIZ, p), 'utf8');
const semComentarios = (f: string) =>
  f.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const LOGIN = semComentarios(ler('app/(auth)/entrar/[[...sign-in]]/page.tsx'));
const CADASTRO = semComentarios(
  ler('app/(auth)/cadastro/[token]/_components/formulario-de-cadastro.tsx'),
);

describe('o login não leva para fora', () => {
  it('🔴 caminho interno passa — senão o filtro quebraria o produto', () => {
    expect(destinoInternoSeguro('/cadastro/abc123')).toBe('/cadastro/abc123');
    expect(destinoInternoSeguro('/paciente/anvisa')).toBe('/paciente/anvisa');
    expect(destinoInternoSeguro('/paciente?aba=documentos')).toBe('/paciente?aba=documentos');
  });

  it.each([
    ['https://site-falso.com', 'absoluto com esquema'],
    ['http://site-falso.com', 'http'],
    ['//site-falso.com', '🔴 protocol-relative — o navegador TROCA DE SITE'],
    ['/\\site-falso.com', '🔴 barra invertida, que alguns navegadores normalizam'],
    ['javascript:alert(1)', 'esquema javascript'],
    ['https://be4hope.org.site-falso.com', '🔴 começa com o prefixo certo e NÃO é nosso'],
    [
      '//be4hope.org.site-falso.com',
      '🔴 protocol-relative COM o nosso domínio como prefixo — passa em quem confere prefixo',
    ],
    [
      '//be4hope.org@site-falso.com',
      '🔴 o `@` é userinfo: o host REAL é site-falso.com, e o humano lê be4hope.org primeiro',
    ],
    ['data:text/html,<script>', 'data URI'],
    ['  https://site-falso.com  ', 'com espaços em volta'],
  ])('🔴 `%s` NÃO passa (%s)', (entrada) => {
    expect(destinoInternoSeguro(entrada)).toBe(DESTINO_PADRAO);
  });

  /**
   * 🔴 O CASO QUE UMA SABOTAGEM MINHA REVELOU FALTANDO.
   *
   * A sabotagem era trocar a prova da origem por `href.startsWith(base)` — conferir por
   * PREFIXO. Ela **passou**: nenhuma das minhas entradas distinguia as duas checagens, e o
   * guarda aprovava a versão furada.
   *
   * ⚠️ É a MESMA classe que `handoff-do-parceiro-e-assinado-e-idempotente` já documenta do
   * lado do parceiro — _"a URL de retorno passar a ser conferida por PREFIXO em vez de
   * origem (redirecionamento aberto)"_. Eu tinha lido essa linha hoje e reproduzi o defeito
   * mesmo assim, porque não construí a entrada que separa os dois.
   *
   * As duas entradas abaixo passam por prefixo e falham por origem. Medido com `new URL`:
   *
   *     '//be4hope.org.site-falso.com'  → origin https://be4hope.org.site-falso.com
   *     '//be4hope.org@site-falso.com'  → origin https://site-falso.com   ← o `@` é userinfo
   */
  it('🔴 conferir por PREFIXO não basta — as duas formas que só a ORIGEM pega', () => {
    const base = 'https://be4hope.org';
    for (const entrada of ['//be4hope.org.site-falso.com', '//be4hope.org@site-falso.com']) {
      // O que um filtro por prefixo veria: href começa com o nosso domínio.
      expect(new URL(entrada, base).href.startsWith(base)).toBe(true);
      // O que a origem revela: não é a nossa.
      expect(new URL(entrada, base).origin).not.toBe(base);
      // E o filtro recusa.
      expect(destinoInternoSeguro(entrada)).toBe(DESTINO_PADRAO);
    }
  });

  it('vazio, nulo e indefinido caem no padrão', () => {
    expect(destinoInternoSeguro(null)).toBe(DESTINO_PADRAO);
    expect(destinoInternoSeguro(undefined)).toBe(DESTINO_PADRAO);
    expect(destinoInternoSeguro('   ')).toBe(DESTINO_PADRAO);
  });

  it('⚠️ VACUIDADE: o padrão é um caminho interno de verdade', () => {
    // Se o padrão fosse externo, todos os casos acima passariam sem provar nada.
    expect(DESTINO_PADRAO.startsWith('/')).toBe(true);
    expect(DESTINO_PADRAO.startsWith('//')).toBe(false);
  });

  it('🔴 a TELA de login usa o filtro — não lê `redirect_url` cru', () => {
    expect(LOGIN).toContain('destinoInternoSeguro');
    // E não sobra nenhuma leitura crua do parâmetro.
    expect(LOGIN).not.toMatch(/searchParams\.get\('redirect_url'\)\s*\|\|/);
  });

  it('🔴 quem JÁ está logado também respeita o destino pedido', () => {
    // Era `router.replace('/redirect')` fixo: o destino era descartado em silêncio.
    expect(LOGIN).not.toMatch(/router\.replace\('\/redirect'\)/);
    expect(LOGIN).toMatch(/router\.replace\(redirectUrl\)/);
  });

  it('🔴 e o botão "Entrar na minha conta" LEVA o token junto', () => {
    // Sem isto, o paciente da recompra volta ao painel e perde o cadastro que preenchia.
    const i = CADASTRO.indexOf('Entrar na minha conta');
    expect(i).toBeGreaterThan(-1);
    const bloco = CADASTRO.slice(Math.max(0, i - 500), i);
    expect(bloco).toContain('redirect_url=');
    expect(bloco).toMatch(/\$\{token\}/);
  });

  it('⚠️ e o destino vai codificado — um token com caractere especial partiria a query', () => {
    const i = CADASTRO.indexOf('Entrar na minha conta');
    const bloco = CADASTRO.slice(Math.max(0, i - 500), i);
    expect(bloco).toContain('encodeURIComponent');
  });
});
