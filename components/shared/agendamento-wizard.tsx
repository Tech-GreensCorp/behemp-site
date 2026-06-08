'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import {
  listarMedicosDisponiveis,
  listarHorariosLivres,
  agendarConsulta,
} from '@/app/(public)/_actions/agendamento';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Stethoscope,
  UserCheck,
  Video,
} from 'lucide-react';

/**
 * Wizard multi-step para agendamento de consultas.
 *
 * Steps:
 * 1. Seleção de médico
 * 2. Seleção de data e horário
 * 3. Confirmação (login required)
 * 4. Sucesso
 */

interface Medico {
  id: string;
  nome: string;
  especialidade: string;
  bio: string | null;
  avatarUrl: string | null;
  valorConsulta: number | null;
  googleConectado: boolean;
}

function formatarValor(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const STEPS = [
  { label: 'Médico', icon: Stethoscope },
  { label: 'Data/Hora', icon: CalendarDays },
  { label: 'Confirmação', icon: CheckCircle2 },
];

const INFO_CARDS = [
  {
    icon: Video,
    titulo: '100% Online',
    descricao: 'Consulta por videoconferência via Google Meet',
  },
  {
    icon: Clock,
    titulo: 'Duração: ~60 min',
    descricao: 'Avaliação completa e orientação personalizada',
  },
  {
    icon: UserCheck,
    titulo: 'Confirmação Imediata',
    descricao: 'Receba o link do Meet por e-mail na hora',
  },
];

export function AgendamentoWizard() {
  const { isSignedIn } = useAuth();
  const [step, setStep] = useState(0);
  const [medicos, setMedicos] = useState<Medico[]>([]);
  const [medicoSelecionado, setMedicoSelecionado] = useState<Medico | null>(null);
  const [dataSelecionada, setDataSelecionada] = useState<Date | undefined>();
  const [horariosLivres, setHorariosLivres] = useState<string[]>([]);
  const [horarioSelecionado, setHorarioSelecionado] = useState<string | null>(null);
  const [observacoes, setObservacoes] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [carregandoHorarios, setCarregandoHorarios] = useState(false);
  const [agendando, setAgendando] = useState(false);
  const [resultado, setResultado] = useState<{ meetLink: string; consultaId: string } | null>(null);

  // Carregar médicos
  useEffect(() => {
    if (!isSignedIn) return; // Não carrega se não logado
    async function load() {
      setCarregando(true);
      const res = await listarMedicosDisponiveis();
      if (res.sucesso && res.dados) {
        setMedicos(res.dados);
      }
      setCarregando(false);
    }
    load();
  }, [isSignedIn]);

  // Carregar horários ao selecionar data
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

  async function handleConfirmar() {
    if (!medicoSelecionado || !dataSelecionada || !horarioSelecionado) return;

    setAgendando(true);

    const [hora, minuto] = horarioSelecionado.split(':');
    const dataHora = new Date(dataSelecionada);
    dataHora.setHours(parseInt(hora), parseInt(minuto), 0, 0);

    // Para agendamento público, usamos um pacienteId placeholder
    // Em produção, será o pacienteId do usuário autenticado
    const res = await agendarConsulta({
      medicoId: medicoSelecionado.id,
      pacienteId: 'auto', // A action deveria resolver pelo user autenticado
      dataHora: dataHora.toISOString(),
      observacoes: observacoes || undefined,
    });

    if (res.sucesso && res.dados) {
      setResultado(res.dados);
      setStep(3); // Sucesso
      toast.success('Consulta agendada com sucesso!');
    } else {
      toast.error(res.erro ?? 'Erro ao agendar consulta');
    }

    setAgendando(false);
  }

  // ── Gate: exigir login ──────────────────────────────────────
  if (!isSignedIn) {
    return (
      <Card className="border-0 shadow-xl">
        <CardContent className="flex flex-col items-center py-16 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#C08E3A]/10">
            <CalendarDays size={40} className="text-[#C08E3A]" />
          </div>
          <h2 className="text-2xl font-bold">Pronto para agendar?</h2>
          <p className="mt-3 max-w-md text-muted-foreground">
            Crie sua conta ou faça login para confirmar o agendamento e garantir seu horário com um dos nossos especialistas.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href="/sign-in?redirect_url=/agendamento">
              <Button className="gap-2 bg-[#C08E3A] px-8 hover:bg-[#a8762f]">
                Entrar para agendar
              </Button>
            </Link>
            <Link href="/sign-up?redirect_url=/agendamento">
              <Button variant="outline" className="gap-2 px-8">
                Criar conta grátis
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Cadastro rápido · Atendimento humanizado
          </p>
        </CardContent>
      </Card>
    );
  }

  // ── Info Cards ──────────────────────────────────────────────
  if (step === 0 && medicos.length === 0 && !carregando) {
    return (
      <div className="space-y-8">
        <div className="grid gap-4 md:grid-cols-3">
          {INFO_CARDS.map((card) => {
            const CardIcon = card.icon;
            return (
            <Card key={card.titulo} className="border-0 bg-card shadow-sm">
              <CardContent className="p-6 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                  <CardIcon size={24} className="text-foreground" />
                </div>
                <h3 className="font-display text-sm font-semibold">{card.titulo}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{card.descricao}</p>
              </CardContent>
            </Card>
          ); })}
        </div>

        <Card className="border-0 shadow-xl">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <p className="text-lg font-medium">Nenhum médico disponível no momento</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Entre em contato conosco para mais informações
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Info Cards no topo */}
      {step === 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          {INFO_CARDS.map((card) => {
            const CardIcon = card.icon;
            return (
            <Card key={card.titulo} className="border-0 bg-card shadow-sm">
              <CardContent className="p-6 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                  <CardIcon size={24} className="text-foreground" />
                </div>
                <h3 className="font-display text-sm font-semibold">{card.titulo}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{card.descricao}</p>
              </CardContent>
            </Card>
          ); })}
        </div>
      )}

      {/* Step indicator */}
      {step < 3 && (
        <div className="flex items-center justify-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s.label} className="flex items-center gap-2">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                  i <= step
                    ? 'bg-[#C08E3A] text-white'
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
                <div className={`mx-2 h-px w-8 ${i < step ? 'bg-[#C08E3A]' : 'bg-border'}`} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Step 0 — Seleção de Médico */}
      {step === 0 && (
        <Card className="border-0 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Stethoscope size={20} className="text-[#C08E3A]" />
              Escolha seu médico
            </CardTitle>
          </CardHeader>
          <CardContent>
            {carregando ? (
              <div className="flex justify-center py-12">
                <Loader2 size={32} className="animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-4">
                {medicos.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleSelecionarMedico(m)}
                    className="group flex w-full items-stretch gap-6 rounded-2xl border border-border/50 p-6 text-left transition-all hover:border-[#C08E3A]/50 hover:shadow-md"
                  >
                    {/* Foto */}
                    <div className="shrink-0">
                      {m.avatarUrl ? (
                        <img
                          src={m.avatarUrl}
                          alt={m.nome}
                          className="h-40 w-40 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="flex h-40 w-40 items-center justify-center rounded-xl bg-primary/10">
                          <Stethoscope size={48} className="text-primary/60" />
                        </div>
                      )}
                    </div>

                    {/* Informações */}
                    <div className="flex min-w-0 flex-1 flex-col">
                      <h3 className="text-xl font-bold leading-tight">{m.nome}</h3>
                      <p className="mt-1 text-sm font-semibold text-[#C08E3A]">{m.especialidade}</p>

                      {m.bio && (
                        <p className="mt-3 text-sm leading-relaxed text-justify text-muted-foreground line-clamp-6">
                          {m.bio}
                        </p>
                      )}

                      <div className="mt-auto pt-3 space-y-1">
                        {m.valorConsulta !== null && (
                          <p className="text-sm">
                            <strong>Valor:</strong> {formatarValor(m.valorConsulta)}
                          </p>
                        )}
                        <p className="text-sm font-semibold text-emerald-600">
                          Médico parceiro da associação
                        </p>
                        {m.googleConectado && (
                          <Badge className="mt-2 gap-1 bg-emerald-500/10 text-emerald-600 text-xs">
                            <Video size={10} />
                            Google Meet
                          </Badge>
                        )}
                      </div>
                    </div>

                    <ChevronRight size={18} className="shrink-0 self-center text-muted-foreground transition-transform group-hover:translate-x-1" />
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 1 — Data e Horário */}
      {step === 1 && medicoSelecionado && (
        <Card className="border-0 shadow-xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CalendarDays size={20} className="text-[#C08E3A]" />
                Escolha data e horário
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setStep(0)} className="gap-1">
                <ChevronLeft size={14} />
                Trocar médico
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Consulta com <strong>{medicoSelecionado.nome}</strong>, {medicoSelecionado.especialidade}
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-8 md:grid-cols-2">
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
              </div>

              {/* Horários */}
              <div>
                {!dataSelecionada ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Clock size={32} className="mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Selecione uma data para ver os horários disponíveis
                    </p>
                  </div>
                ) : carregandoHorarios ? (
                  <div className="flex justify-center py-12">
                    <Loader2 size={24} className="animate-spin text-primary" />
                  </div>
                ) : horariosLivres.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <p className="text-sm text-muted-foreground">
                      Nenhum horário disponível nesta data
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="mb-3 text-sm font-medium">
                      {format(dataSelecionada, "dd 'de' MMMM", { locale: ptBR })}
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {horariosLivres.map((h) => (
                        <button
                          key={h}
                          onClick={() => setHorarioSelecionado(h)}
                          className={`rounded-xl border px-4 py-3 text-sm font-medium transition-all ${
                            horarioSelecionado === h
                              ? 'border-[#C08E3A] bg-[#C08E3A] text-white'
                              : 'border-border hover:border-[#C08E3A]/50'
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
                          className="min-h-[80px]"
                        />
                        <Button
                          onClick={() => setStep(2)}
                          className="mt-4 w-full gap-2 bg-[#C08E3A] hover:bg-[#a8762f]"
                        >
                          Continuar
                          <ChevronRight size={14} />
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2 — Confirmação */}
      {step === 2 && medicoSelecionado && dataSelecionada && horarioSelecionado && (
        <Card className="border-0 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CheckCircle2 size={20} className="text-[#C08E3A]" />
              Confirme sua consulta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Resumo */}
            <div className="rounded-xl border border-border/50 p-6 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Médico</span>
                <span className="font-medium">{medicoSelecionado.nome}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Especialidade</span>
                <span className="font-medium">{medicoSelecionado.especialidade}</span>
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
              {observacoes && (
                <div className="border-t pt-3">
                  <span className="text-sm text-muted-foreground">Observações</span>
                  <p className="mt-1 text-sm">{observacoes}</p>
                </div>
              )}
            </div>

            {/* Ação */}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="gap-1">
                <ChevronLeft size={14} />
                Voltar
              </Button>
              <Button
                onClick={handleConfirmar}
                disabled={agendando}
                className="flex-1 gap-2 bg-[#C08E3A] hover:bg-[#a8762f]"
              >
                {agendando ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={16} />
                )}
                {agendando ? 'Agendando...' : 'Confirmar Agendamento'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3 — Sucesso */}
      {step === 3 && resultado && (
        <Card className="border-0 shadow-xl">
          <CardContent className="flex flex-col items-center py-16 text-center">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle2 size={40} className="text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold">Consulta agendada!</h2>
            <p className="mt-3 max-w-md text-muted-foreground">
              Sua consulta foi agendada com sucesso. Você receberá um e-mail de confirmação
              com os detalhes e o link do Google Meet.
            </p>
            {resultado.meetLink && (
              <a
                href={resultado.meetLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6"
              >
                <Button className="gap-2 bg-[#C08E3A] hover:bg-[#a8762f]">
                  <Video size={16} />
                  Acessar Google Meet
                </Button>
              </a>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
