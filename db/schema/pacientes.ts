import { pgTable, text, date, index } from 'drizzle-orm/pg-core';
import { baseColumns, softDeleteColumn } from './_helpers';
import { users } from './users';
import { medicos } from './medicos';
import { pacienteStatusEnum, tratamentoTipoEnum, jornadaFaseEnum } from './enums';

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
    genero: text('genero'),        // Masculino | Feminino | Outro | Não informado

    // ── Endereço ─────────────────────────────────────
    cep: text('cep'),
    endereco: text('endereco'),
    cidade: text('cidade'),
    uf: text('uf'),

    // ── Dados Clínicos ────────────────────────────────
    peso: text('peso'),
    altura: text('altura'),
    historicoMedico: text('historico_medico'),
    patologia: text('patologia'),

    // ── Dados da Associação ───────────────────────────
    atendimento: text('atendimento'),
    temAdvogado: text('tem_advogado'),   // 'sim' | 'nao'
    nomeAdvogado: text('nome_advogado'),
    cid: text('cid'),
    categorizacao: text('categorizacao'),
    comoConheceu: text('como_conheceu'),
    dataAssociacao: date('data_associacao'),
    entradaPaciente: text('entrada_paciente'),
    etapa: text('etapa'),
    hospitalProximo: text('hospital_proximo'),
    homeCare: text('home_care'),         // 'sim' | 'nao'
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

    ...softDeleteColumn,
  },
  (table) => [
    index('pacientes_medico_idx').on(table.medicoId),
    index('pacientes_status_idx').on(table.status),
    index('pacientes_jornada_fase_idx').on(table.jornadaFase),
  ],
);
