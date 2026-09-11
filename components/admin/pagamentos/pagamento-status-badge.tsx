import { Badge } from '@/components/ui/badge';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pendente: {
    label: 'Pendente',
    className: 'bg-amber-100 text-amber-800 hover:bg-amber-100',
  },
  pago: {
    label: 'Pago',
    className: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100',
  },
  isento: {
    label: 'Isento',
    className: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  },
  cancelado: {
    label: 'Cancelado',
    className: 'bg-gray-100 text-gray-600 hover:bg-gray-100',
  },
  estornado: {
    label: 'Estornado',
    className: 'bg-red-100 text-red-800 hover:bg-red-100',
  },
};

export function PagamentoStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? { label: status, className: '' };
  return (
    <Badge variant="secondary" className={config.className}>
      {config.label}
    </Badge>
  );
}
