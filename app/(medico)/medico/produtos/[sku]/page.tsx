import type { Metadata } from 'next';
import { ProdutoDetalhe, gerarMetadataProduto } from '@/components/produtos/produto-detalhe';

interface ProdutoMedicoPageProps {
  params: Promise<{ sku: string }>;
}

export async function generateMetadata({ params }: ProdutoMedicoPageProps): Promise<Metadata> {
  const { sku } = await params;
  return gerarMetadataProduto(sku);
}

/** Detalhe de produto dentro da área do médico — ver page.tsx da listagem. */
export default async function ProdutoMedicoDetalhePage({ params }: ProdutoMedicoPageProps) {
  const { sku } = await params;
  return <ProdutoDetalhe sku={sku} basePath="/medico/produtos" />;
}
