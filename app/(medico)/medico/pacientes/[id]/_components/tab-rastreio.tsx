'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Plus, BellRing, Target, Activity } from 'lucide-react';
import {
  criarDosagem,
  desativarDosagem,
  listarDosagens,
  listarMedicamentos,
} from '@/app/_actions/dosagens';

export function TabRastreio({ pacienteId }: { pacienteId: string }) {
  const [rastreios, setRastreios] = useState<any[]>([]);
  const [medicamentos, setMedicamentos] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [modoForm, setModoForm] = useState(false);

  // Form State
  const [medicamentoId, setMedicamentoId] = useState('');
  const [gotasPorDia, setGotasPorDia] = useState('');
  const [mlFrasco, setMlFrasco] = useState('');
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().split('T')[0]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const [resRastreio, resMed] = await Promise.all([
      listarDosagens(pacienteId),
      listarMedicamentos()
    ]);
    if (resRastreio.sucesso && resRastreio.dados) setRastreios(resRastreio.dados);
    if (resMed.sucesso && resMed.dados) setMedicamentos(resMed.dados);
    setCarregando(false);
  }, [pacienteId]);

  useEffect(() => { carregar(); }, [carregar]);

  async function handleSalvar() {
    if (!medicamentoId || !gotasPorDia || !mlFrasco || !dataInicio) {
      toast.error('Preencha todos os campos');
      return;
    }
    setSalvando(true);
    const res = await criarDosagem({
      pacienteId,
      medicamentoId,
      gotasPorDia: Number(gotasPorDia),
      mlFrasco: Number(mlFrasco),
      dataInicio,
    });
    setSalvando(false);
    if (res.sucesso) {
      toast.success('Rastreio iniciado com sucesso!');
      setModoForm(false);
      setMedicamentoId('');
      setGotasPorDia('');
      setMlFrasco('');
      await carregar();
    } else {
      toast.error(res.erro || 'Erro ao salvar');
    }
  }

  async function handleDesativar(id: string) {
    if (!confirm('Deseja encerrar o monitoramento deste frasco?')) return;
    const res = await desativarDosagem(id);
    if (res.sucesso) {
      toast.success('Monitoramento encerrado');
      await carregar();
    } else {
      toast.error(res.erro || 'Erro ao encerrar');
    }
  }

  if (carregando) return <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-primary" /></div>;

  const ativos = rastreios.filter(r => r.ativa);
  const historico = rastreios.filter(r => !r.ativa);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-lg font-semibold flex items-center gap-2">
            <BellRing size={20} className="text-[#C08E3A]" /> Monitoramento de Alertas
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Cadastre o frasco atual para o sistema calcular o término e gerar alertas.
          </p>
        </div>
        {!modoForm && (
          <Button size="sm" className="gap-2 rounded-xl" onClick={() => setModoForm(true)}>
            <Plus size={14} /> Iniciar Rastreio
          </Button>
        )}
      </div>

      {modoForm && (
        <Card className="border-border/40 shadow-sm border-t-4 border-t-[#C08E3A]">
          <CardHeader className="pb-4">
            <CardTitle className="font-heading text-base">Novo Frasco (Rastreio)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Produto BeHemp *</Label>
                <Select value={medicamentoId} onValueChange={(v) => setMedicamentoId(v ?? '')}>
                  <SelectTrigger><SelectValue placeholder="Selecione o produto..." /></SelectTrigger>
                  <SelectContent>
                    {medicamentos.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data de Início do Frasco *</Label>
                <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
              </div>
              <div>
                <Label>Volume do Frasco (mL) *</Label>
                <Input type="number" placeholder="Ex: 30" value={mlFrasco} onChange={e => setMlFrasco(e.target.value)} />
              </div>
              <div>
                <Label>Gotas Consumidas por Dia *</Label>
                <Input type="number" placeholder="Ex: 10" value={gotasPorDia} onChange={e => setGotasPorDia(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setModoForm(false)}>Cancelar</Button>
              <Button onClick={handleSalvar} disabled={salvando} className="gap-2 rounded-xl bg-[#C08E3A] hover:bg-[#C08E3A]/90 text-white">
                {salvando ? <Loader2 size={16} className="animate-spin" /> : <Target size={16} />}
                {salvando ? 'Ativando...' : 'Ativar Monitoramento'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ativos */}
      {ativos.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Monitoramento Ativo</h3>
          {ativos.map(r => (
            <Card key={r.id} className="border-[#C08E3A]/40 bg-[#C08E3A]/5 shadow-sm">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Activity size={16} className="text-[#C08E3A]" />
                    <span className="font-semibold">{r.medicamentoNome}</span>
                    <Badge variant="outline" className="border-[#C08E3A] text-[#C08E3A]">Ativo</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {r.mlFrasco} mL · {r.gotasPorDia} gotas/dia
                  </p>
                  <p className="text-sm mt-1">
                    Início: <strong>{new Date(r.dataInicio + 'T12:00:00').toLocaleDateString('pt-BR')}</strong> 
                    {' '}➔ Fim Previsto: <strong className="text-[#C34C32]">{new Date(r.dataFimPrevista + 'T12:00:00').toLocaleDateString('pt-BR')}</strong>
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => handleDesativar(r.id)}>
                  Encerrar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Histórico */}
      {historico.length > 0 && (
        <div className="space-y-3 pt-4">
          <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Histórico de Frascos</h3>
          {historico.map(r => (
            <Card key={r.id} className="border-border/40 shadow-sm opacity-70 grayscale">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{r.medicamentoNome}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.mlFrasco} mL · {r.gotasPorDia} gotas/dia
                  </p>
                  <p className="text-xs mt-1">
                    Fim Previsto: {new Date(r.dataFimPrevista + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <Badge variant="secondary">Encerrado</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!modoForm && ativos.length === 0 && historico.length === 0 && (
        <Card className="border-border/40 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BellRing size={48} className="text-muted-foreground/30 mb-4" />
            <p className="text-lg font-medium">Nenhum monitoramento</p>
            <p className="text-sm text-muted-foreground text-center max-w-sm mt-2">
              Cadastre um frasco para o sistema acompanhar o uso e avisar quando estiver acabando.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
