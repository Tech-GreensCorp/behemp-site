import { put, del, list } from '@vercel/blob';

/**
 * Integração com Vercel Blob para upload de documentos.
 *
 * Configuração necessária: BLOB_READ_WRITE_TOKEN no .env
 * Tipos aceitos: PDF, imagens (JPEG, PNG, WebP)
 * Tamanho máximo: 4.5MB (limite gratuito Vercel Blob)
 */

// ── Constantes ────────────────────────────────────────────────

const TAMANHO_MAXIMO_BYTES = 4.5 * 1024 * 1024; // 4.5MB
const TIPOS_ACEITOS = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
];

// ── Tipos ─────────────────────────────────────────────────────

interface UploadParams {
  arquivo: File | Blob;
  nomeArquivo: string;
  pacienteId: string;
  tipoDocumento: string;
}

interface UploadResult {
  sucesso: boolean;
  url?: string;
  erro?: string;
}

// ── Upload de documento ───────────────────────────────────────

/**
 * Faz upload de um documento para o Vercel Blob.
 * O caminho é organizado por paciente e tipo de documento.
 */
export async function uploadDocumento(params: UploadParams): Promise<UploadResult> {
  try {
    // Validar tamanho
    if (params.arquivo.size > TAMANHO_MAXIMO_BYTES) {
      return {
        sucesso: false,
        erro: `Arquivo excede o limite de ${TAMANHO_MAXIMO_BYTES / 1024 / 1024}MB`,
      };
    }

    // Validar tipo
    if (params.arquivo.type && !TIPOS_ACEITOS.includes(params.arquivo.type)) {
      return {
        sucesso: false,
        erro: `Tipo de arquivo não aceito. Use: ${TIPOS_ACEITOS.join(', ')}`,
      };
    }

    // Gerar caminho organizado: documentos/{pacienteId}/{tipoDocumento}/{nomeArquivo}
    const caminho = `documentos/${params.pacienteId}/${params.tipoDocumento}/${params.nomeArquivo}`;

    const blob = await put(caminho, params.arquivo, {
      access: 'public',
      addRandomSuffix: true, // Evitar colisões de nome
    });

    return { sucesso: true, url: blob.url };
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[Blob] Erro ao fazer upload:', mensagem);
    return { sucesso: false, erro: mensagem };
  }
}

// ── Deletar documento ─────────────────────────────────────────

/**
 * Remove um documento do Vercel Blob.
 */
export async function deletarDocumento(url: string): Promise<{ sucesso: boolean; erro?: string }> {
  try {
    await del(url);
    return { sucesso: true };
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[Blob] Erro ao deletar documento:', mensagem);
    return { sucesso: false, erro: mensagem };
  }
}

// ── Listar documentos de um paciente ──────────────────────────

/**
 * Lista todos os documentos de um paciente no Blob.
 */
export async function listarDocumentosPaciente(
  pacienteId: string,
): Promise<{ urls: string[]; erro?: string }> {
  try {
    const resultado = await list({
      prefix: `documentos/${pacienteId}/`,
    });

    return { urls: resultado.blobs.map((blob) => blob.url) };
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[Blob] Erro ao listar documentos:', mensagem);
    return { urls: [], erro: mensagem };
  }
}

// ── Validação de arquivo (client-side) ────────────────────────

/**
 * Validação que pode ser usada no frontend antes do upload.
 */
export function validarArquivoParaUpload(arquivo: File): {
  valido: boolean;
  erro?: string;
} {
  if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
    return {
      valido: false,
      erro: `Arquivo muito grande. Máximo: ${TAMANHO_MAXIMO_BYTES / 1024 / 1024}MB`,
    };
  }

  if (!TIPOS_ACEITOS.includes(arquivo.type)) {
    return {
      valido: false,
      erro: `Tipo não aceito. Use: PDF, JPEG, PNG ou WebP`,
    };
  }

  return { valido: true };
}
