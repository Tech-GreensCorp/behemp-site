'use client';

/**
 * O fim do passo a passo da ANVISA: pedir ajuda e, se liberada, a procuração — ADR-0029 D-02 e
 * D-06 (`DO-71`).
 *
 *   1. "Atendimento com suporte" registra um PEDIDO. O clique sempre dá retorno: quem clica e não
 *      vê resposta clica de novo e conclui que o site travou.
 *   2. Logo abaixo, "Be4Hope faz por mim" — só quando a procuração está liberada: o admin ativou
 *      o pedido, ou o paciente já estava na procuração antes da mudança (D-08).
 *
 * ⚠️ A liberação que vale é a do SERVIDOR (`definirModalidadeAnvisa` confere de novo). Esconder o
 * botão aqui é só para não oferecer o que o servidor vai recusar.
 */
import { useEffect, useState, useTransition } from 'react';
import { CheckCircle2, Headphones, Loader2, ShieldCheck, Users } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  lerMeuPedidoDeAtendimento,
  pedirAtendimentoAssistido,
} from '@/app/_actions/pedido-atendimento-assistido';
import { podeEntrarNaRepresentacao, type StatusDoPedido } from '@/lib/anvisa/pedido-de-atendimento';

interface Props {
  autorizacaoId: string;
  modalidadeAtual: 'guiada' | 'representacao';
  /** O mesmo caminho do antigo cartão "Be4Hope faz por mim": liga a modalidade e abre o checklist. */
  onBe4HopeFazPorMim: () => Promise<void>;
}

export function AtendimentoComSuporte({
  autorizacaoId,
  modalidadeAtual,
  onBe4HopeFazPorMim,
}: Props) {
  const [status, setStatus] = useState<StatusDoPedido | null>(null);
  const [carregou, setCarregou] = useState(false);
  const [enviando, iniciarEnvio] = useTransition();
  const [abrindo, iniciarAbertura] = useTransition();

  useEffect(() => {
    let ativo = true;
    lerMeuPedidoDeAtendimento({ autorizacaoId })
      .then((r) => {
        if (ativo && r.sucesso) setStatus(r.dados?.status ?? null);
      })
      // Rede caída não pode deixar o botão desabilitado para sempre: o pedido se tenta no clique,
      // e o servidor é idempotente — pedir de novo devolve o pedido que já existir.
      .catch(() => {})
      .finally(() => {
        if (ativo) setCarregou(true);
      });
    return () => {
      ativo = false;
    };
  }, [autorizacaoId]);

  // Pedido concluído é passado: um pedido novo pode ser feito.
  const pedidoAberto = status === 'aguardando_ativacao' || status === 'pendente_autorizacao';
  const liberada = podeEntrarNaRepresentacao({ modalidadeAtual, statusDoPedido: status });

  const pedir = () =>
    iniciarEnvio(async () => {
      const r = await pedirAtendimentoAssistido({ autorizacaoId }).catch(() => ({
        sucesso: false as const,
        dados: undefined,
        erro: 'Sem conexão. Confira a internet e tente de novo.',
      }));
      if (r.sucesso && r.dados) {
        setStatus(r.dados.status);
        toast.success('Recebemos seu pedido. Nossa equipe vai entrar em contato.');
      } else {
        toast.error(r.erro ?? 'Não conseguimos registrar seu pedido. Tente de novo.');
      }
    });

  return (
    <div className="space-y-3">
      <div className="border-border space-y-3 rounded-2xl border bg-white p-5">
        <div className="flex items-start gap-3">
          <div className="bg-primary/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
            <Headphones className="text-primary h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-foreground text-sm font-semibold">
              Precisa de ajuda com o passo a passo?
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
              Peça atendimento e nossa equipe entra em contato para te acompanhar.
            </p>
          </div>
        </div>

        {pedidoAberto ? (
          <div
            role="status"
            className="flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 p-3"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-hidden="true" />
            <p className="text-xs leading-relaxed text-green-700">
              Recebemos seu pedido. Nossa equipe vai entrar em contato.
            </p>
          </div>
        ) : (
          <Button onClick={pedir} disabled={!carregou || enviando} className="w-full gap-2">
            {enviando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Headphones className="h-4 w-4" />
            )}
            Atendimento com suporte
          </Button>
        )}
      </div>

      {liberada && (
        <button
          type="button"
          disabled={abrindo}
          onClick={() => iniciarAbertura(onBe4HopeFazPorMim)}
          className="group border-border hover:border-secondary/50 w-full space-y-3 rounded-2xl border-2 bg-white p-5 text-left transition-all hover:shadow-md disabled:opacity-60"
        >
          <div className="bg-secondary/10 flex h-12 w-12 items-center justify-center rounded-2xl">
            {abrindo ? (
              <Loader2 className="text-secondary h-6 w-6 animate-spin" />
            ) : (
              <Users className="text-secondary h-6 w-6" />
            )}
          </div>
          <div>
            <p className="font-display text-foreground text-base font-bold">Be4Hope faz por mim</p>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              Assine a Procuração Específica e nossa equipe cuida de todo o processo junto à ANVISA
              por você.
            </p>
          </div>
          <div className="text-secondary flex items-center gap-1.5 text-xs font-semibold">
            <ShieldCheck className="h-3.5 w-3.5" />
            Procuração Específica · Equipe Be4Hope
          </div>
        </button>
      )}
    </div>
  );
}
