'use client';

import { useState, useEffect, Fragment } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  FileValidationIcon,
  ViewIcon,
  Cancel01Icon,
  CheckmarkCircle01Icon,
  UserIcon,
  Stethoscope02Icon,
  Home01Icon,
  Money01Icon,
  HeartbreakIcon,
  CallIcon,
  Mail01Icon,
  Calendar01Icon,
  Download01Icon,
  GoogleSheetIcon,
} from '@hugeicons/core-free-icons';
import { listarTriagens, atualizarStatusTriagem } from '@/app/(public)/_actions/triagem';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

/** URL da planilha Google Sheets centralizada */
const SHEETS_URL = `https://docs.google.com/spreadsheets/d/${process.env.NEXT_PUBLIC_SHEETS_SPREADSHEET_ID || '1hchr4CFjtHmVYGrRyBjp7H7RbBM0PWRMeuBWWhQjmJ8'}/edit`;

/**
 * Página de triagens do admin com modal de detalhe premium.
 * Puxa dados reais do banco via Server Action.
 */

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline'; cor: string }> = {
  pendente: { label: 'Pendente', variant: 'default', cor: 'bg-amber-500/10 text-amber-600' },
  visualizada: { label: 'Visualizada', variant: 'secondary', cor: 'bg-sky-500/10 text-sky-600' },
  respondida: { label: 'Respondida', variant: 'outline', cor: 'bg-emerald-500/10 text-emerald-600' },
};

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

/* ── Mapeamento de campos para labels legíveis ─────── */

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

/* ── Agrupamento de seções com ícones ─────────────── */

interface Secao {
  titulo: string;
  icon: typeof UserIcon;
  campos: string[];
  cor: string;
}

const SECOES: Secao[] = [
  {
    titulo: 'Dados Pessoais',
    icon: UserIcon,
    cor: 'text-primary bg-primary/10',
    campos: [
      'nome_paciente', 'cpf', 'data_nascimento', 'peso_altura',
      'nome_responsavel', 'cpf_responsavel', 'email', 'telefone',
      'cep', 'estado', 'endereco', 'como_chegou',
    ],
  },
  {
    titulo: 'Informações Clínicas',
    icon: Stethoscope02Icon,
    cor: 'text-rose-600 bg-rose-500/10',
    campos: [
      'diagnostico_principal', 'nivel_tratamento',
      'historico_tratamentos', 'medicamentos_atuais', 'relatorio_medico_nome',
    ],
  },
  {
    titulo: 'Composição Familiar',
    icon: Home01Icon,
    cor: 'text-violet-600 bg-violet-500/10',
    campos: [
      'total_residencia', 'num_criancas', 'num_idosos', 'num_deficiencia',
      'responsavel_financeiro', 'responsavel_financeiro_quem',
    ],
  },
  {
    titulo: 'Situação Financeira',
    icon: Money01Icon,
    cor: 'text-emerald-600 bg-emerald-500/10',
    campos: [
      'renda_total', 'fontes_renda', 'situacao_trabalho', 'profissao',
      'tempo_desempregado', 'programas_sociais',
    ],
  },
  {
    titulo: 'Moradia e Saúde',
    icon: HeartbreakIcon,
    cor: 'text-sky-600 bg-sky-500/10',
    campos: [
      'convenio_medico', 'convenio_qual',
      'condicao_moradia', 'despesas_medicas',
    ],
  },
];

/* ── Componente Campo (item de detalhe) ───────────── */

function CampoDetalhe({ label, valor }: { label: string; valor: string }) {
  if (!valor || valor === 'undefined') return null;

  /* Se for valor monetário, formata com R$ */
  const isMonetario = label.toLowerCase().includes('renda') || label.toLowerCase().includes('despesa');
  const valorFormatado = isMonetario && !String(valor).startsWith('R$')
    ? `R$ ${valor}`
    : valor;

  /* Se for campo longo (textarea), exibe em bloco diferente */
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

export default function TriagensAdminPage() {
  const [triagens, setTriagens] = useState<Triagem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [triagemSelecionada, setTriagemSelecionada] = useState<Triagem | null>(null);

  useEffect(() => {
    carregarTriagens();
  }, []);

  async function carregarTriagens() {
    const resultado = await listarTriagens();
    if (resultado.sucesso && resultado.dados) {
      setTriagens(resultado.dados as Triagem[]);
    }
    setCarregando(false);
  }

  async function handleVisualizarTriagem(triagem: Triagem) {
    setTriagemSelecionada(triagem);

    // Marcar como visualizada se estiver pendente
    if (triagem.statusVisualizacao === 'pendente') {
      await atualizarStatusTriagem(triagem.id, 'visualizada');
      setTriagens((prev) =>
        prev.map((t) =>
          t.id === triagem.id ? { ...t, statusVisualizacao: 'visualizada' } : t,
        ),
      );
    }
  }

  async function handleMarcarRespondida(triagemId: string) {
    const resultado = await atualizarStatusTriagem(triagemId, 'respondida');
    if (resultado.sucesso) {
      setTriagens((prev) =>
        prev.map((t) =>
          t.id === triagemId ? { ...t, statusVisualizacao: 'respondida' } : t,
        ),
      );
      setTriagemSelecionada(null);
      toast.success('Triagem marcada como respondida');
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

  if (carregando) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Triagens</h1>
          <p className="text-sm text-muted-foreground">
            {triagens.length} triagem{triagens.length !== 1 ? 'ns' : ''} recebida{triagens.length !== 1 ? 's' : ''}
            {pendentes > 0 && ` · ${pendentes} pendente${pendentes > 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      {/* Lista vazia */}
      {triagens.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <HugeiconsIcon icon={FileValidationIcon} size={48} className="mb-4 text-muted-foreground/30" />
            <p className="text-lg font-medium">Nenhuma triagem recebida</p>
            <p className="text-sm text-muted-foreground">
              Quando alguém preencher o formulário de triagem, os dados aparecerão aqui.
            </p>
          </CardContent>
        </Card>
      ) : (
        /* Lista de triagens */
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
                    <HugeiconsIcon icon={FileValidationIcon} size={20} className="text-primary" />
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
                    {triagem.medicoClerkId && (
                      <Badge className="border-0 font-medium bg-indigo-500/10 text-indigo-600">
                        <HugeiconsIcon icon={Stethoscope02Icon} size={12} className="mr-1" />
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
                  <Button variant="ghost" size="icon">
                    <HugeiconsIcon icon={ViewIcon} size={18} />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* ══ Modal de detalhes — Premium ═══════════════════════ */}
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
                  {/* Pattern decorativo */}
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
                            <HugeiconsIcon icon={Mail01Icon} size={14} />
                            {triagemSelecionada.emailContato}
                          </span>
                        )}
                        {triagemSelecionada.telefoneContato && (
                          <span className="flex items-center gap-1.5">
                            <HugeiconsIcon icon={CallIcon} size={14} />
                            {triagemSelecionada.telefoneContato}
                          </span>
                        )}
                        <span className="flex items-center gap-1.5">
                          <HugeiconsIcon icon={Calendar01Icon} size={14} />
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

                    {/* Botão fechar */}
                    <button
                      onClick={() => setTriagemSelecionada(null)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                    >
                      <HugeiconsIcon icon={Cancel01Icon} size={18} />
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
                <div className="max-h-[55vh] overflow-y-auto px-6 pb-6 sm:px-8" style={{marginTop: 0, paddingTop: 0}}>
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
                          {/* Título da seção */}
                          <div className={cn("flex items-center gap-3 pb-3", ehPrimeira ? "pt-3" : "pt-4")}>
                            <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', secao.cor)}>
                              <HugeiconsIcon icon={secao.icon} size={16} />
                            </div>
                            <h3 className="text-sm font-bold tracking-tight">{secao.titulo}</h3>
                          </div>

                          {/* Grid de campos */}
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


                  {/* Campos que não foram mapeados nas seções (fallback) */}
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
                            <HugeiconsIcon icon={FileValidationIcon} size={16} />
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

                {/* ── Footer com ações ────────────────────── */}
                <div className="flex flex-col gap-3 border-t px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
                  {/* Ações de download */}
                  <div className="flex flex-wrap gap-2">
                    {(triagemSelecionada.dados as Record<string, string>)['relatorio_medico_arquivo'] && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => handleDownloadDocumento(triagemSelecionada)}
                      >
                        <HugeiconsIcon icon={Download01Icon} size={15} />
                        Baixar relatório médico
                      </Button>
                    )}
                    <a
                      href={SHEETS_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                      >
                        <HugeiconsIcon icon={GoogleSheetIcon} size={15} />
                        Ver na planilha
                      </Button>
                    </a>
                  </div>

                  <div className="flex items-center gap-3 sm:ml-auto">
                    <Button
                      variant="ghost"
                      onClick={() => setTriagemSelecionada(null)}
                    >
                      Fechar
                    </Button>
                    {triagemSelecionada.statusVisualizacao !== 'respondida' && (
                      <Button
                        onClick={() => handleMarcarRespondida(triagemSelecionada.id)}
                        className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
                      >
                        <HugeiconsIcon icon={CheckmarkCircle01Icon} size={16} />
                        Marcar como respondida
                      </Button>
                    )}
                  </div>
                </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
