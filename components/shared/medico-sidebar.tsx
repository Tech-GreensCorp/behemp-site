'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useClerk } from '@clerk/nextjs';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Route,
  Users,
  FileCheck,
  Bell,
  Settings,
  LogOut,
  ChevronLeft,
  Menu,
  MessageSquare,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useChatNaoLidas } from '@/lib/hooks/use-chat-nao-lidas';

const NAV_ITEMS: { label: string; href: string; icon: LucideIcon }[] = [
  { label: 'Dashboard', href: '/medico', icon: LayoutDashboard },
  { label: 'Jornada do Paciente', href: '/medico/jornada', icon: Route },
  { label: 'Pacientes', href: '/medico/pacientes', icon: Users },
  { label: 'Triagem', href: '/medico/triagem', icon: FileCheck },
  { label: 'Agendamento', href: '/medico/agenda', icon: Calendar },
  { label: 'Chat', href: '/medico/chat', icon: MessageSquare },
  { label: 'Notificações', href: '/medico/notificacoes', icon: Bell },
  { label: 'Configurações', href: '/medico/configuracoes', icon: Settings },
];

export function MedicoSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { signOut } = useClerk();
  const chatNaoLidas = useChatNaoLidas();

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="fixed top-4 left-4 z-50 flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg lg:hidden"
        aria-label="Menu"
      >
        <Menu size={20} />
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
            <ChevronLeft
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

            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => {
                  if (window.innerWidth < 1024) setCollapsed(true);
                }}
                className={cn(
                  'relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <Icon size={20} className="shrink-0" />
                {!collapsed && <span>{item.label}</span>}
                {item.label === 'Chat' && chatNaoLidas > 0 && (
                  <span className="absolute -top-1 left-6 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground shadow-sm">
                    {chatNaoLidas > 99 ? '99+' : chatNaoLidas}
                  </span>
                )}
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
            <LogOut size={20} className="shrink-0" />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
