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

import {
  DESTINOS,
  destinoDepoisDoCadastro,
  textosDoDestino,
} from '@/lib/parceiros/destino-do-paciente';

const FORM = 'app/(auth)/cadastro/[token]/_components/formulario-de-cadastro.tsx';
const codigo = readFileSync(path.join(process.cwd(), FORM), 'utf8');

/** Tira comentários de linha e de bloco — o que interessa é o que a tela RENDERIZA. */
function semComentarios(fonte: string): string {
  return fonte
    .split('\n')
    .filter((linha) => !/^\s*(\/\/|\/\*|\*)/.test(linha))
    .join('\n');
}

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

/**
 * O que a tela PROMETE, e o que ela CONFIRMA ter recebido.
 *
 * Dois apontamentos do dono em 10/09/2026, ao ver a tela em produção:
 *
 *   "os 2 tão com nome de criar conta e agendar consulta" — inclusive o do paciente que já
 *   tem receita e vai para a procuração da ANVISA. Prometer consulta a quem não vai ter
 *   consulta confunde no clique e desmente a tela seguinte.
 *
 *   "deveria aparecer também as documentações enviadas não?" — a tela dizia só o que FALTA.
 *   Quem subiu RG e comprovante no formulário da Greens não via confirmação de que chegou.
 */
describe('a tela promete o que vai entregar', () => {
  it('quem vai para a ANVISA não lê "agendar consulta"', () => {
    const t = textosDoDestino(DESTINOS.anvisa);
    expect(t.botao).not.toMatch(/consulta/i);
    expect(t.destaque).toBe('autorização');
  });

  it('quem vai agendar continua lendo consulta', () => {
    const t = textosDoDestino(DESTINOS.agendamento);
    expect(t.botao).toMatch(/consulta/i);
    expect(t.destaque).toBe('consulta');
  });

  it('e a tela usa a função — não texto fixo', () => {
    expect(codigo).toContain('textosDoDestino(');
    expect(codigo).toContain('{textos.botao}');
    expect(codigo).toContain('{textos.destaque}');
    /**
     * ⚠️ E o texto antigo não pode ter sobrado NO JSX.
     *
     * Ele continua no comentário que explica a mudança — e deve continuar, é o registro do
     * porquê. Procurar a string crua acusaria a própria documentação da correção: menção vs
     * uso, a décima vez desta classe no repositório.
     */
    expect(semComentarios(codigo)).not.toContain('Criar conta e agendar consulta');
  });
});

describe('a tela confirma o que já recebeu', () => {
  it('mostra os documentos que o parceiro mandou', () => {
    expect(codigo).toContain('O que já recebemos');
    expect(codigo).toContain('recebidos.map');
  });

  it('e diz que não precisa reenviar — é o que tira a dúvida do paciente', () => {
    expect(codigo).toMatch(/não precisa enviar de novo/i);
  });

  it('o bloco só aparece quando há algo recebido', () => {
    // Um "O que já recebemos" vazio afirmaria que nada chegou, o que é pior que não mostrar.
    expect(codigo).toContain('recebidos.length > 0');
  });

  it('a página calcula os recebidos a partir do manifesto', () => {
    const pagina = readFileSync(
      path.join(process.cwd(), 'app/(auth)/cadastro/[token]/page.tsx'),
      'utf8',
    );
    expect(pagina).toContain('recebidosDe(resultado.documentosDoParceiro)');
  });
});

/**
 * A PERGUNTA DA ANVISA NO CADASTRO — e o que ela habilita depois.
 *
 * Desenho do dono em 10/09/2026, ao ver o fluxo 2: perguntar se ele já tem a autorização e,
 * se tiver, deixar que anexe ali. Se não tiver, o sistema registra — e é essa declaração que
 * permite oferecer a procuração depois da consulta, sem perguntar de novo.
 *
 * 🔴 A DECLARAÇÃO VALE MESMO SEM ARQUIVO. "Não tenho" é informação, não ausência dela. Um
 * "conserto" que só gravasse quando há anexo perderia exatamente o caso que interessa.
 */
describe('a tela pergunta pela ANVISA, e a resposta é gravada', () => {
  it('a pergunta existe', () => {
    expect(codigo).toContain('Você já tem a Autorização de Importação da ANVISA?');
  });

  it('🔴 e só aparece quando a autorização está pendente', () => {
    expect(codigo).toContain('pendencias.some(');
    expect(codigo).toMatch(/\{perguntarSobreAnvisa && \(/);
  });

  /**
   * 🔴 NEM TODA PENDÊNCIA É UMA PERGUNTA EM ABERTO.
   *
   * Quem veio do formulário do parceiro JÁ declarou lá se tem a autorização — e a pendência
   * aqui é a CONSEQUÊNCIA daquela resposta, não uma dúvida nova. Perguntar de novo é pedir
   * que ele responda duas vezes a mesma coisa.
   *
   * Apontado pelo dono em 10/09/2026: "lá ele já marcou a opção que não tem anvisa, então já
   * vem, não precisa perguntá-lo novamente".
   *
   * ⚠️ E `parceiro` NÃO serve para decidir isso: o bot da Greens também grava
   * `parceiro: 'greens'` e não perguntou nada. Quem responde é a ORIGEM.
   */
  it('não pergunta a quem já respondeu no formulário do parceiro', () => {
    expect(codigo).toContain('jaDeclarouSobreAnvisa');
    expect(codigo).toMatch(/!jaDeclarouSobreAnvisa &&/);
    const pagina = readFileSync(
      path.join(process.cwd(), 'app/(auth)/cadastro/[token]/page.tsx'),
      'utf8',
    );
    // pela ORIGEM, não pelo parceiro
    expect(pagina).toContain("jaDeclarouSobreAnvisa={resultado.origem === 'greens_handoff'}");
  });

  it('o campo de arquivo só nasce depois do "sim"', () => {
    expect(codigo).toMatch(/\{temAnvisa === true && \(/);
    expect(codigo).toContain('type="file"');
  });

  it('e trocar para "ainda não" descarta o arquivo — não se grava contradição', () => {
    const i = codigo.indexOf('setTemAnvisa(opcao.valor)');
    const bloco = codigo.slice(i, i + 400);
    expect(bloco).toContain('setArquivoAnvisa(null)');
  });

  it('a declaração é enviada mesmo sem anexo — "não tenho" é informação', () => {
    expect(codigo).toContain('temAutorizacaoAnvisa: perguntarSobreAnvisa ? temAnvisa : null');
  });

  it('o "ainda não" não é beco — a tela diz o que vem depois', () => {
    expect(codigo).toMatch(/procuração da ANVISA fica disponível/i);
  });

  it('a action recebe a declaração e o anexo', () => {
    const action = readFileSync(
      path.join(process.cwd(), 'app/_actions/cadastro-por-link.ts'),
      'utf8',
    );
    expect(action).toContain('temAutorizacaoAnvisa');
    expect(action).toContain('anexoAnvisa');
    expect(action).toContain('anexarDocumentoDoCadastro({');
  });

  it('e o anexo só vira documento DEPOIS de o paciente existir', () => {
    const action = readFileSync(
      path.join(process.cwd(), 'app/_actions/cadastro-por-link.ts'),
      'utf8',
    );
    const criacao = action.indexOf('const pacienteId = await db.transaction');
    const anexo = action.indexOf('anexarDocumentoDoCadastro({');
    expect(anexo).toBeGreaterThan(criacao);
  });

  it('o anexo tem limite de tamanho e tipo, nos DOIS lados', () => {
    // Só no cliente seria conselho: quem manda POST direto ignora.
    expect(codigo).toMatch(/8 \* 1024 \* 1024/);
    const lib = readFileSync(
      path.join(process.cwd(), 'lib/documentos/anexo-do-cadastro.ts'),
      'utf8',
    );
    /**
     * 🔴 DECLARAR A CONSTANTE NÃO É USÁ-LA.
     *
     * A primeira versão deste caso conferia só que os nomes apareciam no arquivo. Trocar
     * `TIPOS_ACEITOS_NO_ANEXO.includes(...)` por `[].includes(...)` mantinha a constante
     * declarada, recusava todo arquivo, e o guarda ficava verde. A sabotagem mostrou isso em
     * 10/09/2026 — décima primeira vez desta classe no repositório.
     *
     * O que importa é a constante aparecer na COMPARAÇÃO, não na declaração.
     */
    expect(lib).toMatch(/TIPOS_ACEITOS_NO_ANEXO\.includes\(/);
    expect(lib).toMatch(/> TAMANHO_MAXIMO_DO_ANEXO/);
  });

  it('e falha de anexo não derruba o cadastro', () => {
    const lib = readFileSync(
      path.join(process.cwd(), 'lib/documentos/anexo-do-cadastro.ts'),
      'utf8',
    );
    expect(lib).toMatch(/catch \(erro\)/);
    expect(lib).toMatch(/return false/);
  });
});

/**
 * A PERGUNTA DA RECEITA — e por que a resposta do paciente vence o manifesto.
 *
 * O bot não sabe o que o paciente já tem. Sem perguntar, o sistema considera que falta tudo e
 * manda todo mundo para o agendamento — inclusive quem só precisa da procuração e já tem
 * receita válida. Era o buraco do fluxo BeHemp 1, apontado em 10/09/2026.
 */
describe('a pergunta da receita, e o destino que a considera', () => {
  it('a pergunta existe', () => {
    expect(codigo).toContain('Você já tem uma receita médica de cannabis medicinal válida?');
  });

  it('e vem ANTES da ANVISA na tela — sem receita não há o que autorizar', () => {
    const receita = codigo.indexOf('{perguntarSobreReceita && (');
    const anvisa = codigo.indexOf('{perguntarSobreAnvisa && (');
    expect(receita).toBeGreaterThan(-1);
    expect(anvisa).toBeGreaterThan(-1);
    expect(receita).toBeLessThan(anvisa);
  });

  /**
   * 🔴 A RESPOSTA DO PACIENTE VENCE O MANIFESTO.
   *
   * O manifesto diz o que o PARCEIRO mandou; a resposta diz o que o PACIENTE tem. Quando
   * discordam, vale o paciente — ele é a fonte sobre a própria vida, e o parceiro pode
   * simplesmente ainda não ter recebido o documento.
   *
   * É a mesma regra que `a-triagem-roteia-e-nao-julga` aplica ao bot.
   */
  it('o destino usa as pendências CORRIGIDAS pelas respostas, não as cruas', () => {
    expect(codigo).toContain('pendenciasDepoisDasRespostas');
    expect(codigo).toMatch(
      /destinoDepoisDoCadastro\(pendenciasDepoisDasRespostas\.map\(\(p\) => p\.chave\)\)/,
    );
    // e as pendências cruas não podem mais alimentar o destino
    expect(codigo).not.toMatch(/destinoDepoisDoCadastro\(pendencias\.map/);
  });

  it('dizer "tenho receita" tira a receita das pendências', () => {
    expect(codigo).toMatch(/p\.chave === 'receita_medica' && temReceita === true/);
  });

  it('dizer "tenho ANVISA" tira a ANVISA das pendências', () => {
    expect(codigo).toMatch(/p\.chave === 'autorizacao_anvisa' && temAnvisa === true/);
  });

  it('o "ainda não" da receita explica o que vem depois', () => {
    expect(codigo).toMatch(/é justamente para isso que existe a teleconsulta/i);
  });

  it('a action recebe a declaração e o anexo da receita', () => {
    const action = readFileSync(
      path.join(process.cwd(), 'app/_actions/cadastro-por-link.ts'),
      'utf8',
    );
    expect(action).toContain('temReceitaMedica');
    expect(action).toContain("tipo: 'receita_medica',");
  });
});
