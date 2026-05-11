'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { listarLogs } from '@/app/(admin)/_actions/auditoria';
import {
  Calendar,
  Download,
  Eye,
  Loader2,
  Pencil,
  Plus,
  Shield,
  Trash2,
} from 'lucide-react';

/**
 * Página de auditoria LGPD — logs de operações sensíveis.
 */

interface LogAuditoria {
  id: string;
  userId: string | null;
  acao: string;
  entidade: string;
  entidadeId: string | null;
  ip: string | null;
  createdAt: Date;
}

const ACAO_CONFIG: Record<string, { label: string; icon: typeof Eye; cor: string }> = {
  visualizar: { label: 'Visualizar', icon: Eye, cor: 'bg-blue-500/10 text-blue-600' },
  criar: { label: 'Criar', icon: Plus, cor: 'bg-emerald-500/10 text-emerald-600' },
  atualizar: { label: 'Atualizar', icon: Pencil, cor: 'bg-amber-500/10 text-amber-600' },
  deletar: { label: 'Deletar', icon: Trash2, cor: 'bg-red-500/10 text-red-600' },
  exportar: { label: 'Exportar', icon: Download, cor: 'bg-purple-500/10 text-purple-600' },
};

export default function AuditoriaPage() {
  const [logs, setLogs] = useState<LogAuditoria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtroEntidade, setFiltroEntidade] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    const res = await listarLogs({
      entidade: filtroEntidade || undefined,
      limite: 100,
    });
    if (res.sucesso && res.dados) {
      setLogs(res.dados as LogAuditoria[]);
    }
    setCarregando(false);
  }, [filtroEntidade]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Auditoria LGPD</h1>
        <p className="text-sm text-muted-foreground">
          Registro de todas as operações sensíveis na plataforma
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          value={filtroEntidade}
          onChange={(e) => setFiltroEntidade(e.target.value)}
          placeholder="Filtrar por entidade (paciente, documento, evolucao...)"
          className="max-w-xs"
        />
        {['paciente', 'documento', 'evolucao', 'dosagem'].map((ent) => (
          <Button
            key={ent}
            variant={filtroEntidade === ent ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFiltroEntidade(filtroEntidade === ent ? '' : ent)}
            className="capitalize"
          >
            {ent}
          </Button>
        ))}
      </div>

      {/* Lista */}
      {carregando ? (
        <div className="flex justify-center py-12">
          <Loader2 size={32} className="animate-spin text-primary" />
        </div>
      ) : logs.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Shield size={40} className="mb-3 text-muted-foreground/40" />
            <p className="text-lg font-medium">Nenhum registro de auditoria</p>
            <p className="mt-1 text-sm text-muted-foreground">
              As operações sensíveis serão registradas automaticamente
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => {
            const acaoConf = ACAO_CONFIG[log.acao] ?? ACAO_CONFIG.visualizar;
            const Icon = acaoConf?.icon ?? Shield;

            return (
              <Card key={log.id} className="border-0 shadow-sm">
                <CardContent className="flex items-start gap-4 p-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${acaoConf?.cor ?? 'bg-muted'}`}>
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {log.acao}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] capitalize">
                        {log.entidade}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {log.entidadeId && (
                        <span className="font-mono text-xs">ID: {log.entidadeId.slice(0, 8)}... </span>
                      )}
                      {log.userId && (
                        <span className="text-xs">Usuário: {log.userId.slice(0, 8)}...</span>
                      )}
                    </p>
                  </div>
                  <div className="hidden shrink-0 text-right text-xs text-muted-foreground sm:block">
                    <div className="flex items-center gap-1">
                      <Calendar size={12} />
                      <span>
                        {new Date(log.createdAt).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    {log.ip && <p className="mt-0.5">IP: {log.ip}</p>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
