/**
 * O QUE AINDA FALTA — lido do que o paciente TEM, não do que alguém declarou.
 *
 * 🔴 O ACHADO, 11/09/2026. Palavras do dono, olhando o próprio painel depois de se cadastrar
 * pelo fluxo da Greens: _"o local dos meus documentos não está diferenciado por todos que a
 * BeHemp tem, no caso um cadastro completo"_.
 *
 * A tela dizia **"Nenhum documento enviado ainda"** e parava aí. Quem chega sem saber o que a
 * BeHemp espera não descobre pela tela: ela informa a ausência sem informar a expectativa.
 *
 * ⚠️ DERIVA DO ESTADO REAL, e essa é a diferença que importa. O manifesto do parceiro diz o
 * que a Greens **afirma** ter mandado; esta função olha a tabela `documentos`. Quando o
 * documento chega mas a materialização falha — e ela **nunca lança**, por decisão
 * (`materializar-documentos.ts:118`) —, o manifesto continua dizendo que veio e o paciente
 * continua sem o arquivo. Só o estado real mostra o buraco.
 *
 * 🔴 A TRADUÇÃO DE VOCABULÁRIO ACONTECE AQUI, e não pode ser esquecida: o fluxo fala
 * `documento_identidade`, a coluna `documentos.tipo` guarda `rg`. Sem traduzir, um RG
 * enviado apareceria como pendente para sempre. A fonte é a mesma que a materialização
 * usa — nunca uma segunda lista, que é o que desatualiza e mente.
 *
 * ⚠️ AVISA, NÃO BLOQUEIA. Pendência aqui é informação: o paciente segue para a consulta e
 * para a ANVISA com documento faltando, e manda depois. É a mesma decisão do `AvisoDaProcuracao`
 * e da ADR-0016 D-06 — _"o que não veio fica pendente, e pendência não bloqueia"_.
 */

import {
  DOCUMENTOS_DO_FLUXO,
  DOCUMENTOS_OPCIONAIS,
  DOCUMENTOS_QUE_RESOLVEMOS,
  rotuloDoDocumento,
  type DocumentoDoFluxo,
} from '@/lib/parceiros/documentos';

/**
 * Do vocabulário do fluxo para o da coluna `documentos.tipo`.
 *
 * 🔴 Espelha `lib/parceiros/materializar-documentos.ts` DE PROPÓSITO, e o guarda exige que os
 * dois concordem: se um ganhar um tipo e o outro não, o documento entra no banco com um nome
 * e é procurado com outro — e o paciente vê pendente o que já mandou.
 *
 * `laudo_medico` não tem destino: o enum `documento_tipo` não o declara, e criar o valor exige
 * migration (achado catalogado). Ele é **opcional**, então some da lista em vez de ficar
 * eternamente pendente.
 */
const NA_TABELA: Partial<Record<DocumentoDoFluxo, string>> = {
  receita_medica: 'receita_medica',
  comprovante_residencia: 'comprovante_residencia',
  autorizacao_anvisa: 'autorizacao_anvisa',
  documento_identidade: 'rg',
};

export interface ItemDoChecklist {
  /** A chave do fluxo — `documento_identidade`, não `rg`. */
  chave: DocumentoDoFluxo;
  /** Como a coluna `documentos.tipo` o chama. */
  tipoNaTabela: string;
  rotulo: string;
  /** `true` quando existe linha em `documentos` para este tipo. */
  temNoBanco: boolean;
  /** Faltar é aceitável — `laudo_medico`. */
  opcional: boolean;
  /** A consulta ou a procuração resolvem — não precisa correr atrás. */
  resolvemosAqui: boolean;
}

/**
 * O checklist inteiro: o que a BeHemp espera, e o que o paciente já tem.
 *
 * @param tiposNoBanco os valores de `documentos.tipo` que o paciente possui hoje
 */
export function checklistDosDocumentos(tiposNoBanco: readonly string[]): ItemDoChecklist[] {
  const tem = new Set(tiposNoBanco);

  return DOCUMENTOS_DO_FLUXO.filter((chave) => NA_TABELA[chave] !== undefined).map((chave) => {
    const tipoNaTabela = NA_TABELA[chave] as string;
    return {
      chave,
      tipoNaTabela,
      rotulo: rotuloDoDocumento(chave),
      temNoBanco: tem.has(tipoNaTabela),
      opcional: DOCUMENTOS_OPCIONAIS.includes(chave),
      resolvemosAqui: DOCUMENTOS_QUE_RESOLVEMOS.includes(chave),
    };
  });
}

/** Só o que falta, e que não é opcional — é o que a tela destaca. */
export function faltamNoPainel(tiposNoBanco: readonly string[]): ItemDoChecklist[] {
  return checklistDosDocumentos(tiposNoBanco).filter((i) => !i.temNoBanco && !i.opcional);
}
