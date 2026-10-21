'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { atualizarStatusPagamento } from '@/app/(admin)/_actions/pagamentos';

type StatusPagamento = 'pendente' | 'pago' | 'isento' | 'cancelado' | 'estornado';

const STATUS_OPTIONS: { value: StatusPagamento; label: string }[] = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'pago', label: 'Pago' },
  { value: 'isento', label: 'Isento' },
  { value: 'cancelado', label: 'Cancelado' },
  { value: 'estornado', label: 'Estornado' },
];

interface PagamentoStatusFormProps {
  pagamentoId: string;
  statusAtual: string;
}

export function PagamentoStatusForm({ pagamentoId, statusAtual }: PagamentoStatusFormProps) {
  const router = useRouter();
  const [atualizando, setAtualizando] = useState(false);

  async function handleMudarStatus(novoStatus: StatusPagamento) {
    if (novoStatus === statusAtual) return;
    setAtualizando(true);
    const res = await atualizarStatusPagamento({ pagamentoId, novoStatus });
    setAtualizando(false);
    if (res.sucesso) {
      toast.success('Status atualizado');
      router.refresh();
    } else {
      toast.error(res.erro || 'Erro ao atualizar status');
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {STATUS_OPTIONS.map((opt) => (
        <Button
          key={opt.value}
          size="sm"
          variant={opt.value === statusAtual ? 'default' : 'outline'}
          disabled={atualizando || opt.value === statusAtual}
          onClick={() => handleMudarStatus(opt.value)}
          className="gap-1.5 text-xs"
        >
          {atualizando && <Loader2 size={12} className="animate-spin" />}
          {opt.label}
        </Button>
      ))}
    </div>
  );
}
