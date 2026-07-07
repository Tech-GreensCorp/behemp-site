'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Pill,
  Calendar,
  Loader2,
  FlaskConical,
  Clock,
  ChevronDown,
  ChevronUp,
  Repeat2,
  MessageSquare,
  ChevronRight,
} from 'lucide-react';
import { listarMeusMedicamentos, type ItemMedicamentoPaciente } from '@/app/_actions/medicamentos-paciente';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// Agrupa itens pelo ajusteId para exibir por data de ajuste
function agruparPorAjuste(itens: ItemMedicamentoPaciente[]) {
  const map = new Map<string, {
    dataAjuste: string;
    motivoAjuste: string;
    proximaRevisao: string | null;
    itens: ItemMedicamentoPaciente[];
  }>();
  for (const item of itens) {
    if (!map.has(item.ajusteId)) {
      map.set(item.ajusteId, {
        dataAjuste: item.dataAjuste,
        motivoAjuste: item.motivoAjuste,
        proximaRevisao: item.proximaRevisao,
        itens: [],
      });
    }
    map.get(item.ajusteId)!.itens.push(item);
  }
  return Array.from(map.entries()).map(([ajusteId, data]) => ({ ajusteId, ...data }));
}

export default function MedicamentosPage() {
  const [itens, setItens] = useState<ItemMedicamentoPaciente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  const carregar = useCallback(async () => {
    setCarregando(true);
    const res = await listarMeusMedicamentos();
    if (res.sucesso && res.dados) {
      setItens(res.dados);
      // Expande o ajuste mais recente por padrão
      if (res.dados.length > 0) {
        setExpandidos(new Set([res.dados[0].ajusteId]));
      }
    }
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const toggleExpandido = (ajusteId: string) => {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(ajusteId)) next.delete(ajusteId);
      else next.add(ajusteId);
      return next;
    });
  };

  const grupos = agruparPorAjuste(itens);

  return (
    <div className="space-y-6 sm:space-y-10">
      {/* ── Header Editorial ── */}
      <div className="animate-fade-up">
        <p className="text-primary mb-2 sm:mb-4 text-xs font-semibold tracking-[0.25em] uppercase">
          Área do Paciente
        </p>
        <h1 className="font-display text-3xl leading-[1.1] font-bold tracking-tight sm:text-5xl text-foreground">
          Meus <span className="text-accent-italic">Medicamentos</span>
        </h1>
        <p className="text-muted-foreground mt-2 sm:mt-4 max-w-2xl text-sm sm:text-base leading-relaxed">
          Acompanhe seus medicamentos prescritos e o histórico de dosagens.
        </p>
      </div>

      {carregando ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : grupos.length === 0 ? (
        /* ── Empty state ── */
        <Card className="border border-border/20 bg-white shadow-sm rounded-2xl sm:rounded-3xl grain overflow-hidden animate-fade-up delay-75">
          <CardContent className="flex flex-col items-center justify-center py-12 sm:py-20 text-center px-4 sm:px-6">
            <div className="mb-5 flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-primary/10">
              <Pill className="h-8 w-8 sm:h-10 sm:w-10 text-primary/40" />
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-foreground">
              Nenhum medicamento prescrito
            </h2>
            <p className="mt-2 sm:mt-3 max-w-sm text-sm text-muted-foreground leading-relaxed">
              Seu médico responsável irá configurar sua dosagem.
              Caso já tenha consultado, entre em contato pelo chat.
            </p>
            <Link
              href="/paciente/chat"
              className="mt-5 sm:mt-6 inline-flex items-center gap-2 rounded-full bg-[#16a34a] hover:bg-[#148f43] px-6 py-3 text-sm font-bold text-white shadow-md hover:shadow-lg transition-all duration-200"
            >
              <MessageSquare className="h-4 w-4" />
              Falar com a equipe
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ── Dosagem atual (ajuste mais recente) ── */}
          <div className="animate-fade-up delay-75">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
                <Pill className="h-4 w-4 text-primary" />
              </div>
              <h2 className="font-display text-lg font-bold text-foreground">Dosagem Atual</h2>
              <Badge className="rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 text-[10px] font-bold px-2 py-0.5 ml-1">
                Ativa
              </Badge>
            </div>

            <Card className="border border-border/20 bg-white shadow-sm rounded-2xl sm:rounded-3xl grain overflow-hidden">
              <CardContent className="p-4 sm:p-6 space-y-4">
                <p className="text-xs text-muted-foreground/60 font-bold uppercase tracking-wider">
                  Ajuste em{' '}
                  {new Date(grupos[0].dataAjuste + 'T00:00:00').toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>

                <div className="space-y-3">
                  {grupos[0].itens.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-center gap-2 sm:gap-3 rounded-2xl bg-muted/30 border border-border/10 px-3 sm:px-4 py-3"
                    >
                      <Badge variant="secondary" className="rounded-lg font-bold text-xs">
                        {item.tipoCanabinoide}
                      </Badge>
                      <span className="text-sm font-bold text-foreground">{item.novaDosagem}</span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Repeat2 className="h-3.5 w-3.5" />
                        {item.frequencia}
                      </span>
                      {item.viaAdministracao && (
                        <span className="text-xs text-muted-foreground">
                          Via: {item.viaAdministracao}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {grupos[0].proximaRevisao && (
                  <div className="flex items-center gap-2 rounded-2xl bg-primary/5 border border-primary/10 px-4 py-3">
                    <Clock className="h-4 w-4 shrink-0 text-primary" />
                    <span className="text-sm font-bold text-primary">Próxima revisão</span>
                    <span className="ml-auto text-sm font-bold text-primary">
                      {new Date(grupos[0].proximaRevisao + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Histórico de ajustes anteriores ── */}
          {grupos.length > 1 && (
            <div className="space-y-4 animate-fade-up delay-150">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted/50">
                  <FlaskConical className="h-4 w-4 text-muted-foreground" />
                </div>
                <h2 className="font-display text-lg font-bold text-foreground">Histórico de Dosagens</h2>
              </div>

              <div className="space-y-3">
                {grupos.slice(1).map((grupo) => {
                  const expandido = expandidos.has(grupo.ajusteId);
                  return (
                    <Card key={grupo.ajusteId} className="border border-border/20 bg-white shadow-sm rounded-2xl sm:rounded-3xl grain overflow-hidden opacity-80 hover:opacity-100 transition-opacity">
                      <button
                        className="flex w-full items-center justify-between p-4 sm:px-6 sm:py-4 text-left cursor-pointer"
                        onClick={() => toggleExpandido(grupo.ajusteId)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted/30">
                            <FlaskConical className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-foreground">
                              {new Date(grupo.dataAjuste + 'T00:00:00').toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: 'long',
                                year: 'numeric',
                              })}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {grupo.itens.length} medicamento{grupo.itens.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                        {expandido
                          ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                          : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                        }
                      </button>

                      {expandido && (
                        <CardContent className="space-y-3 pt-0 px-4 sm:px-6 pb-4 sm:pb-6">
                          {grupo.itens.map((item) => (
                            <div
                              key={item.id}
                              className="flex flex-wrap items-center gap-2 sm:gap-3 rounded-2xl bg-muted/20 border border-border/10 px-3 sm:px-4 py-2.5"
                            >
                              <Badge variant="outline" className="rounded-lg font-bold text-xs">
                                {item.tipoCanabinoide}
                              </Badge>
                              <span className="text-sm text-foreground">{item.novaDosagem}</span>
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Repeat2 className="h-3.5 w-3.5" />
                                {item.frequencia}
                              </span>
                              {item.viaAdministracao && (
                                <span className="text-xs text-muted-foreground">
                                  Via: {item.viaAdministracao}
                                </span>
                              )}
                            </div>
                          ))}
                          {grupo.proximaRevisao && (
                            <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                              <Calendar className="h-3.5 w-3.5 shrink-0" />
                              Próxima revisão:{' '}
                              {new Date(grupo.proximaRevisao + 'T00:00:00').toLocaleDateString('pt-BR')}
                            </div>
                          )}
                        </CardContent>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Botão de recompra ── */}
          <div className="animate-fade-up delay-200">
            <Link
              href="/paciente/recompra"
              className="group inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-6 py-3 text-sm font-bold text-primary transition-all hover:bg-primary/10 hover:border-primary/30 hover:shadow-md"
            >
              Solicitar recompra
              <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
