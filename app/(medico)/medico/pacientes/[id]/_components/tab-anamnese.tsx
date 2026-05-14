'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { criarAnamnese, listarAnamneses } from '@/app/_actions/anamneses';
import { toast } from 'sonner';
import {
  CheckCircle2,
  Loader2,
  Plus,
} from 'lucide-react';

const TABAGISMO_LABELS: Record<string, string> = { nunca_fumou: 'Nunca fumou', ex_fumante: 'Ex-fumante', fumante: 'Fumante' };
const ALCOOL_LABELS: Record<string, string> = { nao_consome: 'Não consome', regular: 'Regular', ocasional: 'Ocasional' };
const SONO_LABELS: Record<string, string> = { ruim: 'Ruim', regular: 'Regular', boa: 'Boa', excelente: 'Excelente' };

interface TabAnamneseProps { pacienteId: string }

export function TabAnamnese({ pacienteId }: TabAnamneseProps) {
  const [anamneses, setAnamneses] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({
    queixaPrincipal: '', historiaDoencaAtual: '', doencasPrevias: '', medicamentosEmUso: '',
    alergias: '', historicoFamiliar: '', historiaSocial: '', tabagismo: '' as string,
    consumoAlcool: '' as string, qualidadeSono: '' as string, atividadeFisica: '',
    nivelDor: 0, objetivosTratamento: '', usoPrevioCannabis: false,
  });

  const carregar = useCallback(async () => {
    setCarregando(true);
    const res = await listarAnamneses(pacienteId);
    if (res.sucesso && res.dados) setAnamneses(res.dados);
    setCarregando(false);
  }, [pacienteId]);

  useEffect(() => { carregar(); }, [carregar]);

  function u(campo: string, valor: any) { setForm(p => ({ ...p, [campo]: valor })); }

  async function handleSalvar() {
    setSalvando(true);
    const res = await criarAnamnese({
      pacienteId,
      ...form,
      tabagismo: form.tabagismo as 'nunca_fumou' | 'ex_fumante' | 'fumante',
      consumoAlcool: form.consumoAlcool as 'nao_consome' | 'regular' | 'ocasional',
      qualidadeSono: form.qualidadeSono as 'ruim' | 'regular' | 'boa' | 'excelente',
      nivelDor: form.nivelDor || undefined,
    });
    setSalvando(false);
    if (res.sucesso) {
      toast.success('Anamnese registrada com sucesso!');
      setMostrarForm(false);
      setForm({ queixaPrincipal: '', historiaDoencaAtual: '', doencasPrevias: '', medicamentosEmUso: '', alergias: '', historicoFamiliar: '', historiaSocial: '', tabagismo: '', consumoAlcool: '', qualidadeSono: '', atividadeFisica: '', nivelDor: 0, objetivosTratamento: '', usoPrevioCannabis: false });
      await carregar();
    } else { toast.error(res.erro || 'Erro ao salvar'); }
  }

  if (carregando) return <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold">Anamneses</h2>
        {!mostrarForm && (
          <Button size="sm" className="gap-2 rounded-xl" onClick={() => setMostrarForm(true)}>
            <Plus size={14} /> Nova Anamnese
          </Button>
        )}
      </div>

      {mostrarForm && (
        <Card className="border-border/40 shadow-sm">
          <CardHeader className="border-b border-border/30 pb-4"><CardTitle className="font-heading text-base">Nova Anamnese</CardTitle></CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div><Label>Queixa Principal *</Label><Textarea value={form.queixaPrincipal} onChange={e => u('queixaPrincipal', e.target.value)} rows={2} /></div>
            <div><Label>História da Doença Atual *</Label><Textarea value={form.historiaDoencaAtual} onChange={e => u('historiaDoencaAtual', e.target.value)} rows={3} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label>Doenças Prévias</Label><Textarea value={form.doencasPrevias} onChange={e => u('doencasPrevias', e.target.value)} rows={2} /></div>
              <div><Label>Medicamentos em Uso</Label><Textarea value={form.medicamentosEmUso} onChange={e => u('medicamentosEmUso', e.target.value)} rows={2} /></div>
              <div><Label>Alergias</Label><Input value={form.alergias} onChange={e => u('alergias', e.target.value)} /></div>
              <div><Label>Histórico Familiar</Label><Textarea value={form.historicoFamiliar} onChange={e => u('historicoFamiliar', e.target.value)} rows={2} /></div>
            </div>
            <div><Label>História Social</Label><Textarea value={form.historiaSocial} onChange={e => u('historiaSocial', e.target.value)} rows={2} /></div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label>Tabagismo *</Label>
                <Select value={form.tabagismo} onValueChange={v => u('tabagismo', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione">
                      {form.tabagismo ? (TABAGISMO_LABELS[form.tabagismo] ?? form.tabagismo) : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nunca_fumou">Nunca fumou</SelectItem>
                    <SelectItem value="ex_fumante">Ex-fumante</SelectItem>
                    <SelectItem value="fumante">Fumante</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Consumo de Álcool *</Label>
                <Select value={form.consumoAlcool} onValueChange={v => u('consumoAlcool', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione">
                      {form.consumoAlcool ? (ALCOOL_LABELS[form.consumoAlcool] ?? form.consumoAlcool) : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nao_consome">Não consome</SelectItem>
                    <SelectItem value="regular">Regular</SelectItem>
                    <SelectItem value="ocasional">Ocasional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Qualidade do Sono *</Label>
                <Select value={form.qualidadeSono} onValueChange={v => u('qualidadeSono', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione">
                      {form.qualidadeSono ? (SONO_LABELS[form.qualidadeSono] ?? form.qualidadeSono) : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ruim">Ruim</SelectItem>
                    <SelectItem value="regular">Regular</SelectItem>
                    <SelectItem value="boa">Boa</SelectItem>
                    <SelectItem value="excelente">Excelente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label>Atividade Física</Label><Input value={form.atividadeFisica} onChange={e => u('atividadeFisica', e.target.value)} placeholder="Ex: Caminhada 3x/semana" /></div>
              <div>
                <Label>Nível de Dor (0-10)</Label>
                <Input type="number" min={0} max={10} value={form.nivelDor} onChange={e => u('nivelDor', Number(e.target.value))} />
              </div>
            </div>
            <div><Label>Objetivos do Tratamento</Label><Textarea value={form.objetivosTratamento} onChange={e => u('objetivosTratamento', e.target.value)} rows={2} /></div>
            <div className="flex items-center gap-2">
              <Checkbox checked={form.usoPrevioCannabis} onCheckedChange={v => u('usoPrevioCannabis', !!v)} id="cannabis" />
              <Label htmlFor="cannabis" className="cursor-pointer">Uso prévio de Medicina Endocanabinóide</Label>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setMostrarForm(false)}>Cancelar</Button>
              <Button onClick={handleSalvar} disabled={salvando || !form.queixaPrincipal || !form.tabagismo} className="gap-2 rounded-xl">
                {salvando ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                {salvando ? 'Salvando...' : 'Registrar Anamnese'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {anamneses.length === 0 && !mostrarForm ? (
        <Card className="border-border/40 shadow-sm"><CardContent className="flex flex-col items-center justify-center py-16">
          <p className="text-lg font-medium">Nenhuma anamnese registrada</p>
          <p className="text-sm text-muted-foreground">Clique em "Nova Anamnese" para adicionar</p>
        </CardContent></Card>
      ) : (
        anamneses.map((a) => (
          <Card key={a.id} className="border-border/40 shadow-sm">
            <CardContent className="space-y-3 p-6">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                <div className="flex gap-1.5">
                  <Badge variant="outline">{TABAGISMO_LABELS[a.tabagismo] ?? a.tabagismo}</Badge>
                  <Badge variant="outline">{ALCOOL_LABELS[a.consumoAlcool] ?? a.consumoAlcool}</Badge>
                  <Badge variant="outline">Sono: {SONO_LABELS[a.qualidadeSono] ?? a.qualidadeSono}</Badge>
                </div>
              </div>
              <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Queixa Principal</p><p className="text-sm">{a.queixaPrincipal}</p></div>
              <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">História da Doença Atual</p><p className="text-sm">{a.historiaDoencaAtual}</p></div>
              {a.doencasPrevias && <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Doenças Prévias</p><p className="text-sm">{a.doencasPrevias}</p></div>}
              {a.medicamentosEmUso && <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Medicamentos em Uso</p><p className="text-sm">{a.medicamentosEmUso}</p></div>}
              {a.nivelDor != null && <p className="text-sm">Nível de Dor: <strong>{a.nivelDor}/10</strong></p>}
              {a.usoPrevioCannabis && <Badge variant="secondary">Medicina Endocanabinóide prévia</Badge>}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
