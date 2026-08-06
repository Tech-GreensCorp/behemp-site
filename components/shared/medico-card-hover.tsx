'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { Stethoscope, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MedicoCardHoverProps {
  id: string;
  nome: string;
  especialidade: string;
  bio: string | null;
  avatarUrl: string | null;
}

export function MedicoCardHover({
  nome,
  especialidade,
  bio,
  avatarUrl,
}: MedicoCardHoverProps) {
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleMouseEnter() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpen(true);
  }

  function handleMouseLeave() {
    timerRef.current = setTimeout(() => setOpen(false), 120);
  }

  return (
    <div
      className="group relative rounded-2xl border border-border/40 bg-card p-6 transition-all hover:shadow-lg hover:border-primary/30"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Foto */}
      <div className="mx-auto mb-4 h-24 w-24 overflow-hidden rounded-2xl bg-muted flex items-center justify-center">
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={`Dr. ${nome}`}
            width={96}
            height={96}
            className="h-full w-full object-cover"
          />
        ) : (
          <Stethoscope className="h-10 w-10 text-muted-foreground/50" />
        )}
      </div>

      {/* Info resumida */}
      <div className="text-center">
        <h3 className="font-semibold text-foreground">{nome}</h3>
        <p className="mt-1 text-xs font-medium text-primary">{especialidade}</p>
      </div>

      {/* Popover expandido */}
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          'absolute left-1/2 bottom-[calc(100%+10px)] z-50 w-80 -translate-x-1/2',
          'rounded-2xl border border-border/60 bg-card shadow-2xl',
          'transition-all duration-200',
          open
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-2 pointer-events-none',
        )}
      >
        {/* Seta */}
        <div className="absolute bottom-[-8px] left-1/2 -translate-x-1/2 w-4 h-4 rotate-45 border-r border-b border-border/60 bg-card" />

        <div className="p-5">
          {/* Cabeçalho */}
          <div className="flex items-center gap-4 mb-4">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted flex items-center justify-center">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={`Dr. ${nome}`}
                  width={64}
                  height={64}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Stethoscope className="h-7 w-7 text-muted-foreground/50" />
              )}
            </div>
            <div>
              <p className="font-semibold text-foreground leading-tight">{nome}</p>
              <p className="mt-0.5 text-xs font-medium text-primary leading-snug">
                {especialidade}
              </p>
            </div>
          </div>

          {/* Bio completa */}
          {bio ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {bio}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground/60 italic">
              Informações em breve.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
