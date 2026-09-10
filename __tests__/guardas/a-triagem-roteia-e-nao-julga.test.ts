/**
 * Guarda: a triagem do bot roteia pela resposta do paciente, e nunca julga documento
 * de outro médico.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * Duas regras que não são técnicas, e as duas se perdem numa refatoração descuidada:
 *
 * 1. **A resposta do paciente roteia; a busca por telefone só ajuda.** `users.telefone` é
 *    gravado por quatro caminhos e nenhum normaliza (`04` Item 26) — comparar por
 *    igualdade falha, e falha em silêncio. Quem sabe se tem receita é ele.
 *
 * 2. **A tela nunca diz que uma receita é inválida.** A regra interna é que só serve
 *    receita do nosso receituário, e ela NÃO é dita: receita de outro médico é
 *    **legalmente válida**, e afirmar o contrário é declaração falsa sobre o ato de outro
 *    profissional. A única exceção é o **vencimento**, que é fato público e verificável.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { interpretarResposta } from '../../lib/chatpro/resposta-do-paciente';
import { chaveDeBusca } from '../../lib/chatpro/telefone';
import { textoDaTriagem, PERGUNTA_DA_TRIAGEM } from '../../lib/chatpro/texto-da-triagem';

const RAIZ = join(import.meta.dirname, '..', '..');
const fonte = (a: string) => readFileSync(join(RAIZ, a), 'utf8');
const codigo = (a: string) =>
  fonte(a)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const TRIAGEM = 'lib/chatpro/triagem.ts';
const TEXTO = 'lib/chatpro/texto-da-triagem.ts';
const ROTA = 'app/api/chatpro/triagem/route.ts';

// ═══════════════════════════════════════════════════════════════════════════════
// 1. O PACIENTE CONVERSA — NÃO ESCOLHE ENTRE TRÊS PALAVRAS
// ═══════════════════════════════════════════════════════════════════════════════

describe('a resposta é interpretada como uma pessoa a escreveria', () => {
  it.each(['não', 'nao', 'Não, ainda não', 'Ainda não tenho', 'acho que não', 'NÃO', 'n', '2'])(
    'reconhece negação: %s',
    (r) => {
      expect(interpretarResposta(r)).toBe('nao_tem');
    },
  );

  it('🔴 "Não, ainda não" — o caso que derrubou a primeira versão', () => {
    /**
     * A primeira versão usava `/^(sim|nao|não|n|s)$/` — âncora total, palavra exata. Um
     * teste ao vivo mostrou que "Não, ainda não" não casava com nada, virava "não sei", e
     * o sistema seguia a base. O link **não era oferecido a quem precisava** — o erro
     * exato que este fluxo existe para não cometer.
     */
    expect(interpretarResposta('Não, ainda não')).toBe('nao_tem');
  });

  it.each(['sim', 'Tenho sim', 'tenho', 'possuo', '1', 'claro'])('reconhece afirmação: %s', (r) => {
    expect(interpretarResposta(r)).toBe('tem_receita');
  });

  it('🔴 a NEGAÇÃO é procurada antes da afirmação', () => {
    // "não tenho" CONTÉM "tenho". Na ordem inversa, toda negação viraria afirmação.
    expect(interpretarResposta('não tenho')).toBe('nao_tem');
    expect(interpretarResposta('nao possuo')).toBe('nao_tem');
    const t = codigo('lib/chatpro/resposta-do-paciente.ts');
    expect(t.indexOf('NEGA.test(t)')).toBeLessThan(t.indexOf('AFIRMA.test(t)'));
  });

  it.each(['tenho mas venceu', 'só a antiga', 'tenho uma expirada', 'a receita atrasada'])(
    '🔴 menção a vencimento vale como NÃO TER: %s',
    (r) => {
      /**
       * "tenho, mas venceu" é afirmação seguida de uma informação que a anula: receita
       * vencida não serve para dispensação, por norma. Ler como "tem" mandaria o paciente
       * para o caminho errado — tendo ele DITO o motivo de precisar do outro.
       */
      expect(interpretarResposta(r)).toBe('nao_tem');
    },
  );

  it('resposta ininteligível vira `nao_sabe`, não um chute', () => {
    expect(interpretarResposta('oi tudo bem')).toBe('nao_sabe');
    expect(interpretarResposta('')).toBeNull();
    expect(interpretarResposta(null)).toBeNull();
  });

  it('a pergunta do bot não induz a resposta', () => {
    // "você não tem receita, certo?" enviesaria. E ela não menciona de QUEM a receita
    // precisa ser — isso é a regra interna.
    expect(PERGUNTA_DA_TRIAGEM).toMatch(/você já tem uma receita/i);
    expect(/nossa|nosso receituário|conosco/i.test(PERGUNTA_DA_TRIAGEM)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. A TELA NUNCA JULGA DOCUMENTO DE OUTRO MÉDICO
// ═══════════════════════════════════════════════════════════════════════════════

describe('o texto não faz afirmação falsa sobre ato de terceiro', () => {
  const MOTIVOS = [
    'sem_cadastro',
    'falta_receita',
    'receita_vencida',
    'falta_anvisa',
    'tem_tudo',
    'paciente_disse_que_tem',
  ] as const;

  it.each(MOTIVOS)('🔴 o texto de %s não diz "inválida" nem equivalente', (motivo) => {
    const texto = textoDaTriagem(
      {
        candidato: null,
        deveOferecerLink: motivo !== 'tem_tudo' && motivo !== 'paciente_disse_que_tem',
        motivo,
      },
      'Ana',
    );
    for (const proibido of [
      /inv[áa]lid/i,
      /n[ãa]o aceit/i,
      /n[ãa]o credenciad/i,
      /receita de fora/i,
      /outro m[ée]dico/i,
      /nosso receitu[áa]rio/i,
    ]) {
      expect(proibido.test(texto), `"${texto}" contém ${proibido}`).toBe(false);
    }
  });

  it('🔴 nenhuma palavra proibida no ARQUIVO de textos, não só no resultado', () => {
    /**
     * Os casos acima cobrem os seis motivos que existem hoje. Este cobre o arquivo: um
     * texto novo, amanhã, entra sem passar por nenhum deles — e a proibição precisa
     * alcançá-lo também.
     *
     * Lê só as STRINGS, não os comentários: o bloco no topo do arquivo cita "sua receita
     * é inválida" justamente para explicar por que ela não pode ser dita, e proibir a
     * explicação seria proibir o motivo.
     */
    const apenasTextos = fonte(TEXTO)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    for (const proibido of [/inv[áa]lid/i, /n[ãa]o aceit/i, /n[ãa]o credenciad/i]) {
      expect(proibido.test(apenasTextos), `o arquivo de textos contém ${proibido}`).toBe(false);
    }
  });

  it('🔴 o VENCIMENTO é a única exceção, e é nomeado', () => {
    // Fato objetivo, regra pública (RDC 1.015/2026), e não julga quem emitiu. Esconder
    // tiraria do paciente algo que o ajuda e que ele confere sozinho no documento.
    const texto = textoDaTriagem(
      { candidato: null, deveOferecerLink: true, motivo: 'receita_vencida' },
      null,
    );
    expect(texto).toMatch(/vencida/i);
    expect(texto).toMatch(/30 dias/);
  });

  it('a ANVISA é apresentada como algo que resolvemos junto', () => {
    const texto = textoDaTriagem(
      { candidato: null, deveOferecerLink: true, motivo: 'falta_anvisa' },
      null,
    );
    expect(texto).toMatch(/cuidamos dela com você/i);
  });

  it('🔴 o motivo interno NÃO vai no corpo — só no cabeçalho', () => {
    // `falta_receita` no corpo diria ao paciente o que decidimos sobre o documento dele.
    const t = codigo(ROTA).replace(/\s+/g, ' ');
    expect(t).toMatch(/'x-triagem-motivo': situacao\.motivo/);
    expect(/new Response\(\s*situacao\.motivo/.test(t), 'o motivo interno vazou para o corpo').toBe(
      false,
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. A BUSCA AJUDA; ELA NÃO DECIDE
// ═══════════════════════════════════════════════════════════════════════════════

describe('o telefone não tem autoridade para dizer quem alguém é', () => {
  it('a chave são os ÚLTIMOS 8 dígitos', () => {
    // Oito porque é o que sobra depois de DDI, DDD e o nono dígito — as três partes que
    // variam entre os formatos gravados.
    expect(chaveDeBusca('+5562999997197')).toBe('99997197');
    expect(chaveDeBusca('(62) 99999-7197')).toBe('99997197');
    expect(chaveDeBusca('62999997197')).toBe('99997197');
  });

  it('recusa o que é curto demais para ser telefone', () => {
    expect(chaveDeBusca('1234')).toBeNull();
    expect(chaveDeBusca('')).toBeNull();
    expect(chaveDeBusca(null)).toBeNull();
  });

  it('🔴 quem diz que NÃO TEM recebe o link, mesmo com a base dizendo o contrário', () => {
    /**
     * A base pode estar olhando uma receita que ele perdeu, que venceu ontem, ou de que
     * ele nem sabe. Ele está com o documento na mão (ou não); nós temos uma linha.
     */
    const t = codigo(TRIAGEM).replace(/\s+/g, ' ');
    expect(t, 'a resposta do paciente deixou de vencer a base').toMatch(
      /if \(params\.resposta === 'nao_tem'\)[\s\S]{0,140}deveOferecerLink: true/,
    );
  });

  it('🔴 o contrário NÃO vale: dizer que tem não fecha nada sozinho', () => {
    // A receita dele pode ser de outro médico, ilegível ou vencida — e quem confere é
    // gente (D-02). Não pode existir um atalho que encerre o fluxo pela afirmação dele.
    const t = codigo(TRIAGEM).replace(/\s+/g, ' ');
    expect(
      /resposta === 'tem_receita'[\s\S]{0,120}deveOferecerLink: false/.test(t),
      'a afirmação do paciente virou conclusão',
    ).toBe(false);
  });

  it('🔴 RASCUNHO e CANCELADA não contam como receita', () => {
    // Rascunho não é documento: contá-lo diria que o paciente tem receita quando existe
    // só uma tela pela metade.
    expect(codigo(TRIAGEM)).toMatch(/in \('emitida','assinada'\)/);
  });

  it('receita fora da validade não conta como vigente', () => {
    expect(codigo(TRIAGEM)).toMatch(/gt\(prescricoes\.validade, agora\)/);
  });

  it('🔴 candidato ausente NÃO é tratado como "não existe"', () => {
    // Ausência é "não sei" — o telefone pode estar gravado de um jeito que a busca não
    // alcança. Tratar como prova de inexistência é o erro silencioso.
    const t = codigo(TRIAGEM).replace(/\s+/g, ' ');
    expect(t).toMatch(/if \(!candidato\)[\s\S]{0,120}deveOferecerLink: true/);
  });

  it('só ANVISA `aprovado` conta', () => {
    expect(codigo(TRIAGEM)).toMatch(/eq\(autorizacoesAnvisa\.status, 'aprovado'\)/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. A ROTA
// ═══════════════════════════════════════════════════════════════════════════════

describe('a rota se comporta como as outras do ChatPro', () => {
  it('responde texto puro — o corpo VIRA a mensagem no WhatsApp', () => {
    expect(codigo(ROTA)).toMatch(/'Content-Type': 'text\/plain; charset=utf-8'/);
  });

  it('exige o segredo, em tempo constante', () => {
    expect(codigo(ROTA)).toMatch(/segredosConferem\(lerSegredoDoCabecalho/);
  });

  it('🔴 falha com status de ERRO, de propósito', () => {
    // Não-2xx dispara a "Ação em caso de falha" do painel, que transfere para uma pessoa.
    // "Falhar" aqui é "um humano assume", não "o paciente fica sem resposta".
    const t = codigo(ROTA).replace(/\s+/g, ' ');
    expect(t).toMatch(/Vou chamar um atendente\.', \{ status: 503 \}/);
  });

  it('o telefone sai mascarado no log', () => {
    const t = codigo(ROTA);
    const i = t.indexOf('console.info');
    const bloco = t.slice(i, i + 300);
    expect(bloco).toMatch(/mascararTelefone\(/);
  });
});
