'use client';

import { useState, useTransition, useCallback } from 'react';
import { toast } from 'sonner';
import { PacienteCard } from './paciente-card';
import { atualizarJornadaFase, type PacienteKanban } from '@/app/_actions/pacientes';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft,
  ChevronRight,
  FileCheck,
  HeartPulse,
  HelpCircle,
  LayoutGrid,
  Menu,
  Search,
  Stethoscope,
  Truck,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
/**
 * Kanban Board — Jornada do Paciente.
 *
 * Design: Organic / Editorial Caloroso
 * - Colunas com header em gradient sutil nos tons da paleta orgânica
 * - Cards com borda arredondada 2xl e transições suaves 300ms
 * - Drag & drop nativo HTML5 com feedback visual orgânico
 * - Cores: secondary (moss), terracotta, clay, peach, stone
 * - Ícone contextual por fase (HugeIcons free)
 * - Paginação independente por coluna
 */

/** Configuração de cada coluna do Kanban */
const COLUNAS: {
  id: FaseId;
  titulo: string;
  subtitulo: string;
  icon: LucideIcon;
  cores: {
    header: string;
    dot: string;
    titulo: string;
    dropZone: string;
    dropBorder: string;
    contagem: string;
    iconBg: string;
    colunaBg: string;
    accent: string; // cor hex para uso direto nos badges
  };
}[] = [
  {
    id: 'acolhimento',
    titulo: 'Acolhimento',
    subtitulo: 'Primeiro contato e triagem inicial',
    icon: HeartPulse,
    cores: {
      header: 'bg-gradient-to-br from-[#1A6B41] to-[#2D9160]',
      dot: 'bg-white',
      titulo: 'text-white',
      dropZone: 'bg-[#1A6B41]/10 ring-2 ring-[#1A6B41]/40',
      dropBorder: 'border-[#1A6B41]/50',
      contagem: 'text-white',
      iconBg: 'bg-white/20 text-white',
      colunaBg: 'border-[#1A6B41]/20 bg-[#1A6B41]/5',
      accent: '#1A6B41',
    },
  },
  {
    id: 'avaliacao_medica',
    titulo: 'Avaliação Médica',
    subtitulo: 'Consulta com profissional',
    icon: Stethoscope,
    cores: {
      header: 'bg-gradient-to-br from-[#B83220] to-[#D94F35]',
      dot: 'bg-white',
      titulo: 'text-white',
      dropZone: 'bg-[#B83220]/10 ring-2 ring-[#B83220]/40',
      dropBorder: 'border-[#B83220]/50',
      contagem: 'text-white',
      iconBg: 'bg-white/20 text-white',
      colunaBg: 'border-[#B83220]/20 bg-[#B83220]/5',
      accent: '#B83220',
    },
  },
  {
    id: 'burocracia_anvisa',
    titulo: 'Burocracia / ANVISA',
    subtitulo: 'Documentos e autorização',
    icon: FileCheck,
    cores: {
      header: 'bg-gradient-to-br from-[#9A6C00] to-[#C48F00]',
      dot: 'bg-white',
      titulo: 'text-white',
      dropZone: 'bg-[#9A6C00]/10 ring-2 ring-[#9A6C00]/40',
      dropBorder: 'border-[#9A6C00]/50',
      contagem: 'text-white',
      iconBg: 'bg-white/20 text-white',
      colunaBg: 'border-[#9A6C00]/20 bg-[#9A6C00]/5',
      accent: '#9A6C00',
    },
  },
  {
    id: 'logistica',
    titulo: 'Logística',
    subtitulo: 'Pedido e entrega',
    icon: Truck,
    cores: {
      header: 'bg-gradient-to-br from-[#2563EB] to-[#3B82F6]',
      dot: 'bg-white',
      titulo: 'text-white',
      dropZone: 'bg-[#2563EB]/10 ring-2 ring-[#2563EB]/40',
      dropBorder: 'border-[#2563EB]/50',
      contagem: 'text-white',
      iconBg: 'bg-white/20 text-white',
      colunaBg: 'border-[#2563EB]/20 bg-[#2563EB]/5',
      accent: '#2563EB',
    },
  },
  {
    id: 'acompanhamento_continuo',
    titulo: 'Acompanhamento',
    subtitulo: 'Renovação e cuidado contínuo',
    icon: Users,
    cores: {
      header: 'bg-gradient-to-br from-[#7C3AED] to-[#9D5CF6]',
      dot: 'bg-white',
      titulo: 'text-white',
      dropZone: 'bg-[#7C3AED]/10 ring-2 ring-[#7C3AED]/40',
      dropBorder: 'border-[#7C3AED]/50',
      contagem: 'text-white',
      iconBg: 'bg-white/20 text-white',
      colunaBg: 'border-[#7C3AED]/20 bg-[#7C3AED]/5',
      accent: '#7C3AED',
    },
  },
];

type FaseId =
  | 'acolhimento'
  | 'avaliacao_medica'
  | 'burocracia_anvisa'
  | 'logistica'
  | 'acompanhamento_continuo';

type DadosKanban = Record<FaseId, PacienteKanban[]>;

const ITENS_POR_PAGINA = 10;

interface KanbanBoardProps {
  dadosIniciais: DadosKanban;
}

export function KanbanBoard({ dadosIniciais }: KanbanBoardProps) {
  const [dados, setDados] = useState<DadosKanban>(dadosIniciais);
  const [dragOverColuna, setDragOverColuna] = useState<FaseId | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [busca, setBusca] = useState('');
  const [modoCompacto, setModoCompacto] = useState(false);

  // Paginação independente por coluna
  const [paginas, setPaginas] = useState<Record<FaseId, number>>({
    acolhimento: 1,
    avaliacao_medica: 1,
    burocracia_anvisa: 1,
    logistica: 1,
    acompanhamento_continuo: 1,
  });

  const setPaginaColuna = useCallback((faseId: FaseId, pagina: number) => {
    setPaginas((prev) => ({ ...prev, [faseId]: pagina }));
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent, pacienteId: string) => {
    e.dataTransfer.setData('text/plain', pacienteId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingId(pacienteId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDragEnter = useCallback((faseId: FaseId) => {
    setDragOverColuna(faseId);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent, faseId: FaseId) => {
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    const currentTarget = e.currentTarget as HTMLElement;
    if (!relatedTarget || !currentTarget.contains(relatedTarget)) {
      if (dragOverColuna === faseId) {
        setDragOverColuna(null);
      }
    }
  }, [dragOverColuna]);

  const handleDrop = useCallback((e: React.DragEvent, faseDestino: FaseId) => {
    e.preventDefault();
    setDragOverColuna(null);
    setDraggingId(null);

    const pacienteId = e.dataTransfer.getData('text/plain');
    if (!pacienteId) return;

    let faseOrigem: FaseId | null = null;
    let paciente: PacienteKanban | undefined;

    for (const [fase, lista] of Object.entries(dados)) {
      const found = lista.find((p) => p.id === pacienteId);
      if (found) {
        faseOrigem = fase as FaseId;
        paciente = found;
        break;
      }
    }

    if (!paciente || !faseOrigem || faseOrigem === faseDestino) return;

    // Atualização otimista
    setDados((prev) => {
      const novo = { ...prev };
      novo[faseOrigem!] = prev[faseOrigem!].filter((p) => p.id !== pacienteId);
      novo[faseDestino] = [
        { ...paciente!, jornadaFase: faseDestino },
        ...prev[faseDestino],
      ];
      return novo;
    });

    // Persistir no servidor
    startTransition(async () => {
      const colunaDestino = COLUNAS.find((c) => c.id === faseDestino);
      const result = await atualizarJornadaFase(pacienteId, faseDestino);

      if (result.sucesso) {
        toast.success(`${paciente!.nome}`, {
          description: `Movido para ${colunaDestino?.titulo ?? faseDestino}`,
        });
      } else {
        // Reverter
        setDados((prev) => {
          const revertido = { ...prev };
          revertido[faseDestino] = prev[faseDestino].filter((p) => p.id !== pacienteId);
          revertido[faseOrigem!] = [paciente!, ...prev[faseOrigem!]];
          return revertido;
        });
        toast.error('Falha ao mover paciente', {
          description: result.erro ?? 'Tente novamente.',
        });
      }
    });
  }, [dados]);

  const handleDragEnd = useCallback(() => {
    setDraggingId(null);
    setDragOverColuna(null);
  }, []);

  const totalPacientes = Object.values(dados).reduce((acc, lista) => acc + lista.length, 0);

  /** Filtra pacientes pelo termo de busca (nome ou email, case-insensitive) */
  function filtrarPacientes(lista: PacienteKanban[]): PacienteKanban[] {
    if (!busca.trim()) return lista;
    const termo = busca.toLowerCase();
    return lista.filter(
      (p) =>
        p.nome.toLowerCase().includes(termo) ||
        p.email.toLowerCase().includes(termo),
    );
  }

  const totalFiltrado = Object.values(dados).reduce(
    (acc, lista) => acc + filtrarPacientes(lista).length,
    0,
  );

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col gap-4">
        {/* Barra de controles: busca + modo + status */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Busca */}
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                // Reset todas as paginações ao buscar
                setPaginas({
                  acolhimento: 1,
                  avaliacao_medica: 1,
                  burocracia_anvisa: 1,
                  logistica: 1,
                  acompanhamento_continuo: 1,
                });
              }}
              placeholder="Buscar paciente em todas as fases..."
              className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
            />
            {busca && (
              <button
                onClick={() => {
                  setBusca('');
                  setPaginas({
                    acolhimento: 1,
                    avaliacao_medica: 1,
                    burocracia_anvisa: 1,
                    logistica: 1,
                    acompanhamento_continuo: 1,
                  });
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Direita: status + toggle modo */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {busca ? (
                <>
                  <span className="font-semibold text-foreground">{totalFiltrado}</span> de{' '}
                  <span className="font-semibold text-foreground">{totalPacientes}</span> pacientes
                </>
              ) : (
                <>
                  <span className="font-semibold text-foreground">{totalPacientes}</span>{' '}
                  {totalPacientes === 1 ? 'paciente' : 'pacientes'}
                </>
              )}
            </span>

            {isPending && (
              <span className="inline-flex items-center gap-2 rounded-full bg-secondary/10 px-3 py-1 text-[11px] font-medium text-secondary animate-pulse">
                <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
                Salvando...
              </span>
            )}

            {/* Toggle modo compacto */}
            <Tooltip>
              <TooltipTrigger
                onClick={() => setModoCompacto((v) => !v)}
                className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-all ${
                  modoCompacto
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
                }`}
              >
                {(() => { const DynIcon = modoCompacto ? LayoutGrid : Menu; return <DynIcon size={15} />; })()}
              </TooltipTrigger>
              <TooltipContent>
                {modoCompacto ? 'Modo completo' : 'Modo compacto'}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger className="text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                <HelpCircle size={16} />
              </TooltipTrigger>
              <TooltipContent>
                Arraste os cartões para mudar a fase do paciente
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Board Kanban — preenche o espaço restante */}
        <div
          className="min-h-0 flex-1 grid gap-5"
          style={{
            gridTemplateColumns: `repeat(${COLUNAS.length}, minmax(300px, 1fr))`,
            gridTemplateRows: '1fr',
          }}
          onDragEnd={handleDragEnd}
        >
          {COLUNAS.map((coluna, i) => {
            const pacientesColuna = dados[coluna.id] || [];
            const listaFiltrada = filtrarPacientes(pacientesColuna);
            const isOver = dragOverColuna === coluna.id;
            const paginaAtual = paginas[coluna.id];
            const totalPaginas = Math.max(1, Math.ceil(listaFiltrada.length / ITENS_POR_PAGINA));
            const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA;
            const listaPaginada = listaFiltrada.slice(inicio, inicio + ITENS_POR_PAGINA);

            return (
              <div
                key={coluna.id}
                className={`
                  flex flex-col overflow-hidden min-h-0 rounded-2xl border transition-all duration-300 ease-out
                  animate-fade-up
                  ${isOver
                    ? `${coluna.cores.dropZone} ${coluna.cores.dropBorder} scale-[1.01]`
                    : `${coluna.cores.colunaBg}`
                  }
                `}
                style={{ animationDelay: `${i * 80}ms` }}
                onDragOver={handleDragOver}
                onDragEnter={() => handleDragEnter(coluna.id)}
                onDragLeave={(e) => handleDragLeave(e, coluna.id)}
                onDrop={(e) => handleDrop(e, coluna.id)}
              >
                {/* Header da coluna */}
                <div className={`rounded-t-2xl px-4 py-4 ${coluna.cores.header}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${coluna.cores.iconBg}`}>
                        {(() => { const DynIcon = coluna.icon; return <DynIcon size={18} />; })()}
                      </div>
                      <div className="min-w-0">
                        <h3 className={`text-xs font-bold uppercase tracking-wide leading-snug ${coluna.cores.titulo}`}>
                          {coluna.titulo}
                        </h3>
                        <p className="text-[11px] text-white/65 leading-tight mt-0.5 truncate">
                          {coluna.subtitulo}
                        </p>
                      </div>
                    </div>
                    <span className={`font-heading text-2xl font-bold shrink-0 ${coluna.cores.contagem}`}>
                      {listaFiltrada.length}
                    </span>
                  </div>
                </div>

                {/* Lista de cards — scroll interno, preenche o restante da coluna */}
                <div
                  className="kanban-scroll min-h-0 flex-1 overflow-y-auto p-3"
                >
                  {listaPaginada.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/60">
                        {(() => { const DynIcon = busca ? Search : coluna.icon; return <DynIcon size={20} className="text-muted-foreground/30" />; })()}
                      </div>
                      <p className="text-[11px] text-muted-foreground/50 leading-relaxed max-w-[160px]">
                        {busca
                          ? `Nenhum resultado para "${busca}"`
                          : 'Arraste pacientes para esta fase'}
                      </p>
                    </div>
                  ) : (
                    <div className={modoCompacto ? 'space-y-1' : 'space-y-3'}>
                      {listaPaginada.map((paciente) => (
                        <div
                          key={paciente.id}
                          className={`transition-all duration-200 ${
                            draggingId === paciente.id
                              ? 'opacity-30 scale-95'
                              : 'opacity-100 scale-100'
                          }`}
                        >
                          <PacienteCard
                            paciente={paciente}
                            onDragStart={handleDragStart}
                            accentColor={coluna.cores.accent}
                            compact={modoCompacto}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Paginação da coluna */}
                {listaFiltrada.length > ITENS_POR_PAGINA && (
                  <div className="flex items-center justify-between border-t border-border/30 px-3 py-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={paginaAtual <= 1}
                      onClick={() => setPaginaColuna(coluna.id, paginaAtual - 1)}
                      className="h-7 w-7 p-0"
                    >
                      <ChevronLeft size={14} />
                    </Button>
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {paginaAtual} / {totalPaginas}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={paginaAtual >= totalPaginas}
                      onClick={() => setPaginaColuna(coluna.id, paginaAtual + 1)}
                      className="h-7 w-7 p-0"
                    >
                      <ChevronRight size={14} />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}
