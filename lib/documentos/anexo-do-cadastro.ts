/**
 * O DOCUMENTO QUE O PACIENTE ANEXA NO PRÓPRIO CADASTRO.
 *
 * Decisão do dono em 10/09/2026, ao ver o fluxo 2 em produção: perguntar se ele já tem a
 * autorização da ANVISA e, se tiver, deixar que envie ali mesmo. Se não tiver, o sistema
 * registra isso — e é o que permite oferecer a procuração depois, sem perguntar de novo.
 *
 * 🔴 POR QUE O ARQUIVO VIAJA NO PAYLOAD, E NÃO POR UPLOAD SEPARADO
 *
 * Quando ele preenche o cadastro, ainda **não existe sessão** — a conta nasce no fim do
 * mesmo ato. Um endpoint de upload aberto a quem não tem sessão seria um lugar para qualquer
 * um despejar arquivo. O anexo entra pela mesma Server Action que já é protegida pelo token
 * de uso único do link, e só vira arquivo depois que a ficha do paciente existe.
 *
 * ⚠️ NUNCA DERRUBA O CADASTRO. Se o anexo falhar, a conta continua criada e o documento fica
 * como pendência — que já é um estado previsto (ADR-0016 D-06): ela informa, não bloqueia.
 */

import { put } from '@vercel/blob';

import { db } from '@/lib/db';
import { documentos } from '@/db/schema';

import { type DocumentoDoFluxo } from '@/lib/parceiros/documentos';

import { calcularValidade } from './validade';

/**
 * 🔴 O VOCABULÁRIO DO FLUXO NÃO É O DA TABELA — a mesma tradução de
 * `lib/parceiros/materializar-documentos.ts`, e pelo mesmo motivo.
 *
 * `laudo_medico` não tem equivalente em `documentos` e fica de fora: forçá-lo em
 * `documento_pessoal` classificaria um documento CLÍNICO como pessoal, e quem lesse a ficha
 * depois acreditaria na classificação errada.
 *
 * ⚠️ Duas cópias da mesma tradução é exatamente o tipo de coisa que diverge. Está catalogado:
 * quando o enum ganhar `laudo_medico`, as duas somem juntas.
 */
const TRADUCAO: Partial<Record<DocumentoDoFluxo, string>> = {
  receita_medica: 'receita_medica',
  comprovante_residencia: 'comprovante_residencia',
  autorizacao_anvisa: 'autorizacao_anvisa',
  documento_identidade: 'rg',
};

/** 8 MB. Foto de documento ou PDF de uma página não passa disso. */
export const TAMANHO_MAXIMO_DO_ANEXO = 8 * 1024 * 1024;

/** Os mesmos quatro que aceitamos do parceiro — uma lista só para as duas origens. */
export const TIPOS_ACEITOS_NO_ANEXO = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export interface AnexoDoCadastro {
  /** Nome original, só para exibição. */
  nomeArquivo: string;
  /** MIME declarado pelo navegador — conferido contra a lista antes de gravar. */
  tipoMime: string;
  /** O arquivo em base64, sem o prefixo `data:`. */
  conteudoBase64: string;
}

/**
 * Grava o anexo como documento do paciente.
 *
 * Devolve `false` quando não pôde gravar — nunca lança. O cadastro é o que importa.
 */
export async function anexarDocumentoDoCadastro(params: {
  pacienteId: string;
  tipo: DocumentoDoFluxo;
  anexo: AnexoDoCadastro;
  protocolo: string;
}): Promise<boolean> {
  try {
    const tipoNaTabela = TRADUCAO[params.tipo];
    if (!tipoNaTabela) return false; // laudo_medico — sem destino, ver o bloco acima
    if (!TIPOS_ACEITOS_NO_ANEXO.includes(params.anexo.tipoMime as never)) return false;

    const bytes = Buffer.from(params.anexo.conteudoBase64, 'base64');
    if (bytes.byteLength === 0 || bytes.byteLength > TAMANHO_MAXIMO_DO_ANEXO) return false;

    const nomeSeguro = params.anexo.nomeArquivo.replace(/[^\w.-]/g, '_').slice(0, 120);
    const blob = await put(
      `documentos/cadastro/${params.pacienteId}/${params.tipo}_${Date.now()}_${nomeSeguro}`,
      bytes,
      {
        /**
         * 🔴 PRIVADO. Decisão do dono em 10/09/2026: _"então vamos colocar no nosso store
         * privado"_.
         *
         * Store público significa: quem tem a URL lê, sem autenticação — e o que está aqui é
         * RG, receita e laudo. Obscuridade de URL não é controle de acesso.
         *
         * ⚠️ Um blob privado NÃO abre por link direto, e é esse o ponto. A entrega passa por
         * `/api/documentos/<id>/arquivo`, que autentica, confere escopo de objeto e registra
         * a leitura. Quem escrever tela nova deve usar aquela rota, nunca `urlBlob`.
         */
        access: 'private',
        contentType: params.anexo.tipoMime,
      },
    );

    /**
     * 🔴 A DATA DE EMISSÃO NÃO SE INVENTA — e aqui ninguém a informou.
     *
     * O paciente anexa o documento; não perguntamos quando foi emitido, porque uma pergunta
     * a mais no cadastro custa desistência e ele pode não saber de cabeça. Gravamos a data do
     * ENVIO e dizemos isso na observação. A validade sai de `calcularValidade`, a mesma regra
     * do upload manual e do documento que vem do parceiro.
     */
    const hoje = new Date().toISOString().split('T')[0];

    await db.insert(documentos).values({
      pacienteId: params.pacienteId,
      tipo: tipoNaTabela as 'receita_medica',
      urlBlob: blob.url,
      nomeArquivo: params.anexo.nomeArquivo,
      dataEmissao: hoje,
      dataValidade: calcularValidade(tipoNaTabela, hoje),
      observacoes: `Enviado pelo paciente no cadastro · protocolo ${params.protocolo} · data de emissão não informada; a data acima é a do envio`,
    });

    return true;
  } catch (erro) {
    console.error(
      '[cadastro] falha ao anexar documento:',
      erro instanceof Error ? erro.name : 'erro',
    );
    return false;
  }
}
