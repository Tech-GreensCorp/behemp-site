'use client';

import { ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export function ComprarCta({ produto, disponivel }: { produto: string; disponivel: boolean }) {
  return (
    <Button
      size="lg"
      className="h-12 w-full rounded-full text-sm font-bold"
      onClick={() =>
        toast.info(
          disponivel
            ? `Em breve você poderá comprar "${produto}" direto pela plataforma.`
            : `"${produto}" está disponível sob consulta com a equipe Be4Hope.`,
        )
      }
    >
      <ShoppingCart className="h-4 w-4" />
      {disponivel ? 'Comprar' : 'Consultar disponibilidade'}
    </Button>
  );
}
