/**
 * O CADASTRO NÃO OFERECE GOOGLE — e o login não cria conta por ele.
 *
 * 🔴 A DECISÃO, de Dryelle em 28/10/2026 (ADR-0033 D-14, P-14 e P-17b): _"remova isso (opção) de
 * cadastro com Google"_, e, sobre o alcance, _"todo o cadastro"_: o `/registrar-se` passa a ser
 * **só e-mail e senha**, para qualquer perfil.
 *
 * 🔴 O QUE O BOTÃO FAZIA, e por que importa (Item 70): `handleGoogleSignUp` ia direto ao OAuth,
 * **sem formulário e sem conferir "Li e concordo"**. Nenhum aceite dos Termos passava por ali.
 *
 * ⚠️ TIRAR O BOTÃO NÃO BASTA, e o motivo foi lido na doc oficial do Clerk (`<SignIn />`): a prop
 * `transferable` tem padrão `true`, _"whether or not sign in attempts are transferable to the
 * sign up flow"_, e `false` _"prevents opaque sign ups"_. O `/entrar` renderiza esse widget
 * (com botões sociais, em "outras formas" e nos subcaminhos do Clerk). Sem `transferable={false}`,
 * quem entra com um Google que não tem conta pode ser levado ao cadastro — pela porta dos fundos.
 * O Google segue **entrando** quem já tem conta: desligá-lo no painel do Clerk deixaria sem acesso
 * quem criou conta por ele.
 *
 * DERIVA DO DISCO (Regra 1): varre `app/` e `components/`. Um `<SignIn` ou `<SignUp` novo, em
 * qualquer tela, nasce acusado sem ninguém lembrar de listá-lo.
 *
 * ⚠️ O QUE ESTE GUARDA **NÃO** PROVA: que, com `transferable={false}`, um Google desconhecido
 * realmente deixa de criar conta. Isso depende do Clerk e da configuração da instância, e a doc
 * não diz com clareza o caso de OAuth. **Exige a verificação manual** descrita no D-14 (uma conta
 * Google inexistente, num Clerk de desenvolvimento). Este guarda prova que o CÓDIGO está escrito
 * como a decisão pede, e só isso.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { semComentarios } from './_apoio/codigo';

const RAIZ = join(__dirname, '..', '..');

function arquivos(dir: string, acc: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    if (nome === 'node_modules' || nome === '.next') continue;
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) arquivos(caminho, acc);
    else if (/\.(ts|tsx)$/.test(nome)) acc.push(caminho);
  }
  return acc;
}

const TELAS = ['app', 'components']
  .flatMap((d) => arquivos(join(RAIZ, d)))
  .map((p) => ({
    caminho: relative(RAIZ, p).replace(/\\/g, '/'),
    codigo: semComentarios(readFileSync(p, 'utf8')),
  }));

const CADASTRO = TELAS.find((f) => f.caminho === 'app/(auth)/registrar-se/[[...sign-up]]/page.tsx');
const ENTRAR = TELAS.find((f) => f.caminho === 'app/(auth)/entrar/[[...sign-in]]/page.tsx');

/**
 * As props de abertura de um elemento JSX (`<SignIn ... />`): vai do nome até o `>` que fecha a
 * abertura, contando as chaves — `appearance={{ ... }}` tem `>` dentro (`=>`, comparações).
 */
function abertura(codigo: string, inicio: number): string {
  let nivel = 0;
  for (let i = inicio; i < codigo.length; i++) {
    const c = codigo[i];
    if (c === '{') nivel++;
    else if (c === '}') nivel--;
    else if (c === '>' && nivel === 0 && codigo[i - 1] !== '=') return codigo.slice(inicio, i + 1);
  }
  return codigo.slice(inicio);
}

describe('o cadastro não oferece Google, e o login não cria conta por ele', () => {
  it('⚠️ VACUIDADE: o guarda enxerga o cadastro, o login e os widgets do Clerk', () => {
    expect(CADASTRO, 'não achei a tela de cadastro').toBeDefined();
    expect(ENTRAR, 'não achei a tela de login').toBeDefined();
    // O cadastro por e-mail continua existindo: se `signUp.create` sumir, o arquivo lido é outro.
    expect(CADASTRO!.codigo).toMatch(/signUp\.create\(/);
    expect(ENTRAR!.codigo).toMatch(/<SignIn\b/);
    expect(TELAS.length).toBeGreaterThan(200);
  });

  it('🔴 o `/registrar-se` não usa nenhum provedor OAuth', () => {
    // `oauth_google`, `oauth_apple`…: qualquer estratégia social cria conta sem passar pelo
    // formulário e pelo aceite dos Termos.
    expect(CADASTRO!.codigo, 'o cadastro oferece login social').not.toMatch(/oauth_\w+/);
    expect(CADASTRO!.codigo).not.toMatch(/authenticateWithRedirect/);
  });

  it('🔴 o `/registrar-se` não tem o botão, o handler nem o ícone do Google', () => {
    expect(CADASTRO!.codigo).not.toMatch(/handleGoogleSignUp/);
    expect(CADASTRO!.codigo, 'sobrou texto "Google" na tela de cadastro').not.toMatch(/google/i);
    // O azul do logotipo: o SVG do botão não pode ficar de enfeite.
    expect(CADASTRO!.codigo).not.toMatch(/#4285F4/i);
  });

  it('🔴 todo `<SignIn` do projeto passa `transferable={false}`', () => {
    const sem: string[] = [];
    let total = 0;
    for (const { caminho, codigo } of TELAS) {
      for (const m of codigo.matchAll(/<SignIn\b/g)) {
        total++;
        if (!/transferable=\{false\}/.test(abertura(codigo, m.index!))) sem.push(caminho);
      }
    }
    expect(total, 'nenhum <SignIn> encontrado: o guarda não está olhando nada').toBeGreaterThan(0);
    expect(sem, 'login que pode transferir para o cadastro (conta criada por Google)').toEqual([]);
  });

  it('🔴 nenhuma tela usa o widget `<SignUp` do Clerk (cadastro com login social embutido)', () => {
    const onde = TELAS.filter((f) => /<SignUp\b/.test(f.codigo)).map((f) => f.caminho);
    expect(onde).toEqual([]);
  });

  it('o cadastro por e-mail e senha continua de pé', () => {
    // Remover o Google não pode levar junto o caminho que sobra.
    expect(CADASTRO!.codigo).toMatch(/prepareEmailAddressVerification/);
    expect(CADASTRO!.codigo).toMatch(/attemptEmailAddressVerification/);
    expect(CADASTRO!.codigo, 'o link "já tenho conta" sumiu junto').toMatch(/\/entrar/);
  });
});
