'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { listarTodasRecompras, atualizarStatusRecompra } from '@/app/_actions/recompras';
import {
  listarEmailsNotificacao,
  criarEmailNotificacao,
  toggleEmailNotificacao,
  excluirEmailNotificacao,
} from '@/app/_actions/emails-notificacao';
import { toast } from 'sonner';
import {
  Loader2,
  RefreshCw,
  Mail,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  MessageSquare,
  Package,
  Search,
  Filter,
  X,
  ChevronDown,
  CalendarRange,
  Users2,
  CheckCircle2,
  Clock,
  Send,
} from 'lucide-react';

/**
 * Página de administração de recompras — Admin.
 * Histórico de todos os pedidos + gerenciamento de e-mails do financeiro.
 * Inclui sistema completo de filtros: busca, status, solicitante, período.
 */

interface RecompraItem {
  id: string;
  medicamentoNome: string | null;
  mlFrasco: number | null;
  gotasPorDia: number | null;
  dataPrevista: string;
  status: string;
  contatoTelefone: string | null;
  contatoEmail: string | null;
  criadoEm: string;
  solicitanteNome: string;
  solicitanteRole: string | null;
  pacienteNome: string | null;
}

interface EmailItem {
  id: string;
  email: string;
  nome: string;
  categoria: string;
  ativo: boolean;
}

type StatusFiltro = 'todos' | 'pedida' | 'agendada' | 'entregue';
type RoleFiltro = 'todos' | 'paciente' | 'medico';

const STATUS_CONFIG: Record<string, { label: string; cor: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode; bg: string }> = {
  pedida:   { label: 'Pedido enviado', cor: 'default',   icon: <Send size={12} />,         bg: 'bg-primary/10 text-primary' },
  agendada: { label: 'Agendada',       cor: 'outline',   icon: <Clock size={12} />,        bg: 'bg-amber-500/10 text-amber-600' },
  entregue: { label: 'Entregue',       cor: 'secondary', icon: <CheckCircle2 size={12} />, bg: 'bg-emerald-500/10 text-emerald-600' },
};

const STATUS_FILTROS: { value: StatusFiltro; label: string }[] = [
  { value: 'todos',    label: 'Todos' },
  { value: 'pedida',   label: 'Pedido enviado' },
  { value: 'agendada', label: 'Agendada' },
  { value: 'entregue', label: 'Entregue' },
];

const ROLE_FILTROS: { value: RoleFiltro; label: string }[] = [
  { value: 'todos',    label: 'Todos' },
  { value: 'paciente', label: 'Paciente' },
  { value: 'medico',   label: 'Médico' },
];

export default function AdminRecomprasPage() {
  const [recompras, setRecompras] = useState<RecompraItem[]>([]);
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [carregandoEmails, setCarregandoEmails] = useState(true);
  const [atualizando, setAtualizando] = useState<string | null>(null);

  // ── Estados de filtro ────────────────────────────────────────
  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>('todos');
  const [roleFiltro, setRoleFiltro] = useState<RoleFiltro>('todos');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  // Form de novo email
  const [novoEmail, setNovoEmail] = useState('');
  const [novoNome, setNovoNome] = useState('');
  const [adicionandoEmail, setAdicionandoEmail] = useState(false);

  useEffect(() => {
    carregarRecompras();
    carregarEmails();
  }, []);

  async function carregarRecompras() {
    setCarregando(true);
    const res = await listarTodasRecompras();
    if (res.sucesso && res.dados) {
      setRecompras(res.dados);
    }
    setCarregando(false);
  }

  async function carregarEmails() {
    setCarregandoEmails(true);
    const res = await listarEmailsNotificacao();
    if (res.sucesso && res.dados) {
      setEmails(res.dados);
    }
    setCarregandoEmails(false);
  }

  async function handleMudarStatus(recompraId: string, novoStatus: 'agendada' | 'pedida' | 'entregue') {
    setAtualizando(recompraId);
    const res = await atualizarStatusRecompra(recompraId, novoStatus);
    setAtualizando(null);
    if (res.sucesso) {
      toast.success('Status atualizado');
      carregarRecompras();
    } else {
      toast.error(res.erro || 'Erro ao atualizar');
    }
  }

  async function handleAdicionarEmail() {
    if (!novoEmail || !novoNome) {
      toast.error('Preencha nome e e-mail');
      return;
    }
    setAdicionandoEmail(true);
    const res = await criarEmailNotificacao({ email: novoEmail, nome: novoNome, categoria: 'financeiro' });
    setAdicionandoEmail(false);
    if (res.sucesso) {
      toast.success('E-mail adicionado');
      setNovoEmail('');
      setNovoNome('');
      carregarEmails();
    } else {
      toast.error(res.erro || 'Erro ao adicionar');
    }
  }

  async function handleToggleEmail(id: string) {
    const res = await toggleEmailNotificacao(id);
    if (res.sucesso) {
      carregarEmails();
    } else {
      toast.error(res.erro || 'Erro ao alternar');
    }
  }

  async function handleExcluirEmail(id: string) {
    const res = await excluirEmailNotificacao(id);
    if (res.sucesso) {
      toast.success('E-mail removido');
      carregarEmails();
    } else {
      toast.error(res.erro || 'Erro ao remover');
    }
  }

  function limparFiltros() {
    setBusca('');
    setStatusFiltro('todos');
    setRoleFiltro('todos');
    setDataInicio('');
    setDataFim('');
  }

  // ── Lógica de filtros aplicada em memória ────────────────────
  const recomprasFiltradas = useMemo(() => {
    return recompras.filter((r) => {
      // Busca por texto
      if (busca.trim()) {
        const termo = busca.toLowerCase();
        const matches =
          (r.medicamentoNome ?? '').toLowerCase().includes(termo) ||
          r.solicitanteNome.toLowerCase().includes(termo) ||
          (r.pacienteNome ?? '').toLowerCase().includes(termo) ||
          (r.contatoEmail ?? '').toLowerCase().includes(termo) ||
          (r.contatoTelefone ?? '').includes(termo);
        if (!matches) return false;
      }

      // Filtro por status
      if (statusFiltro !== 'todos' && r.status !== statusFiltro) return false;

      // Filtro por role do solicitante
      if (roleFiltro !== 'todos' && r.solicitanteRole !== roleFiltro) return false;

      // Filtro por data início
      if (dataInicio) {
        const criadoEm = new Date(r.criadoEm);
        const inicio = new Date(dataInicio + 'T00:00:00');
        if (criadoEm < inicio) return false;
      }

      // Filtro por data fim
      if (dataFim) {
        const criadoEm = new Date(r.criadoEm);
        const fim = new Date(dataFim + 'T23:59:59');
        if (criadoEm > fim) return false;
      }

      return true;
    });
  }, [recompras, busca, statusFiltro, roleFiltro, dataInicio, dataFim]);

  // Contagem de filtros ativos
  const filtrosAtivos = [
    busca.trim() !== '',
    statusFiltro !== 'todos',
    roleFiltro !== 'todos',
    dataInicio !== '',
    dataFim !== '',
  ].filter(Boolean).length;

  // Contadores por status (sobre os dados originais)
  const contadores = useMemo(() => ({
    todos:    recompras.length,
    pedida:   recompras.filter(r => r.status === 'pedida').length,
    agendada: recompras.filter(r => r.status === 'agendada').length,
    entregue: recompras.filter(r => r.status === 'entregue').length,
  }), [recompras]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Recompras</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie pedidos de recompra e e-mails de notificação
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={carregarRecompras} className="gap-2">
          <RefreshCw size={14} />
          Atualizar
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* ── Pedidos de Recompra ──────────────────────────────── */}
        <div className="xl:col-span-2 space-y-4">

          {/* Filtros rápidos por status (pills) */}
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTROS.map((s) => (
              <button
                key={s.value}
                onClick={() => setStatusFiltro(s.value)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                  statusFiltro === s.value
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground'
                }`}
              >
                {s.label}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  statusFiltro === s.value ? 'bg-white/20' : 'bg-muted'
                }`}>
                  {contadores[s.value]}
                </span>
              </button>
            ))}
          </div>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Package size={16} />
                  Pedidos ({recomprasFiltradas.length}
                  {recomprasFiltradas.length !== recompras.length && (
                    <span className="text-xs font-normal text-muted-foreground">
                      de {recompras.length}
                    </span>
                  )})
                </CardTitle>

                {/* Botão abrir/fechar filtros avançados */}
                <button
                  onClick={() => setFiltrosAbertos((v) => !v)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all hover:bg-accent ${
                    filtrosAtivos > 0
                      ? 'border-primary/50 bg-primary/5 text-primary'
                      : 'border-border text-muted-foreground'
                  }`}
                >
                  <Filter size={13} />
                  Filtros
                  {filtrosAtivos > 0 && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                      {filtrosAtivos}
                    </span>
                  )}
                  <ChevronDown
                    size={13}
                    className={`transition-transform ${filtrosAbertos ? 'rotate-180' : ''}`}
                  />
                </button>
              </div>

              {/* Painel de filtros avançados */}
              {filtrosAbertos && (
                <div className="mt-3 space-y-3 rounded-xl border bg-muted/30 p-4">
                  {/* Busca */}
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por medicamento, paciente, e-mail, telefone..."
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      className="h-9 pl-9 text-sm"
                    />
                    {busca && (
                      <button
                        onClick={() => setBusca('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {/* Filtro por solicitante */}
                    <div className="space-y-1.5">
                      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Users2 size={12} />
                        Tipo de solicitante
                      </p>
                      <div className="flex gap-1.5">
                        {ROLE_FILTROS.map((r) => (
                          <button
                            key={r.value}
                            onClick={() => setRoleFiltro(r.value)}
                            className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-all ${
                              roleFiltro === r.value
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border text-muted-foreground hover:border-primary/30 hover:text-foreground'
                            }`}
                          >
                            {r.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Filtro por período */}
                    <div className="space-y-1.5">
                      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <CalendarRange size={12} />
                        Período do pedido
                      </p>
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="date"
                          value={dataInicio}
                          onChange={(e) => setDataInicio(e.target.value)}
                          className="h-8 flex-1 text-xs"
                        />
                        <span className="text-xs text-muted-foreground">até</span>
                        <Input
                          type="date"
                          value={dataFim}
                          onChange={(e) => setDataFim(e.target.value)}
                          className="h-8 flex-1 text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Limpar filtros */}
                  {filtrosAtivos > 0 && (
                    <div className="flex justify-end pt-1">
                      <button
                        onClick={limparFiltros}
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        <X size={12} />
                        Limpar todos os filtros
                      </button>
                    </div>
                  )}
                </div>
              )}
            </CardHeader>

            <CardContent>
              {carregando ? (
                <div className="flex justify-center py-8">
                  <Loader2 size={24} className="animate-spin text-primary" />
                </div>
              ) : recomprasFiltradas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Package size={32} className="mb-3 text-muted-foreground/30" />
                  <p className="text-sm font-medium text-muted-foreground">
                    {filtrosAtivos > 0 ? 'Nenhum pedido para esses filtros.' : 'Nenhum pedido de recompra.'}
                  </p>
                  {filtrosAtivos > 0 && (
                    <button
                      onClick={limparFiltros}
                      className="mt-2 text-xs text-primary underline-offset-2 hover:underline"
                    >
                      Limpar filtros
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {recomprasFiltradas.map((r) => {
                    const st = STATUS_CONFIG[r.status] ?? { label: r.status, cor: 'outline' as const, icon: null, bg: 'bg-muted text-muted-foreground' };
                    const roleLabel = r.solicitanteRole === 'medico' ? '👨‍⚕️ Médico' : '👤 Paciente';
                    return (
                      <div key={r.id} className="group rounded-xl border border-border/50 p-4 transition-all hover:border-primary/20 hover:shadow-sm">
                        <div className="mb-3 flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <p className="truncate text-sm font-semibold">{r.medicamentoNome ?? 'Medicamento'}</p>
                            <p className="text-xs text-muted-foreground">
                              {r.mlFrasco}ml • {r.gotasPorDia} gotas/dia
                            </p>
                          </div>
                          <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${st.bg}`}>
                            {st.icon}
                            {st.label}
                          </span>
                        </div>

                        <div className="mb-3 grid gap-2 text-xs sm:grid-cols-2">
                          <div>
                            <span className="text-muted-foreground">Solicitante: </span>
                            <span className="font-medium">{r.solicitanteNome} ({roleLabel})</span>
                          </div>
                          {r.pacienteNome && (
                            <div>
                              <span className="text-muted-foreground">Paciente: </span>
                              <span className="font-medium">{r.pacienteNome}</span>
                            </div>
                          )}
                          <div>
                            <span className="text-muted-foreground">Término previsto: </span>
                            <span className="font-semibold text-primary">
                              {new Date(r.dataPrevista).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Pedido em: </span>
                            <span>{new Date(r.criadoEm).toLocaleDateString('pt-BR')}</span>
                          </div>
                        </div>

                        {/* Contato */}
                        <div className="mb-3 flex flex-wrap gap-2">
                          {r.contatoTelefone && (
                            <a
                              href={`https://wa.me/55${r.contatoTelefone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-200"
                            >
                              <MessageSquare size={12} />
                              WhatsApp: {r.contatoTelefone}
                            </a>
                          )}
                          {r.contatoEmail && (
                            <a
                              href={`mailto:${r.contatoEmail}`}
                              className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200"
                            >
                              <Mail size={12} />
                              {r.contatoEmail}
                            </a>
                          )}
                        </div>

                        {/* Ações de status */}
                        <div className="flex gap-2">
                          {r.status !== 'entregue' && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={atualizando === r.id}
                              onClick={() => handleMudarStatus(r.id, 'entregue')}
                              className="gap-1.5 text-xs"
                            >
                              {atualizando === r.id && <Loader2 size={12} className="animate-spin" />}
                              ✅ Marcar como entregue
                            </Button>
                          )}
                          {r.status === 'pedida' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={atualizando === r.id}
                              onClick={() => handleMudarStatus(r.id, 'agendada')}
                              className="gap-1.5 text-xs"
                            >
                              Agendar
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Gerenciamento de E-mails ─────────────────────────── */}
        <div>
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail size={16} />
                E-mails do Financeiro
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                E-mails que receberão notificações de novos pedidos de recompra.
              </p>

              {/* Formulário de novo email */}
              <div className="space-y-2 rounded-xl border p-3">
                <div className="space-y-2">
                  <Input
                    placeholder="Nome do contato"
                    value={novoNome}
                    onChange={(e) => setNovoNome(e.target.value)}
                    className="h-9 text-sm"
                  />
                  <Input
                    type="email"
                    placeholder="email@empresa.com"
                    value={novoEmail}
                    onChange={(e) => setNovoEmail(e.target.value)}
                    className="h-9 text-sm"
                    onKeyDown={(e) => e.key === 'Enter' && handleAdicionarEmail()}
                  />
                </div>
                <Button
                  size="sm"
                  onClick={handleAdicionarEmail}
                  disabled={adicionandoEmail}
                  className="w-full gap-1.5"
                >
                  {adicionandoEmail ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Plus size={14} />
                  )}
                  Adicionar
                </Button>
              </div>

              {/* Lista */}
              {carregandoEmails ? (
                <div className="flex justify-center py-4">
                  <Loader2 size={16} className="animate-spin text-muted-foreground" />
                </div>
              ) : emails.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  Nenhum e-mail cadastrado.
                </p>
              ) : (
                <div className="space-y-2">
                  {emails.map((em) => (
                    <div
                      key={em.id}
                      className={`flex items-center justify-between rounded-lg border p-3 transition-all ${
                        !em.ativo ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{em.nome}</p>
                        <p className="truncate text-xs text-muted-foreground">{em.email}</p>
                      </div>
                      <div className="ml-2 flex shrink-0 gap-1">
                        <button
                          onClick={() => handleToggleEmail(em.id)}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                          title={em.ativo ? 'Desativar' : 'Ativar'}
                        >
                          {em.ativo ? (
                            <ToggleRight size={16} className="text-green-600" />
                          ) : (
                            <ToggleLeft size={16} />
                          )}
                        </button>
                        <button
                          onClick={() => handleExcluirEmail(em.id)}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          title="Excluir"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
