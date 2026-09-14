import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { listarMedicosComConfigPagamento } from '@/app/(admin)/_actions/pagamentos-medicos';
import { ChevronLeft, ChevronRight, Landmark, Stethoscope } from 'lucide-react';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/shared/page-header';
import { DataList, DataRow, DataEmpty } from '@/components/shared/data-list';

export const metadata: Metadata = {
  title: 'Meios de pagamento por médico — Admin Be4Hope',
};

/**
 * Lista de médicos com o status da configuração de meios de pagamento (PIX, boleto,
 * cartão). Estrutura + cadastro apenas — sem integração real de gateway.
 */
export default async function PagamentosMedicosPage() {
  const resultado = await listarMedicosComConfigPagamento();
  const medicos = resultado.dados ?? [];
  const totalConfigurados = medicos.filter((m) => m.configurado).length;

  return (
    <div className="space-y-6">
      <Link href="/admin/pagamentos">
        <Button variant="ghost" size="sm" className="gap-1.5">
          <ChevronLeft size={16} />
          Pagamentos
        </Button>
      </Link>

      <PageHeader
        title="Meios de pagamento por médico"
        description={`${totalConfigurados} de ${medicos.length} médico${medicos.length !== 1 ? 's' : ''} com algum método configurado`}
      />

      {medicos.length === 0 ? (
        <DataEmpty
          icon={<Landmark size={24} />}
          title="Nenhum médico cadastrado"
          description="Cadastre médicos em Médicos para poder configurar os meios de pagamento."
        />
      ) : (
        <DataList>
          {medicos.map((m) => (
            <DataRow
              key={m.medicoId}
              href={`/admin/pagamentos/medicos/${m.medicoId}`}
              icon={
                m.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.avatarUrl}
                    alt={m.nome}
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  <Stethoscope size={20} className="text-violet-600" />
                )
              }
              title={m.nome}
              subtitle={m.especialidade}
              trailing={
                <>
                  <Badge variant={m.configurado ? 'default' : 'secondary'}>
                    {m.configurado ? 'Configurado' : 'Pendente'}
                  </Badge>
                  <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                </>
              }
            />
          ))}
        </DataList>
      )}
    </div>
  );
}
