import type { Metadata } from 'next';
import Link from 'next/link';
import { UserPlus } from 'lucide-react';

import { JornadaDoDependente } from '@/components/responsavel/jornada-do-dependente';
import {
  AtalhosDoDependente,
  CabecalhoDoPainel,
  CartaoDaProximaConsulta,
  CartoesDeAcompanhamento,
  SolicitacoesRecentes,
} from '@/components/responsavel/painel-do-dependente';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  listarDependentesDoResponsavel,
  responsavelDaSessao,
} from '@/lib/auth/escopo-do-responsavel';
import {
  listarRecomprasDoDependente,
  obterFichaDoDependente,
  resumoDoDependente,
} from '@/lib/dependentes/leituras';
import { idadeEmAnos } from '@/lib/dependentes/regras';
import { formatarDiaPorExtenso, primeiroNome } from '@/lib/dependentes/rotulos';

export const metadata: Metadata = { title: 'Início | Be4Hope' };
// Lê o banco a cada acesso: a lista é do responsável logado, nunca pode ser cacheada entre usuários.
export const dynamic = 'force-dynamic';

/**
 * O painel do responsável (ADR-0033).
 *
 * 🔴 SEM DEPENDENTES, NADA QUE DEPENDA DE UM PACIENTE (pedido de Dryelle, 29/10/2026): sem "Jornada", sem
 * consulta, medicamento, documento ou pendência. Só a orientação e o caminho para cadastrar o primeiro.
 *
 * COM dependentes, cada um tem o próprio bloco, **identificado pelo nome** ("Jornada de <nome>"). Nada é somado
 * nem misturado entre dependentes.
 */
export default async function ResponsavelInicioPage() {
  const responsavel = await responsavelDaSessao();
  const dependentes = await listarDependentesDoResponsavel();

  const blocos = await Promise.all(
    dependentes.map(async (d) => ({
      d,
      ficha: await obterFichaDoDependente(d.pacienteId),
      resumo: await resumoDoDependente(d.pacienteId),
      recompras: (await listarRecomprasDoDependente(d.pacienteId)).slice(0, 3),
    })),
  );

  return (
    <div className="space-y-8">
      <div>
        <p className="text-muted-foreground text-xs font-semibold tracking-wider first-letter:uppercase">
          {formatarDiaPorExtenso(new Date())}
        </p>
        <h1 className="font-display text-foreground mt-1 text-3xl font-bold tracking-tight">
          Olá{responsavel ? `, ${primeiroNome(responsavel.nome)}` : ''}
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
          {dependentes.length === 0
            ? 'Aqui você cuida das pessoas que estão sob a sua responsabilidade.'
            : 'Acompanhe cada dependente separadamente.'}
        </p>
      </div>

      {dependentes.length === 0 ? (
        <Card className="border-border/50 rounded-[1.75rem] border-dashed">
          <CardContent className="flex flex-col items-start gap-4 p-8">
            <div className="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-2xl">
              <UserPlus className="text-primary h-6 w-6" />
            </div>
            <div>
              <h2 className="font-display text-foreground text-lg font-bold">
                Cadastre o primeiro dependente
              </h2>
              <p className="text-muted-foreground mt-1 max-w-xl text-sm">
                Depois do cadastro você acompanha a jornada, os medicamentos, os documentos e as
                solicitações dele, tudo identificado com o nome dele.
              </p>
            </div>
            <Button
              render={<Link href="/responsavel/dependentes/novo" />}
              className="h-10 rounded-full px-6 text-xs font-semibold"
            >
              Cadastrar dependente
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-12">
          {blocos.map(({ d, ficha, resumo, recompras }) => (
            <section key={d.vinculoId} className="space-y-4" aria-label={`Dependente ${d.nome}`}>
              <CabecalhoDoPainel
                pacienteId={d.pacienteId}
                nome={d.nome}
                parentesco={d.parentesco}
                idade={ficha ? idadeEmAnos(ficha.dataNascimento) : null}
                status={ficha?.status ?? 'aguardando_consulta'}
              />

              <div className="grid gap-4 lg:grid-cols-3">
                {ficha && (
                  <div className="lg:col-span-2">
                    <JornadaDoDependente
                      nome={d.nome}
                      fase={ficha.jornadaFase}
                      status={ficha.status}
                      medicoNome={ficha.medicoNome}
                    />
                  </div>
                )}
                <CartaoDaProximaConsulta
                  pacienteId={d.pacienteId}
                  nome={d.nome}
                  consulta={resumo.proximaConsulta}
                />
              </div>

              <CartoesDeAcompanhamento pacienteId={d.pacienteId} resumo={resumo} />

              <div className="grid gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <SolicitacoesRecentes
                    pacienteId={d.pacienteId}
                    nome={d.nome}
                    recompras={recompras}
                  />
                </div>
                <AtalhosDoDependente pacienteId={d.pacienteId} nome={d.nome} />
              </div>
            </section>
          ))}

          <Button
            render={<Link href="/responsavel/dependentes/novo" />}
            variant="outline"
            className="h-10 rounded-full px-6 text-xs font-semibold"
          >
            <UserPlus className="mr-1.5 h-4 w-4" /> Cadastrar outro dependente
          </Button>
        </div>
      )}
    </div>
  );
}
