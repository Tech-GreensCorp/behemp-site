import type { Metadata } from 'next';
import { SimuladorDeCustos } from './_components/simulador-de-custos';

export const metadata: Metadata = {
  title: 'Simulador de custos — Be4Hope',
  description:
    'Simule os custos estimados do seu tratamento: produto, frascos por ano, frete e consultas médicas opcionais.',
};

export default function SimuladorPage() {
  return (
    <div className="min-h-screen px-4 pt-24 pb-16 sm:px-6">
      <SimuladorDeCustos />
    </div>
  );
}
