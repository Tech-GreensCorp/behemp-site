/**
 * GUARDA — as rotas que o painel do ChatPro chama aguentam `?` usado como separador.
 *
 * A CLASSE DE ERRO, prevista pela Greens e **medida em produção** por mim em 11/09/2026.
 *
 * A URL configurada no painel já leva query (`?tem=receita_medica`). Quando o painel emenda os
 * parâmetros dele, pode usar `?` outra vez:
 *
 *     .../bot-link?tem=receita_medica?sessionId=abc
 *
 * O `URLSearchParams` lê isso como **um** parâmetro — `tem` = `receita_medica?sessionId=abc`.
 * O manifesto morre, e o `sessionId` junto.
 *
 * 🔴 E FALHA DO PIOR JEITO: em silêncio. Medi os dois contra produção, mesmo segredo,
 * telefones diferentes:
 *
 *     ?tem=receita_medica?sessionId=…  →  HTTP 200 · link válido · "já recebemos": 0 seções
 *     ?tem=receita_medica&sessionId=…  →  HTTP 200 · link válido · "já recebemos": 1 seção
 *
 * Ninguém vê erro. O paciente abre o link e a tela pede documento que ele já mandou — e o
 * atendimento vai procurar defeito no upload.
 *
 * ⚠️ REJEITADA a saída de criar **uma rota por fluxo** para nenhuma URL precisar de query.
 * Multiplicar endpoints por limitação de UI de terceiro é pagar para sempre por um problema de
 * uma tela. Uma query válida **nunca** tem `?` depois do primeiro: tratá-lo como separador não
 * é adivinhação, é a única leitura possível.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { parametrosDoPainel, separadorFoiCorrigido } from '@/lib/chatpro/query-do-painel';
import { lerManifestoDaUrl } from '@/lib/chatpro/manifesto-da-url';

function ler(c: string): string {
  return readFileSync(path.join(process.cwd(), c), 'utf8');
}
function semComentarios(f: string): string {
  return f
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l))
    .join('\n');
}

const BASE = 'https://be4hope.org/api/chatpro/bot-link';

// ─────────────────────────────────────────────────────────────────────────────
describe('a leitura tolera o separador errado', () => {
  it('🔴 com `?` no lugar de `&`, TODOS os parâmetros sobrevivem', () => {
    const p = parametrosDoPainel(`${BASE}?tem=receita_medica?sessionId=abc?name=Ana`);
    expect(p.get('tem')).toBe('receita_medica');
    expect(p.get('sessionId')).toBe('abc');
    expect(p.get('name')).toBe('Ana');
  });

  it('e com `&` correto continua idêntico — a correção não muda o caminho feliz', () => {
    const p = parametrosDoPainel(`${BASE}?tem=receita_medica&sessionId=abc&name=Ana`);
    expect(p.get('tem')).toBe('receita_medica');
    expect(p.get('sessionId')).toBe('abc');
    expect(p.get('name')).toBe('Ana');
  });

  it('mistura de `?` e `&` também', () => {
    const p = parametrosDoPainel(`${BASE}?tem=receita_medica&name=Ana?sessionId=abc`);
    expect(p.get('tem')).toBe('receita_medica');
    expect(p.get('name')).toBe('Ana');
    expect(p.get('sessionId')).toBe('abc');
  });

  it('sem query nenhuma não estoura', () => {
    expect(parametrosDoPainel(BASE).get('tem')).toBeNull();
  });

  it('🔴 e o manifesto volta a ser lido — que é o que se perdia', () => {
    const p = parametrosDoPainel(`${BASE}?tem=receita_medica,documento_identidade?sessionId=abc`);
    const m = lerManifestoDaUrl(p);
    expect(m.documentos).toEqual(['receita_medica', 'documento_identidade']);
    expect(m.declarado).toBe(true);
  });

  it('⚠️ sem a correção, o manifesto morria — a prova de que o caso é real', () => {
    // `searchParams` cru é o comportamento de antes.
    const cru = new URL(`${BASE}?tem=receita_medica?sessionId=abc`).searchParams;
    expect(cru.get('tem')).toBe('receita_medica?sessionId=abc');
    expect(lerManifestoDaUrl(cru).declarado).toBe(false);
  });

  /**
   * 🔴 O CASO QUE FALTAVA, e que deixou o defeito passar para produção.
   *
   * A primeira versão recebia `request.nextUrl`. Os testes passavam e **produção continuava
   * perdendo o manifesto**, com o código já no servidor.
   *
   * ⚠️ E a explicação que eu tinha escrito estava ERRADA: medi `new NextRequest(url)` e o
   * `nextUrl.search` **preserva** o `?`, igual ao `request.url`. A causa em produção não foi
   * isolada — a mudança para a string crua é hipótese de custo baixo, não causa provada.
   *
   * O que este caso garante continua valendo: a função lê a string crua, sem parser
   * intermediário. Se a próxima medição em produção continuar falhando, o problema está antes
   * daqui, e é preciso fazer o servidor dizer o que viu.
   */
  it('🔴 lê a string crua, sem passar por parser de URL', () => {
    const crua = `${BASE}?tem=receita_medica?sessionId=abc`;
    expect(parametrosDoPainel(crua).get('tem')).toBe('receita_medica');
    // E o que um parser faria com a mesma string — o comportamento que me enganou.
    expect(new URL(crua).searchParams.get('tem')).toBe('receita_medica?sessionId=abc');
  });

  /**
   * 🔴 O CASO QUE A ROTA DE ECO REVELOU, e que duas tentativas anteriores não cobriam.
   *
   * Em produção o segundo `?` **não chega como `?`**: o proxy reverso o percent-encoda para
   * `%3F`, e codifica o `=` seguinte como `%3D`. Medido pelo `/api/chatpro/eco`:
   *
   *     "crua": ".../eco?tem=autorizacao_anvisa%3FsessionId%3Dabc&name=X"
   *     "temSeparadorErrado": false      ← não havia `?` literal para trocar
   *
   * As duas versões anteriores procuravam um `?` que já não existia ali. Este caso usa a
   * string **exata** que o servidor reportou.
   */
  it('🔴 trata o `%3F` que o proxy produz — a forma real em produção', () => {
    const producao =
      'https://0.0.0.0:3000/api/chatpro/bot-link?tem=autorizacao_anvisa%3FsessionId%3Dabc&name=X';
    const p = parametrosDoPainel(producao);
    expect(p.get('tem')).toBe('autorizacao_anvisa');
    expect(p.get('sessionId')).toBe('abc');
    expect(p.get('name')).toBe('X');
  });

  it('e o manifesto sobrevive à forma codificada', () => {
    const m = lerManifestoDaUrl(
      parametrosDoPainel(`${BASE}?tem=receita_medica,documento_identidade%3FsessionId%3Dabc`),
    );
    expect(m.documentos).toEqual(['receita_medica', 'documento_identidade']);
    expect(m.declarado).toBe(true);
  });

  it('o `%3f` minúsculo também — percent-encoding não é sensível a caixa', () => {
    expect(parametrosDoPainel(`${BASE}?tem=receita_medica%3fsessionId%3dabc`).get('tem')).toBe(
      'receita_medica',
    );
  });

  /**
   * 🔴 O CASO QUE UMA SABOTAGEM MINHA REVELOU FALTANDO — e que quase foi commitado.
   *
   * A sabotagem era trocar o `map` seletivo por uma decodificação da query INTEIRA. Ela
   * **passou**, porque o controle que eu tinha escrito usava `%253D` — que a sabotagem não
   * toca, já que `%3D` não ocorre em `a%253Db`. Controle que não distingue não é controle.
   *
   * O que distingue é o `%26`, e **antes** do `%3F`: decodificado fora de hora, ele vira um
   * `&` de verdade e **parte o valor em dois parâmetros**. Com `%3D` os dois caminhos dão o
   * mesmo resultado, porque o `URLSearchParams` já trata o primeiro `=` como separador — foi
   * por isso que a asserção anterior não podia acusar nada.
   */
  it('🔴 a decodificação NÃO vaza para o que vem ANTES do `%3F`', () => {
    const p = parametrosDoPainel(`${BASE}?obs=a%26b&tem=receita_medica%3FsessionId%3Dabc`);
    // Decodificada cedo demais, esta linha viraria `obs=a` + um parâmetro `b` vazio.
    expect(p.get('obs')).toBe('a&b');
    expect(p.has('b')).toBe(false);
    // E o conserto do lado de lá do `%3F` continua acontecendo.
    expect(p.get('tem')).toBe('receita_medica');
    expect(p.get('sessionId')).toBe('abc');
  });

  it('sem `%3F` na query, nada é decodificado', () => {
    const p = parametrosDoPainel(`${BASE}?tem=receita_medica&obs=a%253Db`);
    expect(p.get('tem')).toBe('receita_medica');
    expect(p.get('obs')).toBe('a%3Db');
  });

  it('a correção é detectável nas DUAS formas, para o log poder avisar', () => {
    expect(separadorFoiCorrigido(`${BASE}?a=1%3Fb=2`)).toBe(true);
    expect(separadorFoiCorrigido(`${BASE}?a=1%3fb=2`)).toBe(true);
  });

  it('a correção é detectável, para o log poder avisar', () => {
    expect(separadorFoiCorrigido(`${BASE}?a=1?b=2`)).toBe(true);
    expect(separadorFoiCorrigido(`${BASE}?a=1&b=2`)).toBe(false);
    expect(separadorFoiCorrigido(BASE)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('as três rotas do painel usam a leitura tolerante', () => {
  const rotas = {
    'bot-link': 'app/api/chatpro/bot-link/route.ts',
    start: 'app/api/chatpro/start/route.ts',
    triagem: 'app/api/chatpro/triagem/route.ts',
  };

  it.each(Object.entries(rotas))('%s lê pelo helper', (_nome, caminho) => {
    const codigo = semComentarios(ler(caminho));
    expect(codigo).toContain('parametrosDoPainel(');
  });

  it.each(Object.entries(rotas))('%s não lê `searchParams` cru', (_nome, caminho) => {
    const codigo = semComentarios(ler(caminho));
    expect(codigo).not.toMatch(/\.searchParams\b/);
  });

  it('o bot-link avisa no log quando corrigiu — senão ninguém descobre o painel errado', () => {
    const codigo = semComentarios(ler(rotas['bot-link']));
    expect(codigo).toContain('separadorFoiCorrigido(');
    expect(codigo).toMatch(/console\.warn\([^)]*`\?` no lugar de `&`/);
  });

  /**
   * ⚠️ FRONTEIRA DE PALAVRA, não substring. A primeira versão acusou o log legítimo:
   * `request.nextUrl.pathname` **contém** `name`. É "menção vs uso" outra vez, agora na forma
   * de substring — e um guarda que acusa inocente é um guarda que alguém desliga.
   */
  it('e esse log não leva dado pessoal', () => {
    const codigo = semComentarios(ler(rotas['bot-link']));
    const logs = codigo.match(/console\.warn\([^;]*\)/g) ?? [];
    expect(logs.length).toBeGreaterThan(0);
    for (const l of logs) {
      for (const proibido of ['telefone', 'phone', 'email', 'nome', 'name', 'cpf']) {
        expect(l, `${proibido} em: ${l}`).not.toMatch(new RegExp(`\\b${proibido}\\b`, 'i'));
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('a rota de eco existe, e é instrumento — não produto', () => {
  /**
   * 🔴 ELA NASCEU DE UM DEPLOY DESPERDIÇADO. A correção subiu, produção continuou falhando, e
   * não havia como perguntar ao servidor o que ele viu: log não é acessível daqui, e a
   * resposta do `bot-link` é a mensagem do paciente. O passo seguinte teria sido outra
   * hipótese e outro deploy.
   */
  const eco = semComentarios(ler('app/api/chatpro/eco/route.ts'));

  it('exige o mesmo segredo do bot-link', () => {
    expect(eco).toContain('identificarConta(lerSegredoDoCabecalho(request.headers))');
    expect(eco).toMatch(/status: 401/);
  });

  it('tem limite de requisição — rota que ecoa entrada é ferramenta de sondagem', () => {
    expect(eco).toContain('consumir(');
    expect(eco).toMatch(/if \(!limite\.permitido\)/);
  });

  /**
   * ⚠️ `lastIndexOf`, não `indexOf`. A primeira versão fatiava do PRIMEIRO
   * `NextResponse.json` — o do 429 — e apanhava o `request.headers` legítimo da checagem de
   * segredo, que vem depois. Escopo errado acusa inocente.
   */
  it('🔴 NÃO ecoa cabeçalho — devolveria o próprio segredo a quem o mandou', () => {
    const corpo = eco.slice(eco.lastIndexOf('return NextResponse.json('));
    expect(corpo).not.toMatch(/request\.headers/);
    expect(corpo).not.toMatch(/\bsegredo\b/i);
  });

  it('nem corpo da requisição', () => {
    expect(eco).not.toMatch(/request\.(json|text|formData)\(/);
  });

  it('mostra as DUAS leituras lado a lado — é essa diferença que responde a pergunta', () => {
    expect(eco).toContain('comoONextLe');
    expect(eco).toContain('comoNosLemos');
    expect(eco).toContain('nextUrlSearch');
    expect(eco).toContain('crua: request.url');
  });

  it('e não entra em cache', () => {
    expect(eco).toContain("'cache-control': 'no-store'");
  });
});
