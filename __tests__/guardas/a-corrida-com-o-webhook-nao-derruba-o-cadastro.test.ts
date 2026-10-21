/**
 * A CORRIDA COM O WEBHOOK DO CLERK NÃO DERRUBA O CADASTRO.
 *
 * 🔴 ADR-0022, G11. Duas coisas criam a linha em `pacientes`: a transação do cadastro
 * (`cadastro-por-link.ts`) e o webhook `user.created` do Clerk — que é **assíncrono** e pode
 * chegar a qualquer momento, inclusive **entre o `SELECT` e o `INSERT`** da transação.
 *
 * ⚠️ O QUE ACONTECIA. O unique de `pacientes.userId` era violado, **a transação inteira
 * abortava**, e o paciente lia _"não conseguimos concluir seu cadastro"_ — com a conta já
 * criada, o e-mail já confirmado, e nenhum caminho de volta. O log dizia `{ erro: 'Error' }`,
 * que não distingue violação de unique de qualquer outra coisa.
 *
 * 🔴 É CANDIDATO AO ERRO QUE O DONO VIU em 11/09 (SOL-000046), e a assimetria explica por que
 * ninguém tinha notado: **o webhook já tinha `onConflictDoNothing`; a action não.** O lado que
 * chega segundo precisa ceder — e ceder, aqui, é não estourar.
 *
 * ⚠️ E NÃO BASTA NÃO ESTOURAR. `onConflictDoNothing` devolve **vazio** quando o conflito
 * acontece: a ficha existe, mas não é a que este `INSERT` criou. Seguir com `undefined` daria
 * erro pior adiante, e mais difícil de ler. Por isso o conflito é seguido de uma busca — quem
 * perdeu a disputa usa a linha de quem ganhou.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..', '..');
const ler = (p: string) => readFileSync(join(RAIZ, p), 'utf8');
const semComentarios = (f: string) =>
  f.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const ACTION = semComentarios(ler('app/_actions/cadastro-por-link.ts'));
const WEBHOOK = semComentarios(ler('app/api/webhooks/clerk/route.ts'));

/** O trecho da transação que cria a ficha. */
function blocoDaFicha(): string {
  const i = ACTION.indexOf('insert(pacientes)');
  expect(i, 'não achei o insert de pacientes').toBeGreaterThan(-1);
  return ACTION.slice(i, i + 1400);
}

describe('a corrida com o webhook não derruba o cadastro', () => {
  it('⚠️ VACUIDADE: os DOIS lados criam a ficha — é o que torna a corrida possível', () => {
    expect(ACTION).toContain('insert(pacientes)');
    expect(WEBHOOK).toContain('insert(pacientes)');
  });

  it('⚠️ VACUIDADE: o unique que a corrida viola existe', () => {
    // Sem o unique não há corrida — e também não há garantia de uma ficha por usuário.
    /**
     * ⚠️ Sem a flag `s`: o target do tsconfig é anterior a es2018 e o compilador recusa
     * (`TS1501`). `[\s\S]` faz o mesmo trabalho e funciona em qualquer target.
     */
    expect(ler('db/schema/pacientes.ts')).toMatch(/unique[\s\S]*userId|userId[\s\S]*unique/i);
  });

  it('🔴 a ACTION cede no conflito — não aborta a transação', () => {
    expect(blocoDaFicha()).toMatch(/onConflictDoNothing/);
  });

  it('🔴 e o WEBHOOK continua cedendo — a assimetria era o defeito', () => {
    const i = WEBHOOK.indexOf('insert(pacientes)');
    expect(WEBHOOK.slice(i, i + 600)).toMatch(/onConflictDoNothing/);
  });

  it('🔴 o conflito é SEGUIDO DE BUSCA — `returning` vem vazio quando cede', () => {
    /**
     * Ceder sem buscar troca um erro por outro: a ficha existe, `ficha` é `undefined`, e o
     * `pacienteId` seguiria indefinido para todo o resto do cadastro.
     */
    const bloco = blocoDaFicha();
    expect(bloco).toMatch(/if \(ficha\?\.id\) return ficha\.id;/);
    expect(bloco).toMatch(/select\(\{ id: pacientes\.id \}\)/);
    expect(bloco).toMatch(/eq\(pacientes\.userId, usuario\.id\)/);
  });

  it('⚠️ e se nem inseriu nem achou, LANÇA — seguir sem ficha é pior', () => {
    // Este é o caso que não deveria acontecer. Se acontecer, tem de aparecer.
    expect(blocoDaFicha()).toMatch(/throw new Error\('ficha_nao_criada'\)/);
  });

  it('⚠️ a busca do conflito acontece DENTRO da transação', () => {
    // Fora dela, leria um estado que a transação ainda não enxerga.
    /**
     * ⚠️ Defeito meu, achado ao rodar: eu procurava `await tx` DEPOIS do `select`, e ele vem
     * antes — `await tx.select({…})`. O recorte olhava para o lado errado da chamada.
     */
    const bloco = blocoDaFicha();
    const busca = bloco.indexOf('select({ id: pacientes.id })');
    expect(busca).toBeGreaterThan(-1);
    // A chamada é `await tx\n  .select(...)`: o `tx` fica imediatamente antes.
    expect(bloco.slice(Math.max(0, busca - 60), busca)).toMatch(/await tx/);
    // E não é `db.select`, que leria fora da transação.
    expect(bloco.slice(Math.max(0, busca - 60), busca)).not.toMatch(/await db/);
  });
});
