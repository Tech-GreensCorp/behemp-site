'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  listarConsultasMedico, listarPacientesMedico,
  criarConsultaMedico, remarcarConsulta, cancelarConsultaMedico,
} from '@/app/(medico)/_actions/consultas';
import { listarHorariosLivres } from '@/app/(public)/_actions/agendamento';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CalendarDays as CalendarIcon,
  CheckCircle2,
  ChevronRight,
  Clock,
  Loader2,
  Plus,
  Search,
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
  const [consultas, setConsultas] = useState<Consulta[]>([]);
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Nova consulta
  const [pacienteSel, setPacienteSel] = useState<string>('');
  const [dataSel, setDataSel] = useState<Date | undefined>();
  const [horarios, setHorarios] = useState<string[]>([]);
  const [horarioSel, setHorarioSel] = useState<string>('');
  const [tipo, setTipo] = useState('rotina');
  const [obs, setObs] = useState('');
  const [criando, setCriando] = useState(false);
  const [carregandoH, setCarregandoH] = useState(false);

  // Remarcar
  const [remarcarId, setRemarcarId] = useState<string | null>(null);
  const [remarcarData, setRemarcarData] = useState<Date | undefined>();
  const [remarcarHorarios, setRemarcarHorarios] = useState<string[]>([]);
  const [remarcarHorSel, setRemarcarHorSel] = useState('');
  const [remarcando, setRemarcando] = useState(false);
  const [carregandoRH, setCarregandoRH] = useState(false);

  // Cancelar
  const [cancelarId, setCancelarId] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [cancelando, setCancelando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const [cRes, pRes] = await Promise.all([listarConsultasMedico(), listarPacientesMedico()]);
    if (cRes.sucesso && cRes.dados) setConsultas(cRes.dados as Consulta[]);
    if (pRes.sucesso && pRes.dados) setPacientes(pRes.dados);
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // ── Nova consulta: carregar horários ──
  async function carregarHorNova(data: Date) {
    setDataSel(data); setCarregandoH(true); setHorarioSel('');
    // Usa o medicoId implícito via auth na action
    const res = await listarHorariosLivres({ medicoId: 'self', data: format(data, 'yyyy-MM-dd') });
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
    const res = await listarHorariosLivres({ medicoId: 'self', data: format(data, 'yyyy-MM-dd') });
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="consultas">Consultas</TabsTrigger>
          <TabsTrigger value="nova">Nova Consulta</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
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
              <Plus size={20} className="text-[#C08E3A]" /> Nova Consulta
            </CardTitle></CardHeader>
            <CardContent className="space-y-6">
              {/* Paciente */}
              <div>
                <label className="text-sm font-medium mb-2 block">Paciente</label>
                <select value={pacienteSel} onChange={(e) => setPacienteSel(e.target.value)}
                  className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm">
                  <option value="">Selecionar paciente...</option>
                  {pacientes.map((p) => <option key={p.id} value={p.id}>{p.nome} — {p.email}</option>)}
                </select>
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
              {/* Data + Horários */}
              {pacienteSel && (
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Data</label>
                    <Calendar mode="single" selected={dataSel} onSelect={(d) => d && carregarHorNova(d)}
                      locale={ptBR} disabled={(d) => { const h = new Date(); h.setHours(0,0,0,0); return d < h || d.getDay() === 0; }}
                      className="rounded-xl border" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Horário</label>
                    {!dataSel ? (
                      <p className="text-sm text-muted-foreground py-8 text-center">Selecione uma data</p>
                    ) : carregandoH ? (
                      <div className="flex justify-center py-8">
                        <Loader2 size={24} className="animate-spin text-primary" />
                      </div>
                    ) : horarios.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-8 text-center">Sem horários disponíveis</p>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {horarios.map((h) => (
                          <button key={h} onClick={() => setHorarioSel(h)}
                            className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${
                              horarioSel === h ? 'border-[#C08E3A] bg-[#C08E3A] text-white' : 'border-border hover:border-[#C08E3A]/50'
                            }`}>{h}</button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {/* Observações + Confirmar */}
              {horarioSel && (
                <>
                  <Textarea value={obs} onChange={(e) => setObs(e.target.value)}
                    placeholder="Observações (opcional)" className="min-h-[80px]" />
                  <Button onClick={handleCriar} disabled={criando}
                    className="w-full gap-2 bg-[#C08E3A] hover:bg-[#a8762f]">
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
                <div className="grid grid-cols-4 gap-2">
                  {remarcarHorarios.map((h) => (
                    <button key={h} onClick={() => setRemarcarHorSel(h)}
                      className={`rounded-lg border px-3 py-2 text-sm ${
                        remarcarHorSel === h ? 'border-[#C08E3A] bg-[#C08E3A] text-white' : 'hover:border-[#C08E3A]/50'
                      }`}>{h}</button>
                  ))}
                </div>
              )
            )}
            <Button onClick={handleRemarcar} disabled={!remarcarHorSel || remarcando}
              className="w-full gap-2 bg-[#C08E3A] hover:bg-[#a8762f]">
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
