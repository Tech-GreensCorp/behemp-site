/**
 * Comparação de segredo em tempo constante.
 *
 * POR QUE NÃO `===`
 * A comparação de string do JavaScript retorna assim que encontra o primeiro caractere
 * diferente. Quem consegue medir o tempo de resposta descobre o segredo caractere a
 * caractere — é o ataque de temporização, e ele é prático em rede local ou com muitas
 * amostras.
 *
 * POR QUE COMPARAR O HASH, E NÃO OS VALORES
 * Duas razões, ambas do ADR-0002 do greens-corp:
 * 1. `timingSafeEqual` **exige buffers do mesmo tamanho** — com segredos de tamanhos
 *    diferentes ele lança exceção, e a exceção em si já vaza a informação;
 * 2. comparar o SHA-256 dos dois valores dá sempre 32 bytes de cada lado, então o tamanho
 *    do segredo recebido não vaza pelo tempo de resposta.
 *
 * 🛑 Módulo PURO — sem `db`, sem `auth`, sem `next/*`.
 */

import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * `true` quando os dois segredos são iguais, sem vazar informação pelo tempo.
 *
 * Recebido vazio ou esperado vazio devolve `false`: rota que cria dado de paciente nunca
 * fica aberta por falta de configuração.
 */
export function segredosConferem(
  recebido: string | null | undefined,
  esperado: string | null | undefined,
): boolean {
  if (!recebido || !esperado) return false;

  const hashRecebido = createHash('sha256').update(recebido).digest();
  const hashEsperado = createHash('sha256').update(esperado).digest();

  return timingSafeEqual(hashRecebido, hashEsperado);
}

/**
 * Extrai o segredo do cabeçalho da requisição.
 *
 * Aceita duas formas porque o painel do ChatPro deixa quem configura o fluxo escolher o
 * nome do campo de autenticação: o nosso cabeçalho próprio, e `Authorization: Bearer`,
 * que é o formato que a maioria dos painéis oferece por padrão.
 */
export function lerSegredoDoCabecalho(cabecalhos: Headers): string | null {
  const proprio = cabecalhos.get('x-chatpro-intake-secret');
  if (proprio?.trim()) return proprio.trim();

  const autorizacao = cabecalhos.get('authorization');
  if (autorizacao?.toLowerCase().startsWith('bearer ')) {
    const valor = autorizacao.slice(7).trim();
    if (valor) return valor;
  }

  return null;
}
