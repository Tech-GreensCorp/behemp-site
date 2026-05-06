'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useClerk } from '@clerk/nextjs';
import { cn } from '@/lib/utils';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  DashboardSquare01Icon,
  UserMultiple02Icon,
  FileValidationIcon,
  Shield01Icon,
  Settings01Icon,
  Logout01Icon,
  ArrowLeft01Icon,
  Menu02Icon,
  Message01Icon,
} from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import type { IconSvgElement } from '@hugeicons/react';
import { contarContatosNaoLidos } from '@/app/(public)/_actions/contato';

const NAV_ITEMS: { label: string; href: string; icon: IconSvgElement }[] = [
  { label: 'Visão Geral', href: '/admin', icon: DashboardSquare01Icon },
  { label: 'Usuários', href: '/admin/usuarios', icon: UserMultiple02Icon },
  { label: 'Triagens', href: '/admin/triagens', icon: FileValidationIcon },
  { label: 'Mensagens', href: '/admin/mensagens', icon: Message01Icon },
  { label: 'Auditoria', href: '/admin/auditoria', icon: Shield01Icon },
  { label: 'Configurações', href: '/admin/configuracoes', icon: Settings01Icon },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [naoLidas, setNaoLidas] = useState(0);
  const { signOut } = useClerk();

  useEffect(() => {
    function atualizarContagem() {
      contarContatosNaoLidos().then((r) => {
        if (r.sucesso && r.dados !== undefined) setNaoLidas(r.dados);
      });
    }

    // Busca ao montar e quando muda de rota
    atualizarContagem();

    // Escuta evento disparado pela página de mensagens ao marcar como lida/respondida
    window.addEventListener('mensagens-atualizadas', atualizarContagem);
    return () => window.removeEventListener('mensagens-atualizadas', atualizarContagem);
  }, [pathname]);


  return (
    <>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="fixed top-4 left-4 z-50 flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg lg:hidden"
        aria-label="Menu"
      >
        <HugeiconsIcon icon={Menu02Icon} size={20} />
      </button>

      {!collapsed && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={() => setCollapsed(true)}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex flex-col border-r bg-sidebar transition-all duration-300 lg:sticky lg:top-0',
          collapsed ? '-translate-x-full lg:w-20 lg:translate-x-0' : 'w-64',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b px-4">
          <Link href="/admin" className="flex items-center gap-2">
            {collapsed ? (
              /* Colapsado: apenas ícone pequeno */
              <img src="/logo.png" alt="Be4Hope" className="h-12 w-auto" />
            ) : (
              /* Expandido: logo completa + badge Admin */
              <div className="flex items-center gap-2">
                <img src="/logo.png" alt="Be4Hope" className="h-12 w-auto" />
                <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  Admin
                </p>
              </div>
            )}
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex"
          >
            <HugeiconsIcon
              icon={ArrowLeft01Icon}
              size={16}
              className={cn('transition-transform', collapsed && 'rotate-180')}
            />
          </Button>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === '/admin'
                ? pathname === '/admin'
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => {
                  if (window.innerWidth < 1024) setCollapsed(true);
                }}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <HugeiconsIcon icon={item.icon} size={20} className="shrink-0" />
                {!collapsed && (
                  <span className="flex-1">{item.label}</span>
                )}
                {!collapsed && item.href === '/admin/mensagens' && naoLidas > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                    {naoLidas > 99 ? '99+' : naoLidas}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t p-3">
          <button onClick={() => signOut({ redirectUrl: '/' })} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
            <HugeiconsIcon icon={Logout01Icon} size={20} className="shrink-0" />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
