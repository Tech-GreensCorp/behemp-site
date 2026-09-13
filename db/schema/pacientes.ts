import { pgTable, text, date, index, boolean } from 'drizzle-orm/pg-core';
import { baseColumns, softDeleteColumn } from './_helpers';
import { users } from './users';
import { medicos } from './medicos';
import {
  pacienteStatusEnum,
  tratamentoTipoEnum,
  jornadaFaseEnum,
  solicitacaoCadastroOrigemEnum,
} from './enums';

/**
 * Tabela de pacientes — dados clínicos e vínculo com médico responsável.
 * Soft delete habilitado para preservar histórico clínico (LGPD).
 */
export const pacientes = pgTable(
  'pacientes',
  {
    ...baseColumns,

    // ── Vínculo ──────────────────────────────────────
    userId: text('user_id')
      .notNull()
      .unique()
      .references(() => users.id),
    medicoId: text('medico_id').references(() => medicos.id),

    // ── Dados Pessoais ────────────────────────────────
    dataNascimento: date('data_nascimento'),
    cpf: text('cpf'),
    rg: text('rg'),
    genero: text('genero'), // Masculino | Feminino | Outro | Não informado

    // ── Endereço ─────────────────────────────────────
    cep: text('cep'),
    endereco: text('endereco'),
    cidade: text('cidade'),
    uf: text('uf'),

    // ── Dados Clínicos ────────────────────────────────
    peso: text('peso'),
    altura: text('altura'),
    historicoMedico: text('historico_medico'),
    /**
     * Declarado pelo próprio paciente no cadastro que vem do WhatsApp.
     *
     * ⚠️ TRÊS ESTADOS: `true`, `false` e **`null` (não informado)**. Quem se cadastrou
     * por outro caminho não respondeu esta pergunta, e afirmar `false` sobre essas
     * pessoas seria inventar uma resposta clínica que ninguém deu.
     *
     * ⚠️ É DECLARAÇÃO, NÃO DIAGNÓSTICO. A tela do médico rotula a origem — quem separa
     * o que o paciente disse do que foi verificado é a mesma regra que governa a IA
     * clínica aqui.
     */
    jaFazTratamentoCannabis: boolean('ja_faz_tratamento_cannabis'),
    /** O que ele descreveu sobre o tratamento atual. Dado sensível: nunca vai a log. */
    tratamentoAtualDescricao: text('tratamento_atual_descricao'),
    patologia: text('patologia'),

    // ── Dados da Associação ───────────────────────────
    atendimento: text('atendimento'),
    temAdvogado: text('tem_advogado'), // 'sim' | 'nao'
    nomeAdvogado: text('nome_advogado'),
    cid: text('cid'),
    categorizacao: text('categorizacao'),
    comoConheceu: text('como_conheceu'),
    dataAssociacao: date('data_associacao'),
    entradaPaciente: text('entrada_paciente'),
    etapa: text('etapa'),
    hospitalProximo: text('hospital_proximo'),
    homeCare: text('home_care'), // 'sim' | 'nao'
    planoSaude: text('plano_saude'),
    possuiPlanoSaude: text('possui_plano_saude'), // 'sim' | 'nao'
    rendaFamilia: text('renda_familia'),
    termoAssociado: text('termo_associado'),
    valorContribuicao: text('valor_contribuicao'),
    processoJudicializacao: text('processo_judicializacao'),

    // ── Responsável ───────────────────────────────────
    responsavelNome: text('responsavel_nome'),
    responsavelCpf: text('responsavel_cpf'),

    // ── Dados Complementares (para Procuração Específica) ─────────
    nacionalidade: text('nacionalidade').default('brasileiro(a)'),
    estadoCivil: text('estado_civil'), // solteiro(a) | casado(a) | divorciado(a) | viúvo(a) | outro
    profissao: text('profissao'),

    // ── Status e Jornada ─────────────────────────────
    status: pacienteStatusEnum('status').notNull().default('aguardando_consulta'),
    tratamentoTipo: tratamentoTipoEnum('tratamento_tipo'),
    jornadaFase: jornadaFaseEnum('jornada_fase').notNull().default('acolhimento'),

    /**
     * 🔴 DE ONDE ESTE PACIENTE VEIO — ADR-0022, D-08, e fecha o G5.
     *
     * A procedência nascia na solicitação, era usada durante o cadastro e **morria ali**.
     * Depois disso, um paciente vindo da Greens era indistinguível de quem se cadastrou
     * sozinho — e nenhuma tela sabia que havia documentos esperando por ele.
     *
     * ⚠️ `NULL` NÃO SIGNIFICA "ORIGEM DESCONHECIDA": significa **"ficha criada antes desta
     * coluna existir"**. O D-07 exige que esse caso saia pelo ramo `completo_legado` da
     * sentinela — conta antiga não é cadastro pela metade, e **não se bloqueia** (R9).
     *
     * Reusa o mesmo enum da solicitação, de propósito: dois vocabulários para a mesma coisa
     * é o defeito que a ADR-0022 §16 descreve, e que já custou caro aqui.
     */
    origem: solicitacaoCadastroOrigemEnum('origem'),

    /**
     * A solicitação que originou esta ficha, quando houve uma.
     *
     * ⚠️ SEM FOREIGN KEY, e é a mesma escolha de `solicitacoes_cadastro.paciente_id`: as duas
     * tabelas se apontam, e uma FK circular travaria a ordem de inserção. O G17 registra o
     * custo disso — ponteiro morto é possível —, e a sentinela trata `null` e "aponta para
     * nada" do mesmo jeito: como ausência.
     */
    solicitacaoId: text('solicitacao_id'),

    ...softDeleteColumn,
  },
  (table) => [
    index('pacientes_medico_idx').on(table.medicoId),
    index('pacientes_status_idx').on(table.status),
    index('pacientes_jornada_fase_idx').on(table.jornadaFase),
  ],
);
