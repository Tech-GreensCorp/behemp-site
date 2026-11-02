'use client';

import { useState, useEffect, useMemo, Fragment } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  listarTriagens,
  atualizarStatusTriagem,
  excluirTriagem,
} from '@/app/(public)/_actions/triagem';
import { converterTriagemEmPaciente } from '@/app/_actions/converter-triagem';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/page-header';
import { DataList, DataRow, DataEmpty } from '@/components/shared/data-list';
import {
  AlertTriangle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Download,
  Eye,
  FileCheck,
  FileDown,
  Filter,
  HeartCrack,
  Home,
  Loader2,
  Mail,
  Phone,
  Search,
  Stethoscope,
  Trash2,
  User,
  UserPlus,
  X,
} from 'lucide-react';

const ITENS_POR_PAGINA = 20;

/**
 * Salva o blob pelo link de download. A URL só é liberada depois de um tempo: o navegador lê o
 * blob de forma assíncrona depois do clique, e revogar no mesmo tick pode cancelar o download
 * (Safari). 40 s é o prazo que o FileSaver.js usa.
 */
function salvarArquivo(blob: Blob, nomeArquivo: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 40_000);
}

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
  /** Calculado no servidor: e-mail bate com paciente de ficha ativa. */
  ehPaciente: boolean;
  /** O anexo não vem na listagem; sai sob demanda em `/api/triagens/[id]/relatorio`. */
  temRelatorio: boolean;
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

/** Idade a partir de `DD/MM/YYYY` (formulário novo) ou string ISO (importação legada). */
function calcularIdadeDaTriagem(dataNascimento: string | undefined): number | null {
  if (!dataNascimento) return null;
  const brMatch = dataNascimento.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const nascimento = brMatch
    ? new Date(Number(brMatch[3]), Number(brMatch[2]) - 1, Number(brMatch[1]))
    : new Date(dataNascimento);
  if (isNaN(nascimento.getTime())) return null;
  const hoje = new Date();
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const m = hoje.getMonth() - nascimento.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) idade--;
  return idade >= 0 && idade < 130 ? idade : null;
}

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
  const [convertendo, setConvertendo] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [baixandoRelatorio, setBaixandoRelatorio] = useState(false);

  // Filtros
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');

  // Paginação
  const [paginaAtual, setPaginaAtual] = useState(1);

  useEffect(() => {
    carregarTriagens();
  }, []);

  // Resetar página ao mudar filtros
  useEffect(() => {
    setPaginaAtual(1);
  }, [busca, filtroStatus]);

  // Trava o scroll da página por trás enquanto o modal está aberto — sem isto, o
  // body por trás também rola, e dá pra ver a lista se movendo por baixo do modal.
  useEffect(() => {
    if (!triagemSelecionada && !triagemParaExcluir) return;
    const overflowOriginal = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflowOriginal;
    };
  }, [triagemSelecionada, triagemParaExcluir]);

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

      // Lida = qualquer status diferente de `pendente` (visualizada ou respondida).
      if (filtroStatus === 'nao_lida' && t.statusVisualizacao !== 'pendente') return false;
      if (filtroStatus === 'lida' && t.statusVisualizacao === 'pendente') return false;

      return true;
    });
  }, [todasTriagens, busca, filtroStatus]);

  // ── Paginação ────────────────────────────────────────────────

  const totalPaginas = Math.max(1, Math.ceil(triagensFiltradas.length / ITENS_POR_PAGINA));
  const paginaSegura = Math.min(paginaAtual, totalPaginas);

  const triagensPagina = useMemo(() => {
    const inicio = (paginaSegura - 1) * ITENS_POR_PAGINA;
    return triagensFiltradas.slice(inicio, inicio + ITENS_POR_PAGINA);
  }, [triagensFiltradas, paginaSegura]);

  // ── Ações ────────────────────────────────────────────────────

  /** Abrir os detalhes É ler: a triagem pendente vira lida e o estado persiste no servidor. */
  async function handleVisualizarTriagem(triagem: Triagem) {
    setTriagemSelecionada(triagem);
    if (triagem.statusVisualizacao !== 'pendente') return;
    const resultado = await atualizarStatusTriagem(triagem.id, 'visualizada');
    // Só reflete na tela o que o servidor gravou: do contrário, o próximo reload a mostraria
    // como não lida de novo, e a tela teria dito que estava lida.
    if (!resultado.sucesso) return;
    const marcar = <T extends { id: string; statusVisualizacao: string }>(t: T): T =>
      t.id === triagem.id ? { ...t, statusVisualizacao: 'visualizada' } : t;
    setTodasTriagens((prev) => prev.map(marcar));
    setTriagemSelecionada((atual) => (atual ? marcar(atual) : atual));
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

  /**
   * Conversão em paciente, por ato do admin depois de analisar a triagem. A triagem NÃO é
   * alterada: ela passa a exibir "Paciente" porque o e-mail agora bate com uma ficha ativa.
   */
  async function handleConverterEmPaciente(triagem: Triagem) {
    setConvertendo(true);
    try {
      const r = await converterTriagemEmPaciente(triagem.id);
      if (!r.sucesso) {
        toast.error(r.erro);
        return;
      }
      if (r.dados.jaEraPaciente) {
        toast.info('Esta pessoa já é paciente. Nada foi criado.');
      } else {
        toast.success('Triagem convertida em paciente. A ficha está no topo da lista de Pacientes.', {
          description: r.dados.aviso
            ? r.dados.aviso
            : r.dados.boasVindasEnviadas
              ? 'E-mail de boas-vindas enviado para definir a senha.'
              : undefined,
        });
      }
      const emailAlvo = triagem.emailContato?.trim().toLowerCase();
      const virar = <T extends { emailContato: string | null; ehPaciente: boolean }>(t: T): T =>
        emailAlvo && t.emailContato?.trim().toLowerCase() === emailAlvo
          ? { ...t, ehPaciente: true }
          : t;
      setTodasTriagens((prev) => prev.map(virar));
      setTriagemSelecionada((atual) => (atual ? virar(atual) : atual));
    } catch {
      toast.error('Erro ao converter a triagem em paciente');
    } finally {
      setConvertendo(false);
    }
  }

  /** Baixa o relatório anexado — só admin, auditado (`/api/triagens/[id]/relatorio`). */
  async function handleDownloadDocumento(triagem: Triagem) {
    const dados = triagem.dados as Record<string, string>;
    const nomeArquivo = dados['relatorio_medico_nome'] || 'relatorio.pdf';
    // Travar o botão: cada clique baixa o arquivo inteiro, grava um "visualizou" e gasta o limite.
    setBaixandoRelatorio(true);
    try {
      const resposta = await fetch(`/api/triagens/${encodeURIComponent(triagem.id)}/relatorio`);
      if (!resposta.ok) {
        toast.error(
          resposta.status === 429
            ? 'Muitas tentativas. Aguarde um instante e tente de novo.'
            : 'Não foi possível baixar o relatório médico.',
        );
        return;
      }
      salvarArquivo(await resposta.blob(), nomeArquivo);
    } catch {
      toast.error('Não foi possível baixar o relatório médico.');
    } finally {
      setBaixandoRelatorio(false);
    }
  }

  /** Baixa a triagem em PDF — gerada no servidor, só para admin (`/api/triagens/[id]/ficha-pdf`). */
  async function handleBaixarFichaPdf(triagem: Triagem) {
    setGerandoPdf(true);
    try {
      const resposta = await fetch(`/api/triagens/${encodeURIComponent(triagem.id)}/ficha-pdf`);
      if (!resposta.ok) {
        toast.error(
          resposta.status === 429
            ? 'Muitas tentativas. Aguarde um instante e tente de novo.'
            : 'Não foi possível gerar o PDF da ficha.',
        );
        return;
      }
      // O nome do arquivo vem do servidor (nome do paciente, com acento em `filename*`).
      const cabecalho = resposta.headers.get('content-disposition') ?? '';
      const codificado = /filename\*=UTF-8''([^;]+)/i.exec(cabecalho)?.[1];
      let nomeArquivo = `${triagem.nomeContato || 'Paciente'}.pdf`;
      if (codificado) {
        try {
          nomeArquivo = decodeURIComponent(codificado);
        } catch {
          // Mantém o nome de reserva.
        }
      }
      salvarArquivo(await resposta.blob(), nomeArquivo);
    } catch {
      toast.error('Não foi possível gerar o PDF da ficha.');
    } finally {
      setGerandoPdf(false);
    }
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
      <PageHeader
        eyebrow="Controle"
        title="Triagens"
        description={
          <>
            {todasTriagens.length} {todasTriagens.length !== 1 ? 'triagens recebidas' : 'triagem recebida'}
            {pendentes > 0 && (
              <span className="ml-1 font-semibold text-amber-600">
                · {pendentes} não lida{pendentes > 1 ? 's' : ''}
              </span>
            )}
          </>
        }
      />

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
            placeholder="Buscar por nome, e-mail, telefone ou qualquer resposta..."
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
              { value: 'todos', label: 'Todas' },
              { value: 'nao_lida', label: 'Não lidas' },
              { value: 'lida', label: 'Lidas' },
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
      </div>

      {/* ── Resultado da busca ───────────────────────────────── */}
      {(busca || filtroStatus !== 'todos') && (
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
        <DataEmpty
          icon={<FileCheck size={24} />}
          title="Nenhuma triagem encontrada"
          description={
            busca || filtroStatus !== 'todos'
              ? 'Tente ajustar os filtros de busca.'
              : 'Quando alguém preencher o formulário de triagem, os dados aparecerão aqui.'
          }
          actions={
            (busca || filtroStatus !== 'todos') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setBusca('');
                  setFiltroStatus('todos');
                }}
              >
                Limpar filtros
              </Button>
            )
          }
        />
      ) : (
        <>
          <DataList>
            {triagensPagina.map((triagem) => {
              const naoLida = triagem.statusVisualizacao === 'pendente';
              const formulario =
                (triagem.dados as Record<string, string>)['_formulario'] ?? '';
              return (
                <DataRow
                  key={triagem.id}
                  className={cn('group', naoLida && 'bg-primary-soft/30')}
                  icon={
                    <div
                      className="relative flex h-full w-full cursor-pointer items-center justify-center"
                      onClick={() => handleVisualizarTriagem(triagem)}
                    >
                      <FileCheck
                        size={20}
                        className={naoLida ? 'text-primary' : 'text-muted-foreground/60'}
                      />
                      {naoLida && (
                        <span
                          className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary"
                          role="img"
                          aria-label="Não lida"
                        />
                      )}
                    </div>
                  }
                  title={
                    <div className="cursor-pointer" onClick={() => handleVisualizarTriagem(triagem)}>
                      <div className={cn('truncate text-sm', naoLida ? 'font-semibold' : 'font-medium text-foreground/80')}>
                        {triagem.nomeContato || 'Sem nome'}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {triagem.emailContato || triagem.telefoneContato || 'Sem contato'}
                      </div>
                    </div>
                  }
                  meta={
                    <div className="flex items-center gap-3">
                      {triagem.ehPaciente ? (
                        <Badge className="border-0 bg-emerald-500/10 text-[11px] font-medium text-emerald-700">
                          Paciente
                        </Badge>
                      ) : (
                        <Badge className="border-0 bg-muted text-[11px] font-medium text-muted-foreground">
                          Não paciente
                        </Badge>
                      )}
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
                      <span>{new Date(triagem.createdAt).toLocaleDateString('pt-BR')}</span>
                    </div>
                  }
                  trailing={
                    <>
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
                        onClick={() => setTriagemParaExcluir(triagem)}
                        title="Excluir triagem"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </>
                  }
                />
              );
            })}
          </DataList>

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
          className="fixed inset-0 z-50 flex items-center justify-center overscroll-contain bg-black/50 p-3 backdrop-blur-sm sm:p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) setTriagemSelecionada(null);
          }}
        >
          {/* Coluna flex com altura limitada à tela: cabeçalho e rodapé fixos, só o corpo rola. */}
          <div className="relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-300 sm:max-h-[calc(100dvh-3rem)]">
            <div className="flex min-h-0 w-full flex-col overflow-hidden rounded-xl bg-card shadow-2xl">
              {/* ── Header ──────────────────────────────── */}
              <div className="relative shrink-0 border-b px-5 pt-5 pb-4 sm:px-8 sm:pt-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {(triagemSelecionada.dados as Record<string, string>)['_formulario'] && (
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <Badge className="border-0 bg-violet-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-violet-600">
                          Importado · Elementor
                        </Badge>
                      </div>
                    )}

                    <h2 className="break-words text-xl font-bold leading-tight sm:text-3xl">
                      {triagemSelecionada.nomeContato || 'Paciente sem nome'}
                    </h2>

                    {(() => {
                      const dados = triagemSelecionada.dados as Record<string, string>;
                      const idade = calcularIdadeDaTriagem(
                        dados.data_nascimento || dados['Data de nascimento:'],
                      );
                      const patologia =
                        dados.diagnostico_principal ||
                        dados['Diagnóstico principal: '] ||
                        dados['Patologia do paciente'] ||
                        dados['Patologia'] ||
                        '';
                      return (
                        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
                          {triagemSelecionada.emailContato && (
                            <a
                              href={`mailto:${triagemSelecionada.emailContato}`}
                              className="flex items-center gap-1.5 transition-colors hover:text-primary"
                              title="Enviar e-mail"
                            >
                              <Mail size={14} />
                              {triagemSelecionada.emailContato}
                            </a>
                          )}
                          {triagemSelecionada.telefoneContato && (
                            <a
                              href={`https://wa.me/55${triagemSelecionada.telefoneContato.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 transition-colors hover:text-primary"
                              title="Falar no WhatsApp"
                            >
                              <Phone size={14} />
                              {triagemSelecionada.telefoneContato}
                            </a>
                          )}
                          {idade !== null && (
                            <span className="flex items-center gap-1.5">
                              <User size={14} />
                              {idade} anos
                            </span>
                          )}
                          {patologia && (
                            <span
                              className="flex min-w-0 max-w-[220px] items-center gap-1.5 sm:max-w-[320px]"
                              title={patologia}
                            >
                              <Stethoscope size={14} className="shrink-0" />
                              <span className="truncate">{patologia}</span>
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
                      );
                    })()}
                  </div>

                  <button
                    onClick={() => setTriagemSelecionada(null)}
                    aria-label="Fechar detalhes"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
                        <div key={stat.label} className="rounded-lg bg-muted/40 px-3 py-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/70">
                            {stat.label}
                          </p>
                          <p className="mt-0.5 text-sm font-semibold text-foreground">
                            {stat.valor}
                          </p>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* ── Corpo — Seções agrupadas ────────────── */}
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 sm:px-8">
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
              <div className="flex shrink-0 flex-col gap-3 border-t bg-card px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
                <div className="flex flex-wrap gap-2">
                  {triagemSelecionada.temRelatorio && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      disabled={baixandoRelatorio}
                      onClick={() => handleDownloadDocumento(triagemSelecionada)}
                    >
                      {baixandoRelatorio ? (
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        <Download size={15} />
                      )}
                      {baixandoRelatorio ? 'Baixando…' : 'Baixar relatório médico'}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    disabled={gerandoPdf}
                    onClick={() => handleBaixarFichaPdf(triagemSelecionada)}
                  >
                    {gerandoPdf ? (
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <FileDown size={15} />
                    )}
                    {gerandoPdf ? 'Gerando PDF…' : 'Baixar ficha completa em PDF'}
                  </Button>
                </div>

                {triagemSelecionada.ehPaciente ? (
                  <span className="text-xs font-medium text-emerald-700 sm:ml-auto">
                    Já é paciente
                  </span>
                ) : (
                  <Button
                    size="sm"
                    className="gap-2 sm:ml-auto"
                    disabled={convertendo}
                    onClick={() => handleConverterEmPaciente(triagemSelecionada)}
                    title="Cria a ficha de paciente, a conta de acesso e envia o e-mail para definir a senha"
                  >
                    {convertendo ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <UserPlus size={15} />
                    )}
                    {convertendo ? 'Convertendo…' : 'Converter em paciente'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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
