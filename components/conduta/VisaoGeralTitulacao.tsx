'use client';

/**
 * A visão GERAL — o *filtro* do `DO-44` (c), não a porta de entrada.
 *
 * A frase do dono: *"creio que o certo era separar por paciente além de ter o filtro de geral
 * aonde vê todos os medicamentos prescritos"*. Por isso a tela **agrupa por paciente**: a linha
 * é o paciente, e os produtos ficam dentro dele. Uma lista plana de medicamentos responderia
 * "quais produtos estão prescritos" — que não é a pergunta que um médico faz.
 *
 * 🛑 SEM `<Table>` (proibição nº 3): o idioma de lista deste produto é lista de Card, medido em
 * `06-PADROES-DO-CODIGO.md` §4.4 — `table.tsx` existe e é usado em ZERO arquivos.
 *
 * A busca segue a anatomia medida em `app/(admin)/admin/usuarios/page.tsx:167`: `Input` com
 * `<Search size={16}>` posicionado absoluto.
 */

import { useMemo, useState } from 'react';
import { ChevronRight, Search, Users } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatarMg } from '@/lib/conduta/dose';

import { AvisoReceituario } from './AvisoReceituario';
import { formatarData } from './PlanoVigente';

export interface LinhaGeral {
  pacienteId: string;
  pacienteNome: string | null;
  medicamentoNome: string;
  gotasPorDia: number;
  cbdMgPorDia: number | null;
  dataInicio: string;
  dataFimPrevista: string;
  teorThcPercentual: string | null;
}

export function VisaoGeralTitulacao({ linhas }: { linhas: LinhaGeral[] }) {
  const [busca, setBusca] = useState('');

  const grupos = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const filtradas = termo
      ? linhas.filter(
          (l) =>
            (l.pacienteNome ?? '').toLowerCase().includes(termo) ||
            l.medicamentoNome.toLowerCase().includes(termo),
        )
      : linhas;

    const mapa = new Map<string, { nome: string | null; itens: LinhaGeral[] }>();
    for (const l of filtradas) {
      const g = mapa.get(l.pacienteId) ?? { nome: l.pacienteNome, itens: [] };
      g.itens.push(l);
      mapa.set(l.pacienteId, g);
    }
    return [...mapa.entries()].sort((a, b) =>
      (a[1].nome ?? '').localeCompare(b[1].nome ?? '', 'pt-BR'),
    );
  }, [linhas, busca]);

  return (
    <div className="space-y-5">
      {/* KPI enxuto — dois números, não seis (`DO-44` d) */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="border-0 shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="bg-primary/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
              <Users size={18} className="text-primary" />
            </div>
            <div>
              <p className="font-mono text-2xl font-semibold tabular-nums">{grupos.length}</p>
              <p className="text-muted-foreground text-xs">
                paciente{grupos.length === 1 ? '' : 's'} em tratamento
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="bg-secondary/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
              <ChevronRight size={18} className="text-secondary" />
            </div>
            <div>
              <p className="font-mono text-2xl font-semibold tabular-nums">
                {grupos.reduce((n, [, g]) => n + g.itens.length, 0)}
              </p>
              <p className="text-muted-foreground text-xs">planos ativos</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="relative">
        <Search
          size={16}
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
        />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por paciente ou produto"
          className="pl-9"
          aria-label="Buscar por paciente ou produto"
        />
      </div>

      {grupos.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Users size={40} className="text-muted-foreground/40" />
            <p className="font-heading text-base font-medium">
              {busca ? 'Nenhum resultado' : 'Nenhum plano ativo'}
            </p>
            <p className="text-muted-foreground max-w-sm text-sm">
              {busca
                ? 'Ajuste a busca para encontrar o paciente ou o produto.'
                : 'Quando uma conduta for registrada, ela aparece aqui.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {grupos.map(([pacienteId, g], i) => (
            <li
              key={pacienteId}
              className="animate-fade-up"
              style={{ animationDelay: `${Math.min(i, 4) * 60}ms` }}
            >
              <Card className="border-0 shadow-sm transition-all hover:shadow-md">
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-heading truncate text-base font-semibold">
                      {g.nome ?? 'Paciente sem nome'}
                    </h3>
                    <Link
                      href={`/medico/pacientes/${pacienteId}`}
                      className="text-primary flex shrink-0 items-center gap-1 text-xs hover:underline"
                    >
                      abrir prontuário
                      <ChevronRight size={13} />
                    </Link>
                  </div>

                  <div className="space-y-2">
                    {g.itens.map((l, idx) => (
                      <div
                        key={`${l.medicamentoNome}-${idx}`}
                        className="bg-muted/30 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl px-3 py-2.5"
                      >
                        <span className="text-sm font-medium">{l.medicamentoNome}</span>
                        <span className="text-muted-foreground font-mono text-sm tabular-nums">
                          {l.gotasPorDia} gotas/dia
                        </span>
                        {l.cbdMgPorDia !== null && (
                          <Badge variant="secondary" className="font-mono text-xs font-normal">
                            CBD {formatarMg(l.cbdMgPorDia)}/dia
                          </Badge>
                        )}
                        <AvisoReceituario
                          teorThcPercentual={l.teorThcPercentual}
                          variante="compacto"
                        />
                        <span className="text-muted-foreground ml-auto font-mono text-[0.7rem]">
                          até {formatarData(l.dataFimPrevista)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
