/**
 * O checklist da autorização ANVISA, na forma que pode ir ao NAVEGADOR.
 *
 * `autorizacoes_anvisa.documentos` guarda `urlBlob` — a URL crua do arquivo. No store privado
 * ela responde 403; no público abre sem autenticação nem auditoria. Nenhum dos dois serve à
 * tela, então a tela só recebe SE há arquivo, e abre por
 * `/api/admin/anvisa/documento/{autorizacaoId}/{tipo}`.
 */

export interface ItemDoChecklist {
  tipo: string;
  enviado: boolean;
  validado: boolean;
  nomeArquivo: string | null;
  temArquivo: boolean;
}

export function checklistParaTela(documentos: unknown): ItemDoChecklist[] {
  if (!Array.isArray(documentos)) return [];

  return documentos.map((d) => {
    const item = (d ?? {}) as Record<string, unknown>;
    return {
      tipo: String(item.tipo ?? ''),
      enviado: item.enviado === true,
      validado: item.validado === true,
      nomeArquivo: typeof item.nomeArquivo === 'string' ? item.nomeArquivo : null,
      temArquivo: typeof item.urlBlob === 'string' && item.urlBlob.length > 0,
    };
  });
}
