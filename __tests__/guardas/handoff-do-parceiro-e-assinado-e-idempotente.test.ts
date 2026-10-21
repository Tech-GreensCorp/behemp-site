/**
 * Guarda: o handoff do parceiro é assinado, tem janela, e um reenvio não vira segundo
 * cadastro.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * Aqui a idempotência não é higiene: **é dinheiro**. Medido no schema da Greens
 * (`prisma/schema.prisma`, Sprint G1): `behempJourney != NONE` roteia o pagamento para o
 * Mercado Pago **com desconto collab**; `NONE` vai para a Cannect. Um handoff duplicado ou
 * perdido não erra só um cadastro — erra o gateway e o valor de uma compra.
 *
 * E a assinatura aqui é mais forte que a defesa do ChatPro, de propósito: lá a plataforma
 * não assina nada e foi preciso inventar a confirmação reversa; aqui **nós escrevemos os
 * dois lados**, então HMAC sobre id + timestamp + corpo é possível — e o que é possível
 * provar, prova-se.
 *
 * Referência: Standard Webhooks / Stripe / Svix — HMAC-SHA256, tolerância de 300 s,
 * idempotência pela chave do evento.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { pendenciasDe, normalizarManifesto } from '../../lib/parceiros/documentos';
import { urlDeRetornoPermitida } from '../../lib/parceiros/retorno';
import {
  assinar,
  lerCabecalhos,
  mensagemAssinada,
  verificarAssinatura,
  TOLERANCIA_EM_SEGUNDOS,
} from '../../lib/parceiros/assinatura';

const RAIZ = join(import.meta.dirname, '..', '..');
const fonte = (a: string) => readFileSync(join(RAIZ, a), 'utf8');
const codigo = (a: string) =>
  fonte(a)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const ASSINATURA = 'lib/parceiros/assinatura.ts';
const HANDOFF = 'lib/parceiros/handoff.ts';
const ROTA = 'app/api/parceiros/greens/cadastro/route.ts';
const MIDDLEWARE = 'middleware.ts';
const SCHEMA = 'db/schema/solicitacoes-cadastro.ts';

const SEGREDO = 'segredo-de-teste-do-guarda';
const CORPO = '{"nomeCompleto":"Ana","email":"ana@x.com"}';
const AGORA = 1_757_000_000;

function cabecalhosValidos(agora = AGORA) {
  const timestamp = String(agora);
  return {
    id: 'evt-1',
    timestamp,
    assinatura: assinar('evt-1', timestamp, CORPO, SEGREDO),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. A ASSINATURA COBRE O QUE PRECISA COBRIR
// ═══════════════════════════════════════════════════════════════════════════════

describe('a verificação aceita o legítimo e recusa o resto', () => {
  it('aceita chamada íntegra e dentro da janela', () => {
    const r = verificarAssinatura({
      cabecalhos: cabecalhosValidos(),
      corpoCru: CORPO,
      segredo: SEGREDO,
      agoraEmSegundos: AGORA,
    });
    expect(r.valida).toBe(true);
  });

  it('🔴 recusa quando o CORPO muda — um dígito basta', () => {
    // Se a assinatura não cobrisse o corpo, trocar o e-mail passaria batido.
    const r = verificarAssinatura({
      cabecalhos: cabecalhosValidos(),
      corpoCru: '{"nomeCompleto":"Ana","email":"atacante@x.com"}',
      segredo: SEGREDO,
      agoraEmSegundos: AGORA,
    });
    expect(r.valida).toBe(false);
    expect((r as { motivo: string }).motivo).toBe('assinatura_invalida');
  });

  it('🔴 recusa quando o ID muda — ele é a chave de idempotência', () => {
    // Sem o id na assinatura, alguém reusaria uma assinatura boa com id novo e criaria
    // um segundo cadastro — que aqui significa gateway e desconto errados.
    const c = { ...cabecalhosValidos(), id: 'evt-2' };
    expect(
      verificarAssinatura({
        cabecalhos: c,
        corpoCru: CORPO,
        segredo: SEGREDO,
        agoraEmSegundos: AGORA,
      }).valida,
    ).toBe(false);
  });

  it('🔴 recusa fora da janela — o replay é o que a assinatura sozinha não impede', () => {
    const antigo = AGORA - TOLERANCIA_EM_SEGUNDOS - 1;
    const r = verificarAssinatura({
      cabecalhos: cabecalhosValidos(antigo),
      corpoCru: CORPO,
      segredo: SEGREDO,
      agoraEmSegundos: AGORA,
    });
    expect(r.valida).toBe(false);
    expect((r as { motivo: string }).motivo).toBe('fora_da_janela');
  });

  it('🔴 recusa carimbo no FUTURO, não só no passado', () => {
    // Sem `Math.abs`, um relógio adiantado esticaria a janela para sempre.
    const futuro = AGORA + TOLERANCIA_EM_SEGUNDOS + 1;
    expect(
      verificarAssinatura({
        cabecalhos: cabecalhosValidos(futuro),
        corpoCru: CORPO,
        segredo: SEGREDO,
        agoraEmSegundos: AGORA,
      }).valida,
    ).toBe(false);
  });

  it('aceita na borda exata da janela', () => {
    // Teste de vacuidade: se a janela fosse 0, tudo acima passaria igual.
    expect(
      verificarAssinatura({
        cabecalhos: cabecalhosValidos(AGORA - TOLERANCIA_EM_SEGUNDOS),
        corpoCru: CORPO,
        segredo: SEGREDO,
        agoraEmSegundos: AGORA,
      }).valida,
    ).toBe(true);
  });

  it('recusa sem segredo configurado, e diz que é isso', () => {
    const r = verificarAssinatura({
      cabecalhos: cabecalhosValidos(),
      corpoCru: CORPO,
      segredo: undefined,
      agoraEmSegundos: AGORA,
    });
    expect(r.valida).toBe(false);
    expect((r as { motivo: string }).motivo).toBe('sem_segredo');
  });

  it.each([
    ['id', { id: '' }],
    ['timestamp', { timestamp: '' }],
    ['assinatura', { assinatura: '' }],
  ])('recusa com %s ausente', (_n, patch) => {
    expect(
      verificarAssinatura({
        cabecalhos: { ...cabecalhosValidos(), ...patch },
        corpoCru: CORPO,
        segredo: SEGREDO,
        agoraEmSegundos: AGORA,
      }).valida,
    ).toBe(false);
  });

  it('não estoura com assinatura de tamanho diferente', () => {
    // `timingSafeEqual` LANÇA quando os buffers têm tamanhos diferentes. Sem a checagem
    // de comprimento, uma assinatura curta viraria 500 em vez de 401.
    expect(() =>
      verificarAssinatura({
        cabecalhos: { ...cabecalhosValidos(), assinatura: 'abc' },
        corpoCru: CORPO,
        segredo: SEGREDO,
        agoraEmSegundos: AGORA,
      }),
    ).not.toThrow();
  });

  it('aceita o prefixo `sha256=`, que alguns clientes mandam', () => {
    const c = cabecalhosValidos();
    expect(
      verificarAssinatura({
        cabecalhos: { ...c, assinatura: `sha256=${c.assinatura}` },
        corpoCru: CORPO,
        segredo: SEGREDO,
        agoraEmSegundos: AGORA,
      }).valida,
    ).toBe(true);
  });

  it('a mensagem assinada inclui os TRÊS componentes, nesta ordem', () => {
    // O formato é contrato: separador diferente = assinatura diferente, e o sintoma é
    // "inválida" sem nenhuma pista do motivo.
    expect(mensagemAssinada('a', 'b', 'c')).toBe('a.b.c');
  });

  it('lê os cabeçalhos pelos nomes do contrato', () => {
    const h = new Headers({
      'x-parceiro-evento-id': 'e1',
      'x-parceiro-timestamp': '123',
      'x-parceiro-assinatura': 'abc',
    });
    expect(lerCabecalhos(h)).toEqual({ id: 'e1', timestamp: '123', assinatura: 'abc' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. A COMPARAÇÃO É EM TEMPO CONSTANTE
// ═══════════════════════════════════════════════════════════════════════════════

describe('o segredo nunca é comparado com ===', () => {
  it('🔴 timingSafeEqual é CHAMADO, não só importado', () => {
    // Checar a menção aprovaria código que importa e não usa — erro que já aconteceu
    // neste repositório, no guarda do ChatPro.
    expect(codigo(ASSINATURA)).toMatch(/timingSafeEqual\(\s*Buffer/);
  });

  it('🔴 não há comparação direta de assinatura', () => {
    expect(
      /(recebida|esperada)\s*[=!]==\s*(recebida|esperada)/.test(codigo(ASSINATURA)),
      'voltou a comparação de string',
    ).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. A ROTA LÊ O CORPO CRU ANTES DE VERIFICAR
// ═══════════════════════════════════════════════════════════════════════════════

describe('a rota verifica os bytes que chegaram, não uma reserialização', () => {
  it('🔴 usa request.text(), não request.json(), antes da verificação', () => {
    // `json()` faria o parse antes; reserializar produz string diferente da assinada
    // (ordem de chaves, espaço, número normalizado) e a assinatura falharia sem motivo
    // aparente.
    const t = codigo(ROTA).replace(/\s+/g, ' ');
    expect(t).toMatch(/const corpoCru = await request\.text\(\)[\s\S]*?verificarAssinatura\(/);
    expect(/await request\.json\(\)/.test(t), 'voltou o json() antes da verificação').toBe(false);
  });

  it('🔴 o eventoId vem do CABEÇALHO, e o corpo não pode sobrescrevê-lo', () => {
    // A primeira versão espalhava `...analise.data` DEPOIS de `eventoId`, o que fazia o
    // corpo vencer — o oposto do que o comentário dizia. O type-check acusou (TS2783).
    const t = codigo(ROTA).replace(/\s+/g, ' ');
    expect(t, 'o eventoId deixou de vir do cabeçalho').toMatch(/eventoId: cabecalhos\.id,/);
    // 🔴 E NENHUM SPREAD do corpo na chamada do serviço. Trocar a ordem do spread
    // resolveria o caso de hoje; proibi-lo elimina a classe — um campo novo no corpo,
    // amanhã, não alcança parâmetro que ninguém listou de propósito.
    const chamada = t.slice(t.indexOf('ServicoDeHandoff().receber({'));
    expect(
      /\.\.\.(dados|analise\.data|corpo)/.test(chamada.slice(0, 400)),
      'voltou o spread do corpo na chamada do serviço',
    ).toBe(false);
  });

  it('divergência entre corpo e cabeçalho é RECUSA, não escolha silenciosa', () => {
    expect(codigo(ROTA)).toMatch(/EVENTO_DIVERGENTE/);
  });

  it('sem segredo a rota responde 503, e não fica aberta', () => {
    expect(codigo(ROTA).replace(/\s+/g, ' ')).toMatch(/'sem_segredo'[\s\S]{0,200}status: 503/);
  });

  it('todos os outros motivos respondem o MESMO 401', () => {
    // Distinguir "assinatura inválida" de "fora da janela" diria a quem tenta se o
    // segredo está certo e só o relógio está errado.
    const t = codigo(ROTA);
    for (const vazar of ['fora_da_janela', 'assinatura_invalida', 'timestamp_invalido']) {
      expect(new RegExp(`erro:[^\\n]*${vazar}`).test(t), `o motivo ${vazar} vaza na resposta`).toBe(
        false,
      );
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. IDEMPOTÊNCIA — AQUI ELA VALE DINHEIRO
// ═══════════════════════════════════════════════════════════════════════════════

describe('um reenvio não vira segundo cadastro', () => {
  it('🔴 o serviço procura pelo id do evento ANTES de inserir', () => {
    const t = codigo(HANDOFF).replace(/\s+/g, ' ');
    expect(t, 'a busca por evento sumiu').toMatch(
      /eq\(solicitacoesCadastro\.eventoDoParceiro, entrada\.eventoId\)[\s\S]*?db \.insert/,
    );
  });

  it('🔴 o índice do evento é COMUM, não único', () => {
    // Unique faria reentrega de webhook virar erro 500. É o mesmo motivo pelo qual o
    // `behempReferralId` da Greens não é `@unique` — medido no schema deles.
    const linha = fonte(SCHEMA)
      .split('\n')
      .find((l) => l.includes('solicitacoes_cadastro_evento_parceiro_idx'));
    expect(linha, 'o índice do evento sumiu').toBeTruthy();
    expect(/uniqueIndex/.test(linha!), 'virou unique e reentrega passaria a dar 500').toBe(false);
  });

  it('🔴 o referralId devolvido é o `id`, nunca o protocolo', () => {
    // O protocolo é sequencial: quem tem um adivinha os vizinhos. Este valor atravessa a
    // fronteira entre duas empresas e localiza um pedido.
    const t = codigo(HANDOFF);
    expect(t).toMatch(/referralId: (criada|existente|porEvento)?\.?id/);
    expect(/referralId:\s*\w*protocolo/i.test(t), 'o protocolo virou referralId').toBe(false);
  });

  it('reenvio emite token NOVO — o antigo não é recuperável', () => {
    const t = codigo(HANDOFF).replace(/\s+/g, ' ');
    expect(t).toMatch(/reemitir\([\s\S]{0,400}gerarToken\(\)/);
  });

  it('sem e-mail nem telefone, recusa em vez de criar registro inútil', () => {
    expect(codigo(HANDOFF)).toMatch(
      /if \(!email && !telefone\) throw new ErroDeContatoInsuficiente/,
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. A ROTA PRECISA ESTAR ABERTA AO CLERK, E O LOG FECHADO À PII
// ═══════════════════════════════════════════════════════════════════════════════

describe('a rota é alcançável e não vaza dado pessoal', () => {
  it('🔴 /api/parceiros está nas rotas públicas do middleware', () => {
    // Sem isto a chamada da Greens recebe redirect para o login e o log da aplicação não
    // mostra NADA — a requisição nunca chega à rota. Foi o Item 21, com o ChatPro.
    const t = codigo(MIDDLEWARE);
    const inicio = t.indexOf('createRouteMatcher([');
    const lista = t.slice(inicio, t.indexOf(']);', inicio));
    expect(lista, 'a rota do parceiro voltaria a receber redirect').toMatch(
      /'\/api\/parceiros\(\.\*\)'/,
    );
  });

  it('🔴 e-mail e telefone só aparecem MASCARADOS no log', () => {
    const t = codigo(ROTA);
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
    expect(blocos.length, 'a rota ficou sem log nenhum').toBeGreaterThan(0);
    for (const b of blocos) {
      if (/email/.test(b)) expect(b, `e-mail sem máscara: ${b}`).toMatch(/mascararEmail\(/);
      if (/telefone/.test(b)) expect(b, `telefone sem máscara: ${b}`).toMatch(/mascararTelefone\(/);
      expect(/\bcpf\b/i.test(b), `CPF em log: ${b}`).toBe(false);
    }
  });

  it('o erro capturado guarda erro.name, nunca erro.message', () => {
    // A mensagem do Postgres carrega o valor da coluna que violou a constraint — e as
    // colunas aqui são e-mail, telefone e CPF.
    expect(codigo(ROTA)).toMatch(/erro instanceof Error \? erro\.name/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. O RETORNO NÃO PODE VIRAR REDIRECIONAMENTO ABERTO
// ═══════════════════════════════════════════════════════════════════════════════

describe('a URL de retorno é conferida por ORIGEM, nunca por prefixo', () => {
  const ANTES = process.env.PARCEIRO_ORIGENS_DE_RETORNO;
  beforeEach(() => {
    process.env.PARCEIRO_ORIGENS_DE_RETORNO = 'https://greens-corp.com,https://app.greens-corp.com';
  });
  afterEach(() => {
    process.env.PARCEIRO_ORIGENS_DE_RETORNO = ANTES;
  });

  it.each(['https://greens-corp.com/login', 'https://app.greens-corp.com/checkout?x=1'])(
    'aceita origem permitida: %s',
    (u) => {
      expect(urlDeRetornoPermitida(u)).not.toBeNull();
    },
  );

  it('🔴 recusa domínio que COMEÇA com o permitido', () => {
    // `https://greens-corp.com.evil.tld` começa com o nosso domínio e não é ele.
    // Comparar prefixo de string é a forma clássica de errar isto.
    expect(urlDeRetornoPermitida('https://greens-corp.com.evil.tld/roubar')).toBeNull();
  });

  it('🔴 recusa subdomínio não listado', () => {
    expect(urlDeRetornoPermitida('https://qualquer.greens-corp.com/x')).toBeNull();
  });

  it.each(['javascript:alert(1)', 'data:text/html,<script>', 'http://greens-corp.com/login'])(
    'recusa esquema perigoso ou inseguro: %s',
    (u) => {
      // `javascript:` e `data:` passam pelo construtor de URL e executam se chegarem a
      // um href. E http:// simples entregaria o paciente por um canal sem TLS.
      expect(urlDeRetornoPermitida(u)).toBeNull();
    },
  );

  it('🔴 recusa http:// MESMO se a origem estiver na lista', () => {
    /**
     * Este caso existe porque uma SABOTAGEM passou verde: remover a checagem de protocolo
     * não mudava nada, já que a lista de origens (todas https) sozinha recusava
     * `javascript:` e `http://`. Os testes anteriores cobriam o COMPORTAMENTO, não a
     * LINHA — eram vacuosos.
     *
     * Com um `http://` na lista, a checagem de protocolo vira a única defesa. É o cenário
     * de alguém pôr um endereço de desenvolvimento na variável e ele vazar para produção.
     */
    process.env.PARCEIRO_ORIGENS_DE_RETORNO = 'http://greens-corp.com,https://greens-corp.com';
    expect(urlDeRetornoPermitida('http://greens-corp.com/login')).toBeNull();
    // CONTROLE: o https da mesma lista continua passando — senão o caso acima seria
    // satisfeito por uma função que recusa tudo.
    expect(urlDeRetornoPermitida('https://greens-corp.com/login')).not.toBeNull();
  });

  it('🔴 sem lista configurada, NADA é aceito', () => {
    // Falha fechada: redirecionamento aberto é pior que botão de volta ausente.
    process.env.PARCEIRO_ORIGENS_DE_RETORNO = '';
    expect(urlDeRetornoPermitida('https://greens-corp.com/login')).toBeNull();
  });

  it('🔴 TODA gravação de urlDeRetorno passa pela validação', () => {
    /**
     * ⚠️ A primeira versão deste caso checava se `urlDeRetornoPermitida(` aparecia no
     * arquivo — e uma sabotagem passou VERDE: existem DOIS pontos que gravam o campo (o
     * insert e o reaproveitamento), e derrubar um deixava o outro satisfazendo o regex.
     *
     * É a sexta vez que uma checagem deste repositório confunde MENÇÃO com USO. A
     * correção é a mesma de sempre: contar os pontos, não procurar a palavra.
     *
     * Validar na exibição em vez de na gravação espalharia a checagem por toda tela que
     * use o campo — e bastaria uma esquecer para virar redirecionamento aberto.
     */
    const t = codigo(HANDOFF);
    const gravacoes = [...t.matchAll(/urlDeRetorno:/g)];
    expect(gravacoes.length, 'nenhuma gravação de urlDeRetorno encontrada').toBeGreaterThan(0);

    for (const m of gravacoes) {
      const trecho = t.slice(m.index, m.index + 90);
      expect(trecho, `gravação sem validação: ${trecho.split('\n')[0]}`).toMatch(
        /urlDeRetorno:\s*urlDeRetornoPermitida\(/,
      );
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. PENDÊNCIA DE DOCUMENTO NÃO BLOQUEIA
// ═══════════════════════════════════════════════════════════════════════════════

describe('o manifesto vira aviso, nunca trava', () => {
  it('quem não mandou nada tem os cinco como pendência', () => {
    expect(pendenciasDe([])).toHaveLength(5);
    expect(pendenciasDe(null)).toHaveLength(5);
  });

  it('o que o parceiro tem sai da lista', () => {
    const p = pendenciasDe(['receita_medica', 'documento_identidade']);
    expect(p.map((x) => x.chave).sort()).toEqual([
      'autorizacao_anvisa',
      'comprovante_residencia',
      'laudo_medico',
    ]);
  });

  it('🔴 o laudo é o ÚNICO opcional — ANVISA e receita não são', () => {
    /**
     * O formulário da Greens chama `autorizacao_anvisa` de opcional, e a palavra engana:
     * lá ela é dispensável para ENVIAR o formulário; aqui ela é **necessária** para o
     * paciente importar, e falta justamente porque ele ainda não a tem — é um dos dois
     * motivos de ele estar vindo.
     *
     * Marcá-la "(opcional)" na tela diria que é dispensável. Não é: nós é que vamos
     * tirá-la com ele.
     */
    const p = pendenciasDe([]);
    expect(p.filter((x) => x.opcional).map((x) => x.chave)).toEqual(['laudo_medico']);
    expect(
      p
        .filter((x) => x.resolvemosAqui)
        .map((x) => x.chave)
        .sort(),
    ).toEqual(['autorizacao_anvisa', 'receita_medica']);
  });

  it('🔴 nenhum documento é opcional E resolvido aqui ao mesmo tempo', () => {
    // As duas marcas dizem coisas contraditórias ao paciente: uma que ele pode ignorar,
    // outra que nós vamos cuidar. Um documento com as duas confundiria.
    for (const p of pendenciasDe([])) {
      expect(p.opcional && p.resolvemosAqui, `${p.chave} tem as duas marcas`).toBe(false);
    }
  });

  it('a tela NÃO chama a ANVISA de opcional', () => {
    const FORM = 'app/(auth)/cadastro/[token]/_components/formulario-de-cadastro.tsx';
    expect(fonte(FORM)).toMatch(/nós resolvemos com você/);
  });

  it('documento desconhecido é descartado, não derruba a chamada', () => {
    // Um documento novo do lado deles não pode quebrar o cadastro de um paciente aqui.
    expect(normalizarManifesto(['receita_medica', 'coisa_nova', 42, null])).toEqual([
      'receita_medica',
    ]);
    expect(normalizarManifesto('não é array')).toEqual([]);
  });

  it('🔴 a tela diz que a pendência NÃO impede continuar', () => {
    const FORM = 'app/(auth)/cadastro/[token]/_components/formulario-de-cadastro.tsx';
    expect(fonte(FORM)).toMatch(/Nada disso impede você de continuar/);
  });

  it('🔴 nenhuma pendência entra na condição que libera o envio', () => {
    // Se `pendencias` aparecesse no `podeEnviar`, a falta de um documento passaria a
    // bloquear o cadastro — o oposto da D-06.
    const FORM = 'app/(auth)/cadastro/[token]/_components/formulario-de-cadastro.tsx';
    const t = codigo(FORM).replace(/\s+/g, ' ');
    const bloco = t.slice(t.indexOf('const podeEnviar'), t.indexOf('const podeEnviar') + 300);
    expect(/pendencias/.test(bloco), 'pendência virou bloqueio').toBe(false);
  });

  it('🔴 quem já tem conta recebe um CAMINHO, não só uma mensagem', () => {
    // Antes isto era só um texto de erro do Clerk: o paciente lia "já existe uma conta"
    // e ficava preso, sem para onde ir.
    const FORM = 'app/(auth)/cadastro/[token]/_components/formulario-de-cadastro.tsx';
    const t = fonte(FORM);
    expect(t).toMatch(/jaTemConta/);
    expect(t).toMatch(/Entrar na minha conta/);
  });
});
