/**
 * QUAL INSTÂNCIA DO CLERK ESTÁ RODANDO — e o alarme quando é a errada.
 *
 * 🔴 MEDIDO EM PRODUÇÃO EM 13/09/2026, e é a causa raiz do Fluxo 1 · Portão 1:
 *
 *     publishable: pk_test_…
 *     secret:      sk_test_…
 *
 * **O be4hope.org roda com a instância de DESENVOLVIMENTO do Clerk.** E a tela do dono
 * confirmava — "Development mode" no rodapé do componente.
 *
 * ## Por que isso quebra o cadastro, e não só "não é ideal"
 *
 * | | desenvolvimento | produção |
 * | - | --------------- | -------- |
 * | FAPI | `accounts.dev` — **cross-site** | subdomínio seu — same-site |
 * | bot protection | compartilhada entre todos os apps do Clerk | sua |
 * | cookies | bloqueados por navegador com proteção de rastreamento | funcionam |
 *
 * 🔴 Navegador que bloqueia cookie cross-site (Firefox com proteção estrita, Safari, Brave)
 * faz o `signUp.create` responder **400**. O cadastro morre antes de criar a conta — e isso
 * encaixa com o número que ninguém explicava: **35 links da Greens, ZERO cadastros concluídos.**
 *
 * ⚠️ Nenhum dos becos que corrigimos em 13/09 chega a ser exercitado: o fluxo morre antes.
 *
 * ## O que esta função NÃO faz
 *
 * ⛔ **Não bloqueia nada.** Trocar a instância exige DNS e acesso ao painel do Clerk, que o dono
 * não tem hoje. Derrubar o app por isso deixaria o site fora do ar sem resolver — e a instância
 * de desenvolvimento **funciona** na maioria dos navegadores. O que ela faz é impedir que o
 * estado continue invisível.
 */

export type TipoDeInstancia = 'desenvolvimento' | 'producao' | 'desconhecida';

/** O prefixo da chave diz a instância. `pk_test_`/`sk_test_` = desenvolvimento. */
export function tipoDaInstancia(chave: string | undefined | null): TipoDeInstancia {
  const valor = chave?.trim() ?? '';
  if (!valor) return 'desconhecida';
  if (valor.startsWith('pk_test_') || valor.startsWith('sk_test_')) return 'desenvolvimento';
  if (valor.startsWith('pk_live_') || valor.startsWith('sk_live_')) return 'producao';
  return 'desconhecida';
}

/**
 * `true` quando o ambiente é de produção e a instância do Clerk não é.
 *
 * 🔴 É a combinação que produz o `400` silencioso: o app se comporta como produção, e o Clerk
 * responde como desenvolvimento.
 */
export function instanciaDivergeDoAmbiente(params: {
  publishable: string | undefined | null;
  nodeEnv: string | undefined;
}): boolean {
  return (
    params.nodeEnv === 'production' && tipoDaInstancia(params.publishable) === 'desenvolvimento'
  );
}

/**
 * O aviso, para quem olha o log do servidor.
 *
 * ⚠️ **NUNCA imprime a chave** — só o prefixo, que é público por natureza (`pk_` é publishable,
 * e viaja para o navegador em toda página). A `sk_` nem é lida aqui.
 */
export function avisarSeInstanciaDivergir(): void {
  const publishable = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!instanciaDivergeDoAmbiente({ publishable, nodeEnv: process.env.NODE_ENV })) return;

  console.warn(
    '[clerk] ⚠️ INSTÂNCIA DE DESENVOLVIMENTO EM PRODUÇÃO — o FAPI fica em accounts.dev ' +
      '(cross-site), e navegador que bloqueia cookie de terceiro faz signUp.create responder 400. ' +
      'É a causa conhecida de cadastro que não conclui. Ver lib/auth/instancia-do-clerk.ts',
  );
}
