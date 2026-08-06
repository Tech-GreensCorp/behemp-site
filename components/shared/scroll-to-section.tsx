'use client';

import { type CSSProperties, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface ScrollToSectionProps {
  /** ID do elemento alvo (sem #). Ex: "condicoes" */
  targetId: string;
  /** Conteúdo do botão/link */
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * Componente que garante scroll para uma seção na homepage.
 *
 * Resolve o problema do Next.js onde clicar em "/#condicoes"
 * pela segunda vez não dispara scroll, pois a URL não muda.
 *
 * - Se já estiver na homepage: faz scrollIntoView direto via JS.
 * - Se estiver em outra página: navega para / e aguarda o elemento
 *   existir no DOM antes de fazer o scroll.
 */
export function ScrollToSection({ targetId, children, className, style }: ScrollToSectionProps) {
  const router = useRouter();
  const pathname = usePathname();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();

    const scrollToElement = () => {
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };

    if (pathname === '/') {
      // Já está na homepage — scroll direto, sem depender da URL
      scrollToElement();
    } else {
      // Está em outra página — navega para / e aguarda o elemento
      router.push(`/#${targetId}`);
      // Aguarda o Next.js montar a homepage antes de tentar o scroll
      let tentativas = 0;
      const intervalo = setInterval(() => {
        tentativas++;
        const el = document.getElementById(targetId);
        if (el) {
          clearInterval(intervalo);
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else if (tentativas > 20) {
          clearInterval(intervalo); // desiste após 2s
        }
      }, 100);
    }
  }

  return (
    <button onClick={handleClick} className={className} style={style} type="button">
      {children}
    </button>
  );
}
