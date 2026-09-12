/**
 * O CADASTRO RETOMA DE ONDE PAROU — não recomeça, e não pede conta a quem já tem.
 *
 * 🔴 PEDIDO DO DONO em 12/09/2026, testando o fluxo 1: _"não teria como eu continuar o meu
 * cadastro? deveria ter essa opção de continuar um cadastro; se eu parei na etapa de verificar
 * o código do e-mail, quando eu entrasse na minha conta era para aparecer justamente essa
 * tela"_. E a razão que ele deu é a que decide: _"isso pode ser um caso real do paciente
 * BeHemp, nós temos que prevenir esse tipo de coisa"_.
 *
 * ⚠️ QUEM PARA NO MEIO NÃO PARA POR DISTRAÇÃO. Para porque o código demorou, porque trocou de
 * aparelho para abrir o e-mail, porque a bateria acabou, porque um deploy subiu. São dois
 * estados diferentes, e cada um tinha o seu beco:
 *
 * **1. `signUp` pendente, e-mail não confirmado.** O Clerk guarda esse estado no navegador. A
 * tela ignorava: `etapa` nascia `'dados'` sempre. Ao preencher de novo, o Clerk respondia
 * `form_identifier_exists` — para alguém que estava no meio do próprio cadastro.
 *
 * **2. Sessão viva, ficha não gravada.** Foi o estado do dono no SOL-000046: conta criada,
 * e-mail confirmado, sessão aberta — e a gravação falhou. O link não servia para mais nada,
 * porque a tela insistia em criar uma conta que já existia.
 *
 * 🔴 E RETOMAR SÓ VALE PARA O MESMO E-MAIL. Um `signUp` pendente de OUTRO endereço — o
 * paciente digitou errado e voltou, ou é outra pessoa no mesmo navegador — não pode sequestrar
 * este cadastro. Sem essa condição, a retomada vira troca de identidade.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..', '..');
const CAMINHO = 'app/(auth)/cadastro/[token]/_components/formulario-de-cadastro.tsx';
const FONTE = readFileSync(join(RAIZ, CAMINHO), 'utf8');
const CODIGO = FONTE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** O corpo de uma função declarada no componente. */
function corpoDe(nome: string): string {
  const i = CODIGO.indexOf(`async function ${nome}(`);
  expect(i, `não achei ${nome}`).toBeGreaterThan(-1);
  return CODIGO.slice(i, i + 2600);
}

describe('o cadastro retoma de onde parou', () => {
  it('⚠️ VACUIDADE: o componente usa o estado do Clerk', () => {
    expect(CODIGO).toContain('useSignUp');
    expect(CODIGO).toContain('useAuth');
  });

  it('🔴 lê o `signUp` PENDENTE ao montar — o estado existia e ninguém olhava', () => {
    expect(CODIGO).toMatch(/signUp\.status === 'missing_requirements'/);
    expect(CODIGO).toMatch(/verifications\?\.emailAddress\?\.status === 'unverified'/);
  });

  it('🔴 e pula para a etapa do CÓDIGO, que é onde o paciente parou', () => {
    const i = CODIGO.indexOf("signUp.status === 'missing_requirements'");
    expect(CODIGO.slice(i, i + 900)).toMatch(/setEtapa\('codigo'\)/);
  });

  it('🔴 a retomada exige o MESMO e-mail — senão vira troca de identidade', () => {
    const i = CODIGO.indexOf("signUp.status === 'missing_requirements'");
    const bloco = CODIGO.slice(i, i + 900);
    // O e-mail pendente é lido e vira a fonte; sem ele, não retoma.
    expect(bloco).toMatch(/signUp\.emailAddress\?\.toLowerCase\(\)/);
    expect(bloco).toMatch(/if \(!pendente \|\| !emailPendente \|\| !aguardandoCodigo\) return;/);
  });

  it('⚠️ e não retoma em looping — uma vez só', () => {
    // Sem a trava, o efeito reescreveria a etapa a cada render e o paciente não sairia dali.
    expect(CODIGO).toMatch(/setRetomado\(true\)/);
    expect(CODIGO).toMatch(/etapa !== 'dados' \|\| retomado/);
  });

  it('🔴 "Corrigir meus dados" NÃO é desfeito pela retomada', () => {
    /**
     * ⚠️ DEFEITO DA PRÓPRIA RETOMADA, achado ao revisar o caminho de volta que o dono pediu:
     * _"também poder voltar para a primeira etapa"_.
     *
     * O efeito dispara quando `etapa === 'dados'` e ainda não retomou. Quem clicasse em
     * "Corrigir meus dados" voltava para a etapa 1 e era **jogado de volta** para a do
     * código no render seguinte — preso, sem nunca conseguir corrigir o que estava errado.
     * Conserto que cria beco novo é o modo de falha mais caro que existe.
     */
    const i = CODIGO.indexOf('Corrigir meus dados');
    expect(i, 'não achei o botão de voltar').toBeGreaterThan(-1);
    // O handler fica ANTES do rótulo no JSX; a marca precisa estar nele.
    const bloco = CODIGO.slice(Math.max(0, i - 700), i);
    expect(bloco).toMatch(/setRetomado\(true\)/);
    expect(bloco).toMatch(/setEtapa\('dados'\)/);
  });

  it('🔴 com SESSÃO VIVA, pula o Clerk e grava só a ficha', () => {
    /**
     * ⚠️ A CONDIÇÃO GANHOU UMA TERCEIRA PARTE em 12/09/2026, e este caso acompanhou.
     *
     * Era `if (authCarregou && isSignedIn)`. Com três contas no mesmo navegador, o dono
     * abriu um link de um e-mail estando logado com outro — e o atalho gravaria a ficha
     * dele na conta errada. Agora exige também `!sessaoEDeOutraPessoa`, e quem garante isso
     * é `a-sessao-precisa-ser-do-dono-do-link`.
     */
    const corpo = corpoDe('criarConta');
    expect(corpo).toMatch(/if \(authCarregou && isSignedIn && !sessaoEDeOutraPessoa\)/);
    const i = corpo.indexOf('if (authCarregou && isSignedIn && !sessaoEDeOutraPessoa)');
    expect(corpo.slice(i, i + 200)).toMatch(/gravarFicha\(\)/);
  });

  it('⚠️ e só age depois de o Clerk SABER se há sessão', () => {
    // `isSignedIn` é `undefined` enquanto carrega. Agir antes trataria todo mundo como
    // deslogado, e a retomada nunca aconteceria.
    expect(CODIGO).not.toMatch(/if \(isSignedIn\)\s*\{\s*await gravarFicha/);
  });

  /**
   * 🔴 O CLERK NÃO COMPLETA UM `signUp` COM SESSÃO ATIVA — e o cadastro morria no meio.
   *
   * Medido com o dono em 12/09/2026: _"o sistema loga assim que clico em criar a conta,
   * sendo que era pra logar após eu inserir o código do e-mail… tentei inserir o código e
   * deu erro que eu já estava logado; saí da conta e tentei entrar com minha senha, e não
   * foi"_.
   *
   * ⚠️ O `create` PASSA — e por isso parece que deu certo. É o
   * `attemptEmailAddressVerification` seguinte que responde `session_exists`. O `signUp`
   * fica pendente, a conta NUNCA chega a existir (sem e-mail verificado não há conta), e a
   * senha recém-escolhida não serve para entrar. Limbo, sem saída visível.
   *
   * A saída é sair da sessão ANTES, nos dois pontos — e automaticamente. Pedir de novo o
   * que o paciente já fez é o que transforma correção em beco.
   */
  it('🔴 sai da sessão ANTES de criar o cadastro', () => {
    const corpo = corpoDe('criarConta');
    const i = corpo.indexOf('if (authCarregou && isSignedIn) {');
    expect(i, 'criarConta não sai da sessão').toBeGreaterThan(-1);
    expect(corpo.slice(i, i + 120)).toMatch(/await signOut\(\)/);
    // E isso acontece ANTES do `signUp.create`, senão não adianta.
    expect(i).toBeLessThan(corpo.indexOf('signUp.create('));
  });

  it('🔴 e sai de novo ANTES de confirmar o código — a sessão pode nascer entre as etapas', () => {
    const corpo = corpoDe('confirmarCodigo');
    const saida = corpo.indexOf('await signOut()');
    const tentativa = corpo.indexOf('attemptEmailAddressVerification');
    expect(saida, 'confirmarCodigo não sai da sessão').toBeGreaterThan(-1);
    expect(tentativa).toBeGreaterThan(saida);
  });

  it('🔴 a gravação da ficha é UM caminho só, usado pelos dois pontos de entrada', () => {
    // Duas cópias é como nasce a divergência: uma ganha campo novo, a outra não, e o
    // paciente que veio pelo segundo caminho fica sem ele.
    expect((CODIGO.match(/concluirCadastroPorLink\(\{/g) ?? []).length).toBe(1);
    expect((CODIGO.match(/async function gravarFicha\(/g) ?? []).length).toBe(1);
    expect((CODIGO.match(/await gravarFicha\(\)/g) ?? []).length).toBe(2);
  });

  it('🔴 o botão NÃO promete criar conta a quem já tem', () => {
    // `textos.botao` diz "Criar conta e …" — certo para quem chega sem conta, mentira para
    // quem volta com sessão viva e só precisa da ficha.
    expect(CODIGO).toMatch(/authCarregou && isSignedIn \? 'Concluir meu cadastro' : textos\.botao/);
  });

  it('⚠️ nem diz "criando sua conta" enquanto grava a ficha de quem já tem', () => {
    expect(CODIGO).toMatch(/'Concluindo seu cadastro…' : 'Criando sua conta…'/);
  });

  it('🔴 e a tela avisa ANTES do clique, para o paciente não hesitar', () => {
    expect(CODIGO).toMatch(/authCarregou && isSignedIn && !sessaoEDeOutraPessoa && !jaTemConta/);
    expect(FONTE).toMatch(/sua conta não será criada de novo/i);
  });
});
