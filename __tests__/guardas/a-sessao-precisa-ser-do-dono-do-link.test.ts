/**
 * A FICHA SÓ ENTRA NA CONTA DE QUEM O LINK CHAMA.
 *
 * 🔴 ACHADO PELO DONO em 12/09/2026, com três contas de teste no mesmo navegador: ele abriu
 * um link de cadastro emitido para um e-mail estando logado com **outro**.
 *
 * ⚠️ O QUE ACONTECERIA SEM ESTA TRAVA. `concluirCadastroPorLink` resolve a linha de `users`
 * pelo `clerkId` **da sessão**. A ficha do paciente do link — CPF, telefone e os documentos
 * que o parceiro mandou — seria gravada na conta de quem estivesse logado. Numa plataforma de
 * saúde é o pior tipo de erro: dado clínico na pessoa errada, sem nenhum sinal de que houve
 * troca. Nem o paciente nem o médico teriam como notar.
 *
 * 🔴 E É EXPLORÁVEL, NÃO SÓ ACIDENTAL. O link chega por WhatsApp e vale 7 dias. Quem receber
 * um link alheio — encaminhado, printado num grupo — e abrir logado passa a ter, na própria
 * conta, a ficha e os documentos de outra pessoa. É OWASP API1 (BOLA) por um caminho novo, e
 * o repositório já trata essa classe em `autorizacao-tem-escopo-de-objeto` e
 * `o-documento-do-paciente-nao-abre-sem-escopo`.
 *
 * ⚠️ EU PIOREI ISSO NO MESMO DIA. A retomada de cadastro (`o-cadastro-retoma-de-onde-parou`)
 * fez a tela **pular o Clerk** quando há sessão viva — sem conferir de quem ela é. O risco
 * existia antes por outro caminho; a retomada o deixou a um clique. Fica escrito porque
 * conserto que abre buraco novo é o modo de falha mais caro que existe.
 *
 * 🔴 A COMPARAÇÃO É COM O E-MAIL DA SOLICITAÇÃO, NUNCA COM O CAMPO DA TELA. O campo `email`
 * é editável: quem estivesse logado em outra conta poderia digitar o próprio endereço e fazer
 * a checagem passar — que é exatamente o que ela existe para impedir.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..', '..');
const ler = (p: string) => readFileSync(join(RAIZ, p), 'utf8');
const semComentarios = (f: string) =>
  f.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const ACTION = semComentarios(ler('app/_actions/cadastro-por-link.ts'));
const TELA = semComentarios(
  ler('app/(auth)/cadastro/[token]/_components/formulario-de-cadastro.tsx'),
);

describe('a sessão precisa ser do dono do link', () => {
  it('⚠️ VACUIDADE: a action ainda resolve o usuário pelo clerkId da sessão', () => {
    // Se isto sumir, a trava abaixo perde o sentido — e o guarda precisa ser repensado.
    expect(ACTION).toMatch(/eq\(users\.clerkId, clerkId\)/);
  });

  it('🔴 O SERVIDOR compara o e-mail da SESSÃO com o da SOLICITAÇÃO', () => {
    expect(ACTION).toMatch(/emailDaSessao/);
    expect(ACTION).toMatch(/emailDaSolicitacao/);
    expect(ACTION).toMatch(/emailDaSessao !== emailDaSolicitacao/);
  });

  it('🔴 e a comparação usa `solicitacao.email` — não o e-mail do formulário', () => {
    // `dados.email` vem do cliente e é editável. Comparar com ele deixaria o atacante
    // escolher o alvo, que é o oposto da trava.
    const i = ACTION.indexOf('const emailDaSolicitacao');
    expect(ACTION.slice(i, i + 160)).toMatch(/solicitacao\.email/);
  });

  it('🔴 FALHA FECHADA: sem e-mail na sessão, recusa', () => {
    // Sem e-mail não há como provar que é a pessoa certa. Deixar passar "porque não deu
    // para verificar" é como a maioria dos controles morre.
    expect(ACTION).toMatch(/if \(!emailDaSessao \|\| emailDaSessao !== emailDaSolicitacao\)/);
  });

  it('🔴 e a recusa acontece ANTES de qualquer escrita', () => {
    const trava = ACTION.indexOf('emailDaSessao !== emailDaSolicitacao');
    const transacao = ACTION.indexOf('db.transaction');
    expect(trava).toBeGreaterThan(-1);
    expect(transacao).toBeGreaterThan(trava);
  });

  it('⚠️ o log NÃO carrega os endereços — e-mail é dado pessoal', () => {
    /**
     * ⚠️ DEFEITO MEU, achado ao rodar: a primeira versão recusava `emailDaSessao[,)]`, e
     * isso acusava `Boolean(emailDaSessao)` — que é exatamente a forma SEGURA, e a que o
     * código usa. Guarda que reprova o conserto certo é pior que guarda ausente: ele ensina
     * a contornar.
     *
     * O que não pode é o VALOR virar campo do log. `Boolean(...)` e `.length` não revelam
     * endereço nenhum; `emailDaSessao,` como valor de uma chave, sim.
     */
    const i = ACTION.indexOf('sessão de outro e-mail');
    const bloco = ACTION.slice(i, i + 320);

    // Nenhuma chave recebe o e-mail cru.
    expect(bloco).not.toMatch(/:\s*emailDaSessao\b/);
    expect(bloco).not.toMatch(/:\s*emailDaSolicitacao\b/);
    expect(bloco).not.toMatch(/:\s*(dados\.email|emailConfirmado)\b/);

    // E registra o FATO, não o valor.
    expect(bloco).toMatch(/temSessao/);
  });

  it('🔴 A TELA não usa o atalho da sessão quando ela é de outra pessoa', () => {
    expect(TELA).toMatch(/sessaoEDeOutraPessoa/);
    expect(TELA).toMatch(/if \(authCarregou && isSignedIn && !sessaoEDeOutraPessoa\)/);
  });

  it('🔴 e a tela compara com o e-mail do LINK, não com o campo editável', () => {
    const i = TELA.indexOf('const emailDoLink');
    expect(i).toBeGreaterThan(-1);
    // `emailInicial` é prop vinda do servidor; `email` é estado do formulário.
    expect(TELA.slice(i, i + 120)).toMatch(/emailInicial/);
    const j = TELA.indexOf('const sessaoEDeOutraPessoa');
    expect(TELA.slice(j, j + 260)).toMatch(/emailDaSessao !== emailDoLink/);
  });

  it('⚠️ e o paciente tem SAÍDA — aviso sem caminho é paciente preso', () => {
    expect(TELA).toMatch(/signOut\(\)/);
    expect(ler('app/(auth)/cadastro/[token]/_components/formulario-de-cadastro.tsx')).toMatch(
      /Sair desta conta e continuar/,
    );
  });

  it('⚠️ o aviso de "sessão aberta" NÃO aparece junto com o de conta errada', () => {
    // Dois avisos sobre sessão ao mesmo tempo, um dizendo "pode seguir" e outro "não pode",
    // é pior que nenhum.
    expect(TELA).toMatch(/authCarregou && isSignedIn && !sessaoEDeOutraPessoa && !jaTemConta/);
  });
});
