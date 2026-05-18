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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import type { LucideIcon } from 'lucide-react';
import { contarContatosNaoLidos } from '@/app/(public)/_actions/contato';
import { contarPacientesSemMedico } from '@/app/_actions/admin-atribuicao';

const NAV_ITEMS: { label: string; href: string; icon: LucideIcon }[] = [
  { label: 'Visão Geral',        href: '/admin',                 icon: LayoutDashboard },
  { label: 'Usuários',            href: '/admin/usuarios',        icon: Users },
  { label: 'Gerenciar Contas',   href: '/admin/gerenciar-contas', icon: Settings2 },
  { label: 'Atribuir Médico',    href: '/admin/atribuir-medico', icon: UserPlus },
  { label: 'Triagens',           href: '/admin/triagens',        icon: FileCheck },
  { label: 'Mensagens',          href: '/admin/mensagens',       icon: MessageSquare },
  { label: 'Invoices',           href: '/admin/invoices',        icon: Receipt },
  { label: 'Recompras',          href: '/admin/recompras',       icon: ShoppingCart },
  { label: 'Auditoria',          href: '/admin/auditoria',       icon: Shield },
  { label: 'Meu Perfil',         href: '/admin/perfil',          icon: User },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [naoLidas, setNaoLidas] = useState(0);
  const [semMedico, setSemMedico] = useState(0);
  const { signOut } = useClerk();

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
  function renderBadge(href: string) {
    if (href === '/admin/mensagens' && naoLidas > 0) {
      return (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
          {naoLidas > 99 ? '99+' : naoLidas}
        </span>
      );
    }
    if (href === '/admin/atribuir-medico' && semMedico > 0) {
      return (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">
          {semMedico > 99 ? '99+' : semMedico}
        </span>
      );
    }
    return null;
  }

  return (
    <>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="fixed top-4 left-4 z-50 flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg lg:hidden"
        aria-label="Menu"
      >
        <Menu size={20} />
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
              <img src="/logo.png" alt="Be4Hope" className="h-12 w-auto" />
            ) : (
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
            <ChevronLeft
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

            const Icon = item.icon;
            const badge = !collapsed ? renderBadge(item.href) : null;

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
                <div className="relative shrink-0">
                  <Icon size={20} />
                  {/* Badge no modo collapsed */}
                  {collapsed && item.href === '/admin/atribuir-medico' && semMedico > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center rounded-full bg-amber-500">
                      <span className="h-2 w-2 animate-ping rounded-full bg-amber-400" />
                    </span>
                  )}
                  {collapsed && item.href === '/admin/mensagens' && naoLidas > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center rounded-full bg-primary">
                      <span className="h-2 w-2 animate-ping rounded-full bg-primary/60" />
                    </span>
                  )}
                </div>
                {!collapsed && (
                  <span className="flex-1">{item.label}</span>
                )}
                {badge}
              </Link>
            );
          })}
        </nav>

        <div className="border-t p-3">
          <button onClick={() => signOut({ redirectUrl: '/' })} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
            <LogOut size={20} className="shrink-0" />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
