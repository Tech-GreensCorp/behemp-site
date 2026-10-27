/**
 * O DOWNLOAD de um documento do paciente — pela mesma porta do VER.
 *
 * 🔴 `GET /api/documentos/{id}/arquivo` autentica, confere escopo de objeto, audita e serve os
 * dois mundos (blob privado por streaming, blob antigo por redirect). A URL crua do blob NÃO
 * serve: no store privado ela exige `Authorization: Bearer` e responde 403.
 *
 * 🔴 E `response.blob()` NÃO LANÇA em 4xx/5xx — o corpo do erro vira Blob. Foi assim que um
 * `Forbidden` de 10 bytes foi salvo como "TERMO_….pdf" (27/10/2026). Por isso só resposta 2xx
 * vira arquivo; o resto vira erro com mensagem que o usuário entende.
 *
 * ⚠️ A mensagem nunca carrega o corpo da resposta nem o id: a rota responde 404 tanto para
 * "não existe" quanto para "não é seu", de propósito, e a tela não pode desfazer isso.
 */

export function enderecoDoDocumento(documentoId: string): string {
  return `/api/documentos/${encodeURIComponent(documentoId)}/arquivo`;
}

/** Exame tem a própria rota: não está em `documentos` e o escopo é outro (médico do paciente). */
export function enderecoDoExame(exameId: string): string {
  return `/api/exames/${encodeURIComponent(exameId)}/arquivo`;
}

const MENSAGEM_GENERICA = 'Não foi possível baixar o documento. Tente novamente.';

function mensagemDoStatus(status: number): string {
  switch (status) {
    case 401:
      return 'Sua sessão expirou. Entre novamente para baixar o documento.';
    case 403:
    case 404:
      return 'Documento não encontrado ou sem permissão de acesso.';
    case 429:
      return 'Muitos downloads em sequência. Aguarde um minuto e tente novamente.';
    default:
      return MENSAGEM_GENERICA;
  }
}

async function buscarDoEndereco(endereco: string, buscar: typeof fetch): Promise<Blob> {
  let resposta: Response;
  try {
    resposta = await buscar(endereco);
  } catch {
    throw new Error(MENSAGEM_GENERICA);
  }

  if (!resposta.ok) throw new Error(mensagemDoStatus(resposta.status));

  return resposta.blob();
}

/** `buscar` é injetável para o guarda executar a regra sem navegador. */
export function buscarArquivoDoDocumento(
  documentoId: string,
  buscar: typeof fetch = fetch,
): Promise<Blob> {
  return buscarDoEndereco(enderecoDoDocumento(documentoId), buscar);
}

async function salvarComoArquivo(blob: Blob, nomeArquivo: string): Promise<void> {
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(blobUrl);
}

/** Baixa o documento com o nome dado. Lança `Error` com mensagem pronta para `toast.error`. */
export async function baixarDocumento(documentoId: string, nomeArquivo: string): Promise<void> {
  await salvarComoArquivo(await buscarArquivoDoDocumento(documentoId), nomeArquivo);
}

/** Idem, para exame de paciente. */
export async function baixarExame(exameId: string, nomeArquivo: string): Promise<void> {
  await salvarComoArquivo(await buscarDoEndereco(enderecoDoExame(exameId), fetch), nomeArquivo);
}
