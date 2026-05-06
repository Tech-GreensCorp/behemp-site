import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Pill,
  FileText,
  Calendar,
  Stethoscope,
  MessageCircle,
  AlertTriangle,
} from 'lucide-react';

// ── Dados mockados ────────────────────────────────────────────

const RESUMO = {
  nome: 'Maria Silva',
  medicoNome: 'Dr. André Lima',
  proximaConsulta: '2026-05-15 14:00',
  medicamentoAtivo: 'CBD Full Spectrum 3000mg',
  dosagem: '15 gotas/dia',
  diasRestantes: 12,
  documentosPendentes: 1,
  mensagensNaoLidas: 3,
};

export default function PacienteDashboardPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Olá, {RESUMO.nome.split(' ')[0]}! 👋
        </h1>
        <p className="mt-1 text-muted-foreground">
          Aqui está o resumo do seu tratamento
        </p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
              <Stethoscope className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Médico</p>
              <p className="text-sm font-medium">{RESUMO.medicoNome}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/10">
              <Calendar className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Próxima consulta</p>
              <p className="text-sm font-medium">15/05/2026 às 14:00</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10">
              <FileText className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Documentos</p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{RESUMO.documentosPendentes} pendente</p>
                <Badge variant="secondary" className="h-5 text-[10px]">⚠</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10">
              <MessageCircle className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Mensagens</p>
              <p className="text-sm font-medium">{RESUMO.mensagensNaoLidas} não lidas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Medicamento ativo */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Pill className="h-5 w-5 text-primary" />
            Medicamento Ativo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">{RESUMO.medicamentoAtivo}</p>
              <p className="text-sm text-muted-foreground">{RESUMO.dosagem}</p>
            </div>
            <div className="flex items-center gap-3">
              {RESUMO.diasRestantes <= 15 && (
                <div className="flex items-center gap-1.5 text-sm text-amber-600">
                  <AlertTriangle className="h-4 w-4" />
                  <span>{RESUMO.diasRestantes} dias restantes</span>
                </div>
              )}
              <Badge variant={RESUMO.diasRestantes <= 15 ? 'secondary' : 'default'}>
                {RESUMO.diasRestantes <= 15 ? 'Recompra em breve' : 'OK'}
              </Badge>
            </div>
          </div>

          {/* Barra de progresso */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Consumo do frasco</span>
              <span>{Math.round((1 - RESUMO.diasRestantes / 40) * 100)}%</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.round((1 - RESUMO.diasRestantes / 40) * 100)}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
