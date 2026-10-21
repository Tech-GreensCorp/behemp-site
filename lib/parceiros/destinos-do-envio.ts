/**
 * PARA ONDE CADA EVENTO VAI, E COM QUAL SEGREDO.
 *
 * 🔴 PEDIDO NO §7 DO CONTRATO-PONTE COM A GREENS, em 11/09/2026. O `EnviadorDeAvisos` tinha
 * **um** caminho e **um** segredo, e o S2 precisa de outro par:
 *
 * | direção | segredo | o que quem o tiver consegue |
 * | --- | --- | --- |
 * | volta (S1) | `PARCEIRO_GREENS_SEGREDO_SAIDA` | mentir que uma receita ficou pronta |
 * | **cadastro (S2)** | `PARCEIRO_GREENS_SEGREDO_CADASTRO` | **criar solicitações lá, e fazer a Greens buscar URLs que ele escolher** |
 *
 * ⚠️ REUSAR O SEGREDO DO AVISO FOI REJEITADO — pelos dois lados, e pelo mesmo argumento:
 * poderes diferentes não dividem chave. Rotacionar um não pode exigir parar o outro, e vazar
 * o do aviso não pode entregar o do cadastro. É o mesmo raciocínio que separou
 * `CHATPRO_INTAKE_SECRET_GREENS` de `CHATPRO_INTAKE_SECRET`.
 *
 * ⚠️ E É PURO DE PROPÓSITO: sem `db`, sem `fetch`. A decisão "para onde vai este evento" se
 * testa sem rede e sem banco — foi o que faltou em `podeTransferir` até eu extraí-la.
 */

export type TipoDeEvento = 'receita_emitida' | 'anvisa_aprovada' | 'cadastro_transferido';

export interface DestinoDoEnvio {
  caminho: string;
  segredo: string | undefined;
  /** Para o diagnóstico dizer QUAL par está faltando, em vez de "não configurado". */
  nomeDaVariavelDoSegredo: string;
}

/**
 * O caminho do S1 — a rota de avisos.
 *
 * ⚠️ CONFIGURÁVEL PORQUE EU JÁ ERREI ESTE VALOR UMA VEZ: escrevi
 * `/api/parceiros/behemp/atualizacao` no contrato, e a Greens versiona a API em `/api/v1/…`.
 */
export const CAMINHO_DO_AVISO_PADRAO = '/api/v1/parceiros/behemp/atualizacao';

/**
 * O caminho do S2 — a rota de cadastro, confirmada no §1 do contrato-ponte em 11/09/2026.
 */
export const CAMINHO_DO_CADASTRO_PADRAO = '/api/v1/parceiros/behemp/cadastro';

export function destinoDoEvento(tipo: TipoDeEvento): DestinoDoEnvio {
  if (tipo === 'cadastro_transferido') {
    return {
      caminho: process.env.PARCEIRO_GREENS_CAMINHO_CADASTRO?.trim() || CAMINHO_DO_CADASTRO_PADRAO,
      segredo: process.env.PARCEIRO_GREENS_SEGREDO_CADASTRO,
      nomeDaVariavelDoSegredo: 'PARCEIRO_GREENS_SEGREDO_CADASTRO',
    };
  }

  return {
    caminho: process.env.PARCEIRO_GREENS_CAMINHO_RETORNO?.trim() || CAMINHO_DO_AVISO_PADRAO,
    segredo: process.env.PARCEIRO_GREENS_SEGREDO_SAIDA,
    nomeDaVariavelDoSegredo: 'PARCEIRO_GREENS_SEGREDO_SAIDA',
  };
}

/**
 * 🔴 O CADASTRO NÃO CAI PARA O SEGREDO DO AVISO QUANDO O PRÓPRIO FALTA.
 *
 * Se caísse, a Greens receberia um cadastro assinado com a chave errada e responderia 401 —
 * ou, pior, se um dia os segredos coincidissem, o evento **entraria** por um caminho que
 * ninguém autorizou. Sem o segredo próprio, o evento espera na fila.
 */
export function podeEnviar(tipo: TipoDeEvento): boolean {
  return Boolean(destinoDoEvento(tipo).segredo?.trim());
}
