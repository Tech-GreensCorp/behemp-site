'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useClerk } from '@clerk/nextjs';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  FileCheck,
  Shield,
  LogOut,
  ChevronLeft,
  Menu,
  MessageSquare,
  UserPlus,
  Receipt,
  ShoppingCart,
  User,
  Settings2,
  Stethoscope,
  BookOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import type { LucideIcon } from 'lucide-react';
import { contarContatosNaoLidos } from '@/app/(public)/_actions/contato';
import { contarPacientesSemMedico } from '@/app/_actions/admin-atribuicao';

interface NavGroup {
  title: string;
  items: { label: string; href: string; icon: LucideIcon }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Geral',
    items: [{ label: 'Visão Geral', href: '/admin', icon: LayoutDashboard }],
  },
  {
    title: 'Controle',
    items: [
      { label: 'Usuários',          href: '/admin/usuarios',        icon: Users },
      { label: 'Gerenciar Contas',   href: '/admin/gerenciar-contas', icon: Settings2 },
      { label: 'Atribuir Médico',    href: '/admin/atribuir-medico', icon: UserPlus },
      { label: 'Médicos',            href: '/admin/medicos',         icon: Stethoscope },
      { label: 'Triagens',           href: '/admin/triagens',        icon: FileCheck },
    ],
  },
  {
    title: 'Mensagens',
    items: [
      { label: 'Mensagens',          href: '/admin/mensagens',       icon: MessageSquare },
      { label: 'Leads Ebooks',       href: '/admin/leads-ebooks',    icon: BookOpen },
    ],
  },
  {
    title: 'Financeiro',
    items: [
      { label: 'Invoices',           href: '/admin/invoices',        icon: Receipt },
      { label: 'Recompras',          href: '/admin/recompras',       icon: ShoppingCart },
    ],
  },
  {
    title: 'Segurança',
    items: [
      { label: 'Auditoria',          href: '/admin/auditoria',       icon: Shield },
    ],
  },
  {
    title: 'Configurações',
    items: [
      { label: 'Meu Perfil',         href: '/admin/perfil',          icon: User },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(true);
  const [naoLidas, setNaoLidas] = useState(0);
  const [semMedico, setSemMedico] = useState(0);
  const { signOut } = useClerk();

  useEffect(() => {
    if (window.innerWidth >= 1024) {
      setCollapsed(false);
    }
  }, []);

  useEffect(() => {
    function atualizarContagem() {
      contarContatosNaoLidos().then((r) => {
        if (r.sucesso && r.dados !== undefined) setNaoLidas(r.dados);
      });
      contarPacientesSemMedico().then((r) => {
        if (r.sucesso && r.dados !== undefined) setSemMedico(r.dados);
      });
    }

    // Busca ao montar e quando muda de rota
    atualizarContagem();

    // Escuta eventos para atualizar badges
    window.addEventListener('mensagens-atualizadas', atualizarContagem);
    window.addEventListener('paciente-atribuido', atualizarContagem);
    return () => {
      window.removeEventListener('mensagens-atualizadas', atualizarContagem);
      window.removeEventListener('paciente-atribuido', atualizarContagem);
    };
  }, [pathname]);

  /**
   * Retorna o badge de contagem para o item de navegação, se aplicável.
   */
  function renderBadge(href: string, isCollapsed: boolean) {
    if (href === '/admin/mensagens' && naoLidas > 0) {
      return (
        <span className={cn(
          'flex items-center justify-center rounded-full bg-primary font-bold text-primary-foreground shadow-sm transition-all',
          isCollapsed 
            ? 'absolute -right-1 -top-1 h-3 w-3' 
            : 'right-3 h-5 min-w-5 text-[10px] px-1'
        )}>
          {isCollapsed ? (
            <span className="h-1.5 w-1.5 animate-ping rounded-full bg-primary-foreground/80" />
          ) : (
            naoLidas > 99 ? '99+' : naoLidas
          )}
        </span>
      );
    }
    if (href === '/admin/atribuir-medico' && semMedico > 0) {
      return (
        <span className={cn(
          'flex items-center justify-center rounded-full bg-amber-500 font-bold text-white shadow-sm transition-all',
          isCollapsed 
            ? 'absolute -right-1 -top-1 h-3 w-3' 
            : 'right-3 h-5 min-w-5 text-[10px] px-1'
        )}>
          {isCollapsed ? (
            <span className="h-1.5 w-1.5 animate-ping rounded-full bg-white/80" />
          ) : (
            semMedico > 99 ? '99+' : semMedico
          )}
        </span>
      );
    }
    return null;
  }

  return (
    <>
      {/* Mobile Header */}
      <header className="lg:hidden flex h-16 w-full items-center justify-between border-b border-border/40 bg-sidebar/95 backdrop-blur-md px-4 shrink-0">
        <Link href="/admin" className="flex items-center">
          <img src="/logo.png" alt="Be4Hope" className="h-10 w-auto object-contain" />
        </Link>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-all"
          aria-label="Toggle Menu"
        >
          <Menu size={24} />
        </button>
      </header>

      {!collapsed && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={() => setCollapsed(true)}
        />
      )}

      <aside
        className={cn(
          'grain fixed inset-y-0 right-0 z-40 flex flex-col border-l border-border/40 bg-sidebar transition-all duration-300 lg:border-l-0 lg:border-r lg:left-0 lg:right-auto lg:sticky lg:top-0 lg:h-screen lg:shrink-0 lg:overflow-hidden lg:translate-x-0 w-[50vw] lg:w-64',
          collapsed ? 'translate-x-full lg:w-20' : 'translate-x-0',
        )}
      >
        <div
          className={cn(
            'flex h-16 items-center border-b border-border/40 transition-all duration-300',
            collapsed ? 'justify-center px-2' : 'px-4 justify-between',
          )}
        >
          {!collapsed && (
            <Link href="/admin" className="flex items-center gap-2 overflow-hidden shrink-0 animate-fade-in">
              <img
                src="/logo.png"
                alt="Be4Hope"
                className="h-9 w-auto object-contain shrink-0"
              />
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md shrink-0">
                Admin
              </span>
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
                    item.href === '/admin'
                      ? pathname === '/admin'
                      : pathname.startsWith(item.href);

                  const Icon = item.icon;
                  const badge = renderBadge(item.href, collapsed);

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
                      <div className="relative shrink-0 flex items-center justify-center">
                        <Icon size={20} />
                        {collapsed && badge}
                      </div>
                      {!collapsed && (
                        <span className="flex-1">{item.label}</span>
                      )}
                      {!collapsed && badge}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-border/40 p-3 bg-sidebar/50">
          <button onClick={() => signOut({ redirectUrl: '/' })} className={cn(
            'flex items-center gap-3 rounded-xl text-sm font-medium text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive w-full',
            collapsed ? 'h-10 justify-center' : 'px-3 py-2'
          )} title="Sair">
            <LogOut size={20} className="shrink-0" />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
