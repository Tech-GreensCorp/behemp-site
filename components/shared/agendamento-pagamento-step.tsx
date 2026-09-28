'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, Clock, CreditCard, Loader2, Wallet } from 'lucide-react';

import { obterPagamentoDaReserva } from '@/app/(public)/_actions/agendamento';
import { iniciarCobranca } from '@/app/(public)/_actions/pagamento';
import {
  PainelDoPagamento,
  formatarContagem,
} from '@/components/shared/agendamento-pagamento-painel';
import type { EnvioDoBrick } from '@/components/shared/agendamento-pagamento-brick';
import { getPusherClient, canalUsuario } from '@/lib/integrations/pusher/client';
import {
  combinarComSituacao,
  entradaDoBrick,
  estadoDoResultado,
  haPagamentoEmCurso,
  podeEnviar,
  umEnvioPorVez,
  type EstadoDoPagamento,
} from '@/lib/agendamento/pagamento-na-tela';

/** Mesmo nome de `lib/mercadopago/aviso-ao-paciente.ts` — duplicado para não importar código de servidor. */
const EVENTO_PAGAMENTO_ATUALIZADO = 'pagamento:atualizado';

const PagamentoBrick = dynamic(() => import('@/components/shared/agendamento-pagamento-brick'), {
  ssr: false,
  loading: () => (
    <div className="text-muted-foreground flex items-center gap-2 py-8 text-sm">
      <Loader2 size={16} className="animate-spin" />
      Carregando as formas de pagamento…
    </div>
  ),
});

function formatarValor(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface AgendamentoPagamentoStepProps {
  consultaId: string;
  medicoNome: string;
  dataHora: Date;
  valor: number | null;
  moeda: string;
  /** ISO — prazo da RESERVA. O do PIX é outro, e vem da API quando o PIX é gerado. */
  expiraEm: string;
  /** Public key do Payment Brick, lida no servidor (`lib/mercadopago/public-key.ts`). `null` = não configurada. */
  publicKey: string | null;
  /**
   * Disparado uma única vez quando o prazo acaba SEM pagamento em curso. Com PIX pagável ou
   * cartão em análise, não dispara — a reserva também não é liberada no banco (Fase 4).
   */
  onExpirar?: () => void;
  /** Disparado uma única vez quando o webhook confirma a consulta. */
  onConfirmado?: () => void;
}

/**
 * Última etapa do wizard: o pagamento de verdade (Parte 2, Fase 5), pelo Payment Brick do
 * Mercado Pago. Cartão de crédito e PIX.
 *
 * O caminho: o Brick tokeniza o cartão (ou só escolhe PIX) → `iniciarCobranca` cria a cobrança
 * em nome do médico → a tela mostra o QR code, a recusa ou "aprovado, confirmando" → o webhook
 * confirma e avisa pelo Pusher (`pagamento:atualizado`, canal pessoal). A tela também relê o
 * estado no banco ao abrir e ao voltar ao foco, para quem perdeu o aviso.
 *
 * A lógica de estado mora em `lib/agendamento/pagamento-na-tela.ts`; o que se desenha em cada
 * estado, em `agendamento-pagamento-painel.tsx`.
 */
export function AgendamentoPagamentoStep({
  consultaId,
  medicoNome,
  dataHora,
  valor,
  moeda,
  expiraEm,
  publicKey,
  onExpirar,
  onConfirmado,
}: AgendamentoPagamentoStepProps) {
  const [agora, setAgora] = useState(() => Date.now());
  const [estado, setEstado] = useState<EstadoDoPagamento>({ tipo: 'escolhendo' });
  const [lendo, setLendo] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [brickFalhou, setBrickFalhou] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  /** `null` até a primeira leitura. Sem conta conectada, o Brick não aparece — a cobrança falharia. */
  const [medicoConectado, setMedicoConectado] = useState<boolean | null>(null);
  const expirarAvisadoRef = useRef(false);
  const confirmadoAvisadoRef = useRef(false);

  useEffect(() => {
    const intervalo = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(intervalo);
  }, []);

  /** Aplica o que o banco disse, combinado com o que a tela já sabe (ver `combinarComSituacao`). */
  const aplicar = useCallback((res: Awaited<ReturnType<typeof obterPagamentoDaReserva>>) => {
    if (!res.sucesso || !res.dados) return;
    const situacao = res.dados;
    setUserId(situacao.userId);
    setMedicoConectado(situacao.medicoConectado);
    setEstado((atual) => combinarComSituacao(atual, situacao));
  }, []);

  /** Relê o banco — chamado pelos eventos (aviso do webhook, volta ao foco). */
  const reler = useCallback(async () => {
    aplicar(await obterPagamentoDaReserva({ consultaId }));
  }, [consultaId, aplicar]);

  // Ao abrir (inclusive depois de um reload): retoma o pagamento que já estiver em curso. O
  // estado só muda no `.then`, depois da resposta — nunca de forma síncrona no corpo do efeito.
  useEffect(() => {
    let ativo = true;
    obterPagamentoDaReserva({ consultaId })
      .then((res) => {
        if (ativo) aplicar(res);
      })
      .catch(() => {
        // sem a leitura, a tela abre em "escolhendo"; o servidor ainda recusa cobrança dupla
      })
      .finally(() => {
        if (ativo) setLendo(false);
      });
    return () => {
      ativo = false;
    };
  }, [consultaId, aplicar]);

  // O aviso do webhook, pelo canal pessoal. Só relê — o corpo não é confiável para decidir nada.
  useEffect(() => {
    if (!userId) return;
    let pusher: ReturnType<typeof getPusherClient>;
    try {
      pusher = getPusherClient();
    } catch {
      return; // sem Pusher configurado, a releitura ao voltar ao foco continua valendo
    }
    const canal = canalUsuario(userId);
    const aoAtualizar = (dados: { consultaId?: string }) => {
      if (dados?.consultaId === consultaId) void reler();
    };
    const assinatura = pusher.subscribe(canal);
    assinatura.bind(EVENTO_PAGAMENTO_ATUALIZADO, aoAtualizar);
    return () => {
      assinatura.unbind(EVENTO_PAGAMENTO_ATUALIZADO, aoAtualizar);
      pusher.unsubscribe(canal);
    };
  }, [userId, consultaId, reler]);

  // Quem trocou de aba para pagar no app do banco volta e vê o estado de agora.
  useEffect(() => {
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') void reler();
    };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => document.removeEventListener('visibilitychange', aoVoltar);
  }, [reler]);

  const msRestante = new Date(expiraEm).getTime() - agora;
  const reservaNoPrazo = msRestante > 0;
  const emCurso = haPagamentoEmCurso(estado, agora);
  const expirado = !reservaNoPrazo && !emCurso && !lendo;
  const valorFormatado = valor !== null ? `${moeda} ${formatarValor(valor)}` : 'A confirmar';

  useEffect(() => {
    if (expirado && !expirarAvisadoRef.current) {
      expirarAvisadoRef.current = true;
      onExpirar?.();
    }
  }, [expirado, onExpirar]);

  useEffect(() => {
    if (estado.tipo === 'confirmado' && !confirmadoAvisadoRef.current) {
      confirmadoAvisadoRef.current = true;
      onConfirmado?.();
    }
  }, [estado.tipo, onConfirmado]);

  // 🔴 Estáveis de propósito: a etapa re-renderiza a cada segundo (o cronômetro), e o Brick
  // (`memo`) só deixa de re-renderizar se o que recebe não mudar de identidade. Ver o
  // cabeçalho de `agendamento-pagamento-brick.tsx` — o defeito de 28/09/2026.
  // A trava contra o duplo clique: um envio por vez (ver `umEnvioPorVez`). Criada uma vez só,
  // porque o estado dela ("há envio em curso") tem de sobreviver aos re-renders.
  const enviarUmaVez = useMemo(
    () =>
      umEnvioPorVez((entrada: Parameters<typeof iniciarCobranca>[0]) => iniciarCobranca(entrada)),
    [],
  );

  const cobrar = useCallback(
    async (entrada: Parameters<typeof iniciarCobranca>[0]) => {
      setEnviando(true);
      let desfecho: Awaited<ReturnType<typeof enviarUmaVez>> | { tipo: 'falhou' };
      try {
        desfecho = await enviarUmaVez(entrada);
      } catch {
        desfecho = { tipo: 'falhou' };
      }
      // Um segundo clique chegou com o primeiro em curso: descartado sem chamar o servidor. Não
      // mexe em nada — o overlay e o resultado são do primeiro envio.
      if (desfecho.tipo === 'ignorado') return;

      setEnviando(false);
      if (desfecho.tipo === 'feito') {
        setEstado(estadoDoResultado(desfecho.valor));
      } else if (desfecho.tipo === 'sem_resposta') {
        // O envio pode ter chegado: antes de oferecer nova tentativa, relê o banco — se houver
        // pagamento em curso, é ele que a tela passa a mostrar.
        setEstado({
          tipo: 'erro',
          mensagem:
            'Não tivemos resposta do pagamento a tempo. Aguarde um instante: se ele foi aprovado, esta tela mostra sozinha.',
        });
        void reler();
      } else {
        setEstado({
          tipo: 'erro',
          mensagem: 'Não conseguimos falar com o servidor. Confira a conexão e tente de novo.',
        });
      }
    },
    [enviarUmaVez, reler],
  );

  const aoEnviarDoBrick = useCallback(
    async (envio: EnvioDoBrick) => {
      const entrada = entradaDoBrick(consultaId, envio);
      if (!entrada) {
        setEstado({ tipo: 'erro', mensagem: 'Este meio de pagamento não está disponível.' });
        return;
      }
      await cobrar(entrada);
    },
    [consultaId, cobrar],
  );

  const aoFalharOBrick = useCallback(() => setBrickFalhou(true), []);

  // O Brick CONTINUA MONTADO durante o envio, coberto pelo overlay (o padrão da Greens): tirá-lo
  // no meio do `onSubmit` destruía o formulário antes da resposta.
  const mostrarBrick =
    !lendo &&
    !brickFalhou &&
    medicoConectado === true &&
    estado.tipo === 'escolhendo' &&
    podeEnviar(estado, expiraEm, agora);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card className="border-0 shadow-sm">
        <CardContent className="space-y-4 py-8">
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full">
              <Wallet size={26} className="text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Falta pagar para confirmar sua consulta</h2>
              <p className="text-muted-foreground text-sm">
                Seu horário com <strong className="text-foreground">{medicoNome}</strong> está
                reservado — a consulta só é confirmada após o pagamento.
              </p>
            </div>
          </div>

          <div className="border-border/60 grid gap-3 rounded-xl border p-4 sm:grid-cols-3">
            <div>
              <p className="text-muted-foreground text-xs">Consulta</p>
              <p className="text-sm font-semibold">
                {format(dataHora, "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Valor</p>
              <p className="text-sm font-semibold">{valorFormatado}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Prazo para pagar</p>
              <p className="text-sm font-semibold">
                {format(new Date(expiraEm), 'HH:mm', { locale: ptBR })}
              </p>
            </div>
          </div>

          {/* A faixa do prazo da RESERVA só vale antes de haver pagamento em curso — depois
              dele, o prazo que importa é o do PIX, ou nenhum (cartão em análise). */}
          {!emCurso && (
            <div
              className={`flex items-center gap-3 rounded-xl border p-4 ${
                reservaNoPrazo
                  ? 'border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20'
                  : 'border-destructive/40 bg-destructive/5'
              }`}
            >
              {reservaNoPrazo ? (
                <Clock size={18} className="shrink-0 text-amber-700 dark:text-amber-400" />
              ) : (
                <AlertTriangle size={18} className="text-destructive shrink-0" />
              )}
              <div className="flex-1">
                <p
                  className={`text-sm font-semibold ${
                    reservaNoPrazo ? 'text-amber-800 dark:text-amber-400' : 'text-destructive'
                  }`}
                >
                  {reservaNoPrazo
                    ? `Tempo restante para pagar: ${formatarContagem(msRestante)}`
                    : 'O prazo para pagamento acabou'}
                </p>
                <p
                  className={`text-xs ${
                    reservaNoPrazo
                      ? 'text-amber-700/80 dark:text-amber-400/70'
                      : 'text-destructive/80'
                  }`}
                >
                  {reservaNoPrazo
                    ? 'Se o pagamento não for iniciado até o prazo, a reserva é liberada automaticamente e o horário volta a ficar disponível.'
                    : 'Sua reserva pode já ter sido liberada. Volte à etapa de agendamento para escolher um novo horário.'}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard size={16} className="text-primary" />
            Forma de pagamento
          </CardTitle>
          <p className="text-muted-foreground text-sm">
            Cartão de crédito ou PIX, pelo Mercado Pago. O valor vai direto para o médico.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {(lendo || (enviando && !mostrarBrick)) && (
            <div className="text-muted-foreground flex items-center gap-2 py-4 text-sm">
              <Loader2 size={16} className="animate-spin" />
              {enviando ? 'Processando o pagamento…' : 'Carregando…'}
            </div>
          )}

          {!lendo && !enviando && (
            <PainelDoPagamento
              estado={estado}
              agora={agora}
              reservaNoPrazo={reservaNoPrazo}
              ocupado={enviando}
              onTentarDeNovo={() => setEstado({ tipo: 'escolhendo' })}
              onPedirQrDeNovo={() => void cobrar({ consultaId, metodo: 'pix' })}
            />
          )}

          {!lendo &&
            estado.tipo === 'escolhendo' &&
            reservaNoPrazo &&
            (medicoConectado !== true || publicKey === null || valor === null || brickFalhou) && (
              <p className="text-destructive text-sm">
                {medicoConectado === false
                  ? 'O pagamento pelo site ainda não está disponível para este médico. Fale com a clínica para concluir o agendamento.'
                  : valor === null
                    ? 'O valor desta consulta ainda não foi definido. Fale com a clínica para concluir o agendamento.'
                    : 'O pagamento está indisponível no momento. Tente de novo em alguns minutos ou fale com a clínica.'}
              </p>
            )}

          {mostrarBrick && publicKey !== null && valor !== null && (
            <div className="relative">
              <PagamentoBrick
                publicKey={publicKey}
                valor={valor}
                onEnviar={aoEnviarDoBrick}
                onFalhaDoBrick={aoFalharOBrick}
              />
              {/* 🔴 O "Pagar" mora dentro do Brick e o SDK nunca o desabilita. Este overlay
                  absorve o segundo clique enquanto o primeiro está em curso; a trava
                  determinística é `umEnvioPorVez`, em `cobrar`. */}
              {enviando && (
                <div
                  role="status"
                  aria-live="polite"
                  data-trava-do-pagamento
                  className="bg-card/80 pointer-events-auto absolute inset-0 z-10 flex cursor-wait items-center justify-center backdrop-blur-sm"
                >
                  <div className="flex flex-col items-center gap-2 px-6 text-center">
                    <Loader2 size={22} className="text-muted-foreground animate-spin" />
                    <p className="text-sm font-medium">Processando o pagamento…</p>
                    <p className="text-muted-foreground text-xs">
                      Não feche nem atualize esta tela.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
