/**
 * QUAIS DOCUMENTOS DO PACIENTE VIAJAM NO S2, E POR QUE UM NÃO VIAJA.
 *
 * 🔴 ESPELHA O QUE A GREENS JÁ FAZ AO MANDAR PARA CÁ. O módulo deles
 * (`parceiros/behemp/documentos.ts`) decide arquivo a arquivo com três motivos —
 * `tipo_nao_suportado_la`, `grande_demais`, `mime_nao_aceito` — e cai para "só o nome" quando
 * o arquivo não pode ir. Os mesmos limites, na direção inversa: 8 MB e a mesma allowlist de
 * MIME.
 *
 * Simetria aqui não é estética. Um limite diferente de cada lado significa que um documento
 * atravessa numa direção e não na outra, e quem investiga só descobre isso lendo os dois
 * repositórios.
 *
 * ⚠️ PURO DE PROPÓSITO: nenhuma URL é assinada aqui, nenhum banco é consultado. A decisão de
 * "este viaja?" se testa sem blob e sem segredo — foi o que faltou em `podeTransferir` até eu
 * ter de extraí-la.
 */

/** O mesmo teto da Greens. */
export const LIMITE_DE_BYTES = 8 * 1024 * 1024;

/** A mesma allowlist da Greens. Documento de saúde não é `.docx` nem `.zip`. */
export const MIMES_QUE_VIAJAM = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
] as const;

/**
 * 🔴 `laudo_medico` NÃO VIAJA — decisão deles, e a nossa parte é respeitá-la.
 *
 * Eles não têm tipo equivalente, e forçá-lo em "documento pessoal" classificaria um documento
 * clínico como pessoal. Quem lesse a ficha depois acreditaria na classificação errada.
 */
export const NAO_VIAJAM = new Set<string>(['laudo_medico']);

export type MotivoSemArquivo = 'tipo_nao_suportado_la' | 'grande_demais' | 'mime_nao_aceito';

export interface DocumentoCandidato {
  id: string;
  tipo: string;
  nomeArquivo: string | null;
  /** `null` quando não sabemos — e não saber não impede: o destino valida de novo. */
  tamanhoEmBytes?: number | null;
  mime?: string | null;
  dataEmissao?: string | null;
}

export interface EntradaDoEnvio {
  documentoId: string;
  tipo: string;
  nomeArquivo: string | null;
  dataEmissao: string | null;
  /** `null` = viaja. Preenchido = vai só o nome, e o motivo entra no log. */
  motivoSemArquivo: MotivoSemArquivo | null;
}

/**
 * Decide, documento a documento, se o arquivo pode ir.
 *
 * ⚠️ TIPO REPETIDO MANTÉM O PRIMEIRO — a mesma regra deles. Dois RGs anexados são o mesmo
 * documento mandado duas vezes, e enviar os dois faria o outro lado guardar duplicata.
 *
 * ⚠️ TAMANHO OU MIME DESCONHECIDO NÃO BLOQUEIA. Nem todo registro nosso tem essas colunas
 * preenchidas, e recusar por ausência de metadado esconderia documento que está perfeito. O
 * destino valida MIME e tamanho de novo — é o que a ADR-0016 exige dele.
 */
export function planoDoEnvio(candidatos: DocumentoCandidato[]): EntradaDoEnvio[] {
  const porTipo = new Map<string, EntradaDoEnvio>();

  for (const d of candidatos) {
    if (porTipo.has(d.tipo)) continue;

    let motivo: MotivoSemArquivo | null = null;
    if (NAO_VIAJAM.has(d.tipo)) motivo = 'tipo_nao_suportado_la';
    else if (typeof d.tamanhoEmBytes === 'number' && d.tamanhoEmBytes > LIMITE_DE_BYTES) {
      motivo = 'grande_demais';
    } else if (d.mime && !MIMES_QUE_VIAJAM.includes(d.mime as never)) {
      motivo = 'mime_nao_aceito';
    }

    porTipo.set(d.tipo, {
      documentoId: d.id,
      tipo: d.tipo,
      nomeArquivo: motivo ? null : (d.nomeArquivo ?? null),
      dataEmissao: motivo ? null : (d.dataEmissao ?? null),
      motivoSemArquivo: motivo,
    });
  }

  return [...porTipo.values()];
}
