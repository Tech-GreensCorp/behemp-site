'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import {
  listarMedicosDisponiveis,
  listarHorariosLivres,
  reservarConsulta,
  iniciarAguardoPagamento,
} from '@/app/(public)/_actions/agendamento';
import { AgendamentoPagamentoStep } from '@/components/shared/agendamento-pagamento-step';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Info,
  Loader2,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react';

/**
 * Wizard multi-step para agendamento de consultas — vive dentro da área logada
 * (`/paciente/agendamento`), já protegida pelo layout de `(paciente)`.
 *
 * Steps:
 * 0. Seleção de médico
 * 1. Seleção de data e horário — ao continuar, reserva o horário por um prazo curto
 *    (`reservarConsulta`); ninguém mais consegue reservar o mesmo horário enquanto
 *    a reserva estiver ativa
 * 2. Confirmação da reserva — dentro do prazo, avança para pagamento (`iniciarAguardoPagamento`).
 *    A consulta continua 'reservada' (aguardando pagamento) até uma confirmação real existir.
 * 3. Pagamento — layout de PIX/boleto/cartão, sem integração real de gateway ainda.
 */

interface Medico {
  id: string;
  nome: string;
  especialidade: string;
  bio: string | null;
  crm: string | null;
  avatarUrl: string | null;
  valorConsulta: number | null;
  googleConectado: boolean;
}

function formatarValor(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function iniciaisDoNome(nome: string): string {
  return nome
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase())
    .slice(0, 2)
    .join('');
}

const STEPS = [
  { label: 'Médico', icon: Stethoscope },
  { label: 'Data/Hora', icon: CalendarDays },
  { label: 'Confirmação', icon: CheckCircle2 },
  { label: 'Pagamento', icon: CreditCard },
];

export function AgendamentoWizard() {
  const [step, setStep] = useState(0);
  const [medicos, setMedicos] = useState<Medico[]>([]);
  const [medicoSelecionado, setMedicoSelecionado] = useState<Medico | null>(null);
  const [dataSelecionada, setDataSelecionada] = useState<Date | undefined>();
  const [horariosLivres, setHorariosLivres] = useState<string[]>([]);
  const [horarioSelecionado, setHorarioSelecionado] = useState<string | null>(null);
  const [observacoes, setObservacoes] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [carregandoHorarios, setCarregandoHorarios] = useState(false);
  const [reservando, setReservando] = useState(false);
  const [avancandoPagamento, setAvancandoPagamento] = useState(false);
  const [reserva, setReserva] = useState<{
    consultaId: string;
    expiraEm: string;
    valor: number | null;
    moeda: string;
  } | null>(null);

  useEffect(() => {
    async function carregarMedicos() {
      setCarregando(true);
      const res = await listarMedicosDisponiveis();
      if (res.sucesso && res.dados) {
        setMedicos(res.dados);
      }
      setCarregando(false);
    }
    carregarMedicos();
  }, []);

  const carregarHorarios = useCallback(async (data: Date) => {
    if (!medicoSelecionado) return;
    setCarregandoHorarios(true);
    setHorarioSelecionado(null);

    const res = await listarHorariosLivres({
      medicoId: medicoSelecionado.id,
      data: format(data, 'yyyy-MM-dd'),
    });

    if (res.sucesso && res.dados) {
      setHorariosLivres(res.dados);
    }
    setCarregandoHorarios(false);
  }, [medicoSelecionado]);

  function handleDataChange(data: Date | undefined) {
    setDataSelecionada(data);
    if (data) {
      carregarHorarios(data);
    }
  }

  function handleSelecionarMedico(medico: Medico) {
    setMedicoSelecionado(medico);
    setStep(1);
    setDataSelecionada(undefined);
    setHorarioSelecionado(null);
  }

  function horarioSelecionadoParaData(): Date | null {
    if (!dataSelecionada || !horarioSelecionado) return null;
    const [hora, minuto] = horarioSelecionado.split(':');
    const dataHora = new Date(dataSelecionada);
    dataHora.setHours(parseInt(hora), parseInt(minuto), 0, 0);
    return dataHora;
  }

  // Data/Hora → Confirmação: reserva o horário (trava com prazo). Se falhar, não
  // avança — outra pessoa pode ter acabado de reservar o mesmo horário, ou algo
  // real está quebrado (auth, banco).
  async function handleReservar() {
    if (!medicoSelecionado) return;
    const dataHora = horarioSelecionadoParaData();
    if (!dataHora) return;

    setReservando(true);
    const res = await reservarConsulta({
      medicoId: medicoSelecionado.id,
      dataHora: dataHora.toISOString(),
      observacoes: observacoes || undefined,
    });
    setReservando(false);

    if (res.sucesso && res.dados) {
      setReserva(res.dados);
      setStep(2); // Confirmação
    } else {
      toast.error(res.erro ?? 'Não foi possível reservar este horário. Tente novamente.');
    }
  }

  // Confirmação da reserva → Pagamento. NÃO confirma o agendamento de verdade (isso só
  // acontece quando existir pagamento real) — só avisa o paciente e avança a tela.
  async function handleContinuarParaPagamento() {
    if (!reserva) return;

    setAvancandoPagamento(true);
    const res = await iniciarAguardoPagamento({ consultaId: reserva.consultaId });
    setAvancandoPagamento(false);

    if (res.sucesso) {
      toast.success('Horário reservado! Finalize o pagamento para confirmar sua consulta.');
      setStep(3); // Pagamento
    } else {
      toast.error(res.erro ?? 'Erro ao avançar para o pagamento');
    }
  }

  const dataHoraReserva = horarioSelecionadoParaData();

  return (
    <div className="space-y-8">

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.label} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                i <= step
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {i + 1}
            </div>
            <span
              className={`hidden text-sm font-medium sm:block ${
                i <= step ? 'text-foreground' : 'text-muted-foreground'
              }`}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`mx-2 h-px w-8 ${i < step ? 'bg-primary' : 'bg-border'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step 0 — Seleção de Médico */}
      {step === 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Escolha seu médico</CardTitle>
            <p className="text-sm text-muted-foreground">
              Todos os profissionais são especializados em medicina endocanabinóide.
            </p>
          </CardHeader>
          <CardContent>
            {carregando ? (
              <div className="flex justify-center py-12">
                <Loader2 size={28} className="animate-spin text-primary" />
              </div>
            ) : medicos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-sm font-medium">Nenhum médico disponível no momento</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Entre em contato conosco para mais informações
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {medicos.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleSelecionarMedico(m)}
                    className="group flex flex-col gap-3 rounded-xl border border-border/60 p-5 text-left transition-colors hover:border-primary/40 hover:bg-primary/[0.03]"
                  >
                    <div className="flex items-center gap-4">
                      {m.avatarUrl ? (
                        <img
                          src={m.avatarUrl}
                          alt={m.nome}
                          className="h-14 w-14 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-semibold text-primary">
                          {iniciaisDoNome(m.nome)}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold leading-tight">{m.nome}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Badge variant="secondary" className="text-[11px] font-normal">
                            {m.especialidade}
                          </Badge>
                          {m.crm && (
                            <span className="text-[11px] text-muted-foreground">{m.crm}</span>
                          )}
                        </div>
                      </div>

                      <ChevronRight
                        size={16}
                        className="shrink-0 self-start text-muted-foreground transition-colors group-hover:text-primary"
                      />
                    </div>

                    {m.bio && (
                      <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {m.bio}
                      </p>
                    )}

                    {m.valorConsulta !== null && (
                      <p className="text-sm font-semibold text-primary">
                        R$ {formatarValor(m.valorConsulta)} <span className="font-normal text-muted-foreground">/ consulta</span>
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 1 — Data e Horário */}
      {step === 1 && medicoSelecionado && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Escolha data e horário</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setStep(0)} className="gap-1 text-xs">
                <ChevronLeft size={14} />
                Trocar médico
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-8 md:grid-cols-[220px_1fr]">
              {/* Resumo do médico selecionado */}
              <div className="flex md:flex-col items-center gap-3 rounded-xl border border-border/60 p-4 md:items-start">
                {medicoSelecionado.avatarUrl ? (
                  <img
                    src={medicoSelecionado.avatarUrl}
                    alt={medicoSelecionado.nome}
                    className="h-14 w-14 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-semibold text-primary">
                    {iniciaisDoNome(medicoSelecionado.nome)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-semibold leading-tight">{medicoSelecionado.nome}</p>
                  <p className="text-xs text-muted-foreground">{medicoSelecionado.especialidade}</p>
                  {medicoSelecionado.valorConsulta !== null && (
                    <p className="mt-1 text-sm font-semibold text-primary">
                      R$ {formatarValor(medicoSelecionado.valorConsulta)}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid gap-8 sm:grid-cols-2">
                {/* Calendário */}
                <div>
                  <Calendar
                    mode="single"
                    selected={dataSelecionada}
                    onSelect={handleDataChange}
                    locale={ptBR}
                    disabled={(date) => {
                      const hoje = new Date();
                      hoje.setHours(0, 0, 0, 0);
                      return date < hoje || date.getDay() === 0 || date.getDay() === 6;
                    }}
                    className="rounded-xl border"
                  />
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Info size={12} />
                    Horários exibidos no fuso de Brasília
                  </p>
                </div>

                {/* Horários */}
                <div>
                  {!dataSelecionada ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Clock size={28} className="mb-2 text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">
                        Selecione uma data para ver os horários disponíveis
                      </p>
                    </div>
                  ) : carregandoHorarios ? (
                    <div className="flex justify-center py-12">
                      <Loader2 size={22} className="animate-spin text-primary" />
                    </div>
                  ) : horariosLivres.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <CalendarDays size={28} className="mb-2 text-muted-foreground/40" />
                      <p className="text-sm font-medium">Nenhum horário disponível nesta data</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Tente escolher outro dia no calendário
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="mb-3 text-sm font-medium">
                        {format(dataSelecionada, "dd 'de' MMMM", { locale: ptBR })}
                        <span className="ml-1.5 font-normal text-muted-foreground">
                          — {horariosLivres.length} horário{horariosLivres.length !== 1 ? 's' : ''} disponível
                          {horariosLivres.length !== 1 ? 'is' : ''}
                        </span>
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {horariosLivres.map((h) => (
                          <button
                            key={h}
                            onClick={() => setHorarioSelecionado(h)}
                            className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                              horarioSelecionado === h
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-border hover:border-primary/40'
                            }`}
                          >
                            {h}
                          </button>
                        ))}
                      </div>

                      {horarioSelecionado && (
                        <div className="mt-6">
                          <Textarea
                            value={observacoes}
                            onChange={(e) => setObservacoes(e.target.value)}
                            placeholder="Observações para o médico (opcional)"
                            className="min-h-[72px]"
                          />
                          <Button
                            onClick={handleReservar}
                            disabled={reservando}
                            className="mt-4 w-full gap-2"
                          >
                            {reservando ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <ChevronRight size={14} />
                            )}
                            Continuar
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2 — Confirmação da reserva (dentro do prazo) */}
      {step === 2 && medicoSelecionado && dataSelecionada && horarioSelecionado && reserva && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Confirme sua reserva</CardTitle>
            <p className="text-sm text-muted-foreground">
              Revise os dados abaixo antes de continuar para o pagamento.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-xl border border-border/60 p-5 space-y-3">
              <div className="flex items-center gap-3 border-b border-border/60 pb-3">
                {medicoSelecionado.avatarUrl ? (
                  <img
                    src={medicoSelecionado.avatarUrl}
                    alt={medicoSelecionado.nome}
                    className="h-11 w-11 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {iniciaisDoNome(medicoSelecionado.nome)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{medicoSelecionado.nome}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {medicoSelecionado.especialidade}
                  </p>
                </div>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Data</span>
                <span className="font-medium">
                  {format(dataSelecionada, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Horário</span>
                <span className="font-medium">{horarioSelecionado}</span>
              </div>
              {reserva.valor !== null && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Valor</span>
                  <span className="font-medium">
                    {reserva.moeda} {formatarValor(reserva.valor)}
                  </span>
                </div>
              )}
              {observacoes && (
                <div className="border-t border-border/60 pt-2.5">
                  <span className="text-sm text-muted-foreground">Observações</span>
                  <p className="mt-1 text-sm">{observacoes}</p>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
              <p className="flex items-center gap-1.5 text-sm font-medium text-amber-800 dark:text-amber-400">
                <Clock size={14} />
                Horário reservado até{' '}
                {new Date(reserva.expiraEm).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
              <p className="mt-1 text-xs text-amber-700/80 dark:text-amber-400/70">
                Ninguém mais pode reservar este horário enquanto o prazo não expira. Se o prazo
                passar sem pagamento, o horário é liberado automaticamente.
              </p>
            </div>

            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldCheck size={14} className="mt-0.5 shrink-0" />
              <p>
                Cancelamentos podem ser feitos a qualquer momento antes da consulta pela área de
                agendamento. O pagamento só é confirmado após a conclusão da etapa seguinte.
              </p>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="gap-1">
                <ChevronLeft size={14} />
                Voltar
              </Button>
              <Button
                onClick={handleContinuarParaPagamento}
                disabled={avancandoPagamento}
                className="flex-1 gap-2"
              >
                {avancandoPagamento && <Loader2 size={16} className="animate-spin" />}
                {avancandoPagamento ? 'Avançando...' : 'Continuar para pagamento'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3 — Pagamento (layout, sem integração real de gateway) */}
      {step === 3 && reserva && medicoSelecionado && dataHoraReserva && (
        <AgendamentoPagamentoStep
          medicoNome={medicoSelecionado.nome}
          dataHora={dataHoraReserva}
          valor={reserva.valor}
          moeda={reserva.moeda}
          expiraEm={reserva.expiraEm}
        />
      )}
    </div>
  );
}
