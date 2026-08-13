import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ProdutoForm } from '@/components/admin/produtos/produto-form';

export default function NovoProdutoPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/produtos"
          className="text-muted-foreground hover:text-foreground mb-3 inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft size={14} />
          Voltar
        </Link>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Novo Produto</h1>
        <p className="text-muted-foreground mt-1">
          Cadastre um produto para exibição no catálogo institucional.
        </p>
      </div>
      <ProdutoForm />
    </div>
  );
}
