/**
 * Guarda: a fila do ChatPro processa cada evento UMA vez, e nada de secundário a bloqueia.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * Duas classes de defeito, as duas observadas de verdade na integração equivalente do
 * greens-corp, e nenhuma delas visível em revisão de código:
 *
 * 1. PROCESSAMENTO DUPLICADO (armadilha 7 do handoff de lá). O worker listava os
 *    pendentes e só mudava o status ao TERMINAR. Duas execuções concorrentes — o que
 *    acontece sozinho quando um cron atrasa e o seguinte dispara — pegavam a mesma linha.
 *    O funil registrou 4 etapas onde deviam existir 3. O conserto é claim atômico com
 *    `FOR UPDATE SKIP LOCKED`, e é o tipo de linha que alguém "simplifica" sem saber.
 *
 * 2. O SECUNDÁRIO DERRUBANDO O PRINCIPAL. Traduzir o UUID de um departamento é conforto
 *    de leitura; gravar o evento é dado. Se a tradução virar pré-requisito, uma API do
 *    ChatPro fora do ar passa a significar evento perdido — e evento perdido não volta.
 *
 * E a terceira, que vale para o módulo inteiro: conteúdo de mensagem não entra em lugar
 * nenhum (LGPD art. 11 — conversa de paciente de canabidiol é dado de saúde).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const RAIZ = join(import.meta.dirname, '..', '..');
const fonte = (a: string) => readFileSync(join(RAIZ, a), 'utf8');

/** Código sem comentários — proibir o código não pode significar proibir a explicação. */
const codigo = (a: string) =>
  fonte(a)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const PROCESSADOR = 'lib/chatpro/processador.ts';
const DIRETORIO = 'lib/chatpro/diretorio.ts';
const ROTA = 'app/api/chatpro/processar/route.ts';
const SCHEMA_SESSOES = 'db/schema/chatpro-sessoes.ts';
const SCHEMA_EVENTOS = 'db/schema/chatpro-eventos.ts';
const ENUMS = 'db/schema/enums.ts';

/**
 * Recorta os blocos `console.*(...)` por balanceamento de parênteses.
 *
 * ⚠️ Regex de uma linha NÃO serve: as chamadas deste módulo passam um objeto de várias
 * linhas, e um recorte por linha aprovaria `console.warn('x', { telefone })` só porque o
 * campo está três linhas abaixo. Este erro já aconteceu neste repositório.
 */
function blocosDeLog(arquivo: string): string[] {
  const texto = codigo(arquivo);
  const blocos: string[] = [];
  const re = /console\.(log|warn|error|info|debug)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto))) {
    let profundidade = 1;
    let i = re.lastIndex;
    while (i < texto.length && profundidade > 0) {
      if (texto[i] === '(') profundidade++;
      else if (texto[i] === ')') profundidade--;
      i++;
    }
    blocos.push(texto.slice(m.index, i));
  }
  return blocos;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. O CLAIM É ATÔMICO — a defesa contra processar duas vezes
// ═══════════════════════════════════════════════════════════════════════════════

describe('a reivindicação de eventos é atômica', () => {
  it('🔴 usa FOR UPDATE SKIP LOCKED', () => {
    // Sem isto, duas execuções concorrentes leem as mesmas linhas. É a armadilha 7.
    expect(codigo(PROCESSADOR), 'o claim perdeu o SKIP LOCKED').toMatch(
      /FOR\s+UPDATE\s+SKIP\s+LOCKED/i,
    );
  });

  it('🔴 marca o estado no MESMO comando que seleciona (UPDATE ... WHERE id IN (SELECT', () => {
    // O defeito original era exatamente "seleciona agora, marca depois". A prova de que
    // não voltou é o UPDATE conter o SELECT, não haver dois comandos separados.
    const t = codigo(PROCESSADOR).replace(/\s+/g, ' ');
    expect(t, 'a seleção e a marcação se separaram').toMatch(
      /UPDATE chatpro_eventos SET status = 'processando'[\s\S]*?WHERE id IN \( SELECT/i,
    );
  });

  it('o estado intermediário existe no enum, senão o claim não tem o que gravar', () => {
    expect(codigo(ENUMS), "o enum perdeu 'processando'").toMatch(/'processando'/);
  });

  it('incrementa tentativas dentro do próprio claim', () => {
    // Incrementar depois significa que um processo morto entre a leitura e a escrita
    // devolve o evento à fila com o contador intacto — e ele é tentado para sempre.
    expect(codigo(PROCESSADOR)).toMatch(/tentativas\s*=\s*tentativas\s*\+\s*1/i);
  });

  it('a fila tem teto de tentativas, e o teto é uma constante nomeada', () => {
    const t = codigo(PROCESSADOR);
    expect(t).toMatch(/const MAXIMO_DE_TENTATIVAS\s*=\s*\d+/);
    expect(t, 'o teto não é consultado').toMatch(/MAXIMO_DE_TENTATIVAS/g);
  });

  it("evento que ainda não esgotou volta para 'pendente', não morre em 'processando'", () => {
    // Um evento deixado em 'processando' após uma falha nunca mais é reivindicado:
    // o claim só olha 'pendente'. Vira perda silenciosa de dado.
    const t = codigo(PROCESSADOR).replace(/\s+/g, ' ');
    expect(t, 'a falha não devolve o evento à fila').toMatch(
      /status:\s*esgotou\s*\?\s*'falhou'\s*:\s*'pendente'/,
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. O SECUNDÁRIO NÃO DERRUBA O PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

describe('a tradução do diretório nunca bloqueia o processamento', () => {
  it('🔴 nomeDe devolve o próprio UUID quando não encontra — nunca lança', () => {
    const t = codigo(DIRETORIO);
    expect(t, 'nomeDe passou a devolver vazio em vez do id').toMatch(/linha\?\.nome\s*\?\?\s*id/);
    expect(/throw new/.test(t), 'o diretório lança exceção').toBe(false);
  });

  it('a sincronização devolve `configurado: false` em vez de falhar sem token', () => {
    // Valor de preenchimento não é configuração (armadilha 9 do greens-corp): com token
    // falso a API responde 401, e um cliente ingênuo descartaria eventos legítimos.
    expect(codigo(DIRETORIO)).toMatch(/estaConfigurado\(\)[\s\S]{0,160}configurado:\s*false/);
  });

  it('🔴 a rota sincroniza o diretório SEM condicionar o processamento a ele', () => {
    // A prova é ordinal: o `processarLote` não pode estar dentro de um `if` que dependa
    // do resultado da sincronização.
    const t = codigo(ROTA).replace(/\s+/g, ' ');
    expect(t).toMatch(/sincronizar\(\)[\s\S]*?processarLote\(\)/);
    expect(
      /if\s*\([^)]*diretorio[^)]*\)[\s\S]{0,120}processarLote/.test(t),
      'o processamento virou condicional à sincronização',
    ).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. A ROTA DO PROCESSADOR FALHA FECHADA
// ═══════════════════════════════════════════════════════════════════════════════

describe('a rota do processador não fica aberta por variável ausente', () => {
  it('🔴 sem CRON_SECRET a rota RECUSA, em vez de liberar', () => {
    // As rotas de cron mais antigas do repositório usam `if (cronSecret && ...)`, que
    // deixa o endpoint aberto quando a variável falta. Código novo não repete isso.
    const t = codigo(ROTA).replace(/\s+/g, ' ');
    expect(t, 'a rota não recusa quando o segredo falta').toMatch(
      /if\s*\(!segredo\)[\s\S]{0,220}status:\s*503/,
    );
    expect(
      /if\s*\(\s*segredo\s*&&/.test(t),
      'voltou o padrão que abre a rota quando a variável falta',
    ).toBe(false);
  });

  it('compara o segredo em tempo constante, reusando o helper do módulo', () => {
    expect(codigo(ROTA)).toMatch(/segredosConferem\(/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. LGPD — CONTEÚDO DE MENSAGEM NÃO ENTRA NEM NO BANCO NEM NO LOG
// ═══════════════════════════════════════════════════════════════════════════════

describe('nada do que o paciente escreveu é gravado ou registrado', () => {
  it('🔴 a projeção da conversa guarda CONTADOR, não texto', () => {
    const t = fonte(SCHEMA_SESSOES);
    expect(t).toMatch(/mensagensRecebidas:\s*integer/);
    expect(t).toMatch(/mensagensEnviadas:\s*integer/);
    // Nenhuma coluna de texto de mensagem.
    for (const proibida of ['message', 'mensagem_texto', 'conteudo', 'ultima_mensagem']) {
      expect(
        new RegExp(`text\\('${proibida}'\\)`).test(t),
        `a coluna ${proibida} guardaria conteúdo`,
      ).toBe(false);
    }
  });

  it('🔴 o processador nunca lê `message` do payload', () => {
    // Não basta a limpeza no webhook: se o processador procurasse o campo, a intenção de
    // usá-lo estaria escrita, e bastaria alguém afrouxar a limpeza para o dado fluir.
    const t = codigo(PROCESSADOR);
    for (const campo of ['last_message', 'alt_message', 'body', 'caption']) {
      expect(t.includes(campo), `o processador lê ${campo}`).toBe(false);
    }
  });

  it('🔴 nenhum log do processador imprime telefone, e-mail ou payload cru', () => {
    for (const bloco of blocosDeLog(PROCESSADOR)) {
      // O telefone só aparece mascarado.
      if (/telefone/.test(bloco)) {
        expect(bloco, `telefone sem máscara em: ${bloco}`).toMatch(/mascararTelefone\(/);
      }
      expect(/\bpayload\b/.test(bloco), `payload cru em log: ${bloco}`).toBe(false);
      expect(/\bemail\b/.test(bloco), `e-mail em log: ${bloco}`).toBe(false);
    }
  });

  it('o erro guardado na fila é a MENSAGEM do erro, nunca o payload', () => {
    const t = codigo(PROCESSADOR).replace(/\s+/g, ' ');
    expect(t).toMatch(/ultimoErro:\s*erro instanceof Error \? erro\.message/);
  });

  it('CONTROLE: mascararTelefone continua permitido em log', () => {
    // Sem este caso, o guarda acima poderia ser satisfeito removendo todos os logs — o
    // que destruiria a observabilidade em nome da privacidade.
    const blocos = blocosDeLog(PROCESSADOR);
    expect(blocos.length, 'o processador ficou sem log nenhum').toBeGreaterThan(0);
    expect(blocos.some((b) => /mascararTelefone\(/.test(b))).toBe(true);
  });

  it('CONTROLE: o schema de eventos pode CITAR os campos proibidos no comentário', () => {
    // Menção não é uso. O bloco de LGPD do schema nomeia o que remove — e deve poder.
    expect(fonte(SCHEMA_EVENTOS)).toMatch(/message/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. CONFIRMAÇÃO REVERSA — o payload é ponteiro, não verdade
// ═══════════════════════════════════════════════════════════════════════════════

describe('o processador confirma na API em vez de acreditar no corpo', () => {
  it('🔴 quando falta o lead no corpo, PERGUNTA à API qual é', () => {
    expect(codigo(PROCESSADOR), 'a confirmação reversa sumiu').toMatch(/buscarLeadIdPorSessao\(/);
  });

  it('🔴 o telefone usado para vincular vem da API, não do payload', () => {
    const t = codigo(PROCESSADOR).replace(/\s+/g, ' ');
    expect(t).toMatch(/buscarContatoPorId\([\s\S]{0,200}normalizarTelefoneWhatsapp\(/);
  });

  it('o telefone é normalizado antes de virar chave de busca', () => {
    // Telefone cru como chave não casa: o mesmo número chega com e sem sufixo do WhatsApp.
    const t = codigo(PROCESSADOR);
    expect(t).toMatch(/removerSufixoWhatsapp\(/);
    expect(t).toMatch(/normalizarTelefoneWhatsapp\(/);
  });
});
