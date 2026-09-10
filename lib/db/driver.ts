/**
 * A decisão de qual driver usar — em módulo PURO, de propósito.
 *
 * 🔴 POR QUE ISTO NÃO MORA EM `lib/db/index.ts`
 * Porque `index.ts` **executa** ao ser importado: ele lê `process.env.DATABASE_URL` e abre a
 * conexão no topo do módulo. Um guarda que quisesse testar só a decisão precisava importar o
 * arquivo inteiro — e sem `DATABASE_URL` no ambiente do runner, o módulo estourava antes de
 * exportar qualquer coisa: *"No database connection string was provided to `neon()`"*.
 *
 * O sintoma foi pior que o erro: o Vitest reportava `Test Files 1 failed` e, na mesma tela,
 * `Tests 133 passed`. Os 8 casos deste guarda simplesmente **não rodaram**, e o número verde
 * ao lado fazia parecer que tudo estava coberto. Guarda que não roda não protege nada.
 *
 * Daí a regra que este arquivo materializa, e que o guarda verifica: **a decisão é pura**.
 * Sem `process.env`, sem import de driver, sem conexão. Testável sem ambiente.
 */

/**
 * Domínios do Neon. Conferido contra o **host** da URL, não contra um trecho dela: `.neon.tech`
 * dentro de um parâmetro de query não deveria mudar o driver, e `neon.tech.exemplo.com` não é
 * Neon — casar por trecho é exatamente como se aponta o driver de produção para outro lugar.
 */
export function ehNeon(conexao: string): boolean {
  try {
    const host = new URL(conexao).hostname;
    return /(^|\.)neon\.tech$/.test(host) || /(^|\.)neon\.build$/.test(host);
  } catch {
    // URL malformada: assume produção. Falhar como Neon é mais seguro que abrir TCP para um
    // host desconhecido por não conseguir parsear.
    return true;
  }
}
