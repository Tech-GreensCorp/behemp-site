'use client';

/**
 * Rastreio do uso de cannabis — `DO-26` e `DO-27`.
 *
 * POR QUE ESTE COMPONENTE EXISTE
 * O schema tinha `usoPrevioCannabis: boolean`. O paciente de canabidiol chega frequentemente já
 * usando algo — importado, artesanal, por conta própria — e um "sim" sem produto, dose, tempo nem
 * resposta não dá ao médico de onde partir para titular. Decisão do dono em 20/08/2026.
 *
 * 🔴 O PRIMEIRO USO NÃO É O "NÃO" DE UMA PERGUNTA (`DO-27`)
 * *"nem todo paciente que chegar já usa medicação, temos que nos preparar para esses que são o
 * primeiro uso, ainda mais se o paciente está vindo para fazer a consulta médica para conseguir o
 * remédio"* — o dono.
 *
 * Por isso a tela **ramifica em três** em vez de esconder campos atrás de um checkbox: quem nunca
 * usou responde expectativa e receio, que é o que ancora a conversa de titulação. Tratar isso
 * como ausência de dado descarta informação do caso mais comum deste produto.
 *
 * Quem preenche é o **médico**, na consulta (`DO-14`).
 */

import { useState } from 'react';
import { Loader2, Save, Sparkles } from 'lucide-react';

import { registrarRastreioUso } from '@/app/_actions/anamnese-baseline';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

import {
  ADESOES,
  ORIGENS,
  RESPOSTAS,
  SITUACOES,
  VIAS,
  type SituacaoUso,
} from '@/components/ia-clinica/opcoes-rastreio';

interface Props {
  pacienteId: string;
  anamneseId?: string;
  /** `true` quando é retorno — aí a adesão passa a ser a pergunta central. */
  ehRetorno?: boolean;
  onSalvo?: () => void;
}

export function RastreioUso({ pacienteId, anamneseId, ehRetorno = false, onSalvo }: Props) {
  const [situacao, setSituacao] = useState<SituacaoUso | null>(null);
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [recreativo, setRecreativo] = useState<boolean | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  // `string | null` porque o Select deste projeto (base-ui) limpa a seleção com `null`.
  const set = (chave: string) => (valor: string | null) =>
    setCampos((c) => ({ ...c, [chave]: valor ?? '' }));

  async function salvar() {
    if (!situacao) return;
    setSalvando(true);
    setErro(null);
    // Em `primeiro_uso` os campos de produto não são enviados — a action recusaria, e recusa
    // por contradição de dado é pior que não mandar.
    const usa = situacao !== 'primeiro_uso';
    const r = await registrarRastreioUso({
      pacienteId,
      anamneseId,
      situacao,
      ...(usa
        ? {
            produtoDescrito: campos.produto || undefined,
            proporcaoCbdThc: campos.proporcao || undefined,
            doseRelatada: campos.dose || undefined,
            viaAdministracao: (campos.via as 'oral') || undefined,
            origem: (campos.origem as 'importado') || undefined,
            usoDesde: campos.desde || undefined,
            respostaPercebida: (campos.resposta as 'melhorou_muito') || undefined,
            efeitoAdversoRelatado: campos.adverso || undefined,
            adesao: (campos.adesao as 'tomou_como_prescrito') || undefined,
            motivoNaoAdesao: campos.motivoAdesao || undefined,
          }
        : {
            expectativa: campos.expectativa || undefined,
            receio: campos.receio || undefined,
          }),
      usoRecreativoConcomitante: recreativo ?? undefined,
      observacao: campos.observacao || undefined,
    });
    setSalvando(false);
    if (r.sucesso) {
      setSalvo(true);
      onSalvo?.();
    } else {
      setErro(r.erro);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-base">Uso de cannabis medicinal</CardTitle>
        <p className="text-muted-foreground text-sm">
          Ponto de partida da titulação. Se o paciente já usa algo, é daqui que a dose sai.
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* A ramificação. Três cartões em vez de um checkbox — DO-27. */}
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">Situação atual</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {SITUACOES.map((s) => (
              <button
                key={s.valor}
                type="button"
                onClick={() => setSituacao(s.valor)}
                aria-pressed={situacao === s.valor}
                className={cn(
                  'rounded-lg border p-3 text-left transition-colors',
                  situacao === s.valor
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40',
                )}
              >
                <span className="block text-sm font-medium">{s.rotulo}</span>
                <span className="text-muted-foreground mt-1 block text-xs">{s.descricao}</span>
              </button>
            ))}
          </div>
        </fieldset>

        {/* ── Nunca usou: expectativa e receio ─────────────────────────────────── */}
        {situacao === 'primeiro_uso' && (
          <div className="border-primary/30 space-y-4 border-l-2 pl-4">
            <Alert>
              <Sparkles className="size-4" />
              <AlertDescription>
                Primeiro uso. Em vez de dose e produto, o que ancora a titulação é o que o paciente
                espera e o que o preocupa.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="expectativa">O que espera do tratamento</Label>
              <Textarea
                id="expectativa"
                rows={3}
                value={campos.expectativa ?? ''}
                onChange={(e) => set('expectativa')(e.target.value)}
                placeholder="Nas palavras do paciente"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="receio">O que o preocupa em começar</Label>
              <Textarea
                id="receio"
                rows={3}
                value={campos.receio ?? ''}
                onChange={(e) => set('receio')(e.target.value)}
                placeholder="Efeito, estigma, custo, interação com outro remédio…"
              />
              <p className="text-muted-foreground text-xs">
                Registrar o receio é o que permite endereçá-lo — e é o que faz o paciente aderir
                depois.
              </p>
            </div>
          </div>
        )}

        {/* ── Já usa ou já usou: o rastreio de DO-26 ───────────────────────────── */}
        {situacao && situacao !== 'primeiro_uso' && (
          <div className="border-primary/30 space-y-4 border-l-2 pl-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="produto">Produto</Label>
                <Input
                  id="produto"
                  value={campos.produto ?? ''}
                  onChange={(e) => set('produto')(e.target.value)}
                  placeholder="Como o paciente descreve — pode não ter rótulo"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="proporcao">Proporção CBD:THC</Label>
                <Input
                  id="proporcao"
                  value={campos.proporcao ?? ''}
                  onChange={(e) => set('proporcao')(e.target.value)}
                  placeholder="ex. 20:1 — se souber"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dose">Dose que toma</Label>
                <Input
                  id="dose"
                  value={campos.dose ?? ''}
                  onChange={(e) => set('dose')(e.target.value)}
                  placeholder="na unidade que ele usa"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="via">Via</Label>
                <Select value={campos.via ?? ''} onValueChange={set('via')}>
                  <SelectTrigger id="via">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {VIAS.map(([v, r]) => (
                      <SelectItem key={v} value={v}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="origem">Origem</Label>
                <Select value={campos.origem ?? ''} onValueChange={set('origem')}>
                  <SelectTrigger id="origem">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {ORIGENS.map(([v, r]) => (
                      <SelectItem key={v} value={v}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="desde">Usa desde</Label>
                <Input
                  id="desde"
                  type="date"
                  value={campos.desde ?? ''}
                  onChange={(e) => set('desde')(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="resposta">Resposta percebida</Label>
                <Select value={campos.resposta ?? ''} onValueChange={set('resposta')}>
                  <SelectTrigger id="resposta">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {RESPOSTAS.map(([v, r]) => (
                      <SelectItem key={v} value={v}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="adverso">Efeito adverso relatado</Label>
              <Textarea
                id="adverso"
                rows={2}
                value={campos.adverso ?? ''}
                onChange={(e) => set('adverso')(e.target.value)}
                placeholder="O que o paciente atribui ao medicamento"
              />
            </div>

            {/* ── Adesão: o que ele DE FATO tomou ─────────────────────────────── */}
            <div
              className={cn(
                'space-y-4 rounded-lg p-4',
                ehRetorno ? 'bg-primary/5 ring-primary/20 ring-1' : 'bg-muted/40',
              )}
            >
              <div>
                <Label htmlFor="adesao" className="text-sm font-medium">
                  Adesão {ehRetorno && <span className="text-primary">— central no retorno</span>}
                </Label>
                <p className="text-muted-foreground mt-1 text-xs">
                  O prontuário guarda o que foi <strong>prescrito</strong>. Isto registra o que foi{' '}
                  <strong>tomado</strong> — sem essa diferença, o ajuste de dose é calculado sobre
                  um número que talvez não tenha acontecido.
                </p>
              </div>
              <Select value={campos.adesao ?? ''} onValueChange={set('adesao')}>
                <SelectTrigger id="adesao">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {ADESOES.map(([v, r]) => (
                    <SelectItem key={v} value={v}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {campos.adesao && campos.adesao !== 'tomou_como_prescrito' && (
                <div className="space-y-2">
                  <Label htmlFor="motivoAdesao">Por quê?</Label>
                  <Textarea
                    id="motivoAdesao"
                    rows={2}
                    value={campos.motivoAdesao ?? ''}
                    onChange={(e) => set('motivoAdesao')(e.target.value)}
                    placeholder="Custo, efeito, esquecimento, melhora… cada motivo pede conduta diferente"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Uso recreativo: sensível, opcional, sem pressão. Muda a interpretação do efeito. */}
        {situacao && (
          <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
            <div>
              <Label htmlFor="recreativo" className="text-sm font-medium">
                Uso recreativo concomitante
              </Label>
              <p className="text-muted-foreground mt-1 text-xs">
                Opcional. Registrado porque muda a leitura do efeito e da dose — não para julgar.
              </p>
            </div>
            <Switch
              id="recreativo"
              checked={recreativo === true}
              onCheckedChange={(v) => setRecreativo(v)}
            />
          </div>
        )}

        {situacao && (
          <div className="space-y-2">
            <Label htmlFor="observacao">Observação</Label>
            <Textarea
              id="observacao"
              rows={2}
              value={campos.observacao ?? ''}
              onChange={(e) => set('observacao')(e.target.value)}
            />
          </div>
        )}

        {erro && (
          <Alert variant="destructive">
            <AlertDescription>{erro}</AlertDescription>
          </Alert>
        )}

        {salvo && (
          <Alert className="border-secondary/40 bg-secondary/5">
            <AlertDescription>Rastreio registrado.</AlertDescription>
          </Alert>
        )}

        <Button onClick={salvar} disabled={!situacao || salvando} className="w-full sm:w-auto">
          {salvando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Salvar rastreio
        </Button>
      </CardContent>
    </Card>
  );
}
