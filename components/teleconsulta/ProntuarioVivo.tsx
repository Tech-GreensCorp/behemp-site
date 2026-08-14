'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, Pill, FlaskConical, Calendar, SlidersHorizontal, FileText, ClipboardList,
  Search, X, Loader2, ChevronDown, ChevronUp, AlertCircle, Clock
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { buscarProntuarioCompleto, type EventoProntuario, type TipoEventoProntuario } from '@/app/(medico)/_actions/prontuario-vivo';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ProntuarioVivoProps {
  salaId: string;
  pacienteNome: string;
  onFechar: () => void;
  onToggleExpand: () => void;
  isExpanded: boolean;
}

const FILTROS: { id: TipoEventoProntuario | 'todos', label: string }[] = [
  { id: 'todos', label: 'Tudo' },
  { id: 'evolucao', label: 'Evoluções' },
  { id: 'prescricao', label: 'Prescrições' },
  { id: 'exame', label: 'Exames' },
  { id: 'ajuste_dosagem', label: 'Dosagem' },
  { id: 'documento', label: 'Documentos' },
  { id: 'consulta', label: 'Consultas' },
  { id: 'anamnese', label: 'Anamnese' },
];

const ICONS = {
  evolucao: <Activity className="h-4 w-4" />,
  prescricao: <Pill className="h-4 w-4" />,
  exame: <FlaskConical className="h-4 w-4" />,
  consulta: <Calendar className="h-4 w-4" />,
  ajuste_dosagem: <SlidersHorizontal className="h-4 w-4" />,
  documento: <FileText className="h-4 w-4" />,
  anamnese: <ClipboardList className="h-4 w-4" />,
};

const COLORS = {
  evolucao: 'bg-green-500/10 text-green-600 border-green-500/20',
  prescricao: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  exame: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  consulta: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
  ajuste_dosagem: 'bg-violet-500/10 text-violet-600 border-violet-500/20',
  documento: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  anamnese: 'bg-pink-500/10 text-pink-600 border-pink-500/20',
};

export function ProntuarioVivo({ salaId, pacienteNome, onFechar, onToggleExpand, isExpanded }: ProntuarioVivoProps) {
  const [eventos, setEventos] = useState<EventoProntuario[]>([]);
  const [filtro, setFiltro] = useState<TipoEventoProntuario | 'todos'>('todos');
  const [busca, setBusca] = useState('');
  const [buscaDebounced, setBuscaDebounced] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const observerTarget = useRef<HTMLDivElement>(null);

  // Debounce Busca
  useEffect(() => {
    const timer = setTimeout(() => setBuscaDebounced(busca), 400);
    return () => clearTimeout(timer);
  }, [busca]);

  const loadEventos = useCallback(async (isLoadMore = false) => {
    if (!isLoadMore) {
      setLoading(true);
      setEventos([]);
    } else {
      setLoadingMore(true);
    }

    const currentCursor = isLoadMore ? cursor : null;
    const res = await buscarProntuarioCompleto({
      salaId,
      filtro,
      busca: buscaDebounced,
      cursor: currentCursor,
    });

    if (res.sucesso && res.eventos) {
      setEventos(prev => isLoadMore ? [...prev, ...res.eventos!] : res.eventos!);
      setCursor(res.proximoCursor || null);
      setHasMore(!!res.proximoCursor);
    }
    
    setLoading(false);
    setLoadingMore(false);
  }, [salaId, filtro, buscaDebounced, cursor]);

  // Dispara a busca inicial ou quando os filtros mudam
  useEffect(() => {
    loadEventos(false);
  }, [filtro, buscaDebounced]);

  // Intersection Observer para Infinity Scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          loadEventos(true);
        }
      },
      { threshold: 1.0 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, loadEventos]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderDetalhes = (evento: EventoProntuario) => {
    const det = evento.detalhes as any;
    switch (evento.tipo) {
      case 'evolucao':
        return (
          <div className="space-y-3 mt-3 pt-3 border-t border-border">
            {det.conteudo && <p className="text-sm whitespace-pre-wrap">{det.conteudo}</p>}
            <div className="flex flex-wrap gap-2 pt-1">
              {det.nivelDor != null && <Badge variant="outline" className="bg-background text-[10px]">Dor: {det.nivelDor}/10</Badge>}
              {det.qualidadeSono && <Badge variant="outline" className="bg-background text-[10px]">Sono: {det.qualidadeSono}</Badge>}
              {det.bemEstar && <Badge variant="outline" className="bg-background text-[10px]">Bem-estar: {det.bemEstar}</Badge>}
            </div>
          </div>
        );
      case 'prescricao':
        return (
          <div className="space-y-2 mt-3 pt-3 border-t border-border">
            {Array.isArray(det.medicamentos) && det.medicamentos.map((m: any, i: number) => (
              <div key={i} className="bg-muted p-2 rounded-md">
                <p className="text-sm font-semibold">{m.nome}</p>
                <p className="text-xs text-muted-foreground">{m.posologia || m.dose}</p>
              </div>
            ))}
          </div>
        );
      case 'exame':
        return (
          <div className="space-y-2 mt-3 pt-3 border-t border-border">
            {det.observacoes && <p className="text-sm text-muted-foreground">{det.observacoes}</p>}
            {det.urlArquivo && (
              <a href={det.urlArquivo} target="_blank" rel="noreferrer" className="text-primary text-xs hover:underline flex items-center gap-1">
                <FileText className="h-3 w-3" /> {det.nomeArquivo || 'Visualizar Arquivo'}
              </a>
            )}
          </div>
        );
      case 'consulta':
        return (
          <div className="space-y-2 mt-3 pt-3 border-t border-border">
            {det.observacoes && <p className="text-sm">{det.observacoes}</p>}
            {det.meetLink && (
              <a href={det.meetLink} target="_blank" rel="noreferrer" className="text-blue-500 text-xs hover:underline">Link do Google Meet</a>
            )}
          </div>
        );
      case 'ajuste_dosagem':
        return (
          <div className="space-y-2 mt-3 pt-3 border-t border-border">
            <p className="text-sm font-medium">Motivo: <span className="font-normal">{det.motivo}</span></p>
            {det.itens && det.itens.length > 0 && (
              <div className="space-y-1 mt-2">
                {det.itens.map((i: any, idx: number) => (
                  <div key={idx} className="bg-muted p-2 rounded-md text-xs flex justify-between">
                    <span>{i.tipoCanabinoide}</span>
                    <span className="font-medium">{i.novaDosagem} ({i.frequencia})</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      case 'anamnese':
        return (
          <div className="space-y-3 mt-3 pt-3 border-t border-border">
            {det.historiaDoencaAtual && (
              <div>
                <p className="text-[10px] font-bold uppercase text-muted-foreground">História da Doença Atual</p>
                <p className="text-sm">{det.historiaDoencaAtual}</p>
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              {det.tabagismo && <Badge variant="outline" className="bg-background text-[10px]">Tabagismo: {det.tabagismo.replace('_', ' ')}</Badge>}
              {det.consumoAlcool && <Badge variant="outline" className="bg-background text-[10px]">Álcool: {det.consumoAlcool.replace('_', ' ')}</Badge>}
            </div>
          </div>
        );
      case 'documento':
        return (
          <div className="space-y-2 mt-3 pt-3 border-t border-border">
            {det.observacoes && <p className="text-sm">{det.observacoes}</p>}
            {det.url && (
              <a href={det.url} target="_blank" rel="noreferrer" className="text-primary text-xs hover:underline flex items-center gap-1">
                <FileText className="h-3 w-3" /> Acessar Documento
              </a>
            )}
            {det.validade && <p className="text-[10px] text-muted-foreground">Validade: {format(new Date(det.validade), 'dd/MM/yyyy')}</p>}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-background relative">
      {/* HEADER */}
      <div className="px-5 py-4 border-b border-border bg-muted/30 sticky top-0 z-10 flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" /> Histórico Completo
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">{pacienteNome}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onToggleExpand} className="text-xs h-8">
            {isExpanded ? 'Recolher' : 'Expandir'}
          </Button>
          <button onClick={onFechar} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* SEARCH E FILTROS */}
      <div className="p-4 border-b border-border space-y-3 bg-card">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar no histórico..." 
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {FILTROS.map(f => (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border
                ${filtro === f.id ? 'bg-primary text-white border-primary' : 'bg-muted/50 border-transparent hover:bg-muted text-muted-foreground'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* TIMELINE DE EVENTOS */}
      <div className="flex-1 overflow-y-auto p-5 pb-20 relative">
        {/* Linha vertical da timeline */}
        <div className="absolute left-9 top-5 bottom-0 w-px bg-border z-0" />

        {loading && eventos.length === 0 ? (
          <div className="flex justify-center items-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : eventos.length === 0 ? (
          <div className="text-center py-10 bg-muted/30 rounded-xl border border-dashed border-border mt-4">
            <AlertCircle className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum registro encontrado.</p>
          </div>
        ) : (
          <div className="space-y-4 relative z-10">
            {eventos.map((evento) => {
              const isEventExpanded = expandedIds.has(evento.id);
              const colorClass = COLORS[evento.tipo];

              return (
                <div key={evento.id} className="flex gap-4 relative">
                  {/* Ícone (Nó da Timeline) */}
                  <div className={`mt-1 h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center border bg-background shadow-sm ${colorClass}`}>
                    {ICONS[evento.tipo]}
                  </div>

                  {/* Card de Conteúdo */}
                  <div 
                    className="flex-1 bg-card border border-border rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => toggleExpand(evento.id)}
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <h4 className="text-sm font-semibold leading-tight text-foreground">{evento.titulo}</h4>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {format(new Date(evento.data), "dd 'de' MMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      <div className="text-muted-foreground">
                        {isEventExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </div>

                    {!isEventExpanded && evento.resumo && (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{evento.resumo}</p>
                    )}

                    {/* Conteúdo Expandido via framer-motion */}
                    <AnimatePresence>
                      {isEventExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          {renderDetalhes(evento)}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}

            {/* Sentinela de Intersection Observer */}
            <div ref={observerTarget} className="h-10 flex items-center justify-center pt-4">
              {loadingMore ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : !hasMore && eventos.length > 0 ? (
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Início do histórico do paciente</p>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
