/**
 * Guarda: na cadeia da conduta, o sistema AVISA e o médico DECIDE.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * Duas decisões do dono, em 24/08/2026, fixaram quem aplica a norma na tela:
 *
 *   `DO-46`: "além de que isso é algo que o 'MÉDICO' preenche não o SISTEMA."
 *   `DO-47`: "isso é opcional com aviso, o médico quem deve seguir o procedimento correto,
 *             o sistema avisa."
 *
 * É a fronteira `IMD-01` (informar) x `IMD-02` (dirigir) do IMDRF N12:2014, e a proibição nº 2
 * do `CLAUDE.md`. Um refactor bem-intencionado que "melhore" a tela derivando o teor sozinha,
 * ou travando a escolha do médico, muda a CATEGORIA REGULATÓRIA do produto — e é o tipo de
 * mudança que ninguém percebe no code review, porque parece mais seguro.
 *
 * O QUE MAIS ESTE GUARDA COBRA (ADR-0012)
 * · o limiar de 0,2% mora numa constante ÚNICA — o mapa 7->4 da urgência já provou o custo de
 *   deixar número de regra espalhado por tela;
 * · teor ausente vira `indeterminado`, NUNCA a faixa permissiva;
 * · mg/dia é calculado e NUNCA vira coluna (ADR-0004 D-06);
 * · o caminho novo prova escopo de objeto e nunca sobrescreve o anterior (ADR-0012 D-01/D-05).
 *
 * ⚠️ ESTE GUARDA COBRE O CAMINHO NOVO, NÃO O CÓDIGO EXISTENTE. As 8 actions defeituosas estão
 * catalogadas em `docs/04-LISTA-DE-AFAZERES.md` Item 13 e NÃO são acusadas aqui — guarda que
 * acusa violação conhecida e não corrigida é guarda que alguém desliga
 * (`.claude/rules/seguranca-lgpd.md`).
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  LIMIAR_THC_PERCENTUAL,
  avisoDeReceituario,
  avisoDeTrocaDeFaixa,
  normalizarTeor,
  tipoDeReceituario,
} from '../../lib/conduta/receituario';
import { calcularDoseDiaria, formatarMg } from '../../lib/conduta/dose';

const RAIZ = join(import.meta.dirname, '..', '..');
const fonte = (a: string) => readFileSync(join(RAIZ, a), 'utf8');
const existe = (a: string) => existsSync(join(RAIZ, a));

/**
 * O CÓDIGO do arquivo, sem comentários.
 *
 * ⚠️ Três casos deste guarda já acusaram inocente por confundir MENÇÃO com USO: um comentário
 * que explica a norma, um `placeholder="Ex.: 0,2"`, e o cabeçalho que diz por que uma action
 * deixou de ser chamada. Toda checagem de AUSÊNCIA passa por aqui — proibir o código não pode
 * significar proibir a explicação, senão o guarda produz código sem comentário.
 */
const codigo = (a: string) =>
  fonte(a)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const ACTION_CONDUTA = 'app/(medico)/_actions/conduta.ts';
const SCHEMA_AJUSTES = 'db/schema/ajustes-dosagem.ts';
const SCHEMA_MEDICAMENTOS = 'db/schema/medicamentos.ts';
const TAB_DOSAGEM = 'app/(medico)/medico/pacientes/[id]/_components/tab-dosagem.tsx';

/** Funções exportadas da action, fatiadas — a unidade em que o defeito acontece. */
function funcoesDaAction(): Array<{ nome: string; corpo: string }> {
  if (!existe(ACTION_CONDUTA)) return [];
  const t = fonte(ACTION_CONDUTA);
  const marcas = [...t.matchAll(/export async function ([A-Za-z0-9_]+)/g)];
  return marcas.map((m, i) => ({
    nome: m[1],
    corpo: t.slice(m.index, marcas[i + 1]?.index ?? t.length),
  }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. O LIMIAR DO `CAN-04` MORA NUM LUGAR SÓ
// ═══════════════════════════════════════════════════════════════════════════════

describe('o limiar de 0,2% de THC tem um dono', () => {
  it('a constante existe e vale 0,2', () => {
    expect(LIMIAR_THC_PERCENTUAL).toBe(0.2);
  });

  /**
   * O defeito é COMPARAR contra 0,2 fora do módulo — não mencionar o número.
   *
   * ⚠️ A primeira versão procurava a menção e acusava dois inocentes: um comentário que explica
   * a norma e um `placeholder="Ex.: 0,2"`. Nenhum dos dois participa de decisão nenhuma.
   * Explicar a regra ao leitor e exemplificar o formato do campo são exatamente o que a tela
   * deve fazer; proibi-los empurraria a documentação para fora do código.
   */
  const COMPARACAO_COM_LIMIAR = /[<>]=?\s*0[.,]2\b|\b0[.,]2\s*[<>]=?|===?\s*0[.,]2\b/;

  it('nenhum arquivo fora de lib/conduta/ COMPARA THC contra 0,2 na mão', () => {
    // O mapa 7->4 da urgência (`DO-42`) é a prova do custo: número de regra escrito em duas
    // telas diverge na primeira mudança, e as duas continuam plausíveis.
    const suspeitos = varrer(['app', 'components', 'lib'])
      .filter((a) => !a.startsWith('lib/conduta/'))
      .filter((a) => {
        const t = fonte(a);
        if (!/thc|THC/.test(t)) return false;
        return COMPARACAO_COM_LIMIAR.test(t);
      });
    expect(
      suspeitos,
      'limiar de THC comparado à mão fora de lib/conduta/receituario.ts — importe LIMIAR_THC_PERCENTUAL',
    ).toEqual([]);
  });

  it('CONTROLE: comentário e placeholder que citam 0,2 continuam permitidos', () => {
    // Prova que a regra acima mira a comparação, não a menção. Sem este caso, alguém
    // "corrigiria" o guarda de volta para a versão que acusa documentação.
    expect(COMPARACAO_COM_LIMIAR.test('até 0,2% Receita de Controle Especial')).toBe(false);
    expect(COMPARACAO_COM_LIMIAR.test('placeholder="Ex.: 0,2"')).toBe(false);
    expect(COMPARACAO_COM_LIMIAR.test('teor > 0.2')).toBe(true);
    expect(COMPARACAO_COM_LIMIAR.test('teor <= 0,2')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. TEOR AUSENTE É `indeterminado`, NUNCA A FAIXA PERMISSIVA
// ═══════════════════════════════════════════════════════════════════════════════

describe('sem teor informado, a tela diz que não sabe', () => {
  const ausentes: Array<[string, unknown]> = [
    ['null', null],
    ['undefined', undefined],
    ['string vazia', ''],
    ['só espaço', '   '],
    ['texto não numérico', 'não informado'],
    ['NaN', Number.NaN],
    ['negativo', -1],
    ['string negativa', '-0.5'],
  ];

  it.each(ausentes)('teor %s não vira controle_especial', (_rotulo, valor) => {
    // Assumir a faixa permissiva quando não se sabe é afirmar um fato regulatório que não
    // temos — e ele decidiria QUAL receituário controlado usar.
    expect(tipoDeReceituario(valor as never)).toBe('indeterminado');
  });

  it.each(ausentes)('teor %s normaliza para null, não para 0', (_rotulo, valor) => {
    expect(normalizarTeor(valor as never)).toBeNull();
  });

  it('o aviso indeterminado não cita fundamento normativo', () => {
    // Citar norma para um estado em que não se sabe nada é citação vazia — e citação vazia
    // é pior que ausência, porque quem lê acredita.
    expect(avisoDeReceituario(null).fundamento).toBe('');
  });

  it('indeterminado não exige Notificação A nem a dispensa', () => {
    expect(avisoDeReceituario(null).exigeNotificacaoA).toBe(false);
    expect(avisoDeReceituario(null).rotulo).toMatch(/não informado/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. A FAIXA DO `CAN-04`, NOS DOIS LADOS DO LIMIAR
// ═══════════════════════════════════════════════════════════════════════════════

describe('o CAN-04 é aplicado no limiar certo', () => {
  const casos: Array<[unknown, string]> = [
    [0, 'controle_especial'],
    ['0', 'controle_especial'],
    [0.1, 'controle_especial'],
    [0.2, 'controle_especial'], // "menor OU IGUAL a 0,2%" — o limite pertence à faixa de baixo
    ['0,2', 'controle_especial'], // vírgula decimal, que é o que o médico brasileiro digita
    [0.21, 'notificacao_a'],
    [0.99, 'notificacao_a'],
    ['1.1', 'notificacao_a'],
    [9, 'notificacao_a'],
  ];

  it.each(casos)('teor %s -> %s', (teor, esperado) => {
    expect(tipoDeReceituario(teor as never)).toBe(esperado);
  });

  it('exatamente 0,2% NÃO exige Notificação A', () => {
    // `CAN-04`: "teor de THC menor ou igual a 0,2% deve ser utilizada a Receita de Controle
    // Especial". Errar o lado do limite é errar a norma inteira.
    expect(avisoDeReceituario(LIMIAR_THC_PERCENTUAL).exigeNotificacaoA).toBe(false);
  });

  it('logo acima do limiar exige Notificação A', () => {
    expect(avisoDeReceituario(LIMIAR_THC_PERCENTUAL + 0.01).exigeNotificacaoA).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. O AVISO É AVISO — NÃO É ORDEM (`DO-47`)
// ═══════════════════════════════════════════════════════════════════════════════

describe('a troca de faixa avisa, não impõe', () => {
  it('detecta a mudança de faixa', () => {
    const a = avisoDeTrocaDeFaixa(0.1, 0.9);
    expect(a.mudouDeFaixa).toBe(true);
    expect(a.de.tipo).toBe('controle_especial');
    expect(a.para.tipo).toBe('notificacao_a');
  });

  it('mesma faixa não gera ruído', () => {
    const a = avisoDeTrocaDeFaixa(0.1, 0.15);
    expect(a.mudouDeFaixa).toBe(false);
    expect(a.mensagem).toBe('');
  });

  it('teor faltando NÃO é tratado como troca de faixa', () => {
    // Afirmar que mudou quando não se sabe é inventar. A mensagem diz o que falta.
    const a = avisoDeTrocaDeFaixa(null, 0.9);
    expect(a.mudouDeFaixa).toBe(false);
    expect(a.mensagem).toMatch(/não é possível comparar/i);
  });

  it('a mensagem NÃO usa linguagem imperativa', () => {
    // `DO-47`: "o médico quem deve seguir o procedimento correto, o sistema avisa".
    const m = avisoDeTrocaDeFaixa(0.1, 0.9).mensagem.toLowerCase();
    const imperativos = [
      'obrigatório',
      'obrigatoria',
      'bloqueado',
      'não é permitido',
      'proibido',
      'você deve',
    ];
    const achados = imperativos.filter((p) => m.includes(p));
    expect(achados, `a mensagem impõe em vez de avisar: ${achados.join(', ')}`).toEqual([]);
  });

  it('a mensagem devolve a decisão ao médico, explicitamente', () => {
    expect(avisoDeTrocaDeFaixa(0.1, 0.9).mensagem).toMatch(/decisão sua/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. mg/dia É CALCULADO E NUNCA VIRA COLUNA (ADR-0004 D-06)
// ═══════════════════════════════════════════════════════════════════════════════

describe('mg/dia aparece na tela e não existe no banco', () => {
  /**
   * As tabelas DA CADEIA DA CONDUTA — derivadas, não listadas: são as que carregam
   * `gotasPorDia`. É exatamente nelas que o mg/dia teria como ser materializado, porque é lá
   * que estão os dois fatores do cálculo (`cbdMgPorGota × gotasPorDia`).
   *
   * ⚠️ O critério era `medicamentoId || gotasPorDia` na primeira versão, e acusava
   * `rastreio-uso-cannabis.ts` — que tem `medicamentoId` mas guarda mg/dia RELATADO pelo
   * paciente, não derivado. Ter a referência ao produto não faz a tabela ser da cadeia da
   * conduta; ter a dose diária faz.
   */
  function schemasDaCadeiaDaConduta(): string[] {
    return readdirSync(join(RAIZ, 'db/schema'))
      .filter((a) => a.endsWith('.ts'))
      .filter((a) => /gotasPorDia/.test(fonte(join('db/schema', a))));
  }

  it('o guarda enxerga as tabelas da cadeia', () => {
    // Vacuidade: se a varredura não achar nada, o caso abaixo fica verde por vazio.
    expect(schemasDaCadeiaDaConduta().length).toBeGreaterThanOrEqual(2);
  });

  it('nenhuma tabela da cadeia da conduta declara coluna de mg por dia', () => {
    const culpados = schemasDaCadeiaDaConduta().filter((a) =>
      /(mg_por_dia|mgPorDia|mg_dia|mgDia)/i.test(fonte(join('db/schema', a))),
    );
    expect(
      culpados,
      'mg/dia virou coluna — no dia em que cbdMgPorGota mudar, toda linha mente',
    ).toEqual([]);
  });

  it('CONTROLE: o mg/dia RELATADO do rastreio continua permitido', () => {
    // Falsa acusação coberta. `rastreioUsoCannabis.mgDiaEstimado` é o que o PACIENTE relatou
    // que já usava (Sprint 3, `DO-26`) — dado COLETADO, não derivado do catálogo. Persistir é
    // correto, e a primeira versão deste guarda o acusava. Guarda que acusa inocente é guarda
    // que alguém desliga (Regra 2 da técnica).
    expect(fonte('db/schema/rastreio-uso-cannabis.ts')).toMatch(/mgDiaEstimado/);
    expect(schemasDaCadeiaDaConduta()).not.toContain('rastreio-uso-cannabis.ts');
  });

  it('calcula a partir do mg/gota do catálogo', () => {
    const d = calcularDoseDiaria({ gotasPorDia: 10, cbdMgPorGota: '6.660', thcMgPorGota: '0.330' });
    expect(d.cbdMgPorDia).toBeCloseTo(66.6, 2);
    expect(d.thcMgPorDia).toBeCloseTo(3.3, 2);
  });

  it('mg/gota desconhecido devolve null, não zero', () => {
    // Zero afirmaria que o produto não tem o canabinóide — afirmação clínica que não temos.
    const d = calcularDoseDiaria({ gotasPorDia: 10, cbdMgPorGota: null, thcMgPorGota: undefined });
    expect(d.cbdMgPorDia).toBeNull();
    expect(d.thcMgPorDia).toBeNull();
  });

  it('formatar null não produz "0 mg"', () => {
    expect(formatarMg(null)).toBe('');
    expect(formatarMg(0)).toBe('0 mg');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. O CAMINHO NOVO NASCE CERTO (ADR-0012 D-01 e D-05)
// ═══════════════════════════════════════════════════════════════════════════════

describe('a action de conduta nasce com escopo de objeto e sem sobrescrita', () => {
  it('o guarda enxerga as funções que precisa proteger', () => {
    // Teste de vacuidade: sem isto, apagar a action deixaria todos os casos abaixo verdes.
    const f = funcoesDaAction();
    expect(
      existe(ACTION_CONDUTA),
      `${ACTION_CONDUTA} não existe — a Sprint 5 não foi implementada`,
    ).toBe(true);
    expect(
      f.length,
      'nenhuma action extraída — o parser quebrou ou o arquivo está vazio',
    ).toBeGreaterThanOrEqual(3);
  });

  it.each(['criarConduta', 'ajustarDose', 'listarTitulacaoDoPaciente'])('%s existe', (nome) => {
    expect(funcoesDaAction().map((f) => f.nome)).toContain(nome);
  });

  /**
   * A função consome `pacienteId` VINDO DO CLIENTE?
   *
   * Dois formatos, e os dois são o mesmo defeito: parâmetro direto, ou campo de um payload
   * validado por Zod. É a diferença entre "menciona pacienteId" e "confia num pacienteId que
   * alguém mandou" — e só a segunda é BOLA.
   */
  function recebePacienteIdDoCliente(corpo: string): boolean {
    if (/function\s+\w+\(\s*\n?\s*pacienteId\s*:/.test(corpo)) return true;
    if (/\b(d|dados|entrada|input|parsed\.data)\.pacienteId\b/.test(corpo)) return true;
    return false;
  }

  it('toda função com pacienteId do cliente prova escopo de objeto — SEM escape', () => {
    // Papel certo + id alheio é OWASP API1 (BOLA). `verificarMedicoOuAdmin` prova papel,
    // não vínculo — é exatamente o defeito das 8 actions existentes (04 Item 13.5).
    //
    // 🔴 ESTE CASO NÃO TEM ALTERNATIVA ACEITA, e o motivo está numa sabotagem: a primeira
    // versão absolvia quem mencionasse `medicoId` em qualquer lugar do corpo. A sabotagem que
    // trocou `garantirMedicoDoPaciente` por um objeto literal com `medicoId: "x"` passou
    // VERDE. Escape amplo em guarda de autorização é buraco, não flexibilidade.
    const semEscopo = funcoesDaAction()
      .filter((f) => recebePacienteIdDoCliente(f.corpo))
      .filter((f) => !/garantirMedicoDoPaciente\(/.test(f.corpo))
      .map((f) => f.nome);
    expect(
      semEscopo,
      `funções que confiam em pacienteId do cliente sem garantirMedicoDoPaciente: ${semEscopo.join(', ')}`,
    ).toEqual([]);
  });

  it('o guarda vê as funções que recebem pacienteId do cliente', () => {
    // Vacuidade: sem isto, um refactor que renomeie o payload deixaria o caso acima verde por
    // não achar ninguém para checar.
    const comId = funcoesDaAction().filter((f) => recebePacienteIdDoCliente(f.corpo));
    expect(
      comId.length,
      'nenhuma função com pacienteId do cliente — o detector quebrou',
    ).toBeGreaterThanOrEqual(3);
  });

  it('função de listagem sem id do cliente restringe por médico', () => {
    // O outro desenho legítimo: não há id a conferir, então a prova é o `where`.
    const listagens = funcoesDaAction()
      .filter((f) => !recebePacienteIdDoCliente(f.corpo))
      .filter((f) => /\bpacientes\b/.test(f.corpo))
      .filter((f) => !/medicoId|medicos\b/.test(f.corpo))
      .map((f) => f.nome);
    expect(listagens, `listagens sem restrição por médico: ${listagens.join(', ')}`).toEqual([]);
  });

  it('CONTROLE: a listagem geral prova vínculo pelo where, e o guarda aceita', () => {
    // Vacuidade ao contrário: se o caso acima passasse por não achar função nenhuma, este
    // nomearia o buraco.
    const geral = funcoesDaAction().find((f) => f.nome === 'listarTitulacaoGeral');
    expect(geral, 'listarTitulacaoGeral não existe').toBeTruthy();
    expect(geral!.corpo, 'a listagem geral não restringe por médico').toMatch(/medicos|medicoId/);
  });

  it('nenhuma função se contenta com verificarMedicoOuAdmin', () => {
    // É o helper que prova PAPEL e não vínculo — a assinatura do defeito das 8 actions antigas.
    expect(
      /verificarMedicoOuAdmin/.test(fonte(ACTION_CONDUTA)),
      'o caminho novo usou verificarMedicoOuAdmin, que prova papel e não vínculo (04 Item 13.5)',
    ).toBe(false);
  });

  it('importa o helper de lib/auth, não declara o seu', () => {
    // Terceira cópia do `garantirMedicoDoPaciente` divergiria na primeira correção (R-10).
    const t = fonte(ACTION_CONDUTA);
    expect(t).toMatch(/from '@\/lib\/auth\/escopo-paciente'/);
    expect(
      /(async )?function garantirMedicoDoPaciente/.test(t),
      'a action declarou a própria cópia do helper em vez de importar de lib/auth',
    ).toBe(false);
  });

  it('NUNCA faz update em gotasPorDia', () => {
    // R-03 da ADR-0005: apaga a curva de titulação. É o defeito que `atualizarDosagem` tem
    // hoje (04 Item 13.3) e que o caminho novo não repete.
    expect(
      /\.set\(\s*\{[^}]*gotasPorDia/.test(codigo(ACTION_CONDUTA)),
      'há update em gotasPorDia — o caminho novo repetiu o R-03',
    ).toBe(false);
  });

  it('NUNCA apaga fisicamente item de ajuste', () => {
    // `editarAjusteDosagem` faz `db.delete(itensAjusteDosagem)` hoje (04 Item 13.4).
    expect(
      /\.delete\(\s*(itensAjusteDosagem|ajustesDosagem|dosagens)/.test(codigo(ACTION_CONDUTA)),
      'há delete físico em tabela de histórico clínico — proibição nº 4 do CLAUDE.md',
    ).toBe(false);
  });

  it('a conduta grava medicamentoId, nunca só o nome', () => {
    // R-07: repetir o defeito do Item 4 (`prescricoes.medicamentos` sem FK) no caminho novo.
    const t = fonte(ACTION_CONDUTA);
    expect(t).toMatch(/medicamentoId/);
  });

  it('desativa a dosagem anterior ao criar a nova', () => {
    // Sem isso existem duas `ativa = true` e o alerta de recompra dispara duas vezes.
    const t = fonte(ACTION_CONDUTA);
    expect(t).toMatch(/ativa:\s*false/);
  });

  it('notifica o paciente a cada ajuste (`DO-44` b)', () => {
    const ajuste = funcoesDaAction().find((f) => f.nome === 'ajustarDose');
    expect(ajuste, 'ajustarDose não existe').toBeTruthy();
    expect(ajuste!.corpo).toMatch(/notificacoes/);
  });

  it('registra auditoria do que o sistema avisou e do que o médico decidiu', () => {
    // Proibição nº 2 do CLAUDE.md: grava QUEM decidiu, inclusive quando decide diferente.
    const t = fonte(ACTION_CONDUTA);
    expect(t).toMatch(/registrarAuditoria|logsAuditoria/);
    expect(t).toMatch(/tipoReceituario|avisoDeReceituario|tipoDeReceituario/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. AS DUAS CADEIAS ESTÃO LIGADAS, E A ANTIGA VIROU LEITURA (`DO-48`)
// ═══════════════════════════════════════════════════════════════════════════════

describe('a cadeia numérica e a textual se falam', () => {
  it.each(['medicamentoId', 'dosagemAnteriorId', 'novaDosagemId'])(
    'itensAjusteDosagem tem a coluna %s',
    (coluna) => {
      expect(fonte(SCHEMA_AJUSTES)).toMatch(new RegExp(coluna));
    },
  );

  it('as três colunas novas são NULLABLE', () => {
    // Linha antiga fica com os três nulos e continua válida — é o histórico legado que o
    // `DO-48` manda preservar. `notNull` aqui quebraria a migration contra dado existente.
    const t = fonte(SCHEMA_AJUSTES);
    for (const col of ['medicamento_id', 'dosagem_anterior_id', 'nova_dosagem_id']) {
      const linha = t.split('\n').find((l) => l.includes(col));
      expect(linha, `coluna ${col} não encontrada`).toBeTruthy();
      expect(linha!, `${col} não pode ser notNull — quebraria o histórico legado`).not.toMatch(
        /notNull/,
      );
    }
  });

  it('medicamentos tem a casa do teor de THC, e ela é nullable', () => {
    const t = fonte(SCHEMA_MEDICAMENTOS);
    expect(t).toMatch(/teorThcPercentual/);
    const linha = t.split('\n').find((l) => l.includes('teor_thc_percentual'));
    expect(linha!, 'o teor não pode ser notNull — o catálogo nasce vazio (DO-46)').not.toMatch(
      /notNull/,
    );
  });

  it('a tela antiga não CHAMA mais nenhuma action de mutação (`DO-48`)', () => {
    // ⚠️ O critério é CHAMADA ou IMPORT, não menção: o cabeçalho do arquivo cita as três pelo
    // nome para explicar por que deixaram de ser chamadas, e a primeira versão deste caso
    // acusava justamente essa explicação. Guarda que proíbe documentar é guarda que produz
    // código sem comentário.
    const t = fonte(TAB_DOSAGEM);
    const mutacoes = ['criarAjusteDosagem', 'editarAjusteDosagem', 'excluirAjusteDosagem'];
    const achadas = mutacoes.filter(
      (m) => new RegExp(`\\b${m}\\s*\\(`).test(t) || new RegExp(`import[^;]*\\b${m}\\b`).test(t),
    );
    expect(achadas, `a tela legada ainda aceita dado novo: ${achadas.join(', ')}`).toEqual([]);
  });

  it('CONTROLE: citar a action num comentário continua permitido', () => {
    // Vacuidade ao contrário do caso acima.
    const t = fonte(TAB_DOSAGEM);
    expect(t, 'o arquivo deixou de explicar por que as actions saíram').toMatch(
      /editarAjusteDosagem/,
    );
  });

  it('a tela antiga continua mostrando o histórico', () => {
    // Vacuidade ao contrário: esvaziar a tela passaria o caso acima e perderia o dado —
    // que é o rejeitado R-07 da ADR-0012.
    expect(fonte(TAB_DOSAGEM)).toMatch(/listarAjustesDosagem/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. A PONTE NÃO ALTERA O RECEITUÁRIO (ADR-0005 D-04)
// ═══════════════════════════════════════════════════════════════════════════════

describe('a conduta não toca no motor de receituário', () => {
  it('a action de conduta não importa lib/receituario', () => {
    // É ICP-Brasil em produção. A conduta PREENCHE e entrega; não reescreve.
    expect(fonte(ACTION_CONDUTA)).not.toMatch(/from '@\/lib\/receituario/);
  });

  it('a action de conduta não escreve em prescricoes.medicamentos', () => {
    // O JSONB alimenta PDF assinado e SNCR — é o Item 4, e está fora do escopo desta sprint.
    const t = fonte(ACTION_CONDUTA);
    expect(
      /\.insert\(\s*prescricoes|\.update\(\s*prescricoes/.test(t),
      'a conduta escreveu em prescricoes — o Item 4 está fora do escopo da Sprint 5',
    ).toBe(false);
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

// ═══════════════════════════════════════════════════════════════════════════════
// 9. A PONTE PREENCHE E ENTREGA — NUNCA REESCREVE (ADR-0005 D-04)
// ═══════════════════════════════════════════════════════════════════════════════

describe('a ponte para a prescrição', () => {
  const PONTE = 'lib/conduta/ponte-prescricao.ts';
  const TAB_PRESCRICOES = 'app/(medico)/medico/pacientes/[id]/_components/tab-prescricoes.tsx';

  it('o módulo da ponte é PURO — sem db, sem auth, sem next', () => {
    // Convenção de `lib/<dominio>/` do CLAUDE.md, e é o que permite testá-lo sem subir nada.
    const t = fonte(PONTE);
    for (const proibido of ['@/lib/db', 'next/', '@clerk', 'drizzle-orm']) {
      expect(t.includes(`from '${proibido}`), `a ponte importa ${proibido}`).toBe(false);
    }
  });

  it('o JSONB da ponte tem a MESMA forma que o fluxo existente já grava', () => {
    // `prescricao-inline.ts` grava { nome, dose, forma, posologia, quantidade }. Um formato novo
    // quebraria o PDF e a tela do paciente sem aviso.
    const t = fonte(PONTE);
    for (const campo of ['nome', 'dose', 'forma', 'posologia', 'quantidade']) {
      expect(t, `o campo ${campo} sumiu do JSONB da ponte`).toMatch(new RegExp(`\\b${campo}\\b`));
    }
  });

  it('a ponte NÃO grava o medicamentoId no JSONB de prescricoes', () => {
    // `prescricoes.medicamentos` é o Item 4 do checklist — produção, PDF assinado e SNCR.
    // O vínculo com o catálogo mora em `dosagens`, que é o caminho novo.
    expect(/medicamentoId/.test(codigo(PONTE)), 'a ponte mexeu na forma do JSONB do Item 4').toBe(
      false,
    );
  });

  it('quando o CAN-04 exige Notificação A, a ponte DENUNCIA em vez de fingir', () => {
    // `prescricaoTipoEnum` não tem `notificacao_a` (db/schema/enums.ts:107). Gravar
    // `controle_especial` calado faria existir um documento plausível com o tipo errado.
    const t = fonte(PONTE);
    expect(t).toMatch(/faltaTipoNoSistema/);
    expect(t).toMatch(/notificacao_a/);
  });

  it('o enum de tipo de prescrição continua sem notificacao_a — e o guarda sabe disso', () => {
    // Vacuidade dirigida: no dia em que o enum ganhar o valor (é o Item 13.6 do 04), este caso
    // fica VERMELHO nomeando que a ponte pode parar de contornar.
    const t = fonte('db/schema/enums.ts');
    const bloco = t.slice(t.indexOf('prescricaoTipoEnum'));
    const fim = bloco.indexOf(']);');
    expect(
      bloco.slice(0, fim).includes('notificacao_a'),
      'o enum ganhou notificacao_a — remova o contorno de `faltaTipoNoSistema` da ponte',
    ).toBe(false);
  });

  it('a emissão passa por confirmação humana, não por um clique', () => {
    // Proibição nº 2 do CLAUDE.md. O diálogo existe e é quem chama `criarPrescricao`.
    expect(fonte('components/conduta/PontePrescricao.tsx')).toMatch(/onConfirmar/);
    expect(
      /criarPrescricao/.test(codigo('components/conduta/PontePrescricao.tsx')),
      'o diálogo grava sozinho — a emissão deve partir de quem monta a tela, após confirmar',
    ).toBe(false);
  });

  it('a segunda superfície do DO-44 (b) existe e é somente leitura', () => {
    const t = fonte(TAB_PRESCRICOES);
    expect(t, 'a aba de prescrições não mostra os ajustes de dose').toMatch(
      /listarAjustesParaPrescricoes/,
    );
    expect(t, 'a segunda superfície não reusa o componente da curva').toMatch(/CurvaDeTitulacao/);
    expect(
      /\bajustarDose\s*\(/.test(t),
      'a aba de prescrições virou caminho de mutação de dose — ajustar acontece na conduta',
    ).toBe(false);
  });
});
