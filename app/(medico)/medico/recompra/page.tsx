'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { solicitarRecompraManual, listarMinhasRecompras, listarPacientesParaRecompra } from '@/app/_actions/recompras';
import { toast } from 'sonner';
import {
  Calendar,
  Loader2,
  Pill,
  CheckCircle2,
  Clock,
  Droplets,
  FlaskConical,
  Phone,
  Mail,
  History,
  Send,
  Search,
  Users,
} from 'lucide-react';

/**
 * Página de recompra de medicamento — Médico.
 * Formulário manual + seleção de paciente + cálculo em tempo real + histórico.
 */

interface PacienteItem {
  pacienteId: string;
  nome: string;
  email: string;
}

interface RecompraHistorico {
  id: string;
  medicamentoNome: string | null;
  mlFrasco: number | null;
  gotasPorDia: number | null;
  dataInicioUso: string | null;
  dataPrevista: string;
  status: string;
  contatoTelefone: string | null;
  contatoEmail: string | null;
  criadoEm: string;
  solicitanteNome: string;
}

const STATUS_LABELS: Record<string, { label: string; cor: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  agendada: { label: 'Agendada', cor: 'outline' },
  pedida: { label: 'Pedido enviado', cor: 'default' },
  entregue: { label: 'Entregue', cor: 'secondary' },
};

export default function RecompraMedicoPage() {
  // Formulário
  const [pacienteSelecionado, setPacienteSelecionado] = useState<PacienteItem | null>(null);
  const [buscaPaciente, setBuscaPaciente] = useState('');
  const [pacientes, setPacientes] = useState<PacienteItem[]>([]);
  const [carregandoPacientes, setCarregandoPacientes] = useState(true);

  const [medicamentoNome, setMedicamentoNome] = useState('');
  const [mlFrasco, setMlFrasco] = useState('');
  const [gotasPorDia, setGotasPorDia] = useState('');
  const [dataInicioUso, setDataInicioUso] = useState('');
  const [contatoTelefone, setContatoTelefone] = useState('');
  const [contatoEmail, setContatoEmail] = useState('');
  const [observacoes, setObservacoes] = useState('');

  // UI
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState<{ dataTermino: string; diasDuracao: number } | null>(null);
  const [historico, setHistorico] = useState<RecompraHistorico[]>([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(true);

  // Cálculo em tempo real
  const calculo = useMemo(() => {
    const ml = Number(mlFrasco);
    const gotas = Number(gotasPorDia);
    if (!ml || !gotas || !dataInicioUso) return null;

    const GOTAS_POR_ML = 20;
    const gotasTotais = ml * GOTAS_POR_ML;
    const diasDuracao = Math.floor(gotasTotais / gotas);
    const inicio = new Date(dataInicioUso);
    const termino = new Date(inicio);
    termino.setDate(termino.getDate() + diasDuracao);

    const hoje = new Date();
    const diasRestantes = Math.ceil((termino.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

    return { gotasTotais, diasDuracao, dataTermino: termino, diasRestantes };
  }, [mlFrasco, gotasPorDia, dataInicioUso]);

  // Filtro de busca de paciente
  const pacientesFiltrados = useMemo(() => {
    if (!buscaPaciente.trim()) return pacientes;
    const termo = buscaPaciente.toLowerCase();
    return pacientes.filter(
      (p) => p.nome.toLowerCase().includes(termo) || p.email.toLowerCase().includes(termo),
    );
  }, [pacientes, buscaPaciente]);

  useEffect(() => {
    carregarPacientes();
    carregarHistorico();
  }, []);

  async function carregarPacientes() {
    setCarregandoPacientes(true);
    const res = await listarPacientesParaRecompra();
    if (res.sucesso && res.dados) {
      setPacientes(res.dados);
    }
    setCarregandoPacientes(false);
  }

  async function carregarHistorico() {
    setCarregandoHistorico(true);
    const res = await listarMinhasRecompras();
    if (res.sucesso && res.dados) {
      setHistorico(res.dados);
    }
    setCarregandoHistorico(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pacienteSelecionado) {
      toast.error('Selecione um paciente');
      return;
    }
    if (!medicamentoNome || !mlFrasco || !gotasPorDia || !dataInicioUso) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setEnviando(true);
    const resultado = await solicitarRecompraManual({
      medicamentoNome,
      mlFrasco: Number(mlFrasco),
      gotasPorDia: Number(gotasPorDia),
      dataInicioUso,
      contatoTelefone: contatoTelefone || undefined,
      contatoEmail: contatoEmail || pacienteSelecionado.email || undefined,
      observacoes: observacoes || undefined,
      pacienteId: pacienteSelecionado.pacienteId,
    });
    setEnviando(false);

    if (resultado.sucesso && resultado.dados) {
      setSucesso({
        dataTermino: resultado.dados.dataTermino,
        diasDuracao: resultado.dados.diasDuracao,
      });
      toast.success('Pedido de recompra enviado com sucesso!');
      carregarHistorico();
    } else {
      toast.error(resultado.erro || 'Erro ao enviar pedido');
    }
  }

  function handleNovoPedido() {
    setSucesso(null);
    setPacienteSelecionado(null);
    setBuscaPaciente('');
    setMedicamentoNome('');
    setMlFrasco('');
    setGotasPorDia('');
    setDataInicioUso('');
    setContatoTelefone('');
    setContatoEmail('');
    setObservacoes('');
  }

  // ── Estado de Sucesso ──────────────────────────────────────
  if (sucesso) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Recompra de Medicamento</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Solicite a recompra para seus pacientes
          </p>
        </div>

        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 size={40} className="text-emerald-600" />
            </div>
            <h2 className="mb-2 text-xl font-bold text-emerald-700">
              Pedido Encaminhado!
            </h2>
            <p className="mb-1 text-center text-sm text-muted-foreground">
              A solicitação de recompra foi enviada para a equipe.
            </p>
            <p className="mb-6 text-center text-sm text-muted-foreground">
              O paciente e a equipe serão notificados sobre o andamento.
            </p>

            <div className="mb-6 flex items-center gap-3 rounded-xl bg-primary/5 px-6 py-4">
              <Calendar size={20} className="text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Previsão de término do medicamento</p>
                <p className="text-lg font-bold text-primary">
                  {new Date(sucesso.dataTermino).toLocaleDateString('pt-BR')}
                </p>
                <p className="text-xs text-muted-foreground">
                  ({sucesso.diasDuracao} dias de duração)
                </p>
              </div>
            </div>

            <Button onClick={handleNovoPedido} variant="outline" className="gap-2">
              <Send size={16} />
              Novo pedido
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Recompra de Medicamento</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Solicite a recompra de medicamento para seus pacientes
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Formulário */}
        <Card className="border-0 shadow-sm lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Dados do Pedido</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Seleção de Paciente */}
              <div className="space-y-2">
                <Label>Paciente *</Label>
                {pacienteSelecionado ? (
                  <div className="flex items-center justify-between rounded-xl border bg-primary/5 p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                        <Users size={16} className="text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{pacienteSelecionado.nome}</p>
                        <p className="text-xs text-muted-foreground">{pacienteSelecionado.email}</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setPacienteSelecionado(null)}
                    >
                      Trocar
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Buscar paciente por nome ou e-mail..."
                        value={buscaPaciente}
                        onChange={(e) => setBuscaPaciente(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-2">
                      {carregandoPacientes ? (
                        <div className="flex justify-center py-4">
                          <Loader2 size={16} className="animate-spin text-muted-foreground" />
                        </div>
                      ) : pacientesFiltrados.length === 0 ? (
                        <p className="py-4 text-center text-xs text-muted-foreground">
                          Nenhum paciente encontrado
                        </p>
                      ) : (
                        pacientesFiltrados.map((p) => (
                          <button
                            key={p.pacienteId}
                            type="button"
                            onClick={() => {
                              setPacienteSelecionado(p);
                              setContatoEmail(p.email);
                            }}
                            className="flex w-full items-center gap-3 rounded-lg p-2.5 text-left hover:bg-accent"
                          >
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                              <Users size={14} />
                            </div>
                            <div>
                              <p className="text-sm font-medium">{p.nome}</p>
                              <p className="text-xs text-muted-foreground">{p.email}</p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Medicamento */}
              <div className="space-y-2">
                <Label htmlFor="medicamento">Nome do Medicamento *</Label>
                <div className="relative">
                  <Pill size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="medicamento"
                    placeholder="Ex: Canabidiol 200mg/ml"
                    value={medicamentoNome}
                    onChange={(e) => setMedicamentoNome(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              {/* ML + Gotas */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ml">Quantidade do Frasco (ml) *</Label>
                  <div className="relative">
                    <FlaskConical size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="ml"
                      type="number"
                      min={1}
                      placeholder="Ex: 30"
                      value={mlFrasco}
                      onChange={(e) => setMlFrasco(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gotas">Gotas por Dia *</Label>
                  <div className="relative">
                    <Droplets size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="gotas"
                      type="number"
                      min={1}
                      placeholder="Ex: 10"
                      value={gotasPorDia}
                      onChange={(e) => setGotasPorDia(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Data início */}
              <div className="space-y-2">
                <Label htmlFor="dataInicio">Data do Primeiro Uso *</Label>
                <div className="relative">
                  <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="dataInicio"
                    type="date"
                    value={dataInicioUso}
                    onChange={(e) => setDataInicioUso(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              {/* Contato */}
              <div className="border-t pt-4">
                <p className="mb-3 text-sm font-medium">Dados de Contato do Paciente</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone / WhatsApp</Label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="telefone"
                      type="tel"
                      placeholder="(11) 99999-9999"
                      value={contatoTelefone}
                      onChange={(e) => setContatoTelefone(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emailContato">E-mail</Label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="emailContato"
                      type="email"
                      placeholder="paciente@email.com"
                      value={contatoEmail}
                      onChange={(e) => setContatoEmail(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              {/* Observações */}
              <div className="space-y-2">
                <Label htmlFor="obs">Observações (opcional)</Label>
                <Textarea
                  id="obs"
                  placeholder="Alguma informação adicional..."
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Botão */}
              <Button type="submit" disabled={enviando || !pacienteSelecionado} className="w-full gap-2">
                {enviando ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
                Solicitar Recompra
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Preview */}
        <div className="space-y-4 lg:col-span-2">
          <Card className="sticky top-6 border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock size={16} className="text-primary" />
                Previsão
              </CardTitle>
            </CardHeader>
            <CardContent>
              {calculo ? (
                <div className="space-y-4">
                  <div className="rounded-xl bg-primary/5 p-4 text-center">
                    <p className="text-xs text-muted-foreground">O medicamento vai durar</p>
                    <p className="text-3xl font-bold text-primary">{calculo.diasDuracao} dias</p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Gotas totais no frasco</span>
                      <span className="font-medium">{calculo.gotasTotais}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Data de término</span>
                      <span className="font-semibold text-primary">
                        {calculo.dataTermino.toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Dias restantes</span>
                      <Badge variant={calculo.diasRestantes <= 7 ? 'destructive' : calculo.diasRestantes <= 14 ? 'secondary' : 'outline'}>
                        {calculo.diasRestantes <= 0 ? 'Terminado' : `${calculo.diasRestantes} dias`}
                      </Badge>
                    </div>
                  </div>

                  <div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full transition-all ${
                          calculo.diasRestantes <= 7 ? 'bg-destructive' : calculo.diasRestantes <= 14 ? 'bg-amber-500' : 'bg-primary'
                        }`}
                        style={{
                          width: `${Math.max(0, Math.min(100, ((calculo.diasDuracao - calculo.diasRestantes) / calculo.diasDuracao) * 100))}%`,
                        }}
                      />
                    </div>
                    <p className="mt-1 text-right text-[10px] text-muted-foreground">
                      Progresso do uso
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <FlaskConical size={32} className="mb-3 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">
                    Preencha os campos para visualizar a previsão de término.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Histórico */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History size={16} />
            Histórico de Pedidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {carregandoHistorico ? (
            <div className="flex justify-center py-8">
              <Loader2 size={24} className="animate-spin text-primary" />
            </div>
          ) : historico.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <History size={32} className="mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Nenhum pedido realizado ainda.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {historico.map((item) => {
                const st = STATUS_LABELS[item.status] ?? { label: item.status, cor: 'outline' as const };
                return (
                  <div key={item.id} className="flex items-center justify-between rounded-xl border p-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{item.medicamentoNome ?? 'Medicamento'}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.mlFrasco}ml • {item.gotasPorDia} gotas/dia • Término: {new Date(item.dataPrevista).toLocaleDateString('pt-BR')}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Solicitado em {new Date(item.criadoEm).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <Badge variant={st.cor}>{st.label}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
