import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SimuladorDeCustos } from './_components/simulador-de-custos';

/**
 * Rota ocultada em produção (decisão do dono, 19/11/2026). O código do simulador foi
 * preservado: para reativar, troque a constante abaixo para `true` e devolva o link ao
 * navbar e ao footer.
 */
const SIMULADOR_ATIVO = false;

export const metadata: Metadata = {
  title: 'Simulador de custos — Be4Hope',
  description:
    'Simule os custos estimados do seu tratamento: produto, frascos por ano, frete e consultas médicas opcionais.',
};

export default function SimuladorPage() {
  if (!SIMULADOR_ATIVO) notFound();

  return (
    <div className="min-h-screen px-4 pt-24 pb-16 sm:px-6">
      <SimuladorDeCustos />
    </div>
  );
}
