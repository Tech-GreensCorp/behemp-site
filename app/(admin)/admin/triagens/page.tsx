'use client';

import { useState, useEffect, useMemo, Fragment } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  listarTriagens,
  atualizarStatusTriagem,
  excluirTriagem,
  excluirTriagensEmLote,
} from '@/app/(public)/_actions/triagem';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Download,
  Eye,
  FileCheck,
  FileSpreadsheet,
  Filter,
  HeartCrack,
  Home,
  Mail,
  Phone,
  Search,
  Stethoscope,
  Trash2,
  User,
  X,
} from 'lucide-react';

/** URL da planilha Google Sheets centralizada */
const SHEETS_URL = `https://docs.google.com/spreadsheets/d/${process.env.NEXT_PUBLIC_SHEETS_SPREADSHEET_ID || '1hchr4CFjtHmVYGrRyBjp7H7RbBM0PWRMeuBWWhQjmJ8'}/edit`;

const ITENS_POR_PAGINA = 20;

// ── Status ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'outline'; cor: string }
> = {
  pendente: {
    label: 'Pendente',
    variant: 'default',
    cor: 'bg-amber-500/10 text-amber-600',
  },
  visualizada: {
    label: 'Visualizada',
    variant: 'secondary',
    cor: 'bg-sky-500/10 text-sky-600',
  },
  respondida: {
    label: 'Respondida',
    variant: 'outline',
    cor: 'bg-emerald-500/10 text-emerald-600',
  },
};

// ── Tipos ──────────────────────────────────────────────────────────────────

interface Triagem {
  id: string;
  dados: Record<string, unknown>;
  emailContato: string | null;
  telefoneContato: string | null;
  nomeContato: string | null;
  statusVisualizacao: string;
  medicoClerkId: string | null;
  createdAt: Date;
}

// ── LABEL MAP ──────────────────────────────────────────────────────────────

const LABEL_MAP: Record<string, string> = {
  // Chaves internas (formulário novo)
  nome_paciente: 'Nome completo do Paciente',
  cpf: 'CPF',
  data_nascimento: 'Data de nascimento',
  peso_altura: 'Peso e Altura',
  nome_responsavel: 'Nome do Responsável',
  cpf_responsavel: 'CPF do Responsável',
  email: 'E-mail',
  telefone: 'Telefone / WhatsApp',
  cep: 'CEP',
  estado: 'Estado',
  endereco: 'Endereço completo',
  como_chegou: 'Como chegou até nós',
  diagnostico_principal: 'Diagnóstico principal',
  nivel_tratamento: 'Nível de tratamento',
  historico_tratamentos: 'Histórico de tratamentos',
  medicamentos_atuais: 'Medicamentos atuais',
  relatorio_medico_nome: 'Relatório médico',
  total_residencia: 'Pessoas na residência',
  num_criancas: 'Crianças (0-17)',
  num_idosos: 'Idosos (60+)',
  num_deficiencia: 'Pessoas com deficiência',
  responsavel_financeiro: 'Responsável financeiro',
  responsavel_financeiro_quem: 'Quem é o responsável',
  renda_total: 'Renda mensal familiar',
  fontes_renda: 'Fontes de renda',
  situacao_trabalho: 'Situação de trabalho',
  profissao: 'Profissão',
  tempo_desempregado: 'Tempo desempregado',
  programas_sociais: 'Programas sociais',
  convenio_medico: 'Convênio médico',
  convenio_qual: 'Qual convênio',
  condicao_moradia: 'Condições de moradia',
  despesas_medicas: 'Despesas médicas mensais',
  // Chaves vindas dos CSVs Elementor (importação histórica)
  'Nome do paciente': 'Nome do Paciente',
  'Nome completo do Paciente:': 'Nome Completo',
  'CPF:': 'CPF',
  'Data de nascimento:': 'Data de Nascimento',
  'Peso e Altura do Paciente': 'Peso e Altura',
  'Nome Completo do Responsável:': 'Nome do Responsável',
  'CPF do Responsável:': 'CPF do Responsável',
  'E-mail': 'E-mail',
  'E-mail:': 'E-mail',
  'Telefone para contato com DDD': 'Telefone',
  'Telefone:': 'Telefone',
  'CEP:': 'CEP',
  'Endereço completo: ': 'Endereço',
  'Endereço completo': 'Endereço',
  'Estado:': 'Estado',
  'Cidade:': 'Cidade',
  'Como chegou até nós ?': 'Como nos encontrou',
  'Diagnóstico principal: ': 'Diagnóstico Principal',
  Patologia: 'Patologia / Diagnóstico',
  'Patologia do paciente': 'Patologia / Diagnóstico',
  'Tratamento:': 'Nível de Urgência',
  'Histórico de tratamentos anteriores:': 'Histórico de Tratamentos',
  'Medicamentos atuais:': 'Medicamentos Atuais',
  'Relatório médico ou prescrição:': 'Relatório / Prescrição',
  'Número total de pessoas na residência:': 'Pessoas na Residência',
  'Número de crianças (0-17anos)': 'Crianças (0-17)',
  'Número de idosos (60+ anos)': 'Idosos (60+)',
  'Número de pessoas com deficiência ': 'Pessoas c/ Deficiência',
  'Você é o principal responsavel financeiro ?': 'Responsável Financeiro',
  'Se não, quem seria ?': 'Quem é o Responsável',
  'Renda total mensal da família:': 'Renda Familiar',
  'Renda Familiar Bruta': 'Renda Familiar',
  'Principais fontes de renda familiar:': 'Fontes de Renda',
  'Sua situação atual de trabalho:': 'Situação de Trabalho',
  'Profissão:': 'Profissão',
  'Se desempregado, há quanto tempo ?': 'Tempo Desempregado',
  'Pariticipa de programas sociais ?': 'Programas Sociais',
  'Recebe algum benefício? ': 'Benefícios Sociais',
  'Possuí convênio médico?': 'Convênio Médico',
  'Possui plano de saúde? Se sim, qual?': 'Plano de Saúde',
  'Se sim, qual?': 'Qual Convênio',
  'Condições de Moradia': 'Condições de Moradia',
  'Despesas médicas mensais atuais': 'Despesas Médicas Mensais',
  'Você já possui receita médica para o canabidiol?': 'Possui Receita Médica',
  ' Se possui, pode nos encaminhar?': 'URL da Receita Médica',
  'Já fez uso de medicamentos derivados de Canabidiol ?': 'Já usou Canabidiol',
  'Se sim, de qual medicamento fez uso?': 'Qual Medicamento CBD',
  'Como conheceu a Behemp?': 'Como nos conheceu',
  'Nome do responsável': 'Nome do Responsável',
  'Grau de parentesco': 'Grau de Parentesco',
  'Peso em Kilos': 'Peso (kg)',
  'Altura em Cm': 'Altura (cm)',
  'Quantas pessoas residem na casa?': 'Pessoas na Residência',
  'Caso se sinta a vontade, nos conte um pouco sobre sua história pessoal e familiar':
    'História Pessoal e Familiar',
  'Relate o seu caso': 'Relato do Caso',
  CUPOM: 'Cupom',
  _formulario: 'Formulário de Origem',
  _origem: 'Origem dos Dados',
  _ip_origem: 'IP de Origem',
  _referencia: 'URL de Referência',
  id_envio_elementor: 'ID Elementor',
};

// ── Seções do modal ────────────────────────────────────────────────────────

interface Secao {
  titulo: string;
  icon: typeof User;
  campos: string[];
  cor: string;
}

const SECOES: Secao[] = [
  {
    titulo: 'Dados Pessoais',
    icon: User,
    cor: 'text-primary bg-primary/10',
    campos: [
      'nome_paciente',
      'cpf',
      'data_nascimento',
      'peso_altura',
      'nome_responsavel',
      'cpf_responsavel',
      'email',
      'telefone',
      'cep',
      'estado',
      'endereco',
      'como_chegou',
    ],
  },
  {
    titulo: 'Informações Clínicas',
    icon: Stethoscope,
    cor: 'text-rose-600 bg-rose-500/10',
    campos: [
      'diagnostico_principal',
      'nivel_tratamento',
      'historico_tratamentos',
      'medicamentos_atuais',
      'relatorio_medico_nome',
    ],
  },
  {
    titulo: 'Composição Familiar',
    icon: Home,
    cor: 'text-violet-600 bg-violet-500/10',
    campos: [
      'total_residencia',
      'num_criancas',
      'num_idosos',
      'num_deficiencia',
      'responsavel_financeiro',
      'responsavel_financeiro_quem',
    ],
  },
  {
    titulo: 'Situação Financeira',
    icon: DollarSign,
    cor: 'text-emerald-600 bg-emerald-500/10',
    campos: [
      'renda_total',
      'fontes_renda',
      'situacao_trabalho',
      'profissao',
      'tempo_desempregado',
      'programas_sociais',
    ],
  },
  {
    titulo: 'Moradia e Saúde',
    icon: HeartCrack,
    cor: 'text-sky-600 bg-sky-500/10',
    campos: ['convenio_medico', 'convenio_qual', 'condicao_moradia', 'despesas_medicas'],
  },
];

// ── Campos ocultos no fallback ─────────────────────────────────────────────

const CAMPOS_INTERNOS = new Set([
  '_formulario',
  '_origem',
  '_ip_origem',
  '_referencia',
  'id_envio_elementor',
  'relatorio_medico_arquivo',
]);

// ── Sub-componentes ────────────────────────────────────────────────────────

function CampoDetalhe({ label, valor }: { label: string; valor: string }) {
  if (!valor || valor === 'undefined' || valor === 'on') return null;
  const isLongo = valor.length > 80;
  return (
    <div
      className={cn(
        'group rounded-xl bg-muted/40 p-3.5 transition-colors hover:bg-muted/70',
        isLongo ? 'col-span-full' : '',
      )}
    >
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/70">
        {label}
      </p>
      <p
        className={cn(
          'text-sm font-medium leading-relaxed text-foreground',
          isLongo && 'whitespace-pre-wrap',
        )}
      >
        {valor}
      </p>
    </div>
  );
}

// ── Modal de confirmação de exclusão ──────────────────────────────────────

function ModalConfirmarExclusao({
  triagem,
  onConfirmar,
  onCancelar,
  carregando,
}: {
  triagem: Triagem;
  onConfirmar: () => void;
  onCancelar: () => void;
  carregando: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
        <div className="overflow-hidden rounded-2xl bg-card shadow-2xl">
          <div className="flex flex-col items-center px-6 pb-6 pt-8 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle size={26} className="text-red-600" />
            </div>
            <h3 className="mb-1 text-lg font-bold">Excluir triagem?</h3>
            <p className="text-sm text-muted-foreground">
              A triagem de{' '}
              <span className="font-semibold text-foreground">
                {triagem.nomeContato || 'Paciente sem nome'}
              </span>{' '}
              será excluída permanentemente. Esta ação não pode ser desfeita.
            </p>
          </div>
          <div className="flex gap-3 border-t px-6 py-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onCancelar}
              disabled={carregando}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1 gap-2 bg-red-600 text-white hover:bg-red-700"
              onClick={onConfirmar}
              disabled={carregando}
            >
              {carregando ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Trash2 size={15} />
              )}
              Excluir
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ────────────────────────────────────────────────────

export default function TriagensAdminPage() {
  const [todasTriagens, setTodasTriagens] = useState<Triagem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [triagemSelecionada, setTriagemSelecionada] = useState<Triagem | null>(null);
  const [triagemParaExcluir, setTriagemParaExcluir] = useState<Triagem | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  // Filtros
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [filtroOrigem, setFiltroOrigem] = useState<string>('todos');

  // Paginação
  const [paginaAtual, setPaginaAtual] = useState(1);

  useEffect(() => {
    carregarTriagens();
  }, []);

  // Resetar página ao mudar filtros
  useEffect(() => {
    setPaginaAtual(1);
  }, [busca, filtroStatus, filtroOrigem]);

  async function carregarTriagens() {
    setCarregando(true);
    const resultado = await listarTriagens();
    if (resultado.sucesso && resultado.dados) {
      setTodasTriagens(resultado.dados as Triagem[]);
    }
    setCarregando(false);
  }

  // ── Filtros aplicados ────────────────────────────────────────

  const triagensFiltradas = useMemo(() => {
    return todasTriagens.filter((t) => {
      // Busca textual
      if (busca.trim()) {
        const q = busca.toLowerCase();
        const nome = (t.nomeContato ?? '').toLowerCase();
        const email = (t.emailContato ?? '').toLowerCase();
        const tel = (t.telefoneContato ?? '').toLowerCase();
        const dados = JSON.stringify(t.dados).toLowerCase();
        if (!nome.includes(q) && !email.includes(q) && !tel.includes(q) && !dados.includes(q)) {
          return false;
        }
      }

      // Status
      if (filtroStatus !== 'todos' && t.statusVisualizacao !== filtroStatus) {
        return false;
      }

      // Origem
      if (filtroOrigem !== 'todos') {
        const formulario = (t.dados as Record<string, string>)['_formulario'] ?? '';
        if (filtroOrigem === 'importado' && !formulario) return false;
        if (filtroOrigem === 'novo' && formulario) return false;
      }

      return true;
    });
  }, [todasTriagens, busca, filtroStatus, filtroOrigem]);

  // ── Paginação ────────────────────────────────────────────────

  const totalPaginas = Math.max(1, Math.ceil(triagensFiltradas.length / ITENS_POR_PAGINA));
  const paginaSegura = Math.min(paginaAtual, totalPaginas);

  const triagensPagina = useMemo(() => {
    const inicio = (paginaSegura - 1) * ITENS_POR_PAGINA;
    return triagensFiltradas.slice(inicio, inicio + ITENS_POR_PAGINA);
  }, [triagensFiltradas, paginaSegura]);

  // ── Ações ────────────────────────────────────────────────────

  async function handleVisualizarTriagem(triagem: Triagem) {
    setTriagemSelecionada(triagem);
    if (triagem.statusVisualizacao === 'pendente') {
      await atualizarStatusTriagem(triagem.id, 'visualizada');
      setTodasTriagens((prev) =>
        prev.map((t) =>
          t.id === triagem.id ? { ...t, statusVisualizacao: 'visualizada' } : t,
        ),
      );
    }
  }

  async function handleMarcarRespondida(triagemId: string) {
    const resultado = await atualizarStatusTriagem(triagemId, 'respondida');
    if (resultado.sucesso) {
      setTodasTriagens((prev) =>
        prev.map((t) =>
          t.id === triagemId ? { ...t, statusVisualizacao: 'respondida' } : t,
        ),
      );
      setTriagemSelecionada(null);
      toast.success('Triagem marcada como respondida');
    }
  }

  async function handleConfirmarExclusao() {
    if (!triagemParaExcluir) return;
    setExcluindo(true);
    const resultado = await excluirTriagem(triagemParaExcluir.id);
    setExcluindo(false);

    if (resultado.sucesso) {
      setTodasTriagens((prev) => prev.filter((t) => t.id !== triagemParaExcluir.id));
      setTriagemParaExcluir(null);
      if (triagemSelecionada?.id === triagemParaExcluir.id) {
        setTriagemSelecionada(null);
      }
      toast.success('Triagem excluída com sucesso');
    } else {
      toast.error(resultado.erro ?? 'Erro ao excluir triagem');
    }
  }

  function handleDownloadDocumento(triagem: Triagem) {
    const dados = triagem.dados as Record<string, string>;
    const base64 = dados['relatorio_medico_arquivo'];
    const nomeArquivo = dados['relatorio_medico_nome'] || 'relatorio.pdf';
    if (!base64) return;
    const link = document.createElement('a');
    link.href = base64;
    link.download = nomeArquivo;
    link.click();
  }

  // ── Contadores ───────────────────────────────────────────────

  const pendentes = todasTriagens.filter((t) => t.statusVisualizacao === 'pendente').length;

  // ── Loading ──────────────────────────────────────────────────

  if (carregando) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Triagens</h1>
        <p className="text-sm text-muted-foreground">
          {todasTriagens.length} triagem{todasTriagens.length !== 1 ? 'ns' : ''} recebida
          {todasTriagens.length !== 1 ? 's' : ''}
          {pendentes > 0 && (
            <span className="ml-1 font-semibold text-amber-600">
              · {pendentes} pendente{pendentes > 1 ? 's' : ''}
            </span>
          )}
        </p>
      </div>

      {/* ── Barra de filtros ────────────────────────────────── */}
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center">
        {/* Busca */}
        <div className="relative flex-1">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="busca-triagens"
            placeholder="Buscar por nome, e-mail, telefone..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9 text-sm"
          />
          {busca && (
            <button
              onClick={() => setBusca('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filtro status */}
        <div className="flex items-center gap-1.5">
          <Filter size={14} className="shrink-0 text-muted-foreground" />
          <div className="flex flex-wrap gap-1.5">
            {[
              { value: 'todos', label: 'Todos' },
              { value: 'pendente', label: 'Pendentes' },
              { value: 'visualizada', label: 'Visualizadas' },
              { value: 'respondida', label: 'Respondidas' },
            ].map((op) => (
              <button
                key={op.value}
                id={`filtro-status-${op.value}`}
                onClick={() => setFiltroStatus(op.value)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                  filtroStatus === op.value
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80',
                )}
              >
                {op.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filtro origem */}
        <div className="flex flex-wrap gap-1.5">
          {[
            { value: 'todos', label: 'Todas origens' },
            { value: 'importado', label: 'Elementor' },
            { value: 'novo', label: 'Formulário novo' },
          ].map((op) => (
            <button
              key={op.value}
              id={`filtro-origem-${op.value}`}
              onClick={() => setFiltroOrigem(op.value)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                filtroOrigem === op.value
                  ? 'bg-foreground text-background shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80',
              )}
            >
              {op.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Resultado da busca ───────────────────────────────── */}
      {(busca || filtroStatus !== 'todos' || filtroOrigem !== 'todos') && (
        <p className="text-sm text-muted-foreground">
          {triagensFiltradas.length} resultado
          {triagensFiltradas.length !== 1 ? 's' : ''} encontrado
          {triagensFiltradas.length !== 1 ? 's' : ''}
          {busca && (
            <>
              {' '}
              para{' '}
              <span className="font-semibold text-foreground">&ldquo;{busca}&rdquo;</span>
            </>
          )}
        </p>
      )}

      {/* ── Lista ────────────────────────────────────────────── */}
      {triagensFiltradas.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileCheck size={48} className="mb-4 text-muted-foreground/30" />
            <p className="text-lg font-medium">Nenhuma triagem encontrada</p>
            <p className="text-sm text-muted-foreground">
              {busca || filtroStatus !== 'todos'
                ? 'Tente ajustar os filtros de busca.'
                : 'Quando alguém preencher o formulário de triagem, os dados aparecerão aqui.'}
            </p>
            {(busca || filtroStatus !== 'todos' || filtroOrigem !== 'todos') && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setBusca('');
                  setFiltroStatus('todos');
                  setFiltroOrigem('todos');
                }}
              >
                Limpar filtros
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-2">
            {triagensPagina.map((triagem) => {
              const config = STATUS_CONFIG[triagem.statusVisualizacao] || STATUS_CONFIG.pendente;
              const formulario =
                (triagem.dados as Record<string, string>)['_formulario'] ?? '';
              return (
                <Card
                  key={triagem.id}
                  className={cn(
                    'group border-0 shadow-sm transition-all hover:shadow-md',
                    triagem.statusVisualizacao === 'pendente' && 'ring-1 ring-primary/20',
                  )}
                >
                  <CardContent className="flex items-center gap-4 p-4">
                    {/* Ícone */}
                    <div
                      className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-primary/10"
                      onClick={() => handleVisualizarTriagem(triagem)}
                    >
                      <FileCheck size={20} className="text-primary" />
                    </div>

                    {/* Info principal */}
                    <div
                      className="min-w-0 flex-1 cursor-pointer"
                      onClick={() => handleVisualizarTriagem(triagem)}
                    >
                      <p className="font-medium">{triagem.nomeContato || 'Sem nome'}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {triagem.emailContato || triagem.telefoneContato || 'Sem contato'}
                      </p>
                    </div>

                    {/* Meta */}
                    <div className="hidden items-center gap-3 sm:flex">
                      {formulario && (
                        <Badge className="border-0 bg-violet-500/10 text-[11px] font-medium text-violet-600">
                          Elementor
                        </Badge>
                      )}
                      {triagem.medicoClerkId && (
                        <Badge className="border-0 bg-indigo-500/10 font-medium text-indigo-600">
                          <Stethoscope size={12} className="mr-1" />
                          Via médico
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(triagem.createdAt).toLocaleDateString('pt-BR')}
                      </span>
                      <Badge className={cn('border-0 font-medium', config.cor)}>
                        {config.label}
                      </Badge>
                    </div>

                    {/* Ações */}
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleVisualizarTriagem(triagem)}
                        title="Ver detalhes"
                      >
                        <Eye size={17} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTriagemParaExcluir(triagem);
                        }}
                        title="Excluir triagem"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* ── Paginação ─────────────────────────────────── */}
          {totalPaginas > 1 && (
            <div className="flex items-center justify-between rounded-xl border bg-card px-4 py-3 shadow-sm">
              <p className="text-sm text-muted-foreground">
                Página{' '}
                <span className="font-semibold text-foreground">{paginaSegura}</span>{' '}
                de{' '}
                <span className="font-semibold text-foreground">{totalPaginas}</span>
                {' · '}
                {triagensFiltradas.length} triagens
              </p>

              <div className="flex items-center gap-1">
                {/* Primeira página */}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={paginaSegura === 1}
                  onClick={() => setPaginaAtual(1)}
                  className="hidden h-8 px-2 sm:flex"
                >
                  <span className="text-xs">Primeira</span>
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={paginaSegura === 1}
                  onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={15} />
                </Button>

                {/* Números de página */}
                {Array.from({ length: Math.min(5, totalPaginas) }, (_, i) => {
                  let pagina: number;
                  if (totalPaginas <= 5) {
                    pagina = i + 1;
                  } else if (paginaSegura <= 3) {
                    pagina = i + 1;
                  } else if (paginaSegura >= totalPaginas - 2) {
                    pagina = totalPaginas - 4 + i;
                  } else {
                    pagina = paginaSegura - 2 + i;
                  }
                  return (
                    <Button
                      key={pagina}
                      variant={pagina === paginaSegura ? 'default' : 'outline'}
                      size="icon"
                      className="h-8 w-8 text-xs"
                      onClick={() => setPaginaAtual(pagina)}
                    >
                      {pagina}
                    </Button>
                  );
                })}

                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={paginaSegura === totalPaginas}
                  onClick={() => setPaginaAtual((p) => Math.min(totalPaginas, p + 1))}
                >
                  <ChevronRight size={15} />
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={paginaSegura === totalPaginas}
                  onClick={() => setPaginaAtual(totalPaginas)}
                  className="hidden h-8 px-2 sm:flex"
                >
                  <span className="text-xs">Última</span>
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* ══ Modal de detalhes ═════════════════════════════════════ */}
      {/* ══════════════════════════════════════════════════════════ */}
      {triagemSelecionada && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pb-8 pt-8 backdrop-blur-sm sm:items-center sm:pt-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setTriagemSelecionada(null);
          }}
        >
          <div className="relative w-full max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="overflow-hidden rounded-xl bg-card shadow-2xl">
              {/* ── Hero Header ─────────────────────────── */}
              <div className="relative overflow-hidden bg-gradient-to-br from-primary/90 via-primary to-primary/80 px-6 pt-6 pb-4 text-white sm:px-8">
                <div
                  className="absolute inset-0 opacity-[0.06]"
                  style={{
                    backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
                    backgroundSize: '24px 24px',
                  }}
                />
                <div className="relative flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <Badge
                        className={cn(
                          'border-0 px-2.5 py-0.5 text-[11px] font-semibold',
                          triagemSelecionada.statusVisualizacao === 'pendente' &&
                            'bg-amber-400/20 text-amber-100',
                          triagemSelecionada.statusVisualizacao === 'visualizada' &&
                            'bg-white/20 text-white',
                          triagemSelecionada.statusVisualizacao === 'respondida' &&
                            'bg-emerald-400/20 text-emerald-100',
                        )}
                      >
                        {STATUS_CONFIG[triagemSelecionada.statusVisualizacao]?.label ||
                          'Pendente'}
                      </Badge>
                      {(triagemSelecionada.dados as Record<string, string>)['_formulario'] && (
                        <Badge className="border-0 bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold text-white/90">
                          Importado · Elementor
                        </Badge>
                      )}
                    </div>

                    <h2 className="text-2xl font-bold leading-tight sm:text-3xl">
                      {triagemSelecionada.nomeContato || 'Paciente sem nome'}
                    </h2>

                    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/80">
                      {triagemSelecionada.emailContato && (
                        <span className="flex items-center gap-1.5">
                          <Mail size={14} />
                          {triagemSelecionada.emailContato}
                        </span>
                      )}
                      {triagemSelecionada.telefoneContato && (
                        <span className="flex items-center gap-1.5">
                          <Phone size={14} />
                          {triagemSelecionada.telefoneContato}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5">
                        <Calendar size={14} />
                        {new Date(triagemSelecionada.createdAt).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => setTriagemSelecionada(null)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Quick stats */}
                {(() => {
                  const dados = triagemSelecionada.dados as Record<string, string>;
                  const diagnostico =
                    dados.diagnostico_principal ||
                    dados['Diagnóstico principal: '] ||
                    dados['Patologia do paciente'] ||
                    dados['Patologia'] ||
                    '';
                  const urgencia = dados.nivel_tratamento || dados['Tratamento:'] || '';
                  const estadoPaciente =
                    dados.estado || dados['Estado:'] || dados['Estado'] || '';
                  const moradia = dados.condicao_moradia || dados['Condições de Moradia'] || '';
                  const stats = [
                    { label: 'Diagnóstico', valor: diagnostico },
                    { label: 'Urgência', valor: urgencia },
                    { label: 'Estado', valor: estadoPaciente },
                    { label: 'Moradia', valor: moradia },
                  ].filter((s) => s.valor);

                  if (stats.length === 0) return null;
                  return (
                    <div className="relative mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {stats.map((stat) => (
                        <div
                          key={stat.label}
                          className="rounded-lg bg-white/10 px-3 py-2.5 backdrop-blur-sm"
                        >
                          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/60">
                            {stat.label}
                          </p>
                          <p className="mt-0.5 text-sm font-semibold text-white">{stat.valor}</p>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* ── Corpo — Seções agrupadas ────────────── */}
              <div
                className="max-h-[55vh] overflow-y-auto px-6 pb-6 sm:px-8"
                style={{ marginTop: 0, paddingTop: 0 }}
              >
                {(() => {
                  const dados = triagemSelecionada.dados as Record<string, string>;
                  let primeiraVisivel = true;
                  return SECOES.map((secao) => {
                    const camposVisiveis = secao.campos.filter(
                      (campo) => dados[campo] && dados[campo] !== 'undefined',
                    );
                    if (camposVisiveis.length === 0) return null;
                    const ehPrimeira = primeiraVisivel;
                    primeiraVisivel = false;
                    return (
                      <Fragment key={secao.titulo}>
                        <div
                          className={cn(
                            'flex items-center gap-3 pb-3',
                            ehPrimeira ? 'pt-3' : 'pt-4',
                          )}
                        >
                          <div
                            className={cn(
                              'flex h-8 w-8 items-center justify-center rounded-lg',
                              secao.cor,
                            )}
                          >
                            {(() => {
                              const DynIcon = secao.icon;
                              return <DynIcon size={16} />;
                            })()}
                          </div>
                          <h3 className="text-sm font-bold tracking-tight">{secao.titulo}</h3>
                        </div>
                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                          {camposVisiveis.map((campo) => (
                            <CampoDetalhe
                              key={campo}
                              label={LABEL_MAP[campo] || campo.replace(/_/g, ' ')}
                              valor={String(dados[campo])}
                            />
                          ))}
                        </div>
                      </Fragment>
                    );
                  });
                })()}

                {/* Campos extras (fallback) */}
                {(() => {
                  const dados = triagemSelecionada.dados as Record<string, string>;
                  const camposMapeados = new Set(SECOES.flatMap((s) => s.campos));
                  const camposExtras = Object.keys(dados).filter(
                    (k) =>
                      !camposMapeados.has(k) &&
                      !CAMPOS_INTERNOS.has(k) &&
                      dados[k] &&
                      dados[k] !== 'undefined' &&
                      dados[k] !== 'on',
                  );
                  if (camposExtras.length === 0) return null;
                  return (
                    <>
                      <div className="flex items-center gap-3 pb-3 pt-4">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <FileCheck size={16} />
                        </div>
                        <h3 className="text-sm font-bold tracking-tight">
                          Outras Informações
                        </h3>
                      </div>
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        {camposExtras.map((campo) => (
                          <CampoDetalhe
                            key={campo}
                            label={LABEL_MAP[campo] || campo.replace(/_/g, ' ')}
                            valor={String(dados[campo])}
                          />
                        ))}
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* ── Footer ──────────────────────────────── */}
              <div className="flex flex-col gap-3 border-t px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
                <div className="flex flex-wrap gap-2">
                  {(triagemSelecionada.dados as Record<string, string>)[
                    'relatorio_medico_arquivo'
                  ] && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => handleDownloadDocumento(triagemSelecionada)}
                    >
                      <Download size={15} />
                      Baixar relatório médico
                    </Button>
                  )}
                  <a href={SHEETS_URL} target="_blank" rel="noopener noreferrer">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                    >
                      <FileSpreadsheet size={15} />
                      Ver na planilha
                    </Button>
                  </a>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => {
                      setTriagemParaExcluir(triagemSelecionada);
                      setTriagemSelecionada(null);
                    }}
                  >
                    <Trash2 size={15} />
                    Excluir triagem
                  </Button>
                </div>

                <div className="flex items-center gap-3 sm:ml-auto">
                  <Button variant="ghost" onClick={() => setTriagemSelecionada(null)}>
                    Fechar
                  </Button>
                  {triagemSelecionada.statusVisualizacao !== 'respondida' && (
                    <Button
                      onClick={() => handleMarcarRespondida(triagemSelecionada.id)}
                      className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      <CheckCircle2 size={16} />
                      Marcar como respondida
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* ══ Modal de confirmação de exclusão ══════════════════════ */}
      {/* ══════════════════════════════════════════════════════════ */}
      {triagemParaExcluir && (
        <ModalConfirmarExclusao
          triagem={triagemParaExcluir}
          onConfirmar={handleConfirmarExclusao}
          onCancelar={() => setTriagemParaExcluir(null)}
          carregando={excluindo}
        />
      )}
    </div>
  );
}
