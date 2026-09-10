/**
 * Guarda: o aviso ao parceiro não se perde, não duplica, e não derruba o ato clínico.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * O aviso nasce no instante em que o médico assina a receita. Três coisas podem dar
 * errado aí, e as três são silenciosas:
 *
 * 1. **A Greens estar fora do ar naquele segundo.** Um `fetch` direto perderia o aviso
 *    para sempre — e ninguém descobriria: o médico viu a receita ser assinada, o sistema
 *    não reclamou, e o pedido do paciente simplesmente nunca destrava lá.
 * 2. **O aviso derrubar a assinatura.** Se o envio pudesse lançar, uma indisponibilidade
 *    comercial passaria a impedir um médico de prescrever.
 * 3. **O retry virar avisos repetidos.** Se o id mudasse a cada tentativa, cada reenvio
 *    chegaria como fato novo do outro lado.
 *
 * A diferença de desenho em relação à fila de ENTRADA está no índice: lá o remetente é o
 * ChatPro e a reentrega dele precisa ser absorvida em silêncio, então o índice é comum;
 * aqui quem cria somos nós, e criar duas vezes é bug nosso — então é único.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const RAIZ = join(import.meta.dirname, '..', '..');
const fonte = (a: string) => readFileSync(join(RAIZ, a), 'utf8');
const codigo = (a: string) =>
  fonte(a)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const NOTIFICAR = 'lib/parceiros/notificar.ts';
const ENVIADOR = 'lib/parceiros/enviador.ts';
const ROTA = 'app/api/parceiros/enviar/route.ts';
const SCHEMA = 'db/schema/parceiro-eventos-saida.ts';

// ═══════════════════════════════════════════════════════════════════════════════
// 1. O AVISO NÃO PODE DERRUBAR O ATO CLÍNICO
// ═══════════════════════════════════════════════════════════════════════════════

describe('enfileirar nunca lança', () => {
  it('🔴 tem try/catch em volta de TUDO', () => {
    // Quem chama está assinando uma receita. Se isto pudesse lançar, a indisponibilidade
    // de um parceiro comercial impediria um médico de prescrever.
    const t = codigo(NOTIFICAR).replace(/\s+/g, ' ');
    expect(t, 'a proteção sumiu').toMatch(/try \{[\s\S]*\} catch \(erro\) \{/);
  });

  it('🔴 não existe `throw` no caminho de enfileirar', () => {
    expect(/throw /.test(codigo(NOTIFICAR)), 'voltou a lançar').toBe(false);
  });

  it('devolve resultado em vez de erro, e diz o motivo', () => {
    const t = codigo(NOTIFICAR);
    expect(t).toMatch(/enfileirado: false, motivo: 'sem_parceiro'/);
    expect(t).toMatch(/enfileirado: false, motivo: 'erro'/);
  });

  it('paciente sem parceiro não gera aviso', () => {
    // É a maioria dos pacientes. Enfileirar para todos encheria a fila de eventos que
    // nunca teriam destino.
    expect(codigo(NOTIFICAR)).toMatch(/if \(!solicitacao\?\.parceiro\)/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. O AVISO NÃO SE PERDE
// ═══════════════════════════════════════════════════════════════════════════════

describe('a entrega é durável, não um fetch e reza', () => {
  it('🔴 o aviso é GRAVADO antes de qualquer envio', () => {
    // `notificar` só insere. Quem envia é o cron, depois — então uma Greens fora do ar
    // no instante da assinatura vira atraso, não perda.
    const t = codigo(NOTIFICAR);
    expect(t).toMatch(/db\s*\.insert\(parceiroEventosSaida\)/);
    expect(/fetch\(/.test(t), 'o enfileirador passou a enviar direto').toBe(false);
  });

  it('🔴 falha recuperável volta para `pendente`, não morre em `enviando`', () => {
    // Um evento deixado em `enviando` nunca mais é reivindicado: o claim só olha
    // `pendente`. Vira perda silenciosa.
    const t = codigo(ENVIADOR).replace(/\s+/g, ' ');
    expect(t).toMatch(/status: 'pendente', proximaTentativaEm/);
  });

  it('🔴 sem configuração, NÃO reivindica nada', () => {
    /**
     * Se reivindicasse, cada disparo do cron gastaria uma tentativa de cada evento contra
     * um destino que não existe — e em seis disparos a fila inteira estaria `falhou`,
     * com avisos legítimos perdidos porque uma variável não foi preenchida.
     */
    const t = codigo(ENVIADOR).replace(/\s+/g, ' ');
    expect(t).toMatch(/if \(!this\.estaConfigurado\(\)\)[\s\S]{0,320}reivindicados: 0/);
  });

  it('o que falhou de vez fica no banco como `falhou`, não some', () => {
    expect(codigo(ENVIADOR)).toMatch(/status: 'falhou'/);
  });

  it('4xx não é retentado — insistir não conserta corpo ou assinatura errados', () => {
    const t = codigo(ENVIADOR);
    expect(t).toMatch(/VALE_TENTAR_DE_NOVO = new Set\(\[404, 408, 429, 500, 502, 503, 504\]\)/);
    expect(t).toMatch(/if \(!VALE_TENTAR_DE_NOVO\.has\(resposta\.status\)\)/);
  });

  it('🔴 o caminho da rota é o ACORDADO, e é configurável', () => {
    /**
     * Eu escrevi `/api/parceiros/behemp/atualizacao` no contrato e a Greens implementou em
     * `/api/v1/...` — eles versionam a API e eu não perguntei. Um caminho errado vira 404,
     * que não é retentável: o evento falha na primeira tentativa. Melhor que girar em
     * silêncio, e ainda assim é um aviso que não chega.
     */
    const t = codigo(ENVIADOR);
    expect(t, 'o caminho acordado mudou sem aviso').toMatch(
      /'\/api\/v1\/parceiros\/behemp\/atualizacao'/,
    );
    expect(t, 'o caminho deixou de ser configurável').toMatch(/PARCEIRO_GREENS_CAMINHO_RETORNO/);
  });

  it('🔴 404 É retentável — deploy em andamento devolve 404 por segundos', () => {
    /**
     * A regra "4xx não se retenta" erra aqui. 404 tem três causas que a resposta não
     * distingue: caminho errado (permanente), rota ainda não publicada (temporário — o
     * estado real da Greens hoje) e deploy em andamento (segundos).
     *
     * Sem retry, um aviso que caísse na janela de um deploy morreria. Com retry, o
     * caminho permanentemente errado ainda vira `falhou` visível depois de ~2 h.
     */
    expect(codigo(ENVIADOR)).toMatch(/new Set\(\[404,/);
  });

  it('o backoff cresce, e tem teto', () => {
    // Insistir de minuto em minuto não traz a Greens de volta — só enche o log e gasta a
    // janela do cron com o mesmo evento.
    const t = codigo(ENVIADOR);
    expect(t).toMatch(/Math\.min\(2 \*\* Math\.max\(0, tentativa - 1\), 60\)/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. NÃO DUPLICA — NEM NA CRIAÇÃO, NEM NO RETRY
// ═══════════════════════════════════════════════════════════════════════════════

describe('o mesmo fato é um aviso só', () => {
  it('🔴 o índice do fato é ÚNICO', () => {
    /**
     * Diferente da fila de ENTRADA, cujo índice é comum de propósito. A razão da
     * diferença: lá o remetente é o ChatPro e a reentrega dele precisa ser absorvida em
     * silêncio; aqui quem cria somos nós, e criar duas vezes seria bug nosso — e bug
     * nosso deve estourar, não ser engolido.
     */
    const linha = fonte(SCHEMA)
      .split('\n')
      .find((l) => l.includes('parceiro_eventos_saida_fato_idx'));
    expect(linha, 'o índice do fato sumiu').toBeTruthy();
    expect(linha!, 'virou índice comum e o mesmo fato viraria dois avisos').toMatch(/uniqueIndex/);
    for (const campo of ['parceiro', 'tipo', 'solicitacaoId']) {
      expect(linha!.includes(campo), `${campo} saiu da chave do fato`).toBe(true);
    }
  });

  it('a inserção repetida não reescreve o que já existe', () => {
    // `DoNothing` e não `DoUpdate`: o aviso que já existe tem seu `ocorridoEm` e talvez já
    // tenha sido entregue. Reescrever mudaria o carimbo de um fato que já aconteceu.
    const t = codigo(NOTIFICAR);
    expect(t).toMatch(/onConflictDoNothing/);
    expect(/onConflictDoUpdate/.test(t), 'passou a reescrever o fato').toBe(false);
  });

  it('🔴 o id enviado é o da LINHA — estável entre tentativas', () => {
    /**
     * Se fosse gerado a cada envio, cada retry chegaria como fato novo do outro lado e a
     * deduplicação deles não teria por onde pegar: um evento reenviado cinco vezes viraria
     * cinco avisos.
     */
    const t = codigo(ENVIADOR).replace(/\s+/g, ' ');
    expect(t).toMatch(/assinar\(evento\.id, timestamp, corpo/);
    expect(t).toMatch(/'x-parceiro-evento-id': evento\.id/);
    expect(
      /randomUUID|randomBytes|createId\(\)/.test(t),
      'o id do evento voltou a ser gerado no envio',
    ).toBe(false);
  });

  it('🔴 o claim é atômico', () => {
    // Dois disparos de cron concorrentes — o que acontece sozinho quando um atrasa —
    // pegariam a mesma linha e enviariam o aviso duas vezes.
    const t = codigo(ENVIADOR).replace(/\s+/g, ' ');
    expect(t).toMatch(/FOR UPDATE SKIP LOCKED/i);
    expect(t).toMatch(/UPDATE parceiro_eventos_saida SET status = 'enviando'/i);
  });

  it('respeita o horário da próxima tentativa', () => {
    expect(codigo(ENVIADOR)).toMatch(
      /proxima_tentativa_em IS NULL OR proxima_tentativa_em <= now\(\)/i,
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. A ROTA FALHA FECHADA E O PAYLOAD NÃO LEVA CLÍNICO
// ═══════════════════════════════════════════════════════════════════════════════

describe('o cron é protegido e o aviso não carrega prontuário', () => {
  it('🔴 sem CRON_SECRET responde 503, não fica aberta', () => {
    const t = codigo(ROTA).replace(/\s+/g, ' ');
    expect(t).toMatch(/if \(!segredo\)[\s\S]{0,200}status: 503/);
    expect(/if \(\s*segredo\s*&&/.test(t), 'voltou o padrão que abre a rota').toBe(false);
  });

  it('compara o segredo em tempo constante', () => {
    expect(codigo(ROTA)).toMatch(/segredosConferem\(/);
  });

  it('🔴 o payload diz QUE existe, nunca O QUE foi prescrito', () => {
    // Quem precisa do conteúdo tem a ficha, com controle de acesso. Mandá-lo para outra
    // empresa criaria uma segunda cópia sem esse controle.
    const t = codigo(NOTIFICAR);
    const inicio = t.indexOf('payload: {');
    expect(inicio).toBeGreaterThan(-1);
    const bloco = t.slice(inicio, t.indexOf('},', inicio));
    for (const proibido of ['cpf', 'medicament', 'dosagem', 'posologia', 'cid', 'diagnostic']) {
      expect(new RegExp(proibido, 'i').test(bloco), `${proibido} vai no aviso`).toBe(false);
    }
    expect(bloco, 'o aviso perdeu o referralId').toMatch(/referralId/);
  });

  it('nenhum log do enviador imprime o payload', () => {
    const t = codigo(ENVIADOR);
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
    expect(blocos.length, 'o enviador ficou sem log').toBeGreaterThan(0);
    for (const b of blocos) {
      expect(/\bpayload\b/.test(b), `payload em log: ${b}`).toBe(false);
    }
  });
});
