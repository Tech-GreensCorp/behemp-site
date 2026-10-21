'use client';

/**
 * As três hipóteses com a evidência de cada — o layout **que informa**, aprovado pelo dono em
 * 20/08/2026 (`DO-33`), desenhado em `docs/decisoes-visuais/ia-clinica-e-anvisa.html`.
 *
 * 🔴 A REGRA QUE ESTE COMPONENTE EXISTE PARA CUMPRIR
 * *Nenhuma saída do modelo chega ao prontuário sem um ato humano registrado.* Não é preferência
 * de interface: é o que sustenta que o sistema **informa** em vez de **dirigir** a conduta — e a
 * distinção pesa no enquadramento de risco de software médico (ANVISA RDC 657/2022,
 * `ANV-01`…`ANV-04`).
 *
 * Daí três decisões de desenho que não são estéticas:
 *
 * 1. **Nunca um número de confiança.** `Hipotese.probabilidade` existe no contrato porque o
 *    motor a emite, e **não vai para a tela** — ADR-0006. O que aparece é a faixa
 *    `confianca_evidencia` (alta/média/baixa), que o próprio motor calibra. Mostrar "78 %" a um
 *    médico é o que o PAIR Guidebook contraindica.
 * 2. **A origem de cada achado é dita.** `inferido_ia` aparece diferente de
 *    `historico_validado`. Sem isso, sugestão de modelo e fato registrado ficam iguais na tela.
 * 3. **Nenhum botão que execute conduta.** Não há "prescrever" aqui. A ação humana vive em
 *    `<RevisaoHumana>`, e é ela que grava.
 *
 * O que o motor não fechou aparece: `completude`, achados inconclusivos e as salvaguardas
 * determinísticas. Esconder a incompletude é o que produz fechamento prematuro.
 */

import { AlertOctagon, Bot, ShieldAlert } from 'lucide-react';

import { EvidenciaDaHipotese } from '@/components/ia-clinica/EvidenciaDaHipotese';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  faixaDeConfianca,
  grafoEstaParcial,
  type ConfiancaEvidencia,
  type GrafoEvidencias,
  type Hipotese,
} from '@/lib/ia-clinica/contrato';
import { evidenciaDa } from '@/lib/ia-clinica/evidencia';
import { AvisoDeUrgencia, SeloDeUrgencia } from '@/components/ia-clinica/SeloDeUrgencia';
import { cn } from '@/lib/utils';

/** A faixa de confiança, em palavra. Nunca número — ADR-0006. */
const FAIXA: Record<ConfiancaEvidencia, { rotulo: string; classe: string }> = {
  alta: { rotulo: 'evidência alta', classe: 'border-secondary/50 bg-secondary/10 text-secondary' },
  media: { rotulo: 'evidência média', classe: 'border-primary/40 bg-primary/5 text-primary' },
  baixa: {
    rotulo: 'evidência baixa',
    classe: 'border-destructive/40 bg-destructive/5 text-destructive',
  },
};

interface Props {
  grafo: GrafoEvidencias;
  /** Hipótese em foco, para o drill-down mostrar a evidência dela. */
  hipoteseAberta?: string | null;
  onAbrir?: (id: string | null) => void;
  /**
   * Compacto para o **sidebar da teleconsulta**, onde a coluna é estreita e o vídeo não pode
   * perder espaço. Pedido do dono em 24/08/2026: *"só temos que tomar cuidado em como faremos
   * isso na teleconsulta por conta do sidebar dela na lateral"*.
   */
  denso?: boolean;
  className?: string;
}

function CartaoHipotese({
  grafo,
  hipotese,
  aberta,
  onAbrir,
  denso = false,
}: {
  grafo: GrafoEvidencias;
  hipotese: Hipotese;
  aberta: boolean;
  onAbrir: () => void;
  denso?: boolean;
}) {
  const faixa = faixaDeConfianca(hipotese);
  const { aFavor, contra, lacunas } = evidenciaDa(grafo, hipotese.id);

  return (
    <div
      className={cn(
        'rounded-lg border transition-colors',
        aberta ? 'border-primary/50 bg-primary/[0.03]' : 'border-border',
      )}
    >
      <button
        type="button"
        onClick={onAbrir}
        aria-expanded={aberta}
        className="flex w-full items-start gap-3 p-4 text-left"
      >
        <span className="bg-muted mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold">
          {hipotese.slot}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{hipotese.titulo}</span>
            {hipotese.cid && (
              <span className="text-muted-foreground font-mono text-xs">{hipotese.cid}</span>
            )}
          </span>

          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {/* A faixa, quando o motor a calibrou. Sem faixa, nada aparece — não se deriva
                categoria de percentual, senão a precisão que a ADR-0006 rejeita volta. */}
            {faixa && (
              <Badge variant="outline" className={cn('text-xs', FAIXA[faixa].classe)}>
                {FAIXA[faixa].rotulo}
              </Badge>
            )}
            {hipotese.dont_miss && (
              <Badge variant="outline" className="border-destructive/40 text-destructive text-xs">
                <ShieldAlert className="mr-1 size-3" />
                não se pode deixar passar
              </Badge>
            )}
            <span className="text-muted-foreground text-xs">
              {aFavor.length} a favor
              {contra.length > 0 && ` · ${contra.length} contra`}
              {lacunas.length > 0 && ` · ${lacunas.length} sem explicação`}
            </span>
          </span>
        </span>
      </button>

      {aberta && (
        <div className="border-t px-4 py-4">
          {/* O MESMO bloco que a tela de decisão mostra — ver EvidenciaDaHipotese. */}
          <EvidenciaDaHipotese grafo={grafo} hipotese={hipotese} denso={denso} />
        </div>
      )}
    </div>
  );
}

export function PainelHipoteses({
  grafo,
  hipoteseAberta,
  onAbrir,
  denso = false,
  className,
}: Props) {
  const parcial = grafoEstaParcial(grafo);
  const ranqueadas = [...grafo.hipoteses].sort((a, b) => a.slot - b.slot);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="font-heading flex items-center gap-2 text-base">
              <Bot className="text-primary size-4" />
              Hipóteses sugeridas pela IA
            </CardTitle>
            <p className="text-muted-foreground mt-1 text-sm">
              Apoio à decisão. Nada aqui vai ao prontuário sem a sua confirmação.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/*
              O GATILHO DE URGÊNCIA NO CABEÇALHO (`DO-42`, `DO-51` · ADR-0013).

              > "precisamos disso na tela"

              Fica no topo, junto da síndrome, porque o nível de urgência **calibra a leitura de
              todas as hipóteses** — o mesmo raciocínio pelo qual a incompletude aparece antes
              delas. Ler três hipóteses sem saber que o quadro é emergência é ler outra coisa.

              O nível sai de `lib/ia-clinica/urgencia.ts`, nunca de um `switch` aqui: um segundo
              mapa faria esta tela divergir do sidebar da teleconsulta, e as duas continuariam
              plausíveis.
            */}
            <SeloDeUrgencia
              urgencia={grafo.urgencia}
              redFlagsNaoExplicadas={grafo.completude?.red_flags_nao_explicadas}
              denso={denso}
            />
            {grafo.sindrome?.titulo && (
              <Badge variant="secondary" className="shrink-0">
                {grafo.sindrome.titulo}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/*
          O aviso explicado vem ANTES das hipóteses, pela mesma razão da incompletude: em nível
          de atenção ou acima, o médico precisa saber ANTES de ler a primeira hipótese. Em
          `rotina` o componente não renderiza nada — aviso que aparece sempre deixa de avisar.
        */}
        <AvisoDeUrgencia
          urgencia={grafo.urgencia}
          redFlagsNaoExplicadas={grafo.completude?.red_flags_nao_explicadas}
        />

        {/* A incompletude vem ANTES das hipóteses — é o que calibra a leitura de todas elas. */}
        {parcial && (
          <div className="border-destructive/30 bg-destructive/[0.04] rounded-lg border p-3.5">
            <p className="text-destructive flex items-center gap-2 text-sm font-semibold">
              <AlertOctagon className="size-4" />
              Análise incompleta
            </p>
            {grafo.completude?.motivos?.length ? (
              <ul className="text-muted-foreground mt-1.5 space-y-1 pl-6 text-sm">
                {grafo.completude.motivos.map((m, i) => (
                  <li key={i} className="list-disc">
                    {m}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground mt-1 pl-6 text-sm">
                O motor não fechou a análise. Trate as hipóteses abaixo como parciais.
              </p>
            )}
          </div>
        )}

        {ranqueadas.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            O motor não ranqueou nenhuma hipótese com a informação disponível.
          </p>
        ) : (
          <div className="space-y-2">
            {ranqueadas.map((h) => (
              <CartaoHipotese
                key={h.id}
                grafo={grafo}
                hipotese={h}
                aberta={hipoteseAberta === h.id}
                onAbrir={() => onAbrir?.(hipoteseAberta === h.id ? null : h.id)}
                denso={denso}
              />
            ))}
          </div>
        )}

        {/* Regra determinística — não sai de modelo, e por isso tem peso diferente na tela. */}
        {grafo.salvaguardas_deterministicas?.length ? (
          <div className="border-secondary/40 bg-secondary/5 rounded-lg border p-3.5">
            <p className="text-secondary text-xs font-semibold tracking-wide uppercase">
              Rede de segurança — regra, não modelo
            </p>
            <ul className="mt-1.5 space-y-1 text-sm">
              {grafo.salvaguardas_deterministicas.map((s, i) => (
                <li key={i}>{s.replace(/^\[SISTEMA\]\s*/, '')}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {grafo.achados_inconclusivos?.length ? (
          <div className="bg-muted/40 space-y-2 rounded-lg p-3.5">
            <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Ficou sem resposta
            </p>
            {grafo.achados_inconclusivos.map((inc, i) => (
              <div key={i} className="space-y-1.5">
                <p className="text-sm">{inc.texto}</p>
                {inc.perguntas_medico?.length ? (
                  <ul className="text-muted-foreground space-y-1 pl-4 text-sm">
                    {inc.perguntas_medico.map((q, j) => (
                      <li key={j} className="list-disc">
                        {q}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {grafo.auditor && (
          <div className="rounded-lg border border-dashed p-3.5">
            <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              {grafo.auditor.titulo}
            </p>
            <p className="text-muted-foreground mt-1 text-sm">{grafo.auditor.resumo}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
