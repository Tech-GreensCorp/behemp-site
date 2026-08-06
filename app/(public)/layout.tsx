import type { ReactNode } from 'react';
import { Navbar } from '@/components/shared/navbar';
import { Footer } from '@/components/shared/footer';

/**
 * Layout da área pública (sem login).
 * Contém Navbar fixa no topo e Footer global.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="flex-1 pt-12">{children}</main>
      <Footer />
    </>
  );
}
