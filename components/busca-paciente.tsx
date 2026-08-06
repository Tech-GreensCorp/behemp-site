'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, User, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Paciente {
  id: string;
  nome: string;
  email: string;
}

interface BuscaPacienteProps {
  pacientes: Paciente[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

function getIniciais(nome: string) {
  const partes = nome.trim().split(' ').filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0][0].toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

function normalizar(str: string) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function BuscaPaciente({
  pacientes,
  value,
  onChange,
  placeholder = 'Buscar paciente por nome ou e-mail...',
  disabled = false,
}: BuscaPacienteProps) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [indice, setIndice] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLUListElement>(null);

  const pacienteSelecionado = pacientes.find((p) => p.id === value) ?? null;

  // Filtro de pacientes
  const filtrados = useCallback(() => {
    if (!busca.trim()) return pacientes;
    const termo = normalizar(busca);
    return pacientes.filter(
      (p) =>
        normalizar(p.nome).includes(termo) ||
        normalizar(p.email).includes(termo)
    );
  }, [busca, pacientes])();

  // Fecha ao clicar fora
  useEffect(() => {
    function handleClickFora(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false);
        setBusca('');
        setIndice(-1);
      }
    }
    document.addEventListener('mousedown', handleClickFora);
    return () => document.removeEventListener('mousedown', handleClickFora);
  }, []);

  // Scroll automático no item destacado
  useEffect(() => {
    if (indice >= 0 && listaRef.current) {
      const item = listaRef.current.children[indice] as HTMLElement;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [indice]);

  function abrirDropdown() {
    if (disabled) return;
    setAberto(true);
    setBusca('');
    setIndice(-1);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function selecionar(id: string) {
    onChange(id);
    setAberto(false);
    setBusca('');
    setIndice(-1);
  }

  function limpar(e: React.MouseEvent) {
    e.stopPropagation();
    onChange('');
    setBusca('');
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!aberto) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndice((i) => Math.min(i + 1, filtrados.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndice((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (indice >= 0 && filtrados[indice]) selecionar(filtrados[indice].id);
    } else if (e.key === 'Escape') {
      setAberto(false);
      setBusca('');
      setIndice(-1);
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger / Campo exibidor */}
      {!aberto ? (
        <button
          type="button"
          onClick={abrirDropdown}
          disabled={disabled}
          className={cn(
            'flex w-full items-center gap-3 rounded-xl border bg-background px-3 py-2.5 text-sm transition-all',
            'hover:border-[#C08E3A]/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C08E3A]/40',
            disabled && 'cursor-not-allowed opacity-50',
            pacienteSelecionado
              ? 'border-[#C08E3A]/40 bg-[#C08E3A]/5'
              : 'border-border'
          )}
        >
          {pacienteSelecionado ? (
            <>
              {/* Avatar com iniciais */}
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#C08E3A] text-[11px] font-bold text-white">
                {getIniciais(pacienteSelecionado.nome)}
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate font-medium">
                  {pacienteSelecionado.nome}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {pacienteSelecionado.email}
                </span>
              </span>
              <button
                type="button"
                onClick={limpar}
                className="rounded p-0.5 hover:bg-muted"
                title="Remover seleção"
              >
                <X size={14} className="text-muted-foreground" />
              </button>
            </>
          ) : (
            <>
              <User size={16} className="shrink-0 text-muted-foreground" />
              <span className="flex-1 text-left text-muted-foreground">
                {placeholder}
              </span>
              <ChevronDown size={16} className="shrink-0 text-muted-foreground" />
            </>
          )}
        </button>
      ) : (
        /* Campo de busca ativo */
        <div className="flex items-center gap-2 rounded-xl border border-[#C08E3A]/60 bg-background px-3 py-2.5 ring-2 ring-[#C08E3A]/20">
          <Search size={16} className="shrink-0 text-[#C08E3A]" />
          <input
            ref={inputRef}
            type="text"
            value={busca}
            onChange={(e) => { setBusca(e.target.value); setIndice(-1); }}
            onKeyDown={handleKeyDown}
            placeholder="Digite o nome ou e-mail do paciente..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            autoComplete="off"
          />
          {busca && (
            <button
              type="button"
              onClick={() => { setBusca(''); setIndice(-1); inputRef.current?.focus(); }}
              className="rounded p-0.5 hover:bg-muted"
            >
              <X size={14} className="text-muted-foreground" />
            </button>
          )}
        </div>
      )}

      {/* Dropdown de resultados */}
      {aberto && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border bg-popover shadow-xl ring-1 ring-black/5">
          {/* Contador */}
          <div className="border-b px-3 py-1.5 text-[11px] text-muted-foreground">
            {filtrados.length === 0
              ? 'Nenhum paciente encontrado'
              : `${filtrados.length} paciente${filtrados.length !== 1 ? 's' : ''} encontrado${filtrados.length !== 1 ? 's' : ''}`}
          </div>

          <ul
            ref={listaRef}
            className="max-h-64 overflow-y-auto py-1"
            role="listbox"
          >
            {filtrados.length === 0 ? (
              <li className="flex flex-col items-center gap-1 py-8 text-center">
                <User size={28} className="text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  {busca
                    ? `Nenhum resultado para "${busca}"`
                    : 'Nenhum paciente disponível'}
                </p>
              </li>
            ) : (
              filtrados.map((p, i) => {
                const selecionado = p.id === value;
                const destacado = i === indice;
                return (
                  <li
                    key={p.id}
                    role="option"
                    aria-selected={selecionado}
                    onClick={() => selecionar(p.id)}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors',
                      destacado && 'bg-accent',
                      selecionado && !destacado && 'bg-[#C08E3A]/8',
                      !destacado && !selecionado && 'hover:bg-accent/60'
                    )}
                  >
                    {/* Avatar com iniciais */}
                    <span
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                        selecionado
                          ? 'bg-[#C08E3A] text-white'
                          : 'bg-primary/10 text-primary'
                      )}
                    >
                      {getIniciais(p.nome)}
                    </span>

                    {/* Info */}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {destacarTermo(p.nome, busca)}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {destacarTermo(p.email, busca)}
                      </span>
                    </span>

                    {/* Check se selecionado */}
                    {selecionado && (
                      <Check size={14} className="shrink-0 text-[#C08E3A]" />
                    )}
                  </li>
                );
              })
            )}
          </ul>

          {/* Rodapé com dicas de teclado */}
          <div className="border-t px-3 py-1.5 text-[10px] text-muted-foreground/60 flex gap-3">
            <span>↑↓ navegar</span>
            <span>Enter selecionar</span>
            <span>Esc fechar</span>
          </div>
        </div>
      )}
    </div>
  );
}

/** Destaca o termo buscado no texto */
function destacarTermo(texto: string, termo: string) {
  if (!termo.trim()) return <>{texto}</>;
  const regex = new RegExp(`(${termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const partes = texto.split(regex);
  return (
    <>
      {partes.map((parte, i) =>
        regex.test(parte) ? (
          <mark key={i} className="bg-[#C08E3A]/25 text-inherit rounded-sm px-0.5">
            {parte}
          </mark>
        ) : (
          <span key={i}>{parte}</span>
        )
      )}
    </>
  );
}
