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
      <main className="flex-1 pt-24">{children}</main>
      {/* Floating WhatsApp Button */}
      <a
        href="https://wa.me/5511932047360"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-40 transition-all duration-300 hover:scale-110 active:scale-95 drop-shadow-lg"
        aria-label="Fale conosco no WhatsApp"
      >
        <img
          src="/images/home/whatsapp.png"
          alt="WhatsApp"
          className="h-14 w-14 rounded-full object-contain"
        />
      </a>
      <Footer />
    </>
  );
}
