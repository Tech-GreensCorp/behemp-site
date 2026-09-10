/**
 * Guarda: as duas contas de ChatPro não se misturam.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * O mesmo endpoint atende a conta da BeHemp e a da Greens (ADR-0018 D-01), e o que as
 * separa não é um parâmetro de URL — é o **segredo**. Três coisas quebram em silêncio se
 * alguém "simplificar" isso:
 *
 * 1. **Segredo compartilhado.** Rotacionar passaria a exigir mexer nos dois painéis ao
 *    mesmo tempo, e vazar um comprometeria os dois canais.
 * 2. **Dicionário sem a conta na chave.** Departamento e motivo são UUIDs da CONTA:
 *    `d3457174-…` é "Aguardando Autorização Anvisa" **na conta da Greens**. Sem a conta na
 *    chave, um evento da Greens procuraria no dicionário da BeHemp, não acharia, e
 *    gravaria o UUID cru — **sem exceção, sem log, sem nada vermelho**.
 * 3. **Destino de volta arbitrário.** Quem veio da Greens volta para lá, e o endereço
 *    passa pela mesma lista de origens do handoff: um destino livre é redirecionamento
 *    aberto, venha de handoff assinado ou de configuração de conta.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { contasConfiguradas, identificarConta } from '../../lib/chatpro/contas';

const RAIZ = join(import.meta.dirname, '..', '..');
const fonte = (a: string) => readFileSync(join(RAIZ, a), 'utf8');
const codigo = (a: string) =>
  fonte(a)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const CONTAS = 'lib/chatpro/contas.ts';
const DIRETORIO = 'lib/chatpro/diretorio.ts';
const SCHEMA_DIR = 'db/schema/chatpro-diretorio.ts';
const BOT_LINK = 'app/api/chatpro/bot-link/route.ts';
const SOLICITACAO = 'lib/chatpro/solicitacao.ts';

// ═══════════════════════════════════════════════════════════════════════════════
// 1. O SEGREDO IDENTIFICA A CONTA
// ═══════════════════════════════════════════════════════════════════════════════

describe('cada conta tem o seu segredo, e é ele que diz quem chama', () => {
  const ANTES = { ...process.env };
  beforeEach(() => {
    process.env.CHATPRO_INTAKE_SECRET = 'segredo-da-behemp';
    process.env.CHATPRO_INTAKE_SECRET_GREENS = 'segredo-da-greens';
    process.env.CHATPRO_GREENS_URL_DE_RETORNO = 'https://greens-corp.com/my-profile';
    process.env.PARCEIRO_ORIGENS_DE_RETORNO = 'https://greens-corp.com';
  });
  afterEach(() => {
    process.env = { ...ANTES };
  });

  it('o segredo da BeHemp identifica a conta da BeHemp', () => {
    expect(identificarConta('segredo-da-behemp')?.id).toBe('behemp');
  });

  it('o segredo da Greens identifica a conta da Greens', () => {
    expect(identificarConta('segredo-da-greens')?.id).toBe('greens');
  });

  it.each(['segredo-inventado', '', null, undefined])('recusa %s', (s) => {
    expect(identificarConta(s as string)).toBeNull();
  });

  it('🔴 os dois segredos são variáveis DIFERENTES', () => {
    /**
     * Se as duas contas lessem a mesma variável, rotacionar exigiria mexer nos dois
     * painéis ao mesmo tempo, e vazar um comprometeria os dois canais.
     */
    const t = codigo(CONTAS);
    expect(t).toMatch(/variavel: 'CHATPRO_INTAKE_SECRET'/);
    expect(t).toMatch(/variavel: 'CHATPRO_INTAKE_SECRET_GREENS'/);
  });

  it('🔴 a comparação não PARA na primeira conta que casa', () => {
    /**
     * Um `break` responderia mais rápido quando o segredo é da primeira conta da lista —
     * e essa diferença de tempo diria a quem tenta QUAL conta ele acertou. É a mesma
     * família do ataque que `segredosConferem` evita, um nível acima: lá se descobre o
     * valor, aqui qual dos valores.
     */
    const t = codigo(CONTAS);
    const loop = t.slice(
      t.indexOf('for (const { conta, variavel }'),
      t.indexOf('return encontrada'),
    );
    expect(/\bbreak\b/.test(loop), 'voltou o break — o tempo passa a dizer qual conta casou').toBe(
      false,
    );
  });

  it('usa a comparação em tempo constante, não ===', () => {
    const t = codigo(CONTAS);
    expect(t).toMatch(/segredosConferem\(segredoRecebido, esperado\)/);
    expect(/segredoRecebido\s*===/.test(t), 'voltou a comparação direta').toBe(false);
  });

  it('só conta configurada aparece', () => {
    delete process.env.CHATPRO_INTAKE_SECRET_GREENS;
    expect(contasConfiguradas()).toEqual(['behemp']);
  });

  it('🔴 a conta vem do SEGREDO, nunca de parâmetro da URL', () => {
    // Um parâmetro na URL o painel poderia preencher errado — ou alguém trocar.
    const t = codigo(BOT_LINK).replace(/\s+/g, ' ');
    expect(t).toMatch(/identificarConta\(lerSegredoDoCabecalho\(request\.headers\)\)/);
    expect(
      /q\.get\(['"]conta['"]\)|q\.get\(['"]parceiro['"]\)/.test(t),
      'a conta passou a vir da URL',
    ).toBe(false);
  });

  it('🔴 a conta É REPASSADA ao serviço — não basta identificá-la', () => {
    /**
     * ⚠️ Este caso existe porque o defeito aconteceu: a rota identificava a conta
     * corretamente e **não a passava** para `linkParaOBot`. Tudo respondia 200, o link
     * saía, e `parceiro` ficava nulo no banco — nenhum erro em lugar nenhum. Só apareceu
     * ao conferir a linha gravada.
     */
    const t = codigo(BOT_LINK).replace(/\s+/g, ' ');
    expect(t, 'a conta é identificada e jogada fora').toMatch(/linkParaOBot\(\{ conta,/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. O DICIONÁRIO É POR CONTA
// ═══════════════════════════════════════════════════════════════════════════════

describe('um UUID da Greens nunca é traduzido com o dicionário da BeHemp', () => {
  it('🔴 a chave única inclui a conta', () => {
    const linha = fonte(SCHEMA_DIR)
      .split('\n')
      .find((l) => l.includes('chatpro_diretorio_tipo_id_idx'));
    expect(linha, 'o índice sumiu').toBeTruthy();
    expect(linha!, 'a conta saiu da chave — o erro voltaria a ser silencioso').toMatch(/t\.conta/);
  });

  it('🔴 TODA consulta ao diretório filtra por conta', () => {
    // Contar os pontos, não procurar a palavra: basta um `select` sem o filtro para a
    // tradução errada voltar.
    const t = codigo(DIRETORIO);
    const consultas = [...t.matchAll(/eq\(chatproDiretorio\.tipo,/g)];
    expect(consultas.length, 'nenhuma consulta encontrada').toBeGreaterThan(0);
    for (const m of consultas) {
      const janela = t.slice(Math.max(0, m.index - 220), m.index + 60);
      expect(janela, 'consulta ao diretório sem filtro de conta').toMatch(
        /eq\(chatproDiretorio\.conta,/,
      );
    }
  });

  it('a gravação também carimba a conta', () => {
    const t = codigo(DIRETORIO).replace(/\s+/g, ' ');
    expect(t).toMatch(/\.values\(\{ conta: this\.conta,/);
    expect(t).toMatch(/target: \[chatproDiretorio\.conta,/);
  });

  it('a conta é parâmetro do serviço, com padrão explícito', () => {
    expect(codigo(DIRETORIO)).toMatch(/private conta: string = 'behemp'/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. O DESTINO DE VOLTA PASSA PELA MESMA VALIDAÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

describe('o retorno da conta não escapa da lista de origens', () => {
  it('🔴 a solicitação valida a URL antes de gravar', () => {
    /**
     * Um destino fora da lista é redirecionamento aberto, e não importa se veio de um
     * handoff assinado ou da configuração de uma conta de bot. A validação é a mesma
     * função, no mesmo momento: ao GRAVAR.
     */
    const t = codigo(SOLICITACAO).replace(/\s+/g, ' ');
    expect(t).toMatch(/urlDeRetorno: urlDeRetornoPermitida\(params\.urlDeRetorno\)/);
  });

  it('🔴 a conta da BeHemp NÃO tem destino de volta', () => {
    // Ele já está em casa. Um retorno aqui mandaria o paciente para fora sem motivo.
    const t = codigo(CONTAS);
    expect(t).toMatch(/if \(id !== 'greens'\) return null/);
  });

  it('a URL da conta é lida em tempo de chamada, não no import', () => {
    // Lida no import, ela congelaria o valor — e um ajuste de ambiente exigiria deploy.
    const t = codigo(CONTAS);
    expect(t).toMatch(/function urlDeRetornoDaConta/);
    expect(t).toMatch(/process\.env\.CHATPRO_GREENS_URL_DE_RETORNO/);
  });

  it('o parceiro gravado vem da conta', () => {
    expect(codigo(SOLICITACAO)).toMatch(/parceiro: params\.parceiro \?\? null/);
  });
});
