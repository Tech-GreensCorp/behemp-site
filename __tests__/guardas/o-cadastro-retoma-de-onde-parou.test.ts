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

  /**
   * 🔴 RETIFICADO em 12/09/2026: a retomada deixou de ser um `useEffect` e virou valor
   * DERIVADO no render.
   *
   * A primeira versão usava um efeito com três `setState` no corpo, e o lint acusou com
   * razão — _"Calling setState synchronously within an effect can trigger cascading
   * renders"_, o que o `AGENTS.md` proíbe. O React documenta que isto **não precisa de
   * efeito**: a etapa é função do que já se sabe.
   *
   * A garantia é a mesma e é o que estes casos medem: **quem tem cadastro pendente vê a
   * etapa do código, não o formulário em branco.**
   */
  it('🔴 a etapa VISÍVEL é derivada — quem tem cadastro pendente vê a do código', () => {
    expect(CODIGO).toMatch(/const etapaVisivel/);
    expect(CODIGO).toMatch(/etapa === 'dados' && deveRetomar \? 'codigo' : etapa/);
  });

  it('⚠️ e é a etapa VISÍVEL que a tela usa, não a escolhida', () => {
    // Derivar e não usar seria pior que não derivar: daria a impressão de estar resolvido.
    expect(CODIGO).toMatch(/etapaVisivel === 'codigo' \?/);
    expect(CODIGO).toMatch(/etapa=\{etapaVisivel\}/);
  });

  it('🔴 a retomada exige cadastro pendente DO MESMO navegador, com e-mail não verificado', () => {
    // O `signUp` do Clerk é por navegador; retomar exige que ele exista, que esteja
    // incompleto, e que o e-mail ainda não tenha sido confirmado.
    expect(CODIGO).toMatch(/signUp\.status === 'missing_requirements'/);
    expect(CODIGO).toMatch(/verifications\?\.emailAddress\?\.status === 'unverified'/);
    expect(CODIGO).toMatch(/Boolean\(signUp\.emailAddress\)/);
  });

  it('🔴 e NÃO retoma sem o FORMULÁRIO em mãos — senão grava ficha casca (S8.5)', () => {
    /**
     * 🔴 A VERSÃO ANTERIOR DESTE CASO EXIGIA `Boolean(senha)` LITERALMENTE, e por isso congelava
     * um entendimento incompleto do próprio defeito.
     *
     * A senha era condição por um motivo verdadeiro (ela é entregue ao Clerk depois da
     * confirmação, e retomar sem ela completaria a conta sem senha) e insuficiente. **Medido em
     * 13/09/2026:** confirmar o código não termina no Clerk — chama `gravarFicha()`, que monta a
     * ficha a partir do estado do React: `anexos`, `finalidadesConsentidas`, `jaFazTratamento`,
     * `temAnvisa`, `temReceita`, `tratamentoAtual`.
     *
     * ⚠️ Pular para a etapa do código com o estado zerado grava ficha **sem documento, sem
     * consentimento e sem as respostas clínicas** — e queima o link de uso único no caminho. É a
     * FICHA CASCA (ADR-0022, G2) entrando pela porta da correção do S8.5.
     *
     * A propriedade que este caso protege: a condição confere mais que um campo, e inclui pelo
     * menos uma resposta **sem fonte no servidor** — porque essas são as que somem no reload.
     */
    const expressao = CODIGO.match(/const formularioEmMaos =([^;]+);/)?.[1];
    expect(expressao, 'a condição do formulário em mãos sumiu ou foi renomeada').toBeTruthy();

    expect(CODIGO, 'deveRetomar voltou a depender de um campo solto').toMatch(
      /deveRetomar =[\s\S]{0,120}formularioEmMaos/,
    );

    /**
     * Sem fonte no servidor = não existe prop `<campo>Inicial` que o repreencha depois do
     * reload. `senha` nunca tem; as respostas clínicas também não. Derivado, não listado: um
     * campo que ganhe `Inicial` amanhã sai desta conta sozinho.
     */
    const semFonteNoServidor = ['senha', 'jaFazTratamento', 'temAnvisa', 'temReceita'].filter(
      (campo) => !CODIGO.includes(`${campo}Inicial`),
    );
    const conferidos = semFonteNoServidor.filter((campo) => expressao!.includes(campo));
    expect(
      conferidos.length,
      `a condição só olha ${conferidos.length} campo(s) que somem no reload — um único campo é proxy, não garantia`,
    ).toBeGreaterThan(1);
  });

  it('🔴 e quando NÃO dá para retomar, a tela DIZ — silêncio é o que fez o paciente achar que perdeu tudo', () => {
    /**
     * ⚠️ O comportamento já estava certo antes do S8.5: sem formulário em mãos, fica na etapa 1,
     * e ao enviar de novo `pendenteDoMesmoEmail` reconhece o cadastro e só reenvia o código.
     * **O defeito era o silêncio.** O paciente voltava, via a etapa 1 do zero e concluía que
     * tinha perdido o cadastro — sem saber que ele estava guardado.
     *
     * É o R6 da ADR-0022 (verdade sobre o estado) aplicado à tela do próprio cadastro.
     */
    expect(CODIGO, 'a condição do aviso não existe').toMatch(/const retomandoSemFormulario =/);

    /**
     * 🔴 E NÃO PODE SER ÓRFÃO. Esta classe já mordeu neste repositório: o aviso da procuração
     * passou quatro semanas importado e nunca renderizado. Declarar não é mostrar.
     */
    const declaracao = CODIGO.indexOf('const retomandoSemFormulario =');
    const noJsx = CODIGO.indexOf('{retomandoSemFormulario', declaracao);
    expect(noJsx, 'retomandoSemFormulario é declarado e nunca renderizado').toBeGreaterThan(-1);
  });

  it('🔴 e o aviso fala dos DOCUMENTOS — é o que se perde sem ninguém notar', () => {
    /**
     * `File` não sobrevive a recarregar a página e não é serializável, então os anexos somem
     * mesmo quando o cadastro continua de pé. Avisar só a boa notícia ("seu cadastro está
     * guardado") faria o paciente chegar ao fim **sem os arquivos** — que é exatamente como a
     * ficha casca nasce.
     */
    const i = CODIGO.indexOf('{retomandoSemFormulario');
    const bloco = CODIGO.slice(i, CODIGO.indexOf(')}', i));
    expect(bloco, 'o aviso não diz que os documentos precisam ser reenviados').toMatch(
      /documento|arquivo/i,
    );
  });

  it('⚠️ VACUIDADE do S8.5: a ficha ainda é montada a partir do ESTADO — é o que torna a regra necessária', () => {
    /**
     * Se um dia o formulário passar a ser persistido no servidor, esta regra inteira muda de
     * forma — e este caso fica vermelho para avisar, em vez de a proteção virar cerimônia.
     */
    const ficha = corpoDe('gravarFicha');
    expect(ficha, 'gravarFicha não lê mais os anexos do estado').toMatch(
      /anexos:\s*await lerAnexos\(anexos\)/,
    );
    expect(ficha, 'gravarFicha não lê mais o consentimento do estado').toMatch(
      /finalidadesConsentidas/,
    );
  });

  it('⚠️ a escolha do paciente vence a retomada', () => {
    // Sem isto, quem clicasse em "Corrigir meus dados" voltava para a etapa 1 e era jogado
    // de volta no render seguinte — preso, sem nunca conseguir corrigir.
    expect(CODIGO).toMatch(/deveRetomar =[\s\S]{0,140}!voltouDeProposito/);
  });

  it('🔴 "Corrigir meus dados" marca a escolha ANTES de voltar', () => {
    const i = CODIGO.indexOf('Corrigir meus dados');
    expect(i, 'não achei o botão de voltar').toBeGreaterThan(-1);
    const bloco = CODIGO.slice(Math.max(0, i - 700), i);
    expect(bloco).toMatch(/setVoltouDeProposito\(true\)/);
    expect(bloco).toMatch(/setEtapa\('dados'\)/);
  });

  it('⚠️ e NÃO sobrou `useEffect` com setState no corpo — é o que o lint proibia', () => {
    // O efeito antigo fazia `setEmail`/`setEtapa`/`setRetomado` sincronamente.
    expect(CODIGO).not.toMatch(/setRetomado/);
    expect(CODIGO).not.toMatch(/useEffect\([\s\S]{0,400}setEtapa\('codigo'\)/);
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
