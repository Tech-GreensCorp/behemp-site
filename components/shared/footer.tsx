import Link from 'next/link';
import { Mail, Smartphone, MapPin } from 'lucide-react';
import { Instagram } from '@/components/shared/icons';

const LINKS_RAPIDOS = [
  { label: 'Início', href: '/' },
  { label: 'Quem Somos', href: '/#quem-somos' },
  { label: 'Triagem', href: '/triagem' },
  { label: 'Histórias', href: '/historias' },
];

const LINKS_SUPORTE = [
  { label: 'Parceiros', href: '/parceiros' },
  { label: 'Contato', href: '/contato' },
  { label: 'Política de Privacidade', href: '/politica-de-privacidade' },
  { label: 'Termos de Uso', href: '/termos-de-uso' },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          {/* Marca */}
          <div className="space-y-4">
            <Link href="/" className="inline-block">
              <img src="/logo.png" alt="Be4Hope" className="h-14 w-auto" />
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              Há mais de duas décadas conectando pessoas ao cuidado com Medicina
              Endocanabinóide. Acolhimento humanizado, sem julgamento, sem custo.
            </p>
          </div>

          {/* Links rápidos */}
          <div>
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-foreground">
              Navegação
            </h3>
            <ul className="space-y-3">
              {LINKS_RAPIDOS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-primary"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Suporte */}
          <div>
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-foreground">
              Suporte
            </h3>
            <ul className="space-y-3">
              {LINKS_SUPORTE.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-primary"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contato */}
          <div>
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-foreground">
              Contato
            </h3>
            <ul className="space-y-3">
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail size={16} className="shrink-0 text-primary" />
                hello@be4hope.org
              </li>
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail size={16} className="shrink-0 text-primary" />
                hello@behemp.org
              </li>
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <Smartphone size={16} className="shrink-0 text-primary" />
                +55 (11) 93204-7360
              </li>
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <Instagram size={16} className="shrink-0 text-primary" />
                <a
                  href="https://instagram.com/be_4hope"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors"
                >
                  @be_4hope
                </a>
              </li>
              <li className="flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin size={16} className="mt-0.5 shrink-0 text-primary" />
                São Paulo, SP — Brasil
              </li>
            </ul>
          </div>
        </div>

        {/* Barra inferior */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 md:flex-row">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Be4Hope. Todos os direitos reservados.
          </p>
          <p className="text-xs text-muted-foreground">
            Acolhimento desde 2002
          </p>
        </div>
      </div>
    </footer>
  );
}
