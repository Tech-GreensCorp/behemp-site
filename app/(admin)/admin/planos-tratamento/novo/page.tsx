import { connection } from 'next/server';
import { PlanoTratamentoForm } from '@/components/admin/planos-tratamento/plano-tratamento-form';
import { PageHeader } from '@/components/shared/page-header';

/** Hoje em America/Sao_Paulo, no formato do `<input type="date">` (YYYY-MM-DD). */
function hojeEmSaoPaulo(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export default async function NovoPlanoTratamentoPage() {
  // Renderiza por requisição: sem isto, uma página estática congelaria a "data de hoje" no dia
  // do build. (O layout do admin já é dinâmico por ler a sessão — isto não depende dele.)
  await connection();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Financeiro"
        title="Novo Plano de Tratamento"
        description="Adesão ao Tratamento do Programa de Acesso Collab."
      />
      <PlanoTratamentoForm dataPadrao={hojeEmSaoPaulo()} />
    </div>
  );
}
