'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2 } from 'lucide-react';
import type { InvoiceProduct } from '@/app/(admin)/_actions/invoices';

interface ProductTableProps {
  products: InvoiceProduct[];
  onChange: (products: InvoiceProduct[]) => void;
}

/**
 * Tabela dinâmica de produtos da invoice.
 * Permite adicionar/remover linhas e calcula o total automaticamente.
 */
export function ProductTable({ products, onChange }: ProductTableProps) {
  function addProduct() {
    onChange([
      ...products,
      { description: '', ncmCode: '', quantity: '1', unitPrice: '0', totalPrice: '0' },
    ]);
  }

  function removeProduct(index: number) {
    if (products.length <= 1) return;
    const updated = products.filter((_, i) => i !== index);
    onChange(updated);
  }

  function updateProduct(index: number, field: keyof InvoiceProduct, value: string) {
    const updated = [...products];
    updated[index] = { ...updated[index], [field]: value };

    // Recalcular total
    if (field === 'quantity' || field === 'unitPrice') {
      const qty = parseFloat(updated[index].quantity) || 0;
      const price = parseFloat(updated[index].unitPrice) || 0;
      updated[index].totalPrice = (qty * price).toFixed(2);
    }

    onChange(updated);
  }

  return (
    <div className="space-y-3">
      {/* Header da tabela */}
      <div className="hidden grid-cols-[auto_1fr_120px_80px_120px_120px_40px] items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:grid">
        <span className="w-8 text-center">#</span>
        <span>Descrição</span>
        <span>NCM</span>
        <span className="text-center">Qtd</span>
        <span className="text-right">Unit. (USD)</span>
        <span className="text-right">Total (USD)</span>
        <span />
      </div>

      {products.map((product, index) => (
        <div
          key={index}
          className="grid grid-cols-1 gap-2 rounded-xl border bg-background p-3 lg:grid-cols-[auto_1fr_120px_80px_120px_120px_40px] lg:items-start lg:border-0 lg:bg-transparent lg:p-0"
        >
          {/* Número */}
          <div className="flex h-9 w-8 items-center justify-center text-sm font-semibold text-muted-foreground">
            {index + 1}
          </div>

          {/* Descrição */}
          <div>
            <label className="mb-1 block text-xs text-muted-foreground lg:hidden">
              Descrição *
            </label>
            <Textarea
              value={product.description}
              onChange={(e) => updateProduct(index, 'description', e.target.value)}
              placeholder="Descrição do produto..."
              className="min-h-[36px] resize-none text-sm"
              rows={1}
              required
            />
          </div>

          {/* NCM */}
          <div>
            <label className="mb-1 block text-xs text-muted-foreground lg:hidden">
              NCM *
            </label>
            <Input
              value={product.ncmCode}
              onChange={(e) => updateProduct(index, 'ncmCode', e.target.value)}
              placeholder="3004.90.99"
              className="text-sm"
              required
            />
          </div>

          {/* Quantidade */}
          <div>
            <label className="mb-1 block text-xs text-muted-foreground lg:hidden">
              Qtd *
            </label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={product.quantity}
              onChange={(e) => updateProduct(index, 'quantity', e.target.value)}
              className="text-center text-sm"
              required
            />
          </div>

          {/* Preço unitário */}
          <div>
            <label className="mb-1 block text-xs text-muted-foreground lg:hidden">
              Preço Unit. (USD) *
            </label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={product.unitPrice}
              onChange={(e) => updateProduct(index, 'unitPrice', e.target.value)}
              className="text-right text-sm"
              required
            />
          </div>

          {/* Total (readonly) */}
          <div>
            <label className="mb-1 block text-xs text-muted-foreground lg:hidden">
              Total (USD)
            </label>
            <Input
              value={product.totalPrice}
              readOnly
              tabIndex={-1}
              className="text-right text-sm font-medium text-muted-foreground"
            />
          </div>

          {/* Remover */}
          <div className="flex items-start pt-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeProduct(index)}
              className="h-9 w-9 text-muted-foreground hover:text-destructive"
              disabled={products.length <= 1}
            >
              <Trash2 size={16} />
            </Button>
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addProduct}
        className="mt-2 gap-1.5"
      >
        <Plus size={14} />
        Adicionar Produto
      </Button>
    </div>
  );
}
