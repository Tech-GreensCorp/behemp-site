'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useClerk } from '@clerk/nextjs';
import { cn } from '@/lib/utils';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  DashboardSquare01Icon,
  Route01Icon,
  UserMultiple02Icon,
  FileValidationIcon,
  Notification03Icon,
  Settings01Icon,
  Logout01Icon,
  ArrowLeft01Icon,
  Menu02Icon,
  Message01Icon,
  Calendar03Icon,
} from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import type { IconSvgElement } from '@hugeicons/react';

const NAV_ITEMS: { label: string; href: string; icon: IconSvgElement }[] = [
  { label: 'Dashboard', href: '/medico', icon: DashboardSquare01Icon },
  { label: 'Jornada do Paciente', href: '/medico/jornada', icon: Route01Icon },
  { label: 'Pacientes', href: '/medico/pacientes', icon: UserMultiple02Icon },
  { label: 'Triagem', href: '/medico/triagem', icon: FileValidationIcon },
  { label: 'Agenda', href: '/medico/agenda', icon: Calendar03Icon },
  { label: 'Chat', href: '/medico/chat', icon: Message01Icon },
  { label: 'Notificações', href: '/medico/notificacoes', icon: Notification03Icon },
  { label: 'Configurações', href: '/medico/configuracoes', icon: Settings01Icon },
];

export function MedicoSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { signOut } = useClerk();

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="fixed top-4 left-4 z-50 flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg lg:hidden"
        aria-label="Menu"
      >
        <HugeiconsIcon icon={Menu02Icon} size={20} />
      </button>

      {/* Overlay mobile */}
      {!collapsed && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={() => setCollapsed(true)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex flex-col border-r bg-sidebar transition-all duration-300 lg:sticky lg:top-0',
          collapsed ? '-translate-x-full lg:w-20 lg:translate-x-0' : 'w-64',
        )}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b px-4">
          <Link href="/medico" className="flex items-center gap-2">
            <img src="/logo.png" alt="Be4Hope" className="h-12 w-auto" />
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

        {/* Nav */}
        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === '/medico'
                ? pathname === '/medico'
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
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer — Botão Sair funcional */}
        <div className="border-t p-3">
          <button
            onClick={() => signOut({ redirectUrl: '/' })}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <HugeiconsIcon icon={Logout01Icon} size={20} className="shrink-0" />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
