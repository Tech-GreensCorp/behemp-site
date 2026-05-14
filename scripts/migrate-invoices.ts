/**
 * Script de migração: WordPress Invoice Plugin → PostgreSQL (Drizzle ORM)
 *
 * Uso: npx tsx scripts/migrate-invoices.ts
 *
 * Importa as invoices reais do CSV exportado do WordPress
 * para o banco PostgreSQL do sistema Be4Hope.
 */

import fs from 'fs';
import path from 'path';

// Carregar .env manualmente (script roda fora do Next.js)
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

// Importações DB após env vars carregadas (usando dynamic import)
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import {
  invoices,
  invoiceExporters,
  invoiceManufacturers,
  invoicePatients,
  invoiceLegalInfo,
  invoiceProducts,
  invoiceTotals,
  invoicePaymentShipping,
  invoiceSignatures,
} from '../db/schema';

// ── Configuração ──────────────────────────────────────────────────

// IDs de invoice de teste que devem ser ignorados (dados fake do dev)
const INVOICES_DE_TESTE = new Set([34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44]);

const CSV_PATH = path.resolve(process.cwd(), 'invoice-for-medicals/i9871159_ynds1.csv');

// ── Parser CSV robusto ────────────────────────────────────────────

/**
 * Parseia uma linha CSV com suporte a campos entre aspas,
 * quebras de linha dentro de campos e escaping de aspas duplas.
 */
function parseCSVLines(content: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;

  while (i < content.length) {
    const char = content[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < content.length && content[i + 1] === '"') {
          // Aspas escapadas ("") → uma aspa literal
          currentField += '"';
          i += 2;
          continue;
        } else {
          // Fim do campo entre aspas
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        currentField += char;
        i++;
        continue;
      }
    }

    // Fora de aspas
    if (char === '"') {
      inQuotes = true;
      i++;
      continue;
    }

    if (char === ',') {
      currentRow.push(currentField);
      currentField = '';
      i++;
      continue;
    }

    if (char === '\r') {
      i++;
      continue;
    }

    if (char === '\n') {
      currentRow.push(currentField);
      currentField = '';
      rows.push(currentRow);
      currentRow = [];
      i++;
      continue;
    }

    currentField += char;
    i++;
  }

  // Última linha se não terminar com newline
  if (currentRow.length > 0 || currentField.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Extrai uma "tabela" do CSV grande baseado no header esperado.
 * O CSV contém múltiplas tabelas separadas por headers diferentes.
 */
function extrairTabela(allRows: string[][], headerFields: string[]): string[][] {
  const dataRows: string[][] = [];
  let capturando = false;

  for (const row of allRows) {
    // Verificar se esta row é o header que estamos procurando
    if (
      row.length >= headerFields.length &&
      headerFields.every((h, idx) => row[idx]?.trim() === h)
    ) {
      capturando = true;
      continue; // Pular a linha de header
    }

    // Se estamos capturando e encontramos outro header, parar
    if (capturando && row.length > 1 && row[0]?.trim() === 'id' && !headerFields.every((h, idx) => row[idx]?.trim() === h)) {
      capturando = false;
      continue;
    }

    if (capturando && row.length >= 2) {
      dataRows.push(row);
    }
  }

  return dataRows;
}

function limparValor(val: string | undefined): string {
  if (!val) return '';
  return val.trim().replace(/^NULL$/i, '');
}

function limparData(val: string | undefined): string | null {
  const v = limparValor(val);
  if (!v || v === '0000-00-00') return null;
  return v;
}

// ── Migração ──────────────────────────────────────────────────────

async function main() {
  console.log('🔄 Iniciando migração de invoices do WordPress...\n');

  // Criar conexão com o banco
  const sqlClient = neon(process.env.DATABASE_URL!);
  const db = drizzle({ client: sqlClient });

  // 1. Ler e parsear o CSV inteiro
  const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
  console.log(`📄 Arquivo CSV lido: ${(csvContent.length / 1024 / 1024).toFixed(1)} MB`);

  const allRows = parseCSVLines(csvContent);
  console.log(`📊 Total de linhas parseadas: ${allRows.length}\n`);

  // 2. Extrair cada tabela pelo header

  // Tabela principal: invoices (novo schema - 9 tabelas normalizadas)
  const invoicesData = extrairTabela(allRows, [
    'id', 'invoice_number', 'invoice_type', 'invoice_date', 'patient_name',
    'patient_address', 'patient_city', 'patient_state', 'patient_zip',
    'patient_cpf', 'patient_email', 'patient_phone', 'anvisa_authorization',
    'anvisa_validity', 'patient_ong_number', 'lawsuit_number', 'paying_source',
    'judicial_secrecy', 'payment_method', 'payment_deadline', 'incoterms',
    'shipping_method', 'estimated_delivery', 'subtotal', 'shipping_cost',
    'insurance_cost', 'total_usd', 'total_words', 'equivalent_brl',
    'signature_place', 'signature_date', 'status', 'pdf_file_path',
    'created_at', 'updated_at', 'created_by',
  ]);

  const exportersData = extrairTabela(allRows, [
    'id', 'invoice_id', 'company_name', 'address', 'city_state_zip_country',
    'tax_id', 'phone', 'email',
  ]);

  const manufacturersData = extrairTabela(allRows, [
    'id', 'invoice_id', 'company_name', 'address', 'city_zip_country',
    'tax_id', 'phone', 'email',
  ]);

  const patientsData = extrairTabela(allRows, [
    'id', 'invoice_id', 'patient_name', 'address', 'city_state_zip',
    'cpf', 'anvisa_authorization', 'anvisa_validity', 'email',
    'patient_number_ong', 'phone',
  ]);

  const legalInfoData = extrairTabela(allRows, [
    'id', 'invoice_id', 'lawsuit_number', 'paying_source', 'judicial_secrecy',
  ]);

  const paymentShippingData = extrairTabela(allRows, [
    'id', 'invoice_id', 'payment_method', 'payment_deadline', 'incoterms',
    'shipping_method', 'estimated_delivery',
  ]);

  const productsData = extrairTabela(allRows, [
    'id', 'invoice_id', 'item_order', 'description', 'ncm_code',
    'quantity', 'unit_price', 'total_price', 'item_number',
  ]);

  const signaturesData = extrairTabela(allRows, [
    'id', 'invoice_id', 'place', 'signature_date',
  ]);

  const totalsData = extrairTabela(allRows, [
    'id', 'invoice_id', 'subtotal', 'shipping', 'insurance',
    'total', 'total_words', 'equivalent_brl',
  ]);

  console.log('📋 Tabelas extraídas:');
  console.log(`   invoices:         ${invoicesData.length} linhas`);
  console.log(`   exporters:        ${exportersData.length} linhas`);
  console.log(`   manufacturers:    ${manufacturersData.length} linhas`);
  console.log(`   patients:         ${patientsData.length} linhas`);
  console.log(`   legal_info:       ${legalInfoData.length} linhas`);
  console.log(`   payment_shipping: ${paymentShippingData.length} linhas`);
  console.log(`   products:         ${productsData.length} linhas`);
  console.log(`   signatures:       ${signaturesData.length} linhas`);
  console.log(`   totals:           ${totalsData.length} linhas`);

  // 3. Filtrar invoices de teste e criar mapa de IDs
  const invoicesFiltradas = invoicesData.filter((row) => {
    const oldId = parseInt(row[0], 10);
    return !INVOICES_DE_TESTE.has(oldId);
  });

  console.log(`\n✅ Invoices reais para migrar: ${invoicesFiltradas.length}`);
  console.log(`❌ Invoices de teste ignoradas: ${invoicesData.length - invoicesFiltradas.length}`);

  // Mapa: oldInvoiceId → newCuid2Id
  const idMap = new Map<string, string>();

  // 4. Inserir invoices principais
  let successCount = 0;
  let errorCount = 0;

  for (const row of invoicesFiltradas) {
    const oldId = row[0];
    const invoiceNumber = limparValor(row[1]);
    const invoiceType = limparValor(row[2]) as 'donation' | 'judicialization' | 'collab' | 'retail';
    const invoiceDate = limparData(row[3]);
    const statusRaw = limparValor(row[31]);
    const createdAt = limparValor(row[33]);

    // Validar tipo
    const tiposValidos = ['donation', 'judicialization', 'collab', 'retail'];
    if (!tiposValidos.includes(invoiceType)) {
      console.warn(`⚠️  Invoice ${oldId}: tipo inválido "${invoiceType}", pulando...`);
      errorCount++;
      continue;
    }

    if (!invoiceDate) {
      console.warn(`⚠️  Invoice ${oldId}: data inválida, pulando...`);
      errorCount++;
      continue;
    }

    const status = (statusRaw === 'completed' ? 'completed' : 'draft') as 'draft' | 'completed';

    try {
      const [inserted] = await db
        .insert(invoices)
        .values({
          invoiceType,
          invoiceNumber: invoiceNumber || `MIGRATED-${oldId}`,
          invoiceDate,
          status,
          createdAt: createdAt ? new Date(createdAt) : new Date(),
          updatedAt: new Date(),
        })
        .returning({ id: invoices.id });

      idMap.set(oldId, inserted.id);
      successCount++;
    } catch (err) {
      console.error(`❌ Erro ao inserir invoice ${oldId}:`, err);
      errorCount++;
    }
  }

  console.log(`\n📥 Invoices inseridas: ${successCount} ✅ | ${errorCount} ❌`);

  // 5. Inserir exportadores
  let expCount = 0;
  for (const row of exportersData) {
    const oldInvoiceId = row[1];
    const newInvoiceId = idMap.get(oldInvoiceId);
    if (!newInvoiceId) continue;

    try {
      await db.insert(invoiceExporters).values({
        invoiceId: newInvoiceId,
        companyName: limparValor(row[2]) || 'N/A',
        address: limparValor(row[3]) || 'N/A',
        cityStateZipCountry: limparValor(row[4]) || 'N/A',
        taxId: limparValor(row[5]) || 'N/A',
        phone: limparValor(row[6]) || 'N/A',
        email: limparValor(row[7]) || 'N/A',
      });
      expCount++;
    } catch (err) {
      console.error(`❌ Erro exporter invoice ${oldInvoiceId}:`, err);
    }
  }
  console.log(`📥 Exportadores inseridos: ${expCount}`);

  // 6. Inserir fabricantes
  let manCount = 0;
  for (const row of manufacturersData) {
    const oldInvoiceId = row[1];
    const newInvoiceId = idMap.get(oldInvoiceId);
    if (!newInvoiceId) continue;

    try {
      await db.insert(invoiceManufacturers).values({
        invoiceId: newInvoiceId,
        companyName: limparValor(row[2]) || 'N/A',
        address: limparValor(row[3]) || 'N/A',
        cityZipCountry: limparValor(row[4]) || 'N/A',
        taxId: limparValor(row[5]) || 'N/A',
        phone: limparValor(row[6]) || 'N/A',
        email: limparValor(row[7]) || 'N/A',
      });
      manCount++;
    } catch (err) {
      console.error(`❌ Erro manufacturer invoice ${oldInvoiceId}:`, err);
    }
  }
  console.log(`📥 Fabricantes inseridos: ${manCount}`);

  // 7. Inserir pacientes
  let patCount = 0;
  for (const row of patientsData) {
    const oldInvoiceId = row[1];
    const newInvoiceId = idMap.get(oldInvoiceId);
    if (!newInvoiceId) continue;

    const anvisaValidity = limparData(row[7]);
    if (!anvisaValidity) continue; // Dados de teste sem validade real

    try {
      await db.insert(invoicePatients).values({
        invoiceId: newInvoiceId,
        patientName: limparValor(row[2]) || 'N/A',
        address: limparValor(row[3]) || 'N/A',
        cityStateZip: limparValor(row[4]) || 'N/A',
        cpf: limparValor(row[5]) || 'N/A',
        anvisaAuthorization: limparValor(row[6]) || 'N/A',
        anvisaValidity,
        email: limparValor(row[8]) || 'N/A',
        patientNumberOng: limparValor(row[9]) || null,
        phone: limparValor(row[10]) || null,
      });
      patCount++;
    } catch (err) {
      console.error(`❌ Erro patient invoice ${oldInvoiceId}:`, err);
    }
  }
  console.log(`📥 Pacientes inseridos: ${patCount}`);

  // 8. Inserir legal info
  let legCount = 0;
  for (const row of legalInfoData) {
    const oldInvoiceId = row[1];
    const newInvoiceId = idMap.get(oldInvoiceId);
    if (!newInvoiceId) continue;

    try {
      await db.insert(invoiceLegalInfo).values({
        invoiceId: newInvoiceId,
        lawsuitNumber: limparValor(row[2]) || null,
        payingSource: limparValor(row[3]) || null,
        judicialSecrecy: limparValor(row[4]) || null,
      });
      legCount++;
    } catch (err) {
      console.error(`❌ Erro legal info invoice ${oldInvoiceId}:`, err);
    }
  }
  console.log(`📥 Legal info inseridos: ${legCount}`);

  // 9. Inserir payment/shipping
  let payCount = 0;
  for (const row of paymentShippingData) {
    const oldInvoiceId = row[1];
    const newInvoiceId = idMap.get(oldInvoiceId);
    if (!newInvoiceId) continue;

    try {
      await db.insert(invoicePaymentShipping).values({
        invoiceId: newInvoiceId,
        paymentMethod: limparValor(row[2]) || null,
        paymentDeadline: limparData(row[3]) || null,
        incoterms: limparValor(row[4]) || null,
        shippingMethod: limparValor(row[5]) || null,
        estimatedDelivery: limparData(row[6]) || null,
      });
      payCount++;
    } catch (err) {
      console.error(`❌ Erro payment invoice ${oldInvoiceId}:`, err);
    }
  }
  console.log(`📥 Payment/Shipping inseridos: ${payCount}`);

  // 10. Inserir produtos
  let prodCount = 0;
  for (const row of productsData) {
    const oldInvoiceId = row[1];
    const newInvoiceId = idMap.get(oldInvoiceId);
    if (!newInvoiceId) continue;

    const description = limparValor(row[3]);
    if (!description || description.length <= 2) continue; // Dados de teste

    try {
      await db.insert(invoiceProducts).values({
        invoiceId: newInvoiceId,
        itemNumber: parseInt(row[8], 10) || 1,
        description,
        ncmCode: limparValor(row[4]) || '3004.90.99',
        quantity: limparValor(row[5]) || '1.00',
        unitPrice: limparValor(row[6]) || '0.00',
        totalPrice: limparValor(row[7]) || '0.00',
      });
      prodCount++;
    } catch (err) {
      console.error(`❌ Erro product invoice ${oldInvoiceId}:`, err);
    }
  }
  console.log(`📥 Produtos inseridos: ${prodCount}`);

  // 11. Inserir assinaturas
  let sigCount = 0;
  for (const row of signaturesData) {
    const oldInvoiceId = row[1];
    const newInvoiceId = idMap.get(oldInvoiceId);
    if (!newInvoiceId) continue;

    const place = limparValor(row[2]);
    const sigDate = limparData(row[3]);
    if (!place || place.length <= 2 || !sigDate) continue; // Dados de teste

    try {
      await db.insert(invoiceSignatures).values({
        invoiceId: newInvoiceId,
        place,
        signatureDate: sigDate,
      });
      sigCount++;
    } catch (err) {
      console.error(`❌ Erro signature invoice ${oldInvoiceId}:`, err);
    }
  }
  console.log(`📥 Assinaturas inseridas: ${sigCount}`);

  // 12. Inserir totais
  let totCount = 0;
  for (const row of totalsData) {
    const oldInvoiceId = row[1];
    const newInvoiceId = idMap.get(oldInvoiceId);
    if (!newInvoiceId) continue;

    try {
      await db.insert(invoiceTotals).values({
        invoiceId: newInvoiceId,
        subtotal: limparValor(row[2]) || '0.00',
        shipping: limparValor(row[3]) || '0.00',
        insurance: limparValor(row[4]) || '0.00',
        total: limparValor(row[5]) || '0.00',
        totalWords: limparValor(row[6]) || 'N/A',
        equivalentBrl: limparValor(row[7]) || '0.00',
      });
      totCount++;
    } catch (err) {
      console.error(`❌ Erro totals invoice ${oldInvoiceId}:`, err);
    }
  }
  console.log(`📥 Totais inseridos: ${totCount}`);

  // ── Resumo final ──────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════');
  console.log('✅ MIGRAÇÃO CONCLUÍDA!');
  console.log('═══════════════════════════════════════════════════');
  console.log(`📄 Invoices migradas:    ${successCount}`);
  console.log(`🏢 Exportadores:         ${expCount}`);
  console.log(`🏭 Fabricantes:          ${manCount}`);
  console.log(`👤 Pacientes:            ${patCount}`);
  console.log(`⚖️  Legal Info:           ${legCount}`);
  console.log(`💳 Payment/Shipping:     ${payCount}`);
  console.log(`📦 Produtos:             ${prodCount}`);
  console.log(`✍️  Assinaturas:          ${sigCount}`);
  console.log(`💰 Totais:               ${totCount}`);
  console.log('═══════════════════════════════════════════════════\n');

  process.exit(0);
}

main().catch((err) => {
  console.error('💥 Erro fatal na migração:', err);
  process.exit(1);
});
