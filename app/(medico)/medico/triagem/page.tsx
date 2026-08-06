'use client';

import { useState, useEffect, Fragment } from 'react';
import { useUser } from '@clerk/nextjs';
import { TriagemForm } from '@/components/shared/triagem-form';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  listarTriagensMedico,
  atualizarStatusTriagem,
} from '@/app/(public)/_actions/triagem';
import { cn } from '@/lib/utils';
import {
  Calendar,
  ClipboardList,
  DollarSign,
  Download,
  Eye,
  FileCheck,
  HeartCrack,
  Home,
  Loader2,
  Mail,
  Phone,
  Plus,
  Stethoscope,
  User,
  X,
} from 'lucide-react';

/* ── Tipos ────────────────────────────────────────────── */

interface Triagem {
  id: string;
  dados: Record<string, unknown>;
  emailContato: string | null;
  telefoneContato: string | null;
  nomeContato: string | null;
  statusVisualizacao: string;
  createdAt: Date;
}

/* ── Config de status ─────────────────────────────────── */

const STATUS_CONFIG: Record<
  string,
  { label: string; cor: string }
> = {
  pendente: { label: 'Pendente', cor: 'bg-amber-500/10 text-amber-600' },
  visualizada: { label: 'Visualizada', cor: 'bg-sky-500/10 text-sky-600' },
  respondida: { label: 'Respondida', cor: 'bg-emerald-500/10 text-emerald-600' },
};

/* ── Mapeamento de campos ────────────────────────────── */

const LABEL_MAP: Record<string, string> = {
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
};

/* ── Seções agrupadas ────────────────────────────────── */

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
      'nome_paciente', 'cpf', 'data_nascimento', 'peso_altura',
      'nome_responsavel', 'cpf_responsavel', 'email', 'telefone',
      'cep', 'estado', 'endereco', 'como_chegou',
    ],
  },
  {
    titulo: 'Informações Clínicas',
    icon: Stethoscope,
    cor: 'text-rose-600 bg-rose-500/10',
    campos: [
      'diagnostico_principal', 'nivel_tratamento',
      'historico_tratamentos', 'medicamentos_atuais', 'relatorio_medico_nome',
    ],
  },
  {
    titulo: 'Composição Familiar',
    icon: Home,
    cor: 'text-violet-600 bg-violet-500/10',
    campos: [
      'total_residencia', 'num_criancas', 'num_idosos', 'num_deficiencia',
      'responsavel_financeiro', 'responsavel_financeiro_quem',
    ],
  },
  {
    titulo: 'Situação Financeira',
    icon: DollarSign,
    cor: 'text-emerald-600 bg-emerald-500/10',
    campos: [
      'renda_total', 'fontes_renda', 'situacao_trabalho', 'profissao',
      'tempo_desempregado', 'programas_sociais',
    ],
  },
  {
    titulo: 'Moradia e Saúde',
    icon: HeartCrack,
    cor: 'text-sky-600 bg-sky-500/10',
    campos: [
      'convenio_medico', 'convenio_qual',
      'condicao_moradia', 'despesas_medicas',
    ],
  },
];

/* ── Campo detalhe ───────────────────────────────────── */

function CampoDetalhe({ label, valor }: { label: string; valor: string }) {
  if (!valor || valor === 'undefined') return null;

  const isMonetario = label.toLowerCase().includes('renda') || label.toLowerCase().includes('despesa');
  const valorFormatado = isMonetario && !String(valor).startsWith('R$')
    ? `R$ ${valor}`
    : valor;

  const isLongo = valor.length > 80;

  return (
    <div className={cn(
      'group rounded-xl bg-muted/40 p-3.5 transition-colors hover:bg-muted/70',
      isLongo ? 'col-span-full' : '',
    )}>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/70">
        {label}
      </p>
      <p className={cn(
        'text-sm font-medium leading-relaxed text-foreground',
        isLongo && 'whitespace-pre-wrap',
      )}>
        {valorFormatado}
      </p>
    </div>
  );
}

/* ── Componente principal ────────────────────────────── */

export default function MedicoTriagemPage() {
  const { user } = useUser();
  const [tab, setTab] = useState<'nova' | 'minhas'>('nova');
  const [triagens, setTriagens] = useState<Triagem[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [triagemSelecionada, setTriagemSelecionada] = useState<Triagem | null>(null);

  const clerkId = user?.id;

  /* Carrega triagens do médico ao abrir a aba "Minhas triagens" */
  useEffect(() => {
    if (tab === 'minhas' && clerkId) {
      carregarTriagens();
    }
  }, [tab, clerkId]);

  async function carregarTriagens() {
    setCarregando(true);
    const resultado = await listarTriagensMedico();
    if (resultado.sucesso && resultado.dados) {
      setTriagens(resultado.dados as Triagem[]);
    }
    setCarregando(false);
  }

  function handleTriagemSucesso() {
    // Após enviar com sucesso, troca para aba "Minhas triagens"
    setTimeout(() => {
      setTab('minhas');
    }, 2000);
  }

  async function handleVisualizarTriagem(triagem: Triagem) {
    setTriagemSelecionada(triagem);
    if (triagem.statusVisualizacao === 'pendente') {
      await atualizarStatusTriagem(triagem.id, 'visualizada');
      setTriagens((prev) =>
        prev.map((t) =>
          t.id === triagem.id ? { ...t, statusVisualizacao: 'visualizada' } : t,
        ),
      );
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

  const pendentes = triagens.filter((t) => t.statusVisualizacao === 'pendente').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Operação
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Triagem de <span className="text-accent-italic">Pacientes</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Registre novas triagens e acompanhe as que você enviou.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-xl bg-muted/50 p-1 w-fit">
        <button
          onClick={() => setTab('nova')}
          className={cn(
            'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all',
            tab === 'nova'
              ? 'bg-white text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Plus size={16} />
          Nova triagem
        </button>
        <button
          onClick={() => setTab('minhas')}
          className={cn(
            'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all',
            tab === 'minhas'
              ? 'bg-white text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <ClipboardList size={16} />
          Minhas triagens
          {pendentes > 0 && (
            <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-white">
              {pendentes}
            </span>
          )}
        </button>
      </div>

      {/* ── Tab: Nova triagem ────────────────────────── */}
      {tab === 'nova' && clerkId && (
        <TriagemForm
          medicoClerkId={clerkId}
          onSuccess={handleTriagemSucesso}
          compact
        />
      )}

      {/* ── Tab: Minhas triagens ─────────────────────── */}
      {tab === 'minhas' && (
        <div className="space-y-4">
          {/* Stats rápido */}
          <div className="flex items-center gap-4">
            <p className="text-sm text-muted-foreground">
              {triagens.length} triagem{triagens.length !== 1 ? 'ns' : ''} enviada{triagens.length !== 1 ? 's' : ''}
              {pendentes > 0 && ` · ${pendentes} pendente${pendentes > 1 ? 's' : ''}`}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={carregarTriagens}
              className="gap-1.5 text-xs"
            >
              <Loader2 size={14} className={carregando ? 'animate-spin' : ''}  />
              Atualizar
            </Button>
          </div>

          {/* Loading */}
          {carregando && triagens.length === 0 && (
            <div className="flex min-h-[30vh] items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          )}

          {/* Empty state */}
          {!carregando && triagens.length === 0 && (
            <Card className="border-0 shadow-sm">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <FileCheck size={48} className="mb-4 text-muted-foreground/30" />
                <p className="text-lg font-medium">Nenhuma triagem enviada</p>
                <p className="text-sm text-muted-foreground">
                  Suas triagens aparecerão aqui após envio.
                </p>
                <Button
                  className="mt-4 gap-2"
                  onClick={() => setTab('nova')}
                >
                  <Plus size={16} />
                  Criar primeira triagem
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Lista */}
          {triagens.length > 0 && (
            <div className="space-y-3">
              {triagens.map((triagem) => {
                const config = STATUS_CONFIG[triagem.statusVisualizacao] || STATUS_CONFIG.pendente;
                return (
                  <Card
                    key={triagem.id}
                    className={cn(
                      'cursor-pointer border-0 shadow-sm transition-all hover:shadow-md',
                      triagem.statusVisualizacao === 'pendente' && 'ring-1 ring-primary/20',
                    )}
                    onClick={() => handleVisualizarTriagem(triagem)}
                  >
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                        <FileCheck size={20} className="text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">
                          {triagem.nomeContato || 'Sem nome'}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">
                          {triagem.emailContato || triagem.telefoneContato || 'Sem contato'}
                        </p>
                      </div>
                      <div className="hidden items-center gap-3 sm:flex">
                        <span className="text-xs text-muted-foreground">
                          {new Date(triagem.createdAt).toLocaleDateString('pt-BR')}
                        </span>
                        <Badge className={cn('border-0 font-medium', config.cor)}>
                          {config.label}
                        </Badge>
                      </div>
                      <Button variant="ghost" size="icon">
                        <Eye size={18} />
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* ══ Modal de detalhes ═════════════════════════════════ */}
      {/* ═══════════════════════════════════════════════════════ */}
      {triagemSelecionada && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-8 pb-8 backdrop-blur-sm sm:items-center sm:pt-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setTriagemSelecionada(null);
          }}
        >
          <div className="relative w-full max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="overflow-hidden rounded-xl bg-card shadow-2xl">

              {/* ── Hero Header ─────────────────────────── */}
              <div className="relative overflow-hidden bg-gradient-to-br from-primary/90 via-primary to-primary/80 px-6 pt-6 pb-4 text-white sm:px-8">
                <div className="absolute inset-0 opacity-[0.06]" style={{
                  backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
                  backgroundSize: '24px 24px',
                }} />

                <div className="relative flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-3 flex items-center gap-2">
                      <Badge className={cn(
                        'border-0 px-2.5 py-0.5 text-[11px] font-semibold',
                        triagemSelecionada.statusVisualizacao === 'pendente' && 'bg-amber-400/20 text-amber-100',
                        triagemSelecionada.statusVisualizacao === 'visualizada' && 'bg-white/20 text-white',
                        triagemSelecionada.statusVisualizacao === 'respondida' && 'bg-emerald-400/20 text-emerald-100',
                      )}>
                        {STATUS_CONFIG[triagemSelecionada.statusVisualizacao]?.label || 'Pendente'}
                      </Badge>
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
                  const stats = [
                    { label: 'Diagnóstico', valor: dados.diagnostico_principal },
                    { label: 'Tratamento', valor: dados.nivel_tratamento },
                    { label: 'Estado', valor: dados.estado },
                    { label: 'Moradia', valor: dados.condicao_moradia },
                  ].filter((s) => s.valor);

                  if (stats.length === 0) return null;

                  return (
                    <div className="relative mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {stats.map((stat) => (
                        <div key={stat.label} className="rounded-lg bg-white/10 px-3 py-2.5 backdrop-blur-sm">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/60">{stat.label}</p>
                          <p className="mt-0.5 text-sm font-semibold text-white">{stat.valor}</p>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* ── Corpo — Seções agrupadas ────────────── */}
              <div className="max-h-[55vh] overflow-y-auto px-6 pb-6 sm:px-8" style={{ marginTop: 0, paddingTop: 0 }}>
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
                        <div className={cn('flex items-center gap-3 pb-3', ehPrimeira ? 'pt-3' : 'pt-4')}>
                          <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', secao.cor)}>
                            {(() => { const DynIcon = secao.icon; return <DynIcon size={16} />; })()}
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

                {/* Campos extras não mapeados */}
                {(() => {
                  const dados = triagemSelecionada.dados as Record<string, string>;
                  const camposMapeados = new Set(SECOES.flatMap((s) => s.campos));
                  const camposExtras = Object.keys(dados).filter(
                    (k) =>
                      !camposMapeados.has(k) &&
                      k !== 'relatorio_medico_arquivo' &&
                      dados[k] &&
                      dados[k] !== 'undefined',
                  );

                  if (camposExtras.length === 0) return null;

                  return (
                    <>
                      <div className="flex items-center gap-3 pb-3 pt-4">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <FileCheck size={16} />
                        </div>
                        <h3 className="text-sm font-bold tracking-tight">Outras Informações</h3>
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

              {/* ── Footer ────────────────────────────── */}
              <div className="flex flex-col gap-3 border-t px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
                <div className="flex flex-wrap gap-2">
                  {(triagemSelecionada.dados as Record<string, string>)['relatorio_medico_arquivo'] && (
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
                </div>

                <div className="flex items-center gap-3 sm:ml-auto">
                  <Button
                    variant="ghost"
                    onClick={() => setTriagemSelecionada(null)}
                  >
                    Fechar
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
