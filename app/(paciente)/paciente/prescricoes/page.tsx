'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  FileText, Pill, Calendar, CheckCircle2, XCircle, Clock,
  AlertCircle, Download, Loader2, Bell, ShieldCheck, ChevronDown, ChevronUp,
} from 'lucide-react';
import { listarMinhasPrescricoes, type PrescricaoPaciente } from '@/app/(paciente)/_actions/prescricoes';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function PrescricoesPage() {
  const [prescricoes, setPrescricoes] = useState<PrescricaoPaciente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  const carregar = useCallback(async () => {
    setCarregando(true);
    const res = await listarMinhasPrescricoes();
    if (res.sucesso && res.dados) {
      setPrescricoes(res.dados);
      // Expandir a mais recente por padrão
      if (res.dados.length > 0) {
        setExpandidos(new Set([res.dados[0].id]));
      }
    }
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const toggleExpandido = (id: string) => {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDownload = (p: PrescricaoPaciente) => {
    // Prioridade: PDF assinado > PDF gerado > gerar via API
    const url = p.urlPdfAssinado ?? p.urlPdf;
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      // Gerar PDF via API de receituário
      window.open(`/api/receituario/pdf?prescricaoId=${p.id}`, '_blank', 'noopener,noreferrer');
    }
  };

  // Prescrição criada nas últimas 2 horas = recente
  const prescricaoRecente = prescricoes.find((p) => {
    const diff = Date.now() - new Date(p.createdAt).getTime();
    return diff < 2 * 60 * 60 * 1000; // 2 horas
  });

  const totalAtivas = prescricoes.filter((p) => p.status === 'ativa').length;
  const totalExpiradas = prescricoes.filter((p) => p.status === 'expirada').length;

  return (
    <div className="space-y-6 sm:space-y-10">

      {/* ── Header Editorial ── */}
      <div className="animate-fade-up">
        <p className="text-primary mb-2 sm:mb-4 text-xs font-semibold tracking-[0.25em] uppercase">
          Área do Paciente
        </p>
        <h1 className="font-display text-3xl leading-[1.1] font-bold tracking-tight sm:text-5xl text-foreground">
          Minhas <span className="text-accent-italic">Prescrições</span>
        </h1>
        <p className="text-muted-foreground mt-2 sm:mt-4 max-w-2xl text-sm sm:text-base leading-relaxed">
          {prescricoes.length > 0
            ? `${prescricoes.length} prescrição(ões) registrada(s) — ${totalAtivas} ativa(s)`
            : 'Aqui aparecerão as prescrições emitidas pelo seu médico.'}
        </p>
      </div>

      {carregando ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* ── Toast nova prescrição ── */}
          {prescricaoRecente && (
            <div className="animate-fade-up rounded-2xl bg-green-50 border border-green-200 p-4 flex items-center gap-3">
              <Bell className="h-5 w-5 text-green-600 shrink-0" />
              <p className="text-sm font-semibold text-green-700">
                Nova prescrição disponível! Dr(a). {prescricaoRecente.medicoNome} emitiu uma nova receita.
              </p>
            </div>
          )}

          {/* ── Empty state ── */}
          {prescricoes.length === 0 ? (
            <Card className="border border-border/20 bg-white shadow-sm rounded-2xl sm:rounded-3xl grain overflow-hidden animate-fade-up">
              <CardContent className="flex flex-col items-center justify-center py-16 sm:py-24 text-center px-4">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                  <FileText className="h-8 w-8 text-primary/40" />
                </div>
                <h2 className="font-display text-xl font-bold text-foreground">
                  Nenhuma prescrição emitida
                </h2>
                <p className="mt-2 max-w-sm text-sm text-muted-foreground leading-relaxed">
                  Seu médico irá emitir sua prescrição após a consulta.
                  Ela ficará disponível aqui para download.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4 animate-fade-up delay-75">
              {prescricoes.map((p) => {
                const expandido = expandidos.has(p.id);
                const meds = p.medicamentos ?? [];
                const validadeFormatada = format(new Date(p.validade), "dd/MM/yyyy", { locale: ptBR });
                const emitidaFormatada = format(new Date(p.createdAt), "dd/MM/yyyy", { locale: ptBR });

                // Badge de validade
                const badgeValidade = {
                  valida: {
                    className: 'bg-green-100 text-green-700 border border-green-200',
                    icon: <CheckCircle2 className="h-3 w-3" />,
                    texto: `Válida até ${validadeFormatada}${p.diasRestantes ? ` (${p.diasRestantes} dias)` : ''}`,
                  },
                  expira_em_breve: {
                    className: 'bg-amber-100 text-amber-700 border border-amber-200',
                    icon: <AlertCircle className="h-3 w-3" />,
                    texto: `Expira em ${p.diasRestantes} dia(s) (${validadeFormatada})`,
                  },
                  expirada: {
                    className: 'bg-red-100 text-red-700 border border-red-200',
                    icon: <XCircle className="h-3 w-3" />,
                    texto: `Expirada em ${validadeFormatada}`,
                  },
                }[p.validadeStatus];

                const badgeStatus = p.status === 'cancelada'
                  ? { className: 'bg-muted text-muted-foreground', texto: '🚫 Cancelada' }
                  : p.status === 'ativa'
                    ? { className: 'bg-green-100 text-green-700', texto: '● Ativa' }
                    : { className: 'bg-red-100 text-red-700', texto: '● Expirada' };

                return (
                  <Card
                    key={p.id}
                    className={cn(
                      'border bg-white shadow-sm rounded-2xl sm:rounded-3xl overflow-hidden transition-all',
                      p.validadeStatus === 'expira_em_breve' && 'border-amber-300/50',
                      p.status === 'cancelada' && 'opacity-60',
                    )}
                  >
                    {/* Header do card */}
                    <button
                      className="flex w-full items-center justify-between p-4 sm:p-5 text-left cursor-pointer hover:bg-muted/20 transition-colors"
                      onClick={() => toggleExpandido(p.id)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                          p.status === 'ativa' ? 'bg-primary/10' : 'bg-muted/50',
                        )}>
                          <FileText className={cn(
                            'h-5 w-5',
                            p.status === 'ativa' ? 'text-primary' : 'text-muted-foreground',
                          )} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-foreground truncate">
                            {p.diagnostico ?? 'Prescrição Médica'}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {p.cid && (
                              <span className="text-[10px] font-mono text-muted-foreground">
                                CID: {p.cid}
                              </span>
                            )}
                            <span className="text-[10px] text-muted-foreground">
                              Dr(a). {p.medicoNome}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {emitidaFormatada}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <Badge className={cn('text-xs gap-1', badgeStatus.className)}>
                          {badgeStatus.texto}
                        </Badge>
                        {expandido
                          ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </button>

                    {/* Conteúdo expandido */}
                    {expandido && (
                      <CardContent className="pt-0 px-4 sm:px-5 pb-4 sm:pb-5 space-y-4">

                        {/* Medicamentos */}
                        {meds.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">
                              Medicamentos ({meds.length})
                            </p>
                            {meds.map((med, i) => {
                              const detalhes = [
                                med.dose,
                                med.posologia,
                                med.forma,
                                med.quantidade,
                              ].filter(Boolean).join(' · ');
                              return (
                                <div
                                  key={i}
                                  className="flex items-start gap-3 rounded-xl bg-muted/30 border border-border/10 px-3 py-2.5"
                                >
                                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 mt-0.5">
                                    <Pill className="h-3.5 w-3.5 text-primary" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-foreground">{med.nome}</p>
                                    {detalhes && (
                                      <p className="text-xs text-muted-foreground mt-0.5">{detalhes}</p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Orientações */}
                        {p.orientacoes && (
                          <div className="rounded-xl bg-blue-50 border border-blue-200 px-3 py-2.5">
                            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">
                              Orientações do médico
                            </p>
                            <p className="text-sm text-blue-800">{p.orientacoes}</p>
                          </div>
                        )}

                        {/* Validade + ICP */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                          <Badge className={cn('gap-1 text-xs py-1 px-2.5', badgeValidade.className)}>
                            {badgeValidade.icon}
                            {badgeValidade.texto}
                          </Badge>

                          {p.assinadaDigital && (
                            <Badge className="gap-1 text-xs bg-purple-100 text-purple-700 border border-purple-200">
                              <ShieldCheck className="h-3 w-3" />
                              Assinada digitalmente (ICP-Brasil)
                            </Badge>
                          )}
                        </div>

                        {/* Ações */}
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Button
                            size="sm"
                            onClick={() => handleDownload(p)}
                            className="gap-1.5 bg-primary hover:bg-primary/90 text-white rounded-xl"
                          >
                            <Download className="h-3.5 w-3.5" />
                            {p.urlPdfAssinado
                              ? 'Baixar PDF Assinado'
                              : p.urlPdf
                                ? 'Baixar PDF'
                                : 'Gerar PDF'}
                          </Button>

                          {/* CRM do médico */}
                          <span className="flex items-center gap-1 text-xs text-muted-foreground self-center">
                            <Calendar className="h-3 w-3" />
                            CRM {p.medicoCrm}
                            {p.medicoEspecialidade && ` | ${p.medicoEspecialidade}`}
                          </span>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
