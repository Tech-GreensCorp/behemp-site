'use client';

import { useState, useTransition, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ShieldCheck, RefreshCw, Loader2, FileSearch, Clock, CheckCircle2, AlertCircle, XCircle, FileCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Tipos ──────────────────────────────────────────────────────
type AnvisaStatus = 'pendente' | 'documentos_enviados' | 'em_analise' | 'aprovado' | 'pendencia_documental' | 'rejeitado';

type Autorizacao = {
  id: string;
  pacienteId: string;
  medicoId: string;
  status: AnvisaStatus;
  dataEnvio: string | null;
  dataAprovacao: string | null;
  prazoEstimado: string | null;
  numeroProcesso: string | null;
  observacoesAnvisa: string | null;
  createdAt: string;
};

const STATUS_CONFIG: Record<AnvisaStatus, { label: string; cor: string; icon: React.ReactNode }> = {
  pendente: { label: 'Pendente', cor: 'bg-muted text-muted-foreground', icon: <Clock className="h-3 w-3" /> },
  documentos_enviados: { label: 'Docs enviados', cor: 'bg-blue-100 text-blue-700', icon: <FileCheck className="h-3 w-3" /> },
  em_analise: { label: 'Em análise', cor: 'bg-yellow-100 text-yellow-700', icon: <Clock className="h-3 w-3 animate-pulse" /> },
  aprovado: { label: 'Aprovado', cor: 'bg-green-100 text-green-700', icon: <CheckCircle2 className="h-3 w-3" /> },
  pendencia_documental: { label: 'Pendência', cor: 'bg-orange-100 text-orange-700', icon: <AlertCircle className="h-3 w-3" /> },
  rejeitado: { label: 'Rejeitado', cor: 'bg-red-100 text-red-700', icon: <XCircle className="h-3 w-3" /> },
};

const FILTROS: { value: 'todos' | AnvisaStatus; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'pendente', label: 'Pendente' },
  { value: 'documentos_enviados', label: 'Docs enviados' },
  { value: 'em_analise', label: 'Em análise' },
  { value: 'pendencia_documental', label: 'Pendência' },
  { value: 'aprovado', label: 'Aprovado' },
  { value: 'rejeitado', label: 'Rejeitado' },
];

export default function AdminAnvisaPage() {
  const [isPending, startTransition] = useTransition();
  const [autorizacoes, setAutorizacoes] = useState<Autorizacao[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [filtro, setFiltro] = useState<'todos' | AnvisaStatus>('todos');
  const [selecionada, setSelecionada] = useState<Autorizacao | null>(null);
  const [dialogAberto, setDialogAberto] = useState(false);

  // Form de atualização
  const [novoStatus, setNovoStatus] = useState<string>('');
  const [numeroProcesso, setNumeroProcesso] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const carregar = async () => {
    setCarregando(true);
    try {
      const res = await fetch('/api/anvisa/atualizar-status', { method: 'GET' }).catch(() => null);
      // Como não há GET implementado, buscamos via server action interna
      // Para admin, usamos fetch direto no banco via endpoint dedicado se necessário
      // Por ora, listagem via endpoint simplificado
      const resp = await fetch('/api/admin/anvisa/listar', { cache: 'no-store' }).catch(() => null);
      if (resp?.ok) {
        const data = await resp.json() as { dados?: Autorizacao[] };
        setAutorizacoes(data.dados ?? []);
      }
    } catch {
      // silencioso
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    void carregar();
  }, []);

  const abrirDialog = (aut: Autorizacao) => {
    setSelecionada(aut);
    setNovoStatus(aut.status);
    setNumeroProcesso(aut.numeroProcesso ?? '');
    setObservacoes(aut.observacoesAnvisa ?? '');
    setDialogAberto(true);
  };

  const handleAtualizar = () => {
    if (!selecionada || !novoStatus) return;
    startTransition(async () => {
      try {
        const res = await fetch('/api/anvisa/atualizar-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            autorizacaoId: selecionada.id,
            status: novoStatus,
            numeroProcesso: numeroProcesso || undefined,
            observacoes: observacoes || undefined,
          }),
        });
        const data = await res.json() as { sucesso?: boolean; erro?: string };
        if (data.sucesso) {
          toast.success('Status atualizado com sucesso!');
          setDialogAberto(false);
          void carregar();
        } else {
          toast.error(data.erro ?? 'Erro ao atualizar.');
        }
      } catch {
        toast.error('Erro de conexão.');
      }
    });
  };

  const filtrados = filtro === 'todos' ? autorizacoes : autorizacoes.filter((a) => a.status === filtro);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-display font-bold">Autorizações ANVISA</h1>
            <p className="text-sm text-muted-foreground">Gerencie os processos de importação dos pacientes.</p>
          </div>
        </div>
        <Button variant="outline" onClick={carregar} disabled={carregando} className="gap-2">
          <RefreshCw className={cn('h-4 w-4', carregando && 'animate-spin')} />
          Atualizar
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {FILTROS.map((f) => (
          <Button
            key={f.value}
            size="sm"
            variant={filtro === f.value ? 'default' : 'outline'}
            onClick={() => setFiltro(f.value)}
          >
            {f.label}
            {f.value !== 'todos' && (
              <span className="ml-1.5 text-xs opacity-70">
                {autorizacoes.filter((a) => a.status === f.value).length}
              </span>
            )}
          </Button>
        ))}
      </div>

      {/* Lista */}
      {carregando ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <FileSearch className="h-10 w-10 opacity-40" />
          <p className="text-sm">Nenhuma autorização encontrada.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtrados.map((aut) => (
            <Card key={aut.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="flex items-center justify-between gap-4 py-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge className={cn('gap-1 text-xs shrink-0', STATUS_CONFIG[aut.status].cor)}>
                      {STATUS_CONFIG[aut.status].icon}
                      {STATUS_CONFIG[aut.status].label}
                    </Badge>
                    {aut.numeroProcesso && (
                      <span className="text-xs font-mono text-muted-foreground">{aut.numeroProcesso}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    ID: <span className="font-mono">{aut.id}</span>
                  </p>
                  {aut.dataEnvio && (
                    <p className="text-xs text-muted-foreground">
                      Enviado: {new Date(aut.dataEnvio).toLocaleDateString('pt-BR')}
                      {aut.prazoEstimado && ` · Prazo: ${aut.prazoEstimado}`}
                    </p>
                  )}
                </div>
                <Button size="sm" variant="outline" onClick={() => abrirDialog(aut)}>
                  Atualizar status
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog de atualização */}
      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Atualizar Status ANVISA</DialogTitle>
            <DialogDescription>
              Atualize o status do processo e informe o número do protocolo quando disponível.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Novo status</Label>
              <Select value={novoStatus} onValueChange={(v) => setNovoStatus(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="em_analise">Em análise</SelectItem>
                  <SelectItem value="aprovado">Aprovado</SelectItem>
                  <SelectItem value="pendencia_documental">Pendência documental</SelectItem>
                  <SelectItem value="rejeitado">Rejeitado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Número do processo ANVISA (opcional)</Label>
              <Input
                placeholder="Ex: 25351.000000/2024-00"
                value={numeroProcesso}
                onChange={(e) => setNumeroProcesso(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Observações da ANVISA (opcional)</Label>
              <Textarea
                placeholder="Informe ao paciente qualquer pendência ou orientação..."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAberto(false)}>Cancelar</Button>
            <Button onClick={handleAtualizar} disabled={isPending || !novoStatus}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
