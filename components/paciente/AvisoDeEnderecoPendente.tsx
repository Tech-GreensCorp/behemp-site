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

export function AvisoDeEnderecoPendente({ enderecoPendente, onSalvo }: AvisoDeEnderecoPendenteProps) {
  if (!enderecoPendente) return null;

  return (
    <div className="animate-fade-up border-secondary/30 bg-secondary/5 mb-5 rounded-3xl border p-5">
      <div className="flex items-start gap-4">
        <span className="bg-secondary/15 text-secondary flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl">
          <MapPin className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-foreground text-sm font-semibold">Complete seu endereço</p>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            Falta o seu CEP — é rápido: digite os números e preenchemos o resto.
          </p>

          <div className="mt-4 max-w-xs">
            <CepRapido onSalvo={onSalvo} />
          </div>
        </div>
      </div>
    </div>
  );
}
