/**
 * O MANIFESTO DE DOCUMENTOS QUE O BOT DECLARA — lido da query string.
 *
 * 🔴 O BURACO QUE ISTO FECHA, medido em 11/09/2026.
 *
 * O `bot-link` aceitava `sessionId`, `leadId`, nome, e-mail e telefone — e mais nada. Sem
 * manifesto, a solicitação nascia com `documentosDoParceiro` nulo, e `pendenciasDe(null)`
 * devolve **os cinco documentos como pendentes**. Ou seja: todo paciente que chegava pelo bot
 * era tratado como se não tivesse nada.
 *
 * Isso colapsava a distinção entre os oito fluxos. O paciente de recompra (Greens 3), que tem
 * tudo, via a mesma tela do paciente novo (BeHemp 4) — e o destino depois do cadastro, que sai
 * do que **falta** (ADR-0021 D-01), mandava os dois para o agendamento.
 *
 * ⚠️ ISTO É DECLARAÇÃO, NÃO PROVA — e a diferença importa.
 *
 * O handoff (E1) manda o manifesto **com os arquivos**, que são re-hospedados aqui. O bot
 * manda só os nomes: é o que o atendimento apurou na conversa. A lista de
 * `documentosDoParceiro` já é mista por desenho (nome puro para o declarado, objeto para o
 * que veio com arquivo), então os dois casos convivem sem tipo novo.
 *
 * 🔴 E O PACIENTE CONTINUA PODENDO CORRIGIR. Um manifesto errado dizendo "tem receita" faria
 * a pergunta sumir da tela — por isso `perguntarSobreReceita` e `perguntarSobreAnvisa` seguem
 * derivando das pendências, e a regra que já vale no cadastro (_"a resposta do paciente vence
 * a base"_, a mesma de `a-triagem-roteia-e-nao-julga`) continua sendo a última palavra.
 */

import { DOCUMENTOS_DO_FLUXO, type DocumentoDoFluxo } from '@/lib/parceiros/documentos';

/**
 * Os nomes de parâmetro aceitos, em ordem de preferência.
 *
 * Mais de um porque quem preenche é o construtor de fluxo do ChatPro, na mão — e um campo com
 * nome único é um campo com uma única chance de acertar.
 */
export const PARAMETROS_DO_MANIFESTO = ['tem', 'documentos', 'docs'] as const;

export interface ManifestoLido {
  /** Só as chaves reconhecidas. Vazio quando nada veio — e vazio NÃO é "não tem nada". */
  documentos: DocumentoDoFluxo[];
  /** O que veio e não foi reconhecido. Serve ao log, nunca à decisão. */
  ignorados: string[];
  /** `false` quando nenhum dos parâmetros apareceu na URL. */
  declarado: boolean;
}

const CONHECIDOS = new Set<string>(DOCUMENTOS_DO_FLUXO);

/**
 * Lê o manifesto de uma query string.
 *
 * 🔴 CHAVE DESCONHECIDA É IGNORADA, NÃO REJEITADA. Recusar a chamada por causa de um typo no
 * painel derrubaria o atendimento inteiro — e a resposta não-2xx do `bot-link` transfere o
 * paciente para uma pessoa. Um documento a menos no manifesto vira uma pergunta a mais na
 * tela; a chamada recusada vira paciente sem link.
 *
 * ⚠️ E ausência é diferente de lista vazia. `?tem=` (vazio) e nenhum parâmetro são as duas
 * formas de "o bot não declarou nada" — nos dois casos `declarado` é falso, e quem grava não
 * pode apagar um manifesto que já existia.
 */
export function lerManifestoDaUrl(params: URLSearchParams): ManifestoLido {
  let bruto: string | null = null;
  for (const nome of PARAMETROS_DO_MANIFESTO) {
    const valores = params.getAll(nome).filter((v) => v.trim());
    if (valores.length > 0) {
      bruto = valores.join(',');
      break;
    }
  }

  if (bruto === null) return { documentos: [], ignorados: [], declarado: false };

  const documentos: DocumentoDoFluxo[] = [];
  const ignorados: string[] = [];

  for (const pedaco of bruto.split(',')) {
    // Aceita `receita-medica` e `Receita_Medica` — o painel é preenchido à mão.
    const chave = pedaco.trim().toLowerCase().replace(/-/g, '_');
    if (!chave) continue;
    if (CONHECIDOS.has(chave)) {
      if (!documentos.includes(chave as DocumentoDoFluxo)) {
        documentos.push(chave as DocumentoDoFluxo);
      }
    } else if (!ignorados.includes(chave)) {
      ignorados.push(chave);
    }
  }

  return { documentos, ignorados, declarado: documentos.length > 0 };
}
