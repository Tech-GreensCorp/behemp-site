import { PageHeader } from '@/components/shared/page-header';
import { ChamadaDeAtendimento } from '@/components/atendimento/ChamadaDeAtendimento';

/**
 * Atendimento com suporte, lado do PACIENTE — ADR-0029 §10 (D-12).
 *
 * Página fina de propósito: quem pode entrar é decidido no servidor, em
 * `lib/auth/escopo-chamada.ts`, pela action que o componente chama. Pedido de outro paciente dá
 * "Atendimento não encontrado", igual a pedido que não existe.
 */
export default async function Page({ params }: { params: Promise<{ pedidoId: string }> }) {
  const { pedidoId } = await params;
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 pb-12">
      <PageHeader
        title="Atendimento com suporte"
        description="Converse com a nossa equipe e, se quiser, mostre a sua tela para ser guiado no passo a passo."
      />
      <ChamadaDeAtendimento pedidoId={pedidoId} voltarPara="/paciente/anvisa" />
    </div>
  );
}
