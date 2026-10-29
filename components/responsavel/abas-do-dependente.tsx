'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { caminhoDoDependente, SECOES_DO_DEPENDENTE } from '@/lib/dependentes/rotulos';
import { cn } from '@/lib/utils';

/**
 * As seções de UM dependente, no topo de cada página dele. Os links levam sempre o `pacienteId` do dependente
 * aberto: trocar de aba nunca troca de pessoa.
 */
export function AbasDoDependente({ pacienteId }: { pacienteId: string }) {
  const pathname = usePathname();

  return (
    // Sem margem inferior no <nav>: `-mb-px` (e qualquer `mb-*`) vence o `space-y` do layout e colava as abas no
    // cartão de baixo. O encaixe da linha ativa sobre a borda é feito pelos links.
    <nav
      className="border-border/40 flex gap-1 overflow-x-auto border-b pb-px"
      aria-label="Seções do dependente"
    >
      {SECOES_DO_DEPENDENTE.map((s) => {
        const href = caminhoDoDependente(pacienteId, s.sufixo);
        const ativo = s.sufixo === '' ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={s.chave}
            href={href}
            className={cn(
              '-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors',
              ativo
                ? 'border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground border-transparent',
            )}
          >
            {s.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
