import Link from 'next/link';
import { Globe, Mail, MapPin, Phone, ShieldCheck } from 'lucide-react';
import { WhatsApp } from '@/components/shared/icons';

const LINKS_RAPIDOS = [
  { label: 'Início', href: '/' },
  { label: 'Quem Somos', href: '/#quem-somos' },
  { label: 'Triagem', href: '/triagem' },
  { label: 'Histórias', href: '/historias' },
];

const LINKS_SUPORTE = [
  { label: 'Programa de Acesso Solidário', href: '/programa-acesso-solidario' },
  { label: 'Parceiros', href: '/parceiros' },
  { label: 'Contato', href: '/contato' },
  { label: 'Política de Privacidade', href: '/politica-de-privacidade' },
  { label: 'Termos de Uso', href: '/termos-de-uso' },
];

const BARRA_INFO = [
  { icon: WhatsApp, label: 'WhatsApp (11) 93204-7360' },
  { icon: Globe, label: 'www.be4hope.org' },
  { icon: ShieldCheck, label: 'RDC 660/22 ANVISA' },
  { icon: ShieldCheck, label: 'Dados seguros e confidenciais' },
];

export function Footer() {
  return (
    <footer id="contato" className="border-t border-border bg-surface">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-4 lg:px-8">
        {/* Marca */}
        <div>
          <Link href="/" className="inline-block font-display leading-[0.85] font-extrabold">
            <span className="block text-2xl text-primary">be.</span>
            <span className="block text-xl text-primary">4hope</span>
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
            Há mais de duas décadas conectando pessoas ao cuidado com Medicina Endocanabinoide,
            responsabilidade, acolhimento e do seu lado em cada etapa.
          </p>
        </div>

        {/* Navegação */}
        <div>
          <h3 className="text-xs font-bold tracking-widest text-foreground uppercase">
            Navegação
          </h3>
          <ul className="mt-4 space-y-2">
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
          <h3 className="text-xs font-bold tracking-widest text-foreground uppercase">Suporte</h3>
          <ul className="mt-4 space-y-2">
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
          <h3 className="text-xs font-bold tracking-widest text-foreground uppercase">Contato</h3>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <Mail size={15} className="shrink-0 text-primary" />
              hello@be4hope.org
            </li>
            <li className="flex items-center gap-2">
              <Phone size={15} className="shrink-0 text-primary" />
              +55 (11) 93204-7360
            </li>
            <li className="flex items-center gap-2">
              <Globe size={15} className="shrink-0 text-primary" />
              www.be4hope.org
            </li>
            <li className="flex items-center gap-2">
              <MapPin size={15} className="shrink-0 text-primary" />
              São Paulo, SP — Brasil
            </li>
          </ul>
        </div>
      </div>

      {/* Barra legal */}
      <div className="border-t border-border/60">
        <div className="mx-auto flex max-w-7xl flex-col items-start gap-2 px-4 py-5 text-[11px] leading-relaxed text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>
            Associação Behemp de Desenvolvimento, Pesquisa e Fomento em Cannabis no Brasil
            <span className="mx-1.5 text-muted-foreground/50">·</span>
            CNPJ 07.578.940/0001-01
          </p>
          {/* <p className="text-muted-foreground/70">© {new Date().getFullYear()} Be4Hope</p> */}
        </div>
      </div>

      {/* Barra inferior verde */}
      <div className="bg-secondary text-secondary-foreground">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-5 text-xs sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
          {BARRA_INFO.map((item) => {
            const Icon = item.icon;
            return (
              <p key={item.label} className="flex items-center gap-2">
                <Icon size={15} />
                {item.label}
              </p>
            );
          })}
        </div>
      </div>
    </footer>
  );
}
