import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * ASSINATURA DAS CHAMADAS ENTRE A GREENS E A BEHEMP.
 *
 * POR QUE HMAC AQUI, SE O CHATPRO NÃO TEM
 * O ChatPro não assina os webhooks — a documentação não menciona HMAC, segredo de corpo
 * nem IPs de origem. Por isso `lib/chatpro/` foi construído em torno da confirmação
 * reversa: o payload é ponteiro, e a verdade vem de uma chamada autenticada de volta.
 *
 * Aqui é o oposto: **nós escrevemos os dois lados**. Onde dá para provar autenticidade e
 * integridade de verdade, prova-se — e sobra a confirmação reversa para quem não permite.
 *
 * 🔴 O QUE A ASSINATURA COBRE, E POR QUE CADA PARTE ESTÁ NELA
 *
 *   corpo      → se alguém trocar um dígito do CPF, a assinatura não bate
 *   timestamp  → sem ele, um envelope legítimo capturado hoje vale para sempre
 *   id         → é a chave de idempotência, e precisa ser tão inviolável quanto o resto
 *
 * Assinar só o corpo deixaria o replay aberto; assinar só o timestamp deixaria o corpo
 * livre. Os três juntos, no mesmo cálculo.
 *
 * Referência: Standard Webhooks / Stripe / Svix — HMAC-SHA256 sobre id + timestamp +
 * corpo, com tolerância de 300 s.
 */

/**
 * Cinco minutos, o valor do Standard Webhooks (Stripe e Svix usam o mesmo).
 *
 * Não é arbitrário: precisa ser maior que a diferença de relógio esperada entre dois
 * servidores e menor que a janela em que um atacante conseguiria capturar e reenviar.
 */
export const TOLERANCIA_EM_SEGUNDOS = 300;

export interface CabecalhosDaAssinatura {
  id: string;
  timestamp: string;
  assinatura: string;
}

export type MotivoDeRecusa =
  | 'cabecalho_ausente'
  | 'timestamp_invalido'
  | 'fora_da_janela'
  | 'assinatura_invalida'
  | 'sem_segredo';

/**
 * Monta a mensagem que será assinada.
 *
 * ⚠️ O FORMATO É PARTE DO CONTRATO. Os dois lados precisam concatenar exatamente igual —
 * um separador diferente produz assinaturas diferentes para o mesmo conteúdo, e o sintoma
 * é "assinatura inválida" sem nenhuma pista do motivo.
 */
export function mensagemAssinada(id: string, timestamp: string, corpoCru: string): string {
  return `${id}.${timestamp}.${corpoCru}`;
}

export function assinar(id: string, timestamp: string, corpoCru: string, segredo: string): string {
  return createHmac('sha256', segredo)
    .update(mensagemAssinada(id, timestamp, corpoCru))
    .digest('hex');
}

/**
 * VERIFICA A CHAMADA.
 *
 * 🔴 A COMPARAÇÃO É EM TEMPO CONSTANTE. `===` em string retorna no primeiro caractere
 * diferente, e a diferença de tempo é mensurável pela rede — dá para descobrir a
 * assinatura correta byte a byte. O mesmo cuidado de `lib/chatpro/segredo.ts`.
 *
 * 🔴 E A JANELA É CONFERIDA ANTES. Uma assinatura válida de três dias atrás continua
 * válida para sempre se ninguém olhar o relógio: é o ataque de replay, e ele é o único
 * que a assinatura sozinha não impede.
 */
export function verificarAssinatura(params: {
  cabecalhos: CabecalhosDaAssinatura;
  corpoCru: string;
  segredo: string | undefined;
  agoraEmSegundos?: number;
}): { valida: true } | { valida: false; motivo: MotivoDeRecusa } {
  const { cabecalhos, corpoCru, segredo } = params;

  if (!segredo?.trim()) return { valida: false, motivo: 'sem_segredo' };
  if (!cabecalhos.id?.trim() || !cabecalhos.timestamp?.trim() || !cabecalhos.assinatura?.trim()) {
    return { valida: false, motivo: 'cabecalho_ausente' };
  }

  const enviadoEm = Number(cabecalhos.timestamp);
  if (!Number.isFinite(enviadoEm)) return { valida: false, motivo: 'timestamp_invalido' };

  const agora = params.agoraEmSegundos ?? Math.floor(Date.now() / 1000);
  // Math.abs cobre os DOIS lados: relógio adiantado do remetente é tão suspeito quanto
  // atrasado, e um carimbo no futuro é a forma mais simples de esticar a janela.
  if (Math.abs(agora - enviadoEm) > TOLERANCIA_EM_SEGUNDOS) {
    return { valida: false, motivo: 'fora_da_janela' };
  }

  const esperada = assinar(cabecalhos.id, cabecalhos.timestamp, corpoCru, segredo);
  const recebida = cabecalhos.assinatura.trim().replace(/^sha256=/i, '');

  // Comprimentos diferentes fazem timingSafeEqual LANÇAR — e a checagem de tamanho não
  // vaza nada útil: o tamanho de um hex de SHA-256 é público (64 caracteres).
  if (recebida.length !== esperada.length) return { valida: false, motivo: 'assinatura_invalida' };

  const conferem = timingSafeEqual(Buffer.from(recebida, 'utf8'), Buffer.from(esperada, 'utf8'));
  return conferem ? { valida: true } : { valida: false, motivo: 'assinatura_invalida' };
}

/** Lê os três cabeçalhos do request. Nomes fixos — fazem parte do contrato. */
export function lerCabecalhos(headers: Headers): CabecalhosDaAssinatura {
  return {
    id: headers.get('x-parceiro-evento-id') ?? '',
    timestamp: headers.get('x-parceiro-timestamp') ?? '',
    assinatura: headers.get('x-parceiro-assinatura') ?? '',
  };
}
