import Link from 'next/link';
import { ArrowLeft, Brain, ClipboardList, TrendingUp } from 'lucide-react';

import {
  buscarSerieMedidas,
  buscarUltimoRastreio,
  ehPrimeiraAvaliacao,
} from '@/app/_actions/anamnese-baseline';
import { FormMedidas } from '@/components/ia-clinica/FormMedidas';
import { RastreioUso } from '@/components/ia-clinica/RastreioUso';
import { AnaliseAssistida } from '@/components/ia-clinica/AnaliseAssistida';
import { SerieDeMedidas } from '@/components/ia-clinica/SerieDeMedidas';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { GrafoEvidencias } from '@/lib/ia-clinica/contrato';

/**
 * Anamnese como baseline — a tela dos dois modos (ADR-0004 D-02).
 *
 * **Primeira avaliação:** seções na página, todas visíveis desde o início, com trilha lateral. O
 * NN/g recomenda mostrar todos os passos de saída como visão geral do processo.
 * **Retorno:** as mesmas medidas, com o valor anterior ao lado e a série acima.
 *
 * 🔴 NÃO É WIZARD, e isso é divergência deliberada do VidAI — a maior desta demanda. O motivo
 * está na ADR-0004 D-02: wizard linear é contraindicado para usuário frequente e expert, e o caso
 * mais comum aqui é o **retorno**, onde o médico quer ver o que mudou, não percorrer 6 passos.
 *
 * Server Component: busca direto pelas actions, sem round-trip por Route Handler — o padrão do
 * `AGENTS.md`. A interatividade fica nos componentes client de formulário.
 */

/**
 * Dinâmica por natureza: lê dado do paciente autenticado, via `headers()` do Clerk. Declarar
 * aqui evita o Next tentar prerenderizar e registrar "Dynamic server usage" no build — ruído que
 * esconde erro de verdade. As 11 páginas de `(admin)` têm o mesmo padrão sem a declaração, e por
 * isso o build acumula 22 avisos; o código novo não aumenta essa conta.
 */
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Anamnese | IA Clínica',
};

export default async function AnamnesePage({
  params,
  searchParams,
}: {
  params: Promise<{ pacienteId: string }>;
  searchParams: Promise<{ secao?: string }>;
}) {
  const { pacienteId } = await params;
  const { secao } = await searchParams;

  // As três leituras em paralelo: cada uma prova escopo de objeto por dentro.
  const [modo, serie, rastreio] = await Promise.all([
    ehPrimeiraAvaliacao(pacienteId),
    buscarSerieMedidas(pacienteId),
    buscarUltimoRastreio(pacienteId),
  ]);

  // Erro de escopo é indistinto de "não existe", de propósito: responder diferente para os dois
  // casos transformaria a página em oráculo de enumeração de pacientes.
  if (!modo.sucesso) {
    return (
      <div className="mx-auto max-w-2xl py-12">
        <Alert variant="destructive">
          <AlertTitle>Paciente não encontrado</AlertTitle>
          <AlertDescription>{modo.erro}</AlertDescription>
        </Alert>
        <Link href="/medico/ia-clinica" className="mt-6 inline-block">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="size-4" />
            Voltar ao módulo
          </Button>
        </Link>
      </div>
    );
  }

  /**
   * 🔴 O fixture só entra FORA de produção.
   *
   * O motor não existe ainda, e a ADR-0002 manda construir contra a **resposta real congelada**
   * em vez de dado imaginado. Em produção, `null` — e a tela mostra o estado vazio, sem botão
   * inerte. Deixar fixture chegar a produção seria dado inventado numa tela clínica.
   *
   * FRONTEIRA_MOTOR_IA: aqui entra a chamada real ao motor (Sprint 9). O formato já é este.
   */
  const grafoDemonstracao =
    process.env.NODE_ENV === 'production'
      ? null
      : ((await import('@/__fixtures__/ia-clinica/resposta-completa-teleconsulta.json')).default
          .grafo as unknown as GrafoEvidencias);

  const primeira = modo.dados.primeira;
  const medidas = serie.sucesso ? serie.dados.medidas : [];
  const anterior = medidas[0] ?? null;
  const ultimoRastreio = rastreio.sucesso ? rastreio.dados.rastreio : null;

  const SECOES = [
    { id: 'medidas', rotulo: 'Medidas de acompanhamento', icone: TrendingUp },
    { id: 'uso', rotulo: 'Uso de cannabis', icone: ClipboardList },
    { id: 'ia', rotulo: 'Análise assistida', icone: Brain },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-4">
        <Link href="/medico/ia-clinica" className="-ml-2 inline-block">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="size-4" />
            IA Clínica
          </Button>
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl font-semibold">
              {primeira ? 'Primeira avaliação' : 'Retorno'}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {primeira
                ? 'Marco zero da série. É contra estes valores que a evolução vai ser medida.'
                : `${medidas.length} ${medidas.length === 1 ? 'medição' : 'medições'} registradas. Preencha só o que remediu hoje.`}
            </p>
          </div>
          <Badge variant={primeira ? 'default' : 'outline'}>
            {primeira ? 'baseline' : 'acompanhamento'}
          </Badge>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        {/* Trilha lateral — todas as seções visíveis desde o início (D-02). Âncoras, não passos:
            o médico salta para o que precisa em vez de percorrer. */}
        <nav aria-label="Seções" className="lg:sticky lg:top-6 lg:self-start">
          <ul className="space-y-1">
            {SECOES.map((s) => {
              const Icone = s.icone;
              const ativa = secao === s.id;
              return (
                <li key={s.id}>
                  <Link
                    href={`?secao=${s.id}#${s.id}`}
                    className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                      ativa
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <Icone className="size-4 shrink-0" />
                    {s.rotulo}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="space-y-6">
          {/* No retorno, a série vem ANTES do formulário: o médico decide o que remedir depois de
              ver a evolução, não antes. */}
          {!primeira && medidas.length > 0 && (
            <section id="serie">
              <SerieDeMedidas medidas={medidas} />
            </section>
          )}

          <section id="medidas" className="scroll-mt-6">
            <FormMedidas pacienteId={pacienteId} anterior={anterior} />
          </section>

          <section id="uso" className="scroll-mt-6 space-y-3">
            {ultimoRastreio && (
              <Alert>
                <AlertDescription className="text-sm">
                  Último rastreio:{' '}
                  <strong>
                    {ultimoRastreio.situacao === 'primeiro_uso'
                      ? 'nunca havia usado'
                      : ultimoRastreio.situacao === 'usa_atualmente'
                        ? 'usava no momento'
                        : 'já havia usado e parado'}
                  </strong>
                  {ultimoRastreio.produtoDescrito && ` — ${ultimoRastreio.produtoDescrito}`}. Um
                  registro novo não apaga este.
                </AlertDescription>
              </Alert>
            )}
            <RastreioUso pacienteId={pacienteId} ehRetorno={!primeira} />
          </section>

          {/*
            O lugar da IA existe, com estado vazio que explica o que virá — ADR-0002 D-04.
            🔴 SEM BOTÃO INERTE: botão que não faz nada ensina o médico a não confiar na tela.

            FRONTEIRA_MOTOR_IA: aqui entra a análise da anamnese (Sprint 9). O contrato já está
            congelado em `lib/ia-clinica/contrato.ts`, então a troca será de fonte de dados.
          */}
          <section id="ia" className="scroll-mt-6">
            <AnaliseAssistida
              pacienteId={pacienteId}
              anamneseId={modo.dados.anamneseId ?? undefined}
              grafo={grafoDemonstracao}
              ehDemonstracao={Boolean(grafoDemonstracao)}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
