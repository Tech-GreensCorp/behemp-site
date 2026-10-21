/**
 * O QUE O PARCEIRO ENVIOU E NÃO CHEGOU É DITO — e como problema NOSSO.
 *
 * 🔴 ADR-0022, R6 e S8.4. O dono viu o painel dizer **"0 enviados"** e parou:
 * _"nenhum dos documentos que eu enviei chegaram na minha conta"_.
 *
 * ⚠️ O PAINEL NÃO MENTIA SOBRE O BANCO — mentia sobre o MUNDO. Havia zero linhas em
 * `documentos`, e isso era verdade. Mas a Greens tinha entregado quatro, e a materialização
 * falhou **em silêncio**: `materializar-documentos.ts` devolve `{ inseridos: 0 }` e nunca
 * lança, por decisão (um erro ao copiar não pode desfazer um cadastro que deu certo).
 *
 * 🔴 SÃO TRÊS ESTADOS, e a tela dizia o mesmo para os três:
 *
 *   1. você não enviou       → cobrar faz sentido
 *   2. recebemos             → nada a fazer
 *   3. veio e não chegou     → é problema NOSSO
 *
 * Cobrar do paciente um documento que ele já entregou é o pior dos três: ele sabe que
 * enviou, o sistema afirma que não, e a conversa começa com ele tendo de provar algo.
 *
 * ⚠️ E A ORDEM NA TELA É PARTE DA CORREÇÃO. Este aviso vem **antes** dos que pedem coisas ao
 * paciente — senão ele lê "faltam 4 documentos" primeiro, e a explicação chega tarde.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..', '..');
const ler = (p: string) => readFileSync(join(RAIZ, p), 'utf8');
const semComentarios = (f: string) =>
  f.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const AVISO_FONTE = ler('components/paciente/AvisoDoQueNaoChegou.tsx');
const AVISO = semComentarios(AVISO_FONTE);
const TELA = semComentarios(ler('app/(paciente)/paciente/page.tsx'));
const ACTION = semComentarios(ler('app/_actions/dashboard-paciente.ts'));
const SENTINELA = semComentarios(ler('lib/fluxo/sentinela.ts'));

describe('o que não chegou é dito como nosso', () => {
  it('⚠️ VACUIDADE: a sentinela sabe produzir este ponto', () => {
    // Sem o ponto, o aviso nunca apareceria e os casos abaixo seriam vácuo.
    expect(SENTINELA).toMatch(/ponto:\s*'documentos_nao_materializados'/);
  });

  it('🔴 o DASHBOARD entrega a situação — a tela não decide sozinha', () => {
    expect(ACTION).toContain('situacaoDoFluxo');
    expect(ACTION).toMatch(/situacao,/);
  });

  it('🔴 a TELA renderiza — componente órfão não avisa ninguém', () => {
    /**
     * A classe mais repetida deste repositório: o `AvisoDaProcuracao` passou quatro semanas
     * importado e nunca renderizado.
     */
    expect(TELA).toContain('AvisoDoQueNaoChegou');
    expect(TELA).toMatch(/<AvisoDoQueNaoChegou/);
  });

  it('🔴 e vem ANTES dos avisos que pedem coisas ao paciente', () => {
    const naoChegou = TELA.indexOf('<AvisoDoQueNaoChegou');
    const pendente = TELA.indexOf('<AvisoDeCadastroPendente');
    const procuracao = TELA.indexOf('<AvisoDaProcuracao');
    expect(naoChegou).toBeGreaterThan(-1);
    expect(pendente, 'o aviso de pendência vem antes').toBeGreaterThan(naoChegou);
    expect(procuracao, 'o aviso da procuração vem antes').toBeGreaterThan(naoChegou);
  });

  it('🔴 só aparece no ponto certo — não é aviso permanente', () => {
    expect(AVISO).toMatch(/if \(ponto !== 'documentos_nao_materializados'\) return null;/);
  });

  it('🔴 o texto diz que o problema é NOSSO — e isso não é delicadeza', () => {
    /**
     * É a diferença entre o paciente reenviar (trabalho dele, por falha nossa) e nós
     * resolvermos. Um texto neutro empurra o trabalho para quem não errou.
     */
    expect(AVISO_FONTE).toMatch(/isso é com a gente/i);
    expect(AVISO_FONTE).toMatch(/não com\s*\n?\s*você/i);
  });

  it('⚠️ e mostra o PORQUÊ da sentinela, em vez de inventar texto', () => {
    // Texto fixo envelhece; o motivo vem de quem decidiu o ponto.
    expect(AVISO).toMatch(/\{porque\}/);
  });

  it('⚠️ reenviar é opção, nunca obrigação — e vem em segundo lugar', () => {
    const falar = AVISO_FONTE.indexOf('Falar com a gente');
    const reenviar = AVISO_FONTE.indexOf('Prefiro enviar de novo');
    expect(falar).toBeGreaterThan(-1);
    expect(reenviar, 'reenviar aparece antes de falar com a gente').toBeGreaterThan(falar);
  });

  it('⚠️ AVISA, NÃO BLOQUEIA — nada na tela depende deste ponto para renderizar', () => {
    expect(TELA).not.toMatch(/if \(dados\?\.situacao.*return null/);
    expect(TELA).not.toMatch(/disabled=\{dados\?\.situacao/);
  });

  /**
   * 🔴 G18 — A QUARTA POSSIBILIDADE, e a que a Sprint 8 tinha deixado passar.
   *
   * Os três estados acima supõem que a consulta FUNCIONOU. Existe um quarto: **ela falhou**. O
   * painel fazia `if (res.sucesso && res.dados) setDados(...)` e descartava o erro — `dados`
   * ficava `null`, `carregando` virava `false`, e a tela renderizava o estado vazio, idêntico
   * ao de quem não tem nada.
   *
   * ⚠️ É metade do relato que abriu a ADR-0022, e ficou aberto como G18 no §24 enquanto o S8.4
   * corrigia os outros três. Sem ele, **qualquer** erro durante um teste do fluxo aparece como
   * "não tem nada" — e o diagnóstico se perde antes de começar.
   */
  describe('e quando a consulta FALHA, a tela não finge que está vazia (G18)', () => {
    const PAINEL = ler('app/(paciente)/paciente/page.tsx');

    it('⚠️ VACUIDADE: o painel ainda carrega por action que pode falhar', () => {
      expect(PAINEL).toMatch(/await obterDadosDashboard\(\)/);
    });

    it('🔴 o erro é GUARDADO, não descartado', () => {
      const i = PAINEL.indexOf('const res = await obterDadosDashboard()');
      expect(i, 'não achei a chamada').toBeGreaterThan(-1);
      const bloco = PAINEL.slice(i, PAINEL.indexOf('setCarregando(false)', i));

      /**
       * ⚠️ DEFEITO MEU, achado pela sabotagem: `toMatch(/else/)` sobrevivia a
       * `else if (false)` — o ramo existia e era inalcançável. O que importa não é haver um
       * `else`: é o ramo de falha ser **incondicional**, porque "a action não teve sucesso" já
       * é a condição inteira.
       */
      expect(
        bloco,
        'o ramo de falha não existe ou é condicional — o erro volta a ser descartado',
      ).toMatch(/\}\s*else\s*\{/);
      expect(bloco, 'o motivo da action não é guardado').toMatch(/res\.erro/);
    });

    it('🔴 e CHEGA À TELA — guardar sem mostrar é o mesmo silêncio', () => {
      /**
       * A classe do componente órfão, que já custou quatro semanas no aviso da procuração:
       * declarar não é mostrar.
       */
      const estado = PAINEL.match(/const \[(\w+), set\w+\] = useState<string \| null>\(null\)/);
      expect(estado?.[1], 'não achei o estado da falha').toBeTruthy();
      const nome = estado![1];

      /**
       * ⚠️ SEGUNDO DEFEITO MEU, e da classe que mais me pega: procurar o nome no arquivo inteiro
       * achava os PRÓPRIOS SETTERS (`setFalhaAoCarregar(res.erro)`), então trocar o aviso por
       * `{false && (` passava verde. **Menção não é uso.**
       *
       * O JSX é o que renderiza, então é onde se procura — a partir do `return (` do componente.
       */
      /**
       * ⚠️ TERCEIRA TENTATIVA NESTE CASO, e as duas anteriores eram minhas sabotagens passando.
       *
       * Procurar o nome no arquivo achava os próprios setters. Procurar no "JSX" por
       * `lastIndexOf('return (')` caía num `return` de dentro de um `map`. E procurar por uso
       * fora da escrita sobrevivia a `{false && (`, porque o nome continuava **dentro** do bloco
       * inalcançável, imprimindo o motivo.
       *
       * **A propriedade é alcançabilidade:** a CONDIÇÃO que decide se o aviso renderiza tem de
       * depender do estado da falha. Um bloco cuja condição não menciona o estado nunca aparece
       * por causa dele — que é a definição de órfão, mesmo com o nome escrito lá dentro.
       */
      const alerta = PAINEL.indexOf('role="alert"');
      expect(alerta, 'o aviso de falha não existe').toBeGreaterThan(-1);

      // A condição JSX é a última abertura de expressão antes do bloco.
      const condicao = PAINEL.slice(
        PAINEL.lastIndexOf('{', PAINEL.lastIndexOf('<div', alerta)),
        alerta,
      );
      expect(
        condicao,
        `a condição que renderiza o aviso não depende de ${nome} — o bloco é inalcançável`,
      ).toContain(nome);
    });

    it('🔴 o texto diz que o problema é NOSSO — mesma regra do S8.4', () => {
      /**
       * "Não conseguimos" é diferente de "você não tem". O primeiro assume o problema; o segundo
       * faz o paciente começar a conversa tendo de provar algo.
       */
      const i = PAINEL.indexOf('role="alert"');
      expect(i, 'o aviso de falha não existe').toBeGreaterThan(-1);
      const bloco = PAINEL.slice(i, i + 700);
      expect(bloco, 'o aviso não assume o problema como nosso').toMatch(
        /problema é nosso|Não conseguimos/i,
      );
    });

    it('⚠️ e oferece TENTAR DE NOVO — falha de rede costuma passar sozinha', () => {
      const i = PAINEL.indexOf('role="alert"');
      expect(PAINEL.slice(i, i + 900), 'sem caminho de volta, o aviso é um beco').toMatch(
        /onClick=\{carregar\}/,
      );
    });
  });
});
