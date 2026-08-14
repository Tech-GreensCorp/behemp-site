'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { Loader2, Sparkles, X, Activity, Flame, Wind, Droplets } from 'lucide-react';
import { criarEvolucaoInline } from '@/app/(medico)/_actions/documentacao-clinica';

export interface SugestaoIA {
  valor: string | number;
  trecho: string;
}

interface EvolucaoRapidaFormProps {
  salaId: string;
  onConcluir: () => void;
  onCancelar: () => void;
  // TODO(Sprint 2D): Contrato pronto para receber as sugestões estruturadas da IA baseada na transcrição.
  sugestoes?: Record<string, SugestaoIA>;
}

const EFEITOS_CBD = ['Sonolência', 'Boca seca', 'Tontura', 'Alteração de apetite', 'Diarreia'];

export function EvolucaoRapidaForm({ salaId, onConcluir, onCancelar, sugestoes }: EvolucaoRapidaFormProps) {
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);

  // States
  const [data, setData] = useState(() => new Date().toISOString().split('T')[0]);
  const [tipo, setTipo] = useState<'positiva' | 'estavel' | 'negativa'>('estavel');
  const [nivelDor, setNivelDor] = useState<number>(0);
  const [qualidadeSono, setQualidadeSono] = useState<'ruim' | 'regular' | 'boa' | 'excelente' | ''>('');
  const [bemEstar, setBemEstar] = useState<'ruim' | 'regular' | 'boa' | 'excelente' | ''>('');
  const [efeitosTags, setEfeitosTags] = useState<string[]>([]);
  const [efeitosLivres, setEfeitosLivres] = useState('');
  const [sintomasAtuais, setSintomasAtuais] = useState('');
  const [conteudo, setConteudo] = useState('');

  const handleTouch = () => setTouched(true);

  const toggleEfeito = (tag: string) => {
    handleTouch();
    setEfeitosTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const getColorDor = (val: number) => {
    if (val <= 3) return 'text-green-500';
    if (val <= 6) return 'text-amber-500';
    return 'text-red-500';
  };

  const handleCancelar = () => {
    if (touched) {
      if (!window.confirm('Tem certeza que deseja descartar as alterações? Os dados não salvos serão perdidos.')) {
        return;
      }
    }
    onCancelar();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!conteudo.trim()) {
      toast.error('O conteúdo/observações é obrigatório.');
      return;
    }
    setLoading(true);

    const efeitosConcatenados = [...efeitosTags, efeitosLivres].filter(Boolean).join(', ');

    const payload = {
      salaId,
      data,
      tipo,
      nivelDor,
      qualidadeSono: qualidadeSono || undefined,
      bemEstar: bemEstar || undefined,
      sintomasAtuais,
      efeitosColaterais: efeitosConcatenados,
      conteudo
    };

    const res = await criarEvolucaoInline(payload);
    
    if (res.sucesso) {
      toast.success('Evolução registrada com sucesso!');
      onConcluir();
    } else {
      toast.error(res.erro || 'Falha ao registrar evolução.');
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
      <div className="px-5 py-4 border-b border-border bg-muted/30 sticky top-0 z-10 flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" /> Nova Evolução Clínica
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Registro rápido da consulta</p>
        </div>
        <div className="flex items-center gap-2">
          {/* TODO(Sprint 2D): <Button variant="ghost" className="text-indigo-600 bg-indigo-50"><Sparkles className="w-4 h-4 mr-2"/> Preencher com IA</Button> */}
          <button type="button" onClick={handleCancelar} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        
        {/* DATA E TIPO */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Data da Evolução</label>
            <Input type="date" value={data} onChange={e => { setData(e.target.value); handleTouch(); }} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground flex items-center">
              Tipo <RenderIAslot campo="tipo" />
            </label>
            <Select value={tipo} onValueChange={(v: any) => { setTipo(v); handleTouch(); }}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="positiva">Positiva</SelectItem>
                <SelectItem value="estavel">Estável</SelectItem>
                <SelectItem value="negativa">Negativa</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* MÉTRICAS (DOR, SONO, BEM ESTAR) */}
        <div className="space-y-4 p-4 rounded-xl border border-border bg-card shadow-sm">
          <div className="space-y-3">
            <div className="flex justify-between items-end">
              <label className="text-xs font-semibold text-muted-foreground flex items-center">
                Nível de Dor Atual <RenderIAslot campo="nivelDor" />
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

          <div className="pt-3 border-t border-border grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground flex items-center">
                Qualidade do Sono <RenderIAslot campo="qualidadeSono" />
              </label>
              <div className="flex flex-wrap gap-1.5">
                {['ruim', 'regular', 'boa', 'excelente'].map(opt => (
                  <button type="button" key={opt}
                    onClick={() => { setQualidadeSono(opt as any); handleTouch(); }}
                    className={`px-2.5 py-1 text-xs rounded-full border capitalize transition-colors ${qualidadeSono === opt ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 border-border text-muted-foreground hover:bg-muted'}`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground flex items-center">
                Bem-estar Geral <RenderIAslot campo="bemEstar" />
              </label>
              <div className="flex flex-wrap gap-1.5">
                {['ruim', 'regular', 'boa', 'excelente'].map(opt => (
                  <button type="button" key={opt}
                    onClick={() => { setBemEstar(opt as any); handleTouch(); }}
                    className={`px-2.5 py-1 text-xs rounded-full border capitalize transition-colors ${bemEstar === opt ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 border-border text-muted-foreground hover:bg-muted'}`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* SINTOMAS E EFEITOS COLATERAIS */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground flex items-center">
              Sintomas Atuais <RenderIAslot campo="sintomasAtuais" />
            </label>
            <Input 
              placeholder="Ex: Dor latejante, ansiedade alta..." 
              value={sintomasAtuais} 
              onChange={e => { setSintomasAtuais(e.target.value); handleTouch(); }} 
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground flex items-center">
              Efeitos Colaterais (Cannabis) <RenderIAslot campo="efeitosColaterais" />
            </label>
            <div className="flex flex-wrap gap-2">
              {EFEITOS_CBD.map(tag => (
                <button type="button" key={tag}
                  onClick={() => toggleEfeito(tag)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md border transition-colors ${efeitosTags.includes(tag) ? 'bg-orange-500/10 text-orange-600 border-orange-500/30' : 'bg-background border-border text-muted-foreground hover:bg-muted'}`}
                >
                  {tag}
                </button>
              ))}
            </div>
            <Input 
              placeholder="Outros efeitos colaterais..." 
              value={efeitosLivres} 
              onChange={e => { setEfeitosLivres(e.target.value); handleTouch(); }} 
              className="mt-2 text-sm"
            />
          </div>
        </div>

        {/* CONTEÚDO / OBSERVAÇÕES */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground flex items-center">
            Observações Clínicas (Obrigatório) <RenderIAslot campo="conteudo" />
          </label>
          <Textarea 
            placeholder="Relato completo da consulta..." 
            value={conteudo} 
            onChange={e => { setConteudo(e.target.value); handleTouch(); }} 
            className="min-h-[140px] text-sm resize-none"
            required
          />
        </div>
      </div>

      {/* FOOTER */}
      <div className="px-5 py-4 border-t border-border bg-background sticky bottom-0 z-10 flex justify-end gap-3 shadow-[0_-4px_15px_-5px_rgba(0,0,0,0.05)]">
        <Button variant="outline" type="button" onClick={handleCancelar} disabled={loading}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading} className="w-32 bg-primary">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar Evolução'}
        </Button>
      </div>
    </form>
  );
}
