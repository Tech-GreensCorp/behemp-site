import { Badge } from '@/components/ui/badge';

const TYPE_CONFIG: Record<string, { label: string; className: string }> = {
  donation: {
    label: 'Doação',
    className: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100',
  },
  judicialization: {
    label: 'Judicialização',
    className: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  },
  collab: {
    label: 'Collab',
    className: 'bg-violet-100 text-violet-800 hover:bg-violet-100',
  },
  retail: {
    label: 'Varejo',
    className: 'bg-amber-100 text-amber-800 hover:bg-amber-100',
  },
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: {
    label: 'Rascunho',
    className: 'bg-gray-100 text-gray-600 hover:bg-gray-100',
  },
  completed: {
    label: 'Completo',
    className: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100',
  },
};

export function InvoiceTypeBadge({ type }: { type: string }) {
  const config = TYPE_CONFIG[type] ?? { label: type, className: '' };
  return (
    <Badge variant="secondary" className={config.className}>
      {config.label}
    </Badge>
  );
}

export function InvoiceStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? { label: status, className: '' };
  return (
    <Badge variant="secondary" className={config.className}>
      {config.label}
    </Badge>
  );
}
