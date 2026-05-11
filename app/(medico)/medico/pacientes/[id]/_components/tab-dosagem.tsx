'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { criarAjusteDosagem, listarAjustesDosagem } from '@/app/_actions/ajustes-dosagem';
import { toast } from 'sonner';
import {
  Loader2,
  Pill,
  Plus,
  Trash2,
} from 'lucide-react';

const ITEM_VAZIO = { tipoCanabinoide: '', novaDosagem: '', dosagemAnterior: '', frequencia: '', concentracaoTHC: '', concentracaoCBD: '', viaAdministracao: '' };

interface TabDosagemProps { pacienteId: string }

export function TabDosagem({ pacienteId }: TabDosagemProps) {
  const [ajustes, setAjustes] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [dataAjuste, setDataAjuste] = useState('');
  const [proximaRevisao, setProximaRevisao] = useState('');
  const [motivoAjuste, setMotivoAjuste] = useState('');
  const [itens, setItens] = useState([{ ...ITEM_VAZIO }]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const res = await listarAjustesDosagem(pacienteId);
    if (res.sucesso && res.dados) setAjustes(res.dados);
    setCarregando(false);
  }, [pacienteId]);

  useEffect(() => { carregar(); }, [carregar]);

  function addItem() { setItens(p => [...p, { ...ITEM_VAZIO }]); }
  function removeItem(idx: number) { setItens(p => p.filter((_, i) => i !== idx)); }
  function updateItem(idx: number, campo: string, valor: string) {
    setItens(p => p.map((item, i) => i === idx ? { ...item, [campo]: valor } : item));
  }

  async function handleSalvar() {
    setSalvando(true);
    const res = await criarAjusteDosagem({
      pacienteId, dataAjuste, proximaRevisao: proximaRevisao || undefined, motivoAjuste, itens,
    });
    setSalvando(false);
    if (res.sucesso) {
      toast.success('Ajuste de dosagem registrado!');
      setAberto(false); setDataAjuste(''); setProximaRevisao(''); setMotivoAjuste(''); setItens([{ ...ITEM_VAZIO }]);
      await carregar();
    } else { toast.error(res.erro || 'Erro ao salvar'); }
  }

  const dosagemAtual = ajustes[0];

  if (carregando) return <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      {/* Dosagem Atual */}
      {dosagemAtual && (
        <Card className="border-[#C08E3A]/30 bg-[#C08E3A]/5 shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="font-heading text-base">💊 Dosagem Atual</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">Ajuste em {new Date(dosagemAtual.dataAjuste + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
            {dosagemAtual.itens?.map((item: any, i: number) => (
              <div key={i} className="rounded-lg border border-border/30 bg-background p-3">
                <div className="flex items-center gap-2"><Badge>{item.tipoCanabinoide}</Badge><span className="text-sm font-semibold">{item.novaDosagem}</span></div>
                <p className="mt-1 text-xs text-muted-foreground">Frequência: {item.frequencia}</p>
                {item.viaAdministracao && <p className="text-xs text-muted-foreground">Via: {item.viaAdministracao}</p>}
              </div>
            ))}
            {dosagemAtual.proximaRevisao && <p className="text-xs font-medium text-[#C08E3A]">Próxima revisão: {new Date(dosagemAtual.proximaRevisao + 'T00:00:00').toLocaleDateString('pt-BR')}</p>}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold">Histórico de Dosagem</h2>
        <Dialog open={aberto} onOpenChange={setAberto}>
          <DialogTrigger><Button size="sm" className="gap-2 rounded-xl"><Plus size={14} /> Novo Ajuste</Button></DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
            <DialogHeader><DialogTitle className="font-heading">Novo Ajuste de Dosagem</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <div><Label>Data do Ajuste *</Label><Input type="date" value={dataAjuste} onChange={e => setDataAjuste(e.target.value)} /></div>
                <div><Label>Próxima Revisão</Label><Input type="date" value={proximaRevisao} onChange={e => setProximaRevisao(e.target.value)} /></div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Medicamentos</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-1.5 text-xs"><Plus size={12} /> Adicionar Medicamento</Button>
                </div>
                {itens.map((item, idx) => (
                  <Card key={idx} className="border-border/40">
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline">Medicamento {idx + 1}</Badge>
                        {itens.length > 1 && <Button variant="ghost" size="sm" onClick={() => removeItem(idx)}><Trash2 size={14} className="text-destructive" /></Button>}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div><Label>Tipo de Canabinóide *</Label><Input value={item.tipoCanabinoide} onChange={e => updateItem(idx, 'tipoCanabinoide', e.target.value)} placeholder="Ex: CBD, THC, Full Spectrum" /></div>
                        <div><Label>Nova Dosagem *</Label><Input value={item.novaDosagem} onChange={e => updateItem(idx, 'novaDosagem', e.target.value)} placeholder="Ex: 20mg 2x/dia" /></div>
                        <div><Label>Dosagem Anterior</Label><Input value={item.dosagemAnterior} onChange={e => updateItem(idx, 'dosagemAnterior', e.target.value)} /></div>
                        <div><Label>Frequência *</Label><Input value={item.frequencia} onChange={e => updateItem(idx, 'frequencia', e.target.value)} placeholder="Ex: 2x ao dia" /></div>
                        <div><Label>Concentração THC</Label><Input value={item.concentracaoTHC} onChange={e => updateItem(idx, 'concentracaoTHC', e.target.value)} /></div>
                        <div><Label>Concentração CBD</Label><Input value={item.concentracaoCBD} onChange={e => updateItem(idx, 'concentracaoCBD', e.target.value)} /></div>
                      </div>
                      <div><Label>Via de Administração</Label><Input value={item.viaAdministracao} onChange={e => updateItem(idx, 'viaAdministracao', e.target.value)} placeholder="Ex: Sublingual, Oral" /></div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div><Label>Motivo do Ajuste *</Label><Textarea value={motivoAjuste} onChange={e => setMotivoAjuste(e.target.value)} rows={2} /></div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setAberto(false)}>Cancelar</Button>
                <Button onClick={handleSalvar} disabled={salvando || !dataAjuste || !motivoAjuste || !itens[0]?.tipoCanabinoide} className="gap-2 rounded-xl">
                  {salvando ? <Loader2 size={16} className="animate-spin" /> : null}
                  {salvando ? 'Salvando...' : 'Registrar Ajuste'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {ajustes.length === 0 ? (
        <Card className="border-border/40 shadow-sm"><CardContent className="flex flex-col items-center justify-center py-16">
          <p className="text-lg font-medium">Nenhum ajuste registrado</p>
        </CardContent></Card>
      ) : (
        ajustes.map((aj) => (
          <Card key={aj.id} className="border-border/40 shadow-sm">
            <CardContent className="p-5">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Pill size={16} className="text-[#C08E3A]" />
                  <p className="text-sm font-medium">{new Date(aj.dataAjuste + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                </div>
                <Badge variant="outline">{aj.itens?.length || 0} medicamento(s)</Badge>
              </div>
              <p className="text-xs text-muted-foreground"><strong>Motivo:</strong> {aj.motivoAjuste}</p>
              {aj.itens?.map((it: any, i: number) => (
                <div key={i} className="mt-2 flex items-center gap-2 text-xs"><Badge variant="secondary">{it.tipoCanabinoide}</Badge><span>{it.novaDosagem} — {it.frequencia}</span></div>
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
