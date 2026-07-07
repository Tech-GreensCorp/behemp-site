'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  ArrowDownAZ,
  ChevronLeft,
  ChevronRight,
  Loader2,
  UserPlus,
  UserCheck,
  Stethoscope,
  AlertCircle,
  Search,
  Users,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  listarPacientesComMedicoPaginado,
  listarMedicosDisponiveis,
  atribuirMedicoAoPaciente,
  reatribuirTodosPacientes,
} from '@/app/_actions/admin-atribuicao';
import { toast } from 'sonner';

interface Paciente {
  pacienteId: string;
  nome: string;
  email: string;
  telefone: string | null;
  status: string;
  medicoNome: string | null;
  medicoId: string | null;
  criadoEm: string;
}

interface Medico {
  medicoId: string;
  nome: string;
  email: string;
}

type OrdenacaoKey = 'nome-asc' | 'nome-desc' | 'criadoEm-desc' | 'criadoEm-asc';
type FiltroAtribuicao = 'todos' | 'sem_medico' | 'com_medico';

const ORDENACAO_OPCOES: { value: OrdenacaoKey; label: string }[] = [
  { value: 'criadoEm-desc', label: 'Mais recentes' },
  { value: 'criadoEm-asc', label: 'Mais antigos' },
  { value: 'nome-asc', label: 'Nome (A → Z)' },
  { value: 'nome-desc', label: 'Nome (Z → A)' },
];

const POR_PAGINA_OPCOES = [10, 20, 50];

function parseOrdenacao(key: OrdenacaoKey) {
  const [ordenarPor, direcao] = key.split('-') as ['nome' | 'criadoEm', 'asc' | 'desc'];
  return { ordenarPor, direcao };
}

export default function AtribuirMedicoPage() {
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [medicos, setMedicos] = useState<Medico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState<string | null>(null);

  // Filtros e paginação
  const [busca, setBusca] = useState('');
  const [buscaDebounced, setBuscaDebounced] = useState('');
  const [filtroAtribuicao, setFiltroAtribuicao] = useState<FiltroAtribuicao>('todos');
  const [ordenacao, setOrdenacao] = useState<OrdenacaoKey>('criadoEm-desc');
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [statsSemMedico, setStatsSemMedico] = useState(0);
  const [statsComMedico, setStatsComMedico] = useState(0);

  // Dialog de reatribuição em lote
  const [dialogAberto, setDialogAberto] = useState(false);
  const [medicoDestinoLote, setMedicoDestinoLote] = useState<string>('');
  const [salvandoLote, setSalvandoLote] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce da busca
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setBuscaDebounced(busca);
      setPagina(1);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [busca]);

  // Reset de página ao trocar filtros
  useEffect(() => {
    setPagina(1);
  }, [filtroAtribuicao, ordenacao, porPagina]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { ordenarPor, direcao } = parseOrdenacao(ordenacao);
    const [resPacientes, resMedicos] = await Promise.all([
      listarPacientesComMedicoPaginado({
        busca: buscaDebounced || undefined,
        filtro: filtroAtribuicao,
        pagina,
        porPagina,
        ordenarPor,
        direcao,
      }),
      listarMedicosDisponiveis(),
    ]);
    if (resPacientes.sucesso && resPacientes.dados) {
      setPacientes(resPacientes.dados.pacientes as Paciente[]);
      setTotal(resPacientes.dados.total);
      setTotalPaginas(resPacientes.dados.totalPaginas);
      setStatsSemMedico(resPacientes.dados.semMedico);
      setStatsComMedico(resPacientes.dados.comMedico);
    }
    if (resMedicos.sucesso && resMedicos.dados) setMedicos(resMedicos.dados as Medico[]);
    setCarregando(false);
  }, [buscaDebounced, filtroAtribuicao, ordenacao, pagina, porPagina]);

  useEffect(() => { carregar(); }, [carregar]);

  async function handleAtribuir(pacienteId: string, medicoId: string) {
    setSalvando(pacienteId);
    const res = await atribuirMedicoAoPaciente(pacienteId, medicoId);
    if (res.sucesso) {
      toast.success('Médico atribuído com sucesso!');
      window.dispatchEvent(new CustomEvent('paciente-atribuido'));
      await carregar();
    } else {
      toast.error(res.erro || 'Erro ao atribuir médico');
    }
    setSalvando(null);
  }

  async function handleReatribuirTodos() {
    if (!medicoDestinoLote) {
      toast.error('Selecione o médico de destino');
      return;
    }

    setSalvandoLote(true);
    const res = await reatribuirTodosPacientes(medicoDestinoLote);
    if (res.sucesso && res.dados) {
      toast.success(`${res.dados.total} paciente(s) reatribuídos com sucesso!`);
      window.dispatchEvent(new CustomEvent('paciente-atribuido'));
      setDialogAberto(false);
      setMedicoDestinoLote('');
      await carregar();
    } else {
      toast.error(res.erro || 'Erro ao reatribuir pacientes');
    }
    setSalvandoLote(false);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Atribuir Médico</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Vincule pacientes sem médico responsável a um profissional
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-xs">
            <AlertCircle className="h-3 w-3 text-amber-500" />
            {statsSemMedico} sem médico
          </Badge>
          <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-xs">
            <UserCheck className="h-3 w-3 text-emerald-500" />
            {statsComMedico} atribuídos
          </Badge>

          {/* Botão Reatribuir Todos com Dialog */}
          <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
            <DialogTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-primary/30 text-primary hover:border-primary hover:bg-primary/5"
                />
              }
            >
              <Users className="h-3.5 w-3.5" />
              Reatribuir todos
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Reatribuir todos os pacientes</DialogTitle>
                <DialogDescription>
                  Todos os <strong>{statsSemMedico + statsComMedico}</strong> pacientes serão
                  reatribuídos para o médico selecionado abaixo. Essa ação
                  substitui qualquer atribuição anterior.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Médico de destino</label>
                  <Select
                    onValueChange={(val: string | null) => setMedicoDestinoLote(val ?? '')}
                    disabled={salvandoLote}
                  >
                    <SelectTrigger className="w-full">
                      {medicoDestinoLote ? (
                        <span className="flex items-center gap-2">
                          <Stethoscope className="h-3 w-3 text-muted-foreground" />
                          {medicos.find((m) => m.medicoId === medicoDestinoLote)?.nome}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Selecionar médico</span>
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {medicos.map((m) => (
                        <SelectItem key={m.medicoId} value={m.medicoId}>
                          <div className="flex items-center gap-2">
                            <Stethoscope className="h-3 w-3 text-muted-foreground" />
                            {m.nome}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs text-amber-800">
                    <strong>Atenção:</strong> essa ação afetará{' '}
                    <strong>{statsSemMedico + statsComMedico}</strong> paciente(s) e não pode
                    ser desfeita em lote. Verifique se o médico selecionado
                    está correto.
                  </p>
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => setDialogAberto(false)}
                  disabled={salvandoLote}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleReatribuirTodos}
                  disabled={!medicoDestinoLote || salvandoLote}
                  className="gap-1.5"
                >
                  {salvandoLote ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Reatribuindo...
                    </>
                  ) : (
                    <>
                      <Users className="h-4 w-4" />
                      Confirmar reatribuição
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Busca */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar paciente por nome ou e-mail..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Ordenação */}
        <Select
          value={ordenacao}
          onValueChange={(val) => { if (val) setOrdenacao(val as OrdenacaoKey); }}
        >
          <SelectTrigger className="w-full sm:w-48">
            <ArrowDownAZ size={14} className="shrink-0 text-muted-foreground" />
            <SelectValue placeholder="Ordenar por" />
          </SelectTrigger>
          <SelectContent>
            {ORDENACAO_OPCOES.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Filtros de atribuição */}
      <div className="flex gap-2">
        {([
          { key: 'todos' as const, label: 'Todos' },
          { key: 'sem_medico' as const, label: 'Sem médico' },
          { key: 'com_medico' as const, label: 'Com médico' },
        ]).map(({ key, label }) => (
          <Button
            key={key}
            variant={filtroAtribuicao === key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFiltroAtribuicao(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      {/* Lista */}
      {carregando ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : pacientes.length === 0 ? (
        <Card className="border-border/40 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <UserCheck className="mb-4 h-12 w-12 text-muted-foreground/30" />
            <p className="text-base font-medium">
              {buscaDebounced ? 'Nenhum paciente encontrado' : 'Nenhum paciente cadastrado'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {buscaDebounced
                ? 'Tente ajustar os filtros de busca'
                : 'Pacientes aparecerão aqui após se cadastrarem ou serem adicionados por um médico.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {pacientes.map((p) => {
            const temMedico = !!p.medicoId;
            return (
              <Card key={p.pacienteId} className={temMedico ? 'border-border/40 shadow-sm' : 'border-amber-200/50 shadow-sm'}>
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                  {/* Info */}
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      temMedico ? 'bg-emerald-500/10' : 'bg-amber-500/10'
                    }`}>
                      {temMedico
                        ? <UserCheck className="h-4 w-4 text-emerald-600" />
                        : <UserPlus className="h-4 w-4 text-amber-600" />
                      }
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{p.nome}</p>
                      <p className="truncate text-xs text-muted-foreground">{p.email}</p>
                    </div>
                  </div>

                  {/* Atribuição */}
                  <div className="flex items-center gap-2">
                    {temMedico && (
                      <Badge variant="outline" className="gap-1.5">
                        <Stethoscope className="h-3 w-3" />
                        {p.medicoNome}
                      </Badge>
                    )}
                    <Select
                      onValueChange={(val) => handleAtribuir(p.pacienteId, val as string)}
                      disabled={salvando === p.pacienteId}
                    >
                      <SelectTrigger className={temMedico ? 'w-[180px]' : 'w-[220px]'}>
                        <SelectValue placeholder={temMedico ? 'Reatribuir' : 'Selecionar médico'} />
                      </SelectTrigger>
                      <SelectContent>
                        {medicos.map((m) => (
                          <SelectItem key={m.medicoId} value={m.medicoId}>
                            <div className="flex items-center gap-2">
                              <Stethoscope className="h-3 w-3 text-muted-foreground" />
                              {m.nome}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {salvando === p.pacienteId && (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Paginação */}
      {totalPaginas > 0 && !carregando && pacientes.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          {/* Info + itens por página */}
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>
              {total} paciente{total !== 1 ? 's' : ''}
            </span>
            <span className="text-border">·</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs">Exibir</span>
              <Select
                value={String(porPagina)}
                onValueChange={(val) => { if (val) setPorPagina(Number(val)); }}
              >
                <SelectTrigger size="sm" className="w-16">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POR_PAGINA_OPCOES.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs">por página</span>
            </div>
          </div>

          {/* Controles de página */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagina <= 1}
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
              className="gap-1"
            >
              <ChevronLeft size={14} />
              Anterior
            </Button>
            <span className="min-w-[6rem] text-center text-sm tabular-nums text-muted-foreground">
              Página {pagina} de {totalPaginas}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagina >= totalPaginas}
              onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
              className="gap-1"
            >
              Próximo
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
