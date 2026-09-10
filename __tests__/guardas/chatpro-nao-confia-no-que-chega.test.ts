/**
 * Guarda: a integração com o ChatPro não confia no que chega, e não guarda o que não deve.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * A documentação do ChatPro **não descreve** assinatura de webhook, segredo compartilhado
 * nem IPs de origem — o painel expõe só o campo "Webhook url". Quem descobrir a URL pode
 * enviar um POST falso. E o que trafega aqui é conversa de paciente, ou seja, dado de saúde:
 * dado sensível sob o art. 11 da LGPD.
 *
 * Como não existe assinatura para verificar, a segurança é feita em camadas — e cada camada
 * é uma regra que, se alguém remover "para simplificar", abre um buraco que ninguém percebe
 * em revisão de código. É isso que este guarda protege.
 *
 * As regras vêm das ADR-0002, 0003 e 0005 do greens-corp, onde esta integração já roda em
 * produção. O comportamento atravessa; a stack (Express/Prisma → Next/Drizzle) não.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { segredosConferem, lerSegredoDoCabecalho } from '../../lib/chatpro/segredo';
import {
  mascararEmail,
  mascararTelefone,
  normalizarTelefoneWhatsapp,
  removerSufixoWhatsapp,
} from '../../lib/chatpro/telefone';
import {
  descreverValidade,
  montarMensagemDoLink,
  primeiroNomeDe,
} from '../../lib/chatpro/mensagem-do-link';

const RAIZ = join(import.meta.dirname, '..', '..');
const fonte = (a: string) => readFileSync(join(RAIZ, a), 'utf8');

/** Código sem comentários — proibir o código não pode significar proibir a explicação. */
const codigo = (a: string) =>
  fonte(a)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const CLIENTE = 'lib/chatpro/cliente.ts';
const SERVICO = 'lib/chatpro/solicitacao.ts';
const SEGREDO = 'lib/chatpro/segredo.ts';
const BOT_LINK = 'app/api/chatpro/bot-link/route.ts';
const INTAKE = 'app/api/chatpro/intake/route.ts';
const START = 'app/api/chatpro/start/route.ts';
const WEBHOOK = 'app/api/chatpro/webhook/[pathToken]/route.ts';
const SCHEMA_SOLICITACAO = 'db/schema/solicitacoes-cadastro.ts';
const SCHEMA_EVENTOS = 'db/schema/chatpro-eventos.ts';

// ═══════════════════════════════════════════════════════════════════════════════
// 1. SEGREDO SE COMPARA EM TEMPO CONSTANTE
// ═══════════════════════════════════════════════════════════════════════════════

describe('o segredo nunca é comparado com ===', () => {
  it('a comparação CHAMA timingSafeEqual — não basta importar', () => {
    // ⚠️ A primeira versão deste caso checava `/timingSafeEqual/` no arquivo inteiro, e a
    // sabotagem que trocou o `return` por `recebido === esperado` passou VERDE: o import
    // continuava lá. Checar menção aprova código que não usa o que importou.
    const t = codigo(SEGREDO);
    expect(t, 'timingSafeEqual não é chamado').toMatch(/return\s+timingSafeEqual\(/);
    expect(t).toMatch(/createHash\('sha256'\)/);
  });

  it('🔴 o segredo NUNCA é comparado com === ou !==', () => {
    // O caso que a sabotagem 1 exigiu. Comparação de string do JS retorna no primeiro
    // caractere diferente — é o ataque de temporização, e é prático.
    const t = codigo(SEGREDO);
    expect(
      /(recebido|esperado)\s*[=!]==\s*(recebido|esperado)/.test(t),
      'há comparação direta de segredo',
    ).toBe(false);
  });

  it('segredos iguais conferem', () => {
    expect(segredosConferem('abc123', 'abc123')).toBe(true);
  });

  it.each([
    ['diferentes', 'abc123', 'abc124'],
    ['tamanhos diferentes', 'abc', 'abcdefgh'],
    ['recebido vazio', '', 'abc123'],
    ['esperado vazio', 'abc123', ''],
    ['recebido nulo', null, 'abc123'],
    ['esperado nulo', 'abc123', null],
  ])('%s não conferem', (_rotulo, a, b) => {
    expect(segredosConferem(a as string, b as string)).toBe(false);
  });

  it('tamanhos diferentes NÃO lançam exceção', () => {
    // `timingSafeEqual` exige buffers do mesmo tamanho — comparar o hash resolve isso.
    // Se alguém trocar por comparação direta, isto passa a estourar.
    expect(() => segredosConferem('a', 'aaaaaaaaaaaaaaaaaaaa')).not.toThrow();
  });

  it('aceita o cabeçalho próprio e o Bearer', () => {
    // O painel do ChatPro deixa quem configura o fluxo escolher o campo.
    const proprio = new Headers({ 'x-chatpro-intake-secret': 'segredo' });
    const bearer = new Headers({ authorization: 'Bearer segredo' });
    expect(lerSegredoDoCabecalho(proprio)).toBe('segredo');
    expect(lerSegredoDoCabecalho(bearer)).toBe('segredo');
    expect(lerSegredoDoCabecalho(new Headers())).toBeNull();
  });

  it('toda rota autenticada usa o helper, nenhuma compara à mão', () => {
    for (const rota of [BOT_LINK, INTAKE, WEBHOOK]) {
      const t = codigo(rota);
      expect(t, `${rota} não usa segredosConferem`).toMatch(/segredosConferem/);
      expect(
        /===\s*(esperado|process\.env\.CHATPRO)/.test(t),
        `${rota} compara segredo com === `,
      ).toBe(false);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. ROTA SEM SEGREDO CONFIGURADO FICA FECHADA
// ═══════════════════════════════════════════════════════════════════════════════

describe('nenhuma rota abre por falta de configuração', () => {
  it.each([
    [BOT_LINK, 'CHATPRO_INTAKE_SECRET'],
    [INTAKE, 'CHATPRO_INTAKE_SECRET'],
    [WEBHOOK, 'CHATPRO_WEBHOOK_PATH_TOKEN'],
  ])('%s recusa quando %s está ausente', (rota, variavel) => {
    // Endpoint que cria cadastro de paciente nunca deve ficar aberto porque alguém
    // esqueceu de configurar o ambiente.
    const t = codigo(rota);
    expect(t).toMatch(new RegExp(`if \\(!esperado\\)`));
    expect(t).toMatch(new RegExp(variavel));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. O WEBHOOK NÃO PROCESSA DENTRO DA REQUISIÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

describe('o webhook grava e responde 202', () => {
  it('responde 202, não 200', () => {
    // 202 é "aceito para processamento posterior". É o contrato com o ChatPro.
    expect(codigo(WEBHOOK)).toMatch(/status:\s*202/);
  });

  it('NÃO chama o cliente do ChatPro dentro da requisição', () => {
    // Confirmação reversa é do processamento. Fazê-la aqui faria o ChatPro atingir o
    // tempo limite e REENTREGAR o mesmo evento — multiplicando o problema.
    const t = codigo(WEBHOOK);
    expect(/ClienteChatpro|buscarContatoPor/.test(t), 'o webhook chama a API na requisição').toBe(
      false,
    );
  });

  it('grava com deduplicação, sem estourar em duplicata', () => {
    // Evento repetido não pode virar erro: o ChatPro reentregaria para sempre.
    expect(codigo(WEBHOOK)).toMatch(/onConflictDoNothing/);
  });

  it('falha ao gravar NÃO vira erro para o ChatPro', () => {
    // Se o nosso banco falhou, o problema é nosso. Devolver erro faria o ChatPro
    // reentregar um evento que talvez já esteja gravado.
    const t = codigo(WEBHOOK);
    expect(t).toMatch(/catch[\s\S]{0,300}ACEITO|catch[\s\S]{0,400}return ACEITO/);
  });

  it('a chave de deduplicação é (evento, sessão, timestamp)', () => {
    expect(codigo(SCHEMA_EVENTOS)).toMatch(
      /uniqueIndex\([^)]*\)\.on\(t\.evento,\s*t\.sessionId,\s*t\.eventoTs\)/,
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. 🔴 LGPD — CONTEÚDO DE CONVERSA NÃO É GRAVADO NEM LOGADO
// ═══════════════════════════════════════════════════════════════════════════════

describe('conteúdo de mensagem nunca entra no banco nem no log', () => {
  it('o webhook limpa o payload antes de gravar', () => {
    const t = codigo(WEBHOOK);
    expect(t).toMatch(/limparPayload/);
    expect(t).toMatch(/CAMPOS_PROIBIDOS/);
  });

  it.each(['message', 'alt_message', 'title', 'url', 'caption', 'body'])(
    'o campo %s está na lista de proibidos',
    (campo) => {
      expect(fonte(WEBHOOK)).toMatch(new RegExp(`'${campo}'`));
    },
  );

  it('a limpeza é RECURSIVA — o conteúdo vem aninhado', () => {
    // `session_data.last_message.message` é o caminho real no payload do ChatPro.
    // Uma limpeza só de primeiro nível deixaria passar.
    expect(codigo(WEBHOOK)).toMatch(/profundidade/);
  });

  it('nenhum log de produção imprime o payload cru do webhook', () => {
    const t = codigo(WEBHOOK);
    expect(
      /console\.(log|info|warn|error)\([^)]*payload[^)]*\)/.test(t),
      'o payload cru vai para o log',
    ).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. 🔴 LGPD — TELEFONE E E-MAIL SÃO MASCARADOS EM LOG
// ═══════════════════════════════════════════════════════════════════════════════

describe('nenhum log carrega telefone ou e-mail inteiro', () => {
  it('mascara telefone', () => {
    expect(mascararTelefone('+5562999997197')).toBe('+556****7197');
    expect(mascararTelefone('5562999997197@s.whatsapp.net')).toBe('5562****7197');
    expect(mascararTelefone(null)).toBe('');
  });

  it('mascara e-mail', () => {
    expect(mascararEmail('maria.souza@gmail.com')).toBe('ma***@gmail.com');
    expect(mascararEmail(null)).toBe('');
  });

  /**
   * Extrai só o que está DENTRO de uma chamada de log.
   *
   * ⚠️ Duas versões anteriores erraram o recorte: a primeira olhava um trecho do arquivo a
   * partir do primeiro `console.info`, e a segunda varria o arquivo inteiro — acusando
   * `telefone: string` (declaração de tipo) e `telefone: params.telefone` (gravação no
   * banco, que É correta). Mascarar é regra de LOG, não de persistência.
   */
  function blocosDeLog(arquivo: string): string[] {
    const t = codigo(arquivo);
    const blocos: string[] = [];
    const re = /console\.(?:info|warn|error|log|debug)\s*\(/g;
    let m: RegExpExecArray | null;

    while ((m = re.exec(t))) {
      let profundidade = 1;
      let i = m.index + m[0].length;
      while (i < t.length && profundidade > 0) {
        if (t[i] === '(') profundidade++;
        else if (t[i] === ')') profundidade--;
        i++;
      }
      blocos.push(t.slice(m.index, i));
    }
    return blocos;
  }

  it('🔴 TODA ocorrência de telefone DENTRO de log está mascarada', () => {
    const blocos = blocosDeLog(SERVICO);
    expect(blocos.length, 'nenhum log encontrado — o parser quebrou').toBeGreaterThan(0);

    const semMascara = blocos
      .flatMap((b) => [...b.matchAll(/telefone:\s*([A-Za-z_$][\w$.]*)/g)].map((x) => x[1]))
      .filter((v) => v !== 'mascararTelefone');

    expect(semMascara, `telefone sem máscara em log: ${semMascara.join(', ')}`).toEqual([]);
  });

  it('🔴 TODA ocorrência de e-mail DENTRO de log está mascarada', () => {
    const semMascara = blocosDeLog(SERVICO)
      .flatMap((b) => [...b.matchAll(/email:\s*([A-Za-z_$][\w$.]*)/g)].map((x) => x[1]))
      .filter((v) => v !== 'mascararEmail');

    expect(semMascara, `e-mail sem máscara em log: ${semMascara.join(', ')}`).toEqual([]);
  });

  it('o extrator de log realmente encontra os logs do serviço', () => {
    // Vacuidade: sem isto, um refactor que renomeasse `console` deixaria os dois casos
    // acima verdes por não achar nada.
    const blocos = blocosDeLog(SERVICO);
    expect(blocos.length).toBeGreaterThanOrEqual(2);
    expect(blocos.some((b) => b.includes('mascararTelefone'))).toBe(true);
  });

  it('CONTROLE: gravar o telefone no banco continua permitido', () => {
    // Mascarar é regra de LOG, não de persistência: o número precisa existir inteiro no
    // banco para o link chegar ao paciente. Sem este caso, alguém "corrigiria" o guarda
    // até o sistema parar de funcionar.
    expect(codigo(SERVICO)).toMatch(/telefone: params\.telefone/);
  });

  it('nenhum arquivo do módulo loga o telefone sem máscara', () => {
    for (const arquivo of [SERVICO, CLIENTE]) {
      const t = codigo(arquivo);
      expect(
        /console\.\w+\([^)]*telefone:\s*(telefone|phone|numero)[,\s}]/.test(t),
        `${arquivo} loga telefone cru`,
      ).toBe(false);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. NORMALIZAÇÃO DE TELEFONE — a armadilha do sufixo
// ═══════════════════════════════════════════════════════════════════════════════

describe('o telefone do WhatsApp é normalizado antes de qualquer uso', () => {
  it('remove o sufixo do WhatsApp', () => {
    // Todo telefone que chega do ChatPro vem com esse sufixo. Sem remover, a
    // idempotência falha e o paciente recebe dois links.
    expect(removerSufixoWhatsapp('5562999997197@s.whatsapp.net')).toBe('5562999997197');
    expect(removerSufixoWhatsapp('5562999997197@c.us')).toBe('5562999997197');
    expect(removerSufixoWhatsapp('5562999997197')).toBe('5562999997197');
  });

  it.each([
    ['com sufixo', '5562999997197@s.whatsapp.net'],
    ['com DDI', '5562999997197'],
    ['com mais', '+55 62 99999-7197'],
    ['com máscara', '(62) 99999-7197'],
  ])('%s normaliza para E.164', (_rotulo, entrada) => {
    expect(normalizarTelefoneWhatsapp(entrada)).toBe('+5562999997197');
  });

  it.each([
    ['vazio', ''],
    ['só letras', 'nao-tenho'],
    ['curto demais', '123'],
    ['nulo', null],
  ])('%s devolve null, nunca um palpite', (_rotulo, entrada) => {
    // Número inválido que "quase" funciona cria solicitação órfã, e o paciente nunca
    // recebe o link. Devolver null é o que faz a rota recusar cedo.
    expect(normalizarTelefoneWhatsapp(entrada as string)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. O TOKEN DO LINK SÓ EXISTE EM HASH
// ═══════════════════════════════════════════════════════════════════════════════

describe('o token nunca é guardado em claro', () => {
  it('o schema guarda hash, não o token', () => {
    const t = fonte(SCHEMA_SOLICITACAO);
    expect(t).toMatch(/tokenHash/);
    expect(/(\s|')token'?:\s*text\('token'\)/.test(t), 'existe coluna de token em claro').toBe(
      false,
    );
  });

  it('o serviço grava o hash e devolve o valor cru só na resposta', () => {
    const t = codigo(SERVICO);
    expect(t).toMatch(/createHash\('sha256'\)/);
    expect(t).toMatch(/tokenHash:\s*hash/);
  });

  it('o token tem 32 bytes de aleatoriedade', () => {
    expect(codigo(SERVICO)).toMatch(/randomBytes\(32\)/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. O `bot-link` RESPONDE TEXTO — a resposta VIRA a mensagem do paciente
// ═══════════════════════════════════════════════════════════════════════════════

describe('a resposta do bot-link é a mensagem do WhatsApp', () => {
  it('responde text/plain, nunca JSON', () => {
    // O bloco "Requisição externa" entrega o CORPO da resposta na conversa. JSON aqui
    // faria o paciente receber chaves e colchetes.
    const t = codigo(BOT_LINK);
    expect(t).toMatch(/text\/plain/);
    expect(/NextResponse\.json/.test(t), 'o bot-link responde JSON').toBe(false);
  });

  it('erro responde status NÃO-2xx, de propósito', () => {
    // É isso que dispara a "Ação em caso de falha" do painel e transfere para um humano.
    const t = codigo(BOT_LINK);
    expect(t).toMatch(/textoPuro\([^)]*,\s*(422|500)\)/);
  });

  it('a mensagem inclui link, protocolo e validade', () => {
    const texto = montarMensagemDoLink({
      primeiroNome: 'Maria',
      linkDeAcesso: 'https://exemplo.com/cadastro/abc',
      protocolo: 'SOL-000123',
      validadeEmHoras: 168,
      reaproveitou: false,
    });
    expect(texto).toContain('https://exemplo.com/cadastro/abc');
    expect(texto).toContain('SOL-000123');
    expect(texto).toContain('7 dias');
    expect(texto).toContain('Maria');
  });

  it('a abertura muda quando a solicitação foi reaproveitada', () => {
    // Receber a mesma frase duas vezes faz o paciente achar que abriu uma segunda
    // solicitação — e isso gera atendimento, que é o que o link existe para evitar.
    const nova = montarMensagemDoLink({
      primeiroNome: 'Ana',
      linkDeAcesso: 'x',
      protocolo: 'SOL-1',
      validadeEmHoras: 24,
      reaproveitou: false,
    });
    const reaproveitada = montarMensagemDoLink({
      primeiroNome: 'Ana',
      linkDeAcesso: 'x',
      protocolo: 'SOL-1',
      validadeEmHoras: 24,
      reaproveitou: true,
    });
    expect(nova).not.toBe(reaproveitada);
    expect(reaproveitada).toMatch(/mesmo protocolo/i);
  });

  it.each([
    [168, '7 dias'],
    [24, '1 dia'],
    [12, '12 horas'],
    [1, '1 hora'],
  ])('validade de %s horas vira "%s"', (horas, esperado) => {
    // Nada de "dia(s)": o plural do programador não aparece na tela do paciente.
    expect(descreverValidade(horas as number)).toBe(esperado);
  });

  it('sem nome, a saudação não fica quebrada', () => {
    const texto = montarMensagemDoLink({
      primeiroNome: null,
      linkDeAcesso: 'x',
      protocolo: 'SOL-1',
      validadeEmHoras: 24,
      reaproveitou: false,
    });
    expect(texto).not.toMatch(/Perfeito,\s*!/);
    expect(primeiroNomeDe('Maria Aparecida Souza')).toBe('Maria');
    expect(primeiroNomeDe(null)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. O `instance-token` VIVE EM UM LUGAR SÓ
// ═══════════════════════════════════════════════════════════════════════════════

describe('a credencial da API do ChatPro é lida por um arquivo só', () => {
  it('só o cliente lê CHATPRO_INSTANCE_TOKEN', () => {
    // Esse token dá acesso a TODAS as conversas de pacientes da instância. Isolá-lo é o
    // que torna a rotação viável e a auditoria possível.
    // ⚠️ `lib/env.ts` é exceção declarada: ele DECLARA a variável no schema de validação,
    // não a consome para chamar a API. Sem essa exceção o guarda proibiria validar o
    // ambiente — que é justamente o que impede a aplicação de subir mal configurada.
    const leitores = varrer(['app', 'lib', 'components'])
      .filter((a) => a !== CLIENTE && a !== 'lib/env.ts')
      .filter((a) => /CHATPRO_INSTANCE_TOKEN/.test(codigo(a)));
    expect(leitores, `a credencial é lida fora do cliente: ${leitores.join(', ')}`).toEqual([]);
  });

  it('CONTROLE: env.ts pode declarar a variável, e continua declarando', () => {
    // Vacuidade ao contrário: se alguém remover a declaração para "passar no guarda", a
    // aplicação volta a subir sem validar o ambiente.
    expect(codigo('lib/env.ts')).toMatch(/CHATPRO_INSTANCE_TOKEN/);
  });

  it('o cliente não faz chamada quando não está configurado', () => {
    const t = codigo(CLIENTE);
    expect(t).toMatch(/estaConfigurado\(\)/);
    // Valor de preenchimento conta como NÃO configurado: com token falso a API responde
    // 401, e descartaríamos eventos legítimos como se fossem falsos.
    expect(t).toMatch(/VALORES_DE_PREENCHIMENTO/);
  });

  it('toda chamada externa tem tempo limite', () => {
    expect(codigo(CLIENTE)).toMatch(/AbortSignal\.timeout/);
  });

  it('não tenta de novo em 4xx', () => {
    // 4xx é erro nosso: instância errada, campo faltando. Repetir não resolve e só
    // multiplica a carga.
    const t = codigo(CLIENTE);
    expect(t).toMatch(/STATUS_QUE_VALE_TENTAR_DE_NOVO/);
    expect(t).toMatch(/429/);
    expect(/RETRYABLE[\s\S]{0,60}\b40[0-9]\b/.test(t), '4xx entrou na lista de retry').toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10. O `start` NÃO ACEITA TELEFONE SOZINHO SEM CONFIRMAÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

describe('o link público não vaza o nome de quem tem o telefone conhecido', () => {
  it('sem confirmação, exige o identificador — telefone sozinho não basta', () => {
    // Telefone é adivinhável. Quem soubesse o número de um paciente descobriria o nome
    // dele no pré-preenchimento do formulário.
    const t = codigo(SERVICO);
    expect(t).toMatch(/CHATPRO_START_SEM_CONFIRMACAO/);
    expect(t).toMatch(/!leadId/);
  });

  it('a origem não verificada é registrada, e não some no meio', () => {
    // O formulário usa a origem para decidir se pré-preenche o nome.
    expect(codigo(SERVICO)).toMatch(/chatpro_start_nao_verificado/);
  });

  it('o start SEMPRE redireciona, nunca mostra erro técnico', () => {
    const t = codigo(START);
    expect(t).toMatch(/NextResponse\.redirect/);
    expect(/status:\s*(4\d\d|5\d\d)/.test(t), 'o start devolve erro na tela do paciente').toBe(
      false,
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 11. O TOKEN DO LINK — busca por hash, uso único, e sem vazar o que existe
// ═══════════════════════════════════════════════════════════════════════════════

const TOKEN_CADASTRO = 'lib/chatpro/token-de-cadastro.ts';
const ROTA_SOLICITACAO = 'app/api/chatpro/solicitacao/[token]/route.ts';

describe('o link do paciente vale uma vez, e o banco nunca guarda o token', () => {
  it('🔴 a busca é pelo HASH do token, nunca pelo token', () => {
    // Guardar o token cru significaria que quem lê o banco pode abrir o cadastro de
    // qualquer paciente. O hash torna o vazamento do banco insuficiente.
    const t = codigo(TOKEN_CADASTRO);
    expect(t, 'a busca deixou de usar o hash').toMatch(
      /eq\(solicitacoesCadastro\.tokenHash,\s*hashDoToken\(/,
    );
    expect(
      /eq\(solicitacoesCadastro\.tokenHash,\s*(limpo|token)\s*\)/.test(t),
      'o token cru virou chave de busca',
    ).toBe(false);
  });

  it('🔴 o formato é conferido ANTES de consultar o banco', () => {
    // Sem isso a tabela vira oráculo: qualquer string dispara uma consulta, e o tempo de
    // resposta passa a ser sinal. Também evita varredura barata.
    const t = codigo(TOKEN_CADASTRO).replace(/\s+/g, ' ');
    expect(t).toMatch(
      /\/\^\[a-f0-9\]\{64\}\$\/i\.test\([\s\S]{0,80}motivo: 'invalido'[\s\S]*?db\s*\.select/,
    );
  });

  it('🔴 os quatro estados de recusa existem e são distintos', () => {
    const t = codigo(TOKEN_CADASTRO);
    for (const motivo of ['invalido', 'expirado', 'ja_utilizado', 'cancelado']) {
      expect(t.includes(`'${motivo}'`), `o estado ${motivo} sumiu`).toBe(true);
    }
  });

  it('🔴 inexistente e apagada respondem a MESMA coisa', () => {
    // Distinguir os dois confirma a existência de um protocolo a quem chutou o token.
    expect(codigo(TOKEN_CADASTRO).replace(/\s+/g, ' ')).toMatch(
      /if \(!linha \|\| linha\.deletedAt\) return \{ valida: false, motivo: 'invalido' \}/,
    );
  });

  it('🔴 o consumo do link decide no BANCO, não num if antes do update', () => {
    // Ler-depois-escrever abre janela para o duplo clique do paciente gravar duas vezes.
    const t = codigo(TOKEN_CADASTRO).replace(/\s+/g, ' ');
    expect(t, 'a condição de uso único saiu do UPDATE').toMatch(
      /usadoEm: new Date\(\)[\s\S]{0,140}isNull\(solicitacoesCadastro\.usadoEm\)/,
    );
  });

  it('o primeiro acesso só é gravado uma vez', () => {
    expect(codigo(TOKEN_CADASTRO).replace(/\s+/g, ' ')).toMatch(
      /primeiroAcessoEm: new Date\(\)[\s\S]{0,200}isNull\(solicitacoesCadastro\.primeiroAcessoEm\)/,
    );
  });

  it('🔴 a rota NÃO escreve nada quando o token é inválido', () => {
    // Um token chutado não deve produzir efeito colateral nenhum — nem carimbo de acesso.
    const t = codigo(ROTA_SOLICITACAO).replace(/\s+/g, ' ');
    expect(t).toMatch(/if \(!resultado\.valida\)[\s\S]*?return[\s\S]*?registrarPrimeiroAcesso\(/);
  });

  it('a rota não devolve dado clínico — só o que o paciente digitou no bot', () => {
    // ⚠️ CADA PADRÃO TEM LIMITE DE PALAVRA, e o motivo é um falso positivo real: a
    // primeira versão usava a substring solta `cid` e ficou VERMELHA por casar dentro
    // de "des-cid-a" (`desconhecida`, na mensagem de erro). É a mesma classe de defeito
    // que já apareceu quatro vezes neste repositório — checagem que confunde a menção
    // com o uso. Substring curta precisa de âncora, sempre.
    const t = codigo(ROTA_SOLICITACAO);
    const PROIBIDOS = [
      /\bprescric\w*/i,
      /\bdiagnostic\w*/i,
      /\bcid\b|\bcid[-_]?10\b/i,
      /\blaudo\w*/i,
      /\bmedicament\w*/i,
      /\bdosagem\w*/i,
      /\banamnese\w*/i,
    ];
    for (const padrao of PROIBIDOS) {
      expect(padrao.test(t), `a rota expõe ${padrao}`).toBe(false);
    }
  });

  it('CONTROLE: a âncora funciona — "desconhecida" NÃO é acusada de conter CID', () => {
    // Este caso existe porque o falso positivo acima foi real. Se alguém remover o
    // `\b`, este teste fica vermelho e nomeia exatamente o motivo.
    expect(/\bcid\b/i.test('erro.message : desconhecida')).toBe(false);
    expect(/\bcid\b/i.test('o campo CID do laudo')).toBe(true);
  });

  it('CONTROLE: os campos de pré-preenchimento CONTINUAM saindo', () => {
    // Sem este caso, o anterior seria satisfeito por uma rota que não devolve nada.
    const t = codigo(ROTA_SOLICITACAO);
    for (const campo of ['protocolo', 'nomeCompleto', 'email', 'telefone']) {
      expect(t.includes(campo), `o campo ${campo} sumiu da resposta`).toBe(true);
    }
  });
});

// ── varredura ──────────────────────────────────────────────────────────────────

function varrer(raizes: string[]): string[] {
  const saida: string[] = [];
  const anda = (rel: string) => {
    const abs = join(RAIZ, rel);
    if (!existsSync(abs)) return;
    for (const e of readdirSync(abs, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const filho = `${rel}/${e.name}`;
      if (e.isDirectory()) anda(filho);
      else if (/\.(ts|tsx)$/.test(e.name)) saida.push(filho);
    }
  };
  raizes.forEach(anda);
  return saida;
}
