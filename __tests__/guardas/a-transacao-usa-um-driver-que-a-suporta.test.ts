/**
 * Transação só pelo cliente que sabe fazer transação.
 *
 * 🔴 O DEFEITO QUE ISTO IMPEDE DE VOLTAR, e ele custou semanas.
 *
 * `lib/db/index.ts` resolve para `drizzle-orm/neon-http` em produção. Esse driver **não
 * implementa transação** — o método inteiro é um `throw`:
 *
 *     // drizzle-orm/neon-http/session.js:152
 *     async transaction(_transaction, _config = {}) {
 *       throw new Error('No transactions support in neon-http driver');
 *     }
 *
 * ⚠️ E NENHUM TESTE PEGAVA, por uma razão que este guarda existe para compensar: em
 * desenvolvimento e em teste a URL não é de Neon, então `db` resolve para `node-postgres`, que
 * suporta transação. **O código passava local e lançava em produção** — a diferença estava na
 * URL, não no código.
 *
 * O estrago medido: zero dos 35 handoffs da Greens jamais concluiu cadastro. Cinco falhas
 * idênticas em produção, todas registradas como `{ erro: 'Error' }` — porque é um `new Error(…)`
 * e o `catch` logava `erro.name`.
 *
 * 🔴 POR QUE ESTE GUARDA É ESTRUTURAL E NÃO DE EXECUÇÃO: executar a transação exigiria um
 * Postgres, e executá-la CONTRA O NEON exigiria produção. O que dá para garantir aqui é que
 * ninguém volte a pedir transação ao cliente errado — e isso se lê no código.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const raiz = process.cwd();
const ler = (p: string) => readFileSync(path.join(raiz, p), 'utf8');

/** Varre `.ts`/`.tsx` sob os diretórios dados, em caminho relativo à raiz. */
function varrer(dirs: string[]): string[] {
  const saida: string[] = [];
  const andar = (rel: string) => {
    let entradas: string[];
    try {
      entradas = readdirSync(path.join(raiz, rel));
    } catch {
      return;
    }
    for (const nome of entradas) {
      const filho = path.join(rel, nome);
      if (statSync(path.join(raiz, filho)).isDirectory()) andar(filho);
      else if (/\.tsx?$/.test(nome)) saida.push(filho);
    }
  };
  dirs.forEach(andar);
  return saida;
}

/** Sem comentários: um arquivo que EXPLICA o defeito não pode ser acusado de cometê-lo. */
function semComentarios(fonte: string): string {
  return fonte
    .split('\n')
    .filter((linha) => !/^\s*(\/\/|\/\*|\*)/.test(linha))
    .join('\n');
}

const ARQUIVOS = varrer(['app', 'lib', 'db']).filter((f) => !f.includes('transacional'));

// ─────────────────────────────────────────────────────────────────────────────
describe('o guarda tem o que medir', () => {
  it('varre arquivos de verdade', () => {
    expect(ARQUIVOS.length).toBeGreaterThan(50);
  });

  it('e o cliente transacional existe', () => {
    expect(() => ler('lib/db/transacional.ts')).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('🔴 ninguém pede transação ao cliente que não a suporta', () => {
  it('nenhum arquivo chama `db.transaction(`', () => {
    /**
     * Derivado do código, não de lista: qualquer ponto NOVO que tente usar `db.transaction`
     * aparece aqui pelo nome, mesmo que ninguém lembre deste guarda.
     */
    const culpados = ARQUIVOS.filter((f) => /\bdb\.transaction\s*\(/.test(semComentarios(ler(f))));
    expect(culpados, 'db resolve para neon-http em produção, que LANÇA em transaction()').toEqual(
      [],
    );
  });

  it('quem usa transação importa o cliente transacional', () => {
    const usam = ARQUIVOS.filter((f) => /\.transaction\s*\(/.test(semComentarios(ler(f))));
    for (const f of usam) {
      expect(semComentarios(ler(f)), `${f} usa transação sem o cliente certo`).toContain(
        'dbTransacional',
      );
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('🔴 e o cliente transacional não volta a ser HTTP', () => {
  const modulo = semComentarios(ler('lib/db/transacional.ts'));

  it('usa node-postgres, que implementa transação', () => {
    expect(modulo).toContain("from 'drizzle-orm/node-postgres'");
  });

  it('e NUNCA o neon-http, que a lança fora', () => {
    expect(modulo, 'neon-http não implementa transaction() — o método é um throw').not.toContain(
      'neon-http',
    );
  });

  it('o pool é único por processo — recarga não esgota as conexões do Neon', () => {
    expect(modulo).toMatch(/Symbol\.for\(/);
    expect(modulo).toMatch(/globalThis/);
  });

  it('e tem timeout de conexão — transação travada não segura a tela do paciente', () => {
    expect(modulo).toMatch(/connectionTimeoutMillis/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('a dependência sobrevive ao deploy', () => {
  /**
   * ⚠️ O deploy roda `pnpm install --prod`, que PODA `devDependencies`. Um driver que só exista
   * ali funciona em teste e some em produção — que é a mesma classe de falha silenciosa que este
   * guarda inteiro existe para impedir.
   */
  const pkg = JSON.parse(ler('package.json')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  it('`pg` está em dependencies, não em devDependencies', () => {
    expect(pkg.dependencies?.pg, 'pg precisa sobreviver ao `pnpm install --prod`').toBeTruthy();
    expect(pkg.devDependencies?.pg).toBeUndefined();
  });

  it('e o cliente transacional não usa pacote que não está instalado', () => {
    /**
     * `neon-serverless` seria a outra saída válida, mas exige `ws` no Node — e `ws` não é
     * dependência deste projeto. Importá-lo passaria no type-check e quebraria em runtime.
     */
    const usaNeonServerless = modulo().includes('neon-serverless');
    const temWs = Boolean(pkg.dependencies?.ws ?? pkg.devDependencies?.ws);
    expect(usaNeonServerless && !temWs, 'neon-serverless exige `ws`, que não está instalado').toBe(
      false,
    );
  });

  function modulo() {
    return semComentarios(ler('lib/db/transacional.ts'));
  }
});
