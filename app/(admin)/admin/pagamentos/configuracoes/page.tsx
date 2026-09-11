import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { buscarConfigPagamentos } from '@/app/(admin)/_actions/pagamentos';
import { PagamentosConfigForm } from '@/components/admin/pagamentos/pagamentos-config-form';
import { ChevronLeft } from 'lucide-react';

export default async function PagamentosConfiguracoesPage() {
  const resultado = await buscarConfigPagamentos();

  const config = resultado.dados ?? { valorConsultaPadrao: '150.00', moedaPadrao: 'BRL' };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/pagamentos">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ChevronLeft size={16} />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configuração de pagamentos</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Valor padrão da consulta — o pagamento vai direto para o médico
          </p>
        </div>
      </div>

      <PagamentosConfigForm configInicial={config} />
    </div>
  );
}
