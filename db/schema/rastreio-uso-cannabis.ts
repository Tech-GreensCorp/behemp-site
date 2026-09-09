import { pgTable, text, date, boolean, index, numeric } from 'drizzle-orm/pg-core';

import { baseColumns, softDeleteColumn } from './_helpers';
import { anamneses } from './anamneses';
import { medicos } from './medicos';
import { pacientes } from './pacientes';
import { medicamentos } from './medicamentos';
import {
  situacaoUsoCannabisEnum,
  viaAdministracaoEnum,
  origemProdutoEnum,
  respostaPercebidaEnum,
  adesaoRelatadaEnum,
} from './enums';

/**
 * RASTREIO DO USO DE CANNABIS — substitui o boolean `anamneses.usoPrevioCannabis`.
 *
 * POR QUE ESTA TABELA EXISTE
 * Decisão do dono em 20/08/2026 (`DO-26`): *"além de perguntas clínicas padrão tem que ter o
 * rastreio do uso do remédio"*. O que existia era `usoPrevioCannabis: boolean` — sim/não. O
 * paciente de canabidiol frequentemente chega **já usando algo** (importado, artesanal, por conta
 * própria), e um "sim" sem produto, dose, tempo nem resposta não dá ao médico de onde partir para
 * titular.
 *
 * 🔴 O PRIMEIRO USO É CAMINHO DE PRIMEIRA CLASSE (`DO-27`)
 * *"nem todo paciente que chegar já usa medicação, temos que nos preparar para esses que são o
 * primeiro uso, ainda mais se o paciente está vindo para fazer a consulta médica para conseguir o
 * remédio"* — o dono.
 *
 * Por isso `situacao` é **enum, não boolean**: `primeiro_uso` é um estado declarado, distinto de
 * "não informado". Um boolean não distingue "nunca usou" de "ninguém perguntou" — e a diferença
 * entre as duas muda a conversa da consulta.
 *
 * 🔴 O QUE ESTA TABELA **NÃO** É
 * Não é a prescrição. O que a plataforma prescreve vive em `dosagens` + `ajustesDosagem`, que já
 * modelam bem (gotas/dia, dosagem anterior → nova, via, próxima revisão). Aqui fica o que vem
 * **de fora** ou **antes**, mais a **adesão** — que é o que o paciente de fato tomou, e que
 * `dosagens` não guarda nem deveria: sobrescrever o prescrito apagaria a base de comparação da
 * titulação.
 *
 * Preenchido pelo **médico**, na consulta (`DO-14`: a anamnese é preenchida só pelo médico).
 */
export const rastreioUsoCannabis = pgTable(
  'rastreio_uso_cannabis',
  {
    ...baseColumns,
    pacienteId: text('paciente_id')
      .notNull()
      .references(() => pacientes.id),
    /** O rastreio pertence a uma anamnese: é uma foto do momento, e se repete no retorno. */
    anamneseId: text('anamnese_id').references(() => anamneses.id),

    /** 🔴 O eixo que ramifica a tela. Ver `DO-27`. */
    situacao: situacaoUsoCannabisEnum('situacao').notNull(),

    // ── Só quando `situacao` ≠ 'primeiro_uso' ───────────────────────────────────
    /**
     * O produto, como o paciente o descreve. **Texto livre de propósito**: pode ser artesanal,
     * importado sem rótulo, ou um nome comercial que não existe no catálogo. Exigir referência a
     * `medicamentos` perderia justamente o caso que este rastreio existe para capturar.
     */
    produtoDescrito: text('produto_descrito'),
    /** Quando o produto **é** do catálogo, a referência entra aqui — e aí a conversão para mg
     *  usa `medicamentos.cbdMgPorGota`, em vez de depender do que o paciente lembra. */
    medicamentoId: text('medicamento_id').references(() => medicamentos.id),
    /** Proporção CBD:THC como informada — ex. "20:1". Texto: vem do rótulo, quando há rótulo. */
    proporcaoCbdThc: text('proporcao_cbd_thc'),
    /** Dose diária como o paciente relata, na unidade que ele usa. */
    doseRelatada: text('dose_relatada'),
    /** Quando dá para converter, o mg/dia estimado. Nulo quando não dá — melhor vazio que
     *  chutado, porque este número entra na decisão de titulação. */
    mgDiaEstimado: numeric('mg_dia_estimado', { precision: 8, scale: 2 }),
    viaAdministracao: viaAdministracaoEnum('via_administracao'),
    origem: origemProdutoEnum('origem'),
    /** Desde quando usa. Data, não texto: permite calcular tempo de uso. */
    usoDesde: date('uso_desde'),

    respostaPercebida: respostaPercebidaEnum('resposta_percebida'),
    /** O que o paciente atribui ao medicamento como efeito indesejado. Relato, não diagnóstico. */
    efeitoAdversoRelatado: text('efeito_adverso_relatado'),

    /**
     * ADESÃO — o que o paciente **de fato tomou**, contra o que foi prescrito.
     *
     * Fica aqui e não em `dosagens` de propósito: `dosagens` guarda o **prescrito**, e é ele que
     * a titulação compara. Se o mesmo campo guardasse os dois, o ajuste de dose seria calculado
     * sobre um número que talvez nunca tenha acontecido.
     */
    adesao: adesaoRelatadaEnum('adesao'),
    /** Por que deixou de tomar, quando deixou. É o que distingue custo de efeito adverso de
     *  esquecimento — e cada um pede conduta diferente. */
    motivoNaoAdesao: text('motivo_nao_adesao'),

    // ── Só quando `situacao` = 'primeiro_uso' (DO-27) ───────────────────────────
    /** O que o paciente espera do tratamento. Ancora a conversa de titulação e a expectativa. */
    expectativa: text('expectativa'),
    /** O que o preocupa em começar. Medo de "ficar chapado", estigma, custo, interação. Registrar
     *  é o que permite endereçar — e é o que faz o paciente aderir depois. */
    receio: text('receio'),

    /** Uso recreativo concomitante. ⚠️ Dado sensível e delicado: nullable, nunca obrigatório, e
     *  a tela não pressiona. Registrado porque muda interpretação de efeito e de dose. */
    usoRecreativoConcomitante: boolean('uso_recreativo_concomitante'),

    observacao: text('observacao'),
    registradoPor: text('registrado_por')
      .notNull()
      .references(() => medicos.id),
    ...softDeleteColumn,
  },
  (t) => [
    index('rastreio_uso_paciente_idx').on(t.pacienteId),
    index('rastreio_uso_anamnese_idx').on(t.anamneseId),
    index('rastreio_uso_situacao_idx').on(t.situacao),
  ],
);
