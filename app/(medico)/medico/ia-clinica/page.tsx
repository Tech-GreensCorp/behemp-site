import Link from 'next/link';
import {
  Brain,
  ChevronRight,
  ClipboardList,
  FileSearch,
  GitBranch,
  Pill,
  ShieldCheck,
  Users,
} from 'lucide-react';

import { listarPacientes } from '@/app/_actions/pacientes';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GRAFO_SCHEMA_VERSION } from '@/lib/ia-clinica/contrato';

/**
 * Entrada do módulo de IA clínica — a "casa" criada na Sprint 2.
 *
 * POR QUE ESTA PÁGINA EXISTE, E POR QUE ELA AINDA NÃO TEM CONTEÚDO
 * A [ADR-0002](../../../../docs/adr/ADR-0002-ui-antes-da-inteligencia.md) parte o trabalho em
 * duas metades: telas primeiro, motor depois. A Sprint 2 entrega a **fundação** — o contrato de
 * dados congelado e o lugar onde as telas vão morar. As telas de conteúdo são as Sprints 3 a 7,
 * e **cada uma depende de decisão que ainda não foi tomada** (ADR-0004, 0005 e 0006 estão em
 * proposta; `GAP-12`, `GAP-13` e `GAP-14` sem resposta).
 *
 * Construir as telas antes disso significaria **presumir regra de negócio** — a Proibição 4 do
 * `CLAUDE.md`. Então esta página mostra o mapa e diz, em cada fatia, o que falta para ela
 * existir. É honestidade de estado, não placeholder.
 *
 * AUTORIZAÇÃO: `app/(medico)/layout.tsx` já barra quem não é `medico` nem `admin`
 * (`obterRoleComFallback` + `redirect('/')`). Este módulo herda isso — não há checagem própria
 * aqui de propósito, para não haver duas regras de acesso que possam divergir.
 *
 * Localização decidida por `DO-11` ("a área nova mora dentro de `(medico)`") e o nome
 * `ia-clinica` pelo dono em 20/08/2026.
 */

/**
 * Dinâmica por natureza: lê dado do paciente autenticado, via `headers()` do Clerk. Declarar
 * aqui evita o Next tentar prerenderizar e registrar "Dynamic server usage" no build — ruído que
 * esconde erro de verdade. As 11 páginas de `(admin)` têm o mesmo padrão sem a declaração, e por
 * isso o build acumula 22 avisos; o código novo não aumenta essa conta.
 */
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'IA Clínica | Be4Hope',
  description: 'Inteligência clínica assistida — anamnese, hipóteses, conduta e titulação.',
};

/** As fatias do módulo, na ordem do ciclo clínico do canabidiol. */
const FATIAS = [
  {
    icone: ClipboardList,
    titulo: 'Anamnese de acompanhamento',
    descricao:
      'Marco zero de uma série, não questionário que termina em diagnóstico. Repetida a cada revisão para medir a evolução.',
    sprint: 'Sprint 3',
    bloqueio: '✅ feita em 20/08 — com rastreio do uso e o primeiro uso como caminho próprio',
  },
  {
    icone: GitBranch,
    titulo: 'Hipóteses e revisão humana',
    descricao:
      'O motor ranqueia até 3 hipóteses com grafo de evidências; o médico valida ou registra divergência. Divergência é dado, não erro.',
    sprint: 'Sprint 4',
    bloqueio: 'ADR-0006 em proposta · CFM 2.299/21 não transcrita',
  },
  {
    icone: Pill,
    titulo: 'Conduta, prescrição e titulação',
    descricao:
      'Cadeia sequencial: conduta gera prescrição, prescrição gera dosagem, dosagem entra em titulação com revisão marcada.',
    sprint: 'Sprint 5',
    bloqueio: 'ADR-0005 em proposta · RDC não transcrita · quando um ajuste exige receita nova',
  },
  {
    icone: FileSearch,
    titulo: 'Exames',
    descricao: 'Anexar, ver e vincular exames ao raciocínio clínico.',
    sprint: 'Sprint 7',
    bloqueio: 'aguarda a conversa do dono com o chefe (`DO-13`)',
  },
] as const;

export default async function IaClinicaPage() {
  // Reusa a action que a área do médico já usa — `listarPacientes` filtra pelo médico logado.
  // Uma action nova aqui duplicaria a regra de escopo, e regra duplicada é regra que diverge.
  const pacientesResult = await listarPacientes({ status: 'todos' });
  const pacientes = pacientesResult.sucesso ? (pacientesResult.dados ?? []) : [];
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 flex size-11 items-center justify-center rounded-xl">
            <Brain className="text-primary size-6" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-semibold">IA Clínica</h1>
            <p className="text-muted-foreground text-sm">
              Inteligência clínica assistida, direcionada ao canabidiol
            </p>
          </div>
        </div>
      </header>

      {/* O estado real do módulo, dito sem rodeio. Uma tela que finge estar pronta custa mais
          caro que uma tela que diz o que falta. */}
      <Card className="border-secondary/30 bg-secondary/5">
        <CardHeader className="pb-3">
          <CardTitle className="font-heading flex items-center gap-2 text-base">
            <ShieldCheck className="text-secondary size-4" />
            Fundação pronta — as telas vêm por fatia
          </CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-3 text-sm">
          <p>
            O <strong className="text-foreground">contrato de dados</strong> do motor está congelado
            no repositório, derivado da resposta real —{' '}
            <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
              schema {GRAFO_SCHEMA_VERSION}
            </code>
            . Nenhuma tela precisará imaginar um campo.
          </p>
          <p>
            O motor de IA <strong className="text-foreground">ainda não está ligado</strong>: ele
            depende de mais memória na máquina de produção. Cada fatia abaixo mostra o que falta
            para ser construída — e o que falta é, em geral, uma decisão, não código.
          </p>
        </CardContent>
      </Card>

      {/* A anamnese é a primeira fatia que EXISTE — Sprint 3. Entra acima do mapa, porque o que
          funciona vem antes do que ainda não funciona. */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-semibold">Anamnese de acompanhamento</h2>
          <Badge variant="outline" className="gap-1">
            <Users className="size-3" />
            {pacientes.length} {pacientes.length === 1 ? 'paciente' : 'pacientes'}
          </Badge>
        </div>

        {pacientes.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground py-8 text-center text-sm">
              Nenhum paciente vinculado ainda. A anamnese começa a partir de um paciente seu.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="divide-y p-0">
              {pacientes.slice(0, 12).map((p) => (
                <Link
                  key={p.id}
                  href={`/medico/ia-clinica/anamnese/${p.id}`}
                  className="hover:bg-muted/50 flex items-center justify-between gap-3 px-4 py-3 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.nome}</p>
                    <p className="text-muted-foreground truncate text-xs">{p.email}</p>
                  </div>
                  <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                </Link>
              ))}
            </CardContent>
          </Card>
        )}
        {pacientes.length > 12 && (
          <p className="text-muted-foreground text-xs">
            Mostrando 12 de {pacientes.length}. A busca completa está em{' '}
            <Link href="/medico/pacientes" className="text-primary font-medium underline">
              Pacientes
            </Link>
            .
          </p>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-lg font-semibold">O que o módulo vai ter</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {FATIAS.map((fatia) => {
            const Icone = fatia.icone;
            return (
              <Card key={fatia.titulo} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <Icone className="text-primary size-5 shrink-0" />
                      <CardTitle className="font-heading text-base leading-tight">
                        {fatia.titulo}
                      </CardTitle>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-xs">
                      {fatia.sprint}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-between gap-3">
                  <p className="text-muted-foreground text-sm leading-relaxed">{fatia.descricao}</p>
                  <p className="border-muted text-muted-foreground border-l-2 pl-3 text-xs">
                    <span className="text-foreground font-medium">Falta:</span> {fatia.bloqueio}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/*
        FRONTEIRA_MOTOR_IA: esta página passa a listar as análises reais do paciente quando o
        motor existir (Sprint 9). A chamada entra aqui, contra `RespostaAnalise` de
        `lib/ia-clinica/contrato.ts` — o formato já está congelado, então a troca é de fonte de
        dados, não de tipo.
      */}

      <footer className="text-muted-foreground border-t pt-6 text-sm">
        Enquanto as fatias não existem, a documentação clínica continua na{' '}
        <Link href="/medico/teleconsulta" className="text-primary font-medium underline">
          teleconsulta
        </Link>{' '}
        e no prontuário de cada paciente.
      </footer>
    </div>
  );
}
