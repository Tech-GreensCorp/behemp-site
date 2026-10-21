'use client';

/**
 * O formulário de conduta e de ajuste de dose.
 *
 * 🔴 O CAMPO DE TEOR DE THC É DO MÉDICO (`DO-46`). Ele chega pré-preenchido com o do catálogo
 * quando existe, e é editável. Enquanto o catálogo não tiver teores — levantá-los é trabalho do
 * chefe, fora desta sprint — o campo nasce vazio e a tela DIZ que não sabe qual receituário se
 * aplica, em vez de assumir o mais permissivo.
 *
 * 🔴 O AVISO NÃO TRAVA NADA (`DO-47`). Nenhum botão fica desabilitado por causa do teor, nenhuma
 * opção some. O sistema avisa; o médico segue o procedimento.
 *
 * 🔴 mg/dia É CALCULADO AO VIVO e não vai para o banco (ADR-0004 D-06).
 *
 * 🔴 NO AJUSTE, O MOTIVO É OBRIGATÓRIO (ADR-0005 D-02). Ajuste sem motivo é ponto de curva sem
 * explicação — e é o que torna a titulação ilegível seis meses depois.
 *
 * DENSIDADE (`DO-44` d): o formulário só existe quando chamado. Fechado, a tela é o plano
 * vigente e a curva — nada mais.
 */

import { useMemo, useState } from 'react';
import { Loader2, X } from 'lucide-react';

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
import { Textarea } from '@/components/ui/textarea';
import { calcularDoseDiaria, formatarMg } from '@/lib/conduta/dose';
import { avisoDeTrocaDeFaixa, normalizarTeor } from '@/lib/conduta/receituario';

import { AvisoReceituario, AvisoTrocaDeFaixa } from './AvisoReceituario';

export interface ProdutoParaForm {
  id: string;
  nome: string;
  marca: string | null;
  gotasPorMl: number;
  cbdMgPorGota: string | null;
  thcMgPorGota: string | null;
  teorThcPercentual: string | null;
}

export interface ValoresDaConduta {
  medicamentoId: string;
  gotasPorDia: number;
  mlFrasco: number;
  data: string;
  frequencia: string;
  viaAdministracao: 'sublingual' | 'oral' | 'topica';
  teorThcInformado: string;
  motivoAjuste: string;
  proximaRevisao: string;
  gerarPrescricaoNova: boolean;
}

interface Props {
  modo: 'conduta' | 'ajuste';
  produtos: ProdutoParaForm[];
  /** No ajuste: o teor do produto que sai, para o aviso de troca de faixa (`DO-47`). */
  teorAnterior?: string | null;
  salvando?: boolean;
  onCancelar: () => void;
  onSalvar: (valores: ValoresDaConduta) => void;
}

const HOJE = () => new Date().toISOString().slice(0, 10);

export function FormConduta({
  modo,
  produtos,
  teorAnterior = null,
  salvando = false,
  onCancelar,
  onSalvar,
}: Props) {
  const [medicamentoId, setMedicamentoId] = useState('');
  const [gotasPorDia, setGotasPorDia] = useState('');
  const [mlFrasco, setMlFrasco] = useState('30');
  const [data, setData] = useState(HOJE);
  const [frequencia, setFrequencia] = useState('');
  const [via, setVia] = useState<'sublingual' | 'oral' | 'topica'>('sublingual');
  const [teorThc, setTeorThc] = useState('');
  const [teorTocado, setTeorTocado] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [proximaRevisao, setProximaRevisao] = useState('');
  const [gerarPrescricao, setGerarPrescricao] = useState(false);

  const produto = produtos.find((p) => p.id === medicamentoId);

  // Pré-preenche do catálogo, e para de fazê-lo assim que o médico digita — o valor dele vence.
  const teorEfetivo = teorTocado ? teorThc : teorThc || produto?.teorThcPercentual || '';

  const dose = useMemo(
    () =>
      calcularDoseDiaria({
        gotasPorDia: Number(gotasPorDia) || 0,
        cbdMgPorGota: produto?.cbdMgPorGota,
        thcMgPorGota: produto?.thcMgPorGota,
      }),
    [gotasPorDia, produto],
  );

  const troca = useMemo(
    () => (modo === 'ajuste' ? avisoDeTrocaDeFaixa(teorAnterior, teorEfetivo) : null),
    [modo, teorAnterior, teorEfetivo],
  );

  const ehAjuste = modo === 'ajuste';
  const completo =
    medicamentoId !== '' &&
    Number(gotasPorDia) > 0 &&
    Number(mlFrasco) > 0 &&
    data !== '' &&
    frequencia.trim() !== '' &&
    (!ehAjuste || motivo.trim().length >= 3);

  function submeter() {
    onSalvar({
      medicamentoId,
      gotasPorDia: Number(gotasPorDia),
      mlFrasco: Number(mlFrasco),
      data,
      frequencia: frequencia.trim(),
      viaAdministracao: via,
      teorThcInformado: teorEfetivo.trim(),
      motivoAjuste: motivo.trim(),
      proximaRevisao,
      gerarPrescricaoNova: gerarPrescricao,
    });
  }

  return (
    <Card className="animate-fade-up border-0 shadow-sm">
      <CardHeader className="border-border/40 flex flex-row items-center justify-between border-b pb-4">
        <CardTitle className="font-heading text-base">
          {ehAjuste ? 'Ajustar a dose' : 'Registrar conduta'}
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={onCancelar} aria-label="Fechar formulário">
          <X size={16} />
        </Button>
      </CardHeader>

      <CardContent className="space-y-5 pt-6">
        {/* ── Produto ─────────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <Label htmlFor="produto">Produto do catálogo *</Label>
          <Select value={medicamentoId} onValueChange={(v) => setMedicamentoId(v ?? '')}>
            <SelectTrigger id="produto">
              <SelectValue placeholder="Escolha o produto" />
            </SelectTrigger>
            <SelectContent>
              {produtos.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nome}
                  {p.marca ? ` — ${p.marca}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-[0.7rem]">
            A conduta grava o produto do catálogo, não o nome digitado — é o que permite somar,
            comparar e cumprir o CAN-03.
          </p>
        </div>

        {/* ── Dose ────────────────────────────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="gotas">Gotas por dia *</Label>
            <Input
              id="gotas"
              type="number"
              min={1}
              max={200}
              inputMode="numeric"
              value={gotasPorDia}
              onChange={(e) => setGotasPorDia(e.target.value)}
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="frasco">Frasco (ml) *</Label>
            <Input
              id="frasco"
              type="number"
              min={1}
              value={mlFrasco}
              onChange={(e) => setMlFrasco(e.target.value)}
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="data">{ehAjuste ? 'Data do ajuste *' : 'Início *'}</Label>
            <Input id="data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
        </div>

        {/* mg/dia calculado — aparece na tela, não existe como coluna */}
        {(dose.cbdMgPorDia !== null || dose.thcMgPorDia !== null) && Number(gotasPorDia) > 0 && (
          <div className="animate-fade-in bg-muted/40 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl px-4 py-3 font-mono text-sm">
            {dose.cbdMgPorDia !== null && (
              <span>
                CBD <strong className="tabular-nums">{formatarMg(dose.cbdMgPorDia)}</strong>/dia
              </span>
            )}
            {dose.thcMgPorDia !== null && (
              <span className="text-muted-foreground">
                THC <strong className="tabular-nums">{formatarMg(dose.thcMgPorDia)}</strong>/dia
              </span>
            )}
            <span className="text-muted-foreground font-sans text-[0.7rem]">
              calculado do catálogo — não é registrado
            </span>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="frequencia">Frequência *</Label>
            <Input
              id="frequencia"
              value={frequencia}
              onChange={(e) => setFrequencia(e.target.value)}
              placeholder="Ex.: 2x ao dia"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="via">Via de administração *</Label>
            <Select value={via} onValueChange={(v) => setVia((v as typeof via) ?? 'sublingual')}>
              <SelectTrigger id="via">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sublingual">Sublingual</SelectItem>
                <SelectItem value="oral">Oral</SelectItem>
                <SelectItem value="topica">Tópica</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── O teor de THC: campo do médico (`DO-46`) ─────────────── */}
        <div className="border-border/60 space-y-2 rounded-xl border p-4">
          <div className="space-y-1.5">
            <Label htmlFor="teor">Teor de THC do produto (%)</Label>
            <Input
              id="teor"
              value={teorEfetivo}
              onChange={(e) => {
                setTeorTocado(true);
                setTeorThc(e.target.value);
              }}
              placeholder="Ex.: 0,2"
              inputMode="decimal"
              className="font-mono sm:max-w-[12rem]"
            />
            <p className="text-muted-foreground text-[0.7rem] leading-relaxed">
              Conforme a Autorização Sanitária da ANVISA do produto (CAN-03). O sistema não deduz
              este número — quem informa é você.
            </p>
          </div>

          <AvisoReceituario teorThcPercentual={teorEfetivo} />
          {troca?.mudouDeFaixa && <AvisoTrocaDeFaixa mensagem={troca.mensagem} />}
        </div>

        {/* ── Só no ajuste ────────────────────────────────────────── */}
        {ehAjuste && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="motivo">Motivo do ajuste *</Label>
              <Textarea
                id="motivo"
                rows={2}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="O que mudou no quadro que levou a este ajuste"
              />
              <p className="text-muted-foreground text-[0.7rem]">
                Obrigatório: é o que torna a curva de titulação legível meses depois.
              </p>
            </div>

            <div className="space-y-1.5 sm:max-w-[16rem]">
              <Label htmlFor="revisao">Próxima revisão</Label>
              <Input
                id="revisao"
                type="date"
                value={proximaRevisao}
                onChange={(e) => setProximaRevisao(e.target.value)}
              />
            </div>

            {/* `DO-47` + ADR-0005 D-03: a tela PERGUNTA, e a resposta fica na auditoria. */}
            <label className="bg-muted/40 flex cursor-pointer items-start gap-3 rounded-xl p-4">
              <input
                type="checkbox"
                checked={gerarPrescricao}
                onChange={(e) => setGerarPrescricao(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
              />
              <span className="space-y-0.5">
                <span className="block text-sm font-medium">
                  Vou emitir prescrição nova para esta dose
                </span>
                <span className="text-muted-foreground block text-[0.7rem] leading-relaxed">
                  Quem sabe se a dose nova extrapola a prescrição vigente é você. A sua resposta
                  fica registrada junto do ajuste.
                </span>
              </span>
            </label>
          </>
        )}

        <div className="border-border/40 flex justify-end gap-3 border-t pt-4">
          <Button variant="outline" onClick={onCancelar} disabled={salvando}>
            Cancelar
          </Button>
          {/* ⚠️ O botão NUNCA é desabilitado por causa do teor — só por campo obrigatório em
              branco. Travar pelo teor seria dirigir a conduta (`DO-47`, ADR-0012 R-05). */}
          <Button onClick={submeter} disabled={!completo || salvando} className="gap-2 rounded-xl">
            {salvando && <Loader2 size={15} className="animate-spin" />}
            {ehAjuste ? 'Registrar ajuste' : 'Registrar conduta'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** Reexport para quem só precisa do normalizador na tela. */
export { normalizarTeor };
