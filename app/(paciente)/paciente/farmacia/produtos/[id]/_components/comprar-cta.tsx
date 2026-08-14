'use client';

import { ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

// O Toaster global segue o tema do sistema (claro/escuro). Este alerta
// precisa permanecer sempre claro, então sobrescrevemos as cores por
// inline style em vez dos tokens --popover, que invertem no modo dark.
const TOAST_CLARO_STYLE = {
  background: '#FFFFFF',
  color: '#1A1612',
  border: '1px solid #DDD8D1',
} as const;

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
          { style: TOAST_CLARO_STYLE },
        )
      }
    >
      <ShoppingCart className="h-4 w-4" />
      {disponivel ? 'Comprar' : 'Consultar disponibilidade'}
    </Button>
  );
}
