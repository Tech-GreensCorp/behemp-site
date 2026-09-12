/**
 * O DESTINO DEPOIS DO LOGIN SÓ PODE SER UMA TELA NOSSA.
 *
 * 🔴 POR QUE ISTO EXISTE, 12/09/2026. A tela de login lê `?redirect_url=` da URL e o entrega
 * ao `forceRedirectUrl` do Clerk. Esse valor é **entrada do usuário**: quem monta o link
 * escolhe o destino. Um `/entrar?redirect_url=https://site-falso.com` leva o paciente para
 * fora **depois** de ele digitar a senha — e o link saiu do domínio verdadeiro, com cadeado,
 * então não há nada que o denuncie.
 *
 * É **redirecionamento aberto** (OWASP A01), e o repositório já tratou a mesma classe do lado
 * do parceiro: `handoff-do-parceiro-e-assinado-e-idempotente` tem um caso inteiro sobre a URL
 * de retorno ser conferida por **origem** e nunca por prefixo, porque
 * `https://be4hope.org.site-falso.com` começa com o prefixo certo.
 *
 * ⚠️ AQUI A REGRA É MAIS SIMPLES E MAIS DURA: não há destino externo legítimo depois do
 * login. Só caminho interno, e só o que começa com **uma** barra.
 *
 * 🔴 `//site-falso.com` É O CASO QUE PEGA QUEM CONFERE SÓ A PRIMEIRA BARRA. O navegador lê
 * isso como URL **protocol-relative** e vai para o host, não para uma pasta. `new URL()` com
 * base confirma: o `origin` muda. Por isso a segunda barra é recusada explicitamente.
 */

/** Para onde a pessoa vai quando não pediu nada, ou pediu algo inaceitável. */
export const DESTINO_PADRAO = '/redirect';

export function destinoInternoSeguro(cru: string | null | undefined): string {
  const valor = cru?.trim();
  if (!valor) return DESTINO_PADRAO;

  // Precisa ser caminho absoluto nosso. `https://…`, `javascript:` e `/\evil.com` caem aqui.
  if (!valor.startsWith('/')) return DESTINO_PADRAO;

  /**
   * `//host` e `/\host` são protocol-relative: o navegador troca de site. A barra invertida
   * entra porque alguns navegadores a normalizam para barra.
   */
  if (valor.startsWith('//') || valor.startsWith('/\\')) return DESTINO_PADRAO;

  /**
   * A prova final, e a que não depende de eu ter lembrado de todas as formas: montar a URL
   * contra uma base e exigir que a origem **não** tenha mudado.
   */
  try {
    const base = 'https://be4hope.org';
    if (new URL(valor, base).origin !== base) return DESTINO_PADRAO;
  } catch {
    return DESTINO_PADRAO;
  }

  return valor;
}
