import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface PaginationBarProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  itemLabel?: string;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

/**
 * Paginação única do ambiente interno (sistema Âmbar) — antes reimplementada
 * de formas diferentes em usuarios/medicos/pacientes. Padrão: anterior/próximo
 * + "Página X de Y", com contador e itens-por-página opcionais.
 */
export function PaginationBar({
  page,
  totalPages,
  onPageChange,
  totalItems,
  itemLabel = 'resultado',
  pageSize,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
  className,
}: PaginationBarProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-4 pt-2 sm:flex-row sm:justify-between',
        className,
      )}
    >
      <div className="text-muted-foreground flex items-center gap-3 text-sm">
        {typeof totalItems === 'number' && (
          <span>
            {totalItems} {itemLabel}
            {totalItems !== 1 ? 's' : ''}
          </span>
        )}
        {typeof totalItems === 'number' && onPageSizeChange && (
          <span className="text-border">·</span>
        )}
        {onPageSizeChange && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs">Exibir</span>
            <Select
              value={String(pageSize)}
              onValueChange={(val) => {
                if (val) onPageSizeChange(Number(val));
              }}
            >
              <SelectTrigger size="sm" className="w-16">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs">por página</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          className="gap-1"
        >
          <ChevronLeft size={14} />
          Anterior
        </Button>
        <span className="text-muted-foreground min-w-[6rem] text-center text-sm tabular-nums">
          Página {page} de {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          className="gap-1"
        >
          Próximo
          <ChevronRight size={14} />
        </Button>
      </div>
    </div>
  );
}
