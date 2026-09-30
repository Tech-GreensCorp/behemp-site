'use client';

/**
 * "Pedidos de atendimento assistido" em `/admin/anvisa` — ADR-0029 D-03 e D-04 (`DO-71`, `DO-72`).
 *
 * Cada paciente que clicou em "Atendimento com suporte" é um item que abre e fecha. Fechado: nome,
 * situação e desde quando pediu. Aberto: "Ativar procuração" (ou "Desativar"). Ativar é o que faz
 * "Be4Hope faz por mim" aparecer para o paciente.
 *
 * O que NÃO aparece aqui, de propósito: CPF, e-mail, documentos (LGPD art. 6º, III). Só o
 * necessário para agir; o cartão da autorização, mais abaixo na mesma tela, é o lugar do resto.
 *
 * ⚠️ Os quatro estados são diferentes e aparecem diferentes: carregando, ERRO, vazio e lista.
 * Erro exibido como "nenhum pedido" faria o admin concluir que ninguém pediu ajuda.
 */
import Link from 'next/link';
import { useCallback, useEffect, useState, useTransition } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Headphones,
  Loader2,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  ativarProcuracaoAnvisa,
  desativarProcuracaoAnvisa,
  listarPedidosDeAtendimento,
} from '@/app/_actions/pedido-atendimento-assistido';
import type { StatusDoPedido } from '@/lib/anvisa/pedido-de-atendimento';

type Pedido = NonNullable<Awaited<ReturnType<typeof listarPedidosDeAtendimento>>['dados']>[number];

// As mesmas cores que esta tela já usa para a situação da autorização — nenhuma cor nova.
const SITUACAO: Record<StatusDoPedido, { rotulo: string; cor: string }> = {
  aguardando_ativacao: { rotulo: 'Aguardando ativação', cor: 'bg-yellow-100 text-yellow-700' },
  pendente_autorizacao: { rotulo: 'Pendente autorização', cor: 'bg-blue-100 text-blue-700' },
  concluido: { rotulo: 'Concluído', cor: 'bg-green-100 text-green-700' },
  // DO-76: "ele fica como rejeitado anvisa". Mesma cor que esta tela usa para "Rejeitado".
  rejeitado_anvisa: { rotulo: 'Rejeitado ANVISA', cor: 'bg-red-100 text-red-700' },
};

const SITUACAO_DA_AUTORIZACAO: Record<string, string> = {
  pendente: 'Pendente',
  documentos_enviados: 'Documentos enviados',
  em_analise: 'Em análise',
  aprovado: 'Aprovado',
  pendencia_documental: 'Pendência documental',
  rejeitado: 'Rejeitado',
};

const quando = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export function PedidosDeAtendimento() {
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [agindoEm, setAgindoEm] = useState<string | null>(null);
  const [, iniciar] = useTransition();

  const carregar = useCallback(async () => {
    setCarregando(true);
    const r = await listarPedidosDeAtendimento().catch(() => ({
      sucesso: false as const,
      dados: undefined,
      erro: 'Sem conexão com o servidor.',
    }));
    if (r.sucesso) {
      setPedidos(r.dados ?? []);
      setErro(null);
    } else {
      setErro(r.erro ?? 'Não foi possível carregar os pedidos.');
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    let ativo = true;
    listarPedidosDeAtendimento()
      .then((r) => {
        if (!ativo) return;
        if (r.sucesso) setPedidos(r.dados ?? []);
        else setErro(r.erro ?? 'Não foi possível carregar os pedidos.');
      })
      // Erro de rede vira ERRO na tela, nunca "carregando" para sempre nem lista vazia.
      .catch(() => {
        if (ativo) setErro('Sem conexão com o servidor.');
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  const agir = (pedidoId: string, acao: 'ativar' | 'desativar') =>
    iniciar(async () => {
      setAgindoEm(pedidoId);
      const r = await (
        acao === 'ativar'
          ? ativarProcuracaoAnvisa({ pedidoId })
          : desativarProcuracaoAnvisa({ pedidoId })
      ).catch(() => ({ sucesso: false as const, erro: 'Sem conexão com o servidor.' }));
      if (r.sucesso) {
        toast.success(
          acao === 'ativar' ? 'Procuração ativada para o paciente.' : 'Procuração desativada.',
        );
      } else {
        toast.error(r.erro ?? 'Não foi possível concluir. Recarregue a lista e tente de novo.');
      }
      await carregar();
      setAgindoEm(null);
    });

  const abertos =
    pedidos?.filter(
      (p) => p.status === 'aguardando_ativacao' || p.status === 'pendente_autorizacao',
    ).length ?? 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle className="font-display flex items-center gap-2 text-lg">
            <Headphones className="text-primary h-5 w-5" aria-hidden="true" />
            Pedidos de atendimento assistido
            {abertos > 0 && (
              <Badge className="bg-yellow-100 text-xs text-yellow-700">{abertos} em aberto</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Pacientes que pediram ajuda no passo a passo. Ativar a procuração libera para eles o
            &quot;Be4Hope faz por mim&quot;.
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={carregar}
          disabled={carregando}
          aria-label="Atualizar pedidos"
        >
          <RefreshCw className={cn('h-4 w-4', carregando && 'animate-spin')} />
        </Button>
      </CardHeader>

      <CardContent>
        {carregando && pedidos === null ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
          </div>
        ) : erro ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
            <p className="text-xs text-red-700">
              {erro} A lista pode ter pedidos que não apareceram — tente atualizar.
            </p>
          </div>
        ) : !pedidos || pedidos.length === 0 ? (
          <p className="text-muted-foreground py-4 text-sm">
            Nenhum pedido de atendimento até agora.
          </p>
        ) : (
          <Accordion type="multiple" className="w-full space-y-2">
            {pedidos.map((p) => {
              const situacao = SITUACAO[p.status];
              const agindo = agindoEm === p.pedidoId;
              return (
                <AccordionItem
                  key={p.pedidoId}
                  value={p.pedidoId}
                  className="border-border rounded-xl border bg-white"
                >
                  <AccordionTrigger className="px-4 py-3">
                    <div className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-foreground text-sm font-semibold">
                        {p.pacienteNome}
                      </span>
                      <Badge className={cn('text-xs', situacao.cor)}>{situacao.rotulo}</Badge>
                      <span className="text-muted-foreground flex items-center gap-1 text-xs font-normal">
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        pediu em {quando(p.pedidoEm)}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="border-border space-y-3 border-t px-4 pt-3">
                    <p className="text-muted-foreground text-xs">
                      Situação da autorização ANVISA:{' '}
                      <span className="text-foreground font-medium">
                        {SITUACAO_DA_AUTORIZACAO[p.statusAutorizacao] ?? p.statusAutorizacao}
                      </span>
                    </p>

                    {p.ativadoEm && (
                      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                        <ShieldCheck className="text-primary h-3.5 w-3.5" aria-hidden="true" />
                        Procuração ativada {p.ativadoPorNome
                          ? `por ${p.ativadoPorNome} `
                          : ''}em {quando(p.ativadoEm)}
                      </p>
                    )}

                    {(p.status === 'aguardando_ativacao' ||
                      p.status === 'pendente_autorizacao') && (
                      // ADR-0029 D-12: o admin entra na chamada do pedido, onde o paciente espera.
                      <Link
                        href={`/admin/anvisa/atendimento/${p.pedidoId}`}
                        className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-2')}
                      >
                        <Headphones className="h-4 w-4" />
                        Entrar no atendimento
                      </Link>
                    )}

                    {p.status === 'aguardando_ativacao' && (
                      <Button
                        size="sm"
                        className="gap-2"
                        disabled={agindo}
                        onClick={() => agir(p.pedidoId, 'ativar')}
                      >
                        {agindo ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ShieldCheck className="h-4 w-4" />
                        )}
                        Ativar procuração
                      </Button>
                    )}

                    {p.status === 'pendente_autorizacao' && (
                      <div className="space-y-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-2"
                          disabled={agindo}
                          onClick={() => agir(p.pedidoId, 'desativar')}
                        >
                          {agindo && <Loader2 className="h-4 w-4 animate-spin" />}
                          Desativar
                        </Button>
                        <p className="text-muted-foreground text-xs">
                          Só é possível desativar enquanto o paciente não assinou a procuração.
                        </p>
                      </div>
                    )}

                    {p.status === 'concluido' && p.encerradoEm && (
                      <p className="flex items-center gap-1.5 text-xs text-green-700">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Concluído em {quando(p.encerradoEm)}, com a autorização aprovada.
                      </p>
                    )}

                    {p.status === 'rejeitado_anvisa' && p.encerradoEm && (
                      <p className="flex items-center gap-1.5 text-xs text-red-700">
                        <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        Encerrado em {quando(p.encerradoEm)}: a ANVISA rejeitou a autorização.
                      </p>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}
