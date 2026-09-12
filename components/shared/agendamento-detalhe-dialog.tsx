'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, ChevronLeft, Loader2, MessageCircle } from 'lucide-react';
import {
  listarHorariosLivres,
  cancelarReservaPendente,
  remarcarConsultaPaciente,
  type HistoricoAgendamentoItem,
} from '@/app/(public)/_actions/agendamento';
import {
  formatarValor,
  iniciaisDoNome,
  STATUS_LABEL,
  STATUS_CLASSE,
} from '@/components/shared/agendamento-historico';

interface AgendamentoDetalheDialogProps {
  item: HistoricoAgendamentoItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Modo = 'detalhes' | 'confirmar-cancelamento' | 'remarcar';

const STATUS_ATIVOS: HistoricoAgendamentoItem['status'][] = ['reservada', 'agendada', 'confirmada'];

/**
 * Detalhe de um item do histórico, com as ações que o próprio paciente pode tomar:
 * - Cancelar: só para reserva 'reservada' (ainda sem pagamento). Consulta paga/confirmada
 *   não tem autoatendimento de cancelamento — mostra um aviso pra contatar o suporte.
 * - Remarcar: qualquer status ainda ativo, mas só UMA vez de graça por consulta
 *   (`item.remarcadaPeloPacienteEm` é o próprio limite).
 */
export function AgendamentoDetalheDialog({
  item,
  open,
  onOpenChange,
}: AgendamentoDetalheDialogProps) {
  // Sem useEffect resetando estado ao trocar de item: o componente pai monta esta
  // Dialog com `key={item.id}` (ver AgendamentoHistorico), então cada consulta aberta
  // é uma instância nova — o estado já nasce limpo por construção.
  const [modo, setModo] = useState<Modo>('detalhes');
  const [processando, setProcessando] = useState(false);

  const [dataSelecionada, setDataSelecionada] = useState<Date | undefined>();
  const [horariosLivres, setHorariosLivres] = useState<string[]>([]);
  const [horarioSelecionado, setHorarioSelecionado] = useState<string | null>(null);
  const [carregandoHorarios, setCarregandoHorarios] = useState(false);

  const dataHora = new Date(item.dataHora);
  const podeCancelar = item.status === 'reservada';
  const podeRemarcar = STATUS_ATIVOS.includes(item.status) && !item.remarcadaPeloPacienteEm;

  const mensagemEncerrada =
    item.status === 'cancelada'
      ? 'Esta reserva foi cancelada — o horário já foi liberado para outros pacientes.'
      : item.status === 'realizada'
        ? 'Esta consulta já foi realizada.'
        : null;

  async function carregarHorarios(data: Date) {
    setDataSelecionada(data);
    setCarregandoHorarios(true);
    setHorarioSelecionado(null);
    const res = await listarHorariosLivres({
      medicoId: item.medicoId,
      data: format(data, 'yyyy-MM-dd'),
    });
    if (res.sucesso && res.dados) setHorariosLivres(res.dados);
    setCarregandoHorarios(false);
  }

  async function handleCancelar() {
    setProcessando(true);
    const res = await cancelarReservaPendente({ consultaId: item.id });
    if (res.sucesso) {
      toast.success('Reserva cancelada.');
      // Recarrega a página inteira — a reserva cancelada pode ser a mesma que o wizard
      // acima está mostrando (etapa de confirmação/pagamento), e aquele estado só nasce
      // uma vez no carregamento da página, sem escutar mudanças feitas aqui.
      window.location.reload();
      return;
    }
    setProcessando(false);
    toast.error(res.erro ?? 'Erro ao cancelar a reserva');
  }

  async function handleConfirmarRemarcacao() {
    if (!dataSelecionada || !horarioSelecionado) return;
    const [hora, minuto] = horarioSelecionado.split(':');
    const novaData = new Date(dataSelecionada);
    novaData.setHours(parseInt(hora, 10), parseInt(minuto, 10), 0, 0);

    setProcessando(true);
    const res = await remarcarConsultaPaciente({
      consultaId: item.id,
      novaDataHora: novaData.toISOString(),
    });
    if (res.sucesso) {
      toast.success('Consulta remarcada!');
      window.location.reload();
      return;
    }
    setProcessando(false);
    toast.error(res.erro ?? 'Erro ao remarcar a consulta');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {modo === 'detalhes' && (
          <>
            <DialogHeader>
              <DialogTitle>Detalhes da consulta</DialogTitle>
            </DialogHeader>

            <div className="min-w-0 space-y-4">
              <div className="flex min-w-0 items-center gap-3">
                {item.medicoAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.medicoAvatarUrl}
                    alt={item.medicoNome}
                    className="h-11 w-11 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="bg-primary/10 text-primary flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                    {iniciaisDoNome(item.medicoNome)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{item.medicoNome}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {item.medicoEspecialidade}
                  </p>
                </div>
                <Badge className={`ml-auto shrink-0 font-normal ${STATUS_CLASSE[item.status]}`}>
                  {STATUS_LABEL[item.status]}
                </Badge>
              </div>

              <div className="border-border/60 space-y-2 rounded-xl border p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Data e horário</span>
                  <span className="font-medium">
                    {format(dataHora, "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
                {item.valor !== null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Valor</span>
                    <span className="font-medium">
                      {item.moeda} {formatarValor(item.valor)}
                    </span>
                  </div>
                )}
                {item.status === 'reservada' && item.expiraEm && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Prazo para pagar</span>
                    <span className="font-medium text-amber-700 dark:text-amber-400">
                      {new Date(item.expiraEm).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                )}
                {item.observacoes && (
                  <div className="border-border/60 border-t pt-2">
                    <span className="text-muted-foreground">Observações</span>
                    <p className="mt-1">{item.observacoes}</p>
                  </div>
                )}
              </div>

              {!podeCancelar && STATUS_ATIVOS.includes(item.status) && (
                <div className="bg-muted/40 flex items-start gap-2.5 rounded-xl p-3.5">
                  <MessageCircle size={15} className="text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    Esta consulta já está confirmada — para cancelar, entre em contato com o nosso
                    suporte.
                  </p>
                </div>
              )}

              {STATUS_ATIVOS.includes(item.status) && item.remarcadaPeloPacienteEm && (
                <div className="bg-muted/40 flex items-start gap-2.5 rounded-xl p-3.5">
                  <AlertTriangle size={15} className="text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    Você já usou sua remarcação gratuita para esta consulta. Para alterar de novo,
                    entre em contato com o suporte.
                  </p>
                </div>
              )}

              {mensagemEncerrada && (
                <div className="bg-muted/40 flex items-start gap-2.5 rounded-xl p-3.5">
                  <MessageCircle size={15} className="text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    {mensagemEncerrada}
                  </p>
                </div>
              )}
            </div>

            {/* O rodapé sempre aparece — sem ele (ex.: consulta cancelada/realizada, sem
                nenhuma ação disponível), o card terminava sem a faixa inferior que fecha
                visualmente o modal, deixando o conteúdo "solto" antes da borda. */}
            <DialogFooter>
              {podeCancelar && (
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setModo('confirmar-cancelamento')}
                >
                  Cancelar reserva
                </Button>
              )}
              {podeRemarcar && (
                <Button onClick={() => setModo('remarcar')}>Remarcar horário</Button>
              )}
              {!podeCancelar && !podeRemarcar && (
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Fechar
                </Button>
              )}
            </DialogFooter>
          </>
        )}

        {modo === 'confirmar-cancelamento' && (
          <>
            <DialogHeader>
              <DialogTitle>Cancelar esta reserva?</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground text-sm">
              O horário volta a ficar disponível para outros pacientes. Essa ação não pode ser
              desfeita.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setModo('detalhes')} className="gap-1">
                <ChevronLeft size={14} />
                Voltar
              </Button>
              <Button variant="destructive" onClick={handleCancelar} disabled={processando}>
                {processando && <Loader2 size={14} className="animate-spin" />}
                {processando ? 'Cancelando...' : 'Sim, cancelar reserva'}
              </Button>
            </DialogFooter>
          </>
        )}

        {modo === 'remarcar' && (
          <>
            <DialogHeader>
              <DialogTitle>Escolher novo horário</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground text-xs">
              Esta é sua remarcação gratuita para esta consulta — não é possível remarcar de novo
              depois sem contatar o suporte.
            </p>

            <Calendar
              mode="single"
              selected={dataSelecionada}
              onSelect={(data) => data && carregarHorarios(data)}
              locale={ptBR}
              disabled={(date) => {
                const hoje = new Date();
                hoje.setHours(0, 0, 0, 0);
                return date < hoje || date.getDay() === 0 || date.getDay() === 6;
              }}
              className="mx-auto rounded-xl border"
            />

            {dataSelecionada && (
              <div>
                {carregandoHorarios ? (
                  <div className="flex justify-center py-6">
                    <Loader2 size={20} className="text-primary animate-spin" />
                  </div>
                ) : horariosLivres.length === 0 ? (
                  <p className="text-muted-foreground py-4 text-center text-sm">
                    Nenhum horário disponível nesta data.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {horariosLivres.map((h) => (
                      <button
                        key={h}
                        onClick={() => setHorarioSelecionado(h)}
                        className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                          horarioSelecionado === h
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border hover:border-primary/40'
                        }`}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setModo('detalhes')} className="gap-1">
                <ChevronLeft size={14} />
                Voltar
              </Button>
              <Button
                onClick={handleConfirmarRemarcacao}
                disabled={!horarioSelecionado || processando}
              >
                {processando && <Loader2 size={14} className="animate-spin" />}
                {processando ? 'Remarcando...' : 'Confirmar remarcação'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
