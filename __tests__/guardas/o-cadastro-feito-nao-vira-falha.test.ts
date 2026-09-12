/**
 * CADASTRO GRAVADO NÃO VIRA FALHA — e o log diz em que etapa quebrou.
 *
 * 🔴 O INCIDENTE, 11/09/2026, medido em produção com o dono testando o protocolo SOL-000046.
 *
 * O paciente confirmou o código do e-mail, a sessão abriu, a transação gravou conta e ficha,
 * o link de uso único foi consumido — e então algo depois disso lançou. O `catch` do fim
 * devolveu `falha`, e a tela disse *"Não conseguimos concluir seu cadastro"*.
 *
 * ⚠️ O ESTADO EM QUE ELE FICOU É O PIOR POSSÍVEL: conta criada, sessão ativa, ficha gravada,
 * link já consumido — e a tela afirmando que não deu certo. Sem caminho de volta, porque o
 * token é de **uso único** (ADR-0016 D-04) e a ADR não previu a gravação falhar depois dele.
 * O painel abria com CPF, telefone e documentos todos "Não informado".
 *
 * 🔴 E O LOG NÃO AJUDAVA EM NADA. Ele registrava `erro.name` e mais nada — e `erro.name` de
 * um `new Error(…)` é a string `'Error'`. Produção escreveu, literalmente:
 *
 *     [cadastro-por-link] falha ao concluir { erro: 'Error' }
 *
 * O cuidado de não vazar CPF no log tinha, sem querer, jogado fora a informação inteira. Não
 * dava para saber nem em que etapa quebrou.
 *
 * ⚠️ A INTENÇÃO JÁ ESTAVA ESCRITA — e era só isso. Os blocos 8a/8b/8c dizem em prosa que
 * *"anexo que falha não desfaz cadastro que deu certo"*, e cada um se protege por dentro. Mas
 * nada garantia o que está ENTRE eles: uma exceção em qualquer ponto pós-transação caía no
 * catch e virava falha. Comentário não é garantia; guarda é.
 *
 * 🔴 VALE PARA OS OITO FLUXOS. `docs/11-OS-OITO-FLUXOS.md` passo 3: *"BeHemp cria a conta →
 * `app/_actions/cadastro-por-link.ts`"*. É o caminho único de todos eles.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..', '..');
const CAMINHO = 'app/_actions/cadastro-por-link.ts';
const FONTE = readFileSync(join(RAIZ, CAMINHO), 'utf8');

/** Menção em comentário não é implementação — foi o defeito original, escrito em prosa. */
function semComentarios(fonte: string): string {
  return fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}
const CODIGO = semComentarios(FONTE);

/** O corpo do `catch` final — não o do consentimento, que é interno e tem outra regra. */
function catchFinal(): string {
  const i = CODIGO.lastIndexOf('} catch (erro) {');
  expect(i, 'não achei o catch final').toBeGreaterThan(-1);
  return CODIGO.slice(i);
}

describe('o cadastro feito não vira falha', () => {
  it('⚠️ VACUIDADE: o arquivo tem a transação que grava conta e ficha', () => {
    expect(CODIGO).toContain('db.transaction');
    expect(CODIGO).toContain('insert(pacientes)');
  });

  it('🔴 existe um marco que diz que o cadastro já está gravado', () => {
    expect(CODIGO).toMatch(/cadastroGravado\s*=\s*true/);
  });

  it('🔴 e esse marco vem DEPOIS da transação — antes dela não haveria o que preservar', () => {
    const fimDaTransacao = CODIGO.indexOf('return ficha.id;');
    const marco = CODIGO.indexOf('cadastroGravado = true');
    expect(fimDaTransacao).toBeGreaterThan(-1);
    expect(marco).toBeGreaterThan(fimDaTransacao);
  });

  it('🔴 o catch final devolve SUCESSO quando o cadastro já estava gravado', () => {
    const corpo = catchFinal();
    expect(corpo).toMatch(/if\s*\(\s*cadastroGravado\s*\)/);
    // E o que ele devolve nesse ramo é `ok(...)`, não `falha(...)`.
    const ramo = corpo.slice(corpo.indexOf('if (cadastroGravado)'));
    expect(ramo.slice(0, 200)).toContain('return ok(');
  });

  it('e continua devolvendo falha quando NADA foi gravado — senão o guarda inverteria o bug', () => {
    expect(catchFinal()).toContain("return falha('Não conseguimos concluir seu cadastro.");
  });

  it('🔴 o log diz em que ETAPA quebrou — `erro.name` sozinho é sempre "Error"', () => {
    const corpo = catchFinal();
    expect(corpo).toMatch(/\betapa\b/);
    expect(corpo).toMatch(/\bcadastroGravado\b/);
  });

  it('⚠️ VACUIDADE: há mais de uma etapa nomeada, senão o rótulo não distingue nada', () => {
    const etapas = new Set(CODIGO.match(/etapa = '[^']+'/g) ?? []);
    expect(etapas.size).toBeGreaterThan(2);
  });

  it('🔴 o log NÃO carrega a mensagem do erro — ela cita valor de coluna, e as colunas são CPF e telefone', () => {
    const corpo = catchFinal();
    expect(corpo).not.toMatch(/erro\.message/);
    expect(corpo).not.toMatch(/String\(erro\)/);
  });

  it('🔴 o `em:` vem do STACK, que diz arquivo:linha sem dizer o valor', () => {
    expect(CODIGO).toContain('primeiraLinhaDoStack');
    // E o helper descarta o índice 0, que é `Error: <mensagem>` — a parte que não pode vazar.
    const helper = CODIGO.slice(CODIGO.indexOf('function primeiraLinhaDoStack'));
    expect(helper.slice(0, 400)).toMatch(/linhas\[1\]/);
  });

  it('⚠️ e os oito fluxos passam por ESTE arquivo — a correção vale para todos', () => {
    const doc = readFileSync(join(RAIZ, 'docs/11-OS-OITO-FLUXOS.md'), 'utf8');
    expect(doc).toContain(CAMINHO);
  });
});
