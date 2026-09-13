/**
 * A REVOGAÇÃO PARA A FILA — e não só o enfileiramento.
 *
 * 🔴 O ACHADO MAIS GRAVE DA INVESTIGAÇÃO DE 12/09/2026, e é de LGPD. ADR-0022 §23, G9, D-14.
 *
 * O consentimento era conferido **uma vez**, quando o evento entrava na fila
 * (`enfileirar-transferencia.ts` → `pode-transferir.ts`). O `enviador` pegava o `payload`
 * gravado e mandava. **Entre os dois momentos o paciente pode revogar — e o dado saía assim
 * mesmo.**
 *
 * ⚠️ E A JANELA NÃO É TEÓRICA. Medido: a fila anda por GitHub Actions a cada 5 minutos, com
 * até 6 tentativas e backoff de até 60 minutos. Um evento pode sair **horas** depois de
 * enfileirado.
 *
 * 🔴 LGPD art. 8º §5º: a revogação é _"a qualquer momento, mediante manifestação expressa, por
 * procedimento gratuito e facilitado"_. Um consentimento que só vale até a fila rodar **não é
 * revogável a qualquer momento** — é revogável até um instante que o paciente não conhece, e
 * sobre o qual não tem controle.
 *
 * ⚠️ NÃO É EXPERIÊNCIA RUIM: é dado de saúde saindo da empresa sem autorização válida. Por
 * isso este item precede todos os outros da Sprint 8, inclusive os que corrigem telas quebradas.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..', '..');
const ler = (p: string) => readFileSync(join(RAIZ, p), 'utf8');
const semComentarios = (f: string) =>
  f.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const ENVIADOR = semComentarios(ler('lib/parceiros/enviador.ts'));
const MODULO = semComentarios(ler('lib/parceiros/consentimento-ainda-vale.ts'));
const ENUMS = semComentarios(ler('db/schema/enums.ts'));

/**
 * O bloco do `if (evento.solicitacaoId)`, que é onde a revogação é decidida.
 *
 * ⚠️ Defeito meu, achado ao rodar a primeira versão: fatiar 700 caracteres a partir da checagem
 * alcançava o `reagendar` do bloco SEGUINTE (o do segredo ausente), e o guarda acusava um
 * inocente. O recorte termina onde o `if` termina — a granularidade do defeito, não uma janela
 * arbitrária.
 */
function blocoDaChecagem(): string {
  const corpo = corpoDoEntregar();
  const i = corpo.indexOf('if (evento.solicitacaoId)');
  expect(i, 'não achei o bloco da checagem').toBeGreaterThan(-1);
  // O bloco vai até o `const corpo =`, que é a primeira linha depois dele.
  return corpo.slice(i, corpo.indexOf('const corpo =', i));
}

/** O corpo de `entregar`, que é onde o POST acontece. */
function corpoDoEntregar(): string {
  const i = ENVIADOR.indexOf('private async entregar(');
  expect(i, 'não achei o entregar').toBeGreaterThan(-1);
  return ENVIADOR.slice(i, i + 3000);
}

describe('a revogação para a fila', () => {
  it('⚠️ VACUIDADE: o enviador ainda faz o POST que precisa ser barrado', () => {
    expect(corpoDoEntregar()).toMatch(/fetch\(/);
  });

  it('🔴 o consentimento é RELIDO antes do POST', () => {
    const corpo = corpoDoEntregar();
    const checagem = corpo.indexOf('consentimentoAindaVale(');
    const envio = corpo.indexOf('fetch(');
    expect(checagem, 'o enviador não relê o consentimento').toBeGreaterThan(-1);
    expect(envio, 'o POST acontece ANTES da checagem').toBeGreaterThan(checagem);
  });

  it('🔴 e a releitura vai ao BANCO — não ao payload congelado', () => {
    /**
     * O `payload` é imutável de propósito: é o que o parceiro recebe, e reescrevê-lo mudaria
     * o que foi autorizado. Por isso a checagem não pode sair dele.
     */
    expect(MODULO).toMatch(/finalidadesVigentes\(/);
    expect(MODULO).toMatch(/from\(solicitacoesCadastro\)/);
    const i = MODULO.indexOf('export async function consentimentoAindaVale');
    expect(MODULO.slice(i), 'a decisão saiu do payload').not.toMatch(/payload/);
  });

  it('🔴 revogado NÃO REAGENDA — revogação não é falha transitória', () => {
    /**
     * Reagendar faria o sistema tentar de novo, e de novo, contra uma decisão do paciente que
     * não vai mudar sozinha. É o tipo de retry que transforma respeito em insistência.
     */
    /**
     * ⚠️ Defeito meu, achado ao rodar: fatiar 700 caracteres a partir da checagem alcançava o
     * `reagendar` do bloco SEGUINTE (o do segredo ausente), e o guarda acusava um inocente.
     * O recorte agora termina onde o `if` termina — a granularidade do defeito, não uma
     * janela arbitrária.
     */
    expect(blocoDaChecagem(), 'revogação está sendo reagendada').not.toMatch(/this\.reagendar/);
  });

  /**
   * 🔴 ESTE CASO NASCEU DE UM DEFEITO MEU, E DA CLASSE MAIS CARA QUE EXISTE NUM GUARDA.
   *
   * A versão anterior afirmava `expect(bloco).toMatch(/marcarFalha/)`. Ela passava — e passava
   * **porque** o código contrariava o D-14, que decidiu por escrito: _"o evento vira
   * `cancelado_por_revogacao`, não `falhou`"_. A migration `0043` chegou a ser autorizada pelo
   * dono para isso, e o valor ficou no enum sem **nenhum** uso em `lib/` ou `app/`.
   *
   * ⚠️ Um guarda que exige a implementação de hoje **congela o defeito de hoje**: ficava verde
   * com o defeito presente, e ficou vermelho quando a correção chegou — que é o sinal invertido.
   * É a mesma classe do `o-destino-do-paciente-segue-o-que-falta`, que comparava destinos com
   * uma lista fixa contendo os dois 404.
   *
   * **A regra que sai:** guarda mede a PROPRIEDADE (o status final distingue revogação de falha
   * de entrega), nunca o NOME do método que a produz.
   */
  it('🔴 revogado vira status PRÓPRIO, e não se confunde com falha de entrega (D-14)', () => {
    const bloco = blocoDaChecagem();

    /**
     * A propriedade, em uma frase: o que o banco guarda depois de uma revogação não pode ser o
     * mesmo que ele guarda depois de a Greens cair. Quem lê a fila para achar o que não chegou
     * investiga rede; quem lê para saber se respeitamos a revogação precisa de prova.
     */
    const metodo = bloco.match(/return this\.(\w+)\(/);
    expect(metodo?.[1], 'a revogação não chama nada que grave desfecho').toBeTruthy();

    const nome = metodo![1];
    const i = ENVIADOR.indexOf(`private async ${nome}(`);
    expect(i, `não achei \`${nome}\` para ver o que ele grava`).toBeGreaterThan(-1);
    const gravador = ENVIADOR.slice(i, ENVIADOR.indexOf('\n  }', i));

    expect(gravador, 'a revogação grava o mesmo status de uma falha de entrega').toMatch(
      /status: 'cancelado_por_revogacao'/,
    );
    expect(gravador, "revogação não é 'falhou'").not.toMatch(/status: 'falhou'/);
  });

  it('🔴 e o valor do enum NÃO É MORTO — alguém tem de gravá-lo', () => {
    /**
     * ⚠️ A própria ADR-0022 §27 nomeia esta classe: _"`chatpro_webhook` existe no enum e ninguém
     * grava: valor morto"_. Um valor de enum sem gravador é uma decisão que parece tomada e não
     * está — e a migration que o criou é custo puro.
     */
    expect(ENUMS, 'o enum perdeu o valor que a migration 0043 criou').toMatch(
      /'cancelado_por_revogacao'/,
    );
    expect(ENVIADOR, 'ninguém grava cancelado_por_revogacao — voltou a ser valor morto').toMatch(
      /status: 'cancelado_por_revogacao'/,
    );
  });

  it('🔴 e o LOTE não soma cancelado com falhou', () => {
    /**
     * Corrigir o status e somar os dois no agregado repetiria o erro uma camada acima: a saída
     * do cron diria "3 falharam", alguém iria procurar a Greens fora do ar, e o que houve foi
     * três pacientes exercendo um direito.
     */
    const i = ENVIADOR.indexOf('async enviarLote(');
    const lote = ENVIADOR.slice(
      i,
      ENVIADOR.indexOf('\n  }', ENVIADOR.indexOf('for (const evento', i)),
    );
    expect(lote, 'o desfecho cancelado cai no else de falharam').toMatch(
      /desfecho === 'cancelado'/,
    );
    /**
     * ⚠️ SEGUNDO DEFEITO MEU NESTE MESMO GUARDA, e da classe que mais me pega: fatiar 120
     * caracteres a partir do ramo alcançava a LINHA SEGUINTE (`else resultado.falharam++`), e o
     * guarda acusava o código correto. Recorte se faz na granularidade do defeito — aqui, **a
     * linha do ramo**, porque é uma linha que decide o contador.
     */
    const linhas = lote.split('\n');
    const linhaDoRamo = linhas.find((l) => l.includes("desfecho === 'cancelado'"));
    expect(linhaDoRamo, 'não achei a linha do ramo cancelado').toBeTruthy();
    expect(linhaDoRamo!, 'cancelado está incrementando falharam').not.toMatch(
      /resultado\.falharam/,
    );
    expect(linhaDoRamo!, 'cancelado não incrementa contador próprio').toMatch(
      /resultado\.cancelados/,
    );
  });

  it('⚠️ e o motivo fica registrado — status sem motivo não se distingue de rede caída', () => {
    /**
     * ⚠️ Sem amarrar ao literal da interpolação: a versão anterior exigia
     * `consentimento: ${veredicto.motivo}` exatamente como escrito, e por isso quebrou quando o
     * mesmo dado passou a chegar por parâmetro. O que importa é que o motivo do veredicto
     * chegue ao gravador e vá para `ultimoErro` — não a forma da string.
     */
    const bloco = blocoDaChecagem();
    expect(bloco, 'o motivo do veredicto não é repassado').toMatch(/veredicto\.motivo/);

    const nome = bloco.match(/return this\.(\w+)\(/)![1];
    const i = ENVIADOR.indexOf(`private async ${nome}(`);
    const gravador = ENVIADOR.slice(i, ENVIADOR.indexOf('\n  }', i));

    /**
     * 🔴 TERCEIRO DEFEITO MEU NESTE GUARDA, achado pela sabotagem 6 — e o mais instrutivo dos
     * três, porque a primeira versão **sobreviveu** a ela.
     *
     * Eu afirmava `toMatch(/ultimoErro:/)`: que o campo EXISTISSE. Trocar a expressão por
     * `ultimoErro: 'cancelado'` — um literal fixo, sem nenhum motivo — passava verde, e o banco
     * ficaria com 40 eventos cancelados indistinguíveis entre si. **Existir não é carregar.**
     *
     * ⚠️ É a mesma classe da segunda retratação do `CLAUDE.md`: o
     * `contrato-da-ia-e-a-unica-fonte` checava `toBeTruthy()` — que o campo existisse, não que
     * o valor fosse válido. Aqui a propriedade é que o valor gravado **dependa** do parâmetro.
     */
    const nomeDoParametro = gravador.match(/\(\s*id: string,\s*(\w+): string/)?.[1];
    expect(nomeDoParametro, 'o gravador não recebe o motivo por parâmetro').toBeTruthy();

    const expressao = gravador.slice(gravador.indexOf('ultimoErro:'));
    expect(
      expressao.slice(0, expressao.indexOf('\n')),
      'ultimoErro não deriva do motivo — grava um literal, e todo cancelamento fica igual',
    ).toContain(nomeDoParametro!);
  });

  it('🔴 FALHA FECHADA: tipo de evento sem finalidade declarada não é enviado', () => {
    // Um tipo novo que ninguém mapeou sairia sob uma finalidade que ninguém autorizou.
    expect(MODULO).toMatch(/tipo_desconhecido/);
    const i = MODULO.indexOf('const finalidade = FINALIDADE_POR_TIPO[tipo]');
    expect(MODULO.slice(i, i + 200)).toMatch(/if \(!finalidade\) return \{ pode: false/);
  });

  it('🔴 e ficha apagada também barra — exclusão é revogação por outra porta', () => {
    expect(MODULO).toMatch(/isNull\(pacientes\.deletedAt\)/);
  });

  it('⚠️ o log NÃO carrega paciente nem conteúdo — só o fato e o motivo', () => {
    /**
     * ⚠️ Mesmo defeito do caso acima: 300 caracteres passavam do fecho do `console.warn` e
     * alcançavam `marcarFalha`/`corpo`, onde `solicitacaoId` aparece legitimamente. O recorte
     * agora é o objeto do log, e só ele.
     */
    const corpo = corpoDoEntregar();
    const i = corpo.indexOf('envio barrado pelo consentimento');
    expect(i, 'não achei o log').toBeGreaterThan(-1);
    const bloco = corpo.slice(i, corpo.indexOf('});', i));

    expect(bloco).toMatch(/motivo: veredicto\.motivo/);
    expect(bloco, 'o log carrega dado do paciente').not.toMatch(/pacienteId|payload/);
  });

  it('⚠️ o evento CARREGA a solicitação — sem ela a checagem não teria como acontecer', () => {
    // O `RETURNING` do claim precisa trazê-la, senão `solicitacaoId` chega sempre nulo e a
    // trava vira decorativa.
    expect(ENVIADOR).toMatch(/RETURNING[^\n]*solicitacao_id/);
    expect(ENVIADOR).toMatch(/solicitacaoId:/);
  });

  it('🔴 a finalidade exigida é a MESMA do enfileiramento — senão as duas divergem', () => {
    // Se o envio exigisse outra finalidade que o cadastro colhe, ou tudo passaria, ou nada.
    expect(MODULO).toMatch(/FINALIDADES\.retornoAoParceiro/);
    expect(ler('lib/parceiros/pode-transferir.ts')).toMatch(
      /retornoAoParceiro|retorno_ao_parceiro/,
    );
  });
});
