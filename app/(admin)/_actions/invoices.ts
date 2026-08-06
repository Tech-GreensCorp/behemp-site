'use server';

import { db } from '@/lib/db';
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
} from '@/db/schema';
import { eq, desc, sql, and } from 'drizzle-orm';
import { verificarAdmin } from '@/lib/auth';

/**
 * Server Actions para gerenciamento de invoices médicas.
 * Somente role admin pode acessar.
 */

interface ActionResult<T = unknown> {
  sucesso: boolean;
  dados?: T;
  erro?: string;
}

// ── Tipos ──────────────────────────────────────────────────────

export interface InvoiceProduct {
  description: string;
  ncmCode: string;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
}

export interface InvoiceFormData {
  invoiceId?: string;
  invoiceType: 'donation' | 'judicialization' | 'collab' | 'retail';
  invoiceNumber: string;
  invoiceDate: string;
  status: 'draft' | 'completed';
  pacienteId?: string;

  // Exportador
  exporterCompanyName: string;
  exporterAddress: string;
  exporterCityStateZipCountry: string;
  exporterTaxId: string;
  exporterPhone: string;
  exporterEmail: string;

  // Fabricante
  manufacturerCompanyName: string;
  manufacturerAddress: string;
  manufacturerCityZipCountry: string;
  manufacturerTaxId: string;
  manufacturerPhone: string;
  manufacturerEmail: string;

  // Paciente
  patientName: string;
  patientAddress: string;
  patientCityStateZip: string;
  patientCpf: string;
  patientAnvisaAuthorization: string;
  patientAnvisaValidity: string;
  patientEmail: string;
  patientNumberOng?: string; // donation
  patientPhone?: string; // judicialization

  // Jurídico (judicialization)
  lawsuitNumber?: string;
  payingSource?: string;
  judicialSecrecy?: string;

  // Produtos
  products: InvoiceProduct[];

  // Totais
  subtotal: string;
  shipping: string;
  insurance: string;
  total: string;
  totalWords: string;
  equivalentBrl: string;

  // Pagamento e envio (judicialization)
  paymentMethod?: string;
  paymentDeadline?: string;
  incoterms?: string;
  shippingMethod?: string;
  estimatedDelivery?: string;

  // Assinatura
  signaturePlace: string;
  signatureDate: string;
}

export interface InvoiceListItem {
  id: string;
  invoiceType: string;
  invoiceNumber: string;
  invoiceDate: string;
  status: string;
  createdAt: Date;
  patientName?: string;
}

export interface InvoiceCompleta {
  id: string;
  invoiceType: string;
  invoiceNumber: string;
  invoiceDate: string;
  status: string;
  pacienteId: string | null;
  createdAt: Date;
  updatedAt: Date;
  exporter: {
    companyName: string;
    address: string;
    cityStateZipCountry: string;
    taxId: string;
    phone: string;
    email: string;
  } | null;
  manufacturer: {
    companyName: string;
    address: string;
    cityZipCountry: string;
    taxId: string;
    phone: string;
    email: string;
  } | null;
  patient: {
    patientName: string;
    address: string;
    cityStateZip: string;
    cpf: string;
    anvisaAuthorization: string;
    anvisaValidity: string;
    email: string;
    patientNumberOng: string | null;
    phone: string | null;
  } | null;
  legalInfo: {
    lawsuitNumber: string | null;
    payingSource: string | null;
    judicialSecrecy: string | null;
  } | null;
  products: {
    itemNumber: number;
    description: string;
    ncmCode: string;
    quantity: string;
    unitPrice: string;
    totalPrice: string;
  }[];
  totals: {
    subtotal: string;
    shipping: string;
    insurance: string;
    total: string;
    totalWords: string;
    equivalentBrl: string;
  } | null;
  paymentShipping: {
    paymentMethod: string | null;
    paymentDeadline: string | null;
    incoterms: string | null;
    shippingMethod: string | null;
    estimatedDelivery: string | null;
  } | null;
  signature: {
    place: string;
    signatureDate: string;
  } | null;
}

// ── Criar Invoice ──────────────────────────────────────────────

export async function criarInvoice(
  data: InvoiceFormData,
): Promise<ActionResult<{ invoiceId: string }>> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    // 1. Criar invoice principal
    const [invoice] = await db
      .insert(invoices)
      .values({
        invoiceType: data.invoiceType,
        invoiceNumber: data.invoiceNumber,
        invoiceDate: data.invoiceDate,
        status: data.status,
        pacienteId: data.pacienteId || null,
      })
      .returning({ id: invoices.id });

    const invoiceId = invoice.id;

    // 2. Salvar exportador
    await db.insert(invoiceExporters).values({
      invoiceId,
      companyName: data.exporterCompanyName,
      address: data.exporterAddress,
      cityStateZipCountry: data.exporterCityStateZipCountry,
      taxId: data.exporterTaxId,
      phone: data.exporterPhone,
      email: data.exporterEmail,
    });

    // 3. Salvar fabricante
    await db.insert(invoiceManufacturers).values({
      invoiceId,
      companyName: data.manufacturerCompanyName,
      address: data.manufacturerAddress,
      cityZipCountry: data.manufacturerCityZipCountry,
      taxId: data.manufacturerTaxId,
      phone: data.manufacturerPhone,
      email: data.manufacturerEmail,
    });

    // 4. Salvar paciente
    await db.insert(invoicePatients).values({
      invoiceId,
      patientName: data.patientName,
      address: data.patientAddress,
      cityStateZip: data.patientCityStateZip,
      cpf: data.patientCpf,
      anvisaAuthorization: data.patientAnvisaAuthorization,
      anvisaValidity: data.patientAnvisaValidity,
      email: data.patientEmail,
      patientNumberOng: data.patientNumberOng || null,
      phone: data.patientPhone || null,
    });

    // 5. Salvar legal info (judicialization only)
    if (data.invoiceType === 'judicialization') {
      await db.insert(invoiceLegalInfo).values({
        invoiceId,
        lawsuitNumber: data.lawsuitNumber || null,
        payingSource: data.payingSource || null,
        judicialSecrecy: data.judicialSecrecy || null,
      });

      // Pagamento e envio
      await db.insert(invoicePaymentShipping).values({
        invoiceId,
        paymentMethod: data.paymentMethod || null,
        paymentDeadline: data.paymentDeadline || null,
        incoterms: data.incoterms || null,
        shippingMethod: data.shippingMethod || null,
        estimatedDelivery: data.estimatedDelivery || null,
      });
    }

    // 6. Salvar produtos
    if (data.products.length > 0) {
      await db.insert(invoiceProducts).values(
        data.products.map((p, index) => ({
          invoiceId,
          itemNumber: index + 1,
          description: p.description,
          ncmCode: p.ncmCode,
          quantity: p.quantity,
          unitPrice: p.unitPrice,
          totalPrice: p.totalPrice,
        })),
      );
    }

    // 7. Salvar totais
    await db.insert(invoiceTotals).values({
      invoiceId,
      subtotal: data.subtotal,
      shipping: data.shipping,
      insurance: data.insurance,
      total: data.total,
      totalWords: data.totalWords,
      equivalentBrl: data.equivalentBrl,
    });

    // 8. Salvar assinatura
    await db.insert(invoiceSignatures).values({
      invoiceId,
      place: data.signaturePlace,
      signatureDate: data.signatureDate,
    });

    return { sucesso: true, dados: { invoiceId } };
  } catch (error) {
    console.error('[Invoice] Erro ao criar invoice:', error);
    return { sucesso: false, erro: 'Erro ao criar invoice' };
  }
}

// ── Atualizar Invoice ──────────────────────────────────────────

export async function atualizarInvoice(
  invoiceId: string,
  data: InvoiceFormData,
): Promise<ActionResult> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    // 1. Atualizar invoice principal
    await db
      .update(invoices)
      .set({
        invoiceNumber: data.invoiceNumber,
        invoiceDate: data.invoiceDate,
        status: data.status,
        pacienteId: data.pacienteId || null,
      })
      .where(eq(invoices.id, invoiceId));

    // 2. Deletar dados relacionados (cascade rebuild)
    await Promise.all([
      db.delete(invoiceExporters).where(eq(invoiceExporters.invoiceId, invoiceId)),
      db.delete(invoiceManufacturers).where(eq(invoiceManufacturers.invoiceId, invoiceId)),
      db.delete(invoicePatients).where(eq(invoicePatients.invoiceId, invoiceId)),
      db.delete(invoiceLegalInfo).where(eq(invoiceLegalInfo.invoiceId, invoiceId)),
      db.delete(invoiceProducts).where(eq(invoiceProducts.invoiceId, invoiceId)),
      db.delete(invoiceTotals).where(eq(invoiceTotals.invoiceId, invoiceId)),
      db.delete(invoicePaymentShipping).where(eq(invoicePaymentShipping.invoiceId, invoiceId)),
      db.delete(invoiceSignatures).where(eq(invoiceSignatures.invoiceId, invoiceId)),
    ]);

    // 3. Re-inserir todos os dados (mesma lógica do create, sem invoice principal)
    await db.insert(invoiceExporters).values({
      invoiceId,
      companyName: data.exporterCompanyName,
      address: data.exporterAddress,
      cityStateZipCountry: data.exporterCityStateZipCountry,
      taxId: data.exporterTaxId,
      phone: data.exporterPhone,
      email: data.exporterEmail,
    });

    await db.insert(invoiceManufacturers).values({
      invoiceId,
      companyName: data.manufacturerCompanyName,
      address: data.manufacturerAddress,
      cityZipCountry: data.manufacturerCityZipCountry,
      taxId: data.manufacturerTaxId,
      phone: data.manufacturerPhone,
      email: data.manufacturerEmail,
    });

    await db.insert(invoicePatients).values({
      invoiceId,
      patientName: data.patientName,
      address: data.patientAddress,
      cityStateZip: data.patientCityStateZip,
      cpf: data.patientCpf,
      anvisaAuthorization: data.patientAnvisaAuthorization,
      anvisaValidity: data.patientAnvisaValidity,
      email: data.patientEmail,
      patientNumberOng: data.patientNumberOng || null,
      phone: data.patientPhone || null,
    });

    if (data.invoiceType === 'judicialization') {
      await db.insert(invoiceLegalInfo).values({
        invoiceId,
        lawsuitNumber: data.lawsuitNumber || null,
        payingSource: data.payingSource || null,
        judicialSecrecy: data.judicialSecrecy || null,
      });

      await db.insert(invoicePaymentShipping).values({
        invoiceId,
        paymentMethod: data.paymentMethod || null,
        paymentDeadline: data.paymentDeadline || null,
        incoterms: data.incoterms || null,
        shippingMethod: data.shippingMethod || null,
        estimatedDelivery: data.estimatedDelivery || null,
      });
    }

    if (data.products.length > 0) {
      await db.insert(invoiceProducts).values(
        data.products.map((p, index) => ({
          invoiceId,
          itemNumber: index + 1,
          description: p.description,
          ncmCode: p.ncmCode,
          quantity: p.quantity,
          unitPrice: p.unitPrice,
          totalPrice: p.totalPrice,
        })),
      );
    }

    await db.insert(invoiceTotals).values({
      invoiceId,
      subtotal: data.subtotal,
      shipping: data.shipping,
      insurance: data.insurance,
      total: data.total,
      totalWords: data.totalWords,
      equivalentBrl: data.equivalentBrl,
    });

    await db.insert(invoiceSignatures).values({
      invoiceId,
      place: data.signaturePlace,
      signatureDate: data.signatureDate,
    });

    return { sucesso: true };
  } catch (error) {
    console.error('[Invoice] Erro ao atualizar invoice:', error);
    return { sucesso: false, erro: 'Erro ao atualizar invoice' };
  }
}

// ── Deletar Invoice ────────────────────────────────────────────

export async function deletarInvoice(
  invoiceId: string,
): Promise<ActionResult> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    // CASCADE cuida dos dados relacionados automaticamente
    await db.delete(invoices).where(eq(invoices.id, invoiceId));

    return { sucesso: true };
  } catch (error) {
    console.error('[Invoice] Erro ao deletar invoice:', error);
    return { sucesso: false, erro: 'Erro ao deletar invoice' };
  }
}

// ── Buscar Invoice Completa ────────────────────────────────────

export async function buscarInvoice(
  invoiceId: string,
): Promise<ActionResult<InvoiceCompleta>> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId));

    if (!invoice) {
      return { sucesso: false, erro: 'Invoice não encontrada' };
    }

    // Buscar dados relacionados em paralelo
    const [
      [exporter],
      [manufacturer],
      [patient],
      [legal],
      products,
      [totals],
      [payment],
      [signature],
    ] = await Promise.all([
      db.select().from(invoiceExporters).where(eq(invoiceExporters.invoiceId, invoiceId)),
      db.select().from(invoiceManufacturers).where(eq(invoiceManufacturers.invoiceId, invoiceId)),
      db.select().from(invoicePatients).where(eq(invoicePatients.invoiceId, invoiceId)),
      db.select().from(invoiceLegalInfo).where(eq(invoiceLegalInfo.invoiceId, invoiceId)),
      db.select().from(invoiceProducts).where(eq(invoiceProducts.invoiceId, invoiceId)).orderBy(invoiceProducts.itemNumber),
      db.select().from(invoiceTotals).where(eq(invoiceTotals.invoiceId, invoiceId)),
      db.select().from(invoicePaymentShipping).where(eq(invoicePaymentShipping.invoiceId, invoiceId)),
      db.select().from(invoiceSignatures).where(eq(invoiceSignatures.invoiceId, invoiceId)),
    ]);

    return {
      sucesso: true,
      dados: {
        id: invoice.id,
        invoiceType: invoice.invoiceType,
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate,
        status: invoice.status,
        pacienteId: invoice.pacienteId,
        createdAt: invoice.createdAt,
        updatedAt: invoice.updatedAt,
        exporter: exporter
          ? {
              companyName: exporter.companyName,
              address: exporter.address,
              cityStateZipCountry: exporter.cityStateZipCountry,
              taxId: exporter.taxId,
              phone: exporter.phone,
              email: exporter.email,
            }
          : null,
        manufacturer: manufacturer
          ? {
              companyName: manufacturer.companyName,
              address: manufacturer.address,
              cityZipCountry: manufacturer.cityZipCountry,
              taxId: manufacturer.taxId,
              phone: manufacturer.phone,
              email: manufacturer.email,
            }
          : null,
        patient: patient
          ? {
              patientName: patient.patientName,
              address: patient.address,
              cityStateZip: patient.cityStateZip,
              cpf: patient.cpf,
              anvisaAuthorization: patient.anvisaAuthorization,
              anvisaValidity: patient.anvisaValidity,
              email: patient.email,
              patientNumberOng: patient.patientNumberOng,
              phone: patient.phone,
            }
          : null,
        legalInfo: legal
          ? {
              lawsuitNumber: legal.lawsuitNumber,
              payingSource: legal.payingSource,
              judicialSecrecy: legal.judicialSecrecy,
            }
          : null,
        products: products.map((p) => ({
          itemNumber: p.itemNumber,
          description: p.description,
          ncmCode: p.ncmCode,
          quantity: p.quantity,
          unitPrice: p.unitPrice,
          totalPrice: p.totalPrice,
        })),
        totals: totals
          ? {
              subtotal: totals.subtotal,
              shipping: totals.shipping,
              insurance: totals.insurance,
              total: totals.total,
              totalWords: totals.totalWords,
              equivalentBrl: totals.equivalentBrl,
            }
          : null,
        paymentShipping: payment
          ? {
              paymentMethod: payment.paymentMethod,
              paymentDeadline: payment.paymentDeadline,
              incoterms: payment.incoterms,
              shippingMethod: payment.shippingMethod,
              estimatedDelivery: payment.estimatedDelivery,
            }
          : null,
        signature: signature
          ? {
              place: signature.place,
              signatureDate: signature.signatureDate,
            }
          : null,
      },
    };
  } catch (error) {
    console.error('[Invoice] Erro ao buscar invoice:', error);
    return { sucesso: false, erro: 'Erro ao buscar invoice' };
  }
}

// ── Listar Invoices ────────────────────────────────────────────

export async function listarInvoices(params?: {
  tipo?: string;
  status?: string;
  busca?: string;
  limite?: number;
  offset?: number;
}): Promise<ActionResult<{ invoices: InvoiceListItem[]; total: number }>> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const conditions = [];

    if (params?.tipo) {
      conditions.push(
        eq(invoices.invoiceType, params.tipo as 'donation' | 'judicialization' | 'collab' | 'retail'),
      );
    }

    if (params?.status) {
      conditions.push(
        eq(invoices.status, params.status as 'draft' | 'completed'),
      );
    }

    // Busca textual por número da invoice ou nome do paciente
    if (params?.busca) {
      const termo = `%${params.busca}%`;
      conditions.push(
        sql`(${invoices.invoiceNumber} ILIKE ${termo} OR ${invoicePatients.patientName} ILIKE ${termo})`,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Buscar invoices com nome do paciente via sub-select
    const resultado = await db
      .select({
        id: invoices.id,
        invoiceType: invoices.invoiceType,
        invoiceNumber: invoices.invoiceNumber,
        invoiceDate: invoices.invoiceDate,
        status: invoices.status,
        createdAt: invoices.createdAt,
        patientName: invoicePatients.patientName,
      })
      .from(invoices)
      .leftJoin(invoicePatients, eq(invoices.id, invoicePatients.invoiceId))
      .where(whereClause)
      .orderBy(desc(invoices.createdAt))
      .limit(params?.limite ?? 50)
      .offset(params?.offset ?? 0);

    // Contagem total (com o mesmo join para busca funcionar)
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(invoices)
      .leftJoin(invoicePatients, eq(invoices.id, invoicePatients.invoiceId))
      .where(whereClause);

    return {
      sucesso: true,
      dados: {
        invoices: resultado.map((r) => ({
          id: r.id,
          invoiceType: r.invoiceType,
          invoiceNumber: r.invoiceNumber,
          invoiceDate: r.invoiceDate,
          status: r.status,
          createdAt: r.createdAt,
          patientName: r.patientName ?? undefined,
        })),
        total: count,
      },
    };
  } catch (error) {
    console.error('[Invoice] Erro ao listar invoices:', error);
    return { sucesso: false, erro: 'Erro ao listar invoices' };
  }
}

// ── Buscar Pacientes para Autocomplete ─────────────────────────

export async function buscarPacientesParaInvoice(busca: string): Promise<
  ActionResult<
    {
      id: string;
      nome: string;
      cpf: string | null;
      endereco: string | null;
      cidade: string | null;
      uf: string | null;
      cep: string | null;
      email: string;
      anvisaAutorizacao: string | null;
    }[]
  >
> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    // Importar aqui para evitar circular dependency
    const { pacientes } = await import('@/db/schema/pacientes');
    const { users } = await import('@/db/schema/users');

    const resultado = await db
      .select({
        id: pacientes.id,
        nome: users.nome,
        cpf: pacientes.cpf,
        endereco: pacientes.endereco,
        cidade: pacientes.cidade,
        uf: pacientes.uf,
        cep: pacientes.cep,
        email: users.email,
      })
      .from(pacientes)
      .innerJoin(users, eq(pacientes.userId, users.id))
      .where(
        sql`(${users.nome} ILIKE ${`%${busca}%`} OR ${pacientes.cpf} ILIKE ${`%${busca}%`})`,
      )
      .limit(10);

    return {
      sucesso: true,
      dados: resultado.map((r) => ({
        id: r.id,
        nome: r.nome,
        cpf: r.cpf,
        endereco: r.endereco,
        cidade: r.cidade,
        uf: r.uf,
        cep: r.cep,
        email: r.email,
        anvisaAutorizacao: null, // será preenchido via documentos se necessário
      })),
    };
  } catch (error) {
    console.error('[Invoice] Erro ao buscar pacientes:', error);
    return { sucesso: false, erro: 'Erro ao buscar pacientes' };
  }
}
