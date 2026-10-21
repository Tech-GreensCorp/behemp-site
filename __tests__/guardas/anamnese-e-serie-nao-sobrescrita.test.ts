/**
 * Guarda: a anamnese é SÉRIE, e nada sobrescreve medida anterior.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * [ADR-0004](../../docs/adr/ADR-0004-anamnese-e-baseline-de-acompanhamento-longitudinal.md) D-01
 * decidiu que a anamnese é baseline repetível. A ADR rejeita explicitamente *"manter um registro
 * de anamnese por paciente, sobrescrito a cada consulta"* — porque perde exatamente a informação
 * que dá valor ao tratamento com canabidiol: a evolução.
 *
 * É também a Proibição 3 do `CLAUDE.md` (não sobrescrever histórico clínico). Um `update` numa
 * medida é perda irreversível de dado clínico, e o tipo de erro que ninguém percebe até precisar
 * do dado que já não existe.
 *
 * O QUE MAIS ESTE GUARDA COBRA
 * · escopo de objeto em toda função (o médico só toca em paciente que é dele);
 * · a ramificação do primeiro uso validada NO SERVIDOR, não só escondida na tela (`DO-27`);
 * · as faixas plausíveis declaradas num lugar só — se cada tela declarar a sua, a série deixa de
 *   ser comparável;
 * · a direção invertida da escala de qualidade de vida dita na tela.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const RAIZ = join(import.meta.dirname, '..', '..');
const fonte = (a: string) => readFileSync(join(RAIZ, a), 'utf8');

const ACTION = 'app/_actions/anamnese-baseline.ts';
const CONTROLE = 'components/ia-clinica/ControleMedida.tsx';
const FORM = 'components/ia-clinica/FormMedidas.tsx';
const RASTREIO = 'components/ia-clinica/RastreioUso.tsx';
const SERIE = 'components/ia-clinica/SerieDeMedidas.tsx';
const SCHEMA_MEDIDAS = 'db/schema/medidas-desfecho.ts';
const SCHEMA_RASTREIO = 'db/schema/rastreio-uso-cannabis.ts';

/** Funções exportadas da action, fatiadas — a unidade em que o defeito acontece. */
function funcoesDaAction(): Array<{ nome: string; corpo: string }> {
  const t = fonte(ACTION);
  const marcas = [...t.matchAll(/export async function ([A-Za-z0-9_]+)/g)];
  return marcas.map((m, i) => ({
    nome: m[1],
    corpo: t.slice(m.index, marcas[i + 1]?.index ?? t.length),
  }));
}

const FUNCOES = funcoesDaAction();

describe('nada sobrescreve medida anterior', () => {
  it('o guarda enxerga as funções que precisa proteger', () => {
    expect(FUNCOES.length, 'nenhuma action extraída — o parser quebrou').toBeGreaterThanOrEqual(4);
  });

  it('a action NUNCA faz update em medidasDesfecho', () => {
    // Cada remedição é uma linha nova. Um update aqui apaga o ponto anterior da série, e é
    // perda irreversível de dado clínico.
    const t = fonte(ACTION);
    expect(
      /db\s*\n?\s*\.update\(\s*medidasDesfecho/.test(t) || /update\(medidasDesfecho/.test(t),
      'há update em medidasDesfecho — a série perde o ponto anterior (ADR-0004 D-01)',
    ).toBe(false);
  });

  it('a action NUNCA faz update em rastreioUsoCannabis', () => {
    const t = fonte(ACTION);
    expect(
      /db\s*\n?\s*\.update\(\s*rastreioUsoCannabis/.test(t) ||
        /update\(rastreioUsoCannabis/.test(t),
      'há update no rastreio — o rastreio do retorno apagaria o da primeira consulta',
    ).toBe(false);
  });

  it('as duas tabelas têm soft delete, e não hard delete', () => {
    // Proibição 3: entidade clínica preserva histórico. `delete` físico contorna isso.
    for (const s of [SCHEMA_MEDIDAS, SCHEMA_RASTREIO]) {
      expect(/softDeleteColumn/.test(fonte(s)), `${s} sem soft delete`).toBe(true);
    }
    expect(/\.delete\(/.test(fonte(ACTION)), 'há delete físico na action').toBe(false);
  });

  it('a medida guarda a data da MEDIÇÃO, distinta da data do registro', () => {
    // `createdAt` diz quando foi digitado. Sem `medidoEm`, uma medida lançada com atraso
    // mentiria sobre quando o valor foi observado — e a série é sobre tempo.
    expect(/medidoEm: date\('medido_em'\)\.notNull\(\)/.test(fonte(SCHEMA_MEDIDAS))).toBe(true);
  });
});

describe('toda função prova escopo de objeto', () => {
  it.each(FUNCOES.map((f) => [f.nome, f] as const))('%s exige médico DO paciente', (_n, f) => {
    // Verificar que é médico não basta: médico com id de paciente alheio é OWASP API1 (BOLA),
    // a classe que a Sprint 1 corrigiu em 7 lugares. Aqui nasce certo.
    expect(
      /garantirMedicoDoPaciente/.test(f.corpo),
      `${f.nome} não prova escopo de objeto — verificar papel não basta`,
    ).toBe(true);
  });

  it('o escopo conjunga pacientes.medicoId, não só o papel', () => {
    const t = fonte(ACTION);
    const helper = t.slice(t.indexOf('async function garantirMedicoDoPaciente'));
    expect(
      /eq\(pacientes\.medicoId,\s*medico\.id\)/.test(helper),
      'o helper não amarra o paciente ao médico — qualquer médico leria qualquer paciente',
    ).toBe(true);
  });

  it('leitura de dado clínico é auditada', () => {
    // A regra das três perguntas de seguranca-lgpd.md inclui "o acesso é auditado".
    const leituras = FUNCOES.filter((f) => f.nome.startsWith('buscar'));
    expect(leituras.length).toBeGreaterThanOrEqual(2);
    for (const f of leituras) {
      expect(
        /acao: 'visualizar'/.test(f.corpo),
        `${f.nome} lê dado clínico e não registra auditoria de visualização`,
      ).toBe(true);
    }
  });
});

describe('o primeiro uso é validado no servidor, não só na tela', () => {
  it('a action recusa produto, dose ou adesão quando a situação é primeiro_uso', () => {
    // 🔴 `DO-27`. Se a validação existisse só na tela, um cliente forjado gravaria dose para
    // quem declarou nunca ter usado — e quem lê o prontuário depois não sabe em qual acreditar.
    const t = fonte(ACTION);
    expect(/\.refine\(/.test(t), 'não há validação cruzada da ramificação').toBe(true);
    const refine = t.slice(t.indexOf('.refine('));
    expect(/primeiro_uso/.test(refine)).toBe(true);
    expect(
      /produtoDescrito|doseRelatada|adesao/.test(refine),
      'a validação não impede produto/dose/adesão em primeiro uso',
    ).toBe(true);
  });

  it('a situação é enum de três estados, não boolean', () => {
    // Boolean não distingue "nunca usou" de "ninguém perguntou", e a diferença muda a consulta.
    const enums = fonte('db/schema/enums.ts');
    expect(/situacaoUsoCannabisEnum/.test(enums)).toBe(true);
    expect(/'primeiro_uso'/.test(enums)).toBe(true);
    expect(/'usa_atualmente'/.test(enums)).toBe(true);
    expect(/'usou_e_parou'/.test(enums)).toBe(true);
  });

  it('a tela oferece os três caminhos, e o de primeiro uso pede expectativa e receio', () => {
    const t = fonte(RASTREIO);
    expect(/primeiro_uso/.test(t)).toBe(true);
    expect(
      /expectativa/.test(t) && /receio/.test(t),
      'o caminho de primeiro uso não pede expectativa nem receio — trata como ausência de dado',
    ).toBe(true);
  });

  it('a adesão é registrada no rastreio, não em dosagens', () => {
    // `dosagens` guarda o PRESCRITO, e é ele que a titulação compara. Guardar os dois no mesmo
    // lugar faria o ajuste de dose ser calculado sobre um número que talvez não aconteceu.
    expect(/adesao: adesaoRelatadaEnum/.test(fonte(SCHEMA_RASTREIO))).toBe(true);
    expect(
      /adesao/.test(fonte('db/schema/dosagens.ts')),
      'a adesão foi para `dosagens` — isso sobrescreve a base de comparação da titulação',
    ).toBe(false);
  });
});

describe('a entrada numérica tem faixa, e a faixa vive num lugar só', () => {
  it('as faixas são declaradas UMA vez, no controle', () => {
    // Se cada tela declarasse a sua, a faixa de dor divergiria entre primeira avaliação e
    // retorno — e a série deixaria de ser comparável.
    expect(/export const FAIXAS/.test(fonte(CONTROLE))).toBe(true);
    for (const tela of [FORM]) {
      expect(
        /min:\s*\d+,\s*max:\s*\d+/.test(fonte(tela)),
        `${tela} declara faixa própria em vez de importar FAIXAS`,
      ).toBe(false);
    }
  });

  // 🔴 A SABOTAGEM ENCONTROU UM FURO AQUI.
  // A primeira versão procurava o clamp em QUALQUER lugar do arquivo — e ele existe em DOIS
  // caminhos de entrada: os botões `−`/`+` (`ajustar`) e a digitação (`forcarFaixa`). Remover o
  // clamp da digitação mantinha o guarda verde, porque o dos botões seguia presente. Digitar
  // "900" é justamente o caminho mais provável do erro que a ADR-0004 D-05 quer impedir.
  // Fatiado por FUNÇÃO — Regra 2 de docs/TECNICA-DOS-GUARDAS.md.
  it.each([
    ['ajustar', 'os botões −/+'],
    ['forcarFaixa', 'a digitação direta'],
  ])('o clamp existe em %s (%s)', (fn) => {
    const t = fonte(CONTROLE);
    const i = t.indexOf(`const ${fn} = `);
    expect(i, `a função ${fn} não existe mais`).toBeGreaterThan(-1);
    const corpo = t.slice(i, t.indexOf('\n  };', i));
    expect(
      /Math\.min\(faixa\.max,\s*Math\.max\(faixa\.min/.test(corpo),
      `${fn} não limita à faixa plausível — é o defeito que a ADR-0004 D-05 rejeita`,
    ).toBe(true);
  });

  it('o controle mostra o valor ANTERIOR ao lado', () => {
    // É o coração da D-01: sem isso a série existe no banco e não na tela.
    const t = fonte(CONTROLE);
    expect(/anterior/.test(t)).toBe(true);
    expect(/antes:/.test(t), 'o valor anterior não aparece rotulado na tela').toBe(true);
  });

  it('a Zod da action valida a faixa também no servidor', () => {
    // A tela é conveniência; o servidor é a garantia. PA 900 chegando por cliente forjado
    // entraria no prontuário.
    const t = fonte(ACTION);
    expect(/\.min\(0\)\.max\(10\)/.test(t), 'as escalas 0–10 não são validadas no servidor').toBe(
      true,
    );
    expect(/min\(50\)\.max\(300\)/.test(t), 'a pressão não tem faixa no servidor').toBe(true);
  });

  it('a direção invertida da qualidade de vida é dita na tela', () => {
    // Sem isso, +2 em qualidade de vida parece piora para quem leu as outras escalas.
    expect(
      /MAIOR é melhor/.test(fonte(FORM)),
      'a escala invertida não é explicada — o médico lê a variação errado',
    ).toBe(true);
    expect(/maiorEhMelhor/.test(fonte(CONTROLE))).toBe(true);
  });

  it('a contagem de crises não pode existir sem o período', () => {
    // "12 crises" sem janela é dado que engana quem lê depois.
    const t = fonte(ACTION);
    expect(
      /crisesContagem === undefined\) !== \(d\.crisesPeriodo === undefined/.test(t),
      'contagem e período podem divergir — a série fica incomparável',
    ).toBe(true);
  });
});

describe('a tela respeita as proibições visuais do repositório', () => {
  it('não usa <Table>, que tem 0 usos no produto', () => {
    for (const c of [SERIE, FORM, RASTREIO, CONTROLE]) {
      expect(
        /from '@\/components\/ui\/table'/.test(fonte(c)),
        `${c} importa components/ui/table — Proibição 2 do CLAUDE.md`,
      ).toBe(false);
    }
  });

  it('não leva framer-motion para fora da teleconsulta', () => {
    for (const c of [SERIE, FORM, RASTREIO, CONTROLE]) {
      expect(/framer-motion/.test(fonte(c)), `${c} importa framer-motion`).toBe(false);
    }
  });

  it('tabela larga rola dentro do próprio container, não a página', () => {
    expect(
      /overflow-x-auto/.test(fonte(SERIE)),
      'a série não tem rolagem própria — o corpo da página rolaria de lado no telefone',
    ).toBe(true);
  });

  it('nenhum arquivo da fatia passa de 400 linhas', () => {
    // Critério de aceite da Sprint 3.
    for (const a of [ACTION, CONTROLE, FORM, RASTREIO, SERIE]) {
      const linhas = fonte(a).split('\n').length;
      expect(linhas, `${a} tem ${linhas} linhas`).toBeLessThanOrEqual(400);
    }
  });
});
