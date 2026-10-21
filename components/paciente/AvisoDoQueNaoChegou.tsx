/**
 * O QUE O PARCEIRO ENVIOU E NÃO CHEGOU — a verdade que faltava.
 *
 * 🔴 ADR-0022, R6 e S8.4. O dono viu o painel dizer **"0 enviados"** e parou:
 * _"nenhum dos documentos que eu enviei chegaram na minha conta"_.
 *
 * ⚠️ E O PAINEL NÃO ESTAVA MENTINDO SOBRE O BANCO — estava mentindo sobre o MUNDO. Havia
 * zero linhas em `documentos`, e isso é verdade. Mas a Greens tinha entregado quatro, e a
 * materialização falhou **em silêncio** (`materializar-documentos.ts` devolve
 * `{ inseridos: 0 }` e nunca lança).
 *
 * 🔴 SÃO TRÊS COISAS DIFERENTES, e a tela dizia a mesma para todas:
 *
 *   1. **você não enviou**        → cobrar faz sentido
 *   2. **recebemos**              → nada a fazer
 *   3. **veio e não chegou**      → 🔴 é problema NOSSO, e o paciente não pode ser cobrado
 *
 * Cobrar do paciente um documento que ele já entregou é o pior dos três erros: ele sabe que
 * enviou, o sistema afirma que não, e a conversa começa com o paciente tendo de provar algo.
 *
 * ⚠️ AVISA, NÃO BLOQUEIA (ADR-0016 D-06): sem o ponto correspondente, não renderiza nada.
 */

'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';

const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_BEHEMP ?? '5511932047360';

export interface AvisoDoQueNaoChegouProps {
  /** O ponto que a sentinela devolveu. */
  ponto: string;
  /** O motivo dela, em uma frase — é o que a tela mostra em vez de inventar texto. */
  porque: string;
}

export function AvisoDoQueNaoChegou({ ponto, porque }: AvisoDoQueNaoChegouProps) {
  if (ponto !== 'documentos_nao_materializados') return null;

  const mensagem = encodeURIComponent(
    'Olá! Enviei meus documentos pela Greens Corp e eles não aparecem na minha conta da Be4Hope.',
  );

  return (
    <div className="animate-fade-up mb-5 rounded-3xl border border-amber-300/60 bg-amber-50/60 p-5">
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
          <AlertTriangle className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-foreground text-sm font-semibold">
            Seus documentos não chegaram até nós
          </p>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            {/*
              🔴 O TEXTO DIZ DE QUEM É O PROBLEMA, e isso não é delicadeza: é a diferença
              entre o paciente reenviar (trabalho dele, por falha nossa) e nós resolvermos.
            */}
            Você enviou, e eles não chegaram — <strong>isso é com a gente</strong>, não com você. Já
            sabemos e vamos buscar.
          </p>
          <p className="text-muted-foreground/80 mt-2 text-xs">{porque}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              className="rounded-xl"
              render={
                <Link
                  href={`https://wa.me/${WHATSAPP}?text=${mensagem}`}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              Falar com a gente
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
            {/*
              A opção de reenviar existe porque às vezes é mais rápido — mas vem em segundo
              lugar, e nunca como obrigação.
            */}
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl"
              render={<Link href="/paciente/documentos" />}
            >
              Prefiro enviar de novo
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
