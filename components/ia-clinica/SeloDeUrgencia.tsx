'use client';

/**
 * O selo de urgência — o gatilho do `DO-42` na tela.
 *
 * > "a anamnese precisa ser bem especifica para evitar que medicamentos errados sejam prescritos
 * > pela IA, para evitar erro humano e evitar que a IA erre justamente por falta desses gatilhos,
 * > ou seja precisamos disso na tela"
 *
 * 🔴 O NÍVEL VEM DE `lib/ia-clinica/urgencia.ts`, SEMPRE. Este componente não decide nada — não
 * há `switch` de urgência aqui. Um segundo mapa faria duas telas divergirem, e as duas
 * continuariam plausíveis (ADR-0013 D-01, rejeitado R-01).
 *
 * 🔴 VALOR FORA DO CONTRATO DENUNCIA. Cair para "rotina" no `default` afirmaria "sem urgência" a
 * partir de um valor que ninguém entendeu — numa tela cuja função é alertar, é a pior saída
 * possível (ADR-0013 D-03, rejeitado R-05). Mesmo desenho da ADR-0009 §4 para procedência.
 *
 * 🔴 COR SÓ DE `--chart-*`. Nenhum hex novo (proibição nº 3).
 */

import { AlertTriangle, CircleAlert, HelpCircle, ShieldCheck, Siren } from 'lucide-react';

import { urgenciaParaTela, type NivelDeUrgencia } from '@/lib/ia-clinica/urgencia';
import { cn } from '@/lib/utils';

const ICONE: Record<NivelDeUrgencia, typeof ShieldCheck> = {
  rotina: ShieldCheck,
  atencao: CircleAlert,
  emergencia: AlertTriangle,
  critico: Siren,
};

interface Props {
  urgencia: string | null | undefined;
  /** `completude.red_flags_nao_explicadas` — é o que eleva emergência a crítico (`DO-51`). */
  redFlagsNaoExplicadas?: number | null;
  /** `denso` cabe no sidebar de 380px: só ícone e rótulo curto. */
  denso?: boolean;
  className?: string;
}

export function SeloDeUrgencia({
  urgencia,
  redFlagsNaoExplicadas,
  denso = false,
  className,
}: Props) {
  const aparencia = urgenciaParaTela(urgencia, redFlagsNaoExplicadas);

  // Valor que o contrato não declara: mostra o valor CRU e avisa. Não cai, não assume.
  if (!aparencia) {
    return (
      <span
        className={cn(
          'border-destructive/40 bg-destructive/5 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs',
          className,
        )}
        role="status"
      >
        <HelpCircle size={13} className="text-destructive" />
        <span className="text-destructive">
          urgência desconhecida{urgencia ? `: ${urgencia}` : ''}
        </span>
      </span>
    );
  }

  const Icone = ICONE[aparencia.nivel];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1',
        denso ? 'text-[0.7rem]' : 'text-xs',
        // `animate-gentle-pulse` só no nível máximo — animação que está sempre ligada deixa de
        // significar alguma coisa. É a animação que JÁ existe; nenhuma nova (proibição nº 3).
        aparencia.ehMaximo && 'animate-gentle-pulse',
        className,
      )}
      style={{
        borderColor: `color-mix(in srgb, ${aparencia.token} 45%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${aparencia.token} 8%, transparent)`,
        color: aparencia.token,
      }}
      role="status"
      // O rótulo curto cabe na aba estreita; a explicação inteira fica no title, para quem
      // precisa dela sem ocupar espaço de quem não precisa.
      title={aparencia.explicacao}
    >
      <Icone size={denso ? 12 : 13} className="shrink-0" />
      <span className="font-medium">{aparencia.rotulo}</span>
    </span>
  );
}

/**
 * A versão explicada, para quando há espaço — abre acima das hipóteses, porque o nível de
 * urgência **calibra a leitura de todas elas** (mesmo raciocínio do banner de análise parcial,
 * P3 do VidAI).
 */
export function AvisoDeUrgencia({
  urgencia,
  redFlagsNaoExplicadas,
  className,
}: Omit<Props, 'denso'>) {
  const aparencia = urgenciaParaTela(urgencia, redFlagsNaoExplicadas);
  if (!aparencia || aparencia.nivel === 'rotina') return null;

  const Icone = ICONE[aparencia.nivel];

  return (
    <div
      className={cn('animate-fade-in flex items-start gap-3 rounded-xl border p-4', className)}
      style={{
        borderColor: `color-mix(in srgb, ${aparencia.token} 45%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${aparencia.token} 8%, transparent)`,
      }}
      role="alert"
    >
      <Icone size={18} className="mt-0.5 shrink-0" style={{ color: aparencia.token }} />
      <div className="space-y-1">
        <p className="font-heading text-sm font-semibold" style={{ color: aparencia.token }}>
          {aparencia.rotulo}
        </p>
        <p className="text-muted-foreground text-xs leading-relaxed">{aparencia.explicacao}</p>
      </div>
    </div>
  );
}
