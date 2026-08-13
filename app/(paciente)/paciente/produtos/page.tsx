import type { Metadata } from 'next';
import { CatalogoProdutos } from '@/components/produtos/catalogo-produtos';

export const metadata: Metadata = {
  title: 'Produtos — Be4Hope',
};

/**
 * Catálogo de produtos dentro da área do paciente.
 * Auth + role já são garantidos por app/(paciente)/layout.tsx.
 */
export default async function ProdutosPacientePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  return <CatalogoProdutos searchParams={await searchParams} basePath="/paciente/produtos" />;
}
