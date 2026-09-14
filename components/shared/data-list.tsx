import type { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface DataListProps {
  children: ReactNode;
  className?: string;
}

/**
 * Grade de dados única do ambiente interno (sistema Âmbar) — substitui a pilha de
 * cards individualmente sombreados (um `<Card>` por item) pela lista densa em
 * linhas, com um único contorno. Continua sem `<table>`, por convenção do produto.
 */
export function DataList({ children, className }: DataListProps) {
  return (
    <div
      className={cn('divide-border bg-card divide-y overflow-hidden rounded-2xl border', className)}
    >
      {children}
    </div>
  );
}

interface DataRowProps {
  /** Avatar/ícone à esquerda — geralmente um círculo com iniciais ou ícone de status. */
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Texto secundário à direita, some no mobile — ex: data, valor. */
  meta?: ReactNode;
  /** Badge/chevron/ação à direita, sempre visível. */
  trailing?: ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
}

export function DataRow({
  icon,
  title,
  subtitle,
  meta,
  trailing,
  href,
  onClick,
  className,
}: DataRowProps) {
  const content = (
    <>
      {icon && (
        <div className="bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{title}</div>
        {subtitle && <div className="text-muted-foreground truncate text-xs">{subtitle}</div>}
      </div>
      {meta && (
        <div className="text-muted-foreground hidden shrink-0 text-right text-xs sm:block">
          {meta}
        </div>
      )}
      {trailing && <div className="flex shrink-0 items-center gap-2">{trailing}</div>}
    </>
  );

  const rowClass = cn(
    'flex items-center gap-4 px-4 py-3.5 transition-colors',
    (href || onClick) && 'cursor-pointer hover:bg-primary-soft/60',
    className,
  );

  if (href) {
    return (
      <Link href={href} className={rowClass}>
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(rowClass, 'w-full text-left')}>
        {content}
      </button>
    );
  }

  return <div className={rowClass}>{content}</div>;
}

interface DataEmptyProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  actions?: ReactNode;
}

/** Estado vazio consistente para dentro de um DataList (ou sozinho). */
export function DataEmpty({ icon, title, description, actions }: DataEmptyProps) {
  return (
    <div className="bg-card flex flex-col items-center justify-center rounded-2xl border py-16 text-center">
      {icon && (
        <div className="bg-primary-soft text-primary mb-3 flex h-14 w-14 items-center justify-center rounded-full">
          {icon}
        </div>
      )}
      <p className="text-lg font-medium">{title}</p>
      {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}
      {actions && <div className="mt-4 flex gap-2">{actions}</div>}
    </div>
  );
}
