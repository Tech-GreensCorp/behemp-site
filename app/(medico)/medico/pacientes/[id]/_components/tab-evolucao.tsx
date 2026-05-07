'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { HugeiconsIcon } from '@hugeicons/react';
import { Loading03Icon, Add01Icon, ArrowUp01Icon, ArrowDown01Icon, MinusSignIcon } from '@hugeicons/core-free-icons';
import { criarEvolucao, listarEvolucoes } from '@/app/_actions/evolucoes';
import { toast } from 'sonner';

const TIPO_COLORS: Record<string, string> = { positiva: 'bg-emerald-100 text-emerald-800', estavel: 'bg-amber-100 text-amber-800', negativa: 'bg-red-100 text-red-800' };
const TIPO_LABELS: Record<string, string> = { positiva: 'Positiva', estavel: 'Estável', negativa: 'Negativa' };

interface TabEvolucaoProps { pacienteId: string }

export function TabEvolucao({ pacienteId }: TabEvolucaoProps) {
  const [evolucoes, setEvolucoes] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({
    data: '', tipo: '' as string, sintomasAtuais: '', efeitosColaterais: '',
    nivelDor: 0, qualidadeSono: '' as string, bemEstar: '' as string, conteudo: '',
  });

  const carregar = useCallback(async () => {
    setCarregando(true);
    const res = await listarEvolucoes(pacienteId);
    if (res.sucesso && res.dados) setEvolucoes(res.dados);
    setCarregando(false);
  }, [pacienteId]);

  useEffect(() => { carregar(); }, [carregar]);

  function u(campo: string, valor: any) { setForm(p => ({ ...p, [campo]: valor })); }

  async function handleSalvar() {
    setSalvando(true);
    const res = await criarEvolucao({
      pacienteId, ...form,
      tipo: form.tipo as 'positiva' | 'estavel' | 'negativa',
      nivelDor: form.nivelDor || undefined,
      qualidadeSono: (form.qualidadeSono || undefined) as 'ruim' | 'regular' | 'boa' | 'excelente' | undefined,
      bemEstar: (form.bemEstar || undefined) as 'ruim' | 'regular' | 'boa' | 'excelente' | undefined,
    });
    setSalvando(false);
    if (res.sucesso) {
      toast.success('Evolução registrada!');
      setAberto(false);
      setForm({ data: '', tipo: '', sintomasAtuais: '', efeitosColaterais: '', nivelDor: 0, qualidadeSono: '', bemEstar: '', conteudo: '' });
      await carregar();
    } else { toast.error(res.erro || 'Erro ao salvar'); }
  }

  const TipoIcon = ({ tipo }: { tipo: string }) => {
    if (tipo === 'positiva') return <HugeiconsIcon icon={ArrowUp01Icon} size={16} className="text-emerald-600" />;
    if (tipo === 'negativa') return <HugeiconsIcon icon={ArrowDown01Icon} size={16} className="text-red-600" />;
    return <HugeiconsIcon icon={MinusSignIcon} size={16} className="text-amber-600" />;
  };

  if (carregando) return <div className="flex justify-center py-16"><HugeiconsIcon icon={Loading03Icon} size={32} className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold">Evoluções</h2>
        <Dialog open={aberto} onOpenChange={setAberto}>
          <DialogTrigger><Button size="sm" className="gap-2 rounded-xl"><HugeiconsIcon icon={Add01Icon} size={14} /> Nova Evolução</Button></DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader><DialogTitle className="font-heading">Nova Evolução</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <div><Label>Data *</Label><Input type="date" value={form.data} onChange={e => u('data', e.target.value)} /></div>
                <div>
                  <Label>Tipo de Evolução *</Label>
                  <Select value={form.tipo} onValueChange={v => u('tipo', v)}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent><SelectItem value="positiva">Positiva</SelectItem><SelectItem value="estavel">Estável</SelectItem><SelectItem value="negativa">Negativa</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Sintomas Atuais</Label><Textarea value={form.sintomasAtuais} onChange={e => u('sintomasAtuais', e.target.value)} rows={2} /></div>
              <div><Label>Efeitos Colaterais</Label><Textarea value={form.efeitosColaterais} onChange={e => u('efeitosColaterais', e.target.value)} rows={2} /></div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div><Label>Nível de Dor (0-10)</Label><Input type="number" min={0} max={10} value={form.nivelDor} onChange={e => u('nivelDor', Number(e.target.value))} /></div>
                <div>
                  <Label>Qualidade do Sono</Label>
                  <Select value={form.qualidadeSono} onValueChange={v => u('qualidadeSono', v)}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent><SelectItem value="ruim">Ruim</SelectItem><SelectItem value="regular">Regular</SelectItem><SelectItem value="boa">Boa</SelectItem><SelectItem value="excelente">Excelente</SelectItem></SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Bem-estar Geral</Label>
                  <Select value={form.bemEstar} onValueChange={v => u('bemEstar', v)}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent><SelectItem value="ruim">Ruim</SelectItem><SelectItem value="regular">Regular</SelectItem><SelectItem value="boa">Boa</SelectItem><SelectItem value="excelente">Excelente</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Observações *</Label><Textarea value={form.conteudo} onChange={e => u('conteudo', e.target.value)} rows={3} /></div>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setAberto(false)}>Cancelar</Button>
                <Button onClick={handleSalvar} disabled={salvando || !form.data || !form.tipo || !form.conteudo} className="gap-2 rounded-xl">
                  {salvando ? <HugeiconsIcon icon={Loading03Icon} size={16} className="animate-spin" /> : null}
                  {salvando ? 'Salvando...' : 'Registrar'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {evolucoes.length === 0 ? (
        <Card className="border-border/40 shadow-sm"><CardContent className="flex flex-col items-center justify-center py-16">
          <p className="text-lg font-medium">Nenhuma evolução registrada</p>
          <p className="text-sm text-muted-foreground">Clique em "+ Nova Evolução"</p>
        </CardContent></Card>
      ) : (
        evolucoes.map((ev) => (
          <Card key={ev.id} className="border-border/40 shadow-sm">
            <CardContent className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TipoIcon tipo={ev.tipo} />
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${TIPO_COLORS[ev.tipo] ?? ''}`}>{TIPO_LABELS[ev.tipo] ?? ev.tipo}</span>
                  <p className="text-xs text-muted-foreground">{new Date(ev.data + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                </div>
                {ev.nivelDor != null && <Badge variant="outline">Dor: {ev.nivelDor}/10</Badge>}
              </div>
              <p className="text-sm">{ev.conteudo}</p>
              {ev.sintomasAtuais && <p className="mt-2 text-xs text-muted-foreground"><strong>Sintomas:</strong> {ev.sintomasAtuais}</p>}
              {ev.efeitosColaterais && <p className="text-xs text-muted-foreground"><strong>Efeitos Colaterais:</strong> {ev.efeitosColaterais}</p>}
              <div className="mt-2 flex gap-1.5">
                {ev.qualidadeSono && <Badge variant="secondary">Sono: {ev.qualidadeSono}</Badge>}
                {ev.bemEstar && <Badge variant="secondary">Bem-estar: {ev.bemEstar}</Badge>}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
