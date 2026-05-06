'use client';

import { use } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  User,
  FileText,
  Upload,
  TrendingUp,
  Pill,
  BarChart3,
  FileDown,
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
} from 'lucide-react';
import Link from 'next/link';

// ── Dados mockados ────────────────────────────────────────────

const PACIENTE_MOCK = {
  id: '1',
  nome: 'Maria Silva',
  email: 'maria@email.com',
  telefone: '(11) 99999-1234',
  dataNascimento: '1985-03-15',
  cpf: '123.456.789-00',
  status: 'em_tratamento',
  tratamento: 'cbd',
  medicoNome: 'Dr. André Lima',
  endereco: 'Rua das Flores, 123 — São Paulo/SP',
};

const ANAMNESES_MOCK = [
  { id: '1', data: '2026-01-20', conteudo: 'Paciente relata dores crônicas na região lombar há 5 anos. Já tentou fisioterapia e anti-inflamatórios sem resultado satisfatório. Sem alergias conhecidas. Histórico familiar de fibromialgia.' },
];

const DOCUMENTOS_MOCK = [
  { id: '1', tipo: 'rg', nome: 'RG_Maria.pdf', status: 'válido' },
  { id: '2', tipo: 'receita_medica', nome: 'Receita_CBD.pdf', status: 'válido' },
  { id: '3', tipo: 'autorizacao_anvisa', nome: 'Anvisa_2026.pdf', status: 'vencendo' },
];

const EVOLUCOES_MOCK = [
  { id: '1', data: '2026-04-15', nivelDor: 4, qualidadeSono: 7, bemEstar: 6, conteudo: 'Melhora significativa nas dores. Paciente relata melhor qualidade de sono.' },
  { id: '2', data: '2026-03-20', nivelDor: 6, qualidadeSono: 5, bemEstar: 4, conteudo: 'Início do tratamento com CBD. Dosagem de 10 gotas/dia.' },
  { id: '3', data: '2026-02-10', nivelDor: 8, qualidadeSono: 3, bemEstar: 3, conteudo: 'Avaliação inicial. Dores intensas, dificuldade para dormir.' },
];

const DOSAGENS_MOCK = [
  { id: '1', medicamento: 'CBD Full Spectrum 3000mg', gotasPorDia: 15, mlFrasco: 30, dataInicio: '2026-03-20', dataFim: '2026-05-01', ativa: true },
  { id: '2', medicamento: 'CBD Isolado 1000mg', gotasPorDia: 10, mlFrasco: 30, dataInicio: '2026-01-20', dataFim: '2026-03-20', ativa: false },
];

export default function PacienteDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const paciente = PACIENTE_MOCK;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/medico/pacientes">
          <Button variant="ghost" size="icon" className="mt-1 shrink-0" nativeButton={false}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{paciente.nome}</h1>
            <Badge variant="default">Em tratamento</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            ID: {id} · Médico: {paciente.medicoNome}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="dados">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="dados" className="gap-1.5">
            <User className="h-4 w-4" /> Dados
          </TabsTrigger>
          <TabsTrigger value="anamnese" className="gap-1.5">
            <FileText className="h-4 w-4" /> Anamnese
          </TabsTrigger>
          <TabsTrigger value="documentos" className="gap-1.5">
            <Upload className="h-4 w-4" /> Documentos
          </TabsTrigger>
          <TabsTrigger value="evolucao" className="gap-1.5">
            <TrendingUp className="h-4 w-4" /> Evolução
          </TabsTrigger>
          <TabsTrigger value="dosagem" className="gap-1.5">
            <Pill className="h-4 w-4" /> Dosagem
          </TabsTrigger>
          <TabsTrigger value="graficos" className="gap-1.5">
            <BarChart3 className="h-4 w-4" /> Gráficos
          </TabsTrigger>
          <TabsTrigger value="relatorios" className="gap-1.5">
            <FileDown className="h-4 w-4" /> Relatórios
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Dados ────────────────────────────── */}
        <TabsContent value="dados">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Dados Pessoais</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">E-mail</p>
                    <p className="text-sm font-medium">{paciente.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Telefone</p>
                    <p className="text-sm font-medium">{paciente.telefone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Data de Nascimento</p>
                    <p className="text-sm font-medium">15/03/1985</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">CPF</p>
                    <p className="text-sm font-medium">{paciente.cpf}</p>
                  </div>
                </div>
              </div>
              <div className="mt-6 border-t pt-6">
                <p className="text-xs text-muted-foreground">Endereço</p>
                <p className="mt-1 text-sm font-medium">{paciente.endereco}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Anamnese ─────────────────────────── */}
        <TabsContent value="anamnese">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Anamnese</h2>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" /> Nova anamnese
              </Button>
            </div>
            {ANAMNESES_MOCK.map((anamnese) => (
              <Card key={anamnese.id} className="border-0 shadow-sm">
                <CardContent className="p-6">
                  <p className="mb-2 text-xs text-muted-foreground">
                    {new Date(anamnese.data).toLocaleDateString('pt-BR')}
                  </p>
                  <p className="leading-relaxed text-sm">{anamnese.conteudo}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── Tab: Documentos ──────────────────────── */}
        <TabsContent value="documentos">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Documentos</h2>
              <Button size="sm" className="gap-1.5">
                <Upload className="h-4 w-4" /> Upload
              </Button>
            </div>
            <div className="space-y-3">
              {DOCUMENTOS_MOCK.map((doc) => (
                <Card key={doc.id} className="border-0 shadow-sm">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{doc.nome}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {doc.tipo.replace(/_/g, ' ')}
                        </p>
                      </div>
                    </div>
                    <Badge variant={doc.status === 'vencendo' ? 'secondary' : 'outline'}>
                      {doc.status === 'vencendo' ? '⚠ Vencendo' : '✓ Válido'}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ── Tab: Evolução ────────────────────────── */}
        <TabsContent value="evolucao">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Evolução Clínica</h2>
              <Button size="sm" className="gap-1.5">
                <TrendingUp className="h-4 w-4" /> Nova evolução
              </Button>
            </div>
            {EVOLUCOES_MOCK.map((evo) => (
              <Card key={evo.id} className="border-0 shadow-sm">
                <CardContent className="p-6">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">
                      {new Date(evo.data).toLocaleDateString('pt-BR')}
                    </p>
                    <div className="flex gap-3">
                      <span className="text-xs">
                        Dor: <strong className="text-primary">{evo.nivelDor}/10</strong>
                      </span>
                      <span className="text-xs">
                        Sono: <strong className="text-primary">{evo.qualidadeSono}/10</strong>
                      </span>
                      <span className="text-xs">
                        Bem-estar: <strong className="text-primary">{evo.bemEstar}/10</strong>
                      </span>
                    </div>
                  </div>
                  <p className="leading-relaxed text-sm">{evo.conteudo}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── Tab: Dosagem ─────────────────────────── */}
        <TabsContent value="dosagem">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Dosagens</h2>
              <Button size="sm" className="gap-1.5">
                <Pill className="h-4 w-4" /> Nova dosagem
              </Button>
            </div>
            {DOSAGENS_MOCK.map((dose) => (
              <Card key={dose.id} className={`border-0 shadow-sm ${!dose.ativa ? 'opacity-60' : ''}`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{dose.medicamento}</p>
                        {dose.ativa && <Badge>Ativa</Badge>}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {dose.gotasPorDia} gotas/dia · Frasco {dose.mlFrasco}ml
                      </p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <p>Início: {new Date(dose.dataInicio).toLocaleDateString('pt-BR')}</p>
                      <p>Término: {new Date(dose.dataFim).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── Tab: Gráficos ────────────────────────── */}
        <TabsContent value="graficos">
          <Card className="border-0 shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <BarChart3 className="mb-4 h-12 w-12 text-muted-foreground/30" />
              <p className="text-lg font-medium">Gráficos de Evolução</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Gráficos de nível de dor, qualidade de sono e bem-estar serão
                exibidos aqui com dados reais das evoluções registradas.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Relatórios ──────────────────────── */}
        <TabsContent value="relatorios">
          <Card className="border-0 shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <FileDown className="mb-4 h-12 w-12 text-muted-foreground/30" />
              <p className="text-lg font-medium">Exportar Relatório PDF</p>
              <p className="mt-1 mb-6 text-sm text-muted-foreground">
                Gere um relatório consolidado com todos os dados do paciente.
              </p>
              <Button className="gap-2">
                <FileDown className="h-4 w-4" />
                Gerar PDF
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Componente auxiliar usado nas tabs
function Plus({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}
