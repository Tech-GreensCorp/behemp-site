/**
 * OS ARQUIVOS DO PARCEIRO VIRAM DOCUMENTOS DO PACIENTE, NO MOMENTO EM QUE A FICHA NASCE.
 *
 * O handoff baixa e re-hospeda os arquivos assim que o cadastro chega — a URL do parceiro é
 * assinada e de vida curta, e o paciente tem 7 dias para abrir o link. Mas `documentos` exige
 * `pacienteId`, e o paciente só existe quando ele conclui o cadastro. Então o arquivo espera
 * guardado na solicitação, e é aqui que ele encontra o dono.
 *
 * 🔴 O QUE ISSO RESOLVE, em uma frase: o paciente que já subiu RG e comprovante no formulário
 * da Greens não é obrigado a subir tudo de novo aqui para fazer a procuração da ANVISA. A tela
 * da ANVISA lê a tabela `documentos` — a partir do momento em que a linha existe, ela aparece.
 *
 * ⚠️ NUNCA LANÇA. Documento é conveniência; o cadastro é o que importa. Se a inserção falhar,
 * o paciente segue com a pendência e envia manualmente, como sempre pôde.
 */

import { db } from '@/lib/db';
import { documentos } from '@/db/schema';
import { calcularValidade } from '@/app/_actions/documentos';

import { type DocumentoDoFluxo } from './documentos';

interface ArquivoGuardado {
  tipo: string;
  urlBlob: string;
  nomeArquivo: string | null;
  dataEmissao: string | null;
}

function ehArquivo(item: unknown): item is ArquivoGuardado {
  return (
    !!item &&
    typeof item === 'object' &&
    'urlBlob' in item &&
    typeof (item as ArquivoGuardado).urlBlob === 'string' &&
    'tipo' in item
  );
}

const HOJE = () => new Date().toISOString().split('T')[0];

/**
 * 🔴 OS DOIS LADOS CHAMAM AS MESMAS COISAS POR NOMES DIFERENTES.
 *
 * O fluxo do parceiro (`DOCUMENTOS_DO_FLUXO`) nomeia os cinco documentos do encaminhamento.
 * A tabela `documentos` deste projeto tem outro vocabulário, mais antigo e mais granular:
 * `rg`, `rg_responsavel`, `documento_pessoal`, `oficio_anvisa`, `procuracao_especifica`.
 *
 * Três nomes coincidem. Um precisa de tradução. E um NÃO TEM PARA ONDE IR:
 *
 *   receita_medica         → receita_medica          (igual)
 *   comprovante_residencia → comprovante_residencia  (igual)
 *   autorizacao_anvisa     → autorizacao_anvisa      (igual)
 *   documento_identidade   → rg                      (traduzido)
 *   laudo_medico           → ✗ NÃO EXISTE NA TABELA
 *
 * ⚠️ `laudo_medico` fica de fora de propósito. Não há tipo equivalente, e forçá-lo em
 * `documento_pessoal` seria classificar um documento CLÍNICO como documento pessoal — quem
 * lesse a ficha depois acreditaria na classificação errada. O laudo continua registrado no
 * manifesto da solicitação (o parceiro tem), só não vira linha em `documentos`.
 *
 * Achado catalogado: criar o tipo `laudo_medico` no enum exige migration, e migration não
 * entra de passagem numa tarefa de integração.
 */
const TRADUCAO: Partial<Record<DocumentoDoFluxo, string>> = {
  receita_medica: 'receita_medica',
  comprovante_residencia: 'comprovante_residencia',
  autorizacao_anvisa: 'autorizacao_anvisa',
  documento_identidade: 'rg',
  // laudo_medico: sem destino — ver o bloco acima.
};

export async function materializarDocumentosDoParceiro(params: {
  pacienteId: string;
  documentosDoParceiro: unknown;
  protocolo: string;
}): Promise<{ inseridos: number }> {
  try {
    const lista = Array.isArray(params.documentosDoParceiro) ? params.documentosDoParceiro : [];
    const arquivos = lista.filter(ehArquivo);
    if (arquivos.length === 0) return { inseridos: 0 };

    const linhas = arquivos
      .filter((a) => !!TRADUCAO[a.tipo as DocumentoDoFluxo])
      .map((a) => {
        /**
         * 🔴 A DATA NÃO SE INVENTA.
         *
         * `dataEmissao` e `dataValidade` são `notNull`. Quando o parceiro informa a emissão,
         * é ela que vale. Quando não informa — e não informar é normal, nem todo sistema
         * guarda essa data —, gravamos a data em que o documento CHEGOU e dizemos isso na
         * observação. Registrar o que se sabe é diferente de fingir o que não se sabe.
         *
         * A validade sai de `calcularValidade`, a mesma regra que o upload manual usa:
         * ANVISA 24 meses, receita 6, o resto sem validade prática. Uma segunda regra aqui
         * seria uma segunda verdade sobre o mesmo documento.
         */
        const informou = !!a.dataEmissao;
        const dataEmissao = a.dataEmissao ?? HOJE();
        const tipoAqui = TRADUCAO[a.tipo as DocumentoDoFluxo]!;
        return {
          pacienteId: params.pacienteId,
          tipo: tipoAqui as 'receita_medica',
          urlBlob: a.urlBlob,
          nomeArquivo: a.nomeArquivo,
          dataEmissao,
          dataValidade: calcularValidade(tipoAqui, dataEmissao),
          observacoes: informou
            ? `Recebido do parceiro · protocolo ${params.protocolo}`
            : `Recebido do parceiro · protocolo ${params.protocolo} · data de emissão não informada pelo parceiro; a data acima é a do recebimento`,
        };
      });

    if (linhas.length === 0) return { inseridos: 0 };

    await db.insert(documentos).values(linhas);
    return { inseridos: linhas.length };
  } catch (erro) {
    console.error(
      '[parceiros] falha ao materializar documentos:',
      erro instanceof Error ? erro.name : 'erro',
    );
    return { inseridos: 0 };
  }
}
