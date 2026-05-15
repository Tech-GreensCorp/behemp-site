'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
} from 'lucide-react';
import { listarMeusMedicamentos, type ItemMedicamentoPaciente } from '@/app/_actions/medicamentos-paciente';
import Link from 'next/link';

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

  if (carregando) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const grupos = agruparPorAjuste(itens);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">Medicamentos</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Acompanhe seus medicamentos prescritos pelo médico
        </p>
      </div>

      {/* Empty state */}
      {grupos.length === 0 && (
        <Card className="border-border/40 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Pill className="h-8 w-8 text-primary/60" />
            </div>
            <p className="text-lg font-semibold">Nenhum medicamento prescrito</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Seu médico responsável irá configurar sua dosagem.
              Caso já tenha consultado, entre em contato pelo chat.
            </p>
            <Link
              href="/paciente/chat"
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              Falar com a equipe
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Dosagem atual (ajuste mais recente) */}
      {grupos.length > 0 && (
        <>
          <div>
            <h2 className="mb-3 font-heading text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Dosagem atual
            </h2>
            <Card className="border-border/40 shadow-sm animate-fade-up">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
                      <Pill className="h-4 w-4 text-primary" />
                    </div>
                    Dosagem Atual
                  </CardTitle>
                  <Badge className="rounded-lg">Ativa</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ajuste em{' '}
                  {new Date(grupos[0].dataAjuste + 'T00:00:00').toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {grupos[0].itens.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl bg-muted/40 px-4 py-3"
                  >
                    <Badge variant="secondary" className="rounded-md font-semibold">
                      {item.tipoCanabinoide}
                    </Badge>
                    <span className="text-sm font-medium">{item.novaDosagem}</span>
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

                {grupos[0].proximaRevisao && (
                  <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    Próxima revisão:{' '}
                    {new Date(grupos[0].proximaRevisao + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Histórico de ajustes anteriores */}
          {grupos.length > 1 && (
            <div className="space-y-3">
              <h2 className="font-heading text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Histórico de dosagens
              </h2>
              {grupos.slice(1).map((grupo) => {
                const expandido = expandidos.has(grupo.ajusteId);
                return (
                  <Card key={grupo.ajusteId} className="border-border/40 opacity-80 shadow-sm">
                    <button
                      className="flex w-full items-center justify-between px-6 py-4 text-left"
                      onClick={() => toggleExpandido(grupo.ajusteId)}
                    >
                      <div className="flex items-center gap-3">
                        <FlaskConical className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-semibold">
                            {new Date(grupo.dataAjuste + 'T00:00:00').toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: 'long',
                              year: 'numeric',
                            })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {grupo.itens.length} medicamento{grupo.itens.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      {expandido
                        ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      }
                    </button>

                    {expandido && (
                      <CardContent className="space-y-2 pt-0">
                        {grupo.itens.map((item) => (
                          <div
                            key={item.id}
                            className="flex flex-wrap items-center gap-3 rounded-xl bg-muted/30 px-4 py-2.5"
                          >
                            <Badge variant="outline" className="rounded-md font-semibold">
                              {item.tipoCanabinoide}
                            </Badge>
                            <span className="text-sm">{item.novaDosagem}</span>
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
          )}

          {/* Botão de recompra */}
          <div className="pt-2">
            <Link href="/paciente/recompra">
              <Button variant="outline" className="gap-2 rounded-xl">
                Solicitar recompra
              </Button>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
