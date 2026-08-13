import type { Metadata } from 'next';
import { ProdutoDetalhe, gerarMetadataProduto } from '@/components/produtos/produto-detalhe';

interface ProdutoPacientePageProps {
  params: Promise<{ sku: string }>;
}

export async function generateMetadata({ params }: ProdutoPacientePageProps): Promise<Metadata> {
  const { sku } = await params;
  return gerarMetadataProduto(sku);
}

/** Detalhe de produto dentro da área do paciente — ver page.tsx da listagem. */
export default async function ProdutoPacienteDetalhePage({ params }: ProdutoPacientePageProps) {
  const { sku } = await params;
  return <ProdutoDetalhe sku={sku} basePath="/paciente/produtos" />;
}
