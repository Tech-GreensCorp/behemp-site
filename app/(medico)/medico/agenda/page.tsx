'use client';

import { useState, useEffect, useCallback } from 'react';
import { BuscaPaciente } from '@/components/busca-paciente';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  listarConsultasMedico, listarPacientesMedico,
  criarConsultaMedico, remarcarConsulta, cancelarConsultaMedico,
  listarTodosHorariosMedico, obterConfigAgendaMedicoLogado,
} from '@/app/(medico)/_actions/consultas';
import { FormConfigAgenda, ConfigAgendaDia } from '@/components/medicos/form-config-agenda';
import { iniciarTeleconsulta } from '@/app/(medico)/_actions/notificar-teleconsulta';
import { useRouter } from 'next/navigation';

import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CalendarDays as CalendarIcon,
  CheckCircle2,
  Loader2,
  Lock,
  Plus,
  User,
  Video,
  X,
} from 'lucide-react';

interface Consulta {
  id: string; dataHora: Date; status: string;
  observacoes: string | null; googleMeetLink: string | null;
  pacienteNome: string; pacienteEmail: string; pacienteId: string;
}
interface Paciente { id: string; nome: string; email: string; }

const STATUS_CONFIG: Record<string, { label: string; cor: string }> = {
  agendada: { label: 'Agendada', cor: 'bg-blue-500/10 text-blue-600' },
  confirmada: { label: 'Confirmada', cor: 'bg-emerald-500/10 text-emerald-600' },
  realizada: { label: 'Realizada', cor: 'bg-gray-500/10 text-gray-600' },
  cancelada: { label: 'Cancelada', cor: 'bg-red-500/10 text-red-600' },
};

export default function AgendaPage() {
  const router = useRouter();
  const [consultas, setConsultas] = useState<Consulta[]>([]);
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [carregando, setCarregando] = useState(true);
  
  const [medicoId, setMedicoId] = useState<string | null>(null);
  const [configAgenda, setConfigAgenda] = useState<ConfigAgendaDia[] | null>(null);

  // Nova consulta
  const [pacienteSel, setPacienteSel] = useState<string>('');
  const [dataSel, setDataSel] = useState<Date | undefined>();
  const [horarios, setHorarios] = useState<{ horario: string; livre: boolean }[]>([]);
  const [horarioSel, setHorarioSel] = useState<string>('');
  const [tipo, setTipo] = useState('rotina');
  const [obs, setObs] = useState('');
  const [criando, setCriando] = useState(false);
  const [carregandoH, setCarregandoH] = useState(false);

  // Remarcar
  const [remarcarId, setRemarcarId] = useState<string | null>(null);
  const [remarcarData, setRemarcarData] = useState<Date | undefined>();
  const [remarcarHorarios, setRemarcarHorarios] = useState<{ horario: string; livre: boolean }[]>([]);
  const [remarcarHorSel, setRemarcarHorSel] = useState('');
  const [remarcando, setRemarcando] = useState(false);
  const [carregandoRH, setCarregandoRH] = useState(false);

  // Cancelar
  const [cancelarId, setCancelarId] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [cancelando, setCancelando] = useState(false);

  // Teleconsulta
  const [iniciando, setIniciando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const [cRes, pRes, confRes] = await Promise.all([
      listarConsultasMedico(), 
      listarPacientesMedico(),
      obterConfigAgendaMedicoLogado()
    ]);
    if (cRes.sucesso && cRes.dados) setConsultas(cRes.dados as Consulta[]);
    if (pRes.sucesso && pRes.dados) setPacientes(pRes.dados);
    if (confRes.sucesso && confRes.dados) {
      setMedicoId(confRes.dados.medicoId);
      setConfigAgenda(confRes.dados.configAgenda);
    }
    setCarregando(false);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { carregar(); }, [carregar]);

  // ── Nova consulta: carregar horários (24h) ──
  async function carregarHorNova(data: Date) {
    setDataSel(data); setCarregandoH(true); setHorarioSel('');
    const res = await listarTodosHorariosMedico({ data: format(data, 'yyyy-MM-dd') });
    if (res.sucesso && res.dados) setHorarios(res.dados);
    setCarregandoH(false);
  }

  async function handleCriar() {
    if (!pacienteSel || !dataSel || !horarioSel) return;
    setCriando(true);
    const [h, m] = horarioSel.split(':');
    const dt = new Date(dataSel); dt.setHours(+h, +m, 0, 0);
    const res = await criarConsultaMedico({
      pacienteId: pacienteSel, dataHora: dt.toISOString(), tipo, observacoes: obs || undefined,
    });
    if (res.sucesso) {
      toast.success('Consulta agendada com sucesso!');
      setPacienteSel(''); setDataSel(undefined); setHorarioSel(''); setObs('');
      carregar();
    } else toast.error(res.erro ?? 'Erro ao agendar');
    setCriando(false);
  }

  // ── Remarcar ──
  async function carregarHorRemarcar(data: Date) {
    setRemarcarData(data); setCarregandoRH(true); setRemarcarHorSel('');
    const res = await listarTodosHorariosMedico({ data: format(data, 'yyyy-MM-dd') });
    if (res.sucesso && res.dados) setRemarcarHorarios(res.dados);
    setCarregandoRH(false);
  }

  async function handleRemarcar() {
    if (!remarcarId || !remarcarData || !remarcarHorSel) return;
    setRemarcando(true);
    const [h, m] = remarcarHorSel.split(':');
    const dt = new Date(remarcarData); dt.setHours(+h, +m, 0, 0);
    const res = await remarcarConsulta({ consultaId: remarcarId, novaDataHora: dt.toISOString() });
    if (res.sucesso) {
      toast.success('Consulta remarcada!');
      setRemarcarId(null); setRemarcarData(undefined); setRemarcarHorSel('');
      carregar();
    } else toast.error(res.erro ?? 'Erro ao remarcar');
    setRemarcando(false);
  }

  // ── Cancelar ──
  async function handleCancelar() {
    if (!cancelarId || !motivo.trim()) return;
    setCancelando(true);
    const res = await cancelarConsultaMedico({ consultaId: cancelarId, motivo });
    if (res.sucesso) {
      toast.success('Consulta cancelada.');
      setCancelarId(null); setMotivo('');
      carregar();
    } else toast.error(res.erro ?? 'Erro ao cancelar');
    setCancelando(false);
  }

  const handleIniciarTeleconsulta = async (consultaId: string) => {
    setIniciando(consultaId);
    try {
      const res = await iniciarTeleconsulta(consultaId);
      if (res.sucesso && res.dados) {
        toast.success('Teleconsulta iniciada! Redirecionando...');
        router.push(`/medico/teleconsulta?roomId=${res.dados.roomId}&salaId=${res.dados.salaId}`);
      } else {
        toast.error(res.erro ?? 'Erro ao iniciar teleconsulta');
      }
    } catch {
      toast.error('Erro de conexão. Tente novamente.');
    } finally {
      setIniciando(null);
    }
  };

  const consultasAtivas = consultas.filter(c => c.status !== 'cancelada' && c.status !== 'realizada');
  const consultasPassadas = consultas.filter(c => c.status === 'cancelada' || c.status === 'realizada');

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Operação</p>
        <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight">
          Agenda de <span className="text-accent-italic">Consultas</span>
        </h1>
      </div>

      <Tabs defaultValue="consultas">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="consultas">Consultas</TabsTrigger>
          <TabsTrigger value="nova">Nova Consulta</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="configuracoes">Configurações</TabsTrigger>
        </TabsList>

        {/* ── TAB: CONSULTAS ATIVAS ── */}
        <TabsContent value="consultas" className="space-y-4 mt-4">
          {carregando ? (
            <div className="flex justify-center py-12">
              <Loader2 size={32} className="animate-spin text-primary" />
            </div>
          ) : consultasAtivas.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="flex flex-col items-center py-16">
                <CalendarIcon size={40} className="mb-3 text-muted-foreground/40" />
                <p className="text-lg font-medium">Nenhuma consulta agendada</p>
                <p className="mt-1 text-sm text-muted-foreground">Crie uma nova consulta na aba ao lado</p>
              </CardContent>
            </Card>
          ) : (
            consultasAtivas.map((c) => {
              const cfg = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.agendada;
              return (
                <Card key={c.id} className="border-0 shadow-sm">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <User size={20} className="text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{c.pacienteNome}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(c.dataHora), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <Badge className={cfg.cor}>{cfg.label}</Badge>
                    <div className="flex gap-1">
                      {(c.status === 'agendada' || c.status === 'confirmada') && (
                        <Button
                          size="sm"
                          onClick={() => handleIniciarTeleconsulta(c.id)}
                          disabled={iniciando === c.id}
                          className="gap-1.5 bg-primary hover:bg-primary/90 text-white"
                        >
                          {iniciando === c.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Video size={14} />
                          )}
                          {iniciando === c.id ? 'Iniciando...' : 'Iniciar Teleconsulta'}
                        </Button>
                      )}
                      {c.googleMeetLink && (
                        <a href={c.googleMeetLink} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="icon" title="Google Meet">
                            <Video size={16} />
                          </Button>
                        </a>
                      )}
                      <Button variant="ghost" size="icon" title="Remarcar"
                        onClick={() => { setRemarcarId(c.id); setRemarcarData(undefined); setRemarcarHorSel(''); }}>
                        <CalendarIcon size={16} />
                      </Button>
                      <Button variant="ghost" size="icon" title="Cancelar"
                        onClick={() => { setCancelarId(c.id); setMotivo(''); }}>
                        <X size={16} className="text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* ── TAB: NOVA CONSULTA ── */}
        <TabsContent value="nova" className="mt-4 space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg">
              <Plus size={20} className="text-primary" /> Nova Consulta
            </CardTitle></CardHeader>
            <CardContent className="space-y-6">
              {/* Paciente */}
              <div>
                <label className="text-sm font-medium mb-2 block">Paciente</label>
                <BuscaPaciente
                  pacientes={pacientes}
                  value={pacienteSel}
                  onChange={setPacienteSel}
                />
              </div>
              {/* Tipo */}
              <div>
                <label className="text-sm font-medium mb-2 block">Tipo de consulta</label>
                <div className="flex gap-2">
                  {[['rotina', 'Rotina'], ['retorno', 'Retorno'], ['urgencia', 'Urgência']].map(([v, l]) => (
                    <Button key={v} variant={tipo === v ? 'default' : 'outline'} size="sm"
                      onClick={() => setTipo(v)}>{l}</Button>
                  ))}
                </div>
              </div>
              {/* Data + Horários — layout lado a lado */}
              {pacienteSel && (
                <div className="grid gap-6 lg:grid-cols-[auto_1fr] items-start">

                  {/* ── Calendário (maior) ── */}
                  <div className="min-w-0">
                    <label className="text-sm font-medium mb-3 block">Data</label>
                    <Calendar
                      mode="single"
                      selected={dataSel}
                      onSelect={(d) => d && carregarHorNova(d)}
                      locale={ptBR}
                      disabled={(d) => { const h = new Date(); h.setHours(0,0,0,0); return d < h || d.getDay() === 0; }}
                      className="rounded-xl border [&_table]:w-full [&_td]:p-1.5 [&_th]:p-1.5 [&_button]:h-10 [&_button]:w-10 [&_button]:text-sm"
                    />
                  </div>

                  {/* ── Horários (coluna direita, scroll interno) ── */}
                  <div className="min-w-0">
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-medium">
                        Horários — 24h
                        {dataSel && (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            {dataSel.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                          </span>
                        )}
                      </label>
                      {dataSel && !carregandoH && horarios.length > 0 && (
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-primary/15 border border-primary/30" />
                            Livre
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-muted border border-border" />
                            Ocupado
                          </span>
                        </div>
                      )}
                    </div>

                    {!dataSel ? (
                      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
                        <CalendarIcon size={32} className="mb-2 text-muted-foreground/30" />
                        <p className="text-sm text-muted-foreground">Selecione uma data no calendário</p>
                      </div>
                    ) : carregandoH ? (
                      <div className="flex justify-center py-16">
                        <Loader2 size={28} className="animate-spin text-primary" />
                      </div>
                    ) : horarios.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-8 text-center">Sem horários disponíveis</p>
                    ) : (() => {
                      const PERIODOS = [
                        { id: 'madrugada', label: 'Madrugada', range: [0, 12] as [number, number] },
                        { id: 'manha',     label: 'Manhã',     range: [12, 24] as [number, number] },
                        { id: 'tarde',     label: 'Tarde',     range: [24, 36] as [number, number] },
                        { id: 'noite',     label: 'Noite',     range: [36, 48] as [number, number] },
                      ];
                      return (
                        <div className="rounded-xl border bg-background overflow-hidden">
                          {/* Abas de período */}
                          <div className="grid grid-cols-4 border-b">
                            {PERIODOS.map(({ id, label, range }) => {
                              const livresNoPeriodo = horarios.slice(range[0], range[1]).filter(s => s.livre).length;
                              const temSelecionado  = horarios.slice(range[0], range[1]).some(s => s.horario === horarioSel);
                              return (
                                <a
                                  key={id}
                                  href={`#periodo-${id}`}
                                  className={[
                                    'flex flex-col items-center gap-0.5 px-2 py-2.5 text-center text-xs font-medium transition-colors border-r last:border-r-0',
                                    temSelecionado
                                      ? 'bg-primary/10 text-primary'
                                      : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                                  ].join(' ')}
                                >
                                  <span className="font-semibold">{label}</span>
                                  <span className={[
                                    'text-[10px] tabular-nums',
                                    temSelecionado ? 'text-primary/70' : 'text-muted-foreground/70',
                                  ].join(' ')}>
                                    {livresNoPeriodo} livre{livresNoPeriodo !== 1 ? 's' : ''}
                                  </span>
                                </a>
                              );
                            })}
                          </div>

                          {/* Grid de slots por período */}
                          <div className="max-h-[380px] overflow-y-auto">
                            {PERIODOS.map(({ id, label, range }) => {
                              const slots = horarios.slice(range[0], range[1]);
                              return (
                                <div key={id} id={`periodo-${id}`} className="p-4 border-b last:border-b-0">
                                  {/* Separador de período */}
                                  <div className="flex items-center gap-3 mb-3">
                                    <div className="h-px flex-1 bg-border" />
                                    <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground px-2 py-0.5 rounded-full border bg-muted/40">
                                      {label}
                                    </span>
                                    <div className="h-px flex-1 bg-border" />
                                  </div>

                                  {/* Slots */}
                                  <div className="grid grid-cols-4 gap-2">
                                    {slots.map(({ horario, livre }) => {
                                      const selecionado = horarioSel === horario;
                                      return (
                                        <button
                                          key={horario}
                                          disabled={!livre}
                                          onClick={() => livre && setHorarioSel(horario)}
                                          title={livre ? `Agendar às ${horario}` : `${horario} — ocupado`}
                                          className={[
                                            'relative flex items-center justify-center rounded-lg border py-3 text-xs font-semibold tabular-nums transition-all duration-150',
                                            selecionado
                                              ? 'border-primary bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/20'
                                              : livre
                                                ? 'border-border bg-background text-foreground hover:border-primary/50 hover:bg-primary/5 hover:text-primary cursor-pointer'
                                                : 'border-border/50 bg-muted/30 text-muted-foreground/50 cursor-not-allowed line-through',
                                          ].join(' ')}
                                        >
                                          {!livre && !selecionado && (
                                            <Lock size={7} className="absolute top-1 right-1 opacity-40" />
                                          )}
                                          {horario}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
              {/* Observações + Confirmar */}
              {horarioSel && (
                <>
                  <Textarea value={obs} onChange={(e) => setObs(e.target.value)}
                    placeholder="Observações (opcional)" className="min-h-[80px]" />
                  <Button onClick={handleCriar} disabled={criando}
                    className="w-full gap-2">
                    {criando ? <Loader2 size={16} className="animate-spin" />
                      : <CheckCircle2 size={16} />}
                    {criando ? 'Agendando...' : 'Confirmar Agendamento'}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB: HISTÓRICO ── */}
        <TabsContent value="historico" className="mt-4 space-y-3">
          {consultasPassadas.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="flex flex-col items-center py-12">
                <p className="text-sm text-muted-foreground">Nenhuma consulta no histórico</p>
              </CardContent>
            </Card>
          ) : consultasPassadas.map((c) => {
            const cfg = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.realizada;
            return (
              <Card key={c.id} className="border-0 shadow-sm opacity-70">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                    <User size={18} className="text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{c.pacienteNome}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(c.dataHora), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <Badge className={cfg.cor}>{cfg.label}</Badge>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* ── TAB: CONFIGURAÇÕES ── */}
        <TabsContent value="configuracoes" className="mt-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              {medicoId ? (
                <FormConfigAgenda medicoId={medicoId} configAtual={configAgenda} />
              ) : (
                <div className="flex justify-center py-12">
                  <Loader2 size={32} className="animate-spin text-primary" />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── DIALOG: REMARCAR ── */}
      <Dialog open={!!remarcarId} onOpenChange={(open) => !open && setRemarcarId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Remarcar Consulta</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Calendar mode="single" selected={remarcarData} onSelect={(d) => d && carregarHorRemarcar(d)}
              locale={ptBR} disabled={(d) => { const h = new Date(); h.setHours(0,0,0,0); return d < h || d.getDay() === 0; }}
              className="rounded-xl border mx-auto" />
            {remarcarData && (
              carregandoRH ? (
                <div className="flex justify-center py-4">
                  <Loader2 size={20} className="animate-spin text-primary" />
                </div>
              ) : remarcarHorarios.length === 0 ? (
                <p className="text-sm text-center text-muted-foreground">Sem horários</p>
              ) : (
                <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                  {[
                    { label: 'Madrugada', range: [0, 12] },
                    { label: 'Manhã', range: [12, 24] },
                    { label: 'Tarde', range: [24, 36] },
                    { label: 'Noite', range: [36, 48] },
                  ].map(({ label, range }) => {
                    const slots = remarcarHorarios.slice(range[0], range[1]);
                    return (
                      <div key={label}>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{label}</p>
                        <div className="grid grid-cols-4 gap-1">
                          {slots.map(({ horario, livre }) => (
                            <button key={horario} disabled={!livre}
                              onClick={() => livre && setRemarcarHorSel(horario)}
                              title={livre ? `Remarcar às ${horario}` : `${horario} — ocupado`}
                              className={[
                                'relative rounded-lg border px-1 py-2.5 text-xs font-semibold tabular-nums transition-all',
                                remarcarHorSel === horario
                                  ? 'border-primary bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/20'
                                  : livre
                                    ? 'border-border bg-background text-foreground hover:border-primary/50 hover:bg-primary/5 hover:text-primary cursor-pointer'
                                    : 'border-border/50 bg-muted/30 text-muted-foreground/50 cursor-not-allowed line-through',
                              ].join(' ')}
                            >
                              {horario}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}
            <Button onClick={handleRemarcar} disabled={!remarcarHorSel || remarcando}
              className="w-full gap-2">
              {remarcando ? 'Remarcando...' : 'Confirmar Remarcação'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG: CANCELAR ── */}
      <Dialog open={!!cancelarId} onOpenChange={(open) => !open && setCancelarId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cancelar Consulta</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)}
              placeholder="Motivo do cancelamento (obrigatório)" className="min-h-[100px]" />
            <Button onClick={handleCancelar} disabled={!motivo.trim() || cancelando}
              variant="destructive" className="w-full">
              {cancelando ? 'Cancelando...' : 'Confirmar Cancelamento'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
