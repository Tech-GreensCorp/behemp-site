import type { ReactNode } from 'react';

/**
 * Aplica a identidade visual azul da Nossa Farmácia (.farmacia-theme, em
 * app/globals.css) às três telas da área — hub, marketplace e detalhe de
 * produto — sem alterar a sidebar/header compartilhados da plataforma.
 */
export default function FarmaciaLayout({ children }: { children: ReactNode }) {
  return <div className="farmacia-theme">{children}</div>;
}
