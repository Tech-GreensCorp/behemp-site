import { pgTable, text, integer, jsonb, timestamp, index } from 'drizzle-orm/pg-core';

import { baseColumns } from './_helpers';
import { medicos } from './medicos';
import { pacientes } from './pacientes';

/**
 * RASCUNHO DA REVISÃO — o trabalho a meio caminho, salvo no servidor.
 *
 * POR QUE ESTA TABELA EXISTE
 * `DO-41`: *"o médico pode sair sem querer e esse dado precisa ficar salvo, ou seja precisa ter
 * um historico assim como tem no vid-ai"*.
 *
 * 🛑 `localStorage` FOI REJEITADO COM MOTIVO (ADR-0011 D-03). Parece o caminho de três linhas e
 * não é:
 * 1. é **dado de saúde num navegador de consultório**, que pode ser compartilhado entre médicos;
 * 2. **não sobrevive a trocar de máquina** — que é exatamente o caso que o `DO-41` descreve.
 *
 * 🔴 POR QUE TABELA PRÓPRIA, E NÃO UMA LINHA `em_andamento` EM `revisoes_ia`
 * `revisoes_ia` é a **prova regulatória** de que houve ato humano — é ela que sustenta o
 * argumento de que o software **informa** em vez de **dirigir** (RDC 657/2022). Misturar
 * rascunho com decisão registrada enfraquece justamente esse argumento: uma auditoria que
 * encontre dez linhas por consulta precisa saber quais são decisão e quais são digitação a meio
 * caminho. Aqui a separação é estrutural, não convencional.
 *
 * 🔴 CADA SALVAMENTO É UMA LINHA NOVA (`versao` crescente). Não há `update`.
 * O `DO-41` pede *"histórico"*, e histórico que se sobrescreve não é histórico. É a mesma regra
 * de `medidasDesfecho` e de `ajustesDosagem`.
 */
export const rascunhosRevisaoIa = pgTable(
  'rascunhos_revisao_ia',
  {
    ...baseColumns,
    pacienteId: text('paciente_id')
      .notNull()
      .references(() => pacientes.id),
    /** Quem estava escrevendo. Rascunho de um médico não aparece para outro. */
    medicoId: text('medico_id')
      .notNull()
      .references(() => medicos.id),

    /** De onde veio a análise sendo revisada. Uma das duas, como em `revisoes_ia`. */
    anamneseId: text('anamnese_id'),
    teleconsultaId: text('teleconsulta_id'),

    /**
     * Cresce a cada salvamento. A versão mais alta é o rascunho atual; as anteriores são o
     * histórico que o `DO-41` pede.
     */
    versao: integer('versao').notNull().default(1),

    /**
     * O conteúdo do formulário como estava. JSONB porque o formulário evolui — e um rascunho de
     * hoje precisa continuar legível depois de a tela ganhar um campo.
     */
    conteudo: jsonb('conteudo').notNull(),

    /**
     * 🔴 PRAZO DE RETENÇÃO — **decisão do Jurídico, e por isso fica VAZIO**.
     *
     * `.claude/rules/seguranca-lgpd.md`: *"Se o prazo é decisão jurídica, o campo existe e fica
     * vazio — nunca se chuta o número."* Rascunho é dado de saúde: guardar para sempre é
     * retenção sem finalidade declarada.
     */
    retencaoAte: timestamp('retencao_ate', { withTimezone: true }),
  },
  (t) => [
    index('rascunhos_revisao_paciente_idx').on(t.pacienteId),
    index('rascunhos_revisao_medico_idx').on(t.medicoId),
  ],
);
