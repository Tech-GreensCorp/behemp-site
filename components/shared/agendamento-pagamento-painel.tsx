'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, CheckCircle2, Clock, Copy, Loader2, QrCode, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { EstadoDoPagamento } from '@/lib/agendamento/pagamento-na-tela';

/**
 * O QUE O PACIENTE VÊ DEPOIS DE ENVIAR — um painel por `EstadoDoPagamento` (Parte 2, Fase 5).
 *
 * Só apresentação: sem SDK, sem `next/dynamic`, sem chamada ao servidor. Quem decide o estado é
 * `lib/agendamento/pagamento-na-tela.ts`; quem chama a action é
 * `agendamento-pagamento-step.tsx`. Por isso ele é renderizável num teste sem navegador.
 *
 * Cores: as que o agendamento já usa — âmbar para "aguardando" (a faixa do prazo), `destructive`
 * para recusa, e o verde do status "confirmada" de `agendamento-historico.tsx`.
 */

export function formatarContagem(msRestante: number): string {
  if (msRestante <= 0) return '00:00';
  const totalSegundos = Math.floor(msRestante / 1000);
  const minutos = Math.floor(totalSegundos / 60);
  const segundos = totalSegundos % 60;
  return `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
}

interface PainelDoPagamentoProps {
  estado: EstadoDoPagamento;
  agora: number;
  /** A reserva ainda está no prazo? Decide se "pedir o QR code de novo" e "tentar de novo" aparecem. */
  reservaNoPrazo: boolean;
  ocupado?: boolean;
  onTentarDeNovo?: () => void;
  onPedirQrDeNovo?: () => void;
}

function Aguardando({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
      <Loader2
        size={18}
        className="mt-0.5 shrink-0 animate-spin text-amber-700 dark:text-amber-400"
      />
      <div>
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">{titulo}</p>
        <p className="text-xs text-amber-700/80 dark:text-amber-400/70">{texto}</p>
      </div>
    </div>
  );
}

function Falha({ titulo, texto, acao }: { titulo: string; texto: string; acao?: React.ReactNode }) {
  return (
    <div className="border-destructive/40 bg-destructive/5 flex items-start gap-3 rounded-xl border p-4">
      <AlertTriangle size={18} className="text-destructive mt-0.5 shrink-0" />
      <div className="flex-1 space-y-3">
        <div>
          <p className="text-destructive text-sm font-semibold">{titulo}</p>
          <p className="text-destructive/80 text-xs">{texto}</p>
        </div>
        {acao}
      </div>
    </div>
  );
}

function PixGerado({
  qrCode,
  qrCodeBase64,
  ticketUrl,
  validoAte,
  agora,
}: {
  qrCode: string;
  qrCodeBase64: string;
  ticketUrl: string | null;
  validoAte: string;
  agora: number;
}) {
  const [copiado, setCopiado] = useState(false);
  const msRestante = new Date(validoAte).getTime() - agora;
  const vencido = msRestante <= 0;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(qrCode);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }

  if (vencido) {
    return (
      <Falha
        titulo="O PIX venceu sem pagamento"
        texto="Este código não pode mais ser pago. Se você já pagou, a confirmação aparece aqui assim que o banco avisar."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
        {/* eslint-disable-next-line @next/next/no-img-element -- data URI devolvido pela API; next/image não otimiza base64 */}
        <img
          src={`data:image/png;base64,${qrCodeBase64}`}
          alt="QR code do PIX"
          width={176}
          height={176}
          className="border-border h-44 w-44 shrink-0 rounded-xl border bg-white p-2"
        />
        <div className="flex-1 space-y-3">
          <p className="text-muted-foreground text-sm">
            Escaneie o QR code com o app do seu banco ou copie o código PIX abaixo.
          </p>
          <div className="flex gap-2">
            <Input
              readOnly
              value={qrCode}
              aria-label="Código PIX copia e cola"
              className="text-xs"
            />
            <Button variant="outline" onClick={copiar} className="gap-1.5">
              <Copy size={14} />
              {copiado ? 'Copiado' : 'Copiar'}
            </Button>
          </div>
          {ticketUrl && (
            <a
              href={ticketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary text-xs underline"
            >
              Abrir o PIX no Mercado Pago
            </a>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
        <Clock size={18} className="shrink-0 text-amber-700 dark:text-amber-400" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">
            {`O PIX vale por mais ${formatarContagem(msRestante)}`}
          </p>
          <p className="text-xs text-amber-700/80 dark:text-amber-400/70">
            {`Válido até ${format(new Date(validoAte), 'HH:mm', { locale: ptBR })}. Esta tela avisa sozinha quando o banco confirmar o pagamento.`}
          </p>
        </div>
      </div>
    </div>
  );
}

export function PainelDoPagamento({
  estado,
  agora,
  reservaNoPrazo,
  ocupado = false,
  onTentarDeNovo,
  onPedirQrDeNovo,
}: PainelDoPagamentoProps) {
  const tentarDeNovo =
    reservaNoPrazo && onTentarDeNovo ? (
      <Button variant="outline" size="sm" onClick={onTentarDeNovo} className="gap-1.5">
        <RotateCcw size={14} />
        Tentar de novo
      </Button>
    ) : undefined;

  switch (estado.tipo) {
    case 'escolhendo':
      return null;

    case 'pix':
      return <PixGerado {...estado} agora={agora} />;

    case 'pix_sem_qr': {
      const vencido = estado.validoAte !== null && new Date(estado.validoAte).getTime() <= agora;
      if (vencido) {
        return (
          <Falha
            titulo="O PIX venceu sem pagamento"
            texto="Se você já pagou, a confirmação aparece aqui assim que o banco avisar."
          />
        );
      }
      return (
        <div className="space-y-3">
          <Aguardando
            titulo="Seu PIX já foi gerado"
            texto={
              estado.validoAte
                ? `Ele vale até ${format(new Date(estado.validoAte), 'HH:mm', { locale: ptBR })}. Se você já copiou o código, pague pelo app do banco — a confirmação aparece aqui.`
                : 'Se você já copiou o código, pague pelo app do banco — a confirmação aparece aqui.'
            }
          />
          {reservaNoPrazo && onPedirQrDeNovo && (
            <Button
              variant="outline"
              onClick={onPedirQrDeNovo}
              disabled={ocupado}
              className="gap-1.5"
            >
              <QrCode size={14} />
              Mostrar o QR code de novo
            </Button>
          )}
        </div>
      );
    }

    case 'aprovado':
      return (
        <Aguardando
          titulo="Pagamento aprovado — confirmando sua consulta"
          texto="Só falta o Mercado Pago confirmar para nós. Isso costuma levar alguns segundos, e esta tela avisa sozinha."
        />
      );

    case 'em_analise':
      return (
        <Aguardando
          titulo="Pagamento em análise"
          texto="O Mercado Pago está analisando o pagamento. Seu horário continua reservado enquanto isso, e esta tela avisa quando houver resposta."
        />
      );

    case 'em_andamento':
      return (
        <Aguardando
          titulo="Já existe um pagamento em andamento"
          texto="Aguarde a confirmação dele antes de tentar outro meio — assim você não paga duas vezes."
        />
      );

    case 'recusado':
      return <Falha titulo="Pagamento recusado" texto={estado.mensagem} acao={tentarDeNovo} />;

    case 'erro':
      return (
        <Falha titulo="Não foi possível concluir" texto={estado.mensagem} acao={tentarDeNovo} />
      );

    case 'reserva_expirada':
      return (
        <Falha
          titulo="O prazo da reserva acabou"
          texto="O horário foi liberado. Escolha um novo horário para agendar."
        />
      );

    case 'pago_sem_horario':
      return (
        <Falha
          titulo="Recebemos o pagamento, mas o horário já tinha sido liberado"
          texto="Ele chegou depois do prazo da reserva, e o caso ficou registrado para a equipe. Fale com a clínica para reagendar ou receber o valor de volta — não pague de novo."
        />
      );

    case 'confirmado':
      return (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-100 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/40">
          <CheckCircle2
            size={18}
            className="mt-0.5 shrink-0 text-emerald-800 dark:text-emerald-400"
          />
          <div>
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-400">
              Pagamento confirmado — sua consulta está agendada
            </p>
            <p className="text-xs text-emerald-800/80 dark:text-emerald-400/70">
              Enviamos a confirmação por e-mail, com os detalhes da consulta.
            </p>
          </div>
        </div>
      );
  }
}
