import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { listarMedicosComConfigPagamento } from '@/app/(admin)/_actions/pagamentos-medicos';
import { ChevronLeft, ChevronRight, Landmark, Stethoscope } from 'lucide-react';
import type { Metadata } from 'next';

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
      <div className="flex items-center gap-3">
        <Link href="/admin/pagamentos">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ChevronLeft size={16} />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Meios de pagamento por médico</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalConfigurados} de {medicos.length} médico{medicos.length !== 1 ? 's' : ''} com
            algum método configurado
          </p>
        </div>
      </div>

      {medicos.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Landmark size={48} className="mb-4 text-muted-foreground/40" />
            <p className="text-lg font-medium">Nenhum médico cadastrado</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Cadastre médicos em Médicos para poder configurar os meios de pagamento.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {medicos.map((m) => (
            <Link
              key={m.medicoId}
              href={`/admin/pagamentos/medicos/${m.medicoId}`}
              className="group flex items-center gap-3 rounded-xl border border-border/50 bg-card p-4 transition-all hover:border-primary/50 hover:bg-accent/30"
            >
              {m.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.avatarUrl}
                  alt={m.nome}
                  className="h-12 w-12 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-violet-500/10">
                  <Stethoscope size={20} className="text-violet-600" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{m.nome}</p>
                <p className="truncate text-xs text-muted-foreground">{m.especialidade}</p>
              </div>
              <Badge variant={m.configurado ? 'default' : 'secondary'}>
                {m.configurado ? 'Configurado' : 'Pendente'}
              </Badge>
              <ChevronRight
                size={16}
                className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1"
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
