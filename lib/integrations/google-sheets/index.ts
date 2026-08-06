import { google } from 'googleapis';

/**
 * Integração com Google Sheets API v4 via Service Account.
 *
 * Variáveis de ambiente necessárias:
 * - GOOGLE_SERVICE_ACCOUNT_EMAIL
 * - GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
 * - GOOGLE_SHEETS_SPREADSHEET_ID
 * - GOOGLE_SHEETS_SHEET_NAME
 *
 * A inserção ocorre automaticamente ao submeter uma triagem.
 * Falhas não impactam o fluxo do usuário — são apenas logadas.
 */

// ── Tipos ──────────────────────────────────────────────────────

export interface DadosTriagemSheets {
  nomeContato: string | null;
  emailContato: string | null;
  telefoneContato: string | null;
  createdAt: Date;
  statusVisualizacao: string;
  dados: Record<string, unknown>;
}

// ── Cabeçalhos da planilha (ordem das colunas) ─────────────────

const CABECALHOS = [
  'Data de Envio',
  'Status',
  'Nome Completo',
  'CPF',
  'Data de Nascimento',
  'E-mail',
  'Telefone / WhatsApp',
  'CEP',
  'Estado',
  'Endereço',
  'Como chegou até nós',
  'Diagnóstico Principal',
  'Nível de Tratamento',
  'Histórico de Tratamentos',
  'Medicamentos Atuais',
  'Pessoas na Residência',
  'Crianças (0-17)',
  'Idosos (60+)',
  'Pessoas com Deficiência',
  'Responsável Financeiro',
  'Renda Mensal Familiar',
  'Fontes de Renda',
  'Situação de Trabalho',
  'Profissão',
  'Programas Sociais',
  'Convênio Médico',
  'Qual Convênio',
  'Condições de Moradia',
  'Despesas Médicas Mensais',
];

// ── Helper: criar cliente JWT (Service Account) ────────────────

function criarClienteJWT() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!email || !privateKey) {
    throw new Error(
      '[Sheets] GOOGLE_SERVICE_ACCOUNT_EMAIL e GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY são obrigatórias.',
    );
  }

  return new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

// ── Helper: obter configuração da planilha ─────────────────────

function obterConfigPlanilha() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const sheetName = process.env.GOOGLE_SHEETS_SHEET_NAME || 'Página1';

  if (!spreadsheetId) {
    throw new Error('[Sheets] GOOGLE_SHEETS_SPREADSHEET_ID não configurada.');
  }

  return { spreadsheetId, sheetName };
}

// ── Garantir cabeçalho ─────────────────────────────────────────

/**
 * Verifica se a primeira linha da planilha já tem cabeçalhos.
 * Se estiver vazia, insere a linha de cabeçalho automaticamente.
 */
async function garantirCabecalho(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  sheetName: string,
): Promise<void> {
  const resposta = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A1:A1`,
  });

  const primeiraLinha = resposta.data.values?.[0]?.[0];

  if (!primeiraLinha) {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [CABECALHOS] },
    });
  }
}

// ── Inserir linha de triagem ───────────────────────────────────

/**
 * Insere uma nova linha na planilha do Google Sheets com os dados da triagem.
 * Chamada automaticamente após salvar a triagem no banco.
 */
export async function inserirLinhaTriagem(triagem: DadosTriagemSheets): Promise<void> {
  const auth = criarClienteJWT();
  const sheets = google.sheets({ version: 'v4', auth });
  const { spreadsheetId, sheetName } = obterConfigPlanilha();
  const d = triagem.dados as Record<string, string>;

  // Garante cabeçalho se planilha estiver vazia
  await garantirCabecalho(sheets, spreadsheetId, sheetName);

  // Monta a linha na mesma ordem dos CABECALHOS
  const linha: string[] = [
    new Date(triagem.createdAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
    triagem.statusVisualizacao === 'pendente' ? 'Pendente' : 'Visualizada',
    triagem.nomeContato || d.nome_paciente || '',
    d.cpf || '',
    d.data_nascimento || '',
    triagem.emailContato || d.email || '',
    triagem.telefoneContato || d.telefone || '',
    d.cep || '',
    d.estado || '',
    d.endereco || '',
    d.como_chegou || '',
    d.diagnostico_principal || '',
    d.nivel_tratamento || '',
    d.historico_tratamentos || '',
    d.medicamentos_atuais || '',
    d.total_residencia || '',
    d.num_criancas || '',
    d.num_idosos || '',
    d.num_deficiencia || '',
    d.responsavel_financeiro || '',
    d.renda_total ? `R$ ${d.renda_total}`.replace('R$ R$', 'R$') : '',
    d.fontes_renda || '',
    d.situacao_trabalho || '',
    d.profissao || '',
    d.programas_sociais || '',
    d.convenio_medico || '',
    d.convenio_qual || '',
    d.condicao_moradia || '',
    d.despesas_medicas ? `R$ ${d.despesas_medicas}`.replace('R$ R$', 'R$') : '',
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [linha] },
  });

  console.log(`[Sheets] ✅ Triagem de "${triagem.nomeContato}" inserida na planilha.`);
}
