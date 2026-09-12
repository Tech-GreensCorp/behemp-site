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

  /**
   * 🔴 RETIFICADO em 12/09/2026, e o caso anterior fica escrito porque ensina mais que o novo.
   *
   * Ele dizia, no comentário: _"Um destino que não existe manda o paciente para um 404 no
   * melhor momento dele"_ — e então comparava `Object.values(DESTINOS)` com uma lista FIXA
   * que continha **dois destinos inexistentes**:
   *
   *     '/agendamento'            → o disco só tem /paciente/agendamento
   *     '/paciente/teleconsulta'  → o disco só tem /paciente/teleconsulta/[roomId]
   *
   * ⚠️ O GUARDA CONGELOU O DEFEITO EM VEZ DE DETECTÁ-LO. Ele ficava verde enquanto quase
   * todo paciente vindo da Greens caía em 404 depois do cadastro — e ficaria VERMELHO na hora
   * em que alguém consertasse. É o oposto do que um guarda existe para fazer.
   *
   * A causa é de classe e está na técnica: **lista paralela**. Uma lista escrita à mão não
   * verifica o mundo, afirma o que o autor acreditava sobre ele. Quem confere destino contra
   * o DISCO é `todo-destino-e-uma-rota-que-existe`, e é lá que este caso mora agora.
   *
   * O que fica aqui é a outra metade, que aquele guarda não cobre: os nomes das chaves. Se
   * alguém acrescentar um destino, este caso fica vermelho e obriga a decidir quando ele vale
   * — porque `destinoDepoisDoCadastro` precisa de um ramo para ele.
   */
  it('🔴 os destinos declarados são exatamente os três que a decisão sabe escolher', () => {
    expect(Object.keys(DESTINOS).sort()).toEqual(['agendamento', 'anvisa', 'teleconsulta']);
  });

  it('⚠️ e nenhum deles é uma rota de primeiro nível — todas vivem sob /paciente', () => {
    // Foi o formato do erro nos dois casos: `/agendamento` em vez de `/paciente/agendamento`.
    // A existência real é conferida contra o disco em `todo-destino-e-uma-rota-que-existe`.
    for (const destino of Object.values(DESTINOS)) {
      expect(destino.startsWith('/paciente/'), `${destino} não está sob /paciente`).toBe(true);
    }
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
  /**
   * 🔴 AMPLIADO EM 11/09/2026 (Item 33) — a declaração passou a ser PERSISTIDA.
   *
   * Até aqui a única forma de saber "ele já respondeu?" era a ORIGEM: quem veio do formulário
   * da Greens tinha respondido lá. Isso deixava de fora quem já respondeu **numa passagem
   * anterior por esta mesma tela** — caso real quando o bot reemite o link para a mesma
   * pessoa.
   *
   * E havia um defeito de acoplamento que só apareceu ao separar: uma flag só decidia AS DUAS
   * perguntas. Quem vinha do formulário da Greens não era perguntado sobre a receita — e lá
   * ninguém pergunta sobre receita. O destino saía errado por isso.
   */
  it('não pergunta a quem já respondeu — pela origem OU pela declaração gravada', () => {
    expect(codigo).toMatch(/!jaDeclarouSobreAnvisa &&/);
    const pagina = readFileSync(
      path.join(process.cwd(), 'app/(auth)/cadastro/[token]/page.tsx'),
      'utf8',
    );
    // pela ORIGEM, nunca pelo `parceiro` — o bot da Greens também grava `parceiro: 'greens'`
    expect(pagina).toContain("resultado.origem === 'greens_handoff'");
    expect(pagina).not.toMatch(/jaDeclarouSobreAnvisa=\{resultado\.parceiro/);
    // e pela declaração já gravada
    expect(pagina).toContain('resultado.declarouTerAutorizacaoAnvisa !== null');
  });

  it('🔴 a pergunta da RECEITA tem a própria flag — não a da ANVISA', () => {
    expect(codigo).toMatch(/!jaDeclarouSobreReceita &&[\s\S]{0,120}'receita_medica'/);
    // O acoplamento antigo: a flag da ANVISA decidindo a pergunta da receita.
    expect(codigo).not.toMatch(/!jaDeclarouSobreAnvisa &&[\s\S]{0,120}'receita_medica'/);
  });

  /**
   * ⚠️ MEDE A GRAVAÇÃO NO `.set()`, não a presença da palavra no arquivo.
   *
   * A primeira versão passava verde com a gravação removida: `declarouTerAutorizacaoAnvisa`
   * também aparece no `dadosDepois` da auditoria, e o `toContain` se satisfazia com isso.
   * Auditoria não é persistência — foi exatamente o defeito que o Item 33 existe para
   * corrigir.
   */
  it('🔴 o cadastro GRAVA a declaração na coluna, não só no log de auditoria', () => {
    const acao = readFileSync(
      path.join(process.cwd(), 'app/_actions/cadastro-por-link.ts'),
      'utf8',
    );
    const update = acao.slice(
      acao.indexOf('.update(solicitacoesCadastro)'),
      acao.indexOf('.where(eq(solicitacoesCadastro.id, solicitacao.id))'),
    );
    expect(update.length).toBeGreaterThan(100);
    expect(update).toContain('declarouTerAutorizacaoAnvisa:');
    expect(update).toContain('declarouTerReceitaMedica:');
  });

  it('🔴 e grava com `?? null` — `Boolean()` apagaria o "nunca respondeu"', () => {
    const acao = readFileSync(
      path.join(process.cwd(), 'app/_actions/cadastro-por-link.ts'),
      'utf8',
    );
    const update = acao.slice(
      acao.indexOf('.update(solicitacoesCadastro)'),
      acao.indexOf('.where(eq(solicitacoesCadastro.id, solicitacao.id))'),
    );
    expect(update).toMatch(/declarouTerAutorizacaoAnvisa: dados\.temAutorizacaoAnvisa \?\? null/);
    expect(update).toMatch(/declarouTerReceitaMedica: dados\.temReceitaMedica \?\? null/);
    expect(update).not.toMatch(/Boolean\(dados\.tem/);
  });

  it('a coluna é anulável — NOT NULL destruiria o terceiro estado', () => {
    const schema = readFileSync(
      path.join(process.cwd(), 'db/schema/solicitacoes-cadastro.ts'),
      'utf8',
    );
    for (const col of ['declarou_ter_autorizacao_anvisa', 'declarou_ter_receita_medica']) {
      const linha = schema.split('\n').find((l) => l.includes(col));
      expect(linha, col).toBeDefined();
      expect(linha, col).not.toContain('notNull()');
    }
  });

  it('e "declarou que NÃO tem" também conta como já respondido', () => {
    const pagina = readFileSync(
      path.join(process.cwd(), 'app/(auth)/cadastro/[token]/page.tsx'),
      'utf8',
    );
    // `!== null` e não `=== true`: quem respondeu "não" já respondeu.
    expect(pagina).not.toMatch(/declarouTerAutorizacaoAnvisa === true/);
    expect(pagina).not.toMatch(/declarouTerReceitaMedica === true/);
  });

  it('o campo de arquivo só nasce depois do "sim"', () => {
    expect(codigo).toMatch(/\{temAnvisa === true && \(/);
    expect(codigo).toContain('type="file"');
  });

  it('e trocar para "ainda não" descarta o arquivo — não se grava contradição', () => {
    const i = codigo.indexOf('setTemAnvisa(opcao.valor)');
    const bloco = codigo.slice(i, i + 400);
    // Desde a P3 os anexos vivem num mapa: descartar é remover a chave.
    expect(bloco).toContain("escolherAnexo('autorizacao_anvisa', null)");
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
    /**
     * Desde a P3 os anexos chegam como LISTA, com o tipo em cada item — cinco campos
     * nomeados viravam cinco lugares para esquecer um. O que o guarda exige é que
     * `receita_medica` continue sendo um tipo aceito.
     */
    expect(action).toMatch(/anexos: z\s*\n?\s*\.array\(/);
    expect(action).toContain("'receita_medica',");
  });
});

/**
 * P3 — O FORMULÁRIO É UM SÓ, e mostra o que falta.
 *
 * Cinco dos oito fluxos pedem o "formulário completo". A decisão D-05 da ADR-0021 rejeitou um
 * formulário por fluxo: cinco telas divergem na primeira mudança. O que existe é uma tela que
 * oferece anexo para cada documento PENDENTE — quem veio do parceiro com tudo não vê campo
 * nenhum; quem veio do bot vê todos.
 */
describe('o formulário oferece anexo para o que falta', () => {
  it('a lista de anexos sai das pendências, não de uma lista fixa', () => {
    expect(codigo).toContain('const documentosParaAnexar = pendencias.filter(');
    expect(codigo).toContain('documentosParaAnexar.map(');
  });

  it('receita e ANVISA ficam fora dessa lista — têm bloco próprio, com pergunta', () => {
    // Repeti-las pediria o mesmo arquivo duas vezes na mesma tela.
    expect(codigo).toMatch(/p\.chave !== 'receita_medica' && p\.chave !== 'autorizacao_anvisa'/);
  });

  it('o bloco some quando não falta documento nenhum', () => {
    // Um "Seus documentos" vazio afirmaria que algo falta quando nada falta.
    expect(codigo).toContain('documentosParaAnexar.length > 0');
  });

  /**
   * 🔴 UM MAPA, NÃO UM ESTADO POR DOCUMENTO.
   *
   * Cinco estados nomeados são cinco lugares para esquecer um — e o esquecido some em
   * silêncio, porque anexo que não sobe não dá erro: vira pendência.
   */
  it('os anexos vivem num mapa por tipo', () => {
    expect(codigo).toMatch(/useState<Record<string, File>>\(\{\}\)/);
    expect(codigo).toContain('const escolherAnexo = (tipo: string, arquivo: File | null)');
  });

  it('o limite de tamanho está no ponto único que recebe todos os anexos', () => {
    const i = codigo.indexOf('const escolherAnexo =');
    expect(codigo.slice(i, i + 500)).toMatch(/8 \* 1024 \* 1024/);
  });
});

/**
 * P5 (parte) — O CONSENTIMENTO É OBJETO VERSIONADO, e o texto é o da Greens.
 *
 * O dono mandou reusar o consentimento do formulário completo deles, e ele é bom por um
 * motivo verificável: cada escolha de redação responde a um artigo da LGPD. O módulo registra
 * quais, para que ninguém "simplifique" o texto sem saber o que está removendo.
 */
describe('o consentimento tem versão, texto e finalidades separadas', () => {
  const consentimento = readFileSync(
    path.join(process.cwd(), 'lib/parceiros/consentimento.ts'),
    'utf8',
  );

  it('o texto apresentado vive no código, não só na tela', () => {
    // O que vale é o que a pessoa LEU. Guardar só uma referência não prova a que ela disse sim.
    expect(consentimento).toContain('TEXTO_DO_CONSENTIMENTO');
    expect(consentimento).toMatch(/duas finalidades/);
  });

  it('tem versão — art. 8º §6º só funciona se soubermos a QUE texto ele disse sim', () => {
    expect(consentimento).toContain('VERSAO_DO_CONSENTIMENTO');
  });

  it('as finalidades são separadas — consentimento é específico (art. 11, I)', () => {
    // Um booleano impediria aceitar a avaliação médica e recusar o retorno à Greens.
    expect(consentimento).toContain('avaliacaoMedica');
    expect(consentimento).toContain('retornoAoParceiro');
  });

  it('🔴 o registro prevê revogação — sem ela é autorização perpétua', () => {
    expect(consentimento).toMatch(/revogadoEm: Date \| null/);
  });

  it('e a fundamentação de cada escolha de redação está escrita', () => {
    for (const artigo of ['art. 11, I', 'art. 8º, §4º', 'art. 9º, V', 'art. 8º, §6º']) {
      expect(consentimento).toContain(artigo);
    }
  });
});

/**
 * P4 — a tela de escolha, e P2 — o aviso da procuração.
 *
 * As duas peças menores da ADR-0021, e as duas têm a mesma armadilha: são telas que parecem
 * decorativas e não são. A P4 evita que o paciente de recompra tente criar conta que já existe;
 * a P2 é o único lugar onde a declaração "não tenho ANVISA" vira ação.
 */
describe('P4 — a tela de escolha não obriga a acertar de primeira', () => {
  const tela = readFileSync(path.join(process.cwd(), 'app/(auth)/acesso/page.tsx'), 'utf8');

  it('oferece os dois caminhos', () => {
    expect(tela).toContain('href="/entrar"');
    expect(tela).toContain('href="/registrar-se"');
  });

  /**
   * 🔴 O PACIENTE DE RECOMPRA NÃO LEMBRA SE TEM CONTA AQUI.
   *
   * Ele lembra de ter comprado na Greens. Sem uma saída para a dúvida, escolhe no chute — e
   * metade dos chutes termina em "e-mail já cadastrado", que é um erro que ele não resolve
   * sozinho.
   */
  it('e dá uma saída para quem não sabe responder', () => {
    expect(tela).toMatch(/Não lembra se já tem conta/i);
  });

  it('a rota é pública — quem chega ainda não provou quem é', () => {
    const middleware = readFileSync(path.join(process.cwd(), 'middleware.ts'), 'utf8');
    expect(middleware).toContain("'/acesso',");
  });
});

describe('P2 — o aviso da procuração avisa, não bloqueia', () => {
  const aviso = readFileSync(
    path.join(process.cwd(), 'components/paciente/AvisoDaProcuracao.tsx'),
    'utf8',
  );

  it('só aparece quando a procuração é mesmo necessária', () => {
    expect(aviso).toContain('if (!precisaDaProcuracao || fechado) return null;');
  });

  it('leva à procuração em um clique', () => {
    expect(aviso).toContain('/paciente/anvisa');
    expect(aviso).toMatch(/Fazer a procuração agora/);
  });

  /**
   * 🔴 PODE SER FECHADO — é aviso, não pedágio (ADR-0016 D-06).
   *
   * Barrar quem não tem autorização seria barrar justamente quem veio resolver isso.
   */
  it('pode ser fechado', () => {
    expect(aviso).toContain('setFechado(true)');
  });

  /**
   * ⚠️ E o fechar vale para a SESSÃO, não para sempre.
   *
   * Persistir "ele fechou" esconderia o aviso de quem fechou sem ler, com a autorização ainda
   * faltando — o sistema teria decidido por ele que o assunto acabou.
   */
  /**
   * 🔴 CORRIGIDO EM 11/09/2026 — este caso varria o arquivo COM os comentários e acusou a
   * própria retratação: o texto novo cita o caminho `app/_actions/cadastro-por-link.ts`, e
   * `_actions` casa com `/action/i`.
   *
   * É "menção vs uso", a décima quarta vez desta classe no repositório. O helper
   * `semComentarios` existe neste mesmo arquivo desde sempre — faltava usá-lo aqui.
   */
  it('e fechar não é decisão definitiva — o estado é local', () => {
    expect(aviso).toContain('const [fechado, setFechado] = useState(false)');
    expect(semComentarios(aviso)).not.toMatch(/localStorage|fetch\(|action/i);
  });

  /**
   * ⚠️ O comentário que estava aqui dizia _"a declaração é gravada desde a P1/ANVISA"_ — e
   * **não é**: ela só vai para o log de auditoria (Item 33, medido em 11/09). O caso continua
   * valendo por outro motivo: o aviso oferece a procuração, não reabre o interrogatório.
   */
  it('não pergunta de novo o que o paciente já respondeu no cadastro', () => {
    expect(aviso).not.toMatch(/Você já tem|Sim, já tenho/);
  });
});
