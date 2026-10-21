/**
 * Rótulos e agrupamento dos campos de uma triagem, para o PDF da ficha completa.
 *
 * ⚠️ ESPELHA `LABEL_MAP`, `SECOES` e `CAMPOS_INTERNOS` de `app/(admin)/admin/triagens/page.tsx`
 * (o modal de detalhes). A tela é componente client de produção e não exporta essas
 * constantes; extraí-las exigiria refatorar um arquivo que não faz parte deste pedido. Puro de
 * propósito: sem `db`, sem `auth`, sem `next/*`.
 */

export const ROTULOS_DA_TRIAGEM: Record<string, string> = {
  // Chaves internas (formulário novo)
  nome_paciente: 'Nome completo do Paciente',
  cpf: 'CPF',
  data_nascimento: 'Data de nascimento',
  peso_altura: 'Peso e Altura',
  nome_responsavel: 'Nome do Responsável',
  cpf_responsavel: 'CPF do Responsável',
  email: 'E-mail',
  telefone: 'Telefone / WhatsApp',
  cep: 'CEP',
  estado: 'Estado',
  endereco: 'Endereço completo',
  como_chegou: 'Como chegou até nós',
  diagnostico_principal: 'Diagnóstico principal',
  nivel_tratamento: 'Nível de tratamento',
  historico_tratamentos: 'Histórico de tratamentos',
  medicamentos_atuais: 'Medicamentos atuais',
  relatorio_medico_nome: 'Relatório médico',
  total_residencia: 'Pessoas na residência',
  num_criancas: 'Crianças (0-17)',
  num_idosos: 'Idosos (60+)',
  num_deficiencia: 'Pessoas com deficiência',
  responsavel_financeiro: 'Responsável financeiro',
  responsavel_financeiro_quem: 'Quem é o responsável',
  renda_total: 'Renda mensal familiar',
  fontes_renda: 'Fontes de renda',
  situacao_trabalho: 'Situação de trabalho',
  profissao: 'Profissão',
  tempo_desempregado: 'Tempo desempregado',
  programas_sociais: 'Programas sociais',
  convenio_medico: 'Convênio médico',
  convenio_qual: 'Qual convênio',
  condicao_moradia: 'Condições de moradia',
  despesas_medicas: 'Despesas médicas mensais',
  // Chaves vindas dos CSVs Elementor (importação histórica)
  'Nome do paciente': 'Nome do Paciente',
  'Nome completo do Paciente:': 'Nome Completo',
  'CPF:': 'CPF',
  'Data de nascimento:': 'Data de Nascimento',
  'Peso e Altura do Paciente': 'Peso e Altura',
  'Nome Completo do Responsável:': 'Nome do Responsável',
  'CPF do Responsável:': 'CPF do Responsável',
  'E-mail': 'E-mail',
  'E-mail:': 'E-mail',
  'Telefone para contato com DDD': 'Telefone',
  'Telefone:': 'Telefone',
  'CEP:': 'CEP',
  'Endereço completo: ': 'Endereço',
  'Endereço completo': 'Endereço',
  'Estado:': 'Estado',
  'Cidade:': 'Cidade',
  'Como chegou até nós ?': 'Como nos encontrou',
  'Diagnóstico principal: ': 'Diagnóstico Principal',
  Patologia: 'Patologia / Diagnóstico',
  'Patologia do paciente': 'Patologia / Diagnóstico',
  'Tratamento:': 'Nível de Urgência',
  'Histórico de tratamentos anteriores:': 'Histórico de Tratamentos',
  'Medicamentos atuais:': 'Medicamentos Atuais',
  'Relatório médico ou prescrição:': 'Relatório / Prescrição',
  'Número total de pessoas na residência:': 'Pessoas na Residência',
  'Número de crianças (0-17anos)': 'Crianças (0-17)',
  'Número de idosos (60+ anos)': 'Idosos (60+)',
  'Número de pessoas com deficiência ': 'Pessoas c/ Deficiência',
  'Você é o principal responsavel financeiro ?': 'Responsável Financeiro',
  'Se não, quem seria ?': 'Quem é o Responsável',
  'Renda total mensal da família:': 'Renda Familiar',
  'Renda Familiar Bruta': 'Renda Familiar',
  'Principais fontes de renda familiar:': 'Fontes de Renda',
  'Sua situação atual de trabalho:': 'Situação de Trabalho',
  'Profissão:': 'Profissão',
  'Se desempregado, há quanto tempo ?': 'Tempo Desempregado',
  'Pariticipa de programas sociais ?': 'Programas Sociais',
  'Recebe algum benefício? ': 'Benefícios Sociais',
  'Possuí convênio médico?': 'Convênio Médico',
  'Possui plano de saúde? Se sim, qual?': 'Plano de Saúde',
  'Se sim, qual?': 'Qual Convênio',
  'Condições de Moradia': 'Condições de Moradia',
  'Despesas médicas mensais atuais': 'Despesas Médicas Mensais',
  'Você já possui receita médica para o canabidiol?': 'Possui Receita Médica',
  ' Se possui, pode nos encaminhar?': 'URL da Receita Médica',
  'Já fez uso de medicamentos derivados de Canabidiol ?': 'Já usou Canabidiol',
  'Se sim, de qual medicamento fez uso?': 'Qual Medicamento CBD',
  'Como conheceu a Behemp?': 'Como nos conheceu',
  'Nome do responsável': 'Nome do Responsável',
  'Grau de parentesco': 'Grau de Parentesco',
  'Peso em Kilos': 'Peso (kg)',
  'Altura em Cm': 'Altura (cm)',
  'Quantas pessoas residem na casa?': 'Pessoas na Residência',
  'Caso se sinta a vontade, nos conte um pouco sobre sua história pessoal e familiar':
    'História Pessoal e Familiar',
  'Relate o seu caso': 'Relato do Caso',
  CUPOM: 'Cupom',
  _formulario: 'Formulário de Origem',
  _origem: 'Origem dos Dados',
  _ip_origem: 'IP de Origem',
  _referencia: 'URL de Referência',
  id_envio_elementor: 'ID Elementor',
};

export interface SecaoDaTriagem {
  titulo: string;
  campos: string[];
}

export const SECOES_DA_TRIAGEM: SecaoDaTriagem[] = [
  {
    titulo: 'Dados pessoais',
    campos: [
      'nome_paciente',
      'cpf',
      'data_nascimento',
      'peso_altura',
      'nome_responsavel',
      'cpf_responsavel',
      'email',
      'telefone',
      'cep',
      'estado',
      'endereco',
      'como_chegou',
    ],
  },
  {
    titulo: 'Informações clínicas',
    campos: [
      'diagnostico_principal',
      'nivel_tratamento',
      'historico_tratamentos',
      'medicamentos_atuais',
      'relatorio_medico_nome',
    ],
  },
  {
    titulo: 'Composição familiar',
    campos: [
      'total_residencia',
      'num_criancas',
      'num_idosos',
      'num_deficiencia',
      'responsavel_financeiro',
      'responsavel_financeiro_quem',
    ],
  },
  {
    titulo: 'Situação financeira',
    campos: [
      'renda_total',
      'fontes_renda',
      'situacao_trabalho',
      'profissao',
      'tempo_desempregado',
      'programas_sociais',
    ],
  },
  {
    titulo: 'Moradia e saúde',
    campos: ['convenio_medico', 'convenio_qual', 'condicao_moradia', 'despesas_medicas'],
  },
];

/** Metadado técnico ou anexo em Base64: nunca entra no PDF (o arquivo não cabe nem deve ir). */
export const CAMPOS_INTERNOS_DA_TRIAGEM = new Set([
  '_formulario',
  '_origem',
  '_ip_origem',
  '_referencia',
  'id_envio_elementor',
  'relatorio_medico_arquivo',
]);

/** `''` quando o valor não diz nada (mesmo critério do modal: `undefined` e `on` são lixo do form). */
export function valorLegivelDaTriagem(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  const texto = (typeof valor === 'string' ? valor : JSON.stringify(valor)).trim();
  if (!texto || texto === 'undefined' || texto === 'on') return '';
  return texto;
}

export function rotuloDoCampo(campo: string): string {
  return ROTULOS_DA_TRIAGEM[campo] ?? campo.replace(/_/g, ' ');
}
