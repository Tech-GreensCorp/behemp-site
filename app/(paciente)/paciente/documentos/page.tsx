'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Download,
  ExternalLink,
  FileCheck,
  Loader2,
  Plus,
  Upload,
  FileText,
  X,
  Clock,
} from 'lucide-react';
import { uploadDocumentoPaciente, listarDocumentosPaciente } from '@/app/_actions/documentos-paciente-self';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const TIPO_LABELS: Record<string, string> = {
  rg: 'RG',
  receita_medica: 'Receita Médica',
  comprovante_residencia: 'Comprovante de Residência',
  autorizacao_anvisa: 'Autorização ANVISA',
  oficio_anvisa: 'Ofício da ANVISA',
  documento_pessoal: 'Documento Pessoal',
  procuracao_especifica: 'Procuração Específica',
};

export default function DocumentosPacientePage() {
  const [docs, setDocs] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [tipo, setTipo] = useState('');
  const [dataEmissao, setDataEmissao] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const res = await listarDocumentosPaciente();
    if (res.sucesso && res.dados) setDocs(res.dados as any[]);
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) { toast.error('Selecione um arquivo.'); return; }
    if (!tipo) { toast.error('Selecione o tipo de documento.'); return; }
    if (!dataEmissao) { toast.error('Informe a data do documento.'); return; }

    setSalvando(true);
    try {
      const fd = new FormData();
      fd.append('tipo', tipo);
      fd.append('dataEmissao', dataEmissao);
      fd.append('arquivo', file);

      const res = await uploadDocumentoPaciente(fd);

      if (res.sucesso) {
        toast.success('Documento enviado com sucesso!');
        setMostrarForm(false);
        setTipo('');
        setDataEmissao('');
        if (fileRef.current) fileRef.current.value = '';
        await carregar();
      } else {
        toast.error(res.erro || 'Erro ao enviar.');
      }
    } catch {
      toast.error('Erro inesperado. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  async function handleDownload(url: string, nome: string) {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = nome;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  const agrupados = docs.reduce((acc: Record<string, any[]>, d) => {
    const key = d.tipo || 'outro';
    if (!acc[key]) acc[key] = [];
    acc[key].push(d);
    return acc;
  }, {});

  if (carregando) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-10">

      {/* Voltar ao perfil (Posicionado elegantemente no topo) */}
      <div className="animate-fade-up">
        <Link
          href="/paciente/perfil"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors group"
        >
          <span className="transition-transform group-hover:-translate-x-1">&larr;</span> Voltar ao Meu Perfil
        </Link>
      </div>

      {/* ── Header Editorial ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-up">
        <div>
          <p className="text-primary mb-2 text-xs font-semibold tracking-[0.25em] uppercase">
            Acolhimento
          </p>
          <h1 className="font-display text-4xl leading-[1.1] font-bold tracking-tight text-foreground">
            Meus <span className="text-accent-italic">Documentos</span>
          </h1>
          <p className="text-muted-foreground mt-3 max-w-2xl text-sm leading-relaxed">
            Envie e gerencie os documentos necessários para validação e conformidade legal do seu tratamento.
          </p>
        </div>
        {!mostrarForm && (
          <Button 
            className="rounded-full bg-[#16a34a] hover:bg-[#148f43] text-white font-semibold shadow-md hover:shadow-lg transition-all duration-200 px-6 py-2.5 text-sm cursor-pointer border-0 shrink-0 self-start sm:self-center" 
            onClick={() => setMostrarForm(true)}
          >
            <Upload className="h-4 w-4 mr-2" />
            Enviar Documento
          </Button>
        )}
      </div>

      {/* Formulário inline */}
      {mostrarForm && (
        <Card className="border border-border/30 shadow-sm rounded-3xl bg-card grain animate-fade-up overflow-hidden">
          <CardHeader className="flex-row items-center justify-between border-b border-border/20 pb-4 p-6 bg-muted/10">
            <CardTitle className="font-heading text-base font-bold text-foreground">Novo Documento</CardTitle>
            <button
              onClick={() => setMostrarForm(false)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X size={14} />
            </button>
          </CardHeader>
          <CardContent className="space-y-5 p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Tipo */}
              <div className="space-y-1.5">
                <Label htmlFor="doc-tipo" className="text-xs text-muted-foreground font-semibold">Tipo de Documento <span className="text-destructive">*</span></Label>
                <select
                  id="doc-tipo"
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                  className="flex h-9 w-full rounded-xl border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Selecione</option>
                  <option value="rg">RG</option>
                  <option value="receita_medica">Receita Médica</option>
                  <option value="comprovante_residencia">Comprovante de Residência</option>
                  <option value="autorizacao_anvisa">Autorização Anvisa</option>
                  <option value="oficio_anvisa">Ofício da Anvisa</option>
                  <option value="documento_pessoal">Documento Pessoal</option>
                </select>
              </div>

              {/* Data */}
              <div className="space-y-1.5">
                <Label htmlFor="doc-data" className="text-xs text-muted-foreground font-semibold">Data do Documento <span className="text-destructive">*</span></Label>
                <Input
                  id="doc-data"
                  type="date"
                  value={dataEmissao}
                  onChange={(e) => setDataEmissao(e.target.value)}
                  className="rounded-xl border-border/40 h-9"
                />
              </div>
            </div>

            {/* Arquivo */}
            <div className="space-y-1.5">
              <Label htmlFor="doc-file" className="text-xs text-muted-foreground font-semibold">Arquivo (máx. 100MB) — PDF, JPG, PNG <span className="text-destructive">*</span></Label>
              <Input id="doc-file" ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="rounded-xl border-border/40 file:rounded-lg file:border-border/40" />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" className="rounded-full px-5 text-xs font-semibold" onClick={() => setMostrarForm(false)} disabled={salvando}>
                Cancelar
              </Button>
              <Button
                onClick={handleUpload}
                disabled={salvando || !tipo || !dataEmissao}
                className="gap-2 rounded-full px-6 text-xs font-semibold bg-[#16a34a] hover:bg-[#148f43] text-white border-0"
              >
                {salvando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {salvando ? 'Enviando...' : 'Enviar'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de documentos */}
      {Object.keys(agrupados).length === 0 ? (
        <Card className="border border-border/30 bg-white shadow-sm rounded-3xl overflow-hidden transition-all hover:shadow-md animate-fade-up max-w-lg mx-auto">
          <CardContent className="flex flex-col items-center justify-center p-8 sm:p-12 text-center relative grain">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <FileText className="h-8 w-8" />
            </div>
            <h3 className="font-display text-2xl font-bold text-foreground">Nenhum documento enviado</h3>
            <p className="mt-3 text-sm text-muted-foreground max-w-xs leading-relaxed">
              Clique em <strong className="text-primary font-semibold">&quot;Enviar Documento&quot;</strong> para adicionar
            </p>
            {!mostrarForm && (
              <Button 
                className="mt-6 rounded-full bg-[#16a34a] hover:bg-[#148f43] text-white font-semibold shadow-md hover:shadow-lg transition-all duration-200 px-6 py-2.5 text-sm cursor-pointer border-0" 
                onClick={() => setMostrarForm(true)}
              >
                <Upload className="h-4 w-4 mr-2" />
                Enviar Documento
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8 animate-fade-up">
          {Object.entries(agrupados).map(([tipoKey, items]) => (
            <div key={tipoKey} className="space-y-3">
              <h3 className="font-heading text-xs font-bold uppercase tracking-widest text-muted-foreground/60 px-1">
                {TIPO_LABELS[tipoKey] ?? tipoKey}
              </h3>
              <div className="grid gap-3">
                {items.map((doc: any) => {
                  const vencido = new Date(doc.dataValidade) < new Date();
                  return (
                    <Card key={doc.id} className="border border-border/30 bg-white shadow-sm rounded-3xl overflow-hidden transition-all hover:shadow-md">
                      <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5">
                        
                        {/* Info */}
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                            <FileCheck size={18} className="text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground leading-snug">{doc.nomeArquivo}</p>
                            <p className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-1.5">
                              <span>Emissão: {new Date(doc.dataEmissao + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                              <span>·</span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Validade: {new Date(doc.dataValidade + 'T00:00:00').toLocaleDateString('pt-BR')}
                              </span>
                            </p>
                          </div>
                        </div>

                        {/* Ações */}
                        <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-end sm:self-center">
                          <Badge className={cn(
                            "border-0 font-bold text-[10px] py-0.5 px-2 rounded-full",
                            vencido ? 'bg-red-500/10 text-red-600' : 'bg-emerald-500/10 text-emerald-700'
                          )}>
                            {vencido ? 'Vencido' : 'Válido'}
                          </Badge>
                          <a href={doc.urlBlob} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="sm" className="gap-1.5 rounded-full text-xs h-8 border-border/40 hover:bg-accent">
                              <ExternalLink size={13} /> Ver
                            </Button>
                          </a>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 rounded-full text-xs h-8 border-border/40 hover:bg-accent"
                            onClick={() => handleDownload(doc.urlBlob, doc.nomeArquivo ?? 'documento')}
                          >
                            <Download size={13} /> Baixar
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}


    </div>
  );
}
