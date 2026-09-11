import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';

interface PagamentoFunilBadgeProps {
  pagamentoConcluidoEm: Date | null;
  confirmadoEm: Date | null;
  erroConfirmacao: string | null;
}

/**
 * Estágio do funil derivado do rastreamento (nunca é lido do banco como coluna própria —
 * é sempre calculado a partir dos timestamps, para nunca divergir deles).
 *
 * O caso que mais importa para o admin: pagamento concluído mas confirmação falhou —
 * paciente passou pela etapa de pagamento e o agendamento não saiu do papel.
 */
export function PagamentoFunilBadge({
  pagamentoConcluidoEm,
  confirmadoEm,
  erroConfirmacao,
}: PagamentoFunilBadgeProps) {
  if (confirmadoEm) {
    return (
      <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
        Confirmado
      </Badge>
    );
  }

  if (erroConfirmacao) {
    return (
      <Badge variant="secondary" className="gap-1 bg-red-100 text-red-800 hover:bg-red-100">
        <AlertTriangle size={12} />
        {pagamentoConcluidoEm ? 'Pagou, agendamento falhou' : 'Erro na confirmação'}
      </Badge>
    );
  }

  if (pagamentoConcluidoEm) {
    return (
      <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100">
        Aguardando confirmação
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="bg-gray-100 text-gray-600 hover:bg-gray-100">
      Iniciado
    </Badge>
  );
}
