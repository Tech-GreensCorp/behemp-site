'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
  listarPacientes,
  importarPacientesCSV,
  exportarPacientesCSV,
} from '@/app/_actions/pacientes';
import { toast } from 'sonner';
import {
  ChevronRight,
  Download,
  Loader2,
  Search,
  Upload,
  User,
  UserPlus,
} from 'lucide-react';

// ── Configurações de display ───────────────────────────────────

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  em_tratamento: { label: 'Em tratamento', variant: 'default' },
  aguardando_consulta: { label: 'Aguardando consulta', variant: 'secondary' },
  concluido: { label: 'Concluído', variant: 'outline' },
  arquivado: { label: 'Arquivado', variant: 'destructive' },
};

const TRATAMENTO_LABELS: Record<string, string> = {
  cbd: 'CBD',
  thc: 'THC',
  cbd_thc: 'CBD + THC',
};

const JORNADA_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  acolhimento: { label: 'Acolhimento', icon: '🤝', color: '#1A6B41' },
  avaliacao_medica: { label: 'Avaliação Médica', icon: '🩺', color: '#B83220' },
  burocracia_anvisa: { label: 'Burocracia / ANVISA', icon: '📋', color: '#9A6C00' },
  logistica: { label: 'Logística', icon: '📦', color: '#2563EB' },
  acompanhamento_continuo: { label: 'Acompanhamento', icon: '🔄', color: '#7C3AED' },
};

interface Paciente {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  status: string;
  jornadaFase: string | null;
  tratamentoTipo: string | null;
  createdAt: Date;
}

export default function PacientesPage() {
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroTratamento, setFiltroTratamento] = useState('todos');
  const [filtroJornada, setFiltroJornada] = useState('todos');
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [importando, setImportando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const carregarPacientes = useCallback(async () => {
    setCarregando(true);
    const resultado = await listarPacientes({
      busca: busca || undefined,
      status: filtroStatus,
      tratamento: filtroTratamento,
      jornada: filtroJornada,
    });
    if (resultado.sucesso && resultado.dados) {
      setPacientes(resultado.dados);
    }
    setCarregando(false);
  }, [busca, filtroStatus, filtroTratamento, filtroJornada]);

  // Debounce na busca
  useEffect(() => {
    const timer = setTimeout(() => {
      carregarPacientes();
    }, 300);
    return () => clearTimeout(timer);
  }, [carregarPacientes]);

  // ── Importar CSV / XLSX ───────────────────────────────────────
  async function handleImportar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportando(true);

    try {
      const isXlsx = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
        || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        || file.type === 'application/vnd.ms-excel';

      let conteudo: string;

      if (isXlsx) {
        // Ler XLSX no cliente e converter para CSV com separador ;
        const XLSX = await import('xlsx');
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const primeiraAba = workbook.SheetNames[0];
        const planilha = workbook.Sheets[primeiraAba];
        // csv_para_csv_sep: usa ; para compatibilidade com parseCsvLinhas do backend
        conteudo = XLSX.utils.sheet_to_csv(planilha, { FS: ';' });
      } else {
        conteudo = await file.text();
      }

      const resultado = await importarPacientesCSV(conteudo);

      if (resultado.sucesso && resultado.dados) {
        const { importados, ignorados, erros } = resultado.dados;

        if (importados > 0) {
          toast.success(`${importados} paciente${importados > 1 ? 's' : ''} importado${importados > 1 ? 's' : ''} com sucesso!`, {
            description: ignorados > 0 ? `${ignorados} já existente${ignorados > 1 ? 's' : ''} (ignorados)` : undefined,
          });
        } else {
          toast.info('Nenhum paciente novo importado.', {
            description: ignorados > 0 ? `${ignorados} já existente${ignorados > 1 ? 's' : ''} no sistema` : undefined,
          });
        }

        if (erros.length > 0) {
          toast.warning(`${erros.length} erro${erros.length > 1 ? 's' : ''} durante a importação`, {
            description: erros[0],
          });
        }

        await carregarPacientes();
      } else {
        toast.error(resultado.erro || 'Erro ao importar arquivo');
      }
    } catch {
      toast.error('Erro ao ler o arquivo. Verifique se é um CSV ou XLSX válido.');
    } finally {
      setImportando(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  // ── Exportar CSV ──────────────────────────────────────────────
  async function handleExportar() {
    setExportando(true);
    try {
      const resultado = await exportarPacientesCSV();
      if (resultado.sucesso && resultado.dados) {
        // Criar e baixar arquivo
        const blob = new Blob(['\uFEFF' + resultado.dados], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const data = new Date().toISOString().split('T')[0];
        a.download = `pacientes-${data}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast.success('Arquivo CSV exportado com sucesso!');
      } else {
        toast.error(resultado.erro || 'Erro ao exportar');
      }
    } catch {
      toast.error('Erro ao exportar pacientes');
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Gestão
          </p>
          <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
            <span className="text-accent-italic">Pacientes</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {carregando ? 'Carregando...' : `${pacientes.length} paciente${pacientes.length !== 1 ? 's' : ''} cadastrado${pacientes.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Input oculto para upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={handleImportar}
          />
          <Button
            variant="outline"
            size="sm"
            className="gap-2 rounded-xl"
            onClick={() => fileInputRef.current?.click()}
            disabled={importando}
          >
            {importando ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Upload size={14} />
            )}
            {importando ? 'Importando...' : 'Importar CSV / XLSX'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 rounded-xl"
            onClick={handleExportar}
            disabled={exportando || pacientes.length === 0}
          >
            {exportando ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Download size={14} />
            )}
            {exportando ? 'Exportando...' : 'Exportar CSV'}
          </Button>
          <Link href="/medico/pacientes/novo">
            <Button className="gap-2 rounded-xl" nativeButton={false}>
              <UserPlus size={16} />
              Novo paciente
            </Button>
          </Link>
        </div>
      </div>

      <div className="h-px bg-gradient-to-r from-border/60 via-border to-transparent" />

      {/* Filtros */}
      <Card className="border-border/40 shadow-sm">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v ?? 'todos')}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Status">
                {filtroStatus === 'todos' ? 'Todos os status' : (STATUS_LABELS[filtroStatus]?.label ?? filtroStatus)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="em_tratamento">Em tratamento</SelectItem>
              <SelectItem value="aguardando_consulta">Aguardando consulta</SelectItem>
              <SelectItem value="concluido">Concluído</SelectItem>
              <SelectItem value="arquivado">Arquivado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroTratamento} onValueChange={(v) => setFiltroTratamento(v ?? 'todos')}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Tratamento">
                {filtroTratamento === 'todos' ? 'Todos os tipos' : (TRATAMENTO_LABELS[filtroTratamento] ?? filtroTratamento)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              <SelectItem value="cbd">CBD</SelectItem>
              <SelectItem value="thc">THC</SelectItem>
              <SelectItem value="cbd_thc">CBD + THC</SelectItem>
            </SelectContent>
          </Select>
          {/* Filtro por fase da jornada */}
          <Select value={filtroJornada} onValueChange={(v) => setFiltroJornada(v ?? 'todos')}>
            <SelectTrigger className="w-full sm:w-52">
              <SelectValue placeholder="Fase da jornada">
                {filtroJornada === 'todos' ? 'Todas as fases' : (
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: JORNADA_LABELS[filtroJornada]?.color }}
                    />
                    {JORNADA_LABELS[filtroJornada]?.icon} {JORNADA_LABELS[filtroJornada]?.label ?? filtroJornada}
                  </span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as fases</SelectItem>
              {Object.entries(JORNADA_LABELS).map(([key, { label, icon, color }]) => (
                <SelectItem key={key} value={key}>
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    {icon} {label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Lista */}
      {carregando ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={32} className="animate-spin text-primary" />
        </div>
      ) : pacientes.length === 0 ? (
        <Card className="border-border/40 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <User size={48} className="mb-4 text-muted-foreground/30" />
            <p className="text-lg font-medium">Nenhum paciente encontrado</p>
            <p className="text-sm text-muted-foreground">
              {busca || filtroStatus !== 'todos' || filtroTratamento !== 'todos' || filtroJornada !== 'todos'
                ? 'Tente ajustar os filtros'
                : 'Comece cadastrando ou importando pacientes'}
            </p>
            {!busca && filtroStatus === 'todos' && filtroTratamento === 'todos' && filtroJornada === 'todos' && (
              <div className="mt-4 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={14} />
                  Importar CSV / XLSX
                </Button>
                <Link href="/medico/pacientes/novo">
                  <Button size="sm" className="gap-2" nativeButton={false}>
                    <UserPlus size={14} />
                    Cadastrar paciente
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {pacientes.map((paciente) => {
            const statusConfig = STATUS_LABELS[paciente.status] ?? STATUS_LABELS.aguardando_consulta;
            return (
              <Link key={paciente.id} href={`/medico/pacientes/${paciente.id}`}>
                <Card className="group border-border/40 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
                  <CardContent className="flex items-center gap-4 p-4">
                    {/* Inicial */}
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary/10 font-heading text-sm font-semibold text-secondary">
                      {paciente.nome.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{paciente.nome}</p>
                      <p className="truncate text-sm text-muted-foreground">{paciente.email}</p>
                    </div>
                    <div className="hidden items-center gap-2 sm:flex">
                      {paciente.jornadaFase && (() => {
                        const jornada = JORNADA_LABELS[paciente.jornadaFase!];
                        return (
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                            style={{
                              backgroundColor: jornada ? `${jornada.color}18` : undefined,
                              color: jornada?.color,
                              border: `1px solid ${jornada ? `${jornada.color}35` : 'transparent'}`,
                            }}
                          >
                            <span>{jornada?.icon}</span>
                            {jornada?.label ?? paciente.jornadaFase}
                          </span>
                        );
                      })()}
                      {paciente.tratamentoTipo && (
                        <Badge variant="outline" className="text-xs">
                          {TRATAMENTO_LABELS[paciente.tratamentoTipo] ?? paciente.tratamentoTipo}
                        </Badge>
                      )}
                      <Badge variant={statusConfig.variant} className="text-xs">
                        {statusConfig.label}
                      </Badge>
                    </div>
                    <ChevronRight size={16} className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
