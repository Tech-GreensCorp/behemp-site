'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  listarPacientesComMedico,
  listarMedicosDisponiveis,
  atribuirMedicoAoPaciente,
  reatribuirTodosPacientes,
} from '@/app/_actions/admin-atribuicao';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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

export default function AtribuirMedicoPage() {
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [medicos, setMedicos] = useState<Medico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [busca, setBusca] = useState('');

  // Estado do dialog de reatribuição em lote
  const [dialogAberto, setDialogAberto] = useState(false);
  const [medicoDestinoLote, setMedicoDestinoLote] = useState<string>('');
  const [salvandoLote, setSalvandoLote] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const [resPacientes, resMedicos] = await Promise.all([
      listarPacientesComMedico(),
      listarMedicosDisponiveis(),
    ]);
    if (resPacientes.sucesso && resPacientes.dados) setPacientes(resPacientes.dados);
    if (resMedicos.sucesso && resMedicos.dados) setMedicos(resMedicos.dados);
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function handleAtribuir(pacienteId: string, medicoId: string) {
    setSalvando(pacienteId);
    const res = await atribuirMedicoAoPaciente(pacienteId, medicoId);
    if (res.sucesso) {
      toast.success('Médico atribuído com sucesso!');
      // Notifica o sidebar para atualizar o badge
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

  const semMedico = pacientes.filter((p) => !p.medicoId);
  const comMedico = pacientes.filter((p) => !!p.medicoId);

  const filtrar = (lista: Paciente[]) => {
    if (!busca.trim()) return lista;
    const termo = busca.toLowerCase();
    return lista.filter(
      (p) =>
        p.nome.toLowerCase().includes(termo) ||
        p.email.toLowerCase().includes(termo),
    );
  };

  const semMedicoFiltrado = filtrar(semMedico);
  const comMedicoFiltrado = filtrar(comMedico);

  if (carregando) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
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
            {semMedico.length} sem médico
          </Badge>
          <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-xs">
            <UserCheck className="h-3 w-3 text-emerald-500" />
            {comMedico.length} atribuídos
          </Badge>

          {/* Botão Reatribuir Todos com Dialog de confirmação */}
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
                  Todos os <strong>{pacientes.length}</strong> pacientes serão
                  reatribuídos para o médico selecionado abaixo. Essa ação
                  substitui qualquer atribuição anterior.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Médico de destino</label>
                  <Select
                    onValueChange={(val) => setMedicoDestinoLote(val ?? '')}
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
                    <strong>{pacientes.length}</strong> paciente(s) e não pode
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

      {/* Busca */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar paciente..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Pacientes sem médico */}
      {semMedicoFiltrado.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-heading text-xs font-semibold uppercase tracking-widest text-amber-600">
            ⚠ Pacientes sem médico responsável
          </h2>
          <div className="space-y-3">
            {semMedicoFiltrado.map((p) => (
              <Card key={p.pacienteId} className="border-amber-200/50 shadow-sm">
                <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  {/* Info */}
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
                      <UserPlus className="h-4 w-4 text-amber-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{p.nome}</p>
                      <p className="truncate text-xs text-muted-foreground">{p.email}</p>
                    </div>
                  </div>

                  {/* Select de médico + botão */}
                  <div className="flex items-center gap-2">
                    <Select
                      onValueChange={(val) => handleAtribuir(p.pacienteId, val as string)}
                      disabled={salvando === p.pacienteId}
                    >
                      <SelectTrigger className="w-[220px]">
                        <SelectValue placeholder="Selecionar médico" />
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
            ))}
          </div>
        </section>
      )}

      {/* Pacientes com médico */}
      {comMedicoFiltrado.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-heading text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Pacientes com médico atribuído
          </h2>
          <div className="space-y-2">
            {comMedicoFiltrado.map((p) => (
              <Card key={p.pacienteId} className="border-border/40 shadow-sm">
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
                      <UserCheck className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{p.nome}</p>
                      <p className="truncate text-xs text-muted-foreground">{p.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="gap-1.5">
                      <Stethoscope className="h-3 w-3" />
                      {p.medicoNome}
                    </Badge>
                    {/* Permite reatribuir */}
                    <Select
                      onValueChange={(val) => handleAtribuir(p.pacienteId, val as string)}
                      disabled={salvando === p.pacienteId}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Reatribuir" />
                      </SelectTrigger>
                      <SelectContent>
                        {medicos.map((m) => (
                          <SelectItem key={m.medicoId} value={m.medicoId}>
                            {m.nome}
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
            ))}
          </div>
        </section>
      )}

      {/* Empty state geral */}
      {pacientes.length === 0 && (
        <Card className="border-border/40 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <UserCheck className="mb-4 h-12 w-12 text-muted-foreground/30" />
            <p className="text-base font-medium">Nenhum paciente cadastrado</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Pacientes aparecerão aqui após se cadastrarem ou serem adicionados por um médico.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
