'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowRight01Icon } from '@hugeicons/core-free-icons';
import type { PacienteKanban } from '@/app/_actions/pacientes';

/**
 * Card de paciente para o Kanban da Jornada.
 * Design: Organic / Editorial Caloroso — cantos arredondados, tons quentes,
 * transições suaves 300ms, tipografia Epilogue body + Fraunces accents.
 */

const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  aguardando_consulta: { label: 'Pendente', variant: 'outline' },
  em_tratamento: { label: 'Ativo', variant: 'secondary' },
  concluido: { label: 'Concluído', variant: 'default' },
};

const TRATAMENTO_LABEL: Record<string, string> = {
  cbd: 'CBD',
  thc: 'THC',
  cbd_thc: 'CBD + THC',
};

/** Mascara parcialmente o CPF para exibição segura */
function mascararCpf(cpf: string | null): string {
  if (!cpf) return '';
  const limpo = cpf.replace(/\D/g, '');
  if (limpo.length < 11) return cpf;
  return `${limpo.slice(0, 3)}.•••.•••-${limpo.slice(9, 11)}`;
}

/** Formata telefone de forma compacta */
function formatarTelefone(tel: string | null): string {
  if (!tel) return '';
  const limpo = tel.replace(/\D/g, '');
  if (limpo.length === 11) {
    return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 7)}-${limpo.slice(7)}`;
  }
  return tel;
}

interface PacienteCardProps {
  paciente: PacienteKanban;
  onDragStart: (e: React.DragEvent, pacienteId: string) => void;
  /** Cor hex da coluna (ex: '#1A6B41') — usada na barra lateral e no badge */
  accentColor?: string;
  /** Modo compacto: linha slim em vez do card completo */
  compact?: boolean;
}

export function PacienteCard({ paciente, onDragStart, accentColor, compact = false }: PacienteCardProps) {
  const statusInfo = STATUS_BADGE[paciente.status] ?? STATUS_BADGE.em_tratamento;
  const cpfFormatado = mascararCpf(paciente.cpf);
  const telefoneFormatado = formatarTelefone(paciente.telefone);

  /* ── Modo compacto: uma linha slim ── */
  if (compact) {
    return (
      <TooltipProvider>
        <div
          draggable
          onDragStart={(e) => onDragStart(e, paciente.id)}
          className="
            group flex items-center gap-2.5 cursor-grab
            rounded-xl border border-border/40 bg-card px-3 py-2
            transition-all duration-200 ease-out
            hover:border-border/70 hover:shadow-sm
            active:cursor-grabbing active:opacity-70
          "
        >
          {/* Avatar slim colorido */}
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white"
            style={{ backgroundColor: accentColor ?? '#888' }}
          >
            {paciente.nome.charAt(0).toUpperCase()}
          </div>

          {/* Nome */}
          <span className="flex-1 truncate text-sm font-medium text-foreground">
            {paciente.nome}
          </span>

          {/* Badge status */}
          <span
            className="shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{
              backgroundColor: accentColor ? `${accentColor}22` : undefined,
              color: accentColor ?? undefined,
              border: `1px solid ${accentColor ? `${accentColor}44` : 'transparent'}`,
            }}
          >
            {statusInfo.label}
          </span>

          {/* Link — aparece no hover */}
          <Tooltip>
            <TooltipTrigger
              render={
                <Link
                  href={`/medico/pacientes/${paciente.id}`}
                  draggable={false}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground/40 transition-all duration-200 hover:bg-accent hover:text-foreground opacity-0 group-hover:opacity-100"
                />
              }
            >
              <HugeiconsIcon icon={ArrowRight01Icon} size={12} />
            </TooltipTrigger>
            <TooltipContent>Ver paciente</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <div
        draggable
        onDragStart={(e) => onDragStart(e, paciente.id)}
        className="
          group relative cursor-grab
          rounded-2xl border border-border/40 bg-card
          p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]
          transition-all duration-300 ease-out
          hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:border-border/70 hover:-translate-y-0.5
          active:cursor-grabbing active:shadow-[0_8px_24px_rgba(0,0,0,0.12)] active:scale-[1.015]
        "
      >
        {/* Barra lateral decorativa (cor da fase) */}
        <div
          className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full transition-colors duration-300"
          style={{ backgroundColor: accentColor ?? 'var(--color-secondary)', opacity: accentColor ? 0.8 : 0.3 }}
        />

        {/* Conteúdo principal */}
        <div className="pl-3">
          {/* Header: avatar + nome + seta */}
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-heading text-sm font-semibold text-white"
              style={{ backgroundColor: accentColor ?? undefined }}
            >
              {paciente.nome.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground leading-tight">
                {paciente.nome}
              </p>
              {cpfFormatado && (
                <p className="mt-0.5 text-[11px] text-muted-foreground tracking-wide">
                  {cpfFormatado}
                </p>
              )}
            </div>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Link
                    href={`/medico/pacientes/${paciente.id}`}
                    draggable={false}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground/40 transition-all duration-200 hover:bg-accent hover:text-foreground opacity-0 group-hover:opacity-100"
                  />
                }
              >
                <HugeiconsIcon icon={ArrowRight01Icon} size={14} />
              </TooltipTrigger>
              <TooltipContent>Ver paciente</TooltipContent>
            </Tooltip>
          </div>

          {/* Telefone */}
          {telefoneFormatado && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              {telefoneFormatado}
            </p>
          )}

          {/* Badges */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {/* Badge de status com a cor da fase */}
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{
                backgroundColor: accentColor ? `${accentColor}22` : undefined,
                color: accentColor ?? undefined,
                border: `1px solid ${accentColor ? `${accentColor}44` : 'transparent'}`,
              }}
            >
              {statusInfo.label}
            </span>
            {paciente.tratamentoTipo && (
              <Badge variant="outline" className="text-[10px] h-[18px]">
                {TRATAMENTO_LABEL[paciente.tratamentoTipo] ?? paciente.tratamentoTipo}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
