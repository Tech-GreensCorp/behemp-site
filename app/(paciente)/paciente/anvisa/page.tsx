'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  iniciarAutorizacaoAnvisa,
  listarAutorizacoesAnvisa,
  confirmarEnvioAnvisa,
  salvarFormulario8833,
  definirModalidadeAnvisa,
} from '../../_actions/anvisa';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProcuracaoEspecificaCard } from './_components/procuracao-especifica-card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  ShieldCheck, FileText, Upload, CheckCircle2, Clock, AlertCircle,
  ChevronRight, Loader2, RefreshCw, FileCheck, CircleDot,
  XCircle, Info, ExternalLink, Download, Copy, CheckCheck, Users, Navigation
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Tipos ──────────────────────────────────────────────────────
type AnvisaStatus =
  | 'pendente'
  | 'documentos_enviados'
  | 'em_analise'
  | 'aprovado'
  | 'pendencia_documental'
  | 'rejeitado';

type AnvisaModalidade = 'guiada' | 'representacao';

type DocItem = {
  tipo: string;
  enviado: boolean;
  validado: boolean;
  urlBlob: string | null;
  nomeArquivo: string | null;
};

type Autorizacao = {
  id: string;
  status: AnvisaStatus;
  modalidade?: AnvisaModalidade | null;
  documentos: unknown;
  formulario8833: unknown;
  dataEnvio: string | null;
  dataAprovacao: string | null;
  prazoEstimado: string | null;
  numeroProcesso: string | null;
  observacoesAnvisa: string | null;
};

// ── Helpers visuais ────────────────────────────────────────────
const STATUS_CONFIG: Record<AnvisaStatus, { label: string; cor: string; icon: React.ReactNode }> = {
  pendente: {
    label: 'Aguardando documentos',
    cor: 'bg-muted text-muted-foreground',
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  documentos_enviados: {
    label: 'Documentos enviados',
    cor: 'bg-blue-100 text-blue-700',
    icon: <FileCheck className="h-3.5 w-3.5" />,
  },
  em_analise: {
    label: 'Em análise — ANVISA',
    cor: 'bg-yellow-100 text-yellow-700',
    icon: <Clock className="h-3.5 w-3.5 animate-pulse" />,
  },
  aprovado: {
    label: 'Aprovado ✓',
    cor: 'bg-green-100 text-green-700',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  pendencia_documental: {
    label: 'Pendência documental',
    cor: 'bg-orange-100 text-orange-700',
    icon: <AlertCircle className="h-3.5 w-3.5" />,
  },
  rejeitado: {
    label: 'Rejeitado',
    cor: 'bg-red-100 text-red-700',
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
};

const DOC_LABELS: Record<string, { label: string; dica: string }> = {
  receita_medica: {
    label: 'Receita Médica',
    dica: 'A receita emitida pelo seu médico na plataforma Be4Hope.',
  },
  rg_paciente: {
    label: 'RG do Paciente',
    dica: 'Documento de identidade do paciente (frente e verso).',
  },
  comprovante_residencia: {
    label: 'Comprovante de Residência',
    dica: 'Conta de água, luz ou telefone com até 90 dias.',
  },
  procuracao_especifica: {
    label: 'Procuração Específica',
    dica: 'Documento que autoriza a Be4Hope a realizar o processo ANVISA em seu nome. Baixe, assine e envie.',
  },
  laudo_medico: {
    label: 'Laudo Médico',
    dica: 'Laudo com CID, diagnóstico e justificativa para uso de produto não registrado no Brasil.',
  },
};

// ── Componente de linha de checklist ───────────────────────────
function ChecklistItem({
  doc,
  autorizacaoId,
  onUploaded,
}: {
  doc: DocItem;
  autorizacaoId: string;
  onUploaded: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const config = DOC_LABELS[doc.tipo] ?? { label: doc.tipo, dica: '' };

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('autorizacaoId', autorizacaoId);
      form.append('tipo', doc.tipo);
      form.append('arquivo', file);

      const res = await fetch('/api/anvisa/upload-documento', { method: 'POST', body: form });
      const data: unknown = await res.json();
      if (res.ok && (data as { sucesso?: boolean }).sucesso) {
        toast.success(`${config.label} enviado com sucesso!`);
        onUploaded();
      } else {
        toast.error((data as { erro?: string }).erro ?? 'Erro no upload');
      }
    } catch {
      toast.error('Falha ao enviar arquivo.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className={cn(
        'flex items-start gap-4 p-4 rounded-xl border transition-all',
        doc.enviado ? 'border-green-200 bg-green-50/50' : 'border-border hover:border-primary/30',
      )}
    >
      <div
        className={cn(
          'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
          doc.enviado ? 'bg-green-500' : 'bg-muted',
        )}
      >
        {doc.enviado ? (
          <CheckCircle2 className="h-4 w-4 text-white" />
        ) : (
          <CircleDot className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-foreground">{config.label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{config.dica}</p>
        {doc.enviado && doc.nomeArquivo && (
          <p className="text-xs text-green-600 mt-1 truncate">✓ {doc.nomeArquivo}</p>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <Button
        size="sm"
        variant={doc.enviado ? 'outline' : 'default'}
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="shrink-0"
      >
        {uploading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Upload className="h-3.5 w-3.5" />
        )}
        <span className="ml-1.5">{doc.enviado ? 'Substituir' : 'Enviar'}</span>
      </Button>
    </div>
  );
}

// ── Timeline ───────────────────────────────────────────────────
function Timeline({ autorizacao }: { autorizacao: Autorizacao }) {
  const etapas: { key: AnvisaStatus | '_inicio'; label: string; descricao: string }[] = [
    { key: '_inicio', label: 'Processo iniciado', descricao: 'Processo de autorização criado na plataforma.' },
    { key: 'documentos_enviados', label: 'Documentos enviados', descricao: 'Checklist completo. Pronto para análise.' },
    { key: 'em_analise', label: 'Em análise — ANVISA', descricao: `Prazo estimado: ${autorizacao.prazoEstimado ?? '—'}` },
    { key: 'aprovado', label: 'Autorização concedida', descricao: 'Seu medicamento está autorizado para importação.' },
  ];

  const ordem: AnvisaStatus[] = ['pendente', 'documentos_enviados', 'em_analise', 'aprovado'];
  const idxAtual = ordem.indexOf(autorizacao.status);

  return (
    <div className="relative pl-6 space-y-6">
      <div className="absolute left-2.5 top-0 bottom-0 w-0.5 bg-border" />
      {etapas.map((etapa, i) => {
        const concluida = etapa.key === '_inicio' || (idxAtual >= 0 && i <= idxAtual);
        return (
          <div key={etapa.key} className="relative">
            <div
              className={cn(
                'absolute -left-6 flex h-5 w-5 items-center justify-center rounded-full border-2 bg-background',
                concluida ? 'border-primary bg-primary' : 'border-muted-foreground/30',
              )}
            >
              {concluida && <CheckCircle2 className="h-3 w-3 text-white" />}
            </div>
            <div className="pl-2">
              <p className={cn('text-sm font-semibold', concluida ? 'text-foreground' : 'text-muted-foreground')}>
                {etapa.label}
              </p>
              <p className="text-xs text-muted-foreground">{etapa.descricao}</p>
            </div>
          </div>
        );
      })}

      {(autorizacao.status === 'pendencia_documental' || autorizacao.status === 'rejeitado') && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
          <div className="flex gap-2">
            <AlertCircle className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-orange-800">
                {autorizacao.status === 'rejeitado' ? 'Processo rejeitado' : 'Pendência documental'}
              </p>
              {autorizacao.observacoesAnvisa && (
                <p className="text-xs text-orange-700 mt-1">{autorizacao.observacoesAnvisa}</p>
              )}
              <p className="text-xs text-orange-600 mt-2">
                Entre em contato com a Be4Hope para suporte.
              </p>
            </div>
          </div>
        </div>
      )}

      {autorizacao.status === 'aprovado' && autorizacao.numeroProcesso && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-semibold text-green-800">Nº do processo ANVISA</p>
          <p className="text-lg font-mono font-bold text-green-700 mt-1">{autorizacao.numeroProcesso}</p>
        </div>
      )}
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────
export default function AnvisaPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [autorizacao, setAutorizacao] = useState<Autorizacao | null>(null);
  const [etapa, setEtapa] = useState<'inicio' | 'escolha' | 'checklist' | 'guiada' | 'formulario' | 'acompanhamento'>('inicio');
  const [carregando, setCarregando] = useState(false);
  const [temPrescricao, setTemPrescricao] = useState<boolean | null>(null); // null = carregando
  const [verificando, setVerificando] = useState(true);
  const [modalidade, setModalidade] = useState<AnvisaModalidade | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  useEffect(() => {
    const verificar = async () => {
      setVerificando(true);
      const res = await listarAutorizacoesAnvisa();
      if (res.sucesso && res.dados && res.dados.length > 0) {
        // Tem autorização já criada — mostrar estado atual
        const ultima = res.dados[res.dados.length - 1] as Autorizacao;
        setAutorizacao(ultima);
        setTemPrescricao(true);
        if (ultima.modalidade) {
          setModalidade(ultima.modalidade);
        }
        if (ultima.status !== 'pendente') {
          setEtapa('acompanhamento');
        } else if (!ultima.modalidade) {
          setEtapa('escolha');
        } else {
          setEtapa(ultima.modalidade === 'guiada' ? 'guiada' : 'checklist');
        }
      } else {
        // Sem autorização ainda — mostrar card de início (NÃO bloquear)
        setTemPrescricao(null);
      }
      setVerificando(false);
    };
    verificar();
  }, []);

  // Formulário 8833 simplificado
  const [form, setForm] = useState<Record<string, string>>({
    nome: '',
    cpf: '',
    endereco: '',
    produto: '',
    finalidade: '',
  });

  const documentos = (autorizacao?.documentos as DocItem[] | undefined) ?? [];
  const todosEnviados = documentos.length > 0 && documentos.every((d) => d.enviado);

  const recarregarAutorizacao = async () => {
    setCarregando(true);
    const res = await listarAutorizacoesAnvisa();
    if (res.sucesso && res.dados && res.dados.length > 0) {
      const ultima = res.dados[res.dados.length - 1] as Autorizacao;
      setAutorizacao(ultima);
      if (ultima.modalidade) {
        setModalidade(ultima.modalidade);
      }
      if (ultima.status !== 'pendente') {
        setEtapa('acompanhamento');
      } else if (!ultima.modalidade) {
        setEtapa('escolha');
      } else {
        const docs = (ultima.documentos as DocItem[]) ?? [];
        setEtapa(ultima.modalidade === 'guiada' ? 'guiada' : 'checklist');
      }
    }
    setCarregando(false);
  };

  const handleIniciar = () => {
    startTransition(async () => {
      const res = await iniciarAutorizacaoAnvisa();
      
      const resultado = res as {
        sucesso: boolean;
        dados?: Autorizacao;
        erro?: string;
        mensagem?: string;
      };

      if (resultado.sucesso && resultado.dados) {
        setAutorizacao(resultado.dados);
        setEtapa('escolha');
        toast.success('Processo ANVISA iniciado!');
      } else if (resultado.erro === 'sem_prescricao') {
        setTemPrescricao(false);
        toast.error('Você precisa ter uma prescrição emitida antes de iniciar este processo.');
      } else {
        toast.error(resultado.mensagem ?? resultado.erro ?? 'Erro ao iniciar processo.');
      }
    });
  };

  const handleConfirmarEnvio = () => {
    if (!autorizacao) return;
    startTransition(async () => {
      const res = await confirmarEnvioAnvisa(autorizacao.id);
      if (res.sucesso) {
        toast.success('Documentos confirmados! Iniciando análise ANVISA.');
        await recarregarAutorizacao();
      } else {
        toast.error('Erro ao confirmar envio.');
      }
    });
  };

  const handleSalvarFormulario = () => {
    if (!autorizacao) return;
    startTransition(async () => {
      const res = await salvarFormulario8833({ autorizacaoId: autorizacao.id, campos: form });
      if (res.sucesso) {
        toast.success('Formulário salvo!');
        setEtapa('checklist');
      } else {
        toast.error('Erro ao salvar formulário.');
      }
    });
  };

  const progresso = (() => {
    if (etapa === 'inicio') return 0;
    if (etapa === 'escolha') return 20;
    if (etapa === 'guiada') return 60;
    if (etapa === 'checklist') return 50;
    if (etapa === 'formulario') return 75;
    return 100;
  })();

  if (verificando) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Verificando suas prescrições...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-display font-bold text-foreground">Autorização ANVISA</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Guia passo a passo para obter sua autorização de importação de medicamento.
        </p>
      </div>

      {/* Progresso */}
      {etapa !== 'inicio' && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Documentos</span>
            <span>Formulário</span>
            <span>Acompanhamento</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progresso}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Estado bloqueado — sem prescrição ──────────────── */}
      {temPrescricao === false && (
        <Card className="border-orange-200 bg-orange-50/30">
          <CardContent className="pt-6 pb-6">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-100">
                <ShieldCheck className="h-7 w-7 text-orange-500" />
              </div>
              <div className="space-y-2">
                <h3 className="font-display font-bold text-lg text-foreground">
                  Prescrição necessária
                </h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Para iniciar o processo de autorização ANVISA, você precisa ter
                  uma <strong>consulta realizada</strong> com seu médico e uma{' '}
                  <strong>prescrição emitida</strong> na plataforma.
                </p>
              </div>
              <div className="rounded-xl bg-white border border-orange-200 p-4 text-left w-full max-w-sm space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Próximos passos
                </p>
                {[
                  '1. Agende uma consulta com seu médico',
                  '2. Realize a teleconsulta na plataforma',
                  '3. Aguarde a prescrição digital do médico',
                  '4. Volte aqui para iniciar a autorização ANVISA',
                ].map((passo) => (
                  <div key={passo} className="flex items-start gap-2 text-sm text-foreground">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    {passo}
                  </div>
                ))}
              </div>
              <Button
                variant="outline"
                onClick={() => router.push('/paciente')}
                className="gap-2"
              >
                <ChevronRight className="h-4 w-4" />
                Ir para o Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── ETAPA A — Início ─────────────────────────────── */}
      {etapa === 'inicio' && temPrescricao !== false && (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg font-display">O que é a Autorização ANVISA?</CardTitle>
            <CardDescription>
              Para receber seu medicamento importado, a ANVISA exige uma autorização de importação.
              A Be4Hope guia você em cada etapa do processo — do envio dos documentos ao acompanhamento da análise.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { icon: <FileText className="h-5 w-5 text-primary" />, titulo: '1. Documentos', desc: 'Envie sua receita, RG e comprovante de residência.' },
                { icon: <Upload className="h-5 w-5 text-primary" />, titulo: '2. Formulário', desc: 'Preencha os dados do formulário 8833 com ajuda da plataforma.' },
                { icon: <Clock className="h-5 w-5 text-primary" />, titulo: '3. Acompanhamento', desc: 'Monitore o status da análise em tempo real (prazo: 10 dias úteis).' },
              ].map((item) => (
                <div key={item.titulo} className="rounded-xl border border-border p-4 space-y-2">
                  {item.icon}
                  <p className="text-sm font-semibold">{item.titulo}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 flex gap-3">
              <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <p className="text-sm text-foreground">
                <strong>Tempo estimado:</strong> A ANVISA analisa os pedidos em até 10 dias úteis após o envio completo da documentação.
              </p>
            </div>

            <div className="flex gap-3">
              <Button size="lg" onClick={handleIniciar} disabled={isPending} className="flex-1 gap-2">
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Iniciar Processo
              </Button>
              <Button size="lg" variant="outline" onClick={recarregarAutorizacao} disabled={carregando}>
                <RefreshCw className={cn('h-4 w-4', carregando && 'animate-spin')} />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── ETAPA ESCOLHA — Como prefere fazer? ────────────── */}
      {etapa === 'escolha' && autorizacao && (
        <div className="space-y-4">
          <div className="space-y-1">
            <h2 className="font-display font-bold text-xl text-foreground">
              Como prefere fazer sua Autorização ANVISA?
            </h2>
            <p className="text-sm text-muted-foreground">
              Escolha a modalidade que melhor se adapta à sua situação.
              Você pode alterar essa escolha a qualquer momento.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* OPÇÃO 1 — Guiada */}
            <button
              onClick={async () => {
                await definirModalidadeAnvisa(autorizacao.id, 'guiada');
                setModalidade('guiada');
                setEtapa('guiada');
              }}
              className="group text-left rounded-2xl border-2 border-border hover:border-primary/50 bg-white p-5 space-y-3 transition-all hover:shadow-md"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                <Navigation className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-display font-bold text-base text-foreground">
                  Faço eu mesmo
                </p>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  Te guiamos passo a passo no Gov.br com todos os
                  dados já preenchidos. Rápido, gratuito e seguro.
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                <CheckCircle2 className="h-3.5 w-3.5" />
                100% online · Gov.br
              </div>
            </button>

            {/* OPÇÃO 2 — Representação */}
            <button
              onClick={async () => {
                await definirModalidadeAnvisa(autorizacao.id, 'representacao');
                setModalidade('representacao');
                setEtapa('checklist');
                await recarregarAutorizacao();
              }}
              className="group text-left rounded-2xl border-2 border-border hover:border-secondary/50 bg-white p-5 space-y-3 transition-all hover:shadow-md"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary/10">
                <Users className="h-6 w-6 text-secondary" />
              </div>
              <div>
                <p className="font-display font-bold text-base text-foreground">
                  Be4Hope faz por mim
                </p>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  Assine a Procuração Específica e nossa equipe
                  cuida de todo o processo junto à ANVISA por você.
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-secondary">
                <ShieldCheck className="h-3.5 w-3.5" />
                Procuração Específica · Equipe Be4Hope
              </div>
            </button>
          </div>
        </div>
      )}

      {/* ── ETAPA GUIADA — Passo a passo Gov.br ─────────────── */}
      {etapa === 'guiada' && autorizacao && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display font-bold text-xl text-foreground">
                Passo a passo — Gov.br
              </h2>
              <p className="text-sm text-muted-foreground">
                Siga cada etapa com atenção. Seus dados já estão prontos para copiar.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setEtapa('escolha')}>
              Voltar
            </Button>
          </div>

          {/* Link direto para o Gov.br */}
          <a
            href="https://www.gov.br/pt-br/servicos/solicitar-autorizacao-para-importacao-excepcional-de-produtos-a-base-de-canabidiol"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-3 rounded-2xl bg-primary p-4 text-white shadow-md hover:bg-primary/90 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
                <ExternalLink className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-sm">Abrir portal Gov.br</p>
                <p className="text-xs text-white/80">Clique para abrir em nova aba e siga os passos abaixo</p>
              </div>
            </div>
            <ExternalLink className="h-5 w-5 shrink-0" />
          </a>

          {/* 10 passos */}
          <div className="space-y-3">
            {[
              {
                numero: 1,
                titulo: 'Acesse o Portal Gov.br',
                descricao: 'Faça login com seu CPF (ou crie uma conta caso não tenha).',
                dado: null,
                dica: 'Use o botão acima para abrir o portal diretamente.',
              },
              {
                numero: 2,
                titulo: 'Entre no Link de Importação',
                descricao: 'Clique em "Solicitar autorização para importar produtos derivados de Cannabis" e depois no botão verde "Iniciar".',
                dado: null,
                dica: 'O link já está apontando para a página correta.',
              },
              {
                numero: 3,
                titulo: 'Confirme seus Dados',
                descricao: 'Seus dados pessoais aparecerão pré-preenchidos. Confirme e prossiga.',
                dado: null,
                dica: null,
              },
              {
                numero: 4,
                titulo: 'Escolha o Tipo de Solicitação',
                descricao: 'Selecione "Inicial" se for a primeira vez, "Alteração" para modificar ou "Renovação" se a autorização anterior expirou.',
                dado: null,
                dica: 'Se for a primeira vez, selecione "Inicial".',
              },
              {
                numero: 5,
                titulo: 'Adicione o Produto',
                descricao: 'Na seção "Dados do Produto", clique na lupa e busque pelo nome comercial do produto prescrito.',
                dado: null,
                dica: 'Digite o nome exato do produto da sua receita.',
              },
              {
                numero: 6,
                titulo: 'Inclua na Tabela',
                descricao: 'Clique sobre a linha com os dados do produto e depois clique em "Adicionar dados na tabela +".',
                dado: null,
                dica: null,
              },
              {
                numero: 7,
                titulo: 'Insira os Dados do Prescritor',
                descricao: 'Preencha nome, CRM e especialidade do médico. Use os dados da sua receita.',
                dado: null,
                dica: null,
              },
              {
                numero: 8,
                titulo: 'Anexe a Receita',
                descricao: 'Faça o upload da receita médica (PDF gerado na plataforma). Clique em "concordo com a declaração" e prossiga.',
                dado: null,
                dica: 'Baixe sua receita na seção "Prescrições" antes de começar.',
              },
              {
                numero: 9,
                titulo: 'Conferência Final',
                descricao: 'Revise todos os dados preenchidos. Role até o final, marque "concordo com o termo" e clique em "Enviar solicitação".',
                dado: null,
                dica: 'Verifique atentamente antes de enviar.',
              },
              {
                numero: 10,
                titulo: 'Baixe sua Autorização',
                descricao: 'Após a análise (até 20 dias corridos), volte em "Minhas Solicitações", localize o protocolo e baixe o documento.',
                dado: null,
                dica: '⚠️ Importante: baixe a autorização ANTES de clicar em "Confirmar recebimento do certificado".',
              },
            ].map((passo) => (
              <div
                key={passo.numero}
                className="rounded-2xl border border-border bg-white p-4 space-y-2"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
                    {passo.numero}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground">{passo.titulo}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {passo.descricao}
                    </p>

                    {/* Dica destacada */}
                    {passo.dica && (
                      <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 border border-amber-200 p-2">
                        <Info className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700">{passo.dica}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Aviso após concluir */}
          <Card className="border-green-200 bg-green-50/50">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-green-800">
                    Após concluir o processo no Gov.br
                  </p>
                  <p className="text-xs text-green-700 mt-1 leading-relaxed">
                    Volte aqui e faça o upload da autorização emitida pela ANVISA
                    para mantermos seu histórico completo e garantirmos a entrega do medicamento.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3 border-green-300 text-green-700 hover:bg-green-100"
                    onClick={() => {
                      setEtapa('checklist');
                    }}
                  >
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                    Enviar autorização obtida
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── ETAPA B — Checklist ───────────────────────────── */}
      {etapa === 'checklist' && autorizacao && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display font-semibold text-lg">Documentos necessários</h2>
              <p className="text-sm text-muted-foreground">Envie cada documento nos formatos PDF, JPG ou PNG (máx. 10MB).</p>
            </div>
            <Badge className={cn('gap-1.5 text-xs', STATUS_CONFIG[autorizacao.status].cor)}>
              {STATUS_CONFIG[autorizacao.status].icon}
              {STATUS_CONFIG[autorizacao.status].label}
            </Badge>
          </div>

          {/* Botão voltar para modalidade representação */}
          {modalidade === 'representacao' && autorizacao.status === 'pendente' && (
            <Button variant="outline" size="sm" onClick={() => setEtapa('escolha')} className="mb-2">
              Voltar
            </Button>
          )}

          {/* Card especial Procuração Específica — apenas na modalidade representacao */}
          {modalidade === 'representacao' && autorizacao && (
            <ProcuracaoEspecificaCard
              autorizacaoId={autorizacao.id}
              dadosIniciais={{
                nacionalidade: '',
                estadoCivil: '',
                profissao: '',
              }}
            />
          )}

          <div className="space-y-3">
            {documentos.map((doc) => (
              <ChecklistItem
                key={doc.tipo}
                doc={doc}
                autorizacaoId={autorizacao.id}
                onUploaded={recarregarAutorizacao}
              />
            ))}
          </div>

          <Separator />

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setEtapa('formulario')}
              className="gap-2"
            >
              <FileText className="h-4 w-4" /> Preencher Formulário 8833
            </Button>
            <Button
              className="flex-1 gap-2"
              onClick={handleConfirmarEnvio}
              disabled={!todosEnviados || isPending}
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
              {todosEnviados ? 'Confirmar Envio à ANVISA' : 'Envie todos os documentos para continuar'}
            </Button>
          </div>
        </div>
      )}

      {/* ── ETAPA C — Formulário 8833 ─────────────────────── */}
      {etapa === 'formulario' && autorizacao && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display">Formulário 8833 — Dados do Paciente</CardTitle>
            <CardDescription>
              Preencha os dados principais. Os campos serão salvos automaticamente para o processo ANVISA.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {[
              { id: 'nome', label: 'Nome completo do paciente', placeholder: 'Conforme documento oficial' },
              { id: 'cpf', label: 'CPF', placeholder: '000.000.000-00' },
              { id: 'endereco', label: 'Endereço completo', placeholder: 'Rua, número, bairro, cidade, estado, CEP' },
              { id: 'produto', label: 'Produto solicitado', placeholder: 'Ex: Óleo CBD 10% — Empresa XYZ' },
            ].map((field) => (
              <div key={field.id} className="space-y-1.5">
                <Label htmlFor={field.id}>{field.label}</Label>
                <Input
                  id={field.id}
                  placeholder={field.placeholder}
                  value={form[field.id] ?? ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, [field.id]: e.target.value }))}
                />
              </div>
            ))}

            <div className="space-y-1.5">
              <Label htmlFor="finalidade">Finalidade terapêutica</Label>
              <Textarea
                id="finalidade"
                placeholder="Descreva brevemente a condição clínica e o objetivo do tratamento."
                value={form.finalidade ?? ''}
                onChange={(e) => setForm((prev) => ({ ...prev, finalidade: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setEtapa('checklist')}>
                Voltar
              </Button>
              <Button className="flex-1" onClick={handleSalvarFormulario} disabled={isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Salvar Formulário
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── ETAPA D — Acompanhamento ──────────────────────── */}
      {etapa === 'acompanhamento' && autorizacao && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display font-semibold text-lg">Acompanhamento do processo</h2>
              <p className="text-sm text-muted-foreground">Atualizado em tempo real.</p>
            </div>
            <div className="flex gap-2 items-center">
              <Badge className={cn('gap-1.5 text-xs', STATUS_CONFIG[autorizacao.status].cor)}>
                {STATUS_CONFIG[autorizacao.status].icon}
                {STATUS_CONFIG[autorizacao.status].label}
              </Badge>
              <Button variant="ghost" size="icon" onClick={recarregarAutorizacao} disabled={carregando}>
                <RefreshCw className={cn('h-4 w-4', carregando && 'animate-spin')} />
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="pt-6">
              <Timeline autorizacao={autorizacao} />
            </CardContent>
          </Card>

          {autorizacao.status === 'pendente' || autorizacao.status === 'documentos_enviados' ? (
            <Button variant="outline" onClick={() => setEtapa('checklist')}>
              Ver documentos enviados
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
