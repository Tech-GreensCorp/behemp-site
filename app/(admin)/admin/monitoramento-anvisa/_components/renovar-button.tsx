'use client';

import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Loader2 } from 'lucide-react';
import { iniciarRenovacao } from '@/app/_actions/anvisa-renovacao';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export function RenovarButton({ autorizacaoId }: { autorizacaoId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleRenovar = () => {
    startTransition(async () => {
      const res = await iniciarRenovacao(autorizacaoId);
      if (res.sucesso) {
        toast.success('Processo de renovação iniciado com sucesso!');
        router.refresh();
      } else {
        toast.error(res.erro || 'Erro ao iniciar renovação.');
      }
    });
  };

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleRenovar}
      disabled={isPending}
      className="gap-2"
    >
      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
      Iniciar Renovação
    </Button>
  );
}
