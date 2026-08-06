'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileSignature, Plus, FileDown, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { listarPrescricoesPaciente, criarPrescricao } from '@/app/(medico)/_actions/prescricoes';
import { listarTemplatesMedico } from '@/app/(medico)/_actions/receituario-templates';

interface MedicamentoForm {
  nome: string;
  dose: string;
  forma: string;
  posologia: string;
  quantidade: string;
}

export function TabPrescricoes({ pacienteId }: { pacienteId: string }) {
  const [prescricoes, setPrescricoes] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  
  // Dialog state
  const [open, setOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [tipo, setTipo] = useState('simples');
  const [templateId, setTemplateId] = useState('nenhum');
  const [diagnostico, setDiagnostico] = useState('');
  const [cid, setCid] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [orientacoes, setOrientacoes] = useState('');
  const [validadeDias, setValidadeDias] = useState(30);
  const [medicamentos, setMedicamentos] = useState<MedicamentoForm[]>([
    { nome: '', dose: '', forma: '', posologia: '', quantidade: '' }
  ]);

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    const [resPresc, resTemp] = await Promise.all([
      listarPrescricoesPaciente(pacienteId),
      listarTemplatesMedico()
    ]);
    
    if (resPresc.sucesso) setPrescricoes(resPresc.dados ?? []);
    if (resTemp.sucesso) setTemplates(resTemp.dados ?? []);
    setCarregando(false);
  }, [pacienteId]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const adicionarMedicamento = () => {
    setMedicamentos([...medicamentos, { nome: '', dose: '', forma: '', posologia: '', quantidade: '' }]);
  };

  const removerMedicamento = (index: number) => {
    const novos = [...medicamentos];
    novos.splice(index, 1);
    setMedicamentos(novos.length ? novos : [{ nome: '', dose: '', forma: '', posologia: '', quantidade: '' }]);
  };

  const updateMedicamento = (index: number, campo: keyof MedicamentoForm, valor: string) => {
    const novos = [...medicamentos];
    novos[index][campo] = valor;
    setMedicamentos(novos);
  };

  const handleSalvar = async () => {
    // Validar
    const medsValidos = medicamentos.filter(m => m.nome.trim() !== '');
    if (medsValidos.length === 0) {
      toast.error('Adicione pelo menos um medicamento válido.');
      return;
    }

    setSalvando(true);
    const res = await criarPrescricao({
      pacienteId,
      tipo,
      templateId: templateId === 'nenhum' ? undefined : templateId,
      medicamentos: medsValidos,
      diagnostico,
      cid,
      observacoes,
      orientacoes,
      validadeDias
    });
    setSalvando(false);

    if (res.sucesso) {
      toast.success('Prescrição gerada com sucesso!');
      setOpen(false);
      
      // Reset form
      setMedicamentos([{ nome: '', dose: '', forma: '', posologia: '', quantidade: '' }]);
      setDiagnostico('');
      setCid('');
      setObservacoes('');
      setOrientacoes('');
      
      carregarDados();
    } else {
      toast.error(res.erro || 'Erro ao gerar prescrição');
    }
  };

  if (carregando) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-heading font-semibold tracking-tight">Prescrições do Paciente</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button className="gap-2"><Plus size={16} /> Nova Prescrição</Button>} />
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Emitir Prescrição Médica</DialogTitle>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tipo de Receituário</Label>
                  <Select value={tipo} onValueChange={v => setTipo(v ?? 'simples')}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="simples">Receituário Simples</SelectItem>
                      <SelectItem value="controle_especial">Controle Especial</SelectItem>
                      <SelectItem value="personalizado">Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Template Visual</Label>
                  <Select value={templateId} onValueChange={v => setTemplateId(v ?? 'nenhum')}>
                    <SelectTrigger><SelectValue placeholder="Padrão" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhum">Template Padrão</SelectItem>
                      {templates.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Medicamentos</h3>
                  <Button variant="outline" size="sm" onClick={adicionarMedicamento}>
                    Adicionar Item
                  </Button>
                </div>
                {medicamentos.map((m, i) => (
                  <div key={i} className="grid grid-cols-12 gap-3 p-4 border rounded-lg bg-muted/20 relative">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="absolute -top-3 -right-3 h-6 w-6 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => removerMedicamento(i)}
                    >
                      <Trash2 size={12} />
                    </Button>
                    <div className="col-span-12 md:col-span-6">
                      <Label className="text-xs">Medicamento *</Label>
                      <Input value={m.nome} onChange={e => updateMedicamento(i, 'nome', e.target.value)} placeholder="Ex: Óleo de CBD 5%" />
                    </div>
                    <div className="col-span-6 md:col-span-3">
                      <Label className="text-xs">Dose</Label>
                      <Input value={m.dose} onChange={e => updateMedicamento(i, 'dose', e.target.value)} placeholder="Ex: 30 ml" />
                    </div>
                    <div className="col-span-6 md:col-span-3">
                      <Label className="text-xs">Forma</Label>
                      <Input value={m.forma} onChange={e => updateMedicamento(i, 'forma', e.target.value)} placeholder="Ex: Gotas" />
                    </div>
                    <div className="col-span-8 md:col-span-9">
                      <Label className="text-xs">Posologia</Label>
                      <Input value={m.posologia} onChange={e => updateMedicamento(i, 'posologia', e.target.value)} placeholder="Ex: 3 gotas 2x ao dia" />
                    </div>
                    <div className="col-span-4 md:col-span-3">
                      <Label className="text-xs">Qtd</Label>
                      <Input value={m.quantidade} onChange={e => updateMedicamento(i, 'quantidade', e.target.value)} placeholder="Ex: 1 frasco" />
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Diagnóstico</Label>
                  <Input value={diagnostico} onChange={e => setDiagnostico(e.target.value)} placeholder="Ex: Faringite" />
                </div>
                <div>
                  <Label>CID</Label>
                  <Input value={cid} onChange={e => setCid(e.target.value)} placeholder="Ex: J02.9" />
                </div>
                <div className="col-span-2">
                  <Label>Orientações / Observações</Label>
                  <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} />
                </div>
                <div className="col-span-2">
                  <Label>Validade (Dias)</Label>
                  <Input type="number" value={validadeDias} onChange={e => setValidadeDias(Number(e.target.value))} />
                </div>
              </div>

              <Button className="w-full" onClick={handleSalvar} disabled={salvando}>
                {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Emitir Receituário
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {prescricoes.length === 0 ? (
        <Card className="border-dashed bg-muted/30">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <FileSignature size={48} className="mb-4 opacity-20" />
            <p>Nenhuma prescrição emitida ainda para este paciente.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {prescricoes.map(p => (
            <Card key={p.id}>
              <CardHeader className="py-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-base font-semibold font-heading">
                        {p.tipo === 'controle_especial' ? 'Receituário de Controle Especial' : 'Receituário Simples'}
                      </CardTitle>
                      <Badge variant={p.status === 'rascunho' ? 'secondary' : p.status === 'emitida' ? 'default' : 'outline'}>
                        {p.status.toUpperCase()}
                      </Badge>
                      <Badge variant="outline" className="text-xs text-muted-foreground border-dashed" title="Aguardando liberação do PSC (BirdID/VIDaaS)">
                        Assinatura Digital (Aguardando PSC)
                      </Badge>
                    </div>
                    <CardDescription className="mt-1">
                      Emitido em: {new Date(p.createdAt).toLocaleDateString('pt-BR')} • 
                      Válido até: {new Date(p.validade).toLocaleDateString('pt-BR')}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => window.open(`/api/receituario/pdf?prescricaoId=${p.id}`, '_blank')}>
                      <FileDown size={14} className="mr-2" /> PDF
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="py-4 border-t">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                  <div>
                    <span className="font-semibold text-muted-foreground text-xs uppercase tracking-wider block mb-1">Medicamentos</span>
                    <ul className="space-y-1 list-disc pl-4">
                      {Array.isArray(p.medicamentos) && p.medicamentos.map((m: any, i: number) => (
                        <li key={i}>{m.nome} {m.dose} — {m.posologia}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className="font-semibold text-muted-foreground text-xs uppercase tracking-wider block mb-1">Diagnóstico</span>
                    <p>{p.diagnostico || 'Não informado'} {p.cid ? `(CID: ${p.cid})` : ''}</p>
                    {p.observacoes && (
                      <div className="mt-2">
                        <span className="font-semibold text-muted-foreground text-xs uppercase tracking-wider block mb-1">Orientações</span>
                        <p>{p.observacoes}</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
