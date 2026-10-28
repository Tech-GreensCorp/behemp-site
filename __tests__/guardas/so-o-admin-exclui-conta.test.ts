/**
 * SÓ O ADMIN EXCLUI CONTA — ninguém se autoexclui, e nenhuma tela oferece isso.
 *
 * 🔴 A DECISÃO, de Dryelle em 28/10/2026 (ADR-0033 D-16, P-13b e P-17a): _"apenas admin pode
 * excluir contas!"_, para **todos os papéis**, inclusive o paciente comum, que tinha o botão.
 *
 * 🔴 O DEFEITO QUE ESTE GUARDA ENXERGA, medido lendo o código (Item 92): `excluirMinhaConta`
 * (`app/_actions/perfil-paciente.ts`) só autenticava — não checava papel, não gravava auditoria
 * e apagava o usuário no Clerk. É uma Server Action, ou seja, um endpoint chamável **sem passar
 * pela tela**. Esconder o botão não bastaria: a action ficaria de pé.
 *
 * ⚠️ POR ISSO O GUARDA OLHA AS DUAS PONTAS, e a que importa é a action, não o botão:
 *   - o **servidor**: toda chamada a `deleteUser` do Clerk mora numa função que exige
 *     `verificarAdmin()` **antes** dela;
 *   - a **tela**: nenhum texto "Excluir Minha Conta" nas áreas do paciente.
 *
 * DERIVA DO DISCO (Regra 1 da técnica): varre `app/`, `lib/` e `components/`. Uma função nova
 * que apague conta no Clerk sem exigir admin nasce acusada, sem ninguém lembrar de listá-la.
 *
 * ⚠️ UMA DISPENSA, COM MOTIVO ESCRITO (Regra 3): `lib/pacientes/conta-de-acesso.ts` chama
 * `deleteUser` para DESFAZER uma conta recém-criada quando a gravação no banco falha (ADR-0031).
 * Não é exclusão pedida por ninguém, e a função só é alcançada por actions que já exigem
 * equipe. Sem a dispensa o guarda nasceria acusando o que está certo.
 *
 * ⚠️ O QUE ESTE GUARDA NÃO PROVA: que o admin consegue excluir, nem o que a exclusão faz com o
 * histórico clínico — isso é decisão do Jurídico (P-13b, Item 74).
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

/** Código de produção: tudo que o servidor ou o navegador executam. */
const PRODUCAO = ['app', 'lib', 'components']
  .flatMap((d) => arquivos(join(RAIZ, d)))
  .map((p) => ({
    caminho: relative(RAIZ, p).replace(/\\/g, '/'),
    codigo: semComentarios(readFileSync(p, 'utf8')),
  }));

/** Rollback de conta recém-criada (ADR-0031). Não é exclusão pedida por usuário. */
const DISPENSA_ROLLBACK = ['lib/pacientes/conta-de-acesso.ts'];

/** Cada chamada a `.deleteUser(`, com o texto da função até ela. */
function chamadasDeDeleteUser() {
  const achadas: { caminho: string; funcao: string; antes: string }[] = [];
  for (const { caminho, codigo } of PRODUCAO) {
    for (const m of codigo.matchAll(/\.deleteUser\(/g)) {
      const ate = codigo.slice(0, m.index);
      const inicios = [...ate.matchAll(/(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g)];
      const ultimo = inicios[inicios.length - 1];
      achadas.push({
        caminho,
        funcao: ultimo?.[1] ?? '(fora de função nomeada)',
        antes: ultimo ? ate.slice(ultimo.index) : ate,
      });
    }
  }
  return achadas;
}

describe('só o admin exclui conta', () => {
  it('⚠️ VACUIDADE: o guarda enxerga as chamadas a deleteUser que existem', () => {
    const caminhos = new Set(chamadasDeDeleteUser().map((c) => c.caminho));
    expect(caminhos.has('app/(admin)/_actions/usuarios.ts'), 'não achei a exclusão do admin').toBe(
      true,
    );
    expect(caminhos.has('lib/pacientes/conta-de-acesso.ts'), 'não achei o rollback').toBe(true);
    expect(PRODUCAO.length).toBeGreaterThan(200);
  });

  it('🔴 todo `deleteUser` mora numa função que exige verificarAdmin() ANTES dele', () => {
    const sem = chamadasDeDeleteUser()
      .filter((c) => !DISPENSA_ROLLBACK.includes(c.caminho))
      .filter((c) => !/verificarAdmin\(/.test(c.antes))
      .map((c) => `${c.caminho} → ${c.funcao}`);
    expect(
      sem,
      'apaga conta no Clerk sem exigir admin. Foi assim que `excluirMinhaConta` deixava qualquer sessão chamar',
    ).toEqual([]);
  });

  it('🔴 `excluirMinhaConta` não existe: nem declarada, nem chamada', () => {
    const onde = PRODUCAO.filter((f) => /excluirMinhaConta/.test(f.codigo)).map((f) => f.caminho);
    expect(onde, 'a autoexclusão voltou').toEqual([]);
  });

  it('🔴 nenhuma tela oferece "Excluir Minha Conta"', () => {
    const onde = PRODUCAO.filter((f) => /Excluir\s+Minha\s+Conta/i.test(f.codigo)).map(
      (f) => f.caminho,
    );
    expect(onde, 'o botão voltou').toEqual([]);
  });

  it('a dispensa do rollback ainda é necessária (senão, remova-a)', () => {
    // Uma dispensa que ninguém usa mais é um buraco documentado: alguém a herda por engano.
    const usadas = new Set(chamadasDeDeleteUser().map((c) => c.caminho));
    for (const d of DISPENSA_ROLLBACK) {
      expect(usadas.has(d), `${d} já não chama deleteUser: tire-o de DISPENSA_ROLLBACK`).toBe(true);
    }
  });
});
