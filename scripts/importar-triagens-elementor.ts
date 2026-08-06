/**
 * Script de Importação — Triagens do Elementor
 * =============================================
 * Lê todos os CSVs exportados do Elementor na pasta /elementor-submissions-export-2026-06-03
 * e importa as submissões como triagens na tabela `triagens` do banco de dados.
 *
 * Regras:
 * - Apenas registros com e-mail válido ou nome real são importados
 * - Duplicatas detectadas por (email + formulário_id + data_envio) são ignoradas
 * - Todos os campos do formulário são armazenados em `dados` (JSONB)
 * - Os campos nomeContato, emailContato e telefoneContato são extraídos e normalizados
 * - Status inicial = 'pendente'
 * - createdAt é preenchido com a data original do Elementor
 *
 * Uso: npx tsx --env-file=.env scripts/importar-triagens-elementor.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { createId } from '@paralleldrive/cuid2';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { triagens } from '../db/schema/triagens';
import { sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------------

const PASTA_CSVS = path.resolve(
  __dirname,
  '../elementor-submissions-export-2026-06-03',
);

// Campos de metadados do Elementor que aparecem no final de cada linha CSV
// Eles são identificados por posição negativa a partir do fim da linha.
const META_CAMPOS_DO_FIM = [
  'nome_formulario_id',
  'id_envio',
  'criado_em',
  'id_usuario',
  'agente_usuario',
  'ip_usuario',
  'referencia',
];

// ---------------------------------------------------------------------------
// Helpers de parsing CSV
// ---------------------------------------------------------------------------

/**
 * Parser CSV robusto que respeita campos entre aspas (inclusive com quebras
 * de linha e vírgulas dentro dos valores).
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      // aspas duplas escapadas dentro de campo
      current += '"';
      i++;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === ',' && !insideQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Faz parse completo de conteúdo CSV com suporte a campos multi-linha.
 * Retorna array de linhas, onde cada linha é um array de strings.
 */
function parseCsv(conteudo: string): string[][] {
  const linhas: string[][] = [];
  let campoAtual = '';
  let linhaAtual: string[] = [];
  let dentroDeAspas = false;

  for (let i = 0; i < conteudo.length; i++) {
    const char = conteudo[i];
    const nextChar = conteudo[i + 1];

    if (char === '"' && dentroDeAspas && nextChar === '"') {
      campoAtual += '"';
      i++;
    } else if (char === '"') {
      dentroDeAspas = !dentroDeAspas;
    } else if (char === ',' && !dentroDeAspas) {
      linhaAtual.push(campoAtual.trim());
      campoAtual = '';
    } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !dentroDeAspas) {
      if (char === '\r') i++; // pula \n do \r\n
      linhaAtual.push(campoAtual.trim());
      campoAtual = '';
      if (linhaAtual.some((c) => c !== '')) {
        linhas.push(linhaAtual);
      }
      linhaAtual = [];
    } else if (char === '\r' && !dentroDeAspas) {
      // \r solitário
      linhaAtual.push(campoAtual.trim());
      campoAtual = '';
      if (linhaAtual.some((c) => c !== '')) {
        linhas.push(linhaAtual);
      }
      linhaAtual = [];
    } else {
      campoAtual += char;
    }
  }

  // última linha
  if (campoAtual !== '' || linhaAtual.length > 0) {
    linhaAtual.push(campoAtual.trim());
    if (linhaAtual.some((c) => c !== '')) {
      linhas.push(linhaAtual);
    }
  }

  return linhas;
}

// ---------------------------------------------------------------------------
// Extração dos metadados do Elementor
// ---------------------------------------------------------------------------

interface MetaElementor {
  nomeFormulario: string;
  idEnvio: number;
  criadoEm: Date;
  idUsuario: string;
  agenteUsuario: string;
  ipUsuario: string;
  referencia: string;
}

/**
 * Localiza e extrai os campos de metadados do Elementor a partir dos últimos
 * 7 valores de uma linha de dados. Os meta-campos são sempre os últimos 7
 * independentemente de quantas colunas de formulário existam.
 */
function extrairMeta(valores: string[]): MetaElementor | null {
  const n = valores.length;
  if (n < 7) return null;

  const nomeFormulario = valores[n - 7];
  const idEnvioStr = valores[n - 6];
  const criadoEmStr = valores[n - 5];

  const idEnvio = parseInt(idEnvioStr, 10);
  if (isNaN(idEnvio)) return null;

  // Parseando data no formato "YYYY-MM-DD HH:MM:SS"
  const criadoEm = new Date(criadoEmStr.replace(' ', 'T') + '-03:00');
  if (isNaN(criadoEm.getTime())) return null;

  return {
    nomeFormulario,
    idEnvio,
    criadoEm,
    idUsuario: valores[n - 4],
    agenteUsuario: valores[n - 3],
    ipUsuario: valores[n - 2],
    referencia: valores[n - 1],
  };
}

// ---------------------------------------------------------------------------
// Detecção e limpeza de e-mail
// ---------------------------------------------------------------------------

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isEmailValido(email: string): boolean {
  return REGEX_EMAIL.test(email.trim());
}

function limparEmail(email: string): string {
  return email.trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Detecção de registros de teste
// ---------------------------------------------------------------------------

const PALAVRAS_TESTE = [
  'teste',
  'test',
  'aaaa',
  'bbbb',
  'xxxx',
  'asdf',
  'gagaga',
  'bla bla',
  'okokokok',
  'okok',
  'testesteste',
  'blabla',
];

function isRegistroDeTeste(nome: string, email: string, patologia: string): boolean {
  const campos = [nome, email, patologia].map((c) => c.toLowerCase());
  for (const campo of campos) {
    for (const palavra of PALAVRAS_TESTE) {
      if (campo.includes(palavra)) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Mapeamento de formulários para campos conhecidos
// ---------------------------------------------------------------------------

/**
 * Detecta qual campo corresponde ao nome do paciente, e-mail e telefone
 * com base no cabeçalho do CSV.
 */
function detectarCamposChave(cabecalhos: string[]): {
  nomeIdx: number | null;
  emailIdx: number | null;
  telefoneIdx: number | null;
} {
  const padroes = {
    nome: ['nome do paciente', 'nome completo', 'nome completo do paciente'],
    email: ['e-mail', 'email', 'e-mail:'],
    telefone: ['telefone', 'telefone para contato', 'telefone:'],
  };

  let nomeIdx: number | null = null;
  let emailIdx: number | null = null;
  let telefoneIdx: number | null = null;

  cabecalhos.forEach((cab, i) => {
    const c = cab.toLowerCase().trim();

    if (nomeIdx === null && padroes.nome.some((p) => c.includes(p))) {
      nomeIdx = i;
    }
    if (emailIdx === null && padroes.email.some((p) => c.includes(p))) {
      emailIdx = i;
    }
    if (telefoneIdx === null && padroes.telefone.some((p) => c.includes(p))) {
      telefoneIdx = i;
    }
  });

  return { nomeIdx, emailIdx, telefoneIdx };
}

// ---------------------------------------------------------------------------
// Função principal
// ---------------------------------------------------------------------------

async function importarTriagens() {
  // Conecta ao banco
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL não encontrada nas variáveis de ambiente.');
  }

  const client = neon(databaseUrl);
  const db = drizzle(client);

  console.log('\n🌿 Iniciando importação de triagens do Elementor...\n');

  // Lista todos os CSVs na pasta
  const arquivos = fs
    .readdirSync(PASTA_CSVS)
    .filter((f) => f.endsWith('.csv'))
    .sort();

  if (arquivos.length === 0) {
    console.error(`❌ Nenhum CSV encontrado em: ${PASTA_CSVS}`);
    process.exit(1);
  }

  console.log(`📂 ${arquivos.length} arquivo(s) CSV encontrado(s):\n`);
  arquivos.forEach((a) => console.log(`   • ${a}`));
  console.log();

  // Busca IDs de envio já importados para evitar duplicatas
  // Usamos uma combinação de id_envio + nome_formulario armazenada em dados->>'id_envio_elementor'
  const jaImportados = await db.execute(
    sql`SELECT dados->>'id_envio_elementor' AS chave FROM triagens WHERE dados->>'id_envio_elementor' IS NOT NULL`,
  );

  // O Drizzle/Neon retorna NeonHttpQueryResult — acessamos via cast para unknown primeiro
  const resultRaw = jaImportados as unknown;
  const linhasExistentes: Array<{ chave: string }> =
    Array.isArray(resultRaw)
      ? (resultRaw as Array<{ chave: string }>)
      : Array.isArray((resultRaw as { rows?: unknown[] }).rows)
        ? ((resultRaw as { rows: Array<{ chave: string }> }).rows)
        : [];

  const chavesExistentes = new Set<string>(
    linhasExistentes.map((r) => r.chave).filter(Boolean),
  );


  console.log(`🗄️  Triagens já existentes no banco: ${chavesExistentes.size}\n`);

  // Estatísticas
  let totalProcessados = 0;
  let totalImportados = 0;
  let totalIgnorados = 0;
  let totalDuplicatas = 0;
  let totalTeste = 0;

  const registrosParaInserir: (typeof triagens.$inferInsert)[] = [];

  // Processa cada arquivo CSV
  for (const arquivo of arquivos) {
    const caminhoArquivo = path.join(PASTA_CSVS, arquivo);
    console.log(`\n📄 Processando: ${arquivo}`);

    const conteudo = fs.readFileSync(caminhoArquivo, 'utf-8');
    const linhas = parseCsv(conteudo);

    if (linhas.length < 2) {
      console.log(`   ⚠️  Arquivo vazio ou apenas com cabeçalho — pulando.`);
      continue;
    }

    const cabecalhos = linhas[0];
    const dataLinhas = linhas.slice(1);
    const { nomeIdx, emailIdx, telefoneIdx } = detectarCamposChave(cabecalhos);

    console.log(
      `   📊 ${dataLinhas.length} registro(s) | ` +
        `nome[${nomeIdx ?? '?'}] email[${emailIdx ?? '?'}] tel[${telefoneIdx ?? '?'}]`,
    );

    // Número de colunas de formulário = total colunas - 7 metadados
    const numColunasMeta = 7;
    const numColunasFormulario = cabecalhos.length - numColunasMeta;

    for (const valores of dataLinhas) {
      totalProcessados++;

      // Extrai metadados do Elementor
      const meta = extrairMeta(valores);
      if (!meta) {
        totalIgnorados++;
        continue;
      }

      // Chave única para evitar duplicatas
      const chaveImportacao = `${meta.nomeFormulario}__${meta.idEnvio}`;

      if (chavesExistentes.has(chaveImportacao)) {
        totalDuplicatas++;
        continue;
      }

      // Extrai campos-chave
      const nome =
        nomeIdx !== null && nomeIdx < valores.length ? valores[nomeIdx] : '';
      const email =
        emailIdx !== null && emailIdx < valores.length ? valores[emailIdx] : '';
      const telefone =
        telefoneIdx !== null && telefoneIdx < valores.length
          ? valores[telefoneIdx]
          : '';

      // Valida e-mail mínimo
      const emailFinal = isEmailValido(email) ? limparEmail(email) : '';

      // Filtra registros de teste evidentes
      const patologia =
        cabecalhos.findIndex((h) =>
          h.toLowerCase().includes('patolog'),
        ) >= 0
          ? valores[
              cabecalhos.findIndex((h) => h.toLowerCase().includes('patolog'))
            ] ?? ''
          : '';

      if (isRegistroDeTeste(nome, emailFinal || email, patologia)) {
        totalTeste++;
        continue;
      }

      // Monta o objeto `dados` com todos os campos do formulário mapeados por nome de coluna
      const dadosFormulario: Record<string, string> = {};
      for (let i = 0; i < numColunasFormulario && i < valores.length; i++) {
        const chave = cabecalhos[i] || `campo_${i}`;
        if (chave && chave.startsWith('field_')) continue; // campos técnicos do elementor
        if (chave && chave !== '') {
          dadosFormulario[chave] = valores[i] || '';
        }
      }

      // Adiciona metadados de rastreabilidade
      dadosFormulario['_formulario'] = meta.nomeFormulario;
      dadosFormulario['_origem'] = 'elementor_import';
      dadosFormulario['id_envio_elementor'] = chaveImportacao;
      dadosFormulario['_ip_origem'] = meta.ipUsuario;
      dadosFormulario['_referencia'] = meta.referencia;

      // Monta registro para inserção
      registrosParaInserir.push({
        id: createId(),
        dados: dadosFormulario,
        nomeContato: nome || null,
        emailContato: emailFinal || null,
        telefoneContato: telefone || null,
        statusVisualizacao: 'pendente',
        medicoClerkId: null,
        createdAt: meta.criadoEm,
        updatedAt: meta.criadoEm,
      });

      // Registra a chave para evitar duplicatas internas no mesmo lote
      chavesExistentes.add(chaveImportacao);
      totalImportados++;
    }
  }

  // Insere em lotes de 50 para não sobrecarregar a conexão
  const TAMANHO_LOTE = 50;
  let loteAtual = 0;

  console.log(
    `\n🚀 Inserindo ${registrosParaInserir.length} triagem(ns) no banco...\n`,
  );

  for (let i = 0; i < registrosParaInserir.length; i += TAMANHO_LOTE) {
    const lote = registrosParaInserir.slice(i, i + TAMANHO_LOTE);
    await db.insert(triagens).values(lote);
    loteAtual++;
    const percentual = Math.round(
      ((i + lote.length) / registrosParaInserir.length) * 100,
    );
    process.stdout.write(
      `\r   Lote ${loteAtual} — ${i + lote.length}/${registrosParaInserir.length} (${percentual}%)`,
    );
  }

  // ---------------------------------------------------------------------------
  // Relatório final
  // ---------------------------------------------------------------------------

  console.log('\n\n' + '─'.repeat(55));
  console.log('✅ IMPORTAÇÃO CONCLUÍDA');
  console.log('─'.repeat(55));
  console.log(`📊 Total processados:    ${totalProcessados}`);
  console.log(`✅ Importados:           ${totalImportados}`);
  console.log(`🔁 Duplicatas ignoradas: ${totalDuplicatas}`);
  console.log(`🧪 Registros de teste:   ${totalTeste}`);
  console.log(`⚠️  Ignorados (inválidos): ${totalIgnorados}`);
  console.log('─'.repeat(55) + '\n');
}

// Executa
importarTriagens().catch((err) => {
  console.error('\n❌ Erro durante a importação:', err);
  process.exit(1);
});
