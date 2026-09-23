/**
 * O `state` DO OAUTH DO MERCADO PAGO — assinado, com janela, e ligado ao médico.
 *
 * 🔴 POR QUE ASSINADO, E O QUE ISSO IMPEDE
 *
 * O OAuth do Google Calendar deste repositório manda `state: medicoId` **cru**
 * (`app/api/auth/google/callback/route.ts`): qualquer um forja esse parâmetro. O ataque
 * concreto não é teórico — chama-se **CSRF de OAuth**, e aqui ele move dinheiro:
 *
 *   1. o atacante inicia o fluxo na conta de Mercado Pago DELE e captura o `code`
 *   2. induz o navegador do médico (logado) a bater no nosso callback com aquele `code`
 *   3. sem vínculo, a linha do médico passa a apontar para a conta do atacante
 *   4. o pagamento das consultas daquele médico cai na conta do atacante
 *
 * ⚠️ E **HMAC sozinho não impede isso**: o atacante pode iniciar o fluxo pela nossa rota
 * `/conectar` e receber um `state` legitimamente assinado — para ele mesmo. O que fecha o
 * buraco é o callback exigir que o `medicoId` do state seja **o mesmo da sessão**, e essa
 * conferência mora em `app/api/medico/mercadopago/callback/route.ts`.
 *
 * As duas camadas juntas: a assinatura impede forjar, a sessão impede reusar.
 *
 * ## Sobre a orientação da doc do Mercado Pago
 *
 * A doc oficial diz que o `state` é _"an identifier that is unique for each attempt and
 * does not include sensitive information"_. O `medicoId` é um CUID2 interno — não é nome,
 * CPF nem CRM —, e viaja na URL. Carregá-lo é escolha consciente: sem ele o callback não
 * teria com o que comparar a sessão, e a comparação é o que fecha o ataque acima.
 *
 * ## O que a assinatura cobre, e por que cada parte está nela
 *
 *   medicoId   → é o que o callback compara com a sessão
 *   timestamp  → sem ele, um state legítimo capturado hoje valeria para sempre
 *   nonce      → dois pedidos do mesmo médico no mesmo segundo geram states diferentes
 *
 * Estrutura, separador e comparação em tempo constante copiados de
 * `lib/parceiros/assinatura.ts`. As funções de lá não servem por assinatura: elas esperam
 * `(id, timestamp, corpoCru, segredo)`, desenhadas para webhook com corpo — e o `state`
 * não tem corpo.
 *
 * 🛑 Módulo PURO — sem `db`, sem `auth`, sem `next/*`.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Dez minutos — e o número não é arbitrário: é a validade do próprio `code` do Mercado
 * Pago, segundo a doc oficial. Uma janela maior que a do MP não compra nada; menor
 * recusaria fluxos que o MP ainda aceitaria.
 *
 * É mais larga que os 300 s de `lib/parceiros/assinatura.ts` de propósito: lá são dois
 * servidores conversando, aqui é uma pessoa navegando no site do Mercado Pago.
 */
export const JANELA_DO_STATE_EM_SEGUNDOS = 600;

export type MotivoDeRecusaDoState =
  | 'sem_segredo'
  | 'formato_invalido'
  | 'timestamp_invalido'
  | 'fora_da_janela'
  | 'assinatura_invalida';

export type VerificacaoDoState =
  | { valido: true; medicoId: string }
  | { valido: false; motivo: MotivoDeRecusaDoState };

/**
 * ⚠️ O FORMATO É PARTE DO CONTRATO consigo mesmo: quem monta e quem confere precisam
 * concatenar exatamente igual. Um separador diferente produz assinatura diferente para o
 * mesmo conteúdo, e o sintoma é "assinatura inválida" sem nenhuma pista do motivo.
 */
function mensagem(medicoId: string, timestamp: string, nonce: string): string {
  return `${medicoId}.${timestamp}.${nonce}`;
}

function assinar(medicoId: string, timestamp: string, nonce: string, segredo: string): string {
  return createHmac('sha256', segredo)
    .update(mensagem(medicoId, timestamp, nonce))
    .digest('hex');
}

/**
 * O segredo do HMAC.
 *
 * 🔴 DERIVADO da chave de cifra, não uma variável nova. Duas razões:
 *
 *   1. menos um secret para cadastrar, esquecer e descobrir ausente em produção — esta
 *      classe de falha já aconteceu três vezes neste repositório;
 *   2. **poderes diferentes não dividem chave**: derivar com um rótulo fixo garante que
 *      este segredo não é a chave de cifra, então vazá-lo não decifra token nenhum.
 *
 * A derivação é HMAC com rótulo — o mesmo princípio de `HKDF-Expand` com `info`.
 */
function segredoDoState(): string | null {
  const chave = process.env.MERCADOPAGO_TOKEN_ENCRYPTION_KEY?.trim();
  if (!chave) return null;
  return createHmac('sha256', chave).update('mercadopago.oauth.state.v1').digest('hex');
}

/** `true` quando dá para assinar — para a tela dizer "não configurado" sem lançar. */
export function stateConfigurado(): boolean {
  return segredoDoState() !== null;
}

/**
 * Monta o `state` para a URL de autorização.
 *
 * Formato: `<medicoId>.<timestamp>.<nonce>.<assinatura>`
 *
 * O `medicoId` é um CUID2 (alfanumérico, sem ponto), então o ponto é separador seguro —
 * mas a leitura usa `split` com limite pelo FIM, não pelo começo, para nunca depender
 * disso em silêncio.
 */
export function gerarState(medicoId: string, agoraEmSegundos?: number): string {
  const segredo = segredoDoState();
  if (!segredo) {
    throw new Error(
      'MERCADOPAGO_TOKEN_ENCRYPTION_KEY ausente — o state do OAuth não pode ser assinado. ' +
        'Sem assinatura o fluxo fica aberto a CSRF de OAuth; ver lib/mercadopago/state.ts',
    );
  }
  if (!medicoId?.trim()) throw new Error('gerarState: medicoId vazio');

  const timestamp = String(agoraEmSegundos ?? Math.floor(Date.now() / 1000));
  const nonce = randomBytes(16).toString('hex');
  return `${medicoId}.${timestamp}.${nonce}.${assinar(medicoId, timestamp, nonce, segredo)}`;
}

/**
 * Confere o `state` que voltou do Mercado Pago.
 *
 * 🔴 A JANELA É CONFERIDA ANTES DA ASSINATURA — de propósito, e é o inverso do que a
 * intuição pede. Conferir a assinatura primeiro e só então o prazo conta a quem forjou que
 * a assinatura estava certa e só o tempo passou. A ordem daqui não distingue os dois casos
 * para quem está de fora.
 */
export function verificarState(state: string, agoraEmSegundos?: number): VerificacaoDoState {
  const segredo = segredoDoState();
  if (!segredo) return { valido: false, motivo: 'sem_segredo' };
  if (!state?.trim()) return { valido: false, motivo: 'formato_invalido' };

  // Divide pelo FIM: assinatura e nonce têm tamanho fixo, o medicoId é o que sobra.
  const partes = state.split('.');
  if (partes.length !== 4) return { valido: false, motivo: 'formato_invalido' };
  const [medicoId, timestamp, nonce, recebida] = partes;
  if (!medicoId || !timestamp || !nonce || !recebida) {
    return { valido: false, motivo: 'formato_invalido' };
  }

  const emitidoEm = Number(timestamp);
  if (!Number.isFinite(emitidoEm)) return { valido: false, motivo: 'timestamp_invalido' };

  const agora = agoraEmSegundos ?? Math.floor(Date.now() / 1000);
  // Math.abs cobre os dois lados: um carimbo no futuro é a forma mais simples de esticar
  // a janela, e relógio adiantado é tão suspeito quanto atrasado.
  if (Math.abs(agora - emitidoEm) > JANELA_DO_STATE_EM_SEGUNDOS) {
    return { valido: false, motivo: 'fora_da_janela' };
  }

  const esperada = assinar(medicoId, timestamp, nonce, segredo);
  // Tamanhos diferentes fazem `timingSafeEqual` LANÇAR, e o tamanho de um hex de SHA-256
  // é público (64 caracteres) — conferi-lo não vaza nada.
  if (recebida.length !== esperada.length) return { valido: false, motivo: 'assinatura_invalida' };

  const conferem = timingSafeEqual(Buffer.from(recebida, 'utf8'), Buffer.from(esperada, 'utf8'));
  return conferem ? { valido: true, medicoId } : { valido: false, motivo: 'assinatura_invalida' };
}
