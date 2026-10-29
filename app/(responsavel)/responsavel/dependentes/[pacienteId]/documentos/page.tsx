import type { Metadata } from 'next';
import { FileText } from 'lucide-react';

import { VisualizadorDeDocumento } from '@/components/shared/documentos/visualizador-de-documento';
import { Card, CardContent } from '@/components/ui/card';
import { listarDocumentosDoDependente } from '@/lib/dependentes/leituras';
import { LABEL_DOCUMENTO, formatarDataISO, primeiroNome } from '@/lib/dependentes/rotulos';

import { carregarDependente } from '../../../../_lib/carregar-dependente';

export const metadata: Metadata = { title: 'Documentos | Be4Hope' };
export const dynamic = 'force-dynamic';

/**
 * Os documentos de UM dependente. O arquivo abre pelo `VisualizadorDeDocumento`, que chama a rota autenticada
 * `/api/documentos/{id}/arquivo`; ela confere o vínculo (`lib/auth/escopo-documento.ts`) e audita a leitura.
 * Nunca a URL do blob.
 */
export default async function DocumentosDoDependentePage({
  params,
}: {
  params: Promise<{ pacienteId: string }>;
}) {
  const { pacienteId } = await params;
  const { escopo, ficha } = await carregarDependente(pacienteId);
  const docs = await listarDocumentosDoDependente(escopo.pacienteId);

  return (
    <div className="space-y-4">
      <h2 className="font-display text-foreground text-xl font-bold">
        Documentos de {primeiroNome(ficha.nome)}
      </h2>
      {docs.length === 0 ? (
        <Card className="border-border/50 rounded-[1.75rem] border-dashed">
          <CardContent className="text-muted-foreground p-6 text-sm">
            Nenhum documento de {primeiroNome(ficha.nome)} até agora.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {docs.map((d) => {
            const rotulo = d.tipoPersonalizado || LABEL_DOCUMENTO[d.tipo] || d.tipo;
            return (
              <li key={d.id}>
                <Card className="border-border/50 rounded-[1.5rem] shadow-sm">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="bg-primary/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                      <FileText className="text-primary h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground truncate text-sm font-bold">{rotulo}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        {d.nomeArquivo ? `${d.nomeArquivo} · ` : ''}emitido em{' '}
                        {formatarDataISO(d.dataEmissao)}
                      </p>
                    </div>
                    <VisualizadorDeDocumento
                      documentoId={d.id}
                      rotulo={rotulo}
                      nomeArquivo={d.nomeArquivo}
                    />
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
