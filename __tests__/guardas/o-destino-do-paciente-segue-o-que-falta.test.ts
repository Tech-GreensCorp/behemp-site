/**
 * GUARDA — o paciente que vem do parceiro cai no lugar certo, e a ordem entre os dois casos
 * não se inverte.
 *
 * A CLASSE DE ERRO: até 10/09/2026 o destino depois do cadastro era fixo — todo mundo ia para
 * `/paciente/teleconsulta`. Os dois fluxos que a Greens encaminha querem coisas diferentes:
 *
 *   sem ANVISA (tem receita)  → procuração. Agendar consulta seria repetir um ato médico.
 *   sem receita               → agendamento. A receita só existe depois de um médico avaliar.
 *
 * 🔴 E QUANDO FALTAM OS DOIS, A CONSULTA VEM PRIMEIRO. A procuração instrui um pedido de
 * importação de um medicamento que ainda não foi prescrito; sem receita não há o que
 * autorizar. Inverter a ordem manda o paciente preencher uma procuração vazia.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { DESTINOS, destinoDepoisDoCadastro } from '@/lib/parceiros/destino-do-paciente';

const FORM = 'app/(auth)/cadastro/[token]/_components/formulario-de-cadastro.tsx';
const codigo = readFileSync(path.join(process.cwd(), FORM), 'utf8');

describe('o destino segue o que falta', () => {
  it('sem receita → agendamento (fluxo 2 da Greens)', () => {
    expect(destinoDepoisDoCadastro(['receita_medica'])).toBe(DESTINOS.agendamento);
  });

  it('com receita e sem ANVISA → procuração (fluxo 1 da Greens)', () => {
    expect(destinoDepoisDoCadastro(['autorizacao_anvisa'])).toBe(DESTINOS.anvisa);
  });

  it('🔴 faltando os DOIS, a consulta vem primeiro — sem receita não há o que autorizar', () => {
    expect(destinoDepoisDoCadastro(['receita_medica', 'autorizacao_anvisa'])).toBe(
      DESTINOS.agendamento,
    );
    // e a ordem inversa da lista não muda a decisão
    expect(destinoDepoisDoCadastro(['autorizacao_anvisa', 'receita_medica'])).toBe(
      DESTINOS.agendamento,
    );
  });

  it('sem pendência nenhuma, o caminho de sempre', () => {
    expect(destinoDepoisDoCadastro([])).toBe(DESTINOS.teleconsulta);
  });

  it('pendência que não é nenhuma das duas não muda o destino', () => {
    expect(destinoDepoisDoCadastro(['comprovante_residencia', 'laudo_medico'])).toBe(
      DESTINOS.teleconsulta,
    );
  });
});

describe('a tela usa a regra, em vez de decidir por conta própria', () => {
  it('o formulário chama a função, e não empurra rota fixa', () => {
    expect(codigo).toContain('destinoDepoisDoCadastro(');
    // o push tem de ser da variável decidida, nunca de uma string literal
    expect(codigo).toMatch(/router\.push\(destino\)/);
    expect(codigo).not.toMatch(/router\.push\('\/paciente\/teleconsulta'\)/);
  });

  it('as três rotas de destino existem no produto', () => {
    // Um destino que não existe manda o paciente para um 404 no melhor momento dele.
    expect(Object.values(DESTINOS)).toEqual([
      '/agendamento',
      '/paciente/anvisa',
      '/paciente/teleconsulta',
    ]);
  });
});

/**
 * A segunda metade do fluxo Greens 1: o paciente que veio do formulário do parceiro **não
 * digita de novo** o que já preencheu lá.
 *
 * O dono apontou isso em 10/09/2026, ao ver a tela de demonstração: _"ele só precisa inserir o
 * código do email e a senha nova já que os dados nós vamos puxar do formulário da greens"_.
 * A tela pedia nome, CPF, telefone e e-mail outra vez — o mesmo trabalho duas vezes, no ponto
 * do funil onde se perde gente.
 */
describe('quem veio do parceiro confirma os dados, não os digita', () => {
  it('a tela distingue a origem — sem isso ela não tem como decidir', () => {
    expect(codigo).toContain('veioDeParceiro');
    expect(codigo).toContain('dadosVieramDoParceiro');
    expect(codigo).toContain('confirmandoDados');
  });

  /**
   * 🔴 A DECISÃO PRECISA DERIVAR DOS DADOS, não ser uma constante.
   *
   * Checar que a palavra `confirmandoDados` existe não prova nada: trocá-la por `false`
   * deixa a tela pedindo tudo de novo e o guarda verde. Foi o que a sabotagem mostrou, em
   * 10/09/2026, antes deste caso existir.
   */
  it('e a decisão DERIVA da origem — não é constante', () => {
    expect(codigo).toMatch(/const confirmandoDados = dadosVieramDoParceiro && !corrigindo;/);
  });

  it('só confirma quando os QUATRO campos vieram — um faltando e ela pede', () => {
    // Confirmar um CPF que não chegou mostraria um campo vazio como se fosse dado do paciente.
    expect(codigo).toMatch(
      /veioDeParceiro &&\s*nomeInicial &&\s*emailInicial &&\s*telefoneInicial &&\s*cpfInicial/,
    );
  });

  /**
   * 🔴 CONFIRMAR NÃO É ESCONDER.
   *
   * Se a Greens mandar um telefone errado, o paciente precisa poder consertar — senão o erro
   * vira definitivo justamente no cadastro que deveria facilitar a vida dele. Um "conserto"
   * que removesse o caminho de correção passaria neste arquivo sem este caso.
   */
  it('e há caminho de correção — o dado errado do parceiro não vira definitivo', () => {
    expect(codigo).toContain('setCorrigindo(true)');
    expect(codigo).toMatch(/Corrigir/);
  });

  it('os quatro dados aparecem na tela de confirmação, não ficam invisíveis', () => {
    const i = codigo.indexOf('Confirme seus dados');
    expect(i).toBeGreaterThan(-1);
    const bloco = codigo.slice(i, i + 900);
    for (const rotulo of ['Nome', 'CPF', 'Telefone', 'E-mail']) {
      expect(bloco).toContain(`rotulo="${rotulo}"`);
    }
  });

  it('o CPF chega até a tela — sem ele o fluxo 1 nunca confirma', () => {
    const pagina = readFileSync(
      path.join(process.cwd(), 'app/(auth)/cadastro/[token]/page.tsx'),
      'utf8',
    );
    expect(pagina).toContain('cpfInicial={resultado.cpf}');
    expect(pagina).toContain('veioDeParceiro={!!resultado.parceiro}');
  });
});
