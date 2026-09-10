import { pgTable, text, timestamp, index, jsonb } from 'drizzle-orm/pg-core';

import { baseColumns, softDeleteColumn } from './_helpers';
import { anamneses } from './anamneses';
import { medicamentos } from './medicamentos';
import { medicos } from './medicos';
import { pacientes } from './pacientes';
import { teleconsultas } from './teleconsultas';
import { analiseStatusEnum, validacaoClinicaEnum } from './enums';

/**
 * REVISÃO HUMANA DA SAÍDA DA IA — a Trava 2.
 *
 * POR QUE ESTA TABELA EXISTE
 * `DO-29`: *"toda ação dela precisa de uma confirmação human in the looping"*. E a norma diz o
 * mesmo por outro caminho: *"A autonomia médica está diretamente relacionada à responsabilidade
 * pelo ato médico"* (CFM 2.314/2022 Art. 4º §2º, `CFM-04`) — quem responde é quem decide.
 *
 * 🔴 É ESTA TABELA QUE SUSTENTA O ARGUMENTO REGULATÓRIO
 * Software que **informa** um profissional, que então decide, é tratado de forma diferente de
 * software que **dirige** a conduta (ANVISA RDC 657/2022, `ANV-01`…`ANV-04`). Sem um registro do
 * ato humano, não há como demonstrar qual dos dois o sistema é. A linha aqui **é** a prova.
 *
 * 🔴 DIVERGÊNCIA É DADO, NÃO ERRO
 * `validacaoClinicaEnum` tem `divergente` com o mesmo status de `validado`. Registrar que o
 * médico discordou é o que permite medir a qualidade do modelo depois — e é o que distingue
 * apoio à decisão de automação com verniz de revisão. Um sistema que só guarda concordância não
 * está sendo revisado; está sendo obedecido.
 *
 * O que **não** entra aqui: a conduta em si. Prescrição vive em `prescricoes`, dose em
 * `dosagens`. Esta tabela registra **a decisão sobre a sugestão**, não o ato que dela decorre —
 * e é por isso que não há caminho de um clique entre uma coisa e a outra.
 */
export const revisoesIa = pgTable(
  'revisoes_ia',
  {
    ...baseColumns,
    pacienteId: text('paciente_id')
      .notNull()
      .references(() => pacientes.id),
    /** De onde veio a análise revisada. Uma das duas, nunca as duas. */
    anamneseId: text('anamnese_id').references(() => anamneses.id),
    teleconsultaId: text('teleconsulta_id').references(() => teleconsultas.id),

    /** Onde a análise está no ciclo humano. `aguardando_validacao` é o estado que importa. */
    status: analiseStatusEnum('status').notNull().default('aguardando_validacao'),

    /**
     * A versão do contrato que produziu a saída revisada. Sem isso, uma revisão de hoje não
     * pode ser lida amanhã: o formato do que foi revisado teria mudado sem rastro.
     */
    schemaVersion: text('schema_version'),
    /**
     * A saída da IA **como ela foi apresentada ao médico**, congelada.
     *
     * ⚠️ Guardar isto é o que torna a revisão auditável: sem o que estava na tela, não há como
     * saber a que o médico disse sim. É o mesmo raciocínio de `consentimentoVersaoTexto`.
     */
    saidaApresentada: jsonb('saida_apresentada'),

    // ── A decisão humana ────────────────────────────────────────────────────────
    /** Qual hipótese o médico acatou. Nulo quando divergiu de todas. */
    hipoteseAcatadaId: text('hipotese_acatada_id'),
    hipoteseAcatadaTitulo: text('hipotese_acatada_titulo'),

    validacao: validacaoClinicaEnum('validacao'),
    /**
     * O que o médico concluiu, nas palavras dele. **Obrigatório quando divergente** — validado
     * pela action, não pelo banco: divergência sem justificativa é ruído, e ruído não mede
     * qualidade de modelo nenhuma.
     */
    conclusaoMedico: text('conclusao_medico'),
    /** CID que o médico registrou, que pode não ser o sugerido. */
    cidMedico: text('cid_medico'),

    // ── O QUE A DIVERGÊNCIA ALIMENTA (`DO-40`, ADR-0011 D-01/D-02) ──────────────
    // > "a hipotese manual em divirjo ela tem que ter também a alimentação do rag ou seja
    // >  precisa de um texto explicando porque a ia errou (opcional) além de ter também o
    // >  medicamento na qual o médico vai prescrever"
    /**
     * Por que a IA errou, nas palavras do médico. **OPCIONAL** — foi assim que o dono pediu, e
     * a razão é boa: exigir explicação de quem está com pressa produz texto vazio, que polui o
     * corpus mais do que a ausência.
     */
    porQueIaErrou: text('por_que_ia_errou'),
    /**
     * O medicamento que o médico vai prescrever. **OBRIGATÓRIO quando divergente** — validado na
     * action, não no banco, como `conclusaoMedico`.
     *
     * É o que dá ao RAG o par completo: o que a IA sugeriu × o que o médico de fato escolheu.
     * Divergência sem o desfecho não ensina nada — diz que o modelo errou, não o que era certo.
     */
    medicamentoPrescritoNome: text('medicamento_prescrito_nome'),
    /** Quando veio do catálogo. Nulo para medicamento avulso — o nome acima é que é obrigatório. */
    medicamentoPrescritoId: text('medicamento_prescrito_id').references(() => medicamentos.id),

    /**
     * A camada do corpus a que este registro pertence, se algum dia for ingerido.
     *
     * O VidAI usa três limiares distintos de similaridade — 0,58 ciência · **0,65 respaldo do
     * médico** · 0,72 observação. Quanto mais próximo do julgamento humano, maior a exigência.
     * Marcar a camada aqui é o que permite aplicar o limiar certo depois.
     */
    fonteRag: text('fonte_rag').default('revisao_humana'),
    /**
     * 🔴 QUANDO ESTE REGISTRO FOI DE FATO INGERIDO NO CORPUS. **Fica NULO.**
     *
     * `GAP-16` está aberto: o dado foi coletado para tratar aquele paciente; usá-lo para melhorar
     * o modelo é **finalidade nova** (LGPD art. 7º e art. 11 para dado de saúde), e a base legal
     * é decisão do Jurídico.
     *
     * A coluna existe agora, e vazia, de propósito: construir os campos **não** é ingerir, e o
     * `GAP-16` bloqueia só a segunda coisa (ADR-0011 D-02). O guarda impede que alguém preencha
     * isto antes da resposta.
     */
    ingeridoNoCorpusEm: timestamp('ingerido_no_corpus_em', { withTimezone: true }),

    revisadoEm: timestamp('revisado_em', { withTimezone: true }),
    revisadoPor: text('revisado_por').references(() => medicos.id),
    ...softDeleteColumn,
  },
  (t) => [
    index('revisoes_ia_paciente_idx').on(t.pacienteId),
    index('revisoes_ia_status_idx').on(t.status),
    index('revisoes_ia_anamnese_idx').on(t.anamneseId),
    index('revisoes_ia_teleconsulta_idx').on(t.teleconsultaId),
  ],
);
