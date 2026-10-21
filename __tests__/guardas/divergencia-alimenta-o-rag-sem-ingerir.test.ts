/**
 * Guarda: a divergência alimenta o RAG, o rascunho mora no servidor, e a urgência tem um mapa só.
 *
 * POR QUE ESTE ARQUIVO EXISTE — três decisões, três classes de erro
 *
 * 1. `DO-40` — divergir registra o medicamento que o médico VAI prescrever. Sem esse par
 *    (sugerido × escolhido), a divergência diz que o modelo errou mas não o que era certo.
 *    ⚠️ E `GAP-16` bloqueia a INGESTÃO no corpus, não a construção dos campos (ADR-0011 D-02).
 *    Alguém preencher `ingeridoNoCorpusEm` antes da resposta do Jurídico é uso de dado de saúde
 *    para finalidade nova sem base legal.
 *
 * 2. `DO-41` — o rascunho vai no SERVIDOR. `localStorage` foi rejeitado com motivo: é dado de
 *    saúde num navegador de consultório compartilhado, e não sobrevive a trocar de máquina.
 *
 * 3. `DO-51` / ADR-0013 — o mapa de urgência mora num lugar só, e o 4º nível vem de
 *    `red_flags_nao_explicadas`, não de um valor novo em `UrgenciaAnalise`.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  VALORES_COBERTOS,
  aparenciaDoNivel,
  nivelDeUrgencia,
  urgenciaParaTela,
} from '../../lib/ia-clinica/urgencia';

const RAIZ = join(import.meta.dirname, '..', '..');
const fonte = (a: string) => readFileSync(join(RAIZ, a), 'utf8');

/** Código sem comentários — proibir o código não pode significar proibir a explicação. */
const codigo = (a: string) =>
  fonte(a)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const ACTION_REVISAO = 'app/_actions/revisao-ia.ts';
const ACTION_RASCUNHO = 'app/_actions/rascunho-revisao.ts';
const SCHEMA_REVISOES = 'db/schema/revisoes-ia.ts';
const SCHEMA_RASCUNHOS = 'db/schema/rascunhos-revisao-ia.ts';
const COMPONENTE_REVISAO = 'components/ia-clinica/RevisaoHumana.tsx';
const SELO = 'components/ia-clinica/SeloDeUrgencia.tsx';
const PAINEL_TELE = 'components/teleconsulta/PainelClinicoLateral.tsx';

// ═══════════════════════════════════════════════════════════════════════════════
// 1. A DIVERGÊNCIA REGISTRA O DESFECHO (`DO-40`)
// ═══════════════════════════════════════════════════════════════════════════════

describe('divergir alimenta o RAG', () => {
  it.each(['porQueIaErrou', 'medicamentoPrescritoNome', 'fonteRag'])(
    'o schema tem a coluna %s',
    (col) => {
      expect(fonte(SCHEMA_REVISOES)).toMatch(new RegExp(col));
    },
  );

  it('o medicamento a prescrever é OBRIGATÓRIO ao divergir — e a regra vive no servidor', () => {
    // Cliente forjado gravaria divergência sem desfecho, e a série deixaria de medir.
    const t = fonte(ACTION_REVISAO);
    expect(t).toMatch(/medicamentoPrescritoNome/);
    expect(t, 'falta o refine que exige o medicamento ao divergir').toMatch(
      /refine[\s\S]{0,400}divergente[\s\S]{0,200}medicamentoPrescritoNome/,
    );
  });

  it('"por que a IA errou" é OPCIONAL — e continua opcional', () => {
    // `DO-40` foi explícito. Exigir de quem tem pressa produz texto vazio, que polui o corpus
    // mais do que a ausência. Se alguém tornar obrigatório, este caso fica vermelho.
    const t = codigo(ACTION_REVISAO);
    const linha = t.split('\n').find((l) => l.includes('porQueIaErrou:'));
    expect(linha, 'campo porQueIaErrou não encontrado no schema').toBeTruthy();
    expect(linha!, 'porQueIaErrou virou obrigatório — o DO-40 diz opcional').toMatch(/optional/);
  });

  it('a tela só mostra os dois campos ao DIVERGIR', () => {
    // Ao validar não há "erro da IA" a explicar. Mostrar sempre convidaria a preencher ruído.
    const t = fonte(COMPONENTE_REVISAO);
    expect(t).toMatch(/modo === 'divergir'[\s\S]{0,600}medicamento-prescrito/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. NADA É INGERIDO NO CORPUS ANTES DO `GAP-16`
// ═══════════════════════════════════════════════════════════════════════════════

describe('GAP-16 — construir os campos não é ingerir', () => {
  it('a coluna de ingestão existe e é nullable', () => {
    const t = fonte(SCHEMA_REVISOES);
    expect(t).toMatch(/ingeridoNoCorpusEm/);
    const linha = t.split('\n').find((l) => l.includes('ingerido_no_corpus_em'));
    expect(linha!, 'a coluna de ingestão não pode ser notNull — ela nasce vazia').not.toMatch(
      /notNull/,
    );
  });

  it('🔴 NENHUM código de produção ESCREVE em ingeridoNoCorpusEm', () => {
    // É o caso mais importante deste arquivo: usar o dado para treinar o modelo é finalidade
    // NOVA (LGPD art. 7º e art. 11), e a base legal é decisão do Jurídico.
    const escritores = varrer(['app', 'lib', 'components']).filter((a) => {
      const t = codigo(a);
      return /ingeridoNoCorpusEm\s*:/.test(t) || /ingerido_no_corpus_em/.test(t);
    });
    expect(
      escritores,
      `alguém preenche ingeridoNoCorpusEm antes do GAP-16: ${escritores.join(', ')}`,
    ).toEqual([]);
  });

  it('a fonte do RAG é declarada como revisao_humana', () => {
    // O VidAI usa limiares distintos por camada — 0,65 é o do respaldo do médico. Marcar a
    // camada agora é o que permite aplicar o limiar certo depois.
    expect(codigo(ACTION_REVISAO)).toMatch(/fonteRag:\s*'revisao_humana'/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. O RASCUNHO MORA NO SERVIDOR (`DO-41`)
// ═══════════════════════════════════════════════════════════════════════════════

describe('o rascunho da revisão não vive no navegador', () => {
  it('🔴 o componente de revisão NÃO usa localStorage nem sessionStorage', () => {
    // ADR-0011 D-03 rejeitou com motivo: dado de saúde em navegador de consultório
    // compartilhado, e não sobrevive a trocar de máquina — que é o caso do DO-41.
    const t = codigo(COMPONENTE_REVISAO);
    expect(/localStorage|sessionStorage/.test(t), 'o rascunho voltou para o navegador').toBe(false);
  });

  it('existe action de servidor para salvar e listar', () => {
    expect(existsSync(join(RAIZ, ACTION_RASCUNHO))).toBe(true);
    const t = fonte(ACTION_RASCUNHO);
    expect(t).toMatch(/export async function salvarRascunhoRevisao/);
    expect(t).toMatch(/export async function listarRascunhosRevisao/);
  });

  it('cada salvamento INSERE — nunca faz update', () => {
    // Histórico que se sobrescreve não é histórico. Mesma regra de medidasDesfecho.
    const t = codigo(ACTION_RASCUNHO);
    expect(/\.update\(\s*rascunhosRevisaoIa/.test(t), 'há update no rascunho').toBe(false);
    expect(t).toMatch(/\.insert\(rascunhosRevisaoIa\)/);
  });

  it('a versão cresce a partir da última', () => {
    expect(codigo(ACTION_RASCUNHO)).toMatch(/versao:\s*\(?ultima/);
  });

  it('toda função do rascunho prova escopo de objeto', () => {
    const t = fonte(ACTION_RASCUNHO);
    const funcoes = [...t.matchAll(/export async function ([A-Za-z0-9_]+)/g)];
    expect(funcoes.length).toBeGreaterThanOrEqual(2);
    const marcas = funcoes.map((m, i) => t.slice(m.index, funcoes[i + 1]?.index ?? t.length));
    const semEscopo = marcas
      .filter((c) => !/garantirMedicoDoPaciente\(/.test(c))
      .map((c) => c.slice(0, 60));
    expect(semEscopo, 'função de rascunho sem escopo de objeto').toEqual([]);
  });

  it('rascunho de um médico não aparece para outro', () => {
    // Rascunho é pensamento a meio caminho. O filtro por medicoId é o segundo, além do escopo.
    expect(codigo(ACTION_RASCUNHO)).toMatch(/eq\(rascunhosRevisaoIa\.medicoId/);
  });

  it('o prazo de retenção existe e fica VAZIO — é decisão do Jurídico', () => {
    expect(fonte(SCHEMA_RASCUNHOS)).toMatch(/retencaoAte/);
    expect(
      /retencaoAte\s*:/.test(codigo(ACTION_RASCUNHO)),
      'alguém chutou o prazo de retenção — é decisão do Jurídico',
    ).toBe(false);
  });

  it('reidratar NÃO apaga o que já foi digitado', () => {
    // `preservarCamposHitl()` do VidAI (P7): a retomada preenche só o que está vazio.
    expect(fonte(COMPONENTE_REVISAO)).toMatch(/setConclusao\(\(v\) => v \|\|/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. A URGÊNCIA TEM UM MAPA SÓ (ADR-0013)
// ═══════════════════════════════════════════════════════════════════════════════

describe('o mapa de urgência mora num lugar só', () => {
  it('cobre exatamente os 7 valores do contrato', () => {
    // Cobertura derivada do CONTRATO, não de uma lista paralela — lista paralela é o que
    // desatualiza e aprova o errado.
    const contrato = fonte('lib/ia-clinica/contrato.ts');
    const bloco = contrato.slice(contrato.indexOf('export type UrgenciaAnalise'));
    const declarados = [...bloco.slice(0, bloco.indexOf(';')).matchAll(/'([a-z_]+)'/g)].map(
      (m) => m[1],
    );
    expect(declarados.length, 'o parser do contrato quebrou').toBe(7);
    expect([...VALORES_COBERTOS].sort()).toEqual([...declarados].sort());
  });

  const casos: Array<[string, string]> = [
    ['verde', 'rotina'],
    ['ok', 'rotina'],
    ['normal', 'rotina'],
    ['amarelo', 'atencao'],
    ['atencao', 'atencao'],
    ['vermelho', 'emergencia'],
    ['critico', 'emergencia'],
  ];

  it.each(casos)('%s cai em %s quando não há red flag aberta', (valor, esperado) => {
    expect(nivelDeUrgencia(valor, 0)).toBe(esperado);
  });

  it('o 4º nível vem de red flag, não de urgencia (`DO-51`)', () => {
    expect(nivelDeUrgencia('vermelho', 2)).toBe('critico');
    expect(nivelDeUrgencia('critico', 1)).toBe('critico');
  });

  it('CONTROLE: red flag em quadro de rotina NÃO vira crítico', () => {
    // Alarme que dispara demais é alarme que se ignora (rejeitado R-04).
    expect(nivelDeUrgencia('verde', 5)).toBe('rotina');
    expect(nivelDeUrgencia('amarelo', 5)).toBe('atencao');
  });

  it.each(['roxo', 'gravissimo', '', 'URGENTE', 'null'])(
    'valor fora do contrato (%s) devolve null, nunca rotina',
    (v) => {
      // Cair para rotina afirmaria "sem urgência" a partir de valor não compreendido — a pior
      // saída numa tela cuja função é alertar (rejeitado R-05).
      expect(nivelDeUrgencia(v, 0)).toBeNull();
    },
  );

  it('null e undefined também devolvem null', () => {
    expect(nivelDeUrgencia(null)).toBeNull();
    expect(nivelDeUrgencia(undefined)).toBeNull();
  });

  it('só o nível máximo é marcado como máximo', () => {
    expect(aparenciaDoNivel('critico').ehMaximo).toBe(true);
    for (const n of ['rotina', 'atencao', 'emergencia'] as const) {
      expect(aparenciaDoNivel(n).ehMaximo).toBe(false);
    }
  });

  it('toda cor de nível sai de --chart-*, nenhum hex novo', () => {
    // Proibição nº 3: o sistema visual está fechado.
    for (const n of ['rotina', 'atencao', 'emergencia', 'critico'] as const) {
      expect(aparenciaDoNivel(n).token).toMatch(/^var\(--chart-\d\)$/);
    }
  });

  it('nenhum componente declara o próprio mapa de urgência', () => {
    // Um segundo mapa faz duas telas divergirem, e as duas continuam plausíveis (R-01).
    const suspeitos = varrer(['components', 'app'])
      .filter((a) => a !== SELO)
      .filter((a) => {
        const t = codigo(a);
        if (!/urgencia|Urgencia/.test(t)) return false;
        // A assinatura de um mapa próprio: casar valor do contrato com cor ou rótulo.
        return /(verde|amarelo|vermelho)['"]?\s*:\s*['"{]/.test(t);
      });
    expect(suspeitos, `mapa de urgência duplicado em: ${suspeitos.join(', ')}`).toEqual([]);
  });

  it('o selo denuncia valor desconhecido em vez de cair', () => {
    const t = fonte(SELO);
    expect(t).toMatch(/urgência desconhecida/);
    expect(urgenciaParaTela('roxo', 0)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. A ABA DA TELECONSULTA (`DO-39`, `DO-49`, `DO-50`)
// ═══════════════════════════════════════════════════════════════════════════════

describe('a análise assistida é mais uma aba, e o design do chefe não muda', () => {
  it('a aba IA Clínica existe', () => {
    const t = fonte(PAINEL_TELE);
    expect(t).toMatch(/id:\s*'ia'/);
    expect(t, 'o rótulo decidido em DO-49 é "IA Clínica"').toMatch(/label:\s*'IA Clínica'/);
  });

  it('a aba entra por ÚLTIMO — nenhuma existente muda de posição (`DO-50`)', () => {
    const t = fonte(PAINEL_TELE);
    const ordem = [...t.matchAll(/\{ id: '(\w+)', label:/g)].map((m) => m[1]);
    expect(ordem).toEqual(['paciente', 'prontuario', 'prescricao', 'ia']);
  });

  it('a aba usa o modo denso — o sidebar é estreito', () => {
    expect(fonte(PAINEL_TELE)).toMatch(/aba === 'ia'[\s\S]{0,400}denso/);
  });

  it('a aba monta o COMPONENTE REAL, não uma cópia', () => {
    // Cópia diverge do original no primeiro ajuste — mesma razão do /preview.
    expect(fonte(PAINEL_TELE)).toMatch(
      /import \{ AnaliseAssistida \} from '@\/components\/ia-clinica\/AnaliseAssistida'/,
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. A PEÇA CONSTRUÍDA ESTÁ MONTADA EM TELA — não só no /preview
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ⚠️ ESTA SEÇÃO NASCEU DE UMA FALHA DESTE GUARDA.
 *
 * A primeira versão declarou os cartões 17 e 18 completos, e os dois não estavam:
 *
 * · o `SeloDeUrgencia` existia apenas nele mesmo e no `/preview` — o `DO-42` diz "precisamos
 *   disso NA TELA", e a peça não estava montada em tela nenhuma;
 * · o rascunho só salvava no `onClick` — o `DO-41` diz "o médico pode SAIR SEM QUERER", e quem
 *   sai sem querer não clicou.
 *
 * Os dois passaram verdes porque o guarda checava que o ARQUIVO existia, não que ele **cumpria
 * o motivo pelo qual foi pedido**. Componente que só vive no preview é protótipo, não entrega.
 */
describe('a peça construída está montada em tela real', () => {
  it('o selo de urgência está numa tela de produção, não só no preview', () => {
    const montadores = varrer(['components', 'app'])
      .filter((a) => a !== SELO && !a.includes('PreviewGaleria'))
      .filter((a) => /<SeloDeUrgencia|<AvisoDeUrgencia/.test(codigo(a)));
    expect(
      montadores.length,
      'o SeloDeUrgencia só existe no /preview — o DO-42 pede o gatilho NA TELA',
    ).toBeGreaterThanOrEqual(1);
  });

  it('o painel de hipóteses mostra a urgência ANTES das hipóteses', () => {
    // O nível calibra a leitura de TODAS as hipóteses — mesma razão pela qual a incompletude
    // aparece antes delas. Depois da lista, chegaria tarde.
    const t = codigo('components/ia-clinica/PainelHipoteses.tsx');
    const posAviso = t.indexOf('<AvisoDeUrgencia');
    const posHipoteses = t.indexOf('hipotesesOrdenadas');
    expect(posAviso, 'o painel não mostra o aviso de urgência').toBeGreaterThan(-1);
    if (posHipoteses > -1) expect(posAviso).toBeLessThan(posHipoteses);
  });

  it('o selo lê red_flags_nao_explicadas — senão o 4º nível nunca acende', () => {
    // Montar o selo sem passar o segundo campo faria o nível crítico existir no código e nunca
    // aparecer na tela. Nível que nunca acende é pior que nível nenhum.
    expect(codigo('components/ia-clinica/PainelHipoteses.tsx')).toMatch(
      /redFlagsNaoExplicadas=\{grafo\.completude/,
    );
  });

  it('🔴 o rascunho salva SOZINHO — o DO-41 fala em sair sem querer', () => {
    // Botão manual não protege de sair sem querer, por definição.
    const t = codigo(COMPONENTE_REVISAO);
    expect(
      /setTimeout\([^)]*salvarRascunho|salvarRascunho\(\)[\s\S]{0,40}\d{3,}\)/.test(t),
      'o rascunho só salva no clique — quem sai sem querer não clicou (DO-41)',
    ).toBe(true);
  });

  it('o auto-save tem debounce, não salva por tecla', () => {
    // Cada salvamento INSERE uma linha. Salvar por tecla criaria centenas de versões e
    // transformaria o histórico que o DO-41 pede em ruído.
    const t = codigo(COMPONENTE_REVISAO);
    const m = t.match(/setTimeout\(\(\) => void salvarRascunho\(\), (\d+)\)/);
    expect(m, 'não há debounce no auto-save').toBeTruthy();
    expect(
      Number(m![1]),
      'o debounce é curto demais — viraria uma versão por tecla',
    ).toBeGreaterThanOrEqual(1000);
  });

  it('o botão manual continua existindo', () => {
    // Auto-save não substitui salvar de propósito: quem quer garantir antes de fechar precisa
    // de um lugar para clicar.
    expect(codigo(COMPONENTE_REVISAO)).toMatch(/onClick=\{salvarRascunho\}/);
  });
});

// ── varredura ──────────────────────────────────────────────────────────────────

function varrer(raizes: string[]): string[] {
  const saida: string[] = [];
  const anda = (rel: string) => {
    const abs = join(RAIZ, rel);
    if (!existsSync(abs)) return;
    for (const e of readdirSync(abs, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const filho = `${rel}/${e.name}`;
      if (e.isDirectory()) anda(filho);
      else if (/\.(ts|tsx)$/.test(e.name)) saida.push(filho);
    }
  };
  raizes.forEach(anda);
  return saida;
}
