/**
 * A RECONCILIAÇÃO TERMINA SOZINHA O QUE JÁ ESTAVA FEITO — e não inventa nada no caminho.
 *
 * 🔴 ADR-0022, D-09 (S8.6). Decisão do dono em 13/09/2026, com ele preso no próprio fluxo:
 *
 *   _"a reconciliação deve ser automática… não faz sentido ir novamente para o link que já foi
 *   preenchido, que veio de outro formulário preenchido… ele vai de novo preencher esses dados
 *   por conta de um erro NOSSO na ÚLTIMA ETAPA DE VALIDAÇÃO? não faz sentido."_
 *
 * **O argumento é de experiência, e está certo.** O paciente preencheu o formulário da Greens,
 * confirmou os dados aqui, respondeu as perguntas e verificou o e-mail. A conta existe e está
 * validada. O que falhou foi a última etapa — por defeito nosso. Mandá-lo refazer é cobrar dele
 * o preço do nosso erro.
 *
 * ## Por que isto pode existir, e foi MEDIDO antes de decidir
 *
 * Eu havia afirmado ao dono que consentimento e resposta clínica impediriam a conclusão
 * automática. **Estava errado nos dois**, e a medição desmentiu:
 *
 *   - consentimento **nunca foi pedágio** do cadastro — há guarda proibindo, porque aceite
 *     obtido como condição é viciado (LGPD art. 8º §3º). Ele governa o ENVIO à Greens
 *   - `jaFazTratamentoCannabis` é `boolean()` **sem `notNull`** — "não informado" é previsto
 *
 * ## O risco desta função, e é o que este guarda vigia
 *
 * 🔴 Ela conclui cadastro **sem o paciente presente**. Um erro de identidade aqui grava CPF,
 * telefone e documentos clínicos na conta de outra pessoa, sem ninguém para notar — e é o risco
 * número um deste projeto (OWASP API1). Por isso: falha fechada, e nada inventado.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..', '..');
const ler = (p: string) => readFileSync(join(RAIZ, p), 'utf8');
const semComentarios = (f: string) =>
  f.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const MODULO = semComentarios(ler('lib/fluxo/reconciliar.ts'));
const PAGINA = semComentarios(ler('app/(auth)/cadastro/[token]/page.tsx'));
const ACTION = semComentarios(ler('app/_actions/cadastro-por-link.ts'));
const SCHEMA = semComentarios(ler('db/schema/pacientes.ts'));

/**
 * O corpo de `podeReconciliarSozinho`.
 *
 * ⚠️ ÂNCORA ESTRUTURAL, e não `indexOf('\n}')`: a função declara o parâmetro como tipo inline,
 * então o primeiro `\n}` do texto fecha o TIPO, não a função — e o recorte perdia o corpo
 * inteiro, acusando o código certo. Fatiar até a próxima declaração de topo é o que resiste a
 * isso.
 */
function decisao(): string {
  const i = MODULO.indexOf('export function podeReconciliarSozinho');
  expect(i, 'a decisão não está isolada num lugar só').toBeGreaterThan(-1);
  const proxima = MODULO.indexOf('\nexport ', i + 1);
  return MODULO.slice(i, proxima > -1 ? proxima : undefined);
}

describe('a reconciliação termina o que já estava feito', () => {
  it('⚠️ VACUIDADE: a página do cadastro ainda renderiza o formulário', () => {
    // Se um dia ela não renderizar mais, estas regras mudam de forma — e o caso avisa.
    expect(PAGINA).toMatch(/<FormularioDeCadastro/);
  });

  it('🔴 a reconciliação roda ANTES do formulário — senão ela não poupa nada', () => {
    const reconcilia = PAGINA.indexOf('podeReconciliarSozinho(');
    const formulario = PAGINA.indexOf('<FormularioDeCadastro');
    expect(reconcilia, 'a página não tenta reconciliar').toBeGreaterThan(-1);
    expect(formulario, 'o formulário some — o guarda perdeu o alvo').toBeGreaterThan(reconcilia);
  });

  it('🔴 FALHA FECHADA: exige sessão, e-mail VERIFICADO e e-mail que bate', () => {
    /**
     * As três, e cada uma responde a uma forma de errar de pessoa:
     *   sem sessão        → não há a quem vincular
     *   não verificado    → o e-mail não prova nada; qualquer um o digita
     *   e-mail divergente → é outro cadastro, e concluir aqui mistura duas pessoas
     */
    const fn = decisao();

    expect(fn, 'não exige sessão').toMatch(/sem_sessao/);
    expect(fn, 'não exige e-mail verificado').toMatch(/email_nao_verificado/);
    expect(fn, 'não compara o e-mail da sessão com o do cadastro').toMatch(/email_diverge/);

    // E a comparação normaliza — "Davi@" e "davi@" são a mesma pessoa.
    expect(fn, 'a comparação é sensível a maiúscula').toMatch(/toLowerCase\(\)/);
  });

  it('🔴 e devolve o PORQUÊ — booleano sozinho repete o G6 da ADR', () => {
    /**
     * O D-06 vale aqui também: quando não reconcilia, alguém vai perguntar qual das três
     * condições barrou. Sem o motivo, a resposta é "some e ninguém sabe".
     */
    expect(decisao(), 'a decisão não explica a recusa').toMatch(/porque:/);
  });

  it('🔴 NÃO INVENTA CONSENTIMENTO — nenhuma finalidade é marcada por nós', () => {
    /**
     * ⚠️ O pior erro possível nesta função. Consentir é ato do titular (LGPD art. 8º), e gravar
     * por ele é pior que não ter consentimento nenhum: cria prova falsa de uma autorização que
     * ninguém deu, e ela viajaria para a Greens com o texto e a versão.
     */
    const i = PAGINA.indexOf('concluirCadastroPorLink({');
    expect(i, 'a página não conclui o cadastro').toBeGreaterThan(-1);
    const chamada = PAGINA.slice(i, PAGINA.indexOf('});', i));

    expect(chamada, 'a reconciliação está marcando finalidades').toMatch(
      /finalidadesConsentidas: \[\]/,
    );
  });

  it('🔴 e NÃO RESPONDE a pergunta clínica — "não informado" é estado, não lacuna', () => {
    /**
     * Passar `false` afirmaria que o paciente não faz tratamento com cannabis. Isso é dado
     * clínico falso no prontuário, gravado por um processo automático que ninguém viu rodar.
     */
    const i = PAGINA.indexOf('concluirCadastroPorLink({');
    const chamada = PAGINA.slice(i, PAGINA.indexOf('});', i));
    expect(chamada, 'a reconciliação responde a pergunta clínica pelo paciente').toMatch(
      /jaFazTratamento: null/,
    );
  });

  it('🔴 e o contrato ACEITA o não informado — senão o null vira erro de validação', () => {
    expect(ACTION, 'o esquema não aceita "não informado"').toMatch(
      /jaFazTratamento: z\.boolean\(\)\.nullable\(\)/,
    );
  });

  it('🔴 e a COLUNA preserva o não informado — sem notNull, sem default', () => {
    /**
     * Um `default(false)` aqui converteria "não respondeu" em "não faz tratamento" no banco, em
     * silêncio, para todo paciente reconciliado.
     */
    const linha = SCHEMA.split('\n').find((l) => l.includes('jaFazTratamentoCannabis'));
    expect(linha, 'a coluna sumiu').toBeTruthy();
    expect(/notNull\(\)/.test(linha!), 'a coluna virou obrigatória').toBe(false);
    expect(/default\(/.test(linha!), 'a coluna ganhou default e inventa a resposta').toBe(false);
  });

  it('🔴 o destino sai da MESMA função do formulário — duas regras divergem', () => {
    /**
     * É como o paciente da procuração acabava mandado para o agendamento (ADR-0022 §31): duas
     * telas decidindo destino por conta própria.
     */
    expect(PAGINA, 'a reconciliação inventa o próprio destino').toMatch(
      /destinoDepoisDoCadastro\(/,
    );
  });

  it('⚠️ e a gravação é a MESMA action — não existe segundo caminho até a ficha', () => {
    /**
     * A ADR-0022 documenta SETE criadores de ficha e o estrago que isso fez. A reconciliação não
     * pode ser o oitavo: ela chama a action que já existe, com as mesmas travas.
     */
    expect(PAGINA, 'a reconciliação grava por fora da action').toMatch(/concluirCadastroPorLink\(/);
    expect(MODULO, 'o módulo de reconciliação escreve por conta própria').not.toMatch(
      /db\.(insert|update|delete)\(/,
    );
  });

  it('⚠️ reconciliação que FALHA não vira tela de erro — cai no formulário', () => {
    /**
     * Ela é uma tentativa de poupar trabalho, não um passo obrigatório. Se falhar, o paciente
     * segue pelo caminho normal — que agora sabe dizer o que faltou.
     */
    const i = PAGINA.indexOf('if (concluido.sucesso)');
    expect(i, 'não há ramo de sucesso').toBeGreaterThan(-1);
    const depois = PAGINA.slice(i, PAGINA.indexOf('<FormularioDeCadastro'));
    expect(depois, 'a falha da reconciliação interrompe o fluxo').not.toMatch(/throw |notFound\(/);
  });

  it('⚠️ o log da reconciliação não carrega e-mail nem CPF', () => {
    const logs = PAGINA.match(/console\.\w+\([^;]*\)/g) ?? [];
    for (const log of logs) {
      expect(log, `log com dado pessoal: ${log}`).not.toMatch(/email|cpf|telefone|nomeCompleto/i);
    }
  });
});
