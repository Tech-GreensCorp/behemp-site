/**
 * A CONTA NASCE NA CONFIRMAÇÃO DO E-MAIL — não antes, e já com senha.
 *
 * 🔴 DECISÃO DO DONO em 12/09/2026, e a frase dele é o diagnóstico inteiro:
 *
 *   _"a gente não precisa sair do fluxo de criação do Clerk, ele só tem que ocorrer na
 *   confirmação de e-mail; se não, acontece exatamente isso de que minha conta já existe mas
 *   pra entrar nela eu não consigo, porque a senha não foi gerada… ou seja, na última etapa,
 *   por conta do erro do código, eu perdi minha conta."_
 *
 * ⚠️ O QUE ACONTECIA COM TUDO NO `create`. Enviando e-mail, senha e nome de uma vez, se o
 * fluxo morresse entre o `create` e a confirmação — e morreu, com `session_exists` —, sobrava
 * um cadastro segurando aquele e-mail. Voltar dava `form_identifier_exists` ("já existe uma
 * conta"), e entrar não dava, porque a senha nunca tinha sido gravada. **Preso dos dois
 * lados**, com os dados que o parceiro mandou parados esperando um cadastro que já não podia
 * ser feito.
 *
 * 🔴 A GARANTIA VEM DA DOC DO CLERK, e é o que sustenta a ordem: o status `'complete'`
 * significa _"The user has been created and the custom flow can proceed to setActive()"_.
 * Enquanto faltar requisito o status é `'missing_requirements'` e **não há conta** — há uma
 * tentativa. Mandando a senha depois da verificação, a conta nasce num passo só, já com
 * senha, e o estado "conta existe, senha não" deixa de ser possível.
 *
 * ⚠️ E não é desvio: `update()` aceita os mesmos campos de `create()`, e `missingFields`
 * lista o que falta — o fluxo incremental é previsto pelo próprio objeto `SignUp`.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..', '..');
const CAMINHO = 'app/(auth)/cadastro/[token]/_components/formulario-de-cadastro.tsx';
const FONTE = readFileSync(join(RAIZ, CAMINHO), 'utf8');
const CODIGO = FONTE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

function corpoDe(nome: string): string {
  const i = CODIGO.indexOf(`async function ${nome}(`);
  expect(i, `não achei ${nome}`).toBeGreaterThan(-1);
  return CODIGO.slice(i, i + 3200);
}

describe('a conta nasce na confirmação do e-mail', () => {
  it('⚠️ VACUIDADE: o fluxo ainda usa o `signUp` do Clerk', () => {
    // A decisão foi NÃO sair do Clerk. Se o fluxo mudar de provedor, este guarda precisa
    // ser repensado, não silenciosamente satisfeito.
    expect(CODIGO).toContain('signUp.create(');
    expect(CODIGO).toContain('attemptEmailAddressVerification');
  });

  it('🔴 o `create` leva SÓ o e-mail — senha e nome não vão na primeira etapa', () => {
    /**
     * ⚠️ DEFEITO MEU, achado por sabotagem. A primeira versão fatiava até o primeiro `)`
     * — e o primeiro `)` da chamada é o de `email.trim()`, não o do `create`. O recorte
     * parava em `signUp.create({ emailAddress: email.trim()` e nunca via a senha. A
     * sabotagem "a senha volta para o create" PASSOU.
     *
     * Agora o recorte vai até o fecho do OBJETO (`})`), que é o que delimita os argumentos.
     */
    const corpo = corpoDe('criarConta');
    const i = corpo.indexOf('signUp.create(');
    const fim = corpo.indexOf('})', i);
    expect(fim, 'não achei o fecho da chamada').toBeGreaterThan(i);
    const chamada = corpo.slice(i, fim + 2);

    expect(chamada).toContain('emailAddress');
    expect(chamada, 'a senha voltou para o create').not.toMatch(/password/);
    expect(chamada, 'o nome voltou para o create').not.toMatch(/firstName|lastName/);
  });

  it('🔴 a SENHA é entregue depois da verificação, no `update`', () => {
    const corpo = corpoDe('confirmarCodigo');
    const verificacao = corpo.indexOf('attemptEmailAddressVerification');
    const update = corpo.indexOf('signUp.update(');
    expect(update, 'não achei o update').toBeGreaterThan(-1);
    expect(update, 'o update acontece ANTES da verificação').toBeGreaterThan(verificacao);
    expect(corpo.slice(update, update + 220)).toMatch(/password:\s*senha/);
  });

  it('🔴 e o NOME também — é o mesmo passo que cria a conta', () => {
    const corpo = corpoDe('confirmarCodigo');
    const i = corpo.indexOf('signUp.update(');
    expect(corpo.slice(i, i + 260)).toMatch(/firstName/);
    expect(corpo.slice(i, i + 260)).toMatch(/lastName/);
  });

  it('⚠️ o `update` é pulado quando a verificação já completou sozinha', () => {
    // Se a instância não exigir senha, o `attempt` já devolve `complete`. Chamar `update`
    // depois disso seria erro — e o código verifica antes.
    const corpo = corpoDe('confirmarCodigo');
    expect(corpo).toMatch(/verificado\.status === 'complete'\s*\?\s*verificado/);
  });

  it('🔴 a sessão só abre com status `complete` — que é quando a conta existe', () => {
    const corpo = corpoDe('confirmarCodigo');
    const checagem = corpo.indexOf("conclusao.status !== 'complete'");
    const setActive = corpo.indexOf('setActive(');
    expect(checagem).toBeGreaterThan(-1);
    expect(setActive, 'a sessão abre antes de a conta existir').toBeGreaterThan(checagem);
  });

  it('⚠️ e quando falta requisito, a tela DIZ QUAL — não manda "tentar de novo"', () => {
    // "Tente novamente" sem dizer o quê foi o que prendeu o dono por duas rodadas.
    const corpo = corpoDe('confirmarCodigo');
    expect(corpo).toMatch(/missingFields/);
  });

  it('🔴 a senha continua sendo VALIDADA na etapa 1 — só a entrega é que mudou', () => {
    // Adiar a entrega não pode virar adiar a conferência: o paciente descobriria que a
    // senha é fraca só depois de confirmar o e-mail, e aí o cadastro já parou.
    /**
     * ⚠️ SEGUNDO DEFEITO MEU, da mesma família: `indexOf('podeEnviar')` achava a primeira
     * MENÇÃO, que estava num comentário — e o recorte de 400 caracteres a partir dali não
     * continha a definição. A sabotagem "a senha deixa de ser validada" PASSOU.
     *
     * Agora ancora na DECLARAÇÃO. Menção não é uso — a mesma lição que o repositório já
     * aprendeu várias vezes, e que eu repeti mesmo assim.
     */
    expect(CODIGO).toMatch(/const senhaValida/);
    expect(CODIGO).toMatch(/const senhasConferem/);

    const i = CODIGO.indexOf('const podeEnviar');
    expect(i, 'não achei a declaração de podeEnviar').toBeGreaterThan(-1);
    const bloco = CODIGO.slice(i, CODIGO.indexOf(';', i));
    expect(bloco, 'a senha saiu da condição de envio').toMatch(/senhaValida/);
    expect(bloco, 'a conferência das senhas saiu').toMatch(/senhasConferem/);
  });
});
