'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { HugeiconsIcon } from '@hugeicons/react';
import { Loading03Icon, Add01Icon, FileValidationIcon } from '@hugeicons/core-free-icons';
import { uploadDocumento, listarDocumentos } from '@/app/_actions/documentos-paciente';
import { toast } from 'sonner';

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
    const fd = new FormData();
    fd.append('pacienteId', pacienteId);
    fd.append('tipo', tipo);
    fd.append('dataEmissao', dataEmissao);
    fd.append('arquivo', file);
    const res = await uploadDocumento(fd);
    setSalvando(false);
    if (res.sucesso) {
      toast.success('Documento enviado com sucesso!');
      setMostrarForm(false); setTipo(''); setDataEmissao('');
      if (fileRef.current) fileRef.current.value = '';
      await carregar();
    } else { toast.error(res.erro || 'Erro ao enviar'); }
  }

  // Agrupar por tipo
  const agrupados = docs.reduce((acc: Record<string, any[]>, d) => {
    const key = d.tipo || 'outro';
    if (!acc[key]) acc[key] = [];
    acc[key].push(d);
    return acc;
  }, {});

  if (carregando) return <div className="flex justify-center py-16"><HugeiconsIcon icon={Loading03Icon} size={32} className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold">Documentos</h2>
        {!mostrarForm && <Button size="sm" className="gap-2 rounded-xl" onClick={() => setMostrarForm(true)}><HugeiconsIcon icon={Add01Icon} size={14} /> Enviar Documento</Button>}
      </div>

      {mostrarForm && (
        <Card className="border-border/40 shadow-sm">
          <CardHeader className="border-b border-border/30 pb-4"><CardTitle className="font-heading text-base">Enviar Documento</CardTitle></CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Tipo de Documento *</Label>
                <Select value={tipo} onValueChange={v => setTipo(v ?? '')}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
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
              <Label>Arquivo (máx. 10MB) — PDF, JPG, PNG</Label>
              <Input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="mt-1" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setMostrarForm(false)}>Cancelar</Button>
              <Button onClick={handleUpload} disabled={salvando || !tipo || !dataEmissao} className="gap-2 rounded-xl">
                {salvando ? <HugeiconsIcon icon={Loading03Icon} size={16} className="animate-spin" /> : <HugeiconsIcon icon={Add01Icon} size={16} />}
                {salvando ? 'Enviando...' : 'Enviar'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {Object.keys(agrupados).length === 0 && !mostrarForm ? (
        <Card className="border-border/40 shadow-sm"><CardContent className="flex flex-col items-center justify-center py-16">
          <p className="text-lg font-medium">Nenhum documento enviado</p>
          <p className="text-sm text-muted-foreground">Clique em "Enviar Documento" para adicionar</p>
        </CardContent></Card>
      ) : (
        Object.entries(agrupados).map(([tipoKey, items]) => (
          <div key={tipoKey} className="space-y-3">
            <h3 className="font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground">{TIPO_LABELS[tipoKey] ?? tipoKey}</h3>
            {items.map((doc: any) => (
              <Card key={doc.id} className="border-border/40 shadow-sm">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C08E3A]/10">
                      <HugeiconsIcon icon={FileValidationIcon} size={18} className="text-[#C08E3A]" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{doc.nomeArquivo}</p>
                      <p className="text-xs text-muted-foreground">Emissão: {new Date(doc.dataEmissao + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={new Date(doc.dataValidade) < new Date() ? 'destructive' : 'outline'}>
                      {new Date(doc.dataValidade) < new Date() ? 'Vencido' : 'Válido'}
                    </Badge>
                    <a href={doc.urlBlob} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm">Ver</Button>
                    </a>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
