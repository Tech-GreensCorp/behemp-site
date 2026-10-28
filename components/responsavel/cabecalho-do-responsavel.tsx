'use client';

import Link from 'next/link';
import { useClerk } from '@clerk/nextjs';
import { ArrowLeft, LogOut } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * Cabeçalho da área do responsável (ADR-0033). Sem barra lateral: a área só tem uma tela por enquanto
 * (os dependentes), e os atalhos do paciente (recompra, ANVISA, documentos…) NÃO se aplicam a ele até que
 * cada uma dessas telas passe pelo resolvedor de vínculo (fatia 5 da ADR).
 */
export function CabecalhoDoResponsavel({
  nome,
  voltarPara,
}: {
  nome: string;
  voltarPara?: string;
}) {
  const { signOut } = useClerk();

  return (
    <header className="border-border/40 bg-card border-b">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div>
          <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Be4Hope
          </p>
          <p className="font-display text-foreground text-lg font-bold">Área do responsável</p>
        </div>
        <div className="flex items-center gap-3">
          {voltarPara && (
            <Link
              href={voltarPara}
              className="text-primary hover:text-primary/80 flex items-center gap-1 text-xs font-semibold"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Minha área
            </Link>
          )}
          <span className="text-muted-foreground hidden text-sm sm:inline">{nome}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => signOut({ redirectUrl: '/' })}
            className="h-9 gap-1.5 rounded-xl text-xs font-semibold"
          >
            <LogOut className="h-3.5 w-3.5" /> Sair
          </Button>
        </div>
      </div>
    </header>
  );
}
