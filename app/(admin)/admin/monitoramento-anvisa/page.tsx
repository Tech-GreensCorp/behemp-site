import { db } from '@/lib/db';
import { autorizacoesAnvisa, pacientes, users } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { differenceInDays, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { ShieldCheck, Clock, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { MonitoramentoFiltros } from './_components/filtros';
import { RenovarButton } from './_components/renovar-button';

const TZ = 'America/Sao_Paulo';

export default async function MonitoramentoAnvisaPage(props: {
  searchParams?: Promise<{ status?: string; q?: string }>;
}) {
  const searchParams = await props.searchParams;
  const filtroStatus = searchParams?.status || 'todos';
  const query = searchParams?.q?.toLowerCase() || '';

  const hoje = new Date();
  const zonedHoje = toZonedTime(hoje, TZ);
  zonedHoje.setHours(0, 0, 0, 0);

  // Buscar apenas aprovadas
  const rawList = await db
    .select({
      id: autorizacoesAnvisa.id,
      pacienteId: autorizacoesAnvisa.pacienteId,
      numeroProcesso: autorizacoesAnvisa.numeroProcesso,
      dataAprovacao: autorizacoesAnvisa.dataAprovacao,
      dataValidade: autorizacoesAnvisa.dataValidade,
      modalidade: autorizacoesAnvisa.modalidade,
      pacienteNome: users.nome,
      pacienteEmail: users.email,
    })
    .from(autorizacoesAnvisa)
    .innerJoin(pacientes, eq(autorizacoesAnvisa.pacienteId, pacientes.id))
    .innerJoin(users, eq(pacientes.userId, users.id))
    .where(and(eq(autorizacoesAnvisa.status, 'aprovado'), isNull(autorizacoesAnvisa.deletedAt)));

  // Processar e classificar cada item
  const processado = rawList.map((aut) => {
    let diasRestantes = Infinity;
    if (aut.dataValidade) {
      const dv = toZonedTime(parseISO(aut.dataValidade + 'T00:00:00Z'), TZ);
      diasRestantes = differenceInDays(dv, zonedHoje);
    }

    let statusVisual = 'normal';
    if (diasRestantes < 0) statusVisual = 'expirado';
    else if (diasRestantes <= 30) statusVisual = 'critico';
    else if (diasRestantes <= 90) statusVisual = 'atencao';

    return { ...aut, diasRestantes, statusVisual };
  });

  // Contadores globais
  const totals = {
    ativas: processado.length,
    vence90: processado.filter((a) => a.statusVisual === 'atencao').length,
    vence30: processado.filter((a) => a.statusVisual === 'critico').length,
    expiradas: processado.filter((a) => a.statusVisual === 'expirado').length,
  };

  // Filtragem (após processamento pois dependemos do cálculo de dias)
  let lista = processado;

  if (filtroStatus !== 'todos') {
    lista = lista.filter((a) => a.statusVisual === filtroStatus);
  }

  if (query) {
    lista = lista.filter((a) => a.pacienteNome.toLowerCase().includes(query));
  }

  // Ordenação default: mais próximas do vencimento primeiro (crescente de diasRestantes)
  lista.sort((a, b) => a.diasRestantes - b.diasRestantes);

  const getStatusBadge = (statusVisual: string, dias: number) => {
    switch (statusVisual) {
      case 'expirado':
        return (
          <Badge className="bg-destructive text-destructive-foreground gap-1">
            <XCircle className="h-3 w-3" /> Expirado ({dias} dias)
          </Badge>
        );
      case 'critico':
        return (
          <Badge className="gap-1 bg-[#C34C32] text-white">
            <AlertCircle className="h-3 w-3" /> {dias} dias
          </Badge>
        ); // Terracota
      case 'atencao':
        return (
          <Badge className="gap-1 bg-yellow-500 text-white">
            <Clock className="h-3 w-3" /> {dias} dias
          </Badge>
        );
      case 'normal':
      default:
        return (
          <Badge className="gap-1 bg-[#2D4F3C] text-white">
            <CheckCircle2 className="h-3 w-3" /> {dias} dias
          </Badge>
        ); // Musgo
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-primary h-6 w-6" />
          <div>
            <h1 className="font-display text-2xl font-bold">Monitoramento ANVISA</h1>
            <p className="text-muted-foreground text-sm">
              Monitore o vencimento das autorizações de importação.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="bg-muted/30 border-dashed">
          <CardHeader className="py-4">
            <CardTitle className="text-muted-foreground text-xs font-semibold uppercase">
              Ativas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-foreground text-3xl font-bold">{totals.ativas}</p>
          </CardContent>
        </Card>
        <Card className="border-[#C69B7B]/30 bg-[#F5F2ED]">
          <CardHeader className="py-4">
            <CardTitle className="text-xs font-semibold text-[#8A7F73] uppercase">
              ≤ 90 dias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-3xl font-bold text-yellow-600">{totals.vence90}</p>
          </CardContent>
        </Card>
        <Card className="border-[#C34C32]/30 bg-[#F5F2ED]">
          <CardHeader className="py-4">
            <CardTitle className="text-xs font-semibold text-[#8A7F73] uppercase">
              ≤ 30 dias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-3xl font-bold text-[#C34C32]">{totals.vence30}</p>
          </CardContent>
        </Card>
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="py-4">
            <CardTitle className="text-destructive text-xs font-semibold uppercase">
              Expiradas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-destructive text-3xl font-bold">{totals.expiradas}</p>
          </CardContent>
        </Card>
      </div>

      <div className="bg-card shadow-card border-border flex items-center justify-between rounded-xl border p-4">
        <MonitoramentoFiltros />
      </div>

      <div className="grid gap-3">
        {lista.length === 0 ? (
          <div className="text-muted-foreground py-12 text-center">
            <p>Nenhuma autorização encontrada para os filtros atuais.</p>
          </div>
        ) : (
          lista.map((aut) => (
            <Card key={aut.id} className="hover:shadow-soft transition-all duration-300">
              <CardContent className="flex flex-col items-start justify-between gap-4 p-5 md:flex-row md:items-center">
                <div className="flex-1 space-y-1">
                  <Link
                    href={`/admin/perfil/${aut.pacienteId}`}
                    className="hover:text-primary text-base font-bold transition-colors"
                  >
                    {aut.pacienteNome}
                  </Link>
                  <div className="text-muted-foreground flex items-center gap-2 text-xs">
                    <span>{aut.pacienteEmail}</span>
                    {aut.numeroProcesso && <span>• Processo: {aut.numeroProcesso}</span>}
                  </div>
                  <div className="text-muted-foreground mt-1 flex gap-3 text-xs">
                    <span>
                      Aprovada:{' '}
                      {aut.dataAprovacao
                        ? new Date(aut.dataAprovacao).toLocaleDateString('pt-BR')
                        : '-'}
                    </span>
                    <span>
                      Validade:{' '}
                      {aut.dataValidade
                        ? parseISO(aut.dataValidade).toLocaleDateString('pt-BR')
                        : '-'}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-3 sm:flex-row sm:items-center">
                  <div className="flex flex-col items-end gap-1">
                    {getStatusBadge(aut.statusVisual, aut.diasRestantes)}
                    <span className="text-muted-foreground text-[10px] uppercase">
                      {aut.modalidade === 'representacao' ? 'Representação' : 'Guiada'}
                    </span>
                  </div>
                  <RenovarButton autorizacaoId={aut.id} />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
