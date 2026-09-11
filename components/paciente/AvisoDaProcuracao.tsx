'use client';

/**
 * P2 — O AVISO QUE OFERECE A PROCURAÇÃO, COM AÇÃO RÁPIDA.
 *
 * Pedido por quatro passos, em quatro fluxos diferentes: Greens 2 (5b), Greens 4 (4),
 * BeHemp 3 (3) e BeHemp 4 (4). Sempre a mesma coisa — terminada a consulta, avisar que falta a
 * autorização e levar à procuração em um clique.
 *
 * 🔴 A PARTE DIFÍCIL JÁ ESTAVA FEITA. Desde 10/09 o cadastro grava a declaração "não tenho
 * ANVISA". Este componente não pergunta nada: usa o que o paciente já respondeu. Perguntar de
 * novo seria o mesmo erro que o dono apontou na tela de cadastro.
 *
 * ⚠️ AVISA, NÃO BLOQUEIA (ADR-0016 D-06). Ele pode fechar e seguir usando a plataforma. A
 * procuração é um caminho oferecido, não um pedágio — barrar quem não tem autorização seria
 * barrar justamente quem veio resolver isso.
 */

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, FileCheck, X } from 'lucide-react';

interface Props {
  /** Só aparece quando é verdade: o paciente declarou que não tem, e ela segue faltando. */
  precisaDaProcuracao: boolean;
  /** Onde a procuração vive. Em variável para a tela não fixar rota que pode mudar. */
  destino?: string;
}

export function AvisoDaProcuracao({ precisaDaProcuracao, destino = '/paciente/anvisa' }: Props) {
  /**
   * Fechar vale para a sessão, não para sempre.
   *
   * Guardar "ele fechou" no banco esconderia o aviso de alguém que fechou sem ler, e a
   * autorização continuaria faltando — o sistema teria decidido por ele que o assunto está
   * encerrado. Na próxima visita, o aviso volta.
   */
  const [fechado, setFechado] = useState(false);

  if (!precisaDaProcuracao || fechado) return null;

  return (
    <div className="border-primary/25 bg-primary/5 animate-fade-up relative rounded-2xl border p-5">
      <button
        type="button"
        onClick={() => setFechado(true)}
        aria-label="Fechar aviso"
        className="text-muted-foreground hover:text-foreground absolute top-4 right-4 transition-colors"
      >
        <X size={16} />
      </button>

      <div className="flex items-start gap-4 pr-6">
        <span className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
          <FileCheck size={19} />
        </span>
        <div className="space-y-2">
          <h3 className="text-foreground text-sm font-semibold">
            Falta a sua autorização da ANVISA
          </h3>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Ela é o que permite importar o medicamento. Nós preparamos a procuração com os
            documentos que você já enviou — você só confere e assina.
          </p>
          <Link
            href={destino}
            className="text-primary inline-flex items-center gap-1.5 pt-1 text-xs font-medium transition-opacity hover:opacity-70"
          >
            Fazer a procuração agora
            <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </div>
  );
}
