'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { criarExame, listarExames } from '@/app/_actions/exames';
import { toast } from 'sonner';
import {
  Loader2,
  Microscope,
  Plus,
} from 'lucide-react';

interface TabExamesProps { pacienteId: string }

export function TabExames({ pacienteId }: TabExamesProps) {
  const [exames, setExames] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [nomeExame, setNomeExame] = useState('');
  const [dataExame, setDataExame] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const res = await listarExames(pacienteId);
    if (res.sucesso && res.dados) setExames(res.dados);
    setCarregando(false);
  }, [pacienteId]);

  useEffect(() => { carregar(); }, [carregar]);

  async function handleSalvar() {
    if (!nomeExame || !dataExame) { toast.error('Preencha os campos obrigatórios'); return; }
    setSalvando(true);
    const fd = new FormData();
    fd.append('pacienteId', pacienteId);
    fd.append('nomeExame', nomeExame);
    fd.append('dataExame', dataExame);
    fd.append('observacoes', observacoes);
    const file = fileRef.current?.files?.[0];
    if (file) fd.append('arquivo', file);
    const res = await criarExame(fd);
    setSalvando(false);
    if (res.sucesso) {
      toast.success('Exame registrado com sucesso!');
      setMostrarForm(false); setNomeExame(''); setDataExame(''); setObservacoes('');
      if (fileRef.current) fileRef.current.value = '';
      await carregar();
    } else { toast.error(res.erro || 'Erro ao salvar'); }
  }

  if (carregando) return <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold">Exames</h2>
        {!mostrarForm && <Button size="sm" className="gap-2 rounded-xl" onClick={() => setMostrarForm(true)}><Plus size={14} /> Novo Exame</Button>}
      </div>

      {mostrarForm && (
        <Card className="border-border/40 shadow-sm">
          <CardHeader className="border-b border-border/30 pb-4"><CardTitle className="font-heading text-base">Novo Exame</CardTitle></CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label>Nome do Exame *</Label><Input value={nomeExame} onChange={e => setNomeExame(e.target.value)} placeholder="Ex: Hemograma completo" /></div>
              <div><Label>Data do Exame *</Label><Input type="date" value={dataExame} onChange={e => setDataExame(e.target.value)} /></div>
            </div>
            <div><Label>Observações</Label><Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} /></div>
            <div><Label>Arquivo do Exame (máx. 10MB) — PDF, JPG, PNG</Label><Input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="mt-1" /></div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setMostrarForm(false)}>Cancelar</Button>
              <Button onClick={handleSalvar} disabled={salvando || !nomeExame || !dataExame} className="gap-2 rounded-xl">
                {salvando ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                {salvando ? 'Salvando...' : 'Registrar Exame'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {exames.length === 0 && !mostrarForm ? (
        <Card className="border-border/40 shadow-sm"><CardContent className="flex flex-col items-center justify-center py-16">
          <p className="text-lg font-medium">Nenhum exame registrado</p>
          <p className="text-sm text-muted-foreground">Clique em "Novo Exame" para adicionar</p>
        </CardContent></Card>
      ) : (
        exames.map((e) => (
          <Card key={e.id} className="border-border/40 shadow-sm">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
                  <Microscope size={18} className="text-blue-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">{e.nomeExame}</p>
                  <p className="text-xs text-muted-foreground">{new Date(e.dataExame + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                  {e.observacoes && <p className="mt-0.5 text-xs text-muted-foreground">{e.observacoes}</p>}
                </div>
              </div>
              {e.urlArquivo && (
                <a href={e.urlArquivo} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm">Ver Arquivo</Button>
                </a>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
