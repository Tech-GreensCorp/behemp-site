'use client';

import { useState, useEffect, useRef } from 'react';
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
import { listarPacientesAdmin, type PacienteDoAdmin } from '@/app/_actions/admin-pacientes';
import { importarPacientesCSV, exportarPacientesCSV } from '@/app/_actions/pacientes';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { PaginationBar } from '@/components/shared/pagination-bar';
import { DataList, DataRow, DataEmpty } from '@/components/shared/data-list';
import {
  ChevronRight,
  Download,
  Loader2,
  Search,
  Stethoscope,
  Upload,
  User,
  UserPlus,
} from 'lucide-react';

// ── Configurações de display (mesmas da tela do médico) ────────

const STATUS_LABELS: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
> = {
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

const POR_PAGINA_OPCOES = [10, 20, 50];

export default function AdminPacientesPage() {
  const [busca, setBusca] = useState('');
  const [buscaDebounced, setBuscaDebounced] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroTratamento, setFiltroTratamento] = useState('todos');
  const [filtroJornada, setFiltroJornada] = useState('todos');
  const [pacientes, setPacientes] = useState<PacienteDoAdmin[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(1);
  // Incrementa para forçar nova busca com os mesmos filtros (ex.: depois de importar).
  const [versao, setVersao] = useState(0);
  const [importando, setImportando] = useState(false);
  const [exportando, setExportando] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Quais parâmetros geraram os dados que estão na tela. "Carregando" é DERIVADO disso:
  // enquanto a busca atual não for a que está exibida. Um booleano setado à mão travava
  // quando o valor voltava a ser igual ao anterior (nenhum effect rodava para desligá-lo).
  const chave = JSON.stringify([
    buscaDebounced,
    filtroStatus,
    filtroTratamento,
    filtroJornada,
    pagina,
    porPagina,
    versao,
  ]);
  const [chaveExibida, setChaveExibida] = useState<string | null>(null);
  const carregando = chaveExibida !== chave;

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

  // Filtro mudou → volta para a página 1 (no handler, não em effect).
  function mudarFiltro(set: (v: string) => void, valor: string | null) {
    set(valor ?? 'todos');
    setPagina(1);
  }

  function mudarPorPagina(valor: number) {
    setPorPagina(valor);
    setPagina(1);
  }

  useEffect(() => {
    let cancelado = false;
    listarPacientesAdmin({
      busca: buscaDebounced || undefined,
      status: filtroStatus as 'todos',
      tratamento: filtroTratamento as 'todos',
      jornada: filtroJornada as 'todos',
      pagina,
      porPagina,
    })
      .then((resultado) => {
        if (cancelado) return; // resposta de uma busca que já foi substituída
        if (resultado.sucesso && resultado.dados) {
          setPacientes(resultado.dados.pacientes);
          setTotal(resultado.dados.total);
          setTotalPaginas(resultado.dados.totalPaginas);
          setErro(null);
        } else {
          setErro(resultado.erro ?? 'Erro ao listar pacientes');
        }
        setChaveExibida(chave);
      })
      .catch(() => {
        if (cancelado) return;
        setErro('Erro ao listar pacientes');
        setChaveExibida(chave);
      });
    return () => {
      cancelado = true;
    };
  }, [chave, buscaDebounced, filtroStatus, filtroTratamento, filtroJornada, pagina, porPagina]);

  // ── Importar CSV / XLSX ───────────────────────────────────────
  async function handleImportar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportando(true);

    try {
      const isXlsx =
        file.name.endsWith('.xlsx') ||
        file.name.endsWith('.xls') ||
        file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.type === 'application/vnd.ms-excel';

      let conteudo: string;

      if (isXlsx) {
        const XLSX = await import('xlsx');
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const planilha = workbook.Sheets[workbook.SheetNames[0]];
        conteudo = XLSX.utils.sheet_to_csv(planilha, { FS: ';' });
      } else {
        conteudo = await file.text();
      }

      const resultado = await importarPacientesCSV(conteudo);

      if (resultado.sucesso && resultado.dados) {
        const { importados, ignorados, erros } = resultado.dados;

        if (importados > 0) {
          toast.success(
            `${importados} paciente${importados > 1 ? 's' : ''} importado${importados > 1 ? 's' : ''} com sucesso!`,
            {
              description:
                ignorados > 0
                  ? `${ignorados} já existente${ignorados > 1 ? 's' : ''} (ignorados)`
                  : undefined,
            },
          );
        } else {
          toast.info('Nenhum paciente novo importado.', {
            description:
              ignorados > 0
                ? `${ignorados} já existente${ignorados > 1 ? 's' : ''} no sistema`
                : undefined,
          });
        }

        if (erros.length > 0) {
          toast.warning(`${erros.length} erro${erros.length > 1 ? 's' : ''} durante a importação`, {
            description: erros[0],
          });
        }

        setVersao((v) => v + 1);
      } else {
        toast.error(resultado.erro || 'Erro ao importar arquivo');
      }
    } catch {
      toast.error('Erro ao ler o arquivo. Verifique se é um CSV ou XLSX válido.');
    } finally {
      setImportando(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  // ── Exportar CSV ──────────────────────────────────────────────
  async function handleExportar() {
    setExportando(true);
    try {
      const resultado = await exportarPacientesCSV();
      if (resultado.sucesso && resultado.dados) {
        const blob = new Blob(['﻿' + resultado.dados], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pacientes-${new Date().toISOString().split('T')[0]}.csv`;
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

  const filtrando =
    busca !== '' ||
    filtroStatus !== 'todos' ||
    filtroTratamento !== 'todos' ||
    filtroJornada !== 'todos';

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Gestão"
        title="Pacientes"
        description={
          carregando
            ? 'Carregando...'
            : `${total} paciente${total !== 1 ? 's' : ''} cadastrado${total !== 1 ? 's' : ''}`
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
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
              {importando ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {importando ? 'Importando...' : 'Importar CSV / XLSX'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 rounded-xl"
              onClick={handleExportar}
              disabled={exportando || total === 0}
            >
              {exportando ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {exportando ? 'Exportando...' : 'Exportar CSV'}
            </Button>
            <Link href="/admin/pacientes/novo">
              <Button className="gap-2 rounded-xl" nativeButton={false}>
                <UserPlus size={16} />
                Novo paciente
              </Button>
            </Link>
          </div>
        }
      />

      {/* Filtros */}
      <Card className="border-border/40 shadow-sm">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search
              size={16}
              className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2"
            />
            <Input
              placeholder="Buscar por nome..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filtroStatus} onValueChange={(v) => mudarFiltro(setFiltroStatus, v)}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Status">
                {filtroStatus === 'todos'
                  ? 'Todos os status'
                  : (STATUS_LABELS[filtroStatus]?.label ?? filtroStatus)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {Object.entries(STATUS_LABELS).map(([valor, { label }]) => (
                <SelectItem key={valor} value={valor}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filtroTratamento}
            onValueChange={(v) => mudarFiltro(setFiltroTratamento, v)}
          >
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Tratamento">
                {filtroTratamento === 'todos'
                  ? 'Todos os tipos'
                  : (TRATAMENTO_LABELS[filtroTratamento] ?? filtroTratamento)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              {Object.entries(TRATAMENTO_LABELS).map(([valor, label]) => (
                <SelectItem key={valor} value={valor}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filtroJornada} onValueChange={(v) => mudarFiltro(setFiltroJornada, v)}>
            <SelectTrigger className="w-full sm:w-52">
              <SelectValue placeholder="Fase da jornada">
                {filtroJornada === 'todos' ? (
                  'Todas as fases'
                ) : (
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: JORNADA_LABELS[filtroJornada]?.color }}
                    />
                    {JORNADA_LABELS[filtroJornada]?.icon}{' '}
                    {JORNADA_LABELS[filtroJornada]?.label ?? filtroJornada}
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
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
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
          <Loader2 size={32} className="text-primary animate-spin" />
        </div>
      ) : erro ? (
        <DataEmpty icon={<User size={24} />} title="Não foi possível carregar" description={erro} />
      ) : pacientes.length === 0 ? (
        <DataEmpty
          icon={<User size={24} />}
          title="Nenhum paciente encontrado"
          description={
            filtrando ? 'Tente ajustar os filtros' : 'Comece cadastrando ou importando pacientes'
          }
        />
      ) : (
        <DataList>
          {pacientes.map((paciente) => {
            const statusConfig =
              STATUS_LABELS[paciente.status] ?? STATUS_LABELS.aguardando_consulta;
            const jornada = paciente.jornadaFase ? JORNADA_LABELS[paciente.jornadaFase] : undefined;
            return (
              <DataRow
                key={paciente.id}
                href={`/admin/pacientes/${paciente.id}`}
                icon={
                  <span className="font-heading text-secondary text-sm font-semibold">
                    {paciente.nome.charAt(0).toUpperCase()}
                  </span>
                }
                title={paciente.nome}
                subtitle={paciente.email}
                trailing={
                  <>
                    <div className="hidden items-center gap-2 sm:flex">
                      <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                        <Stethoscope size={12} />
                        {paciente.medicoNome ?? 'Sem médico'}
                      </span>
                      {jornada && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{
                            backgroundColor: `${jornada.color}18`,
                            color: jornada.color,
                            border: `1px solid ${jornada.color}35`,
                          }}
                        >
                          <span>{jornada.icon}</span>
                          {jornada.label}
                        </span>
                      )}
                      {paciente.tratamentoTipo && (
                        <Badge variant="outline" className="text-xs">
                          {TRATAMENTO_LABELS[paciente.tratamentoTipo] ?? paciente.tratamentoTipo}
                        </Badge>
                      )}
                      <Badge variant={statusConfig.variant} className="text-xs">
                        {statusConfig.label}
                      </Badge>
                    </div>
                    <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                  </>
                }
              />
            );
          })}
        </DataList>
      )}

      {totalPaginas > 0 && !carregando && pacientes.length > 0 && (
        <PaginationBar
          page={pagina}
          totalPages={totalPaginas}
          onPageChange={setPagina}
          totalItems={total}
          itemLabel="paciente"
          pageSize={porPagina}
          onPageSizeChange={mudarPorPagina}
          pageSizeOptions={POR_PAGINA_OPCOES}
        />
      )}
    </div>
  );
}
