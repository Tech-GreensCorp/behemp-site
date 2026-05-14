'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
} from 'lucide-react';
import { uploadDocumentoPaciente, listarDocumentosPaciente } from '@/app/_actions/documentos-paciente-self';
import Link from 'next/link';

const TIPO_LABELS: Record<string, string> = {
  rg: 'RG',
  receita_medica: 'Receita Médica',
  comprovante_residencia: 'Comprovante de Residência',
  autorizacao_anvisa: 'Autorização Anvisa',
  oficio_anvisa: 'Ofício da Anvisa',
  documento_pessoal: 'Documento Pessoal',
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

  // Agrupar por tipo
  const agrupados = docs.reduce((acc: Record<string, any[]>, d) => {
    const key = d.tipo || 'outro';
    if (!acc[key]) acc[key] = [];
    acc[key].push(d);
    return acc;
  }, {});

  if (carregando) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Meus Documentos</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Documentos vinculados ao seu tratamento</p>
        </div>
        {!mostrarForm && (
          <Button className="gap-2 rounded-xl" onClick={() => setMostrarForm(true)}>
            <Upload className="h-4 w-4" />
            Enviar Documento
          </Button>
        )}
      </div>

      {/* Formulário inline */}
      {mostrarForm && (
        <Card className="border-border/40 shadow-sm animate-fade-up">
          <CardHeader className="flex-row items-center justify-between border-b border-border/30 pb-4">
            <CardTitle className="font-heading text-base">Enviar Documento</CardTitle>
            <button
              onClick={() => setMostrarForm(false)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X size={14} />
            </button>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Tipo */}
              <div className="space-y-1.5">
                <Label>Tipo de Documento <span className="text-destructive">*</span></Label>
                <Select value={tipo} onValueChange={(v) => setTipo(v ?? '')}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione">
                      {tipo ? (TIPO_LABELS[tipo] ?? tipo) : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rg">RG</SelectItem>
                    <SelectItem value="receita_medica">Receita Médica</SelectItem>
                    <SelectItem value="comprovante_residencia">Comprovante de Residência</SelectItem>
                    <SelectItem value="autorizacao_anvisa">Autorização Anvisa</SelectItem>
                    <SelectItem value="oficio_anvisa">Ofício da Anvisa</SelectItem>
                    <SelectItem value="documento_pessoal">Documento Pessoal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Data */}
              <div className="space-y-1.5">
                <Label>Data do Documento <span className="text-destructive">*</span></Label>
                <Input
                  type="date"
                  value={dataEmissao}
                  onChange={(e) => setDataEmissao(e.target.value)}
                />
              </div>
            </div>

            {/* Arquivo */}
            <div className="space-y-1.5">
              <Label>Arquivo (máx. 100MB) — PDF, JPG, PNG <span className="text-destructive">*</span></Label>
              <Input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setMostrarForm(false)} disabled={salvando}>
                Cancelar
              </Button>
              <Button
                onClick={handleUpload}
                disabled={salvando || !tipo || !dataEmissao}
                className="gap-2 rounded-xl"
              >
                {salvando ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                {salvando ? 'Enviando...' : 'Enviar'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de documentos */}
      {Object.keys(agrupados).length === 0 ? (
        <Card className="border-border/40 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <FileText className="h-7 w-7 text-primary/60" />
            </div>
            <p className="text-base font-medium">Nenhum documento enviado</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Clique em &quot;Enviar Documento&quot; para adicionar
            </p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(agrupados).map(([tipoKey, items]) => (
          <div key={tipoKey} className="space-y-3 animate-fade-up">
            <h3 className="font-heading text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {TIPO_LABELS[tipoKey] ?? tipoKey}
            </h3>
            {items.map((doc: any) => {
              const vencido = new Date(doc.dataValidade) < new Date();
              return (
                <Card key={doc.id} className="border-border/40 shadow-sm transition-shadow hover:shadow-md">
                  <CardContent className="flex items-center justify-between gap-4 p-4">
                    {/* Info */}
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                        <FileCheck size={18} className="text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{doc.nomeArquivo}</p>
                        <p className="text-xs text-muted-foreground">
                          Emissão: {new Date(doc.dataEmissao + 'T00:00:00').toLocaleDateString('pt-BR')}
                          {' · '}
                          Validade: {new Date(doc.dataValidade + 'T00:00:00').toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant={vencido ? 'destructive' : 'outline'}>
                        {vencido ? 'Vencido' : 'Válido'}
                      </Badge>
                      <a href={doc.urlBlob} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm" className="gap-1.5">
                          <ExternalLink size={13} /> Ver
                        </Button>
                      </a>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
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
        ))
      )}

      {/* Voltar ao perfil */}
      <div className="pt-2">
        <Link
          href="/paciente/perfil"
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          ← Voltar ao Meu Perfil
        </Link>
      </div>
    </div>
  );
}
