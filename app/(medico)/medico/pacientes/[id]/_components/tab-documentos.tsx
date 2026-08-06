'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { listarDocumentos, excluirDocumento } from '@/app/_actions/documentos-paciente';
import { toast } from 'sonner';
import {
  Download,
  ExternalLink,
  FileCheck,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';

const TIPO_LABELS: Record<string, string> = {
  documento_pessoal: 'Documento Pessoal', comprovante_residencia: 'Comprovante de Residência',
  oficio_anvisa: 'Ofício da Anvisa', receita_medica: 'Receita Médica',
  rg: 'RG', rg_responsavel: 'RG Responsável', autorizacao_anvisa: 'Autorização Anvisa',
};

interface TabDocumentosProps { pacienteId: string }

export function TabDocumentos({ pacienteId }: TabDocumentosProps) {
  const [docs, setDocs] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [tipo, setTipo] = useState('');
  const [dataEmissao, setDataEmissao] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Estado de exclusão
  const [docParaExcluir, setDocParaExcluir] = useState<{ id: string; nome: string } | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const res = await listarDocumentos(pacienteId);
    if (res.sucesso && res.dados) setDocs(res.dados);
    setCarregando(false);
  }, [pacienteId]);

  useEffect(() => { carregar(); }, [carregar]);

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file || !tipo || !dataEmissao) { toast.error('Preencha todos os campos obrigatórios'); return; }
    setSalvando(true);
    try {
      const fd = new FormData();
      fd.append('pacienteId', pacienteId);
      fd.append('tipo', tipo);
      fd.append('dataEmissao', dataEmissao);
      fd.append('arquivo', file);

      const response = await fetch('/api/upload-documento', {
        method: 'POST',
        body: fd,
      });
      const res = await response.json();

      if (res.sucesso) {
        toast.success('Documento enviado com sucesso!');
        setMostrarForm(false); setTipo(''); setDataEmissao('');
        if (fileRef.current) fileRef.current.value = '';
        await carregar();
      } else {
        toast.error(res.erro || 'Erro ao enviar');
      }
    } catch {
      toast.error('Erro ao enviar documento. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  /** Força download do arquivo (não apenas abertura em nova aba) */
  async function handleDownload(url: string, nomeArquivo: string) {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = nomeArquivo;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch {
      // Fallback: abre em nova aba se o download falhar (CORS)
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  async function handleExcluir() {
    if (!docParaExcluir) return;
    setExcluindo(true);
    try {
      const res = await excluirDocumento(docParaExcluir.id);
      if (res.sucesso) {
        toast.success('Documento excluído com sucesso');
        setDocParaExcluir(null);
        await carregar();
      } else {
        toast.error(res.erro || 'Erro ao excluir');
      }
    } catch {
      toast.error('Erro ao excluir documento. Tente novamente.');
    } finally {
      setExcluindo(false);
    }
  }

  // Agrupar por tipo
  const agrupados = docs.reduce((acc: Record<string, any[]>, d) => {
    const key = d.tipo || 'outro';
    if (!acc[key]) acc[key] = [];
    acc[key].push(d);
    return acc;
  }, {});

  if (carregando) return <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold">Documentos</h2>
        {!mostrarForm && <Button size="sm" className="gap-2 rounded-xl" onClick={() => setMostrarForm(true)}><Plus size={14} /> Enviar Documento</Button>}
      </div>

      {mostrarForm && (
        <Card className="border-border/40 shadow-sm">
          <CardHeader className="border-b border-border/30 pb-4"><CardTitle className="font-heading text-base">Enviar Documento</CardTitle></CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Tipo de Documento *</Label>
                <Select value={tipo} onValueChange={v => setTipo(v ?? '')}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione">
                      {tipo ? (TIPO_LABELS[tipo] ?? tipo) : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="documento_pessoal">Documento Pessoal</SelectItem>
                    <SelectItem value="comprovante_residencia">Comprovante de Residência</SelectItem>
                    <SelectItem value="oficio_anvisa">Ofício da Anvisa</SelectItem>
                    <SelectItem value="receita_medica">Receita Médica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Data do Documento *</Label><Input type="date" value={dataEmissao} onChange={e => setDataEmissao(e.target.value)} /></div>
            </div>
            <div>
              <Label>Arquivo (máx. 100MB) — PDF, JPG, PNG</Label>
              <Input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="mt-1" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setMostrarForm(false)}>Cancelar</Button>
              <Button onClick={handleUpload} disabled={salvando || !tipo || !dataEmissao} className="gap-2 rounded-xl">
                {salvando ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                {salvando ? 'Enviando...' : 'Enviar'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {Object.keys(agrupados).length === 0 && !mostrarForm ? (
        <Card className="border-border/40 shadow-sm"><CardContent className="flex flex-col items-center justify-center py-16">
          <p className="text-lg font-medium">Nenhum documento enviado</p>
          <p className="text-sm text-muted-foreground">Clique em &quot;Enviar Documento&quot; para adicionar</p>
        </CardContent></Card>
      ) : (
        Object.entries(agrupados).map(([tipoKey, items]) => (
          <div key={tipoKey} className="space-y-3">
            <h3 className="font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground">{TIPO_LABELS[tipoKey] ?? tipoKey}</h3>
            {items.map((doc: any) => {
              const vencido = new Date(doc.dataValidade) < new Date();
              return (
                <Card key={doc.id} className="border-border/40 shadow-sm transition-shadow hover:shadow-md">
                  <CardContent className="flex items-center justify-between gap-4 p-4">
                    {/* Info do arquivo */}
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#C08E3A]/10">
                        <FileCheck size={18} className="text-[#C08E3A]" />
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

                      {/* Visualizar */}
                      <a href={doc.urlBlob} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm" className="gap-1.5">
                          <ExternalLink size={13} />
                          Ver
                        </Button>
                      </a>

                      {/* Baixar */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => handleDownload(doc.urlBlob, doc.nomeArquivo ?? 'documento')}
                      >
                        <Download size={13} />
                        Baixar
                      </Button>

                      {/* Excluir */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-destructive hover:border-destructive/50 hover:bg-destructive/5 hover:text-destructive"
                        onClick={() => setDocParaExcluir({ id: doc.id, nome: doc.nomeArquivo ?? 'documento' })}
                      >
                        <Trash2 size={13} />
                        Excluir
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ))
      )}

      {/* Diálogo de confirmação de exclusão */}
      <AlertDialog open={!!docParaExcluir} onOpenChange={(open) => { if (!open) setDocParaExcluir(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documento?</AlertDialogTitle>
            <AlertDialogDescription>
              O arquivo <strong>{docParaExcluir?.nome}</strong> será removido permanentemente do perfil do paciente.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExcluir}
              disabled={excluindo}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-1.5"
            >
              {excluindo ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              {excluindo ? 'Excluindo...' : 'Sim, excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
