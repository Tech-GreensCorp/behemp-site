'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ModalEmbeddedSigningProps {
  aberto: boolean;
  signingUrl: string;
  onConcluido: () => void;
  onCancelado: () => void;
}

export function ModalEmbeddedSigning({
  aberto,
  signingUrl,
  onConcluido,
  onCancelado,
}: ModalEmbeddedSigningProps) {
  const [status, setStatus] = useState<'carregando' | 'pronto' | 'concluido' | 'cancelado'>(
    'carregando',
  );
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Simplificar onLoad do iframe (apenas remove o estado carregando inicial):
  const handleIframeLoad = useCallback(() => {
    setStatus('pronto');
  }, []);

  // Escutar postMessage disparado pela nossa rota /api/anvisa/signing-complete
  useEffect(() => {
    if (!aberto) return;

    const handleMessage = (event: MessageEvent) => {
      // Aceitar apenas mensagens do DocuSign ou da nossa rota de retorno
      if (event.data?.type === 'docusign_event') {
        const { event: signingEvent } = event.data as {
          type: string;
          event: string;
          procuracaoId: string;
        };

        if (signingEvent === 'signing_complete') {
          setStatus('concluido');
          setTimeout(() => onConcluido(), 2000);
        } else if (
          signingEvent === 'cancel' ||
          signingEvent === 'decline' ||
          signingEvent === 'session_timeout'
        ) {
          setStatus('cancelado');
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [aberto, onConcluido]);

  // Resetar status ao abrir
  useEffect(() => {
    if (aberto) setStatus('carregando');
  }, [aberto]);

  return (
    <Dialog open={aberto} onOpenChange={(open) => { if (!open) onCancelado(); }}>
      <DialogContent className="max-w-4xl w-full h-[90vh] p-0 rounded-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-secondary/10">
              <span className="text-secondary font-bold text-sm">✍</span>
            </div>
            <div>
              <p className="font-display font-bold text-sm text-foreground">
                Assinar Procuração Específica
              </p>
              <p className="text-xs text-muted-foreground">
                Assinatura digital segura via DocuSign
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancelado}
            className="text-muted-foreground hover:text-foreground text-xs"
          >
            Cancelar
          </Button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 relative bg-gray-50 min-h-0">
          {/* Carregando */}
          {status === 'carregando' && (
            <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  Carregando ambiente de assinatura...
                </p>
              </div>
            </div>
          )}

          {/* Concluído */}
          {status === 'concluido' && (
            <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
              <div className="flex flex-col items-center gap-4 text-center px-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle2 className="h-9 w-9 text-green-600" />
                </div>
                <div>
                  <p className="font-display font-bold text-lg text-foreground">
                    Procuração Específica assinada!
                  </p>
                  <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                    A Be4Hope recebeu sua Procuração Específica e dará início ao processo
                    junto à ANVISA.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Cancelado */}
          {status === 'cancelado' && (
            <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
              <div className="flex flex-col items-center gap-4 text-center px-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
                  <XCircle className="h-9 w-9 text-red-500" />
                </div>
                <div>
                  <p className="font-display font-bold text-lg text-foreground">
                    Assinatura cancelada
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Você pode tentar novamente quando quiser.
                  </p>
                </div>
                <Button onClick={onCancelado} variant="outline" className="rounded-xl mt-2">
                  Fechar
                </Button>
              </div>
            </div>
          )}

          {/* iframe DocuSign — sempre montado para preservar estado */}
          {status !== 'concluido' && status !== 'cancelado' && (
            <iframe
              ref={iframeRef}
              src={signingUrl}
              onLoad={handleIframeLoad}
              className="w-full h-full border-0"
              title="Assinar Procuração Específica — DocuSign"
              allow="camera; microphone"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
