'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth, UserButton, ClerkLoaded } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from '@/components/ui/sheet';
import { Menu02Icon, Login01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { label: 'Início', href: '/' },
  { label: 'Quem somos', href: '/#quem-somos' },
  { label: 'Triagem', href: '/triagem' },
  { label: 'Histórias', href: '/mundo-endocanabinoide' },
  { label: 'Contato', href: '/entre-em-contato' },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { isSignedIn } = useAuth();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href.split('#')[0]);
  };

  return (
    <header
      className={cn(
        'fixed top-0 right-0 left-0 z-50 transition-all duration-300',
        scrolled ? 'glass shadow-sm' : 'bg-transparent',
      )}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo da Be4Hope */}
        <Link href="/" className="flex items-center transition-opacity hover:opacity-80">
          <img src="/logo.png" alt="Be4Hope" className="h-12 w-auto" />
        </Link>

        {/* Desktop Nav */}
        <div className="hidden items-center gap-1 lg:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'px-3 py-2 text-sm font-medium transition-colors',
                isActive(item.href)
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>

        {/* CTA Desktop — Login + WhatsApp */}
        <div className="hidden items-center gap-3 lg:flex">
          <ClerkLoaded>
            {isSignedIn ? (
              /* Quando ESTÁ logado: avatar com dropdown do Clerk */
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: 'h-9 w-9',
                  },
                }}
              />
            ) : (
              /* Quando NÃO está logado: botão Entrar */
              <Link href="/sign-in">
                <Button
                  variant="outline"
                  size="sm"
                  className="btn-pill gap-2 px-5"
                  nativeButton={false}
                >
                  <HugeiconsIcon icon={Login01Icon} size={16} />
                  Entrar
                </Button>
              </Link>
            )}
          </ClerkLoaded>

          <Link
            href="https://wa.me/5511932047360"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button
              size="sm"
              className="btn-pill gap-2 bg-primary px-6 text-primary-foreground hover:bg-primary/90"
              nativeButton={false}
            >
              WhatsApp
            </Button>
          </Link>
        </div>

        {/* Mobile Menu */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger
            render={<Button variant="ghost" size="icon" className="lg:hidden" />}
          >
            <HugeiconsIcon icon={Menu02Icon} size={20} />
            <span className="sr-only">Menu</span>
          </SheetTrigger>
          <SheetContent side="right" className="w-80 bg-sand">
            <SheetTitle>
              <img src="/logo.png" alt="Be4Hope" className="h-12 w-auto" />
            </SheetTitle>
            <nav className="mt-8 flex flex-col gap-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'rounded-lg px-4 py-3 text-base font-medium transition-colors',
                    isActive(item.href)
                      ? 'text-primary'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {item.label}
                </Link>
              ))}
              <div className="mt-6 flex flex-col gap-3 border-t border-border pt-6">
                {/* Login / Perfil mobile */}
                <ClerkLoaded>
                  {isSignedIn ? (
                    <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-4 py-3">
                      <UserButton
                        appearance={{
                          elements: {
                            avatarBox: 'h-8 w-8',
                          },
                        }}
                      />
                      <span className="text-sm font-medium">Minha conta</span>
                    </div>
                  ) : (
                    <Link href="/sign-in" onClick={() => setMobileOpen(false)}>
                      <Button
                        variant="outline"
                        className="btn-pill w-full gap-2"
                        nativeButton={false}
                      >
                        <HugeiconsIcon icon={Login01Icon} size={16} />
                        Entrar na minha conta
                      </Button>
                    </Link>
                  )}
                </ClerkLoaded>

                <Link
                  href="https://wa.me/5511932047360"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMobileOpen(false)}
                >
                  <Button className="btn-pill w-full bg-primary text-primary-foreground" nativeButton={false}>
                    WhatsApp
                  </Button>
                </Link>
              </div>
            </nav>
          </SheetContent>
        </Sheet>
      </nav>
    </header>
  );
}
