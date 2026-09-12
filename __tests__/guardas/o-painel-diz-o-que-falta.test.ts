/**
 * O PAINEL DIZ O QUE FALTA — e fala o vocabulário da tabela, não o do fluxo.
 *
 * 🔴 O ACHADO, 11/09/2026. Palavras do dono, olhando o próprio painel depois de se cadastrar
 * pelo fluxo da Greens: _"o local dos meus documentos não está diferenciado por todos que a
 * BeHemp tem, no caso um cadastro completo"_.
 *
 * A tela dizia **"Nenhum documento enviado ainda"** e parava aí — informava a ausência sem
 * informar a expectativa. Quem chega pelo bot não tem como saber o que a BeHemp espera.
 *
 * 🔴 O DEFEITO DE CLASSE QUE ISTO GUARDA É OUTRO, e é silencioso: **dois vocabulários**.
 * O fluxo diz `documento_identidade`; a coluna `documentos.tipo` guarda `rg`. A tradução mora
 * em `materializar-documentos.ts` e agora também em `o-que-falta-no-painel.ts`. Se as duas
 * divergirem, o documento entra no banco com um nome e é procurado com outro — e o paciente
 * vê como pendente **o que já mandou**, sem nenhum erro em lugar nenhum.
 *
 * ⚠️ E DERIVA DO ESTADO REAL, não do manifesto. O manifesto diz o que a Greens **afirma** ter
 * mandado; a materialização **nunca lança** (decisão em `materializar-documentos.ts:118`).
 * Quando ela falha, o manifesto segue afirmando que veio e o arquivo não existe. Só o estado
 * real mostra o buraco — e é por isso que a função recebe `tiposNoBanco`.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { checklistDosDocumentos, faltamNoPainel } from '@/lib/documentos/o-que-falta-no-painel';
import { DOCUMENTOS_DO_FLUXO } from '@/lib/parceiros/documentos';

const RAIZ = join(__dirname, '..', '..');
const ler = (p: string) => readFileSync(join(RAIZ, p), 'utf8');
const semComentarios = (f: string) =>
  f.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** Extrai o mapa de tradução de um módulo, pelo nome da constante. */
function traducaoDe(caminho: string, constante: string): Record<string, string> {
  const bloco = semComentarios(ler(caminho));
  const i = bloco.indexOf(constante);
  expect(i, `não achei ${constante} em ${caminho}`).toBeGreaterThan(-1);
  const trecho = bloco.slice(i, bloco.indexOf('};', i));
  const mapa: Record<string, string> = {};
  for (const [, k, v] of trecho.matchAll(/(\w+)\s*:\s*'([^']+)'/g)) mapa[k] = v;
  return mapa;
}

describe('o painel diz o que falta', () => {
  it('⚠️ VACUIDADE: o fluxo declara mais de um documento', () => {
    expect(DOCUMENTOS_DO_FLUXO.length).toBeGreaterThan(2);
  });

  it('🔴 sem nada no banco, TODOS os traduzíveis aparecem — e nenhum como recebido', () => {
    const lista = checklistDosDocumentos([]);
    expect(lista.length).toBeGreaterThan(2);
    expect(lista.every((i) => !i.temNoBanco)).toBe(true);
  });

  it('🔴 o RG enviado NÃO aparece como pendente — é a tradução funcionando', () => {
    // O paciente mandou o documento com foto; a coluna guarda `rg`, o fluxo chama
    // `documento_identidade`. Sem traduzir, ficaria pendente para sempre.
    const lista = checklistDosDocumentos(['rg']);
    const identidade = lista.find((i) => i.chave === 'documento_identidade');
    expect(identidade?.temNoBanco).toBe(true);
    expect(faltamNoPainel(['rg']).some((i) => i.chave === 'documento_identidade')).toBe(false);
  });

  it('e um tipo que ele NÃO tem continua pendente — o controle contra vacuidade', () => {
    const lista = checklistDosDocumentos(['rg']);
    expect(lista.find((i) => i.chave === 'receita_medica')?.temNoBanco).toBe(false);
  });

  it('🔴 A TRADUÇÃO DO PAINEL E A DA MATERIALIZAÇÃO SÃO IDÊNTICAS', () => {
    // Duas listas que divergem fazem o paciente ver pendente o que já mandou — em silêncio.
    const doPainel = traducaoDe('lib/documentos/o-que-falta-no-painel.ts', 'NA_TABELA');
    const daMaterializacao = traducaoDe('lib/parceiros/materializar-documentos.ts', 'TRADUCAO');
    expect(doPainel).toEqual(daMaterializacao);
  });

  it('⚠️ VACUIDADE: as duas traduções não estão vazias', () => {
    const doPainel = traducaoDe('lib/documentos/o-que-falta-no-painel.ts', 'NA_TABELA');
    expect(Object.keys(doPainel).length).toBeGreaterThan(2);
  });

  it('🔴 todo tipo traduzido EXISTE no enum do banco', () => {
    // Traduzir para um valor que a coluna não aceita quebraria o insert em runtime.
    const enums = ler('db/schema/enums.ts');
    const bloco = enums.slice(enums.indexOf('documentoTipoEnum'));
    const aceitos = new Set(
      [...bloco.slice(0, bloco.indexOf(']')).matchAll(/'([^']+)'/g)].map((m) => m[1]),
    );
    for (const item of checklistDosDocumentos([])) {
      expect(aceitos.has(item.tipoNaTabela), `${item.tipoNaTabela} não existe no enum`).toBe(true);
    }
  });

  it('🔴 o opcional não entra no que FALTA — e o caso DISTINGUE os dois caminhos', () => {
    /**
     * ⚠️ DEFEITO MEU, achado por sabotagem. A primeira versão afirmava só
     * `faltamNoPainel([]).some(i => i.opcional) === false` — e isso passa mesmo sem o filtro
     * `!i.opcional`, porque hoje nenhum opcional é traduzível e todos já saem do checklist
     * antes. O caso não media o filtro; media uma coincidência.
     *
     * Este caso prova o filtro de verdade: constrói um checklist em que EXISTE um item
     * opcional e confere que `faltamNoPainel` o descarta enquanto `checklistDosDocumentos`
     * o mantém. Se os dois devolverem a mesma coisa, o filtro sumiu.
     */
    const todos = checklistDosDocumentos([]);
    const opcionais = todos.filter((i) => i.opcional);

    if (opcionais.length > 0) {
      // Caminho direto: existe opcional traduzível — ele tem de sumir do "falta".
      expect(faltamNoPainel([]).some((i) => i.opcional)).toBe(false);
      expect(faltamNoPainel([]).length).toBeLessThan(todos.length);
      return;
    }

    /**
     * Nenhum opcional é traduzível hoje (`laudo_medico` não tem destino no enum). Então o
     * que se prova é a OUTRA metade da mesma regra: `faltamNoPainel` filtra por `opcional`,
     * e não só por `temNoBanco`. Deriva do código, para não virar lista paralela.
     */
    const fonte = semComentarios(ler('lib/documentos/o-que-falta-no-painel.ts'));
    const corpo = fonte.slice(fonte.indexOf('export function faltamNoPainel'));
    expect(corpo.slice(0, 300)).toMatch(/!i\.opcional/);
  });

  it('🔴 a TELA usa o checklist — módulo órfão não avisa ninguém', () => {
    const tela = semComentarios(ler('app/(paciente)/paciente/perfil/page.tsx'));
    expect(tela).toContain('checklistDosDocumentos');
    // E renderiza o resultado, não só o importa.
    expect(tela).toMatch(/checklist\.map\(/);
  });

  it('🔴 e a tela AVISA, não BLOQUEIA (ADR-0016 D-06)', () => {
    const tela = semComentarios(ler('app/(paciente)/paciente/perfil/page.tsx'));
    // Nenhum `return` precoce nem tela substituta por causa de pendência.
    expect(tela).not.toMatch(/if\s*\(\s*faltam\.length\s*>\s*0\s*\)\s*return/);
    expect(tela).not.toMatch(/disabled=\{\s*faltam\.length/);
  });
});
