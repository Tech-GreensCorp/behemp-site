'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useClerk } from '@clerk/nextjs';
import { cn } from '@/lib/utils';
import {
  Brain,
  LayoutDashboard,
  Route,
  Users,
  FileCheck,
  Bell,
  LogOut,
  ChevronLeft,
  Menu,
  MessageSquare,
  Calendar,
  Pill,
  User,
  Video,
  Wallet,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useChatNaoLidas } from '@/lib/hooks/use-chat-nao-lidas';
import { useTeleconsulta } from '@/components/teleconsulta/TeleconsultaContext';


interface NavGroup {
  title: string;
  items: { label: string; href: string; icon: LucideIcon }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Geral',
    items: [{ label: 'Dashboard', href: '/medico', icon: LayoutDashboard }],
  },
  {
    title: 'Atendimento',
    items: [
      { label: 'Jornada do Paciente', href: '/medico/jornada', icon: Route },
      { label: 'Pacientes', href: '/medico/pacientes', icon: Users },
      { label: 'Triagem', href: '/medico/triagem', icon: FileCheck },
      { label: 'Agendamento', href: '/medico/agenda', icon: Calendar },
      { label: 'Teleconsulta', href: '/medico/teleconsulta', icon: Video },
      // Sprint 2 (20/08/2026) — a casa do módulo de IA clínica. Fica em Atendimento porque é
      // onde o médico decide, não em ferramenta separada. `DO-11` + nome escolhido pelo dono.
      { label: 'IA Clínica', href: '/medico/ia-clinica', icon: Brain },
      // Sprint 5 (24/08/2026) — a visão GERAL da conduta e titulação. É o *filtro* do `DO-44`
      // (c); a visão padrão continua sendo a do paciente, na aba do prontuário.
      { label: 'Titulação', href: '/medico/titulacao', icon: Pill },
    ],
  },
  {
    title: 'Mensagens',
    items: [
      { label: 'Chat', href: '/medico/chat', icon: MessageSquare },
      { label: 'Notificações', href: '/medico/notificacoes', icon: Bell },
    ],
  },
  {
    title: 'Configurações',
    items: [
      { label: 'Pagamentos', href: '/medico/pagamentos', icon: Wallet },
      { label: 'Meu Perfil', href: '/medico/perfil', icon: User },
    ],
  },
];

export function MedicoSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(true);
  const { signOut } = useClerk();
  const chatNaoLidas = useChatNaoLidas();
  const { state: teleconsultaState } = useTeleconsulta();
  const emChamada = !!teleconsultaState.salaId;

  useEffect(() => {
    if (window.innerWidth >= 1024) {
      setCollapsed(false);
    }
  }, []);


  return (
    <>
      {/* Mobile Header */}
      <header className="sidebar-ambar lg:hidden flex h-16 w-full items-center justify-between px-4 shrink-0 shadow-sm">
        <Link href="/medico" className="flex items-center">
          <img src="/logo.png" alt="Be4Hope" className="h-10 w-auto object-contain brightness-0 invert" />
        </Link>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-white/80 hover:bg-white/10 hover:text-white transition-all"
          aria-label="Toggle Menu"
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
          'sidebar-ambar fixed inset-y-0 right-0 z-40 flex flex-col shadow-xl transition-all duration-300 lg:left-0 lg:right-auto lg:sticky lg:top-0 lg:h-screen lg:shrink-0 lg:overflow-hidden lg:translate-x-0 w-[50vw] lg:w-64',
          collapsed ? 'translate-x-full lg:w-20' : 'translate-x-0',
        )}
      >
        {/* Header */}
        <div
          className={cn(
            'flex h-16 items-center border-b border-white/15 transition-all duration-300',
            collapsed ? 'justify-center px-2' : 'px-4 justify-between',
          )}
        >
          {!collapsed && (
            <Link href="/medico" className="flex items-center gap-2 overflow-hidden shrink-0 animate-fade-in">
              <img
                src="/logo.png"
                alt="Be4Hope"
                className="h-9 w-auto object-contain shrink-0 brightness-0 invert"
              />
            </Link>
          )}

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/75 hover:bg-white/10 hover:text-white transition-all shrink-0"
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
                <div className="h-px bg-white/15 my-2 mx-1 animate-fade-in" />
              )}
              {!collapsed && (
                <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-white/45 mb-1.5 mt-2 animate-fade-in">
                  {group.title}
                </p>
              )}
              <div className="space-y-1">
                {group.items.map((item) => {
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
                        'relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200 border border-transparent',
                        isActive
                          ? 'bg-white/16 text-white font-semibold border-white/20 shadow-sm'
                          : 'text-white/78 hover:bg-white/10 hover:text-white hover:translate-x-0.5',
                      )}
                    >
                      <Icon size={20} className={cn('shrink-0', item.label === 'Teleconsulta' && emChamada && 'text-red-200')} />
                      {!collapsed && <span>{item.label}</span>}
                      {item.label === 'Chat' && chatNaoLidas > 0 && (
                        <span className={cn(
                          'absolute flex items-center justify-center rounded-full bg-white font-bold text-primary shadow-sm transition-all',
                          collapsed
                            ? '-top-1 left-7 h-4 min-w-4 text-[8px]'
                            : 'right-3 h-5 min-w-5 text-[10px] px-1'
                        )}>
                          {chatNaoLidas > 99 ? '99+' : chatNaoLidas}
                        </span>
                      )}
                      {/* Badge de chamada ativa na Teleconsulta */}
                      {item.label === 'Teleconsulta' && emChamada && (
                        <span className={cn(
                          'absolute flex items-center justify-center rounded-full bg-red-500 animate-pulse shadow-sm',
                          collapsed
                            ? '-top-1 left-7 h-3 w-3'
                            : 'right-3 h-2 w-2'
                        )} title="Chamada em andamento" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-white/15 p-3">
          <button
            onClick={() => signOut({ redirectUrl: '/' })}
            className={cn(
              'flex items-center gap-3 rounded-xl text-sm font-medium text-white/75 transition-all hover:bg-white/10 hover:text-white w-full',
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

