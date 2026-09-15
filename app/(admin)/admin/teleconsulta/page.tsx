import Link from 'next/link';
import { Video, ExternalLink } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { DataList, DataRow, DataEmpty } from '@/components/shared/data-list';
import { Badge } from '@/components/ui/badge';
import { TeleconsultaFilters } from '@/components/admin/teleconsulta/teleconsulta-filters';
import { GerarLinkTeleconsultaDialog } from '@/components/admin/teleconsulta/gerar-link-teleconsulta-dialog';
import { listarTeleconsultasAdmin } from '@/app/(admin)/_actions/teleconsultas';
import { listarMedicosDisponiveis } from '@/app/_actions/admin-atribuicao';

/**
 * Categoria própria, separada de `/admin/pagamentos` (que fica só com o financeiro):
 * aqui é agenda/atendimento clínico — a lista de teleconsultas, filtrável por médico —
 * e o gerador do link de cadastro pelo fluxo da teleconsulta (ADR-0022 "porta 3", D-15),
 * que também não é assunto financeiro.
 */

const LABEL_STATUS: Record<string, { label: string; className: string }> = {
  reservada: { label: 'Aguardando pagamento', className: 'bg-muted text-muted-foreground' },
  agendada: { label: 'Agendada', className: 'bg-sky-500/10 text-sky-700' },
  confirmada: { label: 'Confirmada', className: 'bg-emerald-500/10 text-emerald-700' },
  realizada: { label: 'Realizada', className: 'bg-primary/10 text-primary' },
  cancelada: { label: 'Cancelada', className: 'bg-destructive/10 text-destructive' },
};

export default async function TeleconsultaPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;

  const status = params.status || undefined;
  const medicoId = params.medico || undefined;
  const busca = params.busca || '';
  const pagina = parseInt(params.pagina || '1', 10);
  const porPagina = 20;
  const offset = (pagina - 1) * porPagina;

  const [resultado, medicosResultado] = await Promise.all([
    listarTeleconsultasAdmin({
      status,
      medicoId,
      busca: busca || undefined,
      limite: porPagina,
      offset,
    }),
    listarMedicosDisponiveis(),
  ]);

  const itens = resultado.dados?.items ?? [];
  const total = resultado.dados?.total ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const medicos = medicosResultado.dados ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Atendimento"
        title="Teleconsulta"
        description={`${total} teleconsulta${total !== 1 ? 's' : ''} agendada${total !== 1 ? 's' : ''} ou realizada${total !== 1 ? 's' : ''}`}
        actions={<GerarLinkTeleconsultaDialog />}
      />

      <TeleconsultaFilters
        basePath="/admin/teleconsulta"
        statusAtual={status}
        buscaAtual={busca}
        medicoAtual={medicoId}
        medicos={medicos}
      />

      {itens.length === 0 ? (
        <DataEmpty
          icon={<Video size={24} />}
          title="Nenhuma teleconsulta encontrada"
          description={
            status || busca || medicoId
              ? 'Tente ajustar os filtros de busca.'
              : 'Teleconsultas aparecem aqui assim que um paciente agenda com um médico.'
          }
        />
      ) : (
        <DataList>
          {itens.map((c) => {
            const statusInfo = LABEL_STATUS[c.status] ?? {
              label: c.status,
              className: 'bg-muted text-muted-foreground',
            };
            return (
              <DataRow
                key={c.id}
                icon={
                  <div className="bg-primary/10 flex h-full w-full items-center justify-center rounded-full">
                    <Video size={18} className="text-primary" />
                  </div>
                }
                title={c.pacienteNome}
                subtitle={`com Dr(a). ${c.medicoNome}`}
                meta={new Date(c.dataHora).toLocaleString('pt-BR', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
                trailing={
                  <>
                    <Badge variant="outline" className={statusInfo.className}>
                      {statusInfo.label}
                    </Badge>
                    {c.googleMeetLink && (
                      <Link href={c.googleMeetLink} target="_blank" rel="noopener noreferrer">
                        <ExternalLink
                          size={14}
                          className="text-muted-foreground hover:text-primary"
                        />
                      </Link>
                    )}
                  </>
                }
              />
            );
          })}
        </DataList>
      )}

      {totalPaginas > 1 && (
        <div className="text-muted-foreground flex items-center justify-center gap-2 text-sm">
          {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/admin/teleconsulta?${new URLSearchParams({
                ...(status ? { status } : {}),
                ...(medicoId ? { medico: medicoId } : {}),
                ...(busca ? { busca } : {}),
                pagina: String(p),
              }).toString()}`}
              className={`flex h-8 w-8 items-center justify-center rounded-md text-xs font-medium ${
                p === pagina ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              }`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
