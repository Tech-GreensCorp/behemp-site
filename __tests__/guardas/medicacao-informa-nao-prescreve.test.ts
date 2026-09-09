/**
 * Guarda: a tela de medicamento **informa opções** e nunca **dirige a conduta**.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * Em 24/08/2026 o dono pediu que cada hipótese mostrasse até 3 medicamentos ranqueados. Isso
 * parecia colidir com a proibição nº 2 do `CLAUDE.md` (nada dirige conduta) — e não colide, mas
 * a diferença entre cumprir e violar é **fina**: caberia num único campo de `mg`.
 *
 * 🔴 O CRITÉRIO, QUE NÃO É DE GOSTO
 * IMDRF/SaMD N12:2014, catalogado em `docs/02-CATALOGO-DE-REGRAS.md`:
 * - `IMD-01` **informar** = _"inform health care providers of **treatment options**"_ → listar
 *   opções ranqueadas com justificativa. Menor categoria de risco.
 * - `IMD-02` **dirigir** = _"aid in treatment by providing **enhanced support in the safe and
 *   effective use of drugs**"_ → dose, frequência, titulação, interação.
 *
 * Então a linha que este guarda vigia é: **opção sim, posologia não.** Um campo de dose no tipo,
 * ou um botão de prescrever na tela, muda a categoria regulatória do produto inteiro — e é o
 * tipo de mudança que ninguém percebe num diff de 4 linhas.
 *
 * O guarda também prova a garantia que o dono pediu de forma literal: que a evidência na tela de
 * decisão seja *"o mesmo dado"* do painel — o que só é verdade se for o **mesmo componente**.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { camposDo, corpoDoTipo, semComentarios } from './_apoio/codigo';

const CONTRATO = readFileSync('lib/ia-clinica/contrato.ts', 'utf8');
const MEDICACOES = readFileSync('components/ia-clinica/MedicacoesSugeridas.tsx', 'utf8');
const EVIDENCIA_UI = readFileSync('components/ia-clinica/EvidenciaDaHipotese.tsx', 'utf8');
const PAINEL = readFileSync('components/ia-clinica/PainelHipoteses.tsx', 'utf8');
const REVISAO = readFileSync('components/ia-clinica/RevisaoHumana.tsx', 'utf8');
const CHIP = readFileSync('components/ia-clinica/ChipAchado.tsx', 'utf8');
const FIXTURE = JSON.parse(
  readFileSync('__fixtures__/ia-clinica/resposta-canabidiol-dor-cronica.json', 'utf8'),
);

/**
 * Radicais que denunciam posologia, derivados do texto do `IMD-02` — *"safe and effective use of
 * drugs"*: quanto, com que frequência, em que escalada.
 *
 * 🔴 RADICAL, NÃO NOME EXATO — E ISSO FOI APRENDIDO NA SABOTAGEM
 * A primeira versão comparava o nome do campo por igualdade, contra uma lista. A sabotagem que
 * acrescentou `doseMg` ao contrato **passou verde**: `doseMg` não é igual a `dose` nem a `mg`.
 * Era a Regra 1 da técnica sendo violada — *derive, não liste* —, e o guarda dava a garantia
 * mais perigosa de todas: a falsa.
 *
 * A correção não é uma lista maior. É quebrar o nome do campo em **tokens** (por camelCase e
 * `_`) e testar cada token contra o radical. Assim `doseMg`, `dose_mg`, `mgPorDose` e
 * `frequenciaDiaria` caem todos, sem que a lista precise prever a grafia.
 */
const RADICAIS_DE_POSOLOGIA = [
  'dose',
  'dosagem',
  'mg',
  'ml',
  'mcg',
  'posologia',
  'posolog',
  'frequencia',
  'frequência',
  'freq',
  'intervalo',
  'titulacao',
  'titulação',
  'escalonamento',
  'escalada',
  'quantidade',
  'gotas',
  'administracao',
  'administração',
  'comprimidos',
  'capsulas',
  'volume',
];

/** Quebra `doseMgPorDia` em `['dose','mg','por','dia']`. */
function tokensDoCampo(nome: string): string[] {
  return nome
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * ⚠️ `concentracao` ficou FORA de propósito. Concentração identifica o produto ("óleo
 * 200 mg/mL") e hoje viaja dentro de `nome`, como texto. Proibi-la acusaria o inocente. O que
 * a torna dose é multiplicá-la por volume — e `volume` está na lista.
 */
function ehCampoDePosologia(nome: string): boolean {
  const tokens = tokensDoCampo(nome);
  return tokens.some((tk) => RADICAIS_DE_POSOLOGIA.includes(tk));
}

// ═══════════════════════════════════════════════════════════════════════════════
// VACUIDADE — antes de tudo: o guarda enxerga o que precisa proteger?
// ═══════════════════════════════════════════════════════════════════════════════

describe('o guarda enxerga o que protege', () => {
  it('o tipo MedicamentoSugerido existe e tem os campos que informam', () => {
    const campos = camposDo(corpoDoTipo(CONTRATO, 'MedicamentoSugerido'));
    expect(campos.length, 'tipo MedicamentoSugerido não encontrado no contrato').toBeGreaterThan(4);
    // Se estes saírem, a tela deixa de informar — e o guarda de baixo passaria vacuamente.
    expect(campos).toContain('rank');
    expect(campos).toContain('nome');
    expect(campos).toContain('porQue');
    expect(campos).toContain('procedencia');
  });

  it('o fixture de canabidiol tem hipótese COM e hipótese SEM medicamento', () => {
    const hs = FIXTURE.grafo.hipoteses as { medicamentos?: unknown[] }[];
    expect(
      hs.some((h) => (h.medicamentos?.length ?? 0) > 0),
      'nenhuma hipótese com opção',
    ).toBe(true);
    // O caso vazio é o que prova que a tela lida com ausência em vez de esconder a seção.
    expect(
      hs.some((h) => (h.medicamentos?.length ?? 0) === 0),
      'nenhuma hipótese vazia',
    ).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// IMD-01 vs IMD-02 — opção sim, posologia não
// ═══════════════════════════════════════════════════════════════════════════════

describe('o contrato não admite posologia', () => {
  it('MedicamentoSugerido não tem nenhum campo de dose', () => {
    const campos = camposDo(corpoDoTipo(CONTRATO, 'MedicamentoSugerido'));
    const proibidos = campos.filter(ehCampoDePosologia);
    expect(
      proibidos,
      `campo(s) de posologia em MedicamentoSugerido: ${proibidos.join(', ')}. ` +
        'Isso move o produto de IMD-01 (informar) para IMD-02 (dirigir) — decisão regulatória, ' +
        'não de interface. Dose é ato do médico, na prescrição.',
    ).toHaveLength(0);
  });

  it('Hipotese também não ganhou campo de dose por outro caminho', () => {
    const campos = camposDo(corpoDoTipo(CONTRATO, 'Hipotese'));
    const proibidos = campos.filter(ehCampoDePosologia);
    expect(proibidos, `campo(s) de posologia em Hipotese: ${proibidos.join(', ')}`).toHaveLength(0);
  });

  it('o fixture não traz dose em nenhuma opção', () => {
    const hs = FIXTURE.grafo.hipoteses as { medicamentos?: Record<string, unknown>[] }[];
    const achados: string[] = [];
    for (const h of hs)
      for (const m of h.medicamentos ?? [])
        for (const k of Object.keys(m)) if (ehCampoDePosologia(k)) achados.push(k);
    expect(achados, `chave(s) de dose no fixture: ${achados.join(', ')}`).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Nenhum caminho de um clique entre sugestão e prescrição
// ═══════════════════════════════════════════════════════════════════════════════

describe('o detector de posologia acusa grafia composta e poupa o inocente', () => {
  // REGRESSÃO (24/08/2026): `doseMg` sobreviveu à sabotagem porque a comparação era por
  // igualdade. Estes casos existem para que a correção não se desfaça.
  it.each([
    'dose',
    'doseMg',
    'dose_mg',
    'mgPorDose',
    'frequenciaDiaria',
    'esquemaTitulacao',
    'gotas',
    'volumeMl',
  ])('%s é campo de posologia', (nome) => {
    expect(ehCampoDePosologia(nome), `${nome} deveria ser acusado`).toBe(true);
  });

  // CONTROLE: os campos que o tipo REALMENTE tem não podem ser acusados, senão o guarda fica
  // impossível de satisfazer e alguém o desliga.
  it.each([
    'nome',
    'rank',
    'via',
    'porQue',
    'proporcao',
    'ressalvas',
    'procedencia',
    'referencia',
    'confianca_evidencia',
    'id',
  ])('%s NÃO é campo de posologia', (nome) => {
    expect(ehCampoDePosologia(nome), `${nome} foi acusado sem ser dose`).toBe(false);
  });
});

describe('nenhuma tela de sugestão executa conduta', () => {
  it.each([
    ['MedicacoesSugeridas.tsx', MEDICACOES],
    ['EvidenciaDaHipotese.tsx', EVIDENCIA_UI],
    ['PainelHipoteses.tsx', PAINEL],
    ['RevisaoHumana.tsx', REVISAO],
  ])('%s não tem botão que prescreve', (arquivo, fonte) => {
    const codigo = semComentarios(fonte);
    // Casa o VERBO em posição de ação: handler, chamada de action, ou rótulo de botão.
    const acao = codigo.match(
      /(onClick|onSubmit)[^;]{0,200}?(prescrev|emitirReceita|gerarReceita)/i,
    );
    expect(acao?.[0], `${arquivo} liga um clique a prescrição: ${acao?.[0]}`).toBeUndefined();
    const importaAction = codigo.match(/import[^;]*?(prescricao|receituario)[^;]*?;/i);
    expect(
      importaAction?.[0],
      `${arquivo} importa ação de prescrição: ${importaAction?.[0]}`,
    ).toBeUndefined();
  });

  // CONTROLE contra falsa acusação: os arquivos FALAM de prescrição nos comentários, de
  // propósito — é lá que a regra está explicada. Comentar não é executar.
  it('menção a prescrição em comentário não é violação', () => {
    const comentado = `
      /* aqui NÃO existe onClick que chama prescrever */
      // botão de prescrever seria violação
      export const a = 1;
    `;
    const codigo = semComentarios(comentado);
    expect(/(onClick|onSubmit)[^;]{0,200}?prescrev/i.test(codigo)).toBe(false);
  });

  it('um onClick real que prescreve É violação', () => {
    const codigo = semComentarios('<button onClick={() => prescrever(id)}>ok</button>');
    expect(/(onClick|onSubmit)[^;]{0,200}?prescrev/i.test(codigo)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// No máximo 3, e o limite vem da constante — não de número solto
// ═══════════════════════════════════════════════════════════════════════════════

describe('o limite de 3 opções é único e aplicado', () => {
  it('MAX_MEDICAMENTOS_POR_HIPOTESE vale 3 no contrato', () => {
    expect(semComentarios(CONTRATO)).toMatch(/MAX_MEDICAMENTOS_POR_HIPOTESE\s*=\s*3\b/);
  });

  it('o componente corta pela constante, não por um 3 escrito à mão', () => {
    const codigo = semComentarios(MEDICACOES);
    expect(codigo, 'o corte deve usar a constante').toMatch(
      /slice\(\s*0\s*,\s*MAX_MEDICAMENTOS_POR_HIPOTESE\s*\)/,
    );
    // Um `slice(0, 3)` literal divergiria da constante no dia em que ela mudar.
    expect(/slice\(\s*0\s*,\s*3\s*\)/.test(codigo), 'corte com 3 literal').toBe(false);
  });

  it('nenhuma hipótese do fixture excede o limite', () => {
    const hs = FIXTURE.grafo.hipoteses as { slot: number; medicamentos?: unknown[] }[];
    for (const h of hs)
      expect(h.medicamentos?.length ?? 0, `hipótese slot ${h.slot} excede 3`).toBeLessThanOrEqual(
        3,
      );
  });

  it('ranks são 1..3 e sem repetição dentro da hipótese', () => {
    const hs = FIXTURE.grafo.hipoteses as { slot: number; medicamentos?: { rank: number }[] }[];
    for (const h of hs) {
      const ranks = (h.medicamentos ?? []).map((m) => m.rank);
      expect(new Set(ranks).size, `rank repetido na hipótese slot ${h.slot}`).toBe(ranks.length);
      for (const r of ranks) {
        expect(r, `rank ${r} fora de 1..3`).toBeGreaterThanOrEqual(1);
        expect(r, `rank ${r} fora de 1..3`).toBeLessThanOrEqual(3);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Procedência: enquanto o GAP-03 estiver aberto, sugestão nunca passa por catálogo validado
// ═══════════════════════════════════════════════════════════════════════════════

describe('a procedência de cada opção é dita', () => {
  it('procedencia é obrigatória no tipo, não opcional', () => {
    const corpo = corpoDoTipo(CONTRATO, 'MedicamentoSugerido');
    expect(corpo, 'procedencia não existe').toMatch(/\bprocedencia\s*:/);
    expect(
      /\bprocedencia\s*\?\s*:/.test(corpo),
      'procedencia virou opcional — sugestão de modelo passaria sem rótulo',
    ).toBe(false);
  });

  it('o componente renderiza a procedência de cada opção', () => {
    const codigo = semComentarios(MEDICACOES);
    // Amarrado ao COMPORTAMENTO, não à forma: o componente tem que LER a procedência da opção e
    // LEVAR o rótulo à tela. A primeira versão exigia literalmente
    // `PROCEDENCIA[medicamento.procedencia]` e ficou vermelha quando um `?? fallback` entrou —
    // guarda que quebra em refatoração legítima é guarda que alguém desliga.
    expect(codigo, 'o componente precisa ler a procedência da opção').toMatch(
      /medicamento\.procedencia/,
    );
    expect(codigo, 'o mapa de procedências precisa ser consultado').toMatch(/PROCEDENCIA\b/);
    expect(codigo, 'o rótulo precisa ir à tela').toMatch(/proc\.rotulo/);
  });

  it('procedência desconhecida DENUNCIA, em vez de derrubar a tela ou mentir', () => {
    // 🔴 REGRESSÃO 24/08/2026. `PROCEDENCIA[valor]` com valor fora do contrato devolvia
    // `undefined` e a tela caía inteira. Cair para um padrão silencioso seria pior: afirmaria
    // uma origem que ninguém declarou, e a origem é o que impede sugestão de modelo de passar
    // por catálogo validado enquanto o GAP-03 estiver aberto.
    const codigo = semComentarios(MEDICACOES);
    expect(codigo, 'falta o fallback — valor fora do contrato derruba a tela').toMatch(/\?\?/);
    expect(codigo, 'o fallback tem que DIZER que é desconhecida').toMatch(/desconhecida/);
  });

  it('origem de achado desconhecida também denuncia, no ChipAchado', () => {
    // Mesmo defeito, outro componente: foi ELE que estourou em 24/08.
    const codigo = semComentarios(CHIP);
    expect(codigo, 'ChipAchado sem fallback — foi aqui que a tela caiu').toMatch(/\?\?/);
    expect(codigo, 'o fallback tem que DIZER que é desconhecida').toMatch(/desconhecida/);
    expect(codigo, 'não pode cair para uma origem inventada').not.toMatch(/\?\?\s*PROVENIENCIA\./);
  });

  it('todo medicamento do fixture declara procedência', () => {
    const hs = FIXTURE.grafo.hipoteses as {
      medicamentos?: { id: string; procedencia?: string }[];
    }[];
    for (const h of hs)
      for (const m of h.medicamentos ?? [])
        expect(m.procedencia, `opção ${m.id} sem procedência`).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// "O mesmo dado" só é o mesmo se for o MESMO componente
// ═══════════════════════════════════════════════════════════════════════════════

describe('a evidência da decisão é a mesma do painel', () => {
  it.each([
    ['PainelHipoteses.tsx', PAINEL],
    ['RevisaoHumana.tsx', REVISAO],
  ])('%s usa o componente compartilhado de evidência', (arquivo, fonte) => {
    const codigo = semComentarios(fonte);
    expect(codigo, `${arquivo} deve importar EvidenciaDaHipotese`).toMatch(
      /import\s*\{\s*EvidenciaDaHipotese\s*\}\s*from\s*'@\/components\/ia-clinica\/EvidenciaDaHipotese'/,
    );
    expect(codigo, `${arquivo} deve renderizar EvidenciaDaHipotese`).toMatch(
      /<EvidenciaDaHipotese\b/,
    );
  });

  it.each([
    ['PainelHipoteses.tsx', PAINEL],
    ['RevisaoHumana.tsx', REVISAO],
    ['EvidenciaDaHipotese.tsx', EVIDENCIA_UI],
  ])('%s não redeclara a leitura do grafo', (arquivo, fonte) => {
    expect(
      /function\s+evidenciaDa\s*\(/.test(semComentarios(fonte)),
      `${arquivo} recriou evidenciaDa — duas cópias divergem e as telas passam a discordar`,
    ).toBe(false);
  });

  it('evidenciaDa vive num só lugar, e é puro', () => {
    const fonte = readFileSync('lib/ia-clinica/evidencia.ts', 'utf8');
    const codigo = semComentarios(fonte);
    expect(codigo).toMatch(/export function evidenciaDa\s*\(/);
    // Puro: sem env, sem React, sem next. Senão volta a não ser testável sem ambiente (§5-bis).
    expect(/process\.env/.test(codigo), 'evidencia.ts passou a ler env').toBe(false);
    expect(/from\s*'(react|next\/)/.test(codigo), 'evidencia.ts importou React ou Next').toBe(
      false,
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADR-0006 — nunca percentual, nem por acidente
// ═══════════════════════════════════════════════════════════════════════════════

describe('nenhum número de confiança chega à tela de medicamento', () => {
  it('MedicacoesSugeridas não lê probabilidade', () => {
    expect(
      /probabilidade/.test(semComentarios(MEDICACOES)),
      'a tela de medicamento passou a usar probabilidade — ADR-0006 proíbe a exibição',
    ).toBe(false);
  });

  it('usa a faixa categórica, que é o que pode aparecer', () => {
    expect(semComentarios(MEDICACOES)).toMatch(/confianca_evidencia/);
  });
});
