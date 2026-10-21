/**
 * O REAPROVEITAMENTO DE SOLICITAÇÃO NÃO FUNDE DUAS PESSOAS — e o contato que chega vence.
 *
 * 🔴 MEDIDO EM PRODUÇÃO EM 13/09/2026, com o dono preso na própria tela de cadastro.
 *
 * Ele preencheu o formulário da Greens com `davi@greens-corp.com`. A Greens enviou esse
 * e-mail (`patientEmail`, que vem de `entrada.paciente.email`). A tela da BeHemp abriu com
 * `davimartins1001@gmail.com` — o endereço de um teste do dia anterior.
 *
 * **A causa, em duas partes:**
 *
 *   1. `buscarAtivaPorContato` tenta o e-mail e, se não achar, tenta o **telefone**. O e-mail
 *      novo não achava nada; o telefone — o mesmo de sempre — achava a SOL-000046, de ontem.
 *   2. O `update` do reaproveitamento sobrescrevia `nomeCompleto`, `cpf`, `documentos` e
 *      `urlDeRetorno`. **Não o e-mail, nem o telefone.**
 *
 * ⚠️ E O ESTRAGO PASSOU DA TELA. A conta nasceu com o e-mail certo, a solicitação guardava o
 * antigo, e a trava que compara a sessão com `solicitacao.email` — a proteção contra a ficha ir
 * para a conta de outro — **barrou o dono legítimo**. Sair e entrar com o outro e-mail não
 * resolvia: a conta certa era a dele. Beco fechado, dos dois lados.
 *
 * 🔴 E O CASO PIOR, QUE NÃO ERA O DELE: telefone é compartilhado. Casal, mãe e filho, o aparelho
 * da família — comum no público de cannabis medicinal, onde responsáveis cuidam de pacientes.
 * Sem esta trava o segundo paciente recebe um link que aponta para a solicitação do primeiro:
 * nome e CPF viram os dele, o e-mail continua do outro, e a ficha com documentos clínicos nasce
 * na conta errada. **OWASP API1 por uma chave que não identifica pessoa.**
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..', '..');
const FONTE = readFileSync(join(RAIZ, 'lib/parceiros/handoff.ts'), 'utf8');
const CODIGO = FONTE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** O `update` do caminho de reaproveitamento. */
function updateDoReaproveitamento(): string {
  const i = CODIGO.indexOf('if (existente) {');
  expect(i, 'não achei o caminho de reaproveitamento').toBeGreaterThan(-1);
  return CODIGO.slice(i, CODIGO.indexOf('return this.reemitir(existente.id', i));
}

describe('o reaproveitamento não funde duas pessoas', () => {
  it('⚠️ VACUIDADE: o reaproveitamento ainda existe e ainda atualiza campos', () => {
    // Se um dia ele deixar de existir, estas regras viram cerimônia — e este caso avisa.
    const bloco = updateDoReaproveitamento();
    expect(bloco).toMatch(/\.update\(solicitacoesCadastro\)/);
    expect(bloco).toMatch(/nomeCompleto/);
  });

  it('🔴 o E-MAIL que chega é gravado — era o defeito, e o e-mail é o login', () => {
    /**
     * Manter o e-mail velho não é "preservar dado bom": é entregar a conta errada. A tela do
     * cadastro diz, no campo, _"Será o seu login"_.
     */
    expect(
      updateDoReaproveitamento(),
      'o e-mail que chegou não é gravado — a solicitação fica com o antigo',
    ).toMatch(/\.\.\.\(email \? \{ email \} : \{\}\)/);
  });

  it('🔴 e o TELEFONE também — é por onde o link viaja', () => {
    expect(updateDoReaproveitamento(), 'o telefone que chegou não é gravado').toMatch(
      /\.\.\.\(telefone \? \{ telefone \} : \{\}\)/,
    );
  });

  it('🔴 e-mail DIVERGENTE impede o reaproveitamento — telefone não identifica pessoa', () => {
    /**
     * A parte que fecha o OWASP API1: achar por telefone e encontrar outro e-mail significa
     * outra pessoa no mesmo aparelho, ou a mesma corrigindo o endereço. Nos dois casos a
     * resposta é não misturar.
     */
    const i = CODIGO.indexOf('private async reaproveitavel(');
    expect(i, 'a decisão de reaproveitar não está isolada num lugar só').toBeGreaterThan(-1);
    const metodo = CODIGO.slice(i, CODIGO.indexOf('\n  private async buscarAtivaPorContato', i));

    expect(metodo, 'não compara o e-mail da solicitação com o que chegou').toMatch(
      /existente\.email/,
    );
    expect(metodo, 'não recusa o reaproveitamento quando diverge').toMatch(/return null/);
  });

  it('🔴 a comparação ignora CAIXA — senão "Davi@" e "davi@" viram pessoas diferentes', () => {
    /**
     * A Greens não normaliza (`medicationRequestValidator.ts` aceita `" Joao@Gmail.COM "`).
     * Nós normalizamos na entrada, mas o que está GRAVADO pode ter vindo de antes disso.
     */
    const i = CODIGO.indexOf('private async reaproveitavel(');
    const metodo = CODIGO.slice(i, CODIGO.indexOf('\n  private async buscarAtivaPorContato', i));
    expect(metodo, 'a comparação é sensível a maiúscula — vai duplicar cadastro à toa').toMatch(
      /toLowerCase\(\)/,
    );
  });

  it('🔴 e o caminho de reaproveitamento PASSA por essa decisão', () => {
    /**
     * A classe do método órfão: existir a regra e ninguém chamá-la. `prepararTransferencia`
     * passou por isso neste mesmo repositório — a Greens achou com `grep` antes de nós.
     */
    expect(
      CODIGO,
      'reaproveitavel existe e o fluxo continua chamando buscarAtivaPorContato direto',
    ).toMatch(/const existente = await this\.reaproveitavel\(/);
  });

  it('⚠️ o log da recusa NÃO carrega e-mail nem telefone', () => {
    /**
     * Explicar por que nasceu um protocolo novo não exige imprimir o contato do paciente. Log
     * com PII é o que a regra de LGPD proíbe, e já mordeu aqui.
     */
    const i = CODIGO.indexOf('private async reaproveitavel(');
    const metodo = CODIGO.slice(i, CODIGO.indexOf('\n  private async buscarAtivaPorContato', i));
    const logs = metodo.match(/console\.\w+\([^)]*\)/g) ?? [];
    for (const log of logs) {
      expect(log, `log com contato do paciente: ${log}`).not.toMatch(
        /\bemail\b|\btelefone\b|params\./,
      );
    }
  });
});
