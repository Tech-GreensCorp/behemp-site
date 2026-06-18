'use client';

/**
 * Navbar — Be4Hope
 *
 * Anchor: Organic / Editorial Caloroso
 * Palette: sand #F5F2ED · terracotta #E63946 · moss #2D4F3C · stone #8A7F73
 * Typography: Epilogue (nav links) · Fraunces display não usado aqui
 * Structure: 1 separador hairline entre nav e CTAs; hierarquia clara de ações
 * Differentiator: hairline vertical separator entre nav e CTA zone, revelado
 *   apenas após scroll — quando a navbar solidifica com glass.
 *   No mobile, sheet lateral usa faixa decorativa em terracota no topo.
 *
 * CTA hierarchy (desktop):
 *   1. Acessar Painel  — ghost, discreto, apenas logado
 *   2. Agendar Consulta — outline moss
 *   3. WhatsApp         — filled terracota (ação principal)
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth, UserButton } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from '@/components/ui/sheet';
import { Menu, LogIn, Calendar, LayoutDashboard, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { label: 'Quem somos', href: '/#quem-somos' },
  { label: 'Triagem', href: '/triagem' },
  { label: 'Histórias', href: '/historias' },
  { label: 'Ebooks', href: '/ebooks' },
  { label: 'Contato', href: '/contato' },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeHash, setActiveHash] = useState('');
  const pathname = usePathname();
  const { isSignedIn, isLoaded } = useAuth();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Após navegar para uma página com hash (ex: /#quem-somos vindo de /historias),
  // aguarda o DOM montar e rola até o elemento correto.
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    const id = hash.replace('#', '');
    // Pequeno delay para garantir que o DOM da nova página já existe
    const timer = setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
        setActiveHash(hash);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    const handleHashChange = () => {
      setActiveHash(window.location.hash);
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);

    let observer: IntersectionObserver | null = null;
    if (pathname === '/') {
      const el = document.getElementById('quem-somos');
      if (el) {
        observer = new IntersectionObserver(
          ([entry]) => {
            if (entry.isIntersecting) {
              setActiveHash('#quem-somos');
            } else {
              setActiveHash('');
            }
          },
          { threshold: 0.2, rootMargin: '-80px 0px -40% 0px' }
        );
        observer.observe(el);
      }
    }

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      if (observer) observer.disconnect();
    };
  }, [pathname]);

  const isActive = (href: string) => {
    if (href.includes('#')) {
      const [path, hash] = href.split('#');
      return pathname === path && activeHash === `#${hash}`;
    }
    return pathname === href;
  };

  return (
    <header
      className={cn(
        'fixed top-0 right-0 left-0 z-50 transition-all duration-300',
        scrolled ? 'glass shadow-sm' : 'bg-transparent',
      )}
    >
      <nav className="mx-auto flex h-24 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">

        {/* Left container: Logo & Nav links closer together */}
        <div className="flex items-center gap-12">
          {/* ── Logo ── */}
          <Link
            href="/"
            onClick={(e) => {
              if (window.location.pathname === '/') {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
            className="flex shrink-0 items-center transition-opacity hover:opacity-80"
          >
            <img src="/logo.png" alt="Be4Hope" className="h-20 w-auto" />
          </Link>

          {/* ── Desktop: nav links ── */}
          <div className="hidden items-center gap-0.5 lg:flex">
            {NAV_ITEMS.map((item) => {
              const isAnchor = item.href.includes('#');
              const handleAnchorClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
                if (isAnchor) {
                  const [path, hash] = item.href.split('#');
                  if (pathname === path) {
                    e.preventDefault();
                    const el = document.getElementById(hash);
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth' });
                      window.history.pushState(null, '', item.href);
                      setActiveHash(`#${hash}`);
                    }
                  }
                }
              };

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={handleAnchorClick}
                  className={cn(
                    'relative px-3.5 py-2 text-sm font-medium transition-colors duration-200',
                    isActive(item.href)
                      ? 'text-primary'
                      : 'text-stone-600 hover:text-foreground',
                  )}
                >
                  {item.label}
                  {/* Sublinhado ativo */}
                  {isActive(item.href) && (
                    <span className="absolute bottom-1 left-3.5 right-3.5 h-px rounded-full bg-primary" />
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* ── Desktop: zona de CTAs (direita) ── */}
        <div className="hidden items-center gap-2.5 lg:flex">
          {/* Agendar Consulta — outline moss */}
          {/* <Link href="/agendamento">
            <Button
              size="sm"
              variant="outline"
              className="h-9 gap-1.5 rounded-full border-[#2D4F3C]/40 px-4 text-sm font-medium text-[#2D4F3C] hover:border-[#2D4F3C] hover:bg-[#2D4F3C]/5"
              nativeButton={false}
            >
              <Calendar size={14} />
              Agendar Consulta
            </Button>
          </Link> */}

          {isLoaded && (
            isSignedIn ? (
              /* Logado: painel discreto + avatar */
              <div className="flex items-center gap-2.5">
                {/* Separador visual */}
                <span className="h-5 w-px bg-border" />
                <Link href="/redirect">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 gap-1.5 rounded-full px-3.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                    nativeButton={false}
                  >
                    <LayoutDashboard size={14} />
                    Painel
                  </Button>
                </Link>
                <UserButton
                  appearance={{
                    elements: { avatarBox: 'h-8 w-8' },
                  }}
                />
              </div>
            ) : (
              /* Não logado: Registrar-se + Entrar ghost */
              <div className="flex items-center gap-1.5">
                {/* Separador visual */}
                <span className="h-5 w-px bg-border" />
                <Link href="/registrar-se">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 gap-1.5 rounded-full px-3.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                    nativeButton={false}
                  >
                    <UserPlus size={14} />
                    Registrar-se
                  </Button>
                </Link>
                <Link href="/entrar">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 gap-1.5 rounded-full px-3.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                    nativeButton={false}
                  >
                    <LogIn size={14} />
                    Entrar
                  </Button>
                </Link>
              </div>
            )
          )}
        </div>

        {/* ── Mobile: hamburger ── */}
        <div className="flex items-center gap-2 lg:hidden">
          {/* Avatar pequeno acessível sem abrir o menu */}
          {isLoaded && isSignedIn && (
            <UserButton
              appearance={{ elements: { avatarBox: 'h-7 w-7' } }}
            />
          )}

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full hover:bg-muted"
                />
              }
            >
              <Menu size={18} />
              <span className="sr-only">Menu</span>
            </SheetTrigger>

            <SheetContent side="right" className="flex w-[300px] flex-col bg-[#F5F2ED] p-0">
              {/* Faixa decorativa topo — differentiator Organic */}
              <div className="h-1 w-full bg-primary" />

              <div className="flex-1 overflow-y-auto px-6 pt-5 pb-6">
                <SheetTitle className="mb-6">
                  <img src="/logo.png" alt="Be4Hope" className="h-12 w-auto" />
                </SheetTitle>

                {/* Nav links */}
                <nav className="flex flex-col gap-0.5">
                  {NAV_ITEMS.map((item) => {
                    const isAnchor = item.href.includes('#');
                    const handleMobileClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
                      setMobileOpen(false);
                      if (isAnchor) {
                        const [path, hash] = item.href.split('#');
                        if (pathname === path) {
                          e.preventDefault();
                          // Short delay to let the Sheet drawer close smoothly before scrolling
                          setTimeout(() => {
                            const el = document.getElementById(hash);
                            if (el) {
                              el.scrollIntoView({ behavior: 'smooth' });
                              window.history.pushState(null, '', item.href);
                              setActiveHash(`#${hash}`);
                            }
                          }, 300);
                        }
                      }
                    };

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={handleMobileClick}
                        className={cn(
                          'rounded-xl px-4 py-2.5 text-base font-medium transition-colors',
                          isActive(item.href)
                            ? 'bg-primary/8 text-primary'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>

                {/* Divisor */}
                <div className="my-5 h-px bg-border" />

                {/* CTAs mobile */}
                <div className="flex flex-col gap-2.5">
                  {isLoaded && (
                    isSignedIn ? (
                      <>
                        <Link href="/redirect" onClick={() => setMobileOpen(false)}>
                          <Button
                            variant="outline"
                            className="h-11 w-full gap-2 rounded-full border-primary/30 text-primary hover:border-primary hover:bg-primary/5"
                            nativeButton={false}
                          >
                            <LayoutDashboard size={16} />
                            Acessar Painel
                          </Button>
                        </Link>
                        <div className="flex items-center gap-3 rounded-xl bg-muted/60 px-4 py-2.5">
                          <UserButton
                            appearance={{ elements: { avatarBox: 'h-8 w-8' } }}
                          />
                          <span className="text-sm font-medium text-foreground">Minha conta</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <Link href="/registrar-se" onClick={() => setMobileOpen(false)}>
                          <Button
                            variant="outline"
                            className="h-11 w-full gap-2 rounded-full"
                            nativeButton={false}
                          >
                            <UserPlus size={16} />
                            Registrar-se
                          </Button>
                        </Link>
                        <Link href="/entrar" onClick={() => setMobileOpen(false)}>
                          <Button
                            variant="outline"
                            className="h-11 w-full gap-2 rounded-full"
                            nativeButton={false}
                          >
                            <LogIn size={16} />
                            Entrar na minha conta
                          </Button>
                        </Link>
                      </>
                    )
                  )}

                  {/* <Link href="/agendamento" onClick={() => setMobileOpen(false)}>
                    <Button
                      variant="outline"
                      className="h-11 w-full gap-2 rounded-full border-[#2D4F3C]/40 text-[#2D4F3C] hover:border-[#2D4F3C] hover:bg-[#2D4F3C]/5"
                      nativeButton={false}
                    >
                      <Calendar size={16} />
                      Agendar Consulta
                    </Button>
                  </Link> */}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>

      </nav>
    </header>
  );
}
