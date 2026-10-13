'use client';

import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  CONSULTA_SOCIAL_VALOR,
  CONSULTAS_INICIAL,
  FRASCOS_INICIAL,
  FRASCOS_MAX,
  FRASCOS_MIN,
  FRETE_VALOR,
  PRECO_INICIAL,
  PRECO_MAX,
  PRECO_MIN,
  PRECO_PASSO,
  PRODUTOS,
  calcularCustos,
  type ProdutoId,
} from '@/lib/simulador/custos';

const dinheiro = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const CAMPO_SELECT =
  'h-11 w-full rounded-lg border border-input bg-card px-3 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

export function SimuladorDeCustos() {
  const [produtoId, setProdutoId] = useState<ProdutoId | ''>('');
  const [preco, setPreco] = useState(PRECO_INICIAL);
  const [frascos, setFrascos] = useState(FRASCOS_INICIAL);
  const [consultas, setConsultas] = useState(CONSULTAS_INICIAL);

  const produto = PRODUTOS.find((p) => p.id === produtoId);
  const custos = calcularCustos({ precoPorFrasco: preco, frascos, consultas });

  const reiniciar = () => {
    setProdutoId('');
    setPreco(PRECO_INICIAL);
    setFrascos(FRASCOS_INICIAL);
    setConsultas(CONSULTAS_INICIAL);
  };

  return (
    <Card className="mx-auto max-w-3xl">
      <CardContent className="space-y-8 p-6 sm:p-10">
        <header>
          <p className="text-primary text-xs font-bold tracking-[0.2em] uppercase">
            Programa Be4Hope · Acesso Social
          </p>
          <h1 className="font-heading mt-3 text-3xl font-semibold sm:text-4xl">
            Simule os custos do seu tratamento
          </h1>
          <p className="text-muted-foreground mt-3">
            Planeje os custos estimados dos produtos prescritos, do frete e, se desejar, das
            consultas sociais de acompanhamento.
          </p>
        </header>

        <div>
          <label htmlFor="produto" className="mb-3 block font-semibold">
            Produto
          </label>
          <select
            id="produto"
            className={CAMPO_SELECT}
            value={produtoId}
            onChange={(e) => setProdutoId(e.target.value as ProdutoId | '')}
          >
            <option value="">Selecione o produto</option>
            {PRODUTOS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome} ({p.concentracao})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="preco" className="mb-3 block font-semibold">
            Custo estimado por frasco
          </label>
          <div className="flex items-center gap-4">
            <input
              id="preco"
              type="range"
              min={PRECO_MIN}
              max={PRECO_MAX}
              step={PRECO_PASSO}
              value={preco}
              onChange={(e) => setPreco(Number(e.target.value))}
              className="accent-primary flex-1"
            />
            <output className="min-w-24 text-right font-semibold">{dinheiro(preco)}</output>
          </div>
          <p className="text-muted-foreground mt-2 text-xs">
            Limite de {dinheiro(PRECO_MAX)} por frasco.
          </p>
        </div>

        <div>
          <label htmlFor="frascos" className="mb-3 block font-semibold">
            Quantidade estimada de frascos por ano
          </label>
          <div className="flex items-center gap-4">
            <input
              id="frascos"
              type="range"
              min={FRASCOS_MIN}
              max={FRASCOS_MAX}
              step={1}
              value={frascos}
              onChange={(e) => setFrascos(Number(e.target.value))}
              className="accent-primary flex-1"
            />
            <output className="min-w-24 text-right font-semibold">{frascos}</output>
          </div>
        </div>

        <div>
          <label htmlFor="consultas" className="mb-3 block font-semibold">
            Consultas sociais opcionais por ano ({dinheiro(CONSULTA_SOCIAL_VALOR)} cada)
          </label>
          <select
            id="consultas"
            className={CAMPO_SELECT}
            value={consultas}
            onChange={(e) => setConsultas(Number(e.target.value))}
          >
            <option value={0}>Nenhuma</option>
            <option value={1}>1 consulta</option>
            <option value={2}>2 consultas</option>
          </select>
        </div>

        <section aria-live="polite" className="grid gap-3.5 sm:grid-cols-2">
          <div className="bg-muted rounded-xl p-5">
            <span className="text-muted-foreground text-sm">Custo total estimado no ano</span>
            <strong className="mt-2 block text-2xl sm:text-3xl">{dinheiro(custos.total)}</strong>
          </div>
          <div className="bg-muted rounded-xl p-5">
            <span className="text-muted-foreground text-sm">Equivalente mensal estimado</span>
            <strong className="mt-2 block text-2xl sm:text-3xl">{dinheiro(custos.mensal)}</strong>
          </div>
        </section>

        <dl className="border-border space-y-1.5 border-t pt-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt>Produto</dt>
            <dd className="text-right font-semibold">{produto?.nome ?? '—'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Frascos</dt>
            <dd className="font-semibold">{dinheiro(custos.produtos)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>
              Frete ({custos.fretes} × {dinheiro(FRETE_VALOR)})
            </dt>
            <dd className="font-semibold">{dinheiro(custos.frete)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Consultas opcionais</dt>
            <dd className="font-semibold">{dinheiro(custos.consultas)}</dd>
          </div>
        </dl>

        <Button
          type="button"
          variant="outline"
          onClick={reiniciar}
          className="btn-pill border-primary/40 text-primary hover:border-primary hover:bg-primary/5 hover:text-primary h-11 gap-2 px-6 text-sm font-semibold"
        >
          <RotateCcw size={16} aria-hidden="true" />
          Reiniciar simulação
        </Button>

        <p className="text-muted-foreground text-xs leading-relaxed">
          Simulação meramente informativa, sem compromisso de compra, assinatura, parcelamento ou
          garantia de fornecimento. Valores não incluem eventuais despesas adicionais, frete ou
          taxas. Quantidades e importações dependem de prescrição, avaliação clínica, documentação e
          exigências sanitárias aplicáveis. O paciente pode escolher livremente seu médico.
        </p>
      </CardContent>
    </Card>
  );
}
