import { Minus, TrendingDown, TrendingUp } from 'lucide-react';

import type { SerieMedidas } from '@/app/_actions/anamnese-baseline';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * A série de medidas — o que faz a anamnese valer como baseline.
 *
 * POR QUE ESTE COMPONENTE EXISTE
 * ADR-0004 D-01: a série existe no banco. Se não existir na tela, o médico não vê a evolução — e
 * a evolução é a única coisa que responde "o tratamento está funcionando?".
 *
 * 🔴 SEM GRÁFICO, DE PROPÓSITO. `recharts` está no projeto, mas com 2 ou 3 pontos um gráfico
 * mostra menos que uma tabela e sugere tendência onde não há. Gráfico entra quando a série tiver
 * densidade — e isso é decisão de quando, não de se.
 *
 * Server Component: só lê e formata. Nenhum estado, nenhum evento.
 */

interface Props {
  medidas: SerieMedidas['medidas'];
}

/** As colunas da série, com a direção de cada escala. */
const COLUNAS = [
  { chave: 'nivelDor', rotulo: 'Dor', maiorEhMelhor: false },
  { chave: 'qualidadeSono', rotulo: 'Sono', maiorEhMelhor: true },
  { chave: 'nivelAnsiedade', rotulo: 'Ansiedade', maiorEhMelhor: false },
  { chave: 'qualidadeVidaGlobal', rotulo: 'Qual. vida', maiorEhMelhor: true },
] as const;

/** Seta de tendência já interpretada como melhora ou piora — inclusive nas escalas invertidas. */
function Tendencia({
  atual,
  anterior,
  maiorEhMelhor,
}: {
  atual: number | null;
  anterior: number | null | undefined;
  maiorEhMelhor: boolean;
}) {
  if (atual === null || anterior === null || anterior === undefined) return null;
  const delta = atual - anterior;
  if (delta === 0) return <Minus className="text-muted-foreground inline size-3" />;
  const melhorou = maiorEhMelhor ? delta > 0 : delta < 0;
  const Icone = delta > 0 ? TrendingUp : TrendingDown;
  return (
    <Icone
      className={cn('inline size-3', melhorou ? 'text-secondary' : 'text-destructive')}
      aria-label={melhorou ? 'melhorou' : 'piorou'}
    />
  );
}

export function SerieDeMedidas({ medidas }: Props) {
  if (medidas.length === 0) return null;

  // Da mais antiga para a mais recente na leitura, porque evolução se lê no sentido do tempo.
  const cronologica = [...medidas].reverse();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-heading text-base">Evolução</CardTitle>
        <p className="text-muted-foreground text-sm">
          {medidas.length} {medidas.length === 1 ? 'medição' : 'medições'}, da primeira à mais
          recente. As setas comparam com a medição anterior.
        </p>
      </CardHeader>
      <CardContent>
        {/* Tabela em <div>, não <Table>: `components/ui/table.tsx` tem 0 usos no produto e a
            Proibição 2 do CLAUDE.md manda não introduzi-lo. Rolagem horizontal própria, para o
            corpo da página nunca rolar de lado. */}
        <div className="-mx-2 overflow-x-auto px-2">
          <div className="min-w-[560px]">
            <div className="text-muted-foreground grid grid-cols-[110px_repeat(4,1fr)_90px] gap-2 border-b pb-2 text-xs font-medium">
              <span>Data</span>
              {COLUNAS.map((c) => (
                <span key={c.chave} className="text-center">
                  {c.rotulo}
                </span>
              ))}
              <span className="text-center">Crises</span>
            </div>

            {cronologica.map((m, i) => {
              const previa = i > 0 ? cronologica[i - 1] : undefined;
              return (
                <div
                  key={m.id}
                  className="grid grid-cols-[110px_repeat(4,1fr)_90px] items-center gap-2 border-b py-2 text-sm last:border-0"
                >
                  <span className="text-muted-foreground font-mono text-xs">{m.medidoEm}</span>
                  {COLUNAS.map((c) => (
                    <span key={c.chave} className="text-center font-mono tabular-nums">
                      {m[c.chave] ?? <span className="text-muted-foreground">—</span>}
                      {m[c.chave] !== null && (
                        <span className="ml-1">
                          <Tendencia
                            atual={m[c.chave]}
                            anterior={previa?.[c.chave]}
                            maiorEhMelhor={c.maiorEhMelhor}
                          />
                        </span>
                      )}
                    </span>
                  ))}
                  <span className="text-center font-mono text-xs tabular-nums">
                    {m.crisesContagem !== null ? (
                      <>
                        {m.crisesContagem}
                        <span className="text-muted-foreground">
                          /{m.crisesPeriodo?.[0] ?? '?'}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-muted-foreground mt-3 text-xs">
          Dor e ansiedade: menor é melhor. Sono e qualidade de vida: maior é melhor. As setas já
          levam isso em conta.
        </p>
      </CardContent>
    </Card>
  );
}
