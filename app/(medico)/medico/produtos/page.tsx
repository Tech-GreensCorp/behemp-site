import type { Metadata } from 'next';
import { CatalogoProdutos } from '@/components/produtos/catalogo-produtos';

export const metadata: Metadata = {
  title: 'Produtos — Be4Hope',
};

/**
 * Catálogo de produtos dentro da área do médico.
 * Auth + role já são garantidos por app/(medico)/layout.tsx.
 */
export default async function ProdutosMedicoPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  return <CatalogoProdutos searchParams={await searchParams} basePath="/medico/produtos" />;
}
