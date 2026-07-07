'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useClerk } from '@clerk/nextjs';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Pill,
  MessageSquare,
  LogOut,
  ChevronLeft,
  Menu,
  Bell,
  User,
  ShoppingCart,
  Calculator,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useChatNaoLidas } from '@/lib/hooks/use-chat-nao-lidas';
import { useNotificacoesNaoLidas } from '@/lib/hooks/use-notificacoes-nao-lidas';

interface NavGroup {
  title: string;
  items: { label: string; href: string; icon: LucideIcon }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Geral',
    items: [{ label: 'Dashboard', href: '/paciente', icon: LayoutDashboard }],
  },
  {
    title: 'Minha Saúde',
    items: [
      { label: 'Medicamentos', href: '/paciente/medicamentos', icon: Pill },
      { label: 'Recompra', href: '/paciente/recompra', icon: ShoppingCart },
      { label: 'Calculadora', href: '/paciente/calculadora', icon: Calculator },
    ],
  },
  {
    title: 'Mensagens',
    items: [
      { label: 'Chat', href: '/paciente/chat', icon: MessageSquare },
      { label: 'Notificações', href: '/paciente/notificacoes', icon: Bell },
    ],
  },
  {
    title: 'Configurações',
    items: [{ label: 'Meu Perfil', href: '/paciente/perfil', icon: User }],
  },
];

export function PacienteSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(true);
  const { signOut } = useClerk();
  const chatNaoLidas = useChatNaoLidas();
  const notificacoesNaoLidas = useNotificacoesNaoLidas();

  useEffect(() => {
    if (window.innerWidth >= 1024) {
      setCollapsed(false);
    }
  }, []);

  return (
    <>
      {/* Mobile Header */}
      <header className="lg:hidden flex h-16 w-full items-center justify-between border-b border-border/40 bg-sidebar/95 backdrop-blur-md px-4 shrink-0">
        <Link href="/paciente" className="flex items-center">
          <img src="/logo.png" alt="Be4Hope" className="h-10 w-auto object-contain" />
        </Link>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-all"
          aria-label="Menu"
        >
          <Menu size={24} />
        </button>
      </header>

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
          'grain fixed inset-y-0 right-0 z-40 flex flex-col border-l border-border/40 bg-sidebar transition-all duration-300 lg:border-l-0 lg:border-r lg:left-0 lg:right-auto lg:sticky lg:top-0 lg:h-screen lg:shrink-0 lg:overflow-hidden lg:translate-x-0 w-[50vw] lg:w-64',
          collapsed ? 'translate-x-full lg:w-20' : 'translate-x-0',
        )}
      >
        {/* Header */}
        <div
          className={cn(
            'flex h-16 items-center border-b border-border/40 transition-all duration-300',
            collapsed ? 'justify-center px-2' : 'px-4 justify-between',
          )}
        >
          {!collapsed && (
            <Link href="/paciente" className="flex items-center gap-2 overflow-hidden shrink-0 animate-fade-in">
              <img
                src="/logo.png"
                alt="Be4Hope"
                className="h-9 w-auto object-contain shrink-0"
              />
            </Link>
          )}

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-all shrink-0"
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            <ChevronLeft
              size={18}
              className={cn(
                'transition-transform duration-300',
                'lg:rotate-0 rotate-180',
                collapsed && 'lg:rotate-180'
              )}
            />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-4">
          {NAV_GROUPS.map((group, groupIdx) => (
            <div key={group.title} className="space-y-1">
              {groupIdx > 0 && collapsed && (
                <div className="h-px bg-border/40 my-2 mx-1 animate-fade-in" />
              )}
              {!collapsed && (
                <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-1.5 mt-2 animate-fade-in">
                  {group.title}
                </p>
              )}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive =
                    item.href === '/paciente'
                      ? pathname === '/paciente'
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
                        'relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200',
                        isActive
                          ? 'bg-primary/8 text-primary font-semibold border-l-2 border-primary'
                          : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground hover:translate-x-0.5',
                      )}
                    >
                      <Icon size={20} className="shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                      {item.label === 'Chat' && chatNaoLidas > 0 && (
                        <span className={cn(
                          'absolute flex items-center justify-center rounded-full bg-primary font-bold text-primary-foreground shadow-sm transition-all',
                          collapsed 
                            ? '-top-1 left-7 h-4 min-w-4 text-[8px]' 
                            : 'right-3 h-5 min-w-5 text-[10px] px-1'
                        )}>
                          {chatNaoLidas > 99 ? '99+' : chatNaoLidas}
                        </span>
                      )}
                      {item.label === 'Notificações' && notificacoesNaoLidas > 0 && (
                        <span className={cn(
                          'absolute flex items-center justify-center rounded-full bg-red-500 font-bold text-white shadow-sm animate-pulse transition-all',
                          collapsed 
                            ? '-top-1 left-7 h-4 min-w-4 text-[8px]' 
                            : 'right-3 h-5 min-w-5 text-[10px] px-1'
                        )}>
                          {notificacoesNaoLidas > 99 ? '99+' : notificacoesNaoLidas}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-border/40 p-3 bg-sidebar/50">
          <button
            onClick={() => signOut({ redirectUrl: '/' })}
            className={cn(
              'flex items-center gap-3 rounded-xl text-sm font-medium text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive w-full',
              collapsed ? 'h-10 justify-center' : 'px-3 py-2'
            )}
            title="Sair"
          >
            <LogOut size={20} className="shrink-0" />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>
      </aside>
    </>
  );
}

