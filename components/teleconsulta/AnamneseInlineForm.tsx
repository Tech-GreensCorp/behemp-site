'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Loader2, Sparkles, X, ClipboardList, Info, AlertTriangle } from 'lucide-react';
import { salvarAnamneseInline } from '@/app/(medico)/_actions/documentacao-clinica';

export interface SugestaoIA {
  valor: string | number | boolean;
  trecho: string;
}

interface AnamneseInlineFormProps {
  salaId: string;
  onConcluir: () => void;
  onCancelar: () => void;
  dadosIniciais?: any;
  sugestoes?: Record<string, SugestaoIA>;
}

export function AnamneseInlineForm({ salaId, onConcluir, onCancelar, dadosIniciais, sugestoes }: AnamneseInlineFormProps) {
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);

  // States: Seção 1
  const [queixaPrincipal, setQueixaPrincipal] = useState('');
  const [historiaDoencaAtual, setHistoriaDoencaAtual] = useState('');

  // States: Seção 2
  const [doencasPrevias, setDoencasPrevias] = useState('');
  const [medicamentosEmUso, setMedicamentosEmUso] = useState('');
  const [alergias, setAlergias] = useState('');
  const [historicoFamiliar, setHistoricoFamiliar] = useState('');
  const [historiaSocial, setHistoriaSocial] = useState('');

  // States: Seção 3
  const [tabagismo, setTabagismo] = useState<'nunca_fumou' | 'ex_fumante' | 'fumante' | ''>('');
  const [consumoAlcool, setConsumoAlcool] = useState<'nao_consome' | 'regular' | 'ocasional' | ''>('');
  const [qualidadeSono, setQualidadeSono] = useState<'ruim' | 'regular' | 'boa' | 'excelente' | ''>('');
  const [atividadeFisica, setAtividadeFisica] = useState('');
  const [nivelDor, setNivelDor] = useState<number>(0);

  // States: Seção 4
  const [usoPrevioCannabis, setUsoPrevioCannabis] = useState(false);
  const [objetivosTratamento, setObjetivosTratamento] = useState('');

  // Pre-fill
  useEffect(() => {
    if (dadosIniciais) {
      setQueixaPrincipal(dadosIniciais.queixaPrincipal || '');
      setHistoriaDoencaAtual(dadosIniciais.historiaDoencaAtual || '');
      setDoencasPrevias(dadosIniciais.doencasPrevias || '');
      setMedicamentosEmUso(dadosIniciais.medicamentosEmUso || '');
      setAlergias(dadosIniciais.alergias || '');
      setHistoricoFamiliar(dadosIniciais.historicoFamiliar || '');
      setHistoriaSocial(dadosIniciais.historiaSocial || '');
      setTabagismo(dadosIniciais.tabagismo || '');
      setConsumoAlcool(dadosIniciais.consumoAlcool || '');
      setQualidadeSono(dadosIniciais.qualidadeSono || '');
      setAtividadeFisica(dadosIniciais.atividadeFisica || '');
      setNivelDor(dadosIniciais.nivelDor || 0);
      setUsoPrevioCannabis(!!dadosIniciais.usoPrevioCannabis);
      setObjetivosTratamento(dadosIniciais.objetivosTratamento || '');
    }
  }, [dadosIniciais]);

  const handleTouch = () => setTouched(true);

  const getColorDor = (val: number) => {
    if (val <= 3) return 'text-green-500';
    if (val <= 6) return 'text-amber-500';
    return 'text-red-500';
  };

  const handleCancelar = () => {
    if (touched) {
      if (!window.confirm('Tem certeza que deseja descartar as alterações?')) {
        return;
      }
    }
    onCancelar();
  };

  const validate = () => {
    if (!queixaPrincipal.trim()) return 'A Queixa Principal é obrigatória (Seção 1).';
    if (!historiaDoencaAtual.trim()) return 'A História da Doença Atual é obrigatória (Seção 1).';
    if (!tabagismo) return 'O campo Tabagismo é obrigatório (Seção 3).';
    if (!consumoAlcool) return 'O campo Consumo de Álcool é obrigatório (Seção 3).';
    if (!qualidadeSono) return 'O campo Qualidade do Sono é obrigatório (Seção 3).';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errorMsg = validate();
    if (errorMsg) {
      toast.error(errorMsg);
      return;
    }

    setLoading(true);

    const payload = {
      salaId,
      queixaPrincipal,
      historiaDoencaAtual,
      doencasPrevias: doencasPrevias || undefined,
      medicamentosEmUso: medicamentosEmUso || undefined,
      alergias: alergias || undefined,
      historicoFamiliar: historicoFamiliar || undefined,
      historiaSocial: historiaSocial || undefined,
      tabagismo,
      consumoAlcool,
      qualidadeSono,
      atividadeFisica: atividadeFisica || undefined,
      nivelDor,
      usoPrevioCannabis,
      objetivosTratamento: objetivosTratamento || undefined,
    };

    const res = await salvarAnamneseInline(payload);
    
    if (res.sucesso) {
      toast.success('Anamnese registrada com sucesso!');
      onConcluir();
    } else {
      toast.error(res.erro || 'Falha ao salvar anamnese.');
      setLoading(false);
    }
  };

  const RenderIAslot = ({ campo }: { campo: string }) => {
    if (!sugestoes?.[campo]) return null;
    return (
      <span className="ml-2 inline-flex items-center text-[10px] bg-indigo-500/10 text-indigo-600 px-1.5 py-0.5 rounded-sm font-medium" title={`Sugerido: "${sugestoes[campo].trecho}"`}>
        <Sparkles className="h-3 w-3 mr-1" /> IA
      </span>
    );
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full bg-background relative" onChange={handleTouch}>
      {/* HEADER */}
      <div className="px-5 py-4 border-b border-border bg-muted/30 sticky top-0 z-20 flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" /> 
            {dadosIniciais ? 'Editar Anamnese' : 'Nova Anamnese'}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Mapeamento clínico completo</p>
        </div>
        <div className="flex items-center gap-2">
          {/* TODO(Sprint 2D): <Button variant="ghost" className="text-indigo-600 bg-indigo-50"><Sparkles className="w-4 h-4 mr-2"/> Preencher com IA</Button> */}
          <button type="button" onClick={handleCancelar} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        
        {dadosIniciais && (
          <div className="bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 p-3 rounded-lg text-xs flex items-start gap-2">
            <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <p><strong>Editando:</strong> Esta anamnese será salva como uma <strong>nova versão</strong>. A versão anterior permanecerá no histórico (Padrão CFM).</p>
          </div>
        )}

        <Accordion type="multiple" defaultValue={['sec-1', 'sec-3']} className="w-full space-y-3">
          
          {/* SEÇÃO 1: QUEIXA E HDA */}
          <AccordionItem value="sec-1" className="border rounded-xl bg-card overflow-hidden">
            <AccordionTrigger className="px-4 py-3 hover:bg-muted/50 transition-colors text-sm font-semibold">
              1. Queixa Principal e História
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 pt-1 space-y-4 border-t border-border">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground flex items-center">
                  Queixa Principal <span className="text-red-500 ml-1">*</span> <RenderIAslot campo="queixaPrincipal" />
                </label>
                <Input 
                  placeholder="Ex: Insônia severa e ansiedade..." 
                  value={queixaPrincipal} 
                  onChange={e => { setQueixaPrincipal(e.target.value); handleTouch(); }} 
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground flex items-center">
                  História da Doença Atual (HDA) <span className="text-red-500 ml-1">*</span> <RenderIAslot campo="historiaDoencaAtual" />
                </label>
                <Textarea 
                  placeholder="Relato detalhado do quadro..." 
                  value={historiaDoencaAtual} 
                  onChange={e => { setHistoriaDoencaAtual(e.target.value); handleTouch(); }} 
                  className="min-h-[100px] resize-none text-sm"
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* SEÇÃO 2: HISTÓRICO MÉDICO */}
          <AccordionItem value="sec-2" className="border rounded-xl bg-card overflow-hidden">
            <AccordionTrigger className="px-4 py-3 hover:bg-muted/50 transition-colors text-sm font-semibold">
              2. Histórico Médico
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 pt-1 space-y-4 border-t border-border">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground flex items-center">
                  Doenças Prévias <RenderIAslot campo="doencasPrevias" />
                </label>
                <Textarea value={doencasPrevias} onChange={e => { setDoencasPrevias(e.target.value); handleTouch(); }} className="min-h-[60px] resize-none text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground flex items-center">
                  Medicamentos em Uso <RenderIAslot campo="medicamentosEmUso" />
                </label>
                <Textarea value={medicamentosEmUso} onChange={e => { setMedicamentosEmUso(e.target.value); handleTouch(); }} className="min-h-[60px] resize-none text-sm" />
              </div>
              <div className="space-y-1.5 bg-red-500/5 p-3 rounded-lg border border-red-500/10">
                <label className="text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="h-3 w-3" /> Alergias Conhecidas <RenderIAslot campo="alergias" />
                </label>
                <p className="text-[10px] text-muted-foreground mb-2">Este campo será exibido no banner de alerta do perfil do paciente.</p>
                <Input placeholder="Ex: Dipirona, Penicilina..." value={alergias} onChange={e => { setAlergias(e.target.value); handleTouch(); }} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground flex items-center">
                    Histórico Familiar <RenderIAslot campo="historicoFamiliar" />
                  </label>
                  <Textarea value={historicoFamiliar} onChange={e => { setHistoricoFamiliar(e.target.value); handleTouch(); }} className="min-h-[60px] resize-none text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground flex items-center">
                    História Social <RenderIAslot campo="historiaSocial" />
                  </label>
                  <Textarea value={historiaSocial} onChange={e => { setHistoriaSocial(e.target.value); handleTouch(); }} className="min-h-[60px] resize-none text-sm" />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* SEÇÃO 3: HÁBITOS DE VIDA */}
          <AccordionItem value="sec-3" className="border rounded-xl bg-card overflow-hidden">
            <AccordionTrigger className="px-4 py-3 hover:bg-muted/50 transition-colors text-sm font-semibold">
              3. Hábitos de Vida e Métricas
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 pt-4 space-y-6 border-t border-border">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground flex items-center">
                    Tabagismo <span className="text-red-500 ml-1">*</span> <RenderIAslot campo="tabagismo" />
                  </label>
                  <Select value={tabagismo} onValueChange={(v: any) => { setTabagismo(v); handleTouch(); }}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nunca_fumou">Nunca fumou</SelectItem>
                      <SelectItem value="ex_fumante">Ex-fumante</SelectItem>
                      <SelectItem value="fumante">Fumante</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground flex items-center">
                    Álcool <span className="text-red-500 ml-1">*</span> <RenderIAslot campo="consumoAlcool" />
                  </label>
                  <Select value={consumoAlcool} onValueChange={(v: any) => { setConsumoAlcool(v); handleTouch(); }}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nao_consome">Não consome</SelectItem>
                      <SelectItem value="ocasional">Ocasional</SelectItem>
                      <SelectItem value="regular">Regular</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground flex items-center">
                    Sono <span className="text-red-500 ml-1">*</span> <RenderIAslot campo="qualidadeSono" />
                  </label>
                  <Select value={qualidadeSono} onValueChange={(v: any) => { setQualidadeSono(v); handleTouch(); }}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ruim">Ruim</SelectItem>
                      <SelectItem value="regular">Regular</SelectItem>
                      <SelectItem value="boa">Boa</SelectItem>
                      <SelectItem value="excelente">Excelente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground flex items-center">
                  Atividade Física <RenderIAslot campo="atividadeFisica" />
                </label>
                <Input placeholder="Ex: Caminhada 3x na semana" value={atividadeFisica} onChange={e => { setAtividadeFisica(e.target.value); handleTouch(); }} />
              </div>

              <div className="bg-muted/30 p-4 rounded-lg space-y-3">
                <div className="flex justify-between items-end">
                  <label className="text-xs font-semibold text-muted-foreground flex items-center">
                    Nível de Dor Base <RenderIAslot campo="nivelDor" />
                  </label>
                  <span className={`text-xl font-bold ${getColorDor(nivelDor)}`}>{nivelDor}</span>
                </div>
                <input 
                  type="range"
                  min={0} max={10} step={1}
                  value={nivelDor}
                  onChange={e => { setNivelDor(Number(e.target.value)); handleTouch(); }}
                  className="w-full accent-primary h-2 bg-muted rounded-lg appearance-none cursor-pointer mt-2 mb-1"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Sem dor (0)</span>
                  <span>Dor máxima (10)</span>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* SEÇÃO 4: TRATAMENTO */}
          <AccordionItem value="sec-4" className="border rounded-xl bg-card overflow-hidden">
            <AccordionTrigger className="px-4 py-3 hover:bg-muted/50 transition-colors text-sm font-semibold">
              4. Tratamento & Cannabis
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 pt-4 space-y-4 border-t border-border">
              <div className="flex items-center justify-between bg-muted/40 p-3 rounded-lg border border-border/50">
                <div className="space-y-0.5">
                  <label className="text-sm font-semibold flex items-center">
                    Uso Prévio de Cannabis <RenderIAslot campo="usoPrevioCannabis" />
                  </label>
                  <p className="text-xs text-muted-foreground">O paciente já utilizou derivados de cannabis medicinalmente antes?</p>
                </div>
                <Switch checked={usoPrevioCannabis} onCheckedChange={v => { setUsoPrevioCannabis(v); handleTouch(); }} />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground flex items-center">
                  Objetivos do Tratamento <RenderIAslot campo="objetivosTratamento" />
                </label>
                <Textarea 
                  placeholder="Expectativas e metas terapêuticas..." 
                  value={objetivosTratamento} 
                  onChange={e => { setObjetivosTratamento(e.target.value); handleTouch(); }} 
                  className="min-h-[80px] resize-none text-sm"
                />
              </div>
            </AccordionContent>
          </AccordionItem>
          
        </Accordion>
      </div>

      {/* FOOTER */}
      <div className="px-5 py-4 border-t border-border bg-background sticky bottom-0 z-20 flex justify-end gap-3 shadow-[0_-4px_15px_-5px_rgba(0,0,0,0.05)]">
        <Button variant="outline" type="button" onClick={handleCancelar} disabled={loading}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading} className="w-36 bg-primary">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar Anamnese'}
        </Button>
      </div>
    </form>
  );
}
