import { PageHeader } from '@/components/shared/page-header';
import { ChamadaDeAtendimento } from '@/components/atendimento/ChamadaDeAtendimento';

/**
 * Atendimento com suporte, lado do ADMIN — ADR-0029 §10 (D-12).
 *
 * Página fina de propósito: o papel é conferido no servidor (`lib/auth/escopo-chamada.ts`), e o
 * layout de `(admin)` já barra quem não é admin.
 */
export default async function Page({ params }: { params: Promise<{ pedidoId: string }> }) {
  const { pedidoId } = await params;
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        eyebrow="ANVISA"
        title="Atendimento com suporte"
        description="Voz com o paciente, a tela dele quando ele compartilhar, e as mensagens com os prints ao lado."
      />
      <ChamadaDeAtendimento pedidoId={pedidoId} voltarPara="/admin/anvisa" />
    </div>
  );
}
