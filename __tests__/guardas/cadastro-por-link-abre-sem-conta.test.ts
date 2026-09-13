/**
 * Guarda: o cadastro que vem do WhatsApp abre para quem AINDA NÃO TEM CONTA — e não
 * confia em nada que o navegador mande.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * O defeito que o originou é o pior tipo: invisível no ambiente de desenvolvimento e fatal
 * em produção.
 *
 * O middleware do Clerk protege TUDO por padrão, e seu matcher declara explicitamente
 * *"sempre roda para API routes"*. Nem `/cadastro/{token}` nem `/api/chatpro/*` estavam na
 * lista de rotas públicas. Em produção isso significaria:
 *
 *   · o paciente clica no link do WhatsApp → é mandado para a tela de LOGIN → e para se
 *     cadastrar precisaria já estar cadastrado. Laço fechado.
 *   · o servidor do ChatPro chama `/bot-link` → recebe um redirect → o bot registra falha
 *     → e o log da aplicação não mostra NADA, porque a requisição nunca chega à rota.
 *
 * E os 31 testes locais passaram verdes: o `.env` de desenvolvimento está sem as chaves do
 * Clerk, e sem elas o middleware não bloqueia coisa alguma. Foi preciso ler o middleware
 * para achar — nenhuma execução acusaria.
 *
 * A lição que este guarda fixa: **teste que passa por ausência de configuração não testou
 * nada.** É a mesma família do que o greens-corp viveu — lá, 72 horas de log vazio que
 * pareciam "não configurado" e eram "o fluxo nunca chegou".
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { cpfEhValido, formatarCpf, mascararCpf } from '../../lib/validacao/cpf';

const RAIZ = join(import.meta.dirname, '..', '..');
const fonte = (a: string) => readFileSync(join(RAIZ, a), 'utf8');

/** Código sem comentários — proibir o código não pode significar proibir a explicação. */
const codigo = (a: string) =>
  fonte(a)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const MIDDLEWARE = 'middleware.ts';
const ACTION = 'app/_actions/cadastro-por-link.ts';
const PAGINA = 'app/(auth)/cadastro/[token]/page.tsx';
const FORM = 'app/(auth)/cadastro/[token]/_components/formulario-de-cadastro.tsx';
const SCHEMA_SOLICITACAO = 'db/schema/solicitacoes-cadastro.ts';
const SCHEMA_PACIENTES = 'db/schema/pacientes.ts';

/** Só o bloco `createRouteMatcher([...])`, para não confundir com menção no resto. */
function listaDeRotasPublicas(): string {
  const t = codigo(MIDDLEWARE);
  const inicio = t.indexOf('createRouteMatcher([');
  expect(inicio, 'o middleware não declara mais rotas públicas').toBeGreaterThan(-1);
  const fim = t.indexOf(']);', inicio);
  return t.slice(inicio, fim);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. AS DUAS ROTAS QUE NÃO PODEM EXIGIR SESSÃO
// ═══════════════════════════════════════════════════════════════════════════════

describe('o middleware deixa passar quem ainda não tem conta', () => {
  it('🔴 /cadastro está entre as rotas públicas', () => {
    // Sem isto o paciente precisa de conta para criar conta.
    expect(listaDeRotasPublicas(), 'o link do WhatsApp voltou a exigir login').toMatch(
      /'\/cadastro\(\.\*\)'/,
    );
  });

  it('🔴 /api/chatpro está entre as rotas públicas', () => {
    // Elas têm autenticação PRÓPRIA (segredo, token no caminho, CRON_SECRET). O Clerk
    // aqui não protege: impede.
    expect(listaDeRotasPublicas(), 'as chamadas do ChatPro voltariam a receber redirect').toMatch(
      /'\/api\/chatpro\(\.\*\)'/,
    );
  });

  it('o matcher continua cobrindo as API routes — a lista pública é o que decide', () => {
    // Se alguém "resolvesse" o problema tirando /api do matcher, TODAS as rotas de API
    // ficariam sem middleware, inclusive as que dependem dele.
    expect(codigo(MIDDLEWARE)).toMatch(/'\/\(api\|trpc\)\(\.\*\)'/);
  });

  it('CONTROLE: as áreas logadas NÃO entraram na lista pública', () => {
    // Sem este caso, o guarda acima seria satisfeito liberando o sistema inteiro.
    const lista = listaDeRotasPublicas();
    for (const area of ['/medico', '/admin', '/paciente']) {
      expect(
        new RegExp(`'${area}\\(`).test(lista),
        `${area} virou público — isso abre a área logada`,
      ).toBe(false);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. O SERVIDOR NÃO CONFIA NA TELA
// ═══════════════════════════════════════════════════════════════════════════════

describe('a action revalida tudo, mesmo o que a página já tinha validado', () => {
  it('🔴 o token é revalidado dentro da action', () => {
    // Entre abrir a tela e enviar existe uma janela: o link pode expirar, ser consumido
    // em outra aba, ou ser cancelado pelo atendimento.
    expect(codigo(ACTION), 'a action passou a confiar na validação da renderização').toMatch(
      /validarTokenDeCadastro\(/,
    );
  });

  it('🔴 o papel do usuário NUNCA vem do formulário', () => {
    // Se viesse, quem abrisse o link escolheria ser admin. OWASP API3, forma mais direta.
    const t = codigo(ACTION);
    expect(t).toMatch(/role:\s*'paciente'/);
    expect(
      /role:\s*(dados|entrada|analise|body|input)\./.test(t),
      'o papel passou a vir da entrada do usuário',
    ).toBe(false);
  });

  it('🔴 a sessão é exigida antes de qualquer escrita', () => {
    const t = codigo(ACTION).replace(/\s+/g, ' ');
    expect(t, 'a action grava sem exigir sessão').toMatch(
      /const \{ userId: clerkId \} = await auth\(\);[\s\S]{0,120}if \(!clerkId\) return falha/,
    );
  });

  it('o CPF é validado no servidor, não só na tela', () => {
    expect(codigo(ACTION)).toMatch(/cpfEhValido\(/);
  });

  it('o e-mail gravado é o CONFIRMADO no Clerk, não o digitado', () => {
    // O digitado pode ter erro de digitação; o confirmado passou pelo código de 6 dígitos.
    expect(codigo(ACTION)).toMatch(/emailAddresses\?\.\[0\]\?\.emailAddress/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. A ORDEM: CONTA PRIMEIRO, FICHA DEPOIS
// ═══════════════════════════════════════════════════════════════════════════════

describe('a ficha clínica só nasce depois da sessão existir', () => {
  /**
   * 🔴 RETIFICADO em 12/09/2026, e o caso anterior fica escrito porque ensina.
   *
   * Ele exigia a adjacência TEXTUAL `await setActive(… concluirCadastroPorLink(` — os dois
   * na mesma sequência de caracteres. Media a FORMA do código, não a garantia.
   *
   * Quando a gravação foi extraída para `gravarFicha()` (para ser chamada também pela
   * retomada de cadastro), o guarda ficou vermelho **sem que a garantia tivesse mudado**:
   * a ficha continua nascendo só depois de existir sessão. É a mesma família do guarda dos
   * destinos que congelava o defeito — asserção presa à escrita envelhece com ela.
   *
   * A GARANTIA, dita como garantia: **toda chamada que grava a ficha acontece com sessão
   * viva.** Hoje há exatamente dois caminhos até ela, e cada um prova a sessão do seu jeito:
   *   1. `confirmarCodigo` — chama depois de `await setActive(…)`;
   *   2. `criarConta` — chama dentro do ramo `if (authCarregou && isSignedIn)`.
   *
   * O caso confere os dois, e o de cobertura abaixo fica vermelho se aparecer um terceiro.
   */
  it('🔴 a ficha só é gravada com SESSÃO VIVA — pelos dois caminhos', () => {
    // Invertido, uma falha na verificação do e-mail deixaria no banco um paciente sem
    // dono: invisível para ele e para o médico.
    const t = codigo(FORM).replace(/\s+/g, ' ');

    // 1 — o caminho normal: confirma o código, ativa a sessão, grava.
    expect(t, 'a ficha passou a ser gravada antes da conta existir').toMatch(
      /await setActive\([\s\S]*?await gravarFicha\(/,
    );

    /**
     * 2 — a retomada: entra só com o Clerk carregado, sessão confirmada, E a sessão sendo
     * de quem o link chama. A terceira condição entrou em 12/09/2026: sem ela, quem abrisse
     * um link alheio estando logado gravaria a ficha do outro na própria conta. Quem
     * garante esse pedaço é `a-sessao-precisa-ser-do-dono-do-link`; aqui basta que a
     * gravação não aconteça sem ele.
     */
    expect(t, 'a retomada grava sem provar de quem é a sessão').toMatch(
      /if \(authCarregou && isSignedIn && !sessaoEDeOutraPessoa\) \{ await gravarFicha\(/,
    );
  });

  it('⚠️ COBERTURA: não existe um TERCEIRO caminho até a gravação', () => {
    // Um caminho novo que não prove sessão deixaria ficha órfã no banco. Se este caso
    // ficar vermelho, é porque alguém acrescentou um — e ele precisa entrar no caso acima.
    const t = codigo(FORM);
    expect((t.match(/await gravarFicha\(\)/g) ?? []).length).toBe(2);
    // E a action continua sendo chamada de um lugar só.
    expect((t.match(/concluirCadastroPorLink\(\{/g) ?? []).length).toBe(1);
  });

  it('🔴 o link só é consumido DEPOIS da ficha gravada', () => {
    // Consumir antes deixaria o paciente sem link E sem cadastro se a gravação falhasse.
    const t = codigo(ACTION).replace(/\s+/g, ' ');
    expect(t).toMatch(/db\.transaction\([\s\S]*?marcarComoUtilizada\(/);
  });

  /**
   * 🔴 O CASO QUE FALTAVA, e a ausência dele deixou a inversão passar em silêncio.
   *
   * O caso acima exige só que o consumo venha **depois da transação** — e isso era verdade
   * nas DUAS ordens. Quando o consumo foi movido (13/09/2026, ADR-0022 G10), o guarda
   * continuou verde sem provar nada sobre o que mudou.
   *
   * ⚠️ O PAR QUE O G10 DESCREVE: queimar o link antes de gravar `pacienteId` na solicitação
   * deixava, numa falha, **link morto + vínculo nulo** ao mesmo tempo. E esse par apaga duas
   * coisas de uma vez:
   *   - `cadastro-pendente.ts` exige `usadoEm IS NULL` → o aviso nunca aparece, e o paciente
   *     não tem como voltar;
   *   - `notificar.ts` acha a solicitação **pelo paciente** → o parceiro nunca é avisado
   *     quando a receita ficar pronta.
   *
   * Invertendo, o pior caso vira link válido de cadastro já vinculado: **recuperável**.
   */
  it('🔴 e DEPOIS do vínculo — senão uma falha apaga o aviso E o retorno ao parceiro', () => {
    const t = codigo(ACTION);
    /**
     * ⚠️ ÂNCORA ESPECÍFICA, e não "o primeiro `update(solicitacoesCadastro)`".
     *
     * Em 13/09/2026 a action ganhou um SEGUNDO update na mesma tabela — o que grava o e-mail
     * corrigido pelo paciente — e ele fica ANTES deste. Três casos deste repositório ficaram
     * vermelhos de uma vez, todos acusando o código certo. É a mesma classe que já custou caro
     * aqui: `indexOf` acha a primeira ocorrência, e a primeira deixa de ser a certa assim que
     * alguém acrescenta outra. **Ancore no que distingue o trecho, não na sua posição.**
     */
    const vinculo = t.indexOf('update(solicitacoesCadastro)', t.indexOf('pacienteId,') - 400);
    const consumo = t.indexOf('marcarComoUtilizada(solicitacao.id)');

    expect(vinculo, 'não achei o update da solicitação').toBeGreaterThan(-1);
    expect(consumo, 'não achei o consumo do link').toBeGreaterThan(-1);
    expect(consumo, 'o link é queimado ANTES de o vínculo existir').toBeGreaterThan(vinculo);
  });

  it('⚠️ e o `pacienteId` é de fato gravado nesse update — não basta a ordem', () => {
    // Ordem certa de um update que não grava o vínculo não protege nada.
    const t = codigo(ACTION);
    const i = t.indexOf('update(solicitacoesCadastro)', t.indexOf('pacienteId,') - 400);
    expect(t.slice(i, t.indexOf('.where(', i))).toMatch(/\bpacienteId,/);
  });

  it('falha ao gravar NÃO manda o paciente recriar a conta', () => {
    // A conta já existe: repetir o formulário falharia com "e-mail já cadastrado", e ele
    // acharia que perdeu tudo.
    expect(codigo(FORM)).toMatch(/Sua conta já foi criada/);
  });
});

describe('o fluxo customizado reserva o lugar do CAPTCHA', () => {
  it('🔴 o formulário tem o elemento `clerk-captcha`', () => {
    // Sem ele o Clerk avisa no console e cai para o CAPTCHA invisível, que decide
    // sozinho se o cadastro passa — sem dar ao paciente forma de provar que é humano.
    // Em fluxo customizado quem reserva o lugar é o desenvolvedor.
    expect(codigo(FORM), 'o elemento do CAPTCHA sumiu do formulário').toMatch(/id="clerk-captcha"/);
  });

  it('o elemento vem ANTES do botão de envio', () => {
    // Abaixo da dobra, o desafio aparece onde o paciente não vê, e ele conclui que o
    // botão parou de funcionar.
    const t = codigo(FORM);
    const captcha = t.indexOf('id="clerk-captcha"');
    /**
     * ⚠️ O botão é localizado pelo TIPO, não pelo texto.
     *
     * Até 10/09/2026 este caso procurava a string "Criar conta e agendar consulta". O texto
     * passou a depender do destino (`textosDoDestino`) — quem vai para a procuração da ANVISA
     * lê outra coisa —, e o guarda quebrou sem que nada de errado tivesse acontecido.
     *
     * Guarda que se apoia em texto de tela quebra na primeira mudança de copy. O que importa
     * aqui é a POSIÇÃO do CAPTCHA em relação ao botão de envio, e `type="submit"` identifica
     * o botão sem depender do que ele diz.
     */
    expect(captcha).toBeGreaterThan(-1);
    /**
     * ⚠️ E o botão procurado é o PRIMEIRO DEPOIS do CAPTCHA.
     *
     * O arquivo tem dois `type="submit"`: o da etapa do código e o do cadastro, com o CAPTCHA
     * entre eles. Pegar o primeiro do arquivo compararia com o botão errado e ficaria vermelho
     * sem defeito nenhum.
     *
     * O que este caso garante é que existe um botão de envio DEPOIS do CAPTCHA — ou seja, que
     * o desafio aparece antes de o paciente tentar enviar, e não abaixo da dobra.
     */
    const botao = t.indexOf('type="submit"', captcha);
    expect(botao, 'não há botão de envio depois do CAPTCHA').toBeGreaterThan(-1);
    expect(captcha, 'o CAPTCHA foi parar depois do botão').toBeLessThan(botao);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. A PERGUNTA CLÍNICA TEM TRÊS ESTADOS, NÃO DOIS
// ═══════════════════════════════════════════════════════════════════════════════

describe('"já faz tratamento" distingue NÃO de NÃO RESPONDEU', () => {
  it.each([
    ['solicitação', SCHEMA_SOLICITACAO, 'jaFazTratamento'],
    ['paciente', SCHEMA_PACIENTES, 'jaFazTratamentoCannabis'],
  ])('🔴 em %s o campo é boolean anulável, sem default', (_rotulo, arquivo, campo) => {
    // `notNull().default(false)` afirmaria "não faz tratamento" sobre quem nunca respondeu
    // — e é justamente essa resposta que muda a conduta do médico na primeira consulta.
    const linha = codigo(arquivo)
      .split('\n')
      .find((l) => l.includes(campo));
    expect(linha, `${campo} sumiu de ${arquivo}`).toBeTruthy();
    expect(linha!).toMatch(/boolean\(/);
    expect(/notNull\(\)/.test(linha!), `${campo} virou obrigatório e perde o "não informado"`).toBe(
      false,
    );
    expect(/default\(/.test(linha!), `${campo} ganhou default e inventa a resposta`).toBe(false);
  });

  it('🔴 a tela exige resposta antes de deixar enviar', () => {
    const t = codigo(FORM);
    expect(t).toMatch(/jaFazTratamento\s*!==\s*null/);
    expect(t).toMatch(/tratamentoRespondido/);
  });

  it('o estado inicial é null, não false', () => {
    expect(codigo(FORM)).toMatch(/useState<boolean \| null>\(null\)/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. LGPD — O QUE NÃO PODE APARECER EM LOG NEM EM AUDITORIA
// ═══════════════════════════════════════════════════════════════════════════════

describe('CPF, telefone e texto clínico não vazam para log nem auditoria', () => {
  it('🔴 nenhum console.* da action imprime dado pessoal', () => {
    const t = codigo(ACTION);
    const blocos: string[] = [];
    const re = /console\.(log|warn|error|info)\s*\(/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(t))) {
      let p = 1;
      let i = re.lastIndex;
      while (i < t.length && p > 0) {
        if (t[i] === '(') p++;
        else if (t[i] === ')') p--;
        i++;
      }
      blocos.push(t.slice(m.index, i));
    }
    expect(blocos.length, 'a action ficou sem log nenhum').toBeGreaterThan(0);
    for (const b of blocos) {
      for (const proibido of ['cpf', 'telefone', 'tratamentoAtual', 'senha', 'email']) {
        expect(
          new RegExp(`\\b${proibido}\\b`, 'i').test(b),
          `${proibido} aparece em log: ${b}`,
        ).toBe(false);
      }
    }
  });

  it('🔴 a auditoria registra o ATO, não o conteúdo', () => {
    // O conteúdo já está na ficha, com controle de acesso. Repeti-lo na auditoria cria
    // uma segunda cópia sem esse controle.
    const t = codigo(ACTION);
    const inicio = t.indexOf('registrarAuditoria({');
    expect(inicio).toBeGreaterThan(-1);
    const bloco = t.slice(inicio, t.indexOf('});', inicio));
    for (const proibido of ['cpf', 'tratamentoAtual', 'telefone', 'nomeCompleto']) {
      expect(new RegExp(`\\b${proibido}\\b`).test(bloco), `${proibido} na auditoria`).toBe(false);
    }
    expect(bloco, 'a auditoria deixou de registrar o protocolo').toMatch(/protocolo/);
  });

  it('a página do link não é indexável', () => {
    // O link é uma credencial: indexar exporia tokens em resultado de busca.
    expect(codigo(PAGINA)).toMatch(/robots:\s*\{\s*index:\s*false/);
  });

  it('🔴 a mensagem de erro capturada não expõe valor de coluna', () => {
    // `erro.message` do Postgres carrega o valor que violou a constraint — e as colunas
    // aqui são CPF, telefone e texto clínico.
    expect(codigo(ACTION)).toMatch(/erro instanceof Error \? erro\.name/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. O CPF É CONFERIDO DE VERDADE
// ═══════════════════════════════════════════════════════════════════════════════

describe('a validação de CPF recusa o que a aritmética recusa', () => {
  it.each(['529.982.247-25', '111.444.777-35', '52998224725'])('aceita %s', (c) => {
    expect(cpfEhValido(c)).toBe(true);
  });

  it.each(['123.456.789-00', '529.982.247-24', '5299822472', '', 'abc'])('recusa %s', (c) => {
    expect(cpfEhValido(c)).toBe(false);
  });

  it.each(['111.111.111-11', '000.000.000-00', '999.999.999-99'])(
    '🔴 recusa o repetido %s, que PASSA na aritmética',
    (c) => {
      // Os onze dígitos iguais fecham os dois verificadores. Sem a recusa explícita, o
      // placeholder mais comum do Brasil entraria como CPF válido.
      expect(cpfEhValido(c)).toBe(false);
    },
  );

  it('mascara para log e formata para tela', () => {
    expect(mascararCpf('52998224725')).toBe('529.***.***-25');
    expect(formatarCpf('52998224725')).toBe('529.982.247-25');
  });
});
