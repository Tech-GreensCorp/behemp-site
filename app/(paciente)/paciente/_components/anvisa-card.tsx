'use client';

import { useTransition } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Clock, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { iniciarRenovacao } from '@/app/_actions/anvisa-renovacao';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface AnvisaCardProps {
  autorizacao: {
    id: string;
    numeroProcesso: string | null;
    dataValidade: string | null;
    status: string;
    temRenovacaoEmAndamento: boolean;
  };
}

export function AnvisaCard({ autorizacao }: AnvisaCardProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (autorizacao.status !== 'aprovado') {
    return null; // Apenas mostra o monitoramento se já tiver sido aprovada (valendo)
  }

  const hoje = new Date();
  const zonedHoje = toZonedTime(hoje, 'America/Sao_Paulo');
  zonedHoje.setHours(0, 0, 0, 0);

  let diasRestantes = Infinity;
  let dataFormatada = 'Não informada';

  if (autorizacao.dataValidade) {
    const dv = toZonedTime(parseISO(autorizacao.dataValidade + 'T00:00:00Z'), 'America/Sao_Paulo');
    diasRestantes = differenceInDays(dv, zonedHoje);
    dataFormatada = parseISO(autorizacao.dataValidade).toLocaleDateString('pt-BR');
  }

  const isExpirada = diasRestantes < 0;
  const isAviso = diasRestantes >= 0 && diasRestantes <= 90;

  const handleRenovar = () => {
    startTransition(async () => {
      const res = await iniciarRenovacao(autorizacao.id);
      if (res.sucesso) {
        toast.success(
          'Renovação iniciada! Vá para a seção ANVISA para enviar os documentos faltantes.',
        );
        router.refresh(); // Recarrega a página para atualizar o status
      } else {
        toast.error(res.erro || 'Erro ao iniciar renovação.');
      }
    });
  };

  return (
    <Card className="border-border/20 grain animate-fade-up overflow-hidden rounded-2xl border bg-white shadow-sm delay-150 sm:rounded-3xl">
      <CardContent className="space-y-4 p-4 sm:space-y-5 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10">
            <ShieldCheck className="h-5 w-5 text-amber-600" />
          </div>
          <h2 className="font-display text-foreground text-lg font-bold">
            Minha Autorização ANVISA
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="bg-muted/30 border-border/10 rounded-2xl border px-4 py-3">
            <p className="text-muted-foreground/60 text-[10px] font-bold tracking-wider uppercase">
              Processo
            </p>
            <p className="text-foreground mt-0.5 font-bold">
              {autorizacao.numeroProcesso || 'Não informado'}
            </p>
          </div>
          <div className="bg-muted/30 border-border/10 rounded-2xl border px-4 py-3">
            <p className="text-muted-foreground/60 text-[10px] font-bold tracking-wider uppercase">
              Validade
            </p>
            <p className="text-foreground mt-0.5 font-bold">{dataFormatada}</p>
          </div>
        </div>

        {(isExpirada || isAviso) && (
          <div
            className={`mt-4 flex flex-col gap-3 rounded-2xl border p-4 ${isExpirada ? 'bg-destructive/10 border-destructive/20' : 'border-orange-200 bg-orange-100'}`}
          >
            <div className="flex items-start gap-3">
              <AlertCircle
                className={`h-5 w-5 shrink-0 ${isExpirada ? 'text-destructive' : 'text-orange-600'}`}
              />
              <div>
                <p className={`font-bold ${isExpirada ? 'text-destructive' : 'text-orange-800'}`}>
                  {isExpirada
                    ? 'Sua autorização expirou!'
                    : `Sua autorização vence em ${diasRestantes} dias!`}
                </p>
                <p
                  className={`mt-0.5 text-sm ${isExpirada ? 'text-destructive/80' : 'text-orange-700'}`}
                >
                  Para não interromper seu tratamento, é necessário renovar a autorização.
                </p>
              </div>
            </div>

            {autorizacao.temRenovacaoEmAndamento ? (
              <div className="mt-2 flex items-center gap-2 rounded-lg bg-white/50 px-3 py-2">
                <Clock className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-bold text-orange-800">Renovação já em andamento</span>
              </div>
            ) : (
              <Button
                onClick={handleRenovar}
                disabled={isPending}
                className={`mt-2 gap-2 font-bold shadow-sm ${isExpirada ? 'bg-destructive hover:bg-destructive/90' : 'bg-orange-600 hover:bg-orange-700'} text-white`}
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Iniciar Renovação
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
