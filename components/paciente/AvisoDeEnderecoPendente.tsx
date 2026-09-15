/**
 * COMPLETE SEU ENDEREÇO — aviso do painel para quem ainda não tem CEP salvo.
 *
 * Mesmo padrão de `AvisoDeCadastroPendente`/`AvisoDaProcuracao`: o componente decide
 * sozinho se renderiza, a partir do estado real (`pacientes.cep IS NULL`, calculado em
 * `obterDadosDashboard`). Sem CEP pendente, não renderiza nada.
 *
 * ⚠️ AVISA, NÃO BLOQUEIA. É só um convite — o paciente segue usando o painel normalmente
 * sem preencher nada aqui.
 */
'use client';

import { MapPin } from 'lucide-react';

import { CepRapido } from './CepRapido';

export interface AvisoDeEnderecoPendenteProps {
  enderecoPendente: boolean;
  onSalvo: () => void;
}

export function AvisoDeEnderecoPendente({
  enderecoPendente,
  onSalvo,
}: AvisoDeEnderecoPendenteProps) {
  if (!enderecoPendente) return null;

  return (
    <div className="border-secondary/20 bg-secondary/5 animate-fade-up relative mb-5 overflow-hidden rounded-[1.75rem] border p-5 shadow-[var(--shadow-card)] sm:p-6">
      <div
        className="pointer-events-none absolute -top-14 -right-14 h-44 w-44 rounded-full opacity-40 blur-3xl"
        style={{ background: 'color-mix(in oklab, var(--secondary) 30%, transparent)' }}
      />

      <div className="relative z-10 flex items-start gap-4">
        <span className="bg-secondary/15 text-secondary flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm">
          <MapPin className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-foreground text-base font-bold">Complete seu endereço</p>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            Falta o seu CEP — é rápido: digite os números e preenchemos o resto.
          </p>
        </div>
      </div>

      <div className="relative z-10 mt-5">
        <CepRapido onSalvo={onSalvo} layout="horizontal" />
      </div>
    </div>
  );
}
