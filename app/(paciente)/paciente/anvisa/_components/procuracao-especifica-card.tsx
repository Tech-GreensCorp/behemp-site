'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Send,
  CheckCircle2,
  Clock,
  AlertCircle,
  Download,
  Info,
  Loader2,
  PenLine,
} from 'lucide-react';
import { ModalDadosProcuracao } from './modal-dados-procuracao';
import { ModalEmbeddedSigning } from './modal-embedded-signing';
import { toast } from 'sonner';

interface ProcuracaoEspecificaCardProps {
  autorizacaoId: string;
  dadosIniciais: {
    nacionalidade?: string;
    estadoCivil?: string;
    profissao?: string;
  };
}

type DocuSignStatus =
  | 'nao_enviado'
  | 'enviado'
  | 'visualizado'
  | 'assinado'
  | 'concluido'
  | 'recusado'
  | 'expirado'
  | 'stub';

export function ProcuracaoEspecificaCard({
  autorizacaoId,
  dadosIniciais,
}: ProcuracaoEspecificaCardProps) {
  const [modalDadosAberto, setModalDadosAberto] = useState(false);
  const [modalSigningAberto, setModalSigningAberto] = useState(false);
  const [status, setStatus] = useState<DocuSignStatus>('nao_enviado');
  const [urlPdf, setUrlPdf] = useState<string | null>(null);
  const [procuracaoId, setProcuracaoId] = useState<string | null>(null);
  const [signingUrl, setSigningUrl] = useState<string | null>(null);
  const [carregandoSigning, setCarregandoSigning] = useState(false);

  // Badge por status
  const badgeConfig: Record<
    DocuSignStatus,
    { label: string; className: string; icon: React.ReactNode }
  > = {
    nao_enviado: {
      label: 'Pendente',
      className: 'bg-muted text-muted-foreground',
      icon: <Clock className="h-3 w-3" />,
    },
    enviado: {
      label: 'Aguardando assinatura',
      className: 'bg-blue-100 text-blue-700',
      icon: <Send className="h-3 w-3" />,
    },
    visualizado: {
      label: 'Visualizado',
      className: 'bg-yellow-100 text-yellow-700',
      icon: <Clock className="h-3 w-3" />,
    },
    assinado: {
      label: 'Assinado',
      className: 'bg-green-100 text-green-700',
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    concluido: {
      label: 'Concluído ✓',
      className: 'bg-green-100 text-green-800 font-bold',
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    recusado: {
      label: 'Recusado',
      className: 'bg-red-100 text-red-700',
      icon: <AlertCircle className="h-3 w-3" />,
    },
    expirado: {
      label: 'Expirado',
      className: 'bg-orange-100 text-orange-700',
      icon: <AlertCircle className="h-3 w-3" />,
    },
    stub: {
      label: 'Em configuração',
      className: 'bg-purple-100 text-purple-700',
      icon: <Clock className="h-3 w-3" />,
    },
  };

  const badge = badgeConfig[status];

  // Após a ModalDadosProcuracao gerar o PDF com sucesso
  const handleGeracaoSucesso = (resultado: {
    procuracaoId: string;
    urlPdf: string;
    stub: boolean;
    mensagem: string;
  }) => {
    setUrlPdf(resultado.urlPdf);
    setProcuracaoId(resultado.procuracaoId);

    if (resultado.stub) {
      // DocuSign não configurado — apenas guarda o PDF gerado
      setStatus('nao_enviado');
      toast.info('PDF gerado. Use o botão "Assinar Agora" para iniciar a assinatura digital.');
    } else {
      setStatus('enviado');
    }
  };

  // Abrir modal de assinatura embedded
  const handleAbrirAssinatura = async () => {
    if (!procuracaoId) return;
    setCarregandoSigning(true);
    try {
      const res = await fetch('/api/anvisa/procuracao/signing-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ procuracaoId }),
      });

      const data = (await res.json()) as {
        sucesso?: boolean;
        dados?: { signingUrl: string; envelopeId: string };
        erro?: string;
        consentUrl?: string;
        mensagem?: string;
      };

      if (data.sucesso && data.dados?.signingUrl) {
        setSigningUrl(data.dados.signingUrl);
        setStatus('enviado');
        setModalSigningAberto(true);
      } else if (data.erro === 'CONSENT_REQUIRED' && data.consentUrl) {
        // Primeira vez usando a conta developer — precisa autorizar
        window.open(data.consentUrl, '_blank');
        toast.info(
          'Autorize o aplicativo DocuSign na aba que abriu e clique em "Assinar Agora" novamente.',
          { duration: 8000 },
        );
      } else {
        toast.error(data.erro ?? 'Erro ao abrir assinatura digital.');
      }
    } catch {
      toast.error('Erro de conexão. Tente novamente.');
    } finally {
      setCarregandoSigning(false);
    }
  };

  // Assinatura concluída no modal
  const handleAssinaturaConcluida = () => {
    setModalSigningAberto(false);
    setStatus('concluido');
    toast.success('Procuração Específica assinada com sucesso! A Be4Hope foi notificada.');
  };

  return (
    <>
      <div className="rounded-2xl border-2 border-secondary/30 bg-secondary/5 p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-secondary/15">
              <FileText className="h-4 w-4 text-secondary" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm text-foreground">Procuração Específica</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Autoriza a Be4Hope a realizar o processo ANVISA em seu nome.
                Assine digitalmente dentro da plataforma — rápido e seguro.
              </p>
            </div>
          </div>
          <Badge className={`flex items-center gap-1 text-xs shrink-0 ${badge.className}`}>
            {badge.icon}
            {badge.label}
          </Badge>
        </div>

        {/* Ações */}
        <div className="flex gap-2 flex-wrap">
          {/* ETAPA 1: Gerar PDF (sem procuracaoId ainda) */}
          {!procuracaoId && status === 'nao_enviado' && (
            <Button
              size="sm"
              onClick={() => setModalDadosAberto(true)}
              className="rounded-xl bg-secondary hover:bg-secondary/90 text-white gap-1.5 text-xs"
            >
              <FileText className="h-3.5 w-3.5" />
              Gerar Procuração Específica
            </Button>
          )}

          {/* ETAPA 2: Assinar (após gerar PDF) */}
          {procuracaoId && (status === 'nao_enviado' || status === 'enviado' || status === 'expirado' || status === 'recusado') && (
            <Button
              size="sm"
              onClick={handleAbrirAssinatura}
              disabled={carregandoSigning}
              className="rounded-xl bg-secondary hover:bg-secondary/90 text-white gap-1.5 text-xs"
            >
              {carregandoSigning ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <PenLine className="h-3.5 w-3.5" />
              )}
              {carregandoSigning ? 'Abrindo...' : 'Assinar Agora'}
            </Button>
          )}

          {/* Reenviar quando expirado/recusado e sem procuracaoId */}
          {!procuracaoId && (status === 'recusado' || status === 'expirado') && (
            <Button
              size="sm"
              onClick={() => setModalDadosAberto(true)}
              className="rounded-xl bg-secondary hover:bg-secondary/90 text-white gap-1.5 text-xs"
            >
              <Send className="h-3.5 w-3.5" />
              Gerar Novamente
            </Button>
          )}

          {/* Download PDF gerado */}
          {urlPdf && (
            <a
              href={urlPdf}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-xl border border-secondary/30 px-3 py-1.5 text-xs font-medium text-secondary hover:bg-secondary/5 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Baixar PDF
            </a>
          )}
        </div>

        {/* Orientação contextual */}
        {status === 'concluido' ? (
          <div className="rounded-xl bg-green-50 border border-green-200 p-3">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0 mt-0.5" />
              <p className="text-xs text-green-700 leading-relaxed">
                <strong>Procuração Específica assinada.</strong> A equipe Be4Hope dará início ao
                processo de Autorização ANVISA em seu nome. Você será notificado(a) sobre
                cada etapa.
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
            <div className="flex items-start gap-2">
              <Info className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 leading-relaxed">
                <strong>Como funciona:</strong>{' '}
                {!procuracaoId
                  ? 'Clique em "Gerar Procuração Específica", confirme seus dados e o documento será criado com suas informações preenchidas.'
                  : 'Clique em "Assinar Agora" para abrir o ambiente de assinatura digital diretamente nesta tela, sem sair da plataforma.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Modal de dados complementares */}
      <ModalDadosProcuracao
        aberto={modalDadosAberto}
        onFechar={() => setModalDadosAberto(false)}
        autorizacaoId={autorizacaoId}
        dadosIniciais={dadosIniciais}
        onSucesso={handleGeracaoSucesso}
      />

      {/* Modal de assinatura embedded */}
      {signingUrl && (
        <ModalEmbeddedSigning
          aberto={modalSigningAberto}
          signingUrl={signingUrl}
          onConcluido={handleAssinaturaConcluida}
          onCancelado={() => setModalSigningAberto(false)}
        />
      )}
    </>
  );
}
