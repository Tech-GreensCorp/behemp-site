/**
 * OS ARQUIVOS QUE O PACIENTE JÁ ENVIOU NO PARCEIRO CHEGAM JUNTO COM O CADASTRO.
 *
 * Decisão do dono em 10/09/2026: o paciente que preencheu o formulário da Greens e subiu RG,
 * comprovante e laudo lá **não pode ser obrigado a subir tudo de novo** aqui para fazer a
 * procuração da ANVISA. Retifica a ADR-0016, que só previa o MANIFESTO — a lista de quais
 * documentos o parceiro tem, sem os arquivos.
 *
 * 🔴 BAIXAR URL QUE VEIO DE FORA É SSRF — OWASP A10:2021.
 *
 * "SSRF flaws occur whenever a web application is fetching a remote resource without
 * validating the user-supplied URL" — e a defesa recomendada é allowlist por esquema E host,
 * com resolução de nome na validação, bloqueando faixas privadas, loopback, link-local e o
 * endereço de metadados da nuvem. Sem isso, uma URL apontando para 169.254.169.254 faria o
 * NOSSO servidor buscar credenciais da instância e devolvê-las para quem pediu.
 *
 * Fonte lida: owasp.org/Top10/2021/A10_2021-Server-Side_Request_Forgery_(SSRF)
 * e o Server Side Request Forgery Prevention Cheat Sheet.
 *
 * ⚠️ POR QUE BAIXAR AGORA, E NÃO QUANDO O PACIENTE CONCLUIR O CADASTRO
 *
 * A URL do parceiro é assinada e de vida curta — é assim que se entrega arquivo privado. Se
 * esperássemos o paciente terminar o cadastro (que pode levar dias, o link vale 7), a URL já
 * teria expirado e o documento se perderia em silêncio. Baixamos no handoff, re-hospedamos, e
 * o que fica guardado é o NOSSO endereço.
 *
 * ⚠️ E ELE NUNCA DERRUBA O HANDOFF — mas isso não faz do documento algo dispensável.
 *
 * Decisão do dono em 13/09/2026, derrubando o que este comentário dizia antes: _"o envio do
 * documento é tão necessário quanto a criação da conta; o paciente passa por 2 formulários e 1
 * se torna à toa e o outro mentiroso"_. Não lançar continua certo — deixar o paciente sem
 * conta E sem documento é pior. Mas a falha é FATO A COBRAR, não custo aceito: motivo legível,
 * visível na tela (S8.4), e cobrável da origem.
 * Falha de download vira pendência — o paciente envia manualmente, como sempre pôde.
 */

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

import { put } from '@vercel/blob';
import { z } from 'zod';

import { DOCUMENTOS_DO_FLUXO, type DocumentoDoFluxo } from './documentos';

/** 8 MB por arquivo. Documento de identidade fotografado não passa disso. */
const TAMANHO_MAXIMO = 8 * 1024 * 1024;
/** Além disso, o parceiro está fora do ar e o cadastro não pode esperar. */
const TEMPO_LIMITE_MS = 15_000;
/** No máximo cinco — é o tamanho do fluxo. */
const MAXIMO_DE_ARQUIVOS = 5;

const TIPOS_ACEITOS = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

/**
 * O formato NOVO. O antigo (lista de nomes) continua valendo — ver `normalizarEntradas`.
 */
export const entradaDeDocumentoSchema = z.object({
  tipo: z.enum(DOCUMENTOS_DO_FLUXO),
  url: z.string().url().max(2000),
  /** Do parceiro. Ausente é normal: nem todo sistema guarda essa data. */
  dataEmissao: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  nomeArquivo: z.string().trim().max(200).optional().nullable(),
});

export type EntradaDeDocumento = z.infer<typeof entradaDeDocumentoSchema>;

/** O que chega: ou os nomes (manifesto antigo), ou os objetos com URL. */
export type DocumentosRecebidos = Array<string | EntradaDeDocumento>;

/**
 * Separa o que veio em manifesto (só o nome) e entradas com arquivo.
 *
 * Retrocompatível de propósito: enquanto a Greens não mandar o formato novo, o antigo segue
 * funcionando exatamente como antes. Um contrato que quebra o parceiro no dia da mudança é
 * pior que um contrato que aceita os dois por um tempo.
 */
export function normalizarEntradas(recebidos: DocumentosRecebidos | null | undefined): {
  manifesto: string[];
  comArquivo: EntradaDeDocumento[];
} {
  const manifesto: string[] = [];
  const comArquivo: EntradaDeDocumento[] = [];
  for (const item of recebidos ?? []) {
    if (typeof item === 'string') {
      manifesto.push(item);
      continue;
    }
    const analise = entradaDeDocumentoSchema.safeParse(item);
    if (analise.success) {
      comArquivo.push(analise.data);
      manifesto.push(analise.data.tipo); // com arquivo também conta como "o parceiro tem"
    }
  }
  return { manifesto, comArquivo: comArquivo.slice(0, MAXIMO_DE_ARQUIVOS) };
}

/** As origens de onde aceitamos baixar. Vazio = nenhuma, e o download não acontece. */
function origensPermitidas(): string[] {
  const cru =
    process.env.PARCEIRO_ORIGENS_DE_DOCUMENTO?.trim() ||
    process.env.PARCEIRO_ORIGENS_DE_RETORNO?.trim() ||
    '';
  return cru
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

/** Faixas que nunca podem ser destino: elas são a rede interna, não a internet. */
function enderecoInterno(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v6 = ip.toLowerCase();
    // loopback, link-local, unique-local e o mapeamento de IPv4
    if (v6 === '::1' || v6.startsWith('fe80:') || v6.startsWith('fc') || v6.startsWith('fd')) {
      return true;
    }
    const mapeado = v6.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapeado) return enderecoInterno(mapeado[1]);
    return false;
  }
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 10 || // privada
    a === 127 || // loopback
    a === 0 ||
    (a === 172 && b >= 16 && b <= 31) || // privada
    (a === 192 && b === 168) || // privada
    (a === 169 && b === 254) || // 🔴 link-local: é onde vive o metadata da AWS
    a >= 224 // multicast e reservado
  );
}

/**
 * A URL é de uma origem que autorizamos, e não aponta para dentro da nossa rede?
 *
 * 🔴 A COMPARAÇÃO É POR ORIGEM INTEIRA, NUNCA POR PREFIXO. `https://greens-corp.com.br.evil`
 * começa com `https://greens-corp.com` — mesma armadilha do redirecionamento aberto, que a
 * ADR-0016 já tinha resolvido do outro lado.
 *
 * 🔴 E O DNS É RESOLVIDO AQUI. Sem isso, um host permitido apontando para 127.0.0.1 passa —
 * é o ataque de DNS rebinding que o cheat sheet da OWASP nomeia.
 */
/**
 * Transforma a exceção em algo legível num log seis semanas depois.
 *
 * ⚠️ NUNCA a URL. A `message` de um erro de `fetch` costuma incluir o endereço — e o do parceiro
 * carrega assinatura de acesso ao S3 dele. Por isso a substituição e o recorte.
 */
/** Quantas vezes tentar buscar o arquivo do parceiro antes de desistir. */
const TENTATIVAS_DE_DOWNLOAD = 3;

/**
 * Baixa o documento do parceiro, com retentativa curta dentro da janela da URL.
 *
 * ## Por que isto existe — as quatro etapas do `CLAUDE.md`
 *
 * **1. NOMEAR.** O que a Greens e a BeHemp fazem com documento tem nome: **Claim Check**
 * (Hohpe & Woolf, _Enterprise Integration Patterns_). O produtor não manda o arquivo na
 * mensagem: guarda num store e manda uma **referência**; o consumidor busca. É exatamente o
 * `{ tipo, url }` do handoff.
 *
 * **2. COMPARAR.** O padrão cobre a maior parte, e falha num ponto que nos atinge: ele supõe a
 * referência **durável** — o consumidor busca quando quiser. A nossa é URL assinada de S3 com
 * TTL de 1 h. **Referência perecível quebra a premissa do padrão.**
 *
 * ⚠️ E a doc da AWS traz um agravante que explica 403 inesperado: _"a presigned URL expires at
 * either its configured expiration time or when its associated credentials expire, whichever
 * occurs first"_. Se a Greens assina com credencial temporária (role de container/Lambda), a
 * URL pode morrer **antes** da hora que ela pediu — e nós veríamos só um 403.
 *
 * **3. JULGAR.** Três caminhos: (a) manter uma única tentativa síncrona — o que havia; (b) pedir
 * à Greens que faça PUSH do arquivo, mudando o contrato e pesando o handoff; (c) referência
 * durável, com endpoint autenticado deles servindo sob demanda.
 *
 * 🔴 **(a) era indefensável, e foi o que medimos:** um `fetch` sem retentativa, timeout de 30 s.
 * Uma queda de rede de um segundo perdia o documento **para sempre** — na próxima vez que
 * alguém tentasse, a URL já teria expirado. (c) é o mais robusto e depende deles; (b) troca um
 * problema por outro.
 *
 * **4. DECIDIR.** Claim Check com **duas adaptações** que o padrão puro não tem, e que existem
 * porque a referência é perecível:
 *
 *   1. **retentativa dentro da janela** — aqui. A URL vale ~1 h; insistir por um segundo é
 *      gratuito e cobre a classe inteira de falha transitória
 *   2. **a recusa vira fato registrado** — em `handoff.ts`. O padrão supõe que o consumidor
 *      sempre consegue buscar, e não diz o que fazer quando não consegue
 *
 * ⚠️ **O que NÃO se retenta, de propósito:** `403` e `404`. Expirada é expirada, ausente é
 * ausente — insistir contra veredicto definitivo só gasta a janela de que os transitórios
 * precisam.
 *
 * **Fontes:** [Claim Check — EIP](https://www.enterpriseintegrationpatterns.com/patterns/messaging/StoreInLibrary.html) ·
 * [Claim-Check — Azure](https://learn.microsoft.com/en-us/azure/architecture/patterns/claim-check) ·
 * [Presigned URL expiration — AWS](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html)
 */
async function baixarComRetentativa(url: string): Promise<Response> {
  let ultima: Response | undefined;

  for (let tentativa = 1; tentativa <= TENTATIVAS_DE_DOWNLOAD; tentativa++) {
    try {
      const resposta = await fetch(url, {
        signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
        redirect: 'error', // redirect é como se escapa de uma allowlist
      });

      if (resposta.ok) return resposta;
      // Veredicto definitivo do outro lado: insistir não muda.
      if (resposta.status === 403 || resposta.status === 404) return resposta;
      ultima = resposta;
    } catch (erro) {
      // Rede caiu ou estourou o tempo. Se ainda há tentativa, insiste; senão, propaga.
      if (tentativa === TENTATIVAS_DE_DOWNLOAD) throw erro;
    }

    // Espera curta e crescente: 300 ms, 600 ms. A janela da URL é de ~1 h; isto cabe.
    if (tentativa < TENTATIVAS_DE_DOWNLOAD) {
      await new Promise((r) => setTimeout(r, 300 * tentativa));
    }
  }

  return ultima!;
}

function motivoLegivel(erro: unknown): string {
  if (!(erro instanceof Error)) return 'erro_desconhecido';
  const causa = (erro as { cause?: { code?: string } }).cause?.code;
  const texto = (causa ? causa + ': ' + erro.message : erro.message) || erro.name;
  return texto
    .replace(/https?:\/\/\S+/g, '<url>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

export async function origemAutorizada(url: string): Promise<{ ok: boolean; motivo?: string }> {
  let alvo: URL;
  try {
    alvo = new URL(url);
  } catch {
    return { ok: false, motivo: 'url_invalida' };
  }

  if (alvo.protocol !== 'https:') return { ok: false, motivo: 'sem_https' };

  const permitidas = origensPermitidas();
  if (permitidas.length === 0) return { ok: false, motivo: 'sem_origens_configuradas' };
  if (!permitidas.includes(alvo.origin)) {
    /**
     * 🔴 A ORIGEM RECUSADA VAI NO MOTIVO — e ela NÃO é credencial.
     *
     * Medido em produção em 13/09/2026: o log dizia `receita_medica:origem_nao_autorizada` e
     * parava aí. A allowlist tinha `https://greens-site-bucket.s3.us-east-1.amazonaws.com`, e
     * mesmo assim recusava — sem dizer **qual** origem chegou, não havia como saber o que
     * corrigir.
     *
     * ⚠️ O S3 serve o MESMO arquivo por dois endereços diferentes, e eles têm origens distintas:
     *
     *   virtual-hosted:  https://<bucket>.s3.<regiao>.amazonaws.com/<chave>
     *   path-style:      https://s3.<regiao>.amazonaws.com/<bucket>/<chave>
     *
     * Uma allowlist com o primeiro recusa o segundo, e a mensagem antiga não deixava ver isso.
     *
     * 🔴 **Só o `origin`, nunca a URL inteira.** O host é público — aparece em qualquer
     * requisição. O que não pode vazar é a query string, que carrega `X-Amz-Signature`.
     */
    return { ok: false, motivo: `origem_nao_autorizada:${alvo.origin}` };
  }

  try {
    const { address } = await lookup(alvo.hostname);
    if (enderecoInterno(address)) return { ok: false, motivo: 'aponta_para_rede_interna' };
  } catch {
    return { ok: false, motivo: 'dns_nao_resolveu' };
  }

  return { ok: true };
}

export interface ArquivoMaterializado {
  tipo: DocumentoDoFluxo;
  urlBlob: string;
  nomeArquivo: string | null;
  dataEmissao: string | null;
}

/**
 * Baixa os arquivos autorizados e os re-hospeda no nosso storage.
 *
 * NUNCA LANÇA. O que falhar simplesmente não entra — vira pendência, e a pendência já é um
 * estado previsto pela ADR-0016 D-06: ela informa, não bloqueia.
 */
export async function materializarArquivos(
  entradas: EntradaDeDocumento[],
  referencia: string,
): Promise<{
  arquivos: ArquivoMaterializado[];
  recusados: Array<{ tipo: string; motivo: string }>;
}> {
  /**
   * 🔴 EM PARALELO, NÃO EM FILA — corrigido em 11/09/2026, apontado pela Greens no §12 do
   * contrato-ponte com uma medição do lado deles:
   *
   *   hoje:     cria conta → baixa 3 arquivos (sequencial) → responde   ← 15-45 s
   *
   * O handoff deles ESPERA esta função. Cada documento custa uma resolução de DNS, um
   * download e um upload ao blob; em fila, três viram quase um minuto — e o timeout de 30 s
   * que eles puseram do lado de lá é curativo, não desenho. O pior caso cai para o do
   * documento mais lento.
   *
   * ⚠️ SEM LIMITE DE CONCORRÊNCIA DE PROPÓSITO, e isso só é seguro porque a lista é curta:
   * `DOCUMENTOS_DO_FLUXO` tem **cinco** chaves, o manifesto é deduplicado por tipo antes de
   * chegar aqui, e a Greens impõe teto de 20 do lado dela. Se um dia a lista crescer, isto
   * precisa de um pool — e este comentário é o aviso.
   *
   * ⚠️ A ORDEM DO RESULTADO CONTINUA A DA ENTRADA. `Promise.all` preserva a ordem do array,
   * e o `for` de antes também preservava: quem lê o manifesto não percebe a mudança.
   */
  const resultados = await Promise.all(
    entradas.map(
      async (
        entrada,
      ): Promise<
        { ok: true; arquivo: ArquivoMaterializado } | { ok: false; tipo: string; motivo: string }
      > => {
        try {
          const autorizacao = await origemAutorizada(entrada.url);
          if (!autorizacao.ok) {
            return {
              ok: false,
              tipo: entrada.tipo,
              motivo: autorizacao.motivo ?? 'nao_autorizada',
            };
          }

          const resposta = await baixarComRetentativa(entrada.url);
          if (!resposta.ok) {
            return { ok: false, tipo: entrada.tipo, motivo: `http_${resposta.status}` };
          }

          const mime = (resposta.headers.get('content-type') ?? '').split(';')[0].trim();
          if (!TIPOS_ACEITOS.has(mime)) {
            return { ok: false, tipo: entrada.tipo, motivo: 'tipo_de_arquivo_recusado' };
          }

          const bytes = Buffer.from(await resposta.arrayBuffer());
          if (bytes.byteLength === 0 || bytes.byteLength > TAMANHO_MAXIMO) {
            return { ok: false, tipo: entrada.tipo, motivo: 'tamanho_fora_do_limite' };
          }

          /**
           * 🔴 PRIVADO — e aqui pesa mais que em qualquer outro lugar: são documentos de
           * pacientes de OUTRA empresa, que a Greens nos confiou. Ela mediu o bucket dela e
           * provou que é privado (403, e não 404); receber e guardar em público seria devolver
           * um cuidado com descuido.
           *
           * A entrega é por `/api/documentos/<id>/arquivo`, com escopo de objeto e auditoria.
           */
          const ACESSO_DO_BLOB = 'private' as const;

          const nome = entrada.nomeArquivo?.replace(/[^\w.-]/g, '_') ?? `${entrada.tipo}`;
          const blob = await put(
            `documentos/parceiro/${referencia}/${entrada.tipo}_${Date.now()}_${nome}`,
            bytes,
            {
              access: ACESSO_DO_BLOB,
              contentType: mime,
            },
          );

          return {
            ok: true,
            arquivo: {
              tipo: entrada.tipo,
              urlBlob: blob.url,
              nomeArquivo: entrada.nomeArquivo ?? null,
              dataEmissao: entrada.dataEmissao ?? null,
            },
          };
        } catch (erro) {
          // Nunca derruba o handoff — mas a recusa é fato a cobrar, não custo aceito (13/09).
          return {
            ok: false,
            tipo: entrada.tipo,
            /**
             * 🔴 A MENSAGEM, NÃO O `name` — e isto custou o diagnóstico do fluxo 1 inteiro.
             *
             * Medido em produção em 13/09/2026: o log dizia
             * `documentos recusados: receita_medica:Error,comprovante_residencia:Error`.
             * **`erro.name` de um `new Error()` é sempre `'Error'`** — então três tipos que
             * podem ter falhado por motivos diferentes produziram a mesma palavra inútil.
             *
             * ⚠️ É a MESMA classe que o guarda `o-cadastro-feito-nao-vira-falha` documentou
             * (_"o log dizia só `{ erro: 'Error' }`"_), cometida de novo no módulo ao lado.
             * Defeito corrigido num arquivo não se corrige nos outros sozinho.
             *
             * E o desperdício era grande: `origemAutorizada` distingue SEIS motivos, e o
             * `fetch` distingue `http_403`, `tipo_de_arquivo_recusado` e
             * `tamanho_fora_do_limite`. Este `catch` jogava todos fora.
             */
            motivo: motivoLegivel(erro),
          };
        }
      },
    ),
  );

  const arquivos: ArquivoMaterializado[] = [];
  const recusados: Array<{ tipo: string; motivo: string }> = [];
  for (const r of resultados) {
    if (r.ok) arquivos.push(r.arquivo);
    else recusados.push({ tipo: r.tipo, motivo: r.motivo });
  }

  return { arquivos, recusados };
}
