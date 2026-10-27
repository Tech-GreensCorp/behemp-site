/**
 * Regras PURAS do registro manual da assinatura do comunicado — sem banco, sem rede, sem Next.
 *
 * Moram à parte de `assinatura.ts` para que o guarda as execute sem `DATABASE_URL`.
 *
 * O registro manual existe para o caso em que o paciente assinou a carta por OUTRA plataforma e
 * mandou o arquivo (WhatsApp). O arquivo vem de fora do sistema, então a confiança que o
 * DocuSign dava não existe: o servidor confere o que pode — o tipo declarado E a assinatura dos
 * bytes — e o resto é atestado do admin, que fica registrado.
 */

/** Um documento assinado, não um vídeo: 10 MB cobrem um PDF escaneado e uma foto de celular. */
export const LIMITE_DO_ARQUIVO_MANUAL = 10 * 1024 * 1024;

export interface ArquivoDaAssinatura {
  contentType: 'application/pdf' | 'image/jpeg' | 'image/png';
  extensao: 'pdf' | 'jpg' | 'png';
}

const TIPOS: ReadonlyArray<ArquivoDaAssinatura & { assinatura: readonly number[] }> = [
  { contentType: 'application/pdf', extensao: 'pdf', assinatura: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { contentType: 'image/png', extensao: 'png', assinatura: [0x89, 0x50, 0x4e, 0x47] }, // \x89PNG
  { contentType: 'image/jpeg', extensao: 'jpg', assinatura: [0xff, 0xd8, 0xff] },
];

/**
 * O tipo do arquivo, ou `null` se não for aceito.
 *
 * 🔴 Só o `file.type` NÃO basta: ele vem do navegador de quem envia e não prova nada. Aceita
 * quando o tipo declarado é um dos três E os primeiros bytes são os desse tipo — um executável
 * declarado como PDF, ou um PNG declarado como PDF, é recusado.
 */
export function identificarArquivoDaAssinatura(
  conteudo: Uint8Array,
  tipoDeclarado: string,
): ArquivoDaAssinatura | null {
  const tipo = TIPOS.find((t) => t.contentType === tipoDeclarado);
  if (!tipo || conteudo.length === 0) return null;
  const confere = tipo.assinatura.every((byte, i) => conteudo[i] === byte);
  return confere ? { contentType: tipo.contentType, extensao: tipo.extensao } : null;
}

export type ResultadoDaData = { ok: true; data: Date } | { ok: false; erro: string };

/** A data de hoje em Brasília, `AAAA-MM-DD` — "hoje" do paciente, não o do servidor em UTC. */
function hojeEmBrasilia(agora: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora);
}

/**
 * A data em que o paciente assinou, informada pelo admin (`AAAA-MM-DD`).
 *
 * Não pode estar no futuro e tem de ser um dia que existe (`2026-02-30` é recusado). Devolve ao
 * MEIO-DIA de Brasília: um `Date` à meia-noite UTC cairia no dia anterior na tela.
 */
export function validarDataDaAssinatura(texto: string, agora: Date = new Date()): ResultadoDaData {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto.trim());
  if (!m) return { ok: false, erro: 'Informe a data da assinatura.' };

  const [, ano, mes, dia] = m;
  const data = new Date(`${ano}-${mes}-${dia}T12:00:00-03:00`);
  const existe =
    !Number.isNaN(data.getTime()) &&
    // `new Date('2026-02-30…')` vira 2 de março em vez de falhar: o dia tem de voltar igual.
    data.toISOString().slice(0, 10) === `${ano}-${mes}-${dia}`;
  if (!existe) return { ok: false, erro: 'A data da assinatura é inválida.' };

  if (`${ano}-${mes}-${dia}` > hojeEmBrasilia(agora)) {
    return { ok: false, erro: 'A data da assinatura não pode estar no futuro.' };
  }
  return { ok: true, data };
}
