import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { buscarProdutoAdmin } from '@/app/(admin)/_actions/produtos';
import { ProdutoForm } from '@/components/admin/produtos/produto-form';

export default async function EditarProdutoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resultado = await buscarProdutoAdmin(id);

  if (!resultado.sucesso || !resultado.dados) {
    notFound();
  }

  const produto = resultado.dados;

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
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Editar Produto</h1>
        <p className="text-muted-foreground mt-1">{produto.nome}</p>
      </div>
      <ProdutoForm produto={produto} />
    </div>
  );
}
