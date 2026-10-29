'use client';

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useClerk } from '@clerk/nextjs';
import {
  ChevronLeft,
  LayoutDashboard,
  LogOut,
  Menu,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';

import { montarGruposDoMenu, type DependenteDoMenu, type ItemDoMenu } from '@/lib/dependentes/menu';
import { cn } from '@/lib/utils';

const ICONES: Record<NonNullable<ItemDoMenu['icone']>, LucideIcon> = {
  inicio: LayoutDashboard,
  dependentes: Users,
  pessoa: UserRound,
};

const CONSULTA_DESKTOP = '(min-width: 1024px)';

function assinarDesktop(avisar: () => void) {
  const mq = window.matchMedia(CONSULTA_DESKTOP);
  mq.addEventListener('change', avisar);
  return () => mq.removeEventListener('change', avisar);
}

function lerDesktop() {
  return window.matchMedia(CONSULTA_DESKTOP).matches;
}

/**
 * A barra lateral da área do responsável — o MESMO padrão visual da do paciente
 * (`components/shared/paciente-sidebar.tsx`): `sidebar-ambar`, grupos, item ativo, recolher e sair.
 *
 * 🔴 IDENTIFICAÇÃO DE A QUEM PERTENCE (pedido de Dryelle, 29/10/2026): os dependentes são itens do menu, com o
 * NOME de cada um. Ao abrir um, o menu mostra as seções DAQUELE dependente sob o nome dele; nunca uma lista de
 * "Medicamentos" solta que não diga de quem é.
 *
 * `paciente` que também é responsável ganha o grupo "Minha conta" com o caminho de volta à própria área.
 */
export function SidebarDoResponsavel({
  dependentes,
  temAreaDePaciente,
}: {
  dependentes: DependenteDoMenu[];
  temAreaDePaciente: boolean;
}) {
  const pathname = usePathname();
  const { signOut } = useClerk();
  // Desktop nasce expandido e mobile recolhido; o clique do usuário (`manual`) vence a largura da tela.
  const [manual, setManual] = useState<boolean | null>(null);
  const desktop = useSyncExternalStore(assinarDesktop, lerDesktop, () => false);
  const collapsed = manual ?? !desktop;
  const setCollapsed = setManual;

  const grupos = montarGruposDoMenu({ dependentes, pathname, temAreaDePaciente });

  const ativo = (item: ItemDoMenu) =>
    item.exato
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <>
      {/* Mobile Header */}
      <header className="sidebar-ambar flex h-16 w-full shrink-0 items-center justify-between px-4 shadow-sm lg:hidden">
        <Link href="/responsavel" className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Be4Hope"
            className="h-10 w-auto object-contain brightness-0 invert"
          />
        </Link>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-white/80 transition-all hover:bg-white/10 hover:text-white"
          aria-label="Menu"
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
          'sidebar-ambar fixed inset-y-0 right-0 z-40 flex w-[50vw] flex-col shadow-xl transition-all duration-300 lg:sticky lg:top-0 lg:right-auto lg:left-0 lg:h-screen lg:w-64 lg:shrink-0 lg:translate-x-0 lg:overflow-hidden',
          collapsed ? 'translate-x-full lg:w-20' : 'translate-x-0',
        )}
      >
        <div
          className={cn(
            'flex h-16 items-center border-b border-white/15 transition-all duration-300',
            collapsed ? 'justify-center px-2' : 'justify-between px-4',
          )}
        >
          {!collapsed && (
            <Link href="/responsavel" className="flex shrink-0 items-center gap-2 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="Be4Hope"
                className="h-9 w-auto shrink-0 object-contain brightness-0 invert"
              />
            </Link>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/75 transition-all hover:bg-white/10 hover:text-white"
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            <ChevronLeft
              size={18}
              className={cn(
                'rotate-180 transition-transform duration-300 lg:rotate-0',
                collapsed && 'lg:rotate-180',
              )}
            />
          </button>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto p-3">
          {grupos.map((grupo, i) => (
            <div key={grupo.title} className="space-y-1">
              {i > 0 && collapsed && <div className="mx-1 my-2 h-px bg-white/15" />}
              {!collapsed && (
                <p className="mt-2 mb-1.5 truncate px-3 text-[10px] font-bold tracking-wider text-white/45 uppercase">
                  {grupo.title}
                </p>
              )}
              <div className="space-y-1">
                {grupo.items.map((item) => {
                  const Icon = item.icone ? ICONES[item.icone] : undefined;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={item.label}
                      onClick={() => {
                        if (window.innerWidth < 1024) setCollapsed(true);
                      }}
                      className={cn(
                        'relative flex items-center gap-3 rounded-xl border border-transparent px-3 py-2 text-sm font-medium transition-all duration-200',
                        ativo(item)
                          ? 'border-white/20 bg-white/16 font-semibold text-white shadow-sm'
                          : 'text-white/78 hover:translate-x-0.5 hover:bg-white/10 hover:text-white',
                      )}
                    >
                      {Icon && <Icon size={20} className="shrink-0" />}
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/15 p-3">
          <button
            onClick={() => signOut({ redirectUrl: '/' })}
            className={cn(
              'flex w-full items-center gap-3 rounded-xl text-sm font-medium text-white/75 transition-all hover:bg-white/10 hover:text-white',
              collapsed ? 'h-10 justify-center' : 'px-3 py-2',
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
