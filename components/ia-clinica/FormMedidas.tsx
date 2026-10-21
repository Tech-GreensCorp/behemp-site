'use client';

/**
 * As cinco medidas de desfecho + os dois vitais — `DO-24` e `DO-25`.
 *
 * POR QUE ESTE COMPONENTE EXISTE
 * ADR-0004 D-01: a anamnese é série temporal. Este é o formulário que se **repete** a cada
 * retorno, e é o único lugar onde as medidas entram — a primeira avaliação e o retorno usam o
 * mesmo componente, com o mesmo conjunto de campos.
 *
 * 🔴 POR QUE O MESMO FORMULÁRIO NOS DOIS MODOS
 * Se a primeira avaliação e o retorno tivessem formulários diferentes, as faixas divergiriam com
 * o tempo e a série deixaria de ser comparável — que é a única coisa que dá valor à série. O que
 * muda entre os modos é o **contexto ao redor**, não o campo.
 *
 * O valor anterior aparece ao lado de cada medida (D-01), com a variação já interpretada como
 * melhora ou piora — inclusive para qualidade de vida, cuja escala tem direção invertida.
 */

import { useState } from 'react';
import { Activity, Loader2, Save } from 'lucide-react';

import { registrarMedida, type SerieMedidas } from '@/app/_actions/anamnese-baseline';
import { ControleMedida, FAIXAS } from '@/components/ia-clinica/ControleMedida';
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

type Medida = SerieMedidas['medidas'][number];

interface Props {
  pacienteId: string;
  anamneseId?: string;
  /** A medição anterior, para mostrar de onde cada valor saiu. */
  anterior?: Medida | null;
  onSalvo?: () => void;
}

/** Hoje em `YYYY-MM-DD`, no fuso local — a data da medição é a do consultório, não UTC. */
function hojeLocal(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

export function FormMedidas({ pacienteId, anamneseId, anterior, onSalvo }: Props) {
  const [medidoEm, setMedidoEm] = useState(hojeLocal());
  const [dor, setDor] = useState<number | null>(null);
  const [sono, setSono] = useState<number | null>(null);
  const [ansiedade, setAnsiedade] = useState<number | null>(null);
  const [qualidadeVida, setQualidadeVida] = useState<number | null>(null);
  const [crises, setCrises] = useState<number | null>(null);
  const [crisesPeriodo, setCrisesPeriodo] = useState<string>('');

  const [mostrarVitais, setMostrarVitais] = useState(false);
  const [sistolica, setSistolica] = useState<number | null>(null);
  const [diastolica, setDiastolica] = useState<number | null>(null);
  const [peso, setPeso] = useState<number | null>(null);

  const [observacao, setObservacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  const nadaPreenchido = [
    dor,
    sono,
    ansiedade,
    qualidadeVida,
    crises,
    sistolica,
    diastolica,
    peso,
  ].every((v) => v === null);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    const r = await registrarMedida({
      pacienteId,
      anamneseId,
      medidoEm,
      nivelDor: dor ?? undefined,
      qualidadeSono: sono ?? undefined,
      nivelAnsiedade: ansiedade ?? undefined,
      qualidadeVidaGlobal: qualidadeVida ?? undefined,
      crisesContagem: crises ?? undefined,
      crisesPeriodo: crises !== null ? ((crisesPeriodo || 'semana') as 'semana') : undefined,
      pressaoSistolica: sistolica ?? undefined,
      pressaoDiastolica: diastolica ?? undefined,
      pesoKg: peso ?? undefined,
      observacao: observacao || undefined,
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
        <CardTitle className="font-heading text-base">Medidas de acompanhamento</CardTitle>
        <p className="text-muted-foreground text-sm">
          {anterior
            ? `Comparando com a medição de ${anterior.medidoEm}. Preencha só o que remediu.`
            : 'Marco zero da série. É contra estes valores que a evolução vai ser medida.'}
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="max-w-xs space-y-2">
          <Label htmlFor="medidoEm">Data da medição</Label>
          <Input
            id="medidoEm"
            type="date"
            value={medidoEm}
            onChange={(e) => setMedidoEm(e.target.value)}
          />
          <p className="text-muted-foreground text-xs">
            A que dia o valor se refere — não quando foi digitado.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <ControleMedida
            rotulo="Dor"
            ajuda="0 = sem dor · 10 = a pior imaginável"
            valor={dor}
            onChange={setDor}
            faixa={FAIXAS.dor}
            anterior={anterior?.nivelDor}
          />
          <ControleMedida
            rotulo="Qualidade do sono"
            ajuda="0 = péssimo · 10 = ótimo"
            valor={sono}
            onChange={setSono}
            faixa={FAIXAS.sono}
            anterior={anterior?.qualidadeSono}
            maiorEhMelhor
          />
          <ControleMedida
            rotulo="Ansiedade"
            ajuda="0 = ausente · 10 = incapacitante"
            valor={ansiedade}
            onChange={setAnsiedade}
            faixa={FAIXAS.ansiedade}
            anterior={anterior?.nivelAnsiedade}
          />
          {/* A direção invertida é dita no rótulo de propósito: sem isso, +2 aqui parece piora. */}
          <ControleMedida
            rotulo="Qualidade de vida"
            ajuda="0 = muito ruim · 10 = muito boa — aqui, MAIOR é melhor"
            valor={qualidadeVida}
            onChange={setQualidadeVida}
            faixa={FAIXAS.qualidadeVida}
            anterior={anterior?.qualidadeVidaGlobal}
            maiorEhMelhor
          />
        </div>

        {/* Crises: contagem + período juntos, para não fixar a janela no schema. */}
        <div className="grid gap-4 sm:grid-cols-2">
          <ControleMedida
            rotulo="Crises / espasmos"
            ajuda="Quantidade no período"
            valor={crises}
            onChange={setCrises}
            faixa={FAIXAS.crises}
            anterior={anterior?.crisesContagem}
          />
          <div className="space-y-2">
            <Label htmlFor="crisesPeriodo">Período</Label>
            <Select value={crisesPeriodo} onValueChange={(v) => setCrisesPeriodo(v ?? '')}>
              <SelectTrigger id="crisesPeriodo" disabled={crises === null}>
                <SelectValue placeholder={crises === null ? '—' : 'Selecione'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dia">Por dia</SelectItem>
                <SelectItem value="semana">Por semana</SelectItem>
                <SelectItem value="mes">Por mês</SelectItem>
              </SelectContent>
            </Select>
            {anterior?.crisesPeriodo && (
              <p className="text-muted-foreground text-xs">
                antes: {anterior.crisesContagem} por {anterior.crisesPeriodo}
              </p>
            )}
          </div>
        </div>

        {/* Vitais: bloco OPCIONAL, fechado por padrão — ADR-0004 D-04. */}
        <div className="space-y-4 rounded-lg border p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label htmlFor="vitais" className="flex items-center gap-2 text-sm font-medium">
                <Activity className="text-muted-foreground size-4" />
                Sinais vitais
              </Label>
              <p className="text-muted-foreground mt-1 text-xs">
                Opcional. Pressão porque o canabidiol interage com anti-hipertensivos; peso porque a
                dose de referência é por kg.
              </p>
            </div>
            <Switch id="vitais" checked={mostrarVitais} onCheckedChange={setMostrarVitais} />
          </div>

          {mostrarVitais && (
            <div className="grid gap-6 border-t pt-4 sm:grid-cols-3">
              <ControleMedida
                rotulo="Sistólica"
                valor={sistolica}
                onChange={setSistolica}
                faixa={FAIXAS.pressaoSistolica}
                anterior={anterior?.pressaoSistolica}
              />
              <ControleMedida
                rotulo="Diastólica"
                valor={diastolica}
                onChange={setDiastolica}
                faixa={FAIXAS.pressaoDiastolica}
                anterior={anterior?.pressaoDiastolica}
              />
              <ControleMedida
                rotulo="Peso"
                valor={peso}
                onChange={setPeso}
                faixa={FAIXAS.peso}
                anterior={anterior?.pesoKg ? Number(anterior.pesoKg) : null}
              />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="obsMedida">Observação da medição</Label>
          <Textarea
            id="obsMedida"
            rows={2}
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="O que o número não conta"
          />
        </div>

        {erro && (
          <Alert variant="destructive">
            <AlertDescription>{erro}</AlertDescription>
          </Alert>
        )}
        {salvo && (
          <Alert className="border-secondary/40 bg-secondary/5">
            <AlertDescription>
              Medição registrada. A anterior foi preservada — nada é sobrescrito.
            </AlertDescription>
          </Alert>
        )}

        <Button onClick={salvar} disabled={salvando || nadaPreenchido} className="w-full sm:w-auto">
          {salvando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Registrar medição
        </Button>
        {nadaPreenchido && (
          <p className="text-muted-foreground text-xs">
            Preencha ao menos uma medida para registrar.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
