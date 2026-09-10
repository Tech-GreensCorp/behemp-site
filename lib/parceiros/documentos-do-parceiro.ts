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
 * ⚠️ E ELE NUNCA DERRUBA O HANDOFF. Documento é conveniência; o cadastro é o que importa.
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
  if (!permitidas.includes(alvo.origin)) return { ok: false, motivo: 'origem_nao_autorizada' };

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
  const arquivos: ArquivoMaterializado[] = [];
  const recusados: Array<{ tipo: string; motivo: string }> = [];

  for (const entrada of entradas) {
    try {
      const autorizacao = await origemAutorizada(entrada.url);
      if (!autorizacao.ok) {
        recusados.push({ tipo: entrada.tipo, motivo: autorizacao.motivo ?? 'nao_autorizada' });
        continue;
      }

      const resposta = await fetch(entrada.url, {
        signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
        redirect: 'error', // redirect é como se escapa de uma allowlist
      });
      if (!resposta.ok) {
        recusados.push({ tipo: entrada.tipo, motivo: `http_${resposta.status}` });
        continue;
      }

      const mime = (resposta.headers.get('content-type') ?? '').split(';')[0].trim();
      if (!TIPOS_ACEITOS.has(mime)) {
        recusados.push({ tipo: entrada.tipo, motivo: 'tipo_de_arquivo_recusado' });
        continue;
      }

      const bytes = Buffer.from(await resposta.arrayBuffer());
      if (bytes.byteLength === 0 || bytes.byteLength > TAMANHO_MAXIMO) {
        recusados.push({ tipo: entrada.tipo, motivo: 'tamanho_fora_do_limite' });
        continue;
      }

      /**
       * ⚠️ `access: 'public'` é o padrão que TODO o resto do projeto usa hoje
       * (`app/_actions/documentos.ts:95`), e a tela da ANVISA lê `urlBlob` direto. Gravar
       * privado aqui deixaria o documento invisível justamente para quem precisa dele.
       *
       * 🔴 Isto é o achado do Item 6 — store público com RG, laudo e receita — e ele fica
       * PIOR com este arquivo, porque agora entram documentos de outra empresa. A correção
       * é única para todos e está catalogada; centralizei a decisão nesta constante para
       * que mudar seja mexer em um lugar só.
       */
      const ACESSO_DO_BLOB = 'public' as const;

      const nome = entrada.nomeArquivo?.replace(/[^\w.-]/g, '_') ?? `${entrada.tipo}`;
      const blob = await put(
        `documentos/parceiro/${referencia}/${entrada.tipo}_${Date.now()}_${nome}`,
        bytes,
        {
          access: ACESSO_DO_BLOB,
          contentType: mime,
        },
      );

      arquivos.push({
        tipo: entrada.tipo,
        urlBlob: blob.url,
        nomeArquivo: entrada.nomeArquivo ?? null,
        dataEmissao: entrada.dataEmissao ?? null,
      });
    } catch (erro) {
      // Documento é conveniência; o cadastro é o que importa. Nunca derruba o handoff.
      recusados.push({
        tipo: entrada.tipo,
        motivo: erro instanceof Error ? erro.name : 'erro_desconhecido',
      });
    }
  }

  return { arquivos, recusados };
}
