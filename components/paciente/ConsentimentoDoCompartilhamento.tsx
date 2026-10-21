'use client';

/**
 * O CONSENTIMENTO DO COMPARTILHAMENTO — a tela onde o paciente escolhe.
 *
 * Até 11/09/2026 a P5 lia um consentimento que **nenhuma tela colhia**. A regra existia, o
 * registro existia, e o ato não acontecia em lugar nenhum. Este componente é o ato.
 *
 * 🔴 AS CAIXAS NASCEM DESMARCADAS, E ISSO NÃO É DETALHE DE UX.
 *
 * Caixa pré-marcada não é consentimento: a LGPD exige manifestação **livre, informada e
 * inequívoca** (art. 5º, XII) e declara nulas as autorizações genéricas (art. 8º §4º). O
 * mesmo princípio está escrito com todas as letras no Recital 32 do GDPR — _"silence,
 * pre-ticked boxes or inactivity should not constitute consent"_. Marcar por ele e registrar
 * como se fosse escolha dele é registrar uma afirmação falsa.
 *
 * 🔴 E NADA AQUI BLOQUEIA O CADASTRO.
 *
 * É a lição que já está escrita no guarda `consentimento-governa-a-ia-nao-a-consulta`:
 * consentimento que é pedágio não é livre, e aceite obtido sob condição é nulo (art. 8º §3º).
 * A avaliação médica em si se sustenta na tutela da saúde (art. 11, II, "f") — o que **depende
 * de consentimento** é o compartilhamento com a outra empresa, e é isso que se pergunta.
 *
 * ⚠️ O texto mostrado é o MESMO que se grava (`TEXTO_DO_CONSENTIMENTO`). Ele não vive na tela
 * de propósito: o que vale é o que a pessoa leu, e uma cópia paralela aqui envelheceria sem
 * ninguém perceber.
 */

import { Check, ShieldCheck } from 'lucide-react';

import {
  FINALIDADES,
  ROTULOS_DAS_FINALIDADES,
  TEXTO_DO_CONSENTIMENTO,
  VERSAO_DO_CONSENTIMENTO,
  type Finalidade,
} from '@/lib/parceiros/consentimento';
import { cn } from '@/lib/utils';

/** A ordem da tela. Fixa, para o registro e a leitura conversarem. */
const ORDEM: Finalidade[] = [
  FINALIDADES.avaliacaoMedica,
  FINALIDADES.apoioAnvisa,
  FINALIDADES.retornoAoParceiro,
];

interface Props {
  /** Controlado por quem usa: o cadastro guarda no formulário, a tela de privacidade no banco. */
  selecionadas: Finalidade[];
  onChange: (finalidades: Finalidade[]) => void;
  desabilitado?: boolean;
}

export function ConsentimentoDoCompartilhamento({
  selecionadas,
  onChange,
  desabilitado = false,
}: Props) {
  function alternar(finalidade: Finalidade) {
    if (desabilitado) return;
    onChange(
      selecionadas.includes(finalidade)
        ? selecionadas.filter((f) => f !== finalidade)
        : [...selecionadas, finalidade],
    );
  }

  return (
    <section
      aria-labelledby="titulo-do-consentimento"
      className="border-border/70 bg-card/50 space-y-4 rounded-2xl border p-5"
    >
      <div className="flex items-start gap-3">
        <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-xl">
          <ShieldCheck size={17} />
        </span>
        <div className="space-y-1">
          <h3 id="titulo-do-consentimento" className="text-foreground text-sm font-semibold">
            O que você autoriza
          </h3>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Marque o que você autoriza. Você pode mudar de ideia depois, a qualquer momento, no seu
            painel — e nada aqui é obrigatório para criar a sua conta.
          </p>
        </div>
      </div>

      {/* O texto integral, visível. Escondê-lo atrás de um link tornaria "informado" uma
          figura de linguagem. */}
      <p className="text-muted-foreground border-border/60 border-l-2 pl-3 text-xs leading-relaxed italic">
        {TEXTO_DO_CONSENTIMENTO}
      </p>

      <ul className="space-y-2">
        {ORDEM.map((finalidade) => {
          const marcada = selecionadas.includes(finalidade);
          const rotulo = ROTULOS_DAS_FINALIDADES[finalidade];
          return (
            <li key={finalidade}>
              <button
                type="button"
                role="checkbox"
                aria-checked={marcada}
                disabled={desabilitado}
                onClick={() => alternar(finalidade)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors',
                  marcada
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border/60 hover:border-border',
                  desabilitado && 'cursor-not-allowed opacity-60',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition-colors',
                    marcada ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
                  )}
                >
                  {marcada && <Check size={11} strokeWidth={3} />}
                </span>
                <span className="space-y-0.5">
                  <span className="text-foreground block text-xs font-medium">{rotulo.titulo}</span>
                  {/* O efeito de recusar, sempre visível — não só quando ela está desmarcada.
                      Aparecer só na recusa transformaria a informação em repreensão. */}
                  <span className="text-muted-foreground block text-[11px] leading-relaxed">
                    {rotulo.efeitoSeRecusar}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* A versão fica à vista: é ela que diz a QUE texto ele disse sim (art. 8º §6º). */}
      <p className="text-muted-foreground/70 text-[10px]">
        Versão do termo: {VERSAO_DO_CONSENTIMENTO}
      </p>
    </section>
  );
}
