/**
 * O cliente de ChatPro fala com a instância da conta que chamou.
 *
 * 🔴 O DEFEITO QUE ISTO IMPEDE DE VOLTAR, medido em produção em 14/09/2026.
 *
 * Cada conta é uma instância DIFERENTE do ChatPro. O `leadId` e o `sessionId` de uma chamada só
 * existem na instância de quem chamou. `lib/chatpro/contas.ts` já identificava a conta pelo
 * segredo e já escolhia `urlDeRetorno` por ela — mas o cliente da CHAT API lia
 * `CHATPRO_INSTANCE_TOKEN` do ambiente, sempre o mesmo, o da BeHemp.
 *
 * Resultado: um `leadId` da Greens era procurado na instância da BeHemp, não era encontrado, e
 * `buscarContatoPorId` devolvia `null`. E `null` ali **não é "não achei"**:
 *
 *     if (!contato) throw new ErroDeContatoNaoConfirmado();   // ANTES do insert
 *
 * A solicitação nunca nascia, o `/bot-link` respondia 422, e o painel do ChatPro transferia o
 * paciente para um atendente. O log de produção tem dezenas de
 * `[chatpro] contato não confirmado por findById`, com leadIds diferentes.
 *
 * ⚠️ **E a medição enganou.** `select count(chatpro_lead_id)` devolvia **0**, o que parecia
 * provar que ninguém mandava `leadId`. Provava o contrário: as que mandavam morriam antes de
 * virar linha. **Contar o que sobreviveu não mede o que chegou** — e foi por essa leitura
 * invertida que a hipótese certa foi descartada por algumas horas. A Greens a manteve, e tinha
 * razão.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { instanciaDaConta } from '@/lib/chatpro/contas';

const raiz = process.cwd();
const ler = (p: string) => readFileSync(path.join(raiz, p), 'utf8');

/** Sem comentários: um arquivo que EXPLICA o defeito não pode ser acusado de cometê-lo. */
function semComentarios(fonte: string): string {
  return fonte
    .split('\n')
    .filter((linha) => !/^\s*(\/\/|\/\*|\*)/.test(linha))
    .join('\n');
}

const CONTAS = ler('lib/chatpro/contas.ts');
const SOLICITACAO = semComentarios(ler('lib/chatpro/solicitacao.ts'));

// ─────────────────────────────────────────────────────────────────────────────
describe('o guarda tem o que medir', () => {
  it('os arquivos existem e têm conteúdo', () => {
    expect(CONTAS.length).toBeGreaterThan(500);
    expect(SOLICITACAO.length).toBeGreaterThan(500);
  });

  it('e `instanciaDaConta` é exportada', () => {
    expect(typeof instanciaDaConta).toBe('function');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('🔴 cada conta declara a PRÓPRIA instância', () => {
  /**
   * Derivado do arquivo, não de lista: uma conta NOVA sem `instancia` aparece aqui pelo nome,
   * mesmo que ninguém lembre deste guarda. É o caso que pega a terceira conta.
   */
  const contas = [...semComentarios(CONTAS).matchAll(/id:\s*'(behemp|greens)'/g)].map((m) => m[1]);

  it('a lista tem as duas contas conhecidas', () => {
    expect(new Set(contas)).toEqual(new Set(['behemp', 'greens']));
  });

  it.each(['behemp', 'greens'])('a conta %s declara variáveis de instância próprias', (id) => {
    const sufixo = id === 'greens' ? '_GREENS' : '';
    expect(semComentarios(CONTAS)).toContain(`CHATPRO_INSTANCE_ID${sufixo}`);
    expect(semComentarios(CONTAS)).toContain(`CHATPRO_INSTANCE_TOKEN${sufixo}`);
  });

  it('🔴 e as duas contas NÃO compartilham as mesmas variáveis', () => {
    /**
     * O defeito era exatamente este: uma variável servindo as duas instâncias. Se alguém
     * "simplificar" voltando a um par só, este caso fica vermelho.
     */
    const bloco = semComentarios(CONTAS);
    const behemp = bloco.match(/instancia:\s*\{[^}]*CHATPRO_INSTANCE_ID'[^}]*\}/);
    const greens = bloco.match(/instancia:\s*\{[^}]*CHATPRO_INSTANCE_ID_GREENS'[^}]*\}/);
    expect(behemp, 'a conta behemp perdeu a instância própria').toBeTruthy();
    expect(greens, 'a conta greens perdeu a instância própria').toBeTruthy();
    expect(behemp![0]).not.toBe(greens![0]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('🔴 e o cliente que confirma o contato segue a conta', () => {
  it('o bot-link resolve o cliente pela conta, não pelo ambiente', () => {
    expect(SOLICITACAO, 'o cliente voltou a ser o do ambiente').toMatch(
      /const cliente = this\.clienteDaConta\(/,
    );
  });

  it('🔴 e NÃO usa `this.cliente` na confirmação DO BOT-LINK', () => {
    /**
     * A linha que quebrava. Se voltar, o leadId da Greens é procurado na instância da BeHemp.
     *
     * ⚠️ O recorte é o MÉTODO, não o arquivo — e isso é deliberado. `intake` e `start` ainda
     * usam `this.cliente`, e têm o mesmo defeito LATENTE: nenhuma das duas rotas identifica a
     * conta hoje (`app/api/chatpro/intake/route.ts:87` e `start/route.ts:41` chamam sem ela),
     * então corrigi-los exige mudar o contrato de entrada dos dois. Está catalogado no `03`.
     *
     * Acusar o arquivo inteiro faria este guarda ficar vermelho por um defeito que ninguém
     * autorizou corrigir — e guarda que acusa o que não se pode consertar é guarda que alguém
     * desliga.
     */
    const ini = SOLICITACAO.indexOf('const cliente = this.clienteDaConta(');
    expect(ini, 'o bot-link deixou de resolver o cliente pela conta').toBeGreaterThan(-1);
    const fim = SOLICITACAO.indexOf('async intake(', ini);
    const metodo = SOLICITACAO.slice(ini, fim > ini ? fim : undefined);

    expect(metodo).not.toMatch(/this\.cliente\.buscarContatoPorId\(/);
    expect(metodo).not.toMatch(/this\.cliente\.buscarLeadIdPorSessao\(/);
    expect(metodo, 'o método precisa usar o cliente da conta').toMatch(
      /cliente\.buscarContatoPorId\(/,
    );
  });

  it('o id da conta é a UNIÃO, não `string`', () => {
    /**
     * Com `string`, um id inventado compila e cai em `instanciaDaConta` sem casar — devolvendo
     * o cliente errado em silêncio, que é a classe inteira deste guarda.
     */
    expect(SOLICITACAO).toMatch(/conta\?:\s*\{\s*id:\s*ContaDeChatpro\['id'\]/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('🔴 instanciaDaConta, em execução', () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });

  it('sem credencial configurada, devolve null — e isso é degradação, não erro', () => {
    delete process.env.CHATPRO_INSTANCE_ID_GREENS;
    delete process.env.CHATPRO_INSTANCE_TOKEN_GREENS;
    expect(instanciaDaConta('greens')).toBeNull();
  });

  it('com as duas, devolve as credenciais DAQUELA conta', () => {
    process.env.CHATPRO_INSTANCE_ID_GREENS = 'id-da-greens';
    process.env.CHATPRO_INSTANCE_TOKEN_GREENS = 'token-da-greens';
    process.env.CHATPRO_INSTANCE_ID = 'id-da-behemp';
    process.env.CHATPRO_INSTANCE_TOKEN = 'token-da-behemp';

    expect(instanciaDaConta('greens')).toEqual({
      instanceId: 'id-da-greens',
      token: 'token-da-greens',
    });
    expect(instanciaDaConta('behemp')).toEqual({
      instanceId: 'id-da-behemp',
      token: 'token-da-behemp',
    });
  });

  it('🔴 e as duas NUNCA devolvem o mesmo par', () => {
    process.env.CHATPRO_INSTANCE_ID_GREENS = 'id-da-greens';
    process.env.CHATPRO_INSTANCE_TOKEN_GREENS = 'token-da-greens';
    process.env.CHATPRO_INSTANCE_ID = 'id-da-behemp';
    process.env.CHATPRO_INSTANCE_TOKEN = 'token-da-behemp';
    expect(instanciaDaConta('greens')).not.toEqual(instanciaDaConta('behemp'));
  });

  it('🔴 o host segue a conta quando configurado', () => {
    /**
     * `sparks` é o subdomínio da GREENS. Token válido no host errado devolve 401, não 404 — e
     * 401 se lê como "credencial errada". Foi esse falso diagnóstico que custou semanas.
     */
    process.env.CHATPRO_INSTANCE_ID_GREENS = 'id';
    process.env.CHATPRO_INSTANCE_TOKEN_GREENS = 'token';
    process.env.CHATPRO_CHAT_API_URL_GREENS = 'https://outro.chatpro.com.br';
    expect(instanciaDaConta('greens')?.baseUrl).toBe('https://outro.chatpro.com.br');
  });

  it('e sem host configurado NÃO inventa um — cai no default do cliente', () => {
    /**
     * ⚠️ Assimetria deliberada: exigir o host quebraria a conta que funciona hoje (greens, cujo
     * subdomínio é justamente o default) para consertar a que não funciona.
     */
    process.env.CHATPRO_INSTANCE_ID_GREENS = 'id';
    process.env.CHATPRO_INSTANCE_TOKEN_GREENS = 'token';
    delete process.env.CHATPRO_CHAT_API_URL_GREENS;
    const r = instanciaDaConta('greens');
    expect(r).toBeTruthy();
    expect(r).not.toHaveProperty('baseUrl');
  });

  it('meia credencial conta como ausente', () => {
    // Um par pela metade daria um cliente que falha de um jeito mais difícil de ler.
    process.env.CHATPRO_INSTANCE_ID_GREENS = 'só-o-id';
    delete process.env.CHATPRO_INSTANCE_TOKEN_GREENS;
    expect(instanciaDaConta('greens')).toBeNull();
  });

  it('espaço em branco não vira credencial', () => {
    process.env.CHATPRO_INSTANCE_ID_GREENS = '   ';
    process.env.CHATPRO_INSTANCE_TOKEN_GREENS = '   ';
    expect(instanciaDaConta('greens')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('as variáveis chegam ao servidor', () => {
  const deploy = ler('.github/workflows/deploy.yml');

  it.each(['CHATPRO_INSTANCE_ID_GREENS', 'CHATPRO_INSTANCE_TOKEN_GREENS'])(
    '%s está na lista `gravar` do deploy',
    (nome) => {
      /**
       * ⚠️ Cadastrar o secret no GitHub NÃO basta: o deploy escreve uma lista FIXA, e o que
       * fica fora nunca chega ao processo. Já aconteceu três vezes neste repositório.
       */
      expect(deploy).toContain(`gravar ${nome}`);
    },
  );

  it('e estão declaradas no schema de env', () => {
    const env = ler('lib/env.ts');
    expect(env).toContain('CHATPRO_INSTANCE_ID_GREENS');
    expect(env).toContain('CHATPRO_INSTANCE_TOKEN_GREENS');
  });
});
