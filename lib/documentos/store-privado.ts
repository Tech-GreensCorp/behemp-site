/**
 * O único lugar que sabe QUAL store guarda documento sensível — e como se lê de volta.
 *
 * 🔴 POR QUE ESTE ARQUIVO EXISTE, medido em 13/09/2026.
 *
 * O acesso de um blob não é propriedade do upload: é do STORE, escolhido na criação e
 * imutável. A doc da Vercel é explícita — _"You select a store's access mode, public or
 * private, when you create it. If your app needs both public and private files, provision two
 * separate stores from the start."_ Não existe `update-store`.
 *
 * Seis caminhos deste repositório pediam `access: 'private'` contra um store PÚBLICO, e o SDK
 * recusava — corretamente — com `Cannot use private access on a public store`. Três deles nem
 * token passavam (caíam no `BLOB_READ_WRITE_TOKEN` por default) e três passavam
 * `BLOB_BEHEMP_READ_WRITE_TOKEN`, que é a MESMA variável com que `upload-avatar` e
 * `upload-exame` gravam `access: 'public'`. Nenhuma das duas podia virar o store privado sem
 * quebrar o que já funciona, e é por isso que a variável aqui é uma terceira.
 *
 * O defeito passou quatro dias invisível porque cinco dos seis pontos engoliam o erro num
 * `catch` e logavam `erro.name` — que para um `new Error` é **sempre** `'Error'`.
 *
 * ⚠️ FALHA FECHADA, e é o ponto inteiro deste módulo: sem o token privado, aqui se LANÇA.
 * Nunca se cai para público. O que está em jogo é RG, laudo, receita e procuração assinada —
 * e, no caminho do parceiro, documentos de pacientes de outra empresa. Store público significa
 * que quem tem a URL lê **sem autenticação**, e obscuridade de URL não é controle de acesso
 * (`.claude/rules/seguranca-lgpd.md`).
 */
import { del, get, put } from '@vercel/blob';

/** Host que a Vercel usa para blob de store privado. Público é `*.public.blob…`. */
const HOST_PRIVADO = '.private.blob.vercel-storage.com';

/**
 * Lançado quando o store privado não está configurado.
 *
 * Tem mensagem própria de propósito: o erro do SDK fala de "public store", que descreve o
 * sintoma e não a causa — quem lê o log precisa saber QUAL variável falta.
 */
export class StorePrivadoNaoConfigurado extends Error {
  constructor() {
    super(
      'BLOB_TOKEN_PRIVADO ausente — o documento não foi gravado. ' +
        'Documento de paciente não vai para store público; ver lib/documentos/store-privado.ts',
    );
    this.name = 'StorePrivadoNaoConfigurado';
  }
}

/** O token do store privado, ou `null` quando não configurado. */
export function tokenDoStorePrivado(): string | null {
  const bruto = process.env.BLOB_TOKEN_PRIVADO?.trim();
  return bruto ? bruto : null;
}

function exigirToken(): string {
  const token = tokenDoStorePrivado();
  if (!token) throw new StorePrivadoNaoConfigurado();
  return token;
}

/**
 * Grava um documento sensível no store privado.
 *
 * Assinatura enxuta de propósito: `access` e `token` NÃO são parâmetros. Quem chama não pode
 * escolher gravar em público — se pudesse, este módulo seria documentação em vez de garantia.
 */
export async function guardarDocumentoPrivado(
  caminho: string,
  corpo: Parameters<typeof put>[1],
  opcoes?: { contentType?: string },
): Promise<{ url: string; pathname: string }> {
  const blob = await put(caminho, corpo, {
    access: 'private',
    token: exigirToken(),
    ...(opcoes?.contentType ? { contentType: opcoes.contentType } : {}),
  });
  return { url: blob.url, pathname: blob.pathname };
}

/**
 * Um blob deste endereço está no store privado?
 *
 * ⚠️ Decide pelo HOST, nunca por prefixo nem por `includes` na URL inteira — uma URL pública
 * pode carregar a string `private` no nome do arquivo, e prefixo de host é o buraco que já nos
 * custou um redirecionamento aberto na URL de retorno do parceiro.
 */
export function ehDoStorePrivado(url: string): boolean {
  try {
    return new URL(url).host.endsWith(HOST_PRIVADO);
  } catch {
    return false;
  }
}

/**
 * Busca os bytes de um blob privado.
 *
 * 🔴 `fetch(url)` NÃO serve aqui, e era o que a entrega fazia. Blob privado exige
 * `Authorization: Bearer`, e o SDK cuida disso. Devolve `null` quando o blob não existe —
 * quem chama responde **404**, nunca 403: 403 transforma a rota em oráculo de enumeração.
 */
export async function lerDocumentoPrivado(
  url: string,
): Promise<{ stream: ReadableStream<Uint8Array>; contentType: string } | null> {
  const resultado = await get(url, { access: 'private', token: exigirToken() });
  if (!resultado || resultado.statusCode !== 200 || !resultado.stream) return null;
  return { stream: resultado.stream, contentType: resultado.blob.contentType };
}

/**
 * Apaga um blob do store privado.
 *
 * ⚠️ Existe para que a exclusão não erre de store — apagar com o token do store público não
 * encontra o blob e "funciona" sem apagar nada. Quem chama decide SE apaga: entidade clínica
 * usa soft delete, e blob não se remove quando o histórico precisa existir.
 */
export async function apagarDocumentoPrivado(url: string): Promise<void> {
  await del(url, { token: exigirToken() });
}
