import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  /** Rótulo curto acima do título — ex: "Painel médico", "Financeiro". */
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  /** Botões/ações do canto direito — ex: <Button>Novo paciente</Button>. */
  actions?: ReactNode;
  className?: string;
}

/**
 * Cabeçalho de página único do ambiente interno (sistema Âmbar).
 * Substitui o `<h1>` solto que cada página montava por conta própria —
 * ver docs/06-PADROES-DO-CODIGO.md §7 e a análise da reformulação visual.
 */
export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'page-header-wash flex flex-col gap-4 border border-border/60 bg-card/40 p-6 sm:flex-row sm:items-end sm:justify-between sm:p-8',
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
        )}
        <h1 className="font-heading mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
