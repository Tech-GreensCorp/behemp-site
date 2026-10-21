/**
 * GUARDA — a etapa do código de e-mail não tem beco sem saída.
 *
 * AS DUAS CLASSES DE ERRO, medidas em 11/09/2026 com o dono testando em produção. O sintoma
 * era um só — _"o código chega mas não é aceito"_ — e as causas eram duas, nenhuma delas no
 * código de verificação:
 *
 * 1. **"Reenviar código" não dava retorno nenhum.** A tela não mudava. Quem clica e não vê
 *    resposta clica de novo — e **cada reenvio invalida o código anterior**. O paciente então
 *    digita o código do primeiro e-mail e recebe "código incorreto", uma mensagem que aponta
 *    para o lugar errado: o código estava certo, só era de um e-mail que deixou de valer.
 *
 * 2. **"Corrigir meus dados" virava saída.** Voltar e enviar de novo chamava `signUp.create`
 *    com um cadastro já pendente; o Clerk responde `form_identifier_exists`, e a tela dizia
 *    **"Já existe uma conta com este e-mail"** — para alguém que estava no meio do próprio
 *    cadastro e NÃO tem conta. O caminho de correção mandava a pessoa embora.
 *
 * 🔴 O QUE AS DUAS TÊM EM COMUM: a tela responsabilizava o paciente por um estado que ela
 * própria criou. É a classe de erro que mais custa num funil — a pessoa acredita que errou.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const CAMINHO = 'app/(auth)/cadastro/[token]/_components/formulario-de-cadastro.tsx';
const fonte = readFileSync(path.join(process.cwd(), CAMINHO), 'utf8');

/** Menção em comentário não é uso — a décima sexta vez desta classe no repositório. */
const codigo = fonte
  .split('\n')
  .filter((l) => !/^\s*(\/\/|\/\*|\*|\{\/\*)/.test(l))
  .join('\n');

// ─────────────────────────────────────────────────────────────────────────────
describe('reenviar dá retorno, e diz o que aconteceu com o código anterior', () => {
  it('existe estado para o reenvio', () => {
    expect(codigo).toMatch(/const \[reenviado, setReenviado\] = useState\(false\)/);
  });

  it('🔴 o reenvio LIMPA o campo — o que estava digitado é o código morto', () => {
    const fn = codigo.slice(
      codigo.indexOf('async function reenviarCodigo'),
      codigo.indexOf('return (', codigo.indexOf('async function reenviarCodigo')),
    );
    expect(fn).toContain("setCodigo('')");
    expect(fn).toContain('setReenviado(true)');
  });

  it('a tela avisa que o anterior deixou de valer', () => {
    expect(codigo).toMatch(/\{reenviado &&/);
    expect(fonte).toMatch(/anterior deixou de valer|anterior<\/strong> deixou/i);
  });

  it('🔴 e o aviso aparece na etapa do CÓDIGO, não em outra', () => {
    const etapa = codigo.slice(
      codigo.indexOf('onSubmit={confirmarCodigo}'),
      codigo.indexOf('onSubmit={criarConta}'),
    );
    expect(etapa).toMatch(/\{reenviado &&/);
  });

  it('o botão mostra que está enviando, e não aceita clique duplo', () => {
    expect(codigo).toMatch(/disabled=\{reenviando\}/);
    expect(codigo).toMatch(/reenviando \? 'Enviando…' : 'Reenviar código'/);
  });

  it('e a função recusa reentrada enquanto envia', () => {
    expect(codigo).toMatch(/if \(!isLoaded \|\| reenviando\) return/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('corrigir os dados não expulsa quem está no meio do cadastro', () => {
  it('🔴 não chama `create` de novo quando já há cadastro pendente do mesmo e-mail', () => {
    const fn = codigo.slice(
      codigo.indexOf('async function criarConta'),
      codigo.indexOf('async function confirmarCodigo'),
    );
    expect(fn).toContain('pendenteDoMesmoEmail');
    // A checagem precisa vir ANTES do create, senão não evita nada.
    expect(fn.indexOf('pendenteDoMesmoEmail')).toBeLessThan(fn.indexOf('signUp.create('));
  });

  it('compara o e-mail do cadastro pendente com o digitado, sem depender de maiúscula', () => {
    expect(codigo).toMatch(/signUp\.emailAddress\?\.toLowerCase\(\) === emailAlvo/);
  });

  it('🔴 e nesse caso REENVIA o código em vez de falhar', () => {
    const fn = codigo.slice(
      codigo.indexOf('if (pendenteDoMesmoEmail)'),
      codigo.indexOf('await signUp.create('),
    );
    expect(fn).toContain('prepareEmailAddressVerification');
    expect(fn).toContain("setEtapa('codigo')");
  });

  it('o caminho de voltar continua existindo — a correção não é tirar o botão', () => {
    expect(codigo).toContain("setEtapa('dados')");
    expect(fonte).toContain('Corrigir meus dados');
  });

  /**
   * ⚠️ EXIGE AS DUAS PONTAS. A primeira versão checava a presença da string e passava verde
   * com o `catch` sabotado — `form_identifier_exists` também está no mapa de `traduzirErro`,
   * e uma ocorrência satisfazia o `toContain`. São dois usos distintos, e ambos importam:
   * o mapa produz a MENSAGEM, o catch liga o caminho para o login.
   */
  it('⚠️ e a mensagem de "já existe conta" continua, para quem REALMENTE tem conta', () => {
    const mapa = codigo.slice(
      codigo.indexOf('const mapa: Record<string, string>'),
      codigo.indexOf('if (codigo && mapa[codigo])'),
    );
    expect(mapa).toContain('form_identifier_exists');

    const criar = codigo.slice(
      codigo.indexOf('async function criarConta'),
      codigo.indexOf('async function confirmarCodigo'),
    );
    expect(criar).toContain('form_identifier_exists');
    expect(criar).toMatch(/setJaTemConta\(true\)/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('o que já funcionava não pode regredir', () => {
  /**
   * ⚠️ MEDE DENTRO DO onChange DO CAMPO DO CÓDIGO. A primeira versão procurava
   * `replace(/\D/g,'')` no arquivo inteiro e passava verde com o campo sabotado — a mesma
   * expressão aparece no tratamento de CPF e telefone.
   */
  it('o campo aceita só dígitos e no máximo 6', () => {
    const campo = codigo.slice(
      codigo.indexOf('id="codigo"'),
      codigo.indexOf('placeholder="000000"'),
    );
    expect(campo.length).toBeGreaterThan(50);
    expect(campo).toMatch(/maxLength=\{6\}/);
    expect(campo).toMatch(/setCodigo\(e\.target\.value\.replace\(\/\\D\/g, ''\)\)/);
  });

  it('o botão de confirmar exige os 6 dígitos', () => {
    expect(codigo).toMatch(/codigo\.length < 6/);
  });

  it('status diferente de complete não é tratado como sucesso', () => {
    expect(codigo).toMatch(/conclusao\.status !== 'complete'/);
  });

  it('o CAPTCHA do Clerk continua com lugar reservado no DOM', () => {
    expect(codigo).toContain('id="clerk-captcha"');
  });
});
