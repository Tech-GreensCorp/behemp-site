'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Pill,
  Search,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

import {
  buscarCatalogoMedicamentos,
  criarPrescricaoInline,
  type ItemCatalogo,
  type ItemMedicamentoForm,
  type DadosFormRenovar
} from '@/app/(medico)/_actions/prescricao-inline';

interface PrescricaoInlineWizardProps {
  salaId: string;
  pacienteNome: string;
  dadosIniciais?: DadosFormRenovar | null;
  onConcluir: () => void;
  onCancelar: () => void;
}

export function PrescricaoInlineWizard({
  salaId,
  pacienteNome,
  dadosIniciais,
  onConcluir,
  onCancelar,
}: PrescricaoInlineWizardProps) {
  const [passo, setPasso] = useState<1 | 2 | 3>(1);
  const [catalogo, setCatalogo] = useState<ItemCatalogo[]>([]);
  const [loadingCatalogo, setLoadingCatalogo] = useState(true);
  const [emitindo, setEmitindo] = useState(false);
  const [prescricaoId, setPrescricaoId] = useState<string | null>(null);

  // Form State
  const [medicamentos, setMedicamentos] = useState<ItemMedicamentoForm[]>(
    dadosIniciais?.medicamentos ?? [{ nome: '', gotas: 5, intervaloHoras: 8, via: 'sublingual', duracaoDias: null, observacoes: '' }]
  );
  const [validadeDias, setValidadeDias] = useState<number>(dadosIniciais?.validadeDias ?? 30);

  // Autocomplete State per item
  const [busca, setBusca] = useState<Record<number, string>>({});
  const [focoIndex, setFocoIndex] = useState<number | null>(null);

  useEffect(() => {
    async function loadCatalogo() {
      setLoadingCatalogo(true);
      const res = await buscarCatalogoMedicamentos();
      if (res.sucesso && res.dados) {
        setCatalogo(res.dados);
      }
      setLoadingCatalogo(false);
    }
    loadCatalogo();
  }, []);

  const addMed = () => {
    setMedicamentos(prev => [...prev, { nome: '', gotas: 5, intervaloHoras: 8, via: 'sublingual', duracaoDias: null, observacoes: '' }]);
  };

  const removeMed = (index: number) => {
    setMedicamentos(prev => prev.filter((_, i) => i !== index));
  };

  const updateMed = (index: number, field: keyof ItemMedicamentoForm, value: any) => {
    setMedicamentos(prev => prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)));
  };

  const handleSelectMedicamento = (index: number, med: ItemCatalogo) => {
    const nomeComConcentracao = med.marca?.toLowerCase().includes('greens')
      ? `${med.nome} ${med.tipoEspectro ? `(${med.tipoEspectro})` : ''}`
      : med.nome;
      
    updateMed(index, 'nome', nomeComConcentracao);
    updateMed(index, 'medicamentoId', med.id);
    setFocoIndex(null);
  };

  const validarPasso1 = () => {
    if (medicamentos.length === 0) {
      toast.error('Adicione ao menos um medicamento.');
      return false;
    }
    for (const m of medicamentos) {
      if (!m.nome.trim()) {
        toast.error('Preencha o nome de todos os medicamentos.');
        return false;
      }
      if (m.gotas <= 0) {
        toast.error('A dose deve ser maior que zero.');
        return false;
      }
    }
    return true;
  };

  const irParaPasso2 = () => {
    if (validarPasso1()) setPasso(2);
  };

  const confirmarDescarte = () => {
    if (passo === 3 || confirm('Descartar prescrição em andamento? Todos os dados serão perdidos.')) {
      onCancelar();
    }
  };

  const handleEmitir = async () => {
    setEmitindo(true);
    try {
      const res = await criarPrescricaoInline({
        salaId,
        medicamentos,
        validadeDias
      });

      if (res.sucesso && res.prescricaoId) {
        setPrescricaoId(res.prescricaoId);
        setPasso(3);
        toast.success('Prescrição emitida com sucesso!');
      } else {
        toast.error(res.erro || 'Erro ao emitir prescrição');
      }
    } catch (e) {
      toast.error('Ocorreu um erro inesperado.');
    } finally {
      setEmitindo(false);
    }
  };

  const gerarPosologiaPreview = (item: ItemMedicamentoForm) => {
    const viaLabel: Record<string, string> = { sublingual: 'sublingual', oral: 'oral', topica: 'tópica' };
    const gotasStr = String(item.gotas).padStart(2, '0');
    const via = viaLabel[item.via] ?? item.via;
    let texto = `Tomar ${gotasStr} gota${item.gotas > 1 ? 's' : ''} ${via} de ${item.intervaloHoras} em ${item.intervaloHoras} horas`;
    if (item.duracaoDias) texto += ` por ${item.duracaoDias} dias`;
    else texto += ' (uso contínuo)';
    return texto;
  };

  return (
    <div className="flex flex-col h-full bg-background relative">
      {/* HEADER WIZARD */}
      <div className="px-5 py-4 border-b border-border bg-muted/30 sticky top-0 z-10 flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Pill className="h-4 w-4 text-primary" /> Nova Prescrição
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">{pacienteNome}</p>
        </div>
        <button onClick={confirmarDescarte} className="text-muted-foreground hover:text-foreground text-xs font-medium">
          {passo === 3 ? 'Fechar' : 'Cancelar'}
        </button>
      </div>

      {/* PROGRESSO */}
      <div className="px-5 py-3 border-b border-border bg-card">
        <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-muted-foreground relative">
          <div className="absolute top-1/2 left-0 right-0 h-px bg-border -z-10" />
          {[1, 2, 3].map((num) => (
            <div key={num} className={`bg-card px-2 flex items-center gap-1.5 transition-colors ${passo >= num ? 'text-primary' : ''}`}>
              <div className={`h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${passo >= num ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                {passo > num ? <CheckCircle2 className="h-3 w-3" /> : num}
              </div>
              <span className="hidden sm:inline">
                {num === 1 ? 'Medicamentos' : num === 2 ? 'Revisão' : 'Emissão'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* CONTEÚDO SCROLLÁVEL */}
      <div className="flex-1 overflow-y-auto p-5 pb-24">
        <AnimatePresence mode="wait">
          
          {/* PASSO 1 - MEDICAMENTOS */}
          {passo === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              
              <div className="space-y-4">
                {medicamentos.map((med, index) => (
                  <div key={index} className="bg-muted/30 border border-border rounded-xl p-4 space-y-4 relative">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className="bg-background">Medicamento {index + 1}</Badge>
                      {medicamentos.length > 1 && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeMed(index)} className="h-6 w-6 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>

                    <div className="relative">
                      <Label className="text-xs">Nome / Produto</Label>
                      <div className="relative">
                        <Input
                          placeholder="Buscar no catálogo ou digitar nome..."
                          value={busca[index] !== undefined ? busca[index] : med.nome}
                          onChange={(e) => {
                            setBusca(prev => ({ ...prev, [index]: e.target.value }));
                            updateMed(index, 'nome', e.target.value);
                          }}
                          onFocus={() => setFocoIndex(index)}
                          onBlur={() => setTimeout(() => setFocoIndex(null), 200)}
                          className="mt-1"
                        />
                        {focoIndex === index && !loadingCatalogo && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg z-50 max-h-[200px] overflow-y-auto">
                            {catalogo.filter(c => c.nome.toLowerCase().includes((busca[index] ?? med.nome).toLowerCase())).length > 0 ? (
                              catalogo.filter(c => c.nome.toLowerCase().includes((busca[index] ?? med.nome).toLowerCase())).map(c => (
                                <button
                                  key={c.id}
                                  type="button"
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex flex-col items-start gap-0.5 border-b border-border/50 last:border-0"
                                  onClick={() => handleSelectMedicamento(index, c)}
                                >
                                  <span className="font-medium">{c.nome}</span>
                                  {c.marca?.toLowerCase().includes('greens') && c.cbdMgPorGota && (
                                    <Badge variant="secondary" className="text-[9px] h-4 py-0 bg-primary/10 text-primary">
                                      {c.cbdMgPorGota}mg CBD/gota
                                    </Badge>
                                  )}
                                </button>
                              ))
                            ) : (
                              <div className="p-3 text-xs text-muted-foreground text-center">Nenhum resultado no catálogo.<br/>(Será prescrito como texto livre)</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Gotas p/ tomada</Label>
                        <Input 
                          type="number" min="1"
                          value={med.gotas}
                          onChange={(e) => updateMed(index, 'gotas', parseInt(e.target.value) || 1)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Intervalo</Label>
                        <Select value={String(med.intervaloHoras)} onValueChange={(val) => updateMed(index, 'intervaloHoras', Number(val))}>
                          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="6">6 em 6 horas</SelectItem>
                            <SelectItem value="8">8 em 8 horas</SelectItem>
                            <SelectItem value="12">12 em 12 horas</SelectItem>
                            <SelectItem value="24">24 em 24 horas</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Via admin.</Label>
                        <Select value={med.via} onValueChange={(val) => updateMed(index, 'via', val)}>
                          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sublingual">Sublingual</SelectItem>
                            <SelectItem value="oral">Oral</SelectItem>
                            <SelectItem value="topica">Tópica</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Duração (dias)</Label>
                        <Input 
                          type="number" min="1" placeholder="Vazio = contínuo"
                          value={med.duracaoDias || ''}
                          onChange={(e) => updateMed(index, 'duracaoDias', e.target.value ? parseInt(e.target.value) : null)}
                          className="mt-1"
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs text-muted-foreground">Preview Posologia</Label>
                      <div className="bg-muted p-2 rounded-md text-[11px] mt-1 font-medium italic text-foreground">
                        {gerarPosologiaPreview(med)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Button type="button" variant="outline" onClick={addMed} className="w-full border-dashed gap-2">
                <Plus className="h-4 w-4" /> Adicionar Medicamento
              </Button>
            </motion.div>
          )}

          {/* PASSO 2 - REVISÃO */}
          {passo === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                <p className="text-xs font-semibold uppercase text-primary mb-1">Paciente Identificado</p>
                <p className="font-bold text-foreground">{pacienteNome}</p>
                <p className="text-[10px] text-muted-foreground mt-1">Prescrição será vinculada a esta teleconsulta.</p>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold border-b pb-2">Medicamentos Prescritos</h4>
                {medicamentos.map((med, i) => (
                  <div key={i} className="bg-card border rounded-lg p-3">
                    <p className="font-semibold text-sm leading-tight">{med.nome}</p>
                    <p className="text-xs text-muted-foreground mt-1 bg-muted p-1.5 rounded">{gerarPosologiaPreview(med)}</p>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-border">
                <Label className="text-sm font-semibold mb-2 block">Validade da Receita</Label>
                <Select value={String(validadeDias)} onValueChange={(v) => setValidadeDias(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 dias</SelectItem>
                    <SelectItem value="60">60 dias</SelectItem>
                    <SelectItem value="90">90 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </motion.div>
          )}

          {/* PASSO 3 - SUCESSO / PDF */}
          {passo === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-5 flex flex-col h-full">
              <div className="text-center space-y-2 mb-2">
                <div className="w-12 h-12 bg-green-500/10 text-green-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-lg text-foreground">Emitida com Sucesso!</h3>
                <p className="text-xs text-muted-foreground">O paciente foi notificado no portal e por e-mail.</p>
              </div>

              {prescricaoId && (
                <div className="flex-1 rounded-xl overflow-hidden border border-border bg-muted relative min-h-[350px]">
                  <iframe 
                    src={`/api/receituario/pdf?prescricaoId=${prescricaoId}`} 
                    className="w-full h-full border-0 absolute inset-0"
                    title="PDF da Prescrição"
                  />
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <Button className="flex-1 gap-2" variant="outline" onClick={() => window.open(`/api/receituario/pdf?prescricaoId=${prescricaoId}`, '_blank')}>
                  <Download className="h-4 w-4" /> PDF Completo
                </Button>
                <Button className="flex-1 bg-primary text-white hover:bg-primary/90" onClick={onConcluir}>
                  Concluir
                </Button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* FOOTER ACTIONS (Steps 1 & 2) */}
      {passo < 3 && (
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border bg-background flex gap-3">
          {passo === 1 ? (
            <>
              <Button type="button" variant="outline" onClick={confirmarDescarte} className="flex-1">Cancelar</Button>
              <Button type="button" onClick={irParaPasso2} className="flex-1 bg-primary text-white hover:bg-primary/90 gap-1.5">
                Revisar <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => setPasso(1)} disabled={emitindo} className="flex-1 gap-1.5">
                <ChevronLeft className="h-4 w-4" /> Voltar
              </Button>
              <Button type="button" onClick={handleEmitir} disabled={emitindo} className="flex-1 bg-primary text-white hover:bg-primary/90 gap-1.5">
                {emitindo ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} 
                {emitindo ? 'Emitindo...' : 'Emitir Prescrição'}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
