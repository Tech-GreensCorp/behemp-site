'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ProductTable } from './product-table';
import { Save, FileText, Search, Loader2 } from 'lucide-react';
import {
  criarInvoice,
  atualizarInvoice,
  buscarPacientesParaInvoice,
} from '@/app/(admin)/_actions/invoices';
import type { InvoiceFormData, InvoiceProduct, InvoiceCompleta } from '@/app/(admin)/_actions/invoices';
import { generateInvoiceNumber, EXPORTER_DEFAULTS, MANUFACTURER_DEFAULTS } from '@/lib/invoices/invoice-defaults';
import { formatTotalInWords } from '@/lib/invoices/number-to-words';

interface InvoiceFormProps {
  invoice?: InvoiceCompleta;
}

export function InvoiceForm({ invoice }: InvoiceFormProps) {
  const router = useRouter();
  const isEdit = !!invoice;
  const [saving, setSaving] = useState(false);
  const [buscaPaciente, setBuscaPaciente] = useState('');
  const [pacientesEncontrados, setPacientesEncontrados] = useState<Awaited<ReturnType<typeof buscarPacientesParaInvoice>>['dados']>([]);
  const [buscando, setBuscando] = useState(false);

  // ── Estado do formulário ──────────────────────────────
  const [tipo, setTipo] = useState<string>(invoice?.invoiceType ?? '');
  const [numero, setNumero] = useState(invoice?.invoiceNumber ?? '');
  const [data, setData] = useState(invoice?.invoiceDate ?? new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState(invoice?.status ?? 'draft');
  const [pacienteId, setPacienteId] = useState(invoice?.pacienteId ?? '');

  // Exportador
  const [expNome, setExpNome] = useState(invoice?.exporter?.companyName ?? EXPORTER_DEFAULTS.companyName);
  const [expEndereco, setExpEndereco] = useState(invoice?.exporter?.address ?? EXPORTER_DEFAULTS.address);
  const [expCidade, setExpCidade] = useState(invoice?.exporter?.cityStateZipCountry ?? EXPORTER_DEFAULTS.cityStateZipCountry);
  const [expTaxId, setExpTaxId] = useState(invoice?.exporter?.taxId ?? EXPORTER_DEFAULTS.taxId);
  const [expTelefone, setExpTelefone] = useState(invoice?.exporter?.phone ?? EXPORTER_DEFAULTS.phone);
  const [expEmail, setExpEmail] = useState(invoice?.exporter?.email ?? EXPORTER_DEFAULTS.email);

  // Fabricante
  const [fabNome, setFabNome] = useState(invoice?.manufacturer?.companyName ?? MANUFACTURER_DEFAULTS.companyName);
  const [fabEndereco, setFabEndereco] = useState(invoice?.manufacturer?.address ?? MANUFACTURER_DEFAULTS.address);
  const [fabCidade, setFabCidade] = useState(invoice?.manufacturer?.cityZipCountry ?? MANUFACTURER_DEFAULTS.cityZipCountry);
  const [fabTaxId, setFabTaxId] = useState(invoice?.manufacturer?.taxId ?? MANUFACTURER_DEFAULTS.taxId);
  const [fabTelefone, setFabTelefone] = useState(invoice?.manufacturer?.phone ?? MANUFACTURER_DEFAULTS.phone);
  const [fabEmail, setFabEmail] = useState(invoice?.manufacturer?.email ?? MANUFACTURER_DEFAULTS.email);

  // Paciente
  const [pacNome, setPacNome] = useState(invoice?.patient?.patientName ?? '');
  const [pacEndereco, setPacEndereco] = useState(invoice?.patient?.address ?? '');
  const [pacCidade, setPacCidade] = useState(invoice?.patient?.cityStateZip ?? '');
  const [pacCpf, setPacCpf] = useState(invoice?.patient?.cpf ?? '');
  const [pacAnvisa, setPacAnvisa] = useState(invoice?.patient?.anvisaAuthorization ?? '');
  const [pacAnvisaValidade, setPacAnvisaValidade] = useState(invoice?.patient?.anvisaValidity ?? '');
  const [pacEmail, setPacEmail] = useState(invoice?.patient?.email ?? '');
  const [pacNumeroOng, setPacNumeroOng] = useState(invoice?.patient?.patientNumberOng ?? '');
  const [pacTelefone, setPacTelefone] = useState(invoice?.patient?.phone ?? '');

  // Jurídico
  const [processoNumero, setProcessoNumero] = useState(invoice?.legalInfo?.lawsuitNumber ?? '');
  const [fontePagadora, setFontePagadora] = useState(invoice?.legalInfo?.payingSource ?? '');
  const [segredoJustica, setSegredoJustica] = useState(invoice?.legalInfo?.judicialSecrecy ?? '');

  // Produtos
  const [products, setProducts] = useState<InvoiceProduct[]>(
    invoice?.products?.length
      ? invoice.products.map((p) => ({
          description: p.description,
          ncmCode: p.ncmCode,
          quantity: p.quantity,
          unitPrice: p.unitPrice,
          totalPrice: p.totalPrice,
        }))
      : [{ description: '', ncmCode: '', quantity: '1', unitPrice: '0', totalPrice: '0' }],
  );

  // Totais
  const [frete, setFrete] = useState(invoice?.totals?.shipping ?? '0');
  const [seguro, setSeguro] = useState(invoice?.totals?.insurance ?? '0');
  const [equivalenteBrl, setEquivalenteBrl] = useState(invoice?.totals?.equivalentBrl ?? '0');

  // Pagamento/envio
  const [metPagamento, setMetPagamento] = useState(invoice?.paymentShipping?.paymentMethod ?? '');
  const [prazoPagamento, setPrazoPagamento] = useState(invoice?.paymentShipping?.paymentDeadline ?? '');
  const [incoterms, setIncoterms] = useState(invoice?.paymentShipping?.incoterms ?? '');
  const [metEnvio, setMetEnvio] = useState(invoice?.paymentShipping?.shippingMethod ?? '');
  const [entregaEstimada, setEntregaEstimada] = useState(invoice?.paymentShipping?.estimatedDelivery ?? '');

  // Assinatura
  const [assinaturaLocal, setAssinaturaLocal] = useState(invoice?.signature?.place ?? '');
  const [assinaturaData, setAssinaturaData] = useState(invoice?.signature?.signatureDate ?? new Date().toISOString().split('T')[0]);

  // ── Cálculos automáticos ──────────────────────────────
  const subtotal = products.reduce((acc, p) => acc + (parseFloat(p.totalPrice) || 0), 0);
  const total = subtotal + (parseFloat(frete) || 0) + (parseFloat(seguro) || 0);
  const totalPorExtenso = total > 0 ? formatTotalInWords(total) : '';

  // ── Busca de pacientes ────────────────────────────────
  const buscarPacientes = useCallback(async (termo: string) => {
    if (termo.length < 2) { setPacientesEncontrados([]); return; }
    setBuscando(true);
    const resultado = await buscarPacientesParaInvoice(termo);
    if (resultado.sucesso && resultado.dados) setPacientesEncontrados(resultado.dados);
    setBuscando(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => buscarPacientes(buscaPaciente), 300);
    return () => clearTimeout(timer);
  }, [buscaPaciente, buscarPacientes]);

  function selecionarPaciente(pac: NonNullable<typeof pacientesEncontrados>[number]) {
    setPacienteId(pac.id);
    setPacNome(pac.nome);
    setPacCpf(pac.cpf ?? '');
    setPacEmail(pac.email);
    setPacEndereco(pac.endereco ?? '');
    const cidadeUf = [pac.cidade, pac.uf, pac.cep].filter(Boolean).join(', ');
    setPacCidade(cidadeUf);
    setBuscaPaciente('');
    setPacientesEncontrados([]);
  }

  // ── Submit ────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const formData: InvoiceFormData = {
      invoiceType: tipo as InvoiceFormData['invoiceType'],
      invoiceNumber: numero,
      invoiceDate: data,
      status: status as 'draft' | 'completed',
      pacienteId: pacienteId || undefined,
      exporterCompanyName: expNome, exporterAddress: expEndereco,
      exporterCityStateZipCountry: expCidade, exporterTaxId: expTaxId,
      exporterPhone: expTelefone, exporterEmail: expEmail,
      manufacturerCompanyName: fabNome, manufacturerAddress: fabEndereco,
      manufacturerCityZipCountry: fabCidade, manufacturerTaxId: fabTaxId,
      manufacturerPhone: fabTelefone, manufacturerEmail: fabEmail,
      patientName: pacNome, patientAddress: pacEndereco,
      patientCityStateZip: pacCidade, patientCpf: pacCpf,
      patientAnvisaAuthorization: pacAnvisa, patientAnvisaValidity: pacAnvisaValidade,
      patientEmail: pacEmail, patientNumberOng: pacNumeroOng || undefined,
      patientPhone: pacTelefone || undefined,
      lawsuitNumber: processoNumero || undefined, payingSource: fontePagadora || undefined,
      judicialSecrecy: segredoJustica || undefined,
      products,
      subtotal: subtotal.toFixed(2), shipping: frete, insurance: seguro,
      total: total.toFixed(2), totalWords: totalPorExtenso,
      equivalentBrl: equivalenteBrl,
      paymentMethod: metPagamento || undefined, paymentDeadline: prazoPagamento || undefined,
      incoterms: incoterms || undefined, shippingMethod: metEnvio || undefined,
      estimatedDelivery: entregaEstimada || undefined,
      signaturePlace: assinaturaLocal, signatureDate: assinaturaData,
    };

    const resultado = isEdit
      ? await atualizarInvoice(invoice.id, formData)
      : await criarInvoice(formData);

    setSaving(false);
    if (resultado.sucesso) {
      router.push('/admin/invoices');
      router.refresh();
    }
  }

  // ── Helpers de seção ──────────────────────────────────
  function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
      <div className="grid gap-2 sm:grid-cols-[200px_1fr] sm:items-center">
        <Label className="text-sm text-muted-foreground">{label}</Label>
        {children}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Tipo e Informações Básicas */}
      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-base">Informações Básicas</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <FieldRow label="Tipo de Invoice *">
            <Select value={tipo} onValueChange={(val) => { if (val) setTipo(val); }} disabled={isEdit} required>
              <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="donation">Doação</SelectItem>
                <SelectItem value="judicialization">Judicialização</SelectItem>
                <SelectItem value="collab">Collab</SelectItem>
                <SelectItem value="retail">Varejo</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
          <FieldRow label="Número *">
            <div className="flex gap-2">
              <Input value={numero} onChange={(e) => setNumero(e.target.value)} required />
              <Button type="button" variant="outline" size="sm" onClick={() => setNumero(generateInvoiceNumber())}>
                Gerar
              </Button>
            </div>
          </FieldRow>
          <FieldRow label="Data *">
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
          </FieldRow>
          <FieldRow label="Status *">
            <Select value={status} onValueChange={(val) => { if (val) setStatus(val); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Rascunho</SelectItem>
                <SelectItem value="completed">Completo</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
        </CardContent>
      </Card>

      {/* Exportador */}
      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-base">Exportador / Vendedor</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <FieldRow label="Empresa *"><Input value={expNome} onChange={(e) => setExpNome(e.target.value)} required /></FieldRow>
          <FieldRow label="Endereço *"><Input value={expEndereco} onChange={(e) => setExpEndereco(e.target.value)} required /></FieldRow>
          <FieldRow label="Cidade/Estado/CEP/País *"><Input value={expCidade} onChange={(e) => setExpCidade(e.target.value)} required /></FieldRow>
          <FieldRow label="Tax ID *"><Input value={expTaxId} onChange={(e) => setExpTaxId(e.target.value)} required /></FieldRow>
          <FieldRow label="Telefone *"><Input value={expTelefone} onChange={(e) => setExpTelefone(e.target.value)} required /></FieldRow>
          <FieldRow label="Email *"><Input type="email" value={expEmail} onChange={(e) => setExpEmail(e.target.value)} required /></FieldRow>
        </CardContent>
      </Card>

      {/* Fabricante */}
      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-base">Fabricante</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <FieldRow label="Empresa *"><Input value={fabNome} onChange={(e) => setFabNome(e.target.value)} required /></FieldRow>
          <FieldRow label="Endereço *"><Input value={fabEndereco} onChange={(e) => setFabEndereco(e.target.value)} required /></FieldRow>
          <FieldRow label="Cidade/CEP/País *"><Input value={fabCidade} onChange={(e) => setFabCidade(e.target.value)} required /></FieldRow>
          <FieldRow label="Tax ID *"><Input value={fabTaxId} onChange={(e) => setFabTaxId(e.target.value)} required /></FieldRow>
          <FieldRow label="Telefone *"><Input value={fabTelefone} onChange={(e) => setFabTelefone(e.target.value)} required /></FieldRow>
          <FieldRow label="Email *"><Input type="email" value={fabEmail} onChange={(e) => setFabEmail(e.target.value)} required /></FieldRow>
        </CardContent>
      </Card>

      {/* Paciente */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Paciente / Destinatário</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Busca de paciente cadastrado */}
          <div className="rounded-xl border bg-muted/30 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Buscar paciente cadastrado
            </p>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={buscaPaciente}
                onChange={(e) => setBuscaPaciente(e.target.value)}
                placeholder="Digite nome ou CPF..."
                className="pl-9"
              />
              {buscando && <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />}
            </div>
            {pacientesEncontrados && pacientesEncontrados.length > 0 && (
              <div className="mt-2 max-h-40 space-y-1 overflow-auto rounded-lg border bg-background p-1">
                {pacientesEncontrados.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => selecionarPaciente(p)}
                    className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    <span className="font-medium">{p.nome}</span>
                    {p.cpf && <span className="ml-2 text-muted-foreground">· {p.cpf}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <FieldRow label="Nome do Paciente *"><Input value={pacNome} onChange={(e) => setPacNome(e.target.value)} required /></FieldRow>
          <FieldRow label="Endereço *"><Input value={pacEndereco} onChange={(e) => setPacEndereco(e.target.value)} required /></FieldRow>
          <FieldRow label="Cidade/Estado/CEP *"><Input value={pacCidade} onChange={(e) => setPacCidade(e.target.value)} required /></FieldRow>
          <FieldRow label="CPF *"><Input value={pacCpf} onChange={(e) => setPacCpf(e.target.value)} required /></FieldRow>
          <FieldRow label="Autorização ANVISA *"><Input value={pacAnvisa} onChange={(e) => setPacAnvisa(e.target.value)} required /></FieldRow>
          <FieldRow label="Validade ANVISA *"><Input type="date" value={pacAnvisaValidade} onChange={(e) => setPacAnvisaValidade(e.target.value)} required /></FieldRow>
          <FieldRow label="Email *"><Input type="email" value={pacEmail} onChange={(e) => setPacEmail(e.target.value)} required /></FieldRow>

          {tipo === 'donation' && (
            <FieldRow label="Nº Paciente na ONG"><Input value={pacNumeroOng} onChange={(e) => setPacNumeroOng(e.target.value)} /></FieldRow>
          )}
          {tipo === 'judicialization' && (
            <FieldRow label="Telefone"><Input value={pacTelefone} onChange={(e) => setPacTelefone(e.target.value)} /></FieldRow>
          )}
        </CardContent>
      </Card>

      {/* Jurídico - só para judicialização */}
      {tipo === 'judicialization' && (
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base">Informações Jurídicas</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <FieldRow label="Nº do Processo"><Input value={processoNumero} onChange={(e) => setProcessoNumero(e.target.value)} /></FieldRow>
            <FieldRow label="Fonte Pagadora"><Input value={fontePagadora} onChange={(e) => setFontePagadora(e.target.value)} /></FieldRow>
            <FieldRow label="Segredo de Justiça"><Input value={segredoJustica} onChange={(e) => setSegredoJustica(e.target.value)} /></FieldRow>
          </CardContent>
        </Card>
      )}

      {/* Produtos */}
      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-base">Produtos</CardTitle></CardHeader>
        <CardContent>
          <ProductTable products={products} onChange={setProducts} />
        </CardContent>
      </Card>

      {/* Totais */}
      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-base">Totais</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <FieldRow label="Subtotal (USD)"><Input value={subtotal.toFixed(2)} readOnly className="font-medium" /></FieldRow>
          <FieldRow label="Frete (USD)"><Input type="number" step="0.01" value={frete} onChange={(e) => setFrete(e.target.value)} /></FieldRow>
          <FieldRow label="Seguro (USD)"><Input type="number" step="0.01" value={seguro} onChange={(e) => setSeguro(e.target.value)} /></FieldRow>
          <FieldRow label="TOTAL (USD)"><Input value={total.toFixed(2)} readOnly className="text-lg font-bold" /></FieldRow>
          <FieldRow label="Total por Extenso"><Input value={totalPorExtenso} readOnly className="text-sm text-muted-foreground" /></FieldRow>
          <FieldRow label="Equivalente em BRL"><Input type="number" step="0.01" value={equivalenteBrl} onChange={(e) => setEquivalenteBrl(e.target.value)} /></FieldRow>
        </CardContent>
      </Card>

      {/* Pagamento e envio - só judicialization */}
      {tipo === 'judicialization' && (
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base">Pagamento e Envio</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <FieldRow label="Método de Pagamento"><Input value={metPagamento} onChange={(e) => setMetPagamento(e.target.value)} /></FieldRow>
            <FieldRow label="Prazo de Pagamento"><Input type="date" value={prazoPagamento} onChange={(e) => setPrazoPagamento(e.target.value)} /></FieldRow>
            <FieldRow label="Incoterms"><Input value={incoterms} onChange={(e) => setIncoterms(e.target.value)} /></FieldRow>
            <FieldRow label="Método de Envio"><Input value={metEnvio} onChange={(e) => setMetEnvio(e.target.value)} /></FieldRow>
            <FieldRow label="Entrega Estimada"><Input type="date" value={entregaEstimada} onChange={(e) => setEntregaEstimada(e.target.value)} /></FieldRow>
          </CardContent>
        </Card>
      )}

      {/* Assinatura */}
      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-base">Assinatura</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <FieldRow label="Local *"><Input value={assinaturaLocal} onChange={(e) => setAssinaturaLocal(e.target.value)} required /></FieldRow>
          <FieldRow label="Data *"><Input type="date" value={assinaturaData} onChange={(e) => setAssinaturaData(e.target.value)} required /></FieldRow>
        </CardContent>
      </Card>

      {/* Ações */}
      <div className="flex items-center justify-between border-t pt-6">
        <Button type="button" variant="outline" onClick={() => router.push('/admin/invoices')}>
          Cancelar
        </Button>
        <div className="flex gap-3">
          {isEdit && (
            <a href={`/api/invoices/${invoice.id}/pdf`} target="_blank" rel="noopener noreferrer">
              <Button type="button" variant="outline" className="gap-2">
                <FileText size={16} /> Ver PDF
              </Button>
            </a>
          )}
          <Button type="submit" disabled={saving || !tipo} className="gap-2">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {isEdit ? 'Atualizar' : 'Salvar'} Invoice
          </Button>
        </div>
      </div>
    </form>
  );
}
