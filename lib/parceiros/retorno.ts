/**
 * PARA ONDE PODEMOS DEVOLVER O PACIENTE.
 *
 * 🔴 POR QUE ISTO NÃO É "SÓ GUARDAR A URL QUE O PARCEIRO MANDOU"
 * Aceitar destino arbitrário é **redirecionamento aberto** (OWASP: Unvalidated Redirects
 * and Forwards). O ataque não é técnico, é de confiança: a vítima vê um link do NOSSO
 * domínio, clica porque confia em nós, e aterrissa numa página que o atacante controla —
 * frequentemente uma cópia da nossa tela de login.
 *
 * E aqui o alvo é um paciente que acabou de criar conta e ainda está no fluxo: é
 * exatamente o momento em que ele digitaria a senha de novo sem estranhar.
 *
 * A defesa é lista de permitidos por **origem** (esquema + host + porta), não por
 * "começa com". `https://greens-corp.com.evil.tld` começa com o nosso domínio e não é
 * ele — comparar prefixo de string é a forma clássica de errar isto.
 */

/** Origens que podem receber o paciente de volta. Configurável por ambiente. */
function origensPermitidas(): string[] {
  return (process.env.PARCEIRO_ORIGENS_DE_RETORNO ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

/**
 * Devolve a URL se ela for permitida, `null` se não for.
 *
 * ⚠️ Devolver `null` em vez de lançar é deliberado: uma URL de retorno recusada não pode
 * derrubar o cadastro do paciente. Ele fica sem o botão de volta — inconveniente — em vez
 * de não conseguir se cadastrar.
 */
export function urlDeRetornoPermitida(cru: string | null | undefined): string | null {
  const valor = cru?.trim();
  if (!valor) return null;

  let alvo: URL;
  try {
    alvo = new URL(valor);
  } catch {
    return null;
  }

  /**
   * Só HTTPS.
   *
   * ⚠️ ESTA LINHA É REDUNDANTE HOJE, e está aqui de propósito — descoberto por sabotagem:
   * removê-la não muda resultado nenhum, porque a lista de origens já recusa tudo que
   * não seja HTTPS (`javascript:` tem `origin` igual a `"null"`, e `http://x` tem origem
   * diferente de `https://x`).
   *
   * Ela existe para o dia em que alguém puser um `http://` na lista de permitidas — em
   * desenvolvimento, por conveniência — e esse valor vazar para produção. Aí ela é a
   * única coisa entre o paciente e um retorno sem TLS.
   */
  if (alvo.protocol !== 'https:') return null;

  const permitidas = origensPermitidas();
  /**
   * ⚠️ Também redundante hoje (uma lista vazia faz o `includes` abaixo devolver `false`),
   * e mantida pelo mesmo motivo: torna a falha fechada **explícita**. Quem ler este
   * arquivo não precisa deduzir o comportamento a partir de `[].includes()`.
   */
  if (permitidas.length === 0) return null;

  // Comparação por ORIGEM inteira — nunca por prefixo de string.
  return permitidas.includes(alvo.origin) ? alvo.toString() : null;
}
