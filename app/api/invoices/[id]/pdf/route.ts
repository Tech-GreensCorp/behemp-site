import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { buscarInvoice } from '@/app/(admin)/_actions/invoices';
import type { InvoiceCompleta } from '@/app/(admin)/_actions/invoices';

/**
 * Route Handler para gerar HTML de preview da invoice.
 * Usado em iframe no admin para preview antes de imprimir/salvar como PDF.
 * Acesso restrito a admin.
 *
 * GET /api/invoices/[id]/pdf
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await currentUser();
    const role = user?.publicMetadata?.role as string | undefined;

    if (!user || role !== 'admin') {
      return NextResponse.json(
        { erro: 'Acesso não autorizado' },
        { status: 403 },
      );
    }

    const { id } = await params;
    const resultado = await buscarInvoice(id);

    if (!resultado.sucesso || !resultado.dados) {
      return NextResponse.json(
        { erro: resultado.erro ?? 'Invoice não encontrada' },
        { status: 404 },
      );
    }

    const invoice = resultado.dados;
    const html = renderInvoiceHTML(invoice);

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('[PDF] Erro ao gerar PDF:', error);
    return NextResponse.json(
      { erro: 'Erro interno ao gerar PDF' },
      { status: 500 },
    );
  }
}

// ── Helpers ──────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('pt-BR');
}

function formatMoney(value: string | number): string {
  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getInvoiceTitle(type: string): string {
  const titles: Record<string, string> = {
    donation: 'COMMERCIAL INVOICE / FATURA COMERCIAL DE DOAÇÃO',
    judicialization: 'COMMERCIAL INVOICE / FATURA COMERCIAL DE JUDICIALIZAÇÃO',
    collab: 'COMMERCIAL INVOICE / FATURA COMERCIAL COLLAB',
    retail: 'COMMERCIAL INVOICE / FATURA COMERCIAL VAREJO',
  };
  return titles[type] ?? 'COMMERCIAL INVOICE';
}

// ── Template HTML ────────────────────────────────────────────────

function renderInvoiceHTML(invoice: InvoiceCompleta): string {
  const { exporter, manufacturer, patient, products, totals, legalInfo, paymentShipping, signature } = invoice;

  const donationBox =
    invoice.invoiceType === 'donation'
      ? `
    <div class="donation-box">
      <strong>DONATION / DOAÇÃO - In partnership with / Em parceria com:</strong><br>
      Behemp Association for Development Research and Promotion of Cannabis in Brazil (ONG)<br>
      Associação Behemp de Desenvolvimento Pesquisa e Fomento em Cannabis no Brasil (ONG)<br>
      CNPJ: 07.578.940/0001-01<br>
      <strong>PRIVATE LABEL PRODUCT / PRODUTO PRIVATE LABEL</strong>
    </div>`
      : '';

  const legalSection =
    invoice.invoiceType === 'judicialization' && legalInfo
      ? `
    <div class="section-header">LEGAL INFORMATION | INFORMAÇÕES JURÍDICAS</div>
    <table class="info-table">
      <tr><td class="label">Lawsuit Number / Número do Processo:</td><td class="value">${legalInfo.lawsuitNumber ?? ''}</td></tr>
      <tr><td class="label">Paying Source / Fonte Pagadora:</td><td class="value">${legalInfo.payingSource ?? ''}</td></tr>
      <tr><td class="label">Judicial Secrecy / Segredo de Justiça:</td><td class="value">${legalInfo.judicialSecrecy ?? ''}</td></tr>
    </table>`
      : '';

  const paymentSection =
    invoice.invoiceType === 'judicialization' && paymentShipping
      ? `
    <div class="section-header">PAYMENT & SHIPPING TERMS | CONDIÇÕES DE PAGAMENTO E ENVIO</div>
    <table class="info-table">
      <tr><td class="label">Payment Method / Método de Pagamento:</td><td class="value">${paymentShipping.paymentMethod ?? ''}</td></tr>
      <tr><td class="label">Payment Deadline / Prazo de Pagamento:</td><td class="value">${paymentShipping.paymentDeadline ? formatDate(paymentShipping.paymentDeadline) : ''}</td></tr>
      <tr><td class="label">Incoterms:</td><td class="value">${paymentShipping.incoterms ?? ''}</td></tr>
      <tr><td class="label">Shipping Method / Método de Envio:</td><td class="value">${paymentShipping.shippingMethod ?? ''}</td></tr>
      <tr><td class="label">Estimated Delivery / Entrega Estimada:</td><td class="value">${paymentShipping.estimatedDelivery ? formatDate(paymentShipping.estimatedDelivery) : ''}</td></tr>
    </table>`
      : '';

  const ongField =
    invoice.invoiceType === 'donation' && patient?.patientNumberOng
      ? `<tr><td class="label">Patient Number at ONG / Número do Paciente na ONG:</td><td class="value">${patient.patientNumberOng}</td></tr>`
      : '';

  const phoneField =
    invoice.invoiceType === 'judicialization' && patient?.phone
      ? `<tr><td class="label">Phone / Telefone:</td><td class="value">${patient.phone}</td></tr>`
      : '';

  const productRows = products
    .map(
      (p, i) => `
    <tr>
      <td class="number">${i + 1}</td>
      <td class="description">${p.description.replace(/\n/g, '<br>')}</td>
      <td class="ncm">${p.ncmCode}</td>
      <td class="qty">${formatMoney(p.quantity)}</td>
      <td class="price">${formatMoney(p.unitPrice)}</td>
      <td class="price">${formatMoney(p.totalPrice)}</td>
    </tr>`,
    )
    .join('');

  // Seção legal completa para donation
  const donationLegalDeclarations =
    invoice.invoiceType === 'donation'
      ? `
    <div class="section-header">NCM CLASSIFICATION & TAX TREATMENT | CLASSIFICAÇÃO NCM E TRATAMENTO TRIBUTÁRIO</div>
    <div class="legal-text">
      <strong>Primary NCM Code / Código NCM Principal:</strong> 3004.90.99 (Other pharmaceutical products / Outros produtos farmacêuticos)
    </div>
    <div class="legal-text">
      <strong>Alternative NCM Code / Código NCM Alternativo:</strong> 3307.29.00 - Destaque 001 (Cannabidiol / Canabidiol)
    </div>
    <div class="legal-text">
      <strong>Product Description / Descrição do Produto:</strong> Pharmaceutical preparation based on cannabidiol (CBD) - Private Label Product<br><br>
      Preparação farmacêutica à base de canabidiol (CBD) - Produto Private Label<br><br>
      Manufactured by / Fabricado por: ${manufacturer?.companyName ?? ''}, Switzerland / Suíça<br><br>
      Distributed by / Distribuído por: ${exporter?.companyName ?? ''}, USA / EUA
    </div>
    <div class="legal-text">
      <strong>Tax Treatment / Tratamento Tributário:</strong> EXEMPT from Import Tax (0% rate) / ISENTO de Imposto de Importação (alíquota 0%)<br><br>
      For medicines up to USD 10,000.00 / Para medicamentos até USD 10.000,00
    </div>

    <div class="section-header">LEGAL DECLARATIONS & COMPLIANCE | DECLARAÇÕES LEGAIS E CONFORMIDADE</div>
    <div class="legal-text" style="margin-top: 20px;">
      <strong>DONATION DECLARATION AND LEGAL COMPLIANCE</strong><br>
      <strong>DECLARAÇÃO DE DOAÇÃO E CONFORMIDADE LEGAL</strong>
    </div>
    <div class="legal-text">
      To the Brazilian Customs and Health Authorities:<br>
      Às Autoridades Aduaneiras e Sanitárias Brasileiras:
    </div>
    <div class="legal-text">
      We, ${exporter?.companyName ?? 'Greens Pharmaceutical Corp'}, a company duly incorporated and operating under the laws of the United States of America, with registered office at ${exporter?.address ?? ''}, ${exporter?.cityStateZipCountry ?? ''}, hereby declare that the shipment described above constitutes a DONATION of pharmaceutical product containing cannabidiol (CBD), manufactured by ${manufacturer?.companyName ?? 'CanniFex GmbH'}, Switzerland, under a private label arrangement.
    </div>
    <div class="legal-text">
      Nós, ${exporter?.companyName ?? 'Greens Pharmaceutical Corp'}, empresa devidamente constituída e operando sob a legislação dos Estados Unidos da América, com sede registrada em ${exporter?.address ?? ''}, ${exporter?.cityStateZipCountry ?? ''}, declaramos pelo presente que a remessa descrita acima constitui uma DOAÇÃO de produto farmacêutico contendo canabidiol (CBD), fabricado por ${manufacturer?.companyName ?? 'CanniFex GmbH'}, Suíça, em regime de private label.
    </div>
    <div class="legal-text">
      This donation is made in good faith, provided free of charge, without commercial value, and for which no payment, compensation or consideration of any kind has been or will be received. The monetary value declared in this invoice is indicated solely and exclusively for customs valuation purposes.
    </div>
    <div class="legal-text">
      Esta doação é feita de boa-fé, fornecida gratuitamente, sem valor comercial, e pela qual nenhum pagamento, compensação ou contraprestação de qualquer natureza foi ou será recebido. O valor monetário declarado nesta fatura é indicado única e exclusivamente para fins de valoração aduaneira.
    </div>
    <div class="legal-text">
      <strong>Legal Framework / Marco Legal:</strong>
    </div>
    <div class="legal-text">
      <strong>1.</strong> ANVISA Resolution RDC No. 660, dated March 30, 2022 / Resolução RDC nº 660 da ANVISA, de 30 de março de 2022.
    </div>
    <div class="legal-text">
      <strong>2.</strong> ANVISA Resolution RDC No. 1, dated January 6, 2003 / Resolução RDC nº 1 da ANVISA, de 06 de janeiro de 2003.
    </div>
    <div class="legal-text">
      <strong>3.</strong> Brazilian Customs Legislation: Medicines imported by individuals for personal use, up to USD 10,000.00, are exempt from Import Tax (0% rate).
    </div>`
      : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice - ${invoice.invoiceNumber}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: "Times New Roman", Times, serif;
      font-size: 11pt; line-height: 1.4; color: #000; background: #fff;
      display: flex; align-items: center; justify-content: center; flex-direction: column;
    }
    .page { width: 100%; max-width: 1440px; padding: 0; }
    .header {
      background-color: #5a8a73; color: #fff; padding: 12px 15px;
      text-align: center; font-size: 16pt; font-weight: bold; margin-bottom: 15px;
    }
    .section-header {
      background-color: #5a8a73; color: #fff; padding: 8px 12px;
      font-weight: bold; font-size: 11pt; margin-top: 15px; margin-bottom: 8px;
    }
    .info-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
    .info-table td { padding: 6px 8px; vertical-align: top; }
    .info-table td.label { width: 45%; font-weight: normal; border: none; }
    .info-table td.value { width: 55%; border: 0.75px solid #515151; }
    .invoice-info { width: 100%; margin-bottom: 15px; border-collapse: collapse; }
    .invoice-info td { padding: 6px 8px; }
    .invoice-info .label-cell { width: 30%; font-weight: bold; border: none; }
    .invoice-info .value-cell { width: 20%; border: 0.75px solid #515151; }
    .donation-box {
      background-color: #f9f3d9; border: 0.75px solid #515151; padding: 12px;
      margin: 15px 0; font-weight: bold; line-height: 1.6;
    }
    .products-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    .products-table th, .products-table td { padding: 6px 8px; border: 0.75px solid #515151; text-align: left; }
    .products-table th { background-color: #f9f9f9; font-weight: bold; }
    .products-table td.number { text-align: center; width: 5%; }
    .products-table td.description { width: 35%; }
    .products-table td.ncm { width: 15%; }
    .products-table td.qty { text-align: center; width: 10%; }
    .products-table td.price { text-align: right; width: 17.5%; }
    .totals-table { width: 50%; margin-left: auto; border-collapse: collapse; margin-top: 10px; margin-bottom: 15px; }
    .totals-table td { padding: 6px 8px; border: 0.75px solid #515151; }
    .totals-table td.label { text-align: right; font-weight: bold; width: 60%; }
    .totals-table td.value { text-align: right; width: 40%; }
    .totals-table tr.total-row { background-color: #f9d9a9; }
    .legal-text { text-align: justify; margin: 10px 0; font-size: 10.5pt; line-height: 1.5; }
    .legal-text strong { font-weight: bold; }
    .signature-section { margin-top: 30px; }
    .signature-table { width: 100%; border-collapse: collapse; }
    .signature-table td { padding: 6px 8px; border: 0.75px solid #515151; }
    .signature-table .label { font-weight: bold; width: 15%; border: none; }
    .no-print { position: fixed; top: 10px; right: 10px; z-index: 9999; display: flex; gap: 8px; }
    .btn { padding: 10px 20px; cursor: pointer; border: none; color: #fff; border-radius: 6px; font-size: 13px; }
    .btn-print { background: #5a8a73; }
    .btn-close { background: #9a2020; }
    .btn:hover { filter: brightness(0.9); }
    @media print { .no-print { display: none !important; } body { margin: 0; padding: 0; } }
  </style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()" class="btn btn-print">Imprimir / Salvar PDF</button>
    <button onclick="window.close()" class="btn btn-close">Fechar</button>
  </div>

  <div class="page">
    <div class="header">${getInvoiceTitle(invoice.invoiceType)}</div>

    <table class="invoice-info">
      <tr>
        <td class="label-cell">Invoice Number / Número da Fatura:</td>
        <td class="value-cell">${invoice.invoiceNumber}</td>
        <td class="label-cell">Date / Data:</td>
        <td class="value-cell">${formatDate(invoice.invoiceDate)}</td>
      </tr>
    </table>

    <div class="section-header">EXPORTER / SELLER | EXPORTADOR / VENDEDOR</div>
    <table class="info-table">
      <tr><td class="label">Company Name / Nome da Empresa:</td><td class="value">${exporter?.companyName ?? ''}</td></tr>
      <tr><td class="label">Address / Endereço:</td><td class="value">${exporter?.address ?? ''}</td></tr>
      <tr><td class="label">City, State, ZIP, Country:</td><td class="value">${exporter?.cityStateZipCountry ?? ''}</td></tr>
      <tr><td class="label">Tax ID / Registro Fiscal:</td><td class="value">${exporter?.taxId ?? ''}</td></tr>
      <tr><td class="label">Phone / Telefone:</td><td class="value">${exporter?.phone ?? ''}</td></tr>
      <tr><td class="label">Email / E-mail:</td><td class="value">${exporter?.email ?? ''}</td></tr>
    </table>

    <div class="section-header">MANUFACTURER | FABRICANTE</div>
    <table class="info-table">
      <tr><td class="label">Company Name / Nome da Empresa:</td><td class="value">${manufacturer?.companyName ?? ''}</td></tr>
      <tr><td class="label">Address / Endereço:</td><td class="value">${manufacturer?.address ?? ''}</td></tr>
      <tr><td class="label">City, ZIP, Country:</td><td class="value">${manufacturer?.cityZipCountry ?? ''}</td></tr>
      <tr><td class="label">Tax ID / Registro Fiscal:</td><td class="value">${manufacturer?.taxId ?? ''}</td></tr>
      <tr><td class="label">Phone / Telefone:</td><td class="value">${manufacturer?.phone ?? ''}</td></tr>
      <tr><td class="label">Email / E-mail:</td><td class="value">${manufacturer?.email ?? ''}</td></tr>
    </table>

    <div class="section-header">CONSIGNEE / PATIENT | DESTINATÁRIO / PACIENTE</div>
    <table class="info-table">
      <tr><td class="label">Patient Name / Nome do Paciente:</td><td class="value">${patient?.patientName ?? ''}</td></tr>
      <tr><td class="label">Address / Endereço:</td><td class="value">${patient?.address ?? ''}</td></tr>
      <tr><td class="label">City, State, ZIP:</td><td class="value">${patient?.cityStateZip ?? ''}</td></tr>
      <tr><td class="label">CPF (Brazilian Tax ID):</td><td class="value">${patient?.cpf ?? ''}</td></tr>
      <tr><td class="label">ANVISA Authorization No.:</td><td class="value">${patient?.anvisaAuthorization ?? ''}</td></tr>
      <tr><td class="label">ANVISA Validity:</td><td class="value">${patient?.anvisaValidity ? formatDate(patient.anvisaValidity) : ''}</td></tr>
      <tr><td class="label">Email / E-mail:</td><td class="value">${patient?.email ?? ''}</td></tr>
      ${ongField}
      ${phoneField}
    </table>

    ${legalSection}

    <div class="section-header">PRODUCT DETAILS | DETALHES DO PRODUTO</div>
    ${donationBox}

    <table class="products-table">
      <thead>
        <tr>
          <th class="number">Item</th>
          <th class="description">Description / Descrição</th>
          <th class="ncm">NCM Code</th>
          <th class="qty">Qty</th>
          <th class="price">Unit Price (USD)</th>
          <th class="price">Total (USD)</th>
        </tr>
      </thead>
      <tbody>${productRows}</tbody>
    </table>

    <table class="totals-table">
      <tr><td class="label">Subtotal:</td><td class="value">${totals ? formatMoney(totals.subtotal) : '0.00'}</td></tr>
      <tr><td class="label">Shipping / Frete:</td><td class="value">${totals ? formatMoney(totals.shipping) : '0.00'}</td></tr>
      <tr><td class="label">Insurance / Seguro:</td><td class="value">${totals ? formatMoney(totals.insurance) : '0.00'}</td></tr>
      <tr class="total-row"><td class="label">TOTAL:</td><td class="value">${totals ? formatMoney(totals.total) : '0.00'}</td></tr>
    </table>

    <table class="info-table">
      <tr><td class="label">Total in Words / Total por Extenso:</td><td class="value">${totals?.totalWords ?? ''}</td></tr>
      <tr><td class="label">Equivalent in BRL / Equivalente em BRL:</td><td class="value">${totals ? formatMoney(totals.equivalentBrl) : '0.00'}</td></tr>
    </table>

    ${paymentSection}
    ${donationLegalDeclarations}

    <div class="signature-section">
      <table class="signature-table">
        <tr>
          <td class="label">Place / Local:</td>
          <td>${signature?.place ?? ''}</td>
          <td class="label">Date / Data:</td>
          <td>${signature?.signatureDate ? formatDate(signature.signatureDate) : ''}</td>
        </tr>
      </table>
    </div>
  </div>
</body>
</html>`;
}
