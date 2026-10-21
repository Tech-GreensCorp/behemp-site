/**
 * Guarda: quando o painel do ChatPro recusa, a mensagem diz QUAL portão recusou.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * O bloco "Requisição externa" do construtor de fluxo do ChatPro entrega o **corpo** da
 * resposta como mensagem na conversa, e dispara a "Ação em caso de falha" — transferir para
 * um atendente — em **qualquer** status não-2xx. Isso é desejado: falhar significa que um
 * humano assume, não que o paciente fica sem resposta.
 *
 * 🔴 O CUSTO É QUE TODOS OS PORTÕES FICAM IGUAIS DE FORA. Limite de requisição, integração
 * sem conta configurada, segredo que não bate, contato não confirmado e exceção inesperada
 * produzem a MESMA transferência silenciosa. Palavras da Greens em 14/09/2026:
 *
 *   _"hoje cinco portões diferentes produzem a mesma transferência silenciosa para a
 *   Recepção, e foi isso que custou três sessões de diagnóstico"_
 *
 * E custou mesmo: em 14/09 foram necessárias medições do log da VPS, contagem por portão e
 * comparação de impressão de segredo para descobrir **qual** dos cinco tinha recusado um
 * teste — porque as linhas do `error.log` não têm sequer timestamp.
 *
 * O código curto no corpo resolve isso pelo canal que já existe: quem testa lê a causa na
 * própria conversa, na hora. E não revela nada — `[E-SEGREDO]` diz que o segredo não bate,
 * não qual é; é a mesma informação que o 401 já dava, com um rótulo estável.
 *
 * ⚠️ ESTÁVEL É O PONTO. O texto em português pode ser reescrito a qualquer momento; o código
 * não. Quem correlaciona incidente ao longo do tempo precisa de algo que sobreviva a isso.
 *
 * ⚠️ E O 2xx NÃO LEVA CÓDIGO. O corpo de sucesso é o que o **paciente** lê. Prefixar tudo
 * "resolveria" o guarda entregando `[E-OK] Olá!` a quem está sendo atendido.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const RAIZ = join(import.meta.dirname, '..', '..');

const semComentarios = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/**
 * As rotas que respondem TEXTO ao painel — derivadas do disco, nunca listadas.
 *
 * 🔴 Listar foi o defeito do guarda vizinho: `duas-contas-de-chatpro-nao-se-misturam`
 * guardava o caminho do `bot-link` numa constante, e `triagem` e `intake` ficaram meses
 * quebradas para a conta Greens com a suíte verde.
 */
function rotasQueFalamComOPainel(): string[] {
  const achadas: string[] = [];
  const andar = (dir: string) => {
    for (const entrada of readdirSync(dir, { withFileTypes: true })) {
      const caminho = join(dir, entrada.name);
      if (entrada.isDirectory()) andar(caminho);
      else if (entrada.name === 'route.ts') {
        /**
         * ⚠️ `\b` no fim, e comentários fora. `includes('text/plain')` casava com
         * `text/plainX` — uma sabotagem removeu o tipo do cabeçalho e o guarda continuou
         * "encontrando" a rota, verde, medindo um arquivo que já não falava com o painel.
         */
        if (/text\/plain\b/.test(semComentarios(readFileSync(caminho, 'utf8')))) {
          achadas.push(caminho.slice(join(RAIZ, '').length));
        }
      }
    }
  };
  andar(join(RAIZ, 'app', 'api', 'chatpro'));
  return achadas.sort();
}

interface Resposta {
  corpo: string;
  status: number;
}

/**
 * Extrai (corpo literal, status) de cada resposta construída no arquivo.
 *
 * Varre com contagem de parênteses **pulando literais de string**, porque um parêntese
 * dentro do texto da mensagem desbalancearia a contagem e faria o guarda ler o corpo errado
 * — silenciosamente, que é o pior modo de um guarda falhar.
 *
 * Corpo dinâmico (`textoDaTriagem(...)`) é ignorado de propósito: o código de portão é para
 * a RECUSA, e recusa aqui é sempre literal.
 */
function respostasComCorpoLiteral(arquivo: string): Resposta[] {
  const t = semComentarios(readFileSync(join(RAIZ, arquivo), 'utf8'));
  const saida: Resposta[] = [];
  const abertura = /\b(?:textoPuro|new\s+Response|new\s+NextResponse)\s*\(/g;

  let achado: RegExpExecArray | null;
  while ((achado = abertura.exec(t)) !== null) {
    let i = achado.index + achado[0].length;
    let nivel = 1;
    while (i < t.length && nivel > 0) {
      const c = t[i];
      if (c === "'" || c === '"' || c === '`') {
        const aspa = c;
        i++;
        while (i < t.length && t[i] !== aspa) i += t[i] === '\\' ? 2 : 1;
      } else if (c === '(') nivel++;
      else if (c === ')') nivel--;
      i++;
    }
    const chamada = t.slice(achado.index + achado[0].length, i - 1);
    const corpo = chamada.match(/^\s*(['"])((?:\\.|(?!\1).)*)\1/);
    if (!corpo) continue;
    // `status: 401` no objeto de opções, ou `, 401` posicional como no `textoPuro`.
    /**
     * ⚠️ A VÍRGULA FINAL É OBRIGATÓRIA NO PADRÃO. O Prettier quebra chamadas longas em
     * várias linhas e deixa vírgula pendente (`422,` + `)`); a primeira versão exigia o
     * número colado no fim e ficou CEGA para dois portões — verde, com menos cobertura.
     */
    const status = chamada.match(/status:\s*(\d{3})/) ?? chamada.match(/,\s*(\d{3})\s*,?\s*$/);
    if (!status) continue;
    saida.push({ corpo: corpo[2], status: Number(status[1]) });
  }
  return saida;
}

const ROTAS = rotasQueFalamComOPainel();
const TODAS = ROTAS.flatMap((r) => respostasComCorpoLiteral(r).map((x) => ({ ...x, rota: r })));
const RECUSAS = TODAS.filter((r) => r.status >= 300);
/**
 * ⚠️ De 2 a 12 letras. A primeira versão exigia 3 — e uma sabotagem que punha `[E-OK]` num
 * 2xx passou VERDE, porque o código de duas letras não casava com o próprio detector. Um
 * guarda que só reconhece o formato que ele mesmo escreveu não protege de nada.
 */
const CODIGO = /^\[E-[A-Z]{2,12}\]\s/;

// ═══════════════════════════════════════════════════════════════════════════════
// 1. O INSTRUMENTO MEDE ALGUMA COISA
// ═══════════════════════════════════════════════════════════════════════════════

describe('a varredura não é vácuo', () => {
  it('🔴 acha rotas que falam com o painel', () => {
    expect(
      ROTAS.length,
      'nenhuma rota de texto puro encontrada: o guarda virou decorativo',
    ).toBeGreaterThanOrEqual(2);
  });

  it('🔴 as rotas conhecidas estão entre as varridas', () => {
    for (const esperada of ['bot-link', 'triagem']) {
      expect(
        ROTAS.some((r) => r.includes(esperada)),
        `${esperada} saiu da varredura`,
      ).toBe(true);
    }
  });

  it('🔴 acha respostas de RECUSA — sem elas, os casos abaixo não medem nada', () => {
    expect(RECUSAS.length, 'nenhuma recusa com corpo literal foi extraída').toBeGreaterThanOrEqual(
      5,
    );
  });

  it('🔴 o extrator não PERDE resposta nenhuma — duas contagens independentes batem', () => {
    /**
     * 🔴 Este caso nasceu de um defeito real, em 14/09/2026: rodar o Prettier quebrou as
     * chamadas do `bot-link` em várias linhas, o extrator deixou de casar o status de dois
     * portões, e a suíte ficou VERDE com dois casos a menos. Cobertura que some em silêncio
     * é pior que cobertura que nunca existiu — a contagem no `CLAUDE.md` passa a mentir.
     *
     * A defesa é não confiar num varredor só: contar os construtores de resposta com corpo
     * literal por um caminho independente, e exigir que os dois números batam.
     */
    for (const rota of ROTAS) {
      const t = semComentarios(readFileSync(join(RAIZ, rota), 'utf8'));
      const construtores = (
        t.match(/(?:textoPuro|new\s+Response|new\s+NextResponse)\s*\(\s*['"]/g) ?? []
      ).length;
      expect(
        respostasComCorpoLiteral(rota).length,
        `${rota}: o extrator leu menos respostas do que o arquivo tem`,
      ).toBe(construtores);
    }
  });

  it('🔴 o extrator lê o status junto do corpo, não um status qualquer', () => {
    // Controle: o 401 do segredo e o 503 da configuração são status diferentes no mesmo
    // arquivo. Se o extrator casasse o primeiro `status:` do arquivo, seriam iguais.
    const statuses = new Set(RECUSAS.map((r) => r.status));
    expect(
      statuses.size,
      'todos os status saíram iguais — o extrator está casando errado',
    ).toBeGreaterThanOrEqual(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. TODA RECUSA DIZ QUAL PORTÃO FOI
// ═══════════════════════════════════════════════════════════════════════════════

describe('toda resposta não-2xx do painel carrega o código do portão', () => {
  it.each(RECUSAS.map((r) => [`${r.rota} · ${r.status}`, r] as const))('%s', (_nome, r) => {
    expect(
      CODIGO.test(r.corpo),
      `recusa sem código de portão: "${r.corpo}" — o painel transfere para a Recepção e ` +
        `ninguém consegue dizer qual dos portões recusou`,
    ).toBe(true);
  });

  it('🔴 os códigos são DISTINTOS entre si', () => {
    /**
     * Um código só, repetido, seria pior que nenhum: daria a impressão de diagnóstico sem
     * separar portão nenhum.
     */
    const codigos = RECUSAS.map((r) => r.corpo.match(CODIGO)?.[0].trim()).filter(Boolean);
    expect(new Set(codigos).size, 'os portões colapsaram num código só').toBeGreaterThanOrEqual(4);
  });

  it('🔴 o mesmo código nunca cobre status diferentes', () => {
    // `[E-SEGREDO]` em 401 e 503 faria o código mentir sobre o que aconteceu.
    const porCodigo = new Map<string, Set<number>>();
    for (const r of RECUSAS) {
      const c = r.corpo.match(CODIGO)?.[0].trim();
      if (!c) continue;
      porCodigo.set(c, (porCodigo.get(c) ?? new Set()).add(r.status));
    }
    for (const [c, statuses] of porCodigo) {
      expect([...statuses].length, `${c} aparece com status ${[...statuses].join(' e ')}`).toBe(1);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. O QUE O PACIENTE LÊ NÃO LEVA CÓDIGO
// ═══════════════════════════════════════════════════════════════════════════════

describe('sucesso não carrega código — o corpo de 2xx é o que o paciente lê', () => {
  const SUCESSOS = TODAS.filter((r) => r.status < 300);

  it.each(SUCESSOS.map((r) => [`${r.rota} · ${r.status}`, r] as const))('%s', (_nome, r) => {
    expect(
      CODIGO.test(r.corpo),
      `um 2xx ganhou código de portão: "${r.corpo}" — isso vai para a conversa do paciente`,
    ).toBe(false);
  });

  it('o controle existe mesmo quando não há 2xx literal', () => {
    // Vacuidade: sem este caso, zero sucessos literais deixaria a seção inteira vazia e
    // verde. Aqui `triagem` responde com corpo dinâmico, então zero é o esperado.
    expect(SUCESSOS.every((r) => !CODIGO.test(r.corpo))).toBe(true);
  });
});
