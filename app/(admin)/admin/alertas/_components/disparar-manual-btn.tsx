'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { dispararVerificacaoManual } from '@/app/(admin)/_actions/alertas';
import { toast } from 'sonner';
import { RefreshCw, Play } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function DispararManualBtn() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleDisparar = async () => {
    setLoading(true);
    try {
      const res = await dispararVerificacaoManual();
      if (res.sucesso) {
        toast.success('Verificação Iniciada!', {
          description: 'O Inngest está processando os alertas em background.',
        });
        // Atualiza a página após 2s para mostrar os novos resultados, 
        // caso o Inngest termine rápido (embora Inngest seja async).
        setTimeout(() => {
          router.refresh();
        }, 2000);
      } else {
        toast.error('Erro', {
          description: res.erro,
        });
      }
    } catch {
      toast.error('Erro', {
        description: 'Falha ao disparar verificação.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button 
      onClick={handleDisparar} 
      disabled={loading}
      className="bg-terracota hover:bg-terracota/90"
    >
      {loading ? (
        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Play className="mr-2 h-4 w-4" />
      )}
      Verificar Agora
    </Button>
  );
}
