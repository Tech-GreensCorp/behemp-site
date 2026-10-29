import { CalendarDays, FileText, Pill, ShieldCheck } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import type { ResumoDoDependente } from '@/lib/dependentes/leituras';
import { LABEL_ANVISA, formatarDataHora, formatarDataISO } from '@/lib/dependentes/rotulos';

function Mini({
  icone,
  titulo,
  valor,
  detalhe,
}: {
  icone: React.ReactNode;
  titulo: string;
  valor: string;
  detalhe?: string | null;
}) {
  return (
    <Card className="border-border/30 rounded-2xl border bg-white shadow-sm">
      <CardContent className="flex items-start gap-3 p-4">
        <div className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
          {icone}
        </div>
        <div className="min-w-0">
          <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
            {titulo}
          </p>
          <p className="text-foreground text-sm font-bold wrap-break-word">{valor}</p>
          {detalhe && <p className="text-muted-foreground text-xs wrap-break-word">{detalhe}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

/** Os quatro números de UM dependente. Cada cartão diz "de quem" pelo contexto em que a página o coloca. */
export function ResumoDoDependenteCards({ resumo }: { resumo: ResumoDoDependente }) {
  const med = resumo.medicamentoAtivo;
  const cons = resumo.proximaConsulta;
  const anv = resumo.autorizacaoAnvisa;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Mini
        icone={<CalendarDays className="h-4.5 w-4.5" />}
        titulo="Próxima consulta"
        valor={cons ? formatarDataHora(cons.dataHora) : 'Nenhuma agendada'}
        detalhe={cons ? cons.medicoNome : null}
      />
      <Mini
        icone={<Pill className="h-4.5 w-4.5" />}
        titulo="Medicamento atual"
        valor={med ? `${med.tipoCanabinoide} · ${med.novaDosagem}` : 'Nenhum registrado'}
        detalhe={med ? med.frequencia : null}
      />
      <Mini
        icone={<FileText className="h-4.5 w-4.5" />}
        titulo="Documentos"
        valor={`${resumo.totalDocumentos} ${resumo.totalDocumentos === 1 ? 'documento' : 'documentos'}`}
      />
      <Mini
        icone={<ShieldCheck className="h-4.5 w-4.5" />}
        titulo="Autorização ANVISA"
        valor={anv ? (LABEL_ANVISA[anv.status] ?? anv.status) : 'Sem solicitação'}
        detalhe={anv?.dataValidade ? `Válida até ${formatarDataISO(anv.dataValidade)}` : null}
      />
    </div>
  );
}
