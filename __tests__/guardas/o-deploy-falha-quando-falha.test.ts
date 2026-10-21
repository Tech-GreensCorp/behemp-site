/**
 * Guarda: o deploy para quando algo falha, e a migration roda com o que existe no servidor.
 *
 * POR QUE ESTE ARQUIVO EXISTE — um deploy verde com banco desatualizado
 *
 * Em 10/09/2026 o deploy do PR #36 foi reportado como **sucesso**, com todos os 17 passos
 * verdes. Dentro do passo do PM2, o log dizia:
 *
 *     err: cp: cannot stat '.env': No such file or directory
 *     err: sh: 1: drizzle-kit: not found
 *          ELIFECYCLE Command failed
 *
 * O script seguiu, reiniciou o PM2, e o GitHub marcou ✓. **O código novo subiu esperando
 * tabelas que a migration não criou.**
 *
 * Duas causas, e as duas eram antigas:
 *
 * 1. **Sem `set -e`**, o script de deploy continua depois de qualquer erro. Falha vira
 *    silêncio, e silêncio vira "deploy bem-sucedido".
 * 2. **`drizzle-kit` é devDependency** e o servidor roda `pnpm install --prod`, que as
 *    pula — o próprio log diz `devDependencies: skipped`. O CLI nunca esteve lá.
 *
 * A correção do (2) é a que a documentação do Drizzle recomenda: usar o **migrator do
 * `drizzle-orm`**, que é dependência de produção e precisa apenas dos `.sql` gerados e de
 * uma conexão.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const RAIZ = join(import.meta.dirname, '..', '..');
const fonte = (a: string) => readFileSync(join(RAIZ, a), 'utf8');

/**
 * Código sem comentários.
 *
 * ⚠️ Este helper entrou porque o caso abaixo nasceu VERMELHO acusando um inocente: o
 * migrador CITA `drizzle-kit` no bloco que explica por que NÃO o usa, e a primeira versão
 * proibia a palavra no arquivo inteiro. Proibir o código não pode significar proibir a
 * explicação — é a sétima vez que uma checagem deste repositório confunde menção com uso.
 */
const codigo = (a: string) =>
  fonte(a)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const DEPLOY = '.github/workflows/deploy.yml';
const MIGRADOR = 'scripts/migrar.mjs';

/** Só o script que roda NO SERVIDOR, dentro do passo do PM2. */
function scriptRemoto(): string {
  const t = fonte(DEPLOY);
  const i = t.indexOf('script: |');
  expect(i, 'o passo do PM2 sumiu do deploy').toBeGreaterThan(-1);
  return t.slice(i);
}

describe('o script de deploy para no primeiro erro', () => {
  it('🔴 tem `set -e`', () => {
    /**
     * Sem ele, `cp` que falha, migration que falha e qualquer outro erro viram silêncio —
     * e o PM2 reinicia assim mesmo. Foi exatamente o que produziu um deploy verde com o
     * banco sem as tabelas do código que subiu.
     */
    expect(scriptRemoto(), 'o deploy voltou a seguir depois de falhar').toMatch(/^\s*set -e\s*$/m);
  });

  it('🔴 a migration usa o migrator, NÃO o CLI drizzle-kit', () => {
    /**
     * O servidor roda `pnpm install --prod` e o log confirma `devDependencies: skipped`.
     * `drizzle-kit` é devDependency: chamá-lo ali é chamar o que não existe.
     */
    const s = scriptRemoto();
    expect(s, 'a migration de produção sumiu').toMatch(/pnpm db:migrate:prod/);
    expect(
      /pnpm db:migrate\s*$/m.test(s),
      'voltou o `pnpm db:migrate`, que chama o CLI ausente em produção',
    ).toBe(false);
  });

  it('🔴 o migrador NÃO importa drizzle-kit', () => {
    // Se importasse, teria o mesmo problema com outro nome.
    const t = codigo(MIGRADOR);
    expect(/drizzle-kit/.test(t), 'o migrador passou a depender do CLI').toBe(false);
    expect(t).toMatch(/from 'drizzle-orm\/node-postgres\/migrator'/);
  });

  it('🔴 o migrador é `.mjs` — não pode depender de transpilação', () => {
    // `tsx` também é devDependency. Um migrador `.ts` teria o mesmo defeito que veio
    // consertar, com outro nome.
    expect(MIGRADOR.endsWith('.mjs')).toBe(true);
    const scripts = JSON.parse(fonte('package.json')).scripts;
    expect(scripts['db:migrate:prod']).toBe('node scripts/migrar.mjs');
    expect(
      /tsx|ts-node/.test(scripts['db:migrate:prod']),
      'a migração de produção passou a exigir transpilação',
    ).toBe(false);
  });

  it('CONTROLE: o migrador PODE citar drizzle-kit no comentário', () => {
    // O bloco no topo dele explica por que não usa o CLI. Sem este caso, alguém
    // "consertaria" o guarda apagando a explicação.
    expect(fonte(MIGRADOR)).toMatch(/drizzle-kit/);
  });

  it('🔴 o migrador sai com erro quando falha', () => {
    // Sair com 0 numa falha reintroduz o problema inteiro: o `set -e` não teria o que
    // pegar, e o app reiniciaria contra um banco sem as tabelas.
    const t = fonte(MIGRADOR);
    expect(t).toMatch(/process\.exit\(1\)/);
    // Duas saídas com erro: sem DATABASE_URL, e falha ao migrar.
    expect([...t.matchAll(/process\.exit\(1\)/g)].length).toBeGreaterThanOrEqual(2);
  });

  it('🔴 as variáveis vêm dos GitHub Secrets, não de um `.env` que não existe', () => {
    /**
     * A versão anterior copiava de `./.env` — arquivo que o rsync GARANTE não existir. E
     * quando a checagem passou a existir, ela revelou o que ninguém sabia: **não há `.env`
     * nem na raiz nem no standalone**. O app funcionava porque o PM2 guarda o ambiente no
     * `dump.pm2` desde o primeiro `pm2 start` — configuração viva só na memória de um
     * processo, que ninguém lê, versiona ou confere.
     */
    const s = scriptRemoto();
    expect(s, 'a geração do .env a partir dos secrets sumiu').toMatch(/gravar\(\) \{/);
    expect(s).toMatch(/secrets\.PARCEIRO_GREENS_SEGREDO_ENTRADA/);
    expect(s, 'voltou o cp de um .env que não existe').not.toMatch(/^\s*cp \.env /m);
  });

  it('🔴 o `.env` é CARREGADO no shell antes do migrate', () => {
    /**
     * ⚠️ Este caso existe porque o deploy do PR #38 falhou com "DATABASE_URL ausente".
     *
     * Escrever o `.env` não basta: o migrador lê `process.env`, e um arquivo não vira
     * ambiente sozinho. O `drizzle-kit` antigo não tinha o problema porque o
     * `drizzle.config.ts` usa dotenv — a diferença passou despercebida na troca.
     *
     * A ORDEM é o que este caso trava: carregar depois do migrate não serviria de nada.
     */
    const s = scriptRemoto();
    // As três peças, conferidas separadamente — um regex de várias linhas com indentação
    // quebra por espaço em branco, e o que importa é que as três existam e na ordem certa.
    expect(s, 'perdeu o `set -a`').toMatch(/^\s*set -a\s*$/m);
    expect(s, 'perdeu o source do .env').toMatch(/^\s*\. "\$ENVFILE"\s*$/m);
    expect(s, 'perdeu o `set \+a`').toMatch(/^\s*set \+a\s*$/m);
    /**
     * ⚠️ A comparação de ordem roda sobre o script SEM COMENTÁRIOS.
     *
     * A primeira versão usava `indexOf('pnpm db:migrate:prod')` no texto cru — e casava
     * com a MENÇÃO dentro do bloco que explica a decisão, que vem antes do comando. O
     * teste acusava "carregado depois do migrate" sobre um script correto.
     *
     * É a oitava vez que uma checagem deste repositório confunde menção com uso, e a
     * primeira em que isso aparece numa comparação de POSIÇÃO em vez de presença.
     */
    const semComentario = s
      .split('\n')
      .filter((l) => !l.trim().startsWith('#'))
      .join('\n');
    const carrega = semComentario.indexOf('. "$ENVFILE"');
    const migra = semComentario.indexOf('pnpm db:migrate:prod');
    expect(carrega, 'o carregamento do env sumiu').toBeGreaterThan(-1);
    expect(migra, 'o migrate sumiu').toBeGreaterThan(-1);
    expect(carrega, 'o env é carregado DEPOIS do migrate — inútil').toBeLessThan(migra);
  });

  it('🔴 os valores são gravados entre ASPAS', () => {
    /**
     * ⚠️ Este caso vem do deploy #39, que falhou com "DATABASE_URL ausente" mesmo com o
     * `.env` escrito e o `source` no lugar.
     *
     * A URL do Neon é `postgresql://…/db?sslmode=require&channel_binding=require`. Escrita
     * SEM aspas, o `source` INTERPRETA a linha: o `&` manda para background e corta o
     * resto. Medido — a variável vira **vazia**. E o source não falha, então o `set -e`
     * não pega: mais uma falha silenciosa neste mesmo arquivo.
     */
    const s = scriptRemoto();
    expect(s, 'os valores voltaram a ser gravados sem aspas').toMatch(/printf "%s='/);
    expect(
      /echo "\$1=\$2" >>/.test(s),
      'voltou o echo sem aspas — metacaractere de URL quebraria o source',
    ).toBe(false);
  });

  it('🔴 a migration recebe DATABASE_URL direto, sem depender do source', () => {
    // Defesa em profundidade: as aspas já resolvem, e esta linha continua funcionando
    // mesmo que alguém quebre aquelas.
    expect(scriptRemoto()).toMatch(
      /DATABASE_URL="\$\{\{ secrets\.DATABASE_URL \}\}" pnpm db:migrate:prod/,
    );
  });

  it('🔴 o .env gerado tem permissão restrita', () => {
    // Ele passa a conter segredos de integração. 644 os deixaria legíveis por qualquer
    // usuário do servidor.
    expect(scriptRemoto()).toMatch(/chmod 600 "\$ENVFILE"/);
  });

  it('🔴 secret vazio NÃO apaga o valor que já está lá', () => {
    /**
     * Um secret ainda não cadastrado chega como string vazia. Sem esta guarda, o primeiro
     * deploy depois de acrescentar uma variável ao workflow apagaria as demais — e o app
     * subiria com configuração pela metade.
     */
    expect(scriptRemoto()).toMatch(/\[ -z "\$2" \] && return 0/);
  });

  it('🔴 o rsync continua EXCLUINDO o .env', () => {
    // Se ele parasse de excluir, um deploy sobrescreveria os segredos do servidor com o
    // que estivesse no repositório — que é justamente o que nunca deve acontecer.
    expect(fonte(DEPLOY)).toMatch(/EXCLUDE:.*\/\.env/);
  });

  it('CONTROLE: o portão continua ANTES do rsync', () => {
    /**
     * Sem este caso, o guarda seria satisfeito por um deploy que roda migration cedo
     * demais. A ordem importa: type-check, guardas e baseline precisam falhar **antes** de
     * qualquer coisa chegar ao servidor.
     */
    const t = fonte(DEPLOY);
    const portao = t.indexOf('Type-check (portão absoluto');
    const rsync = t.indexOf('Sincronizar arquivos para AWS');
    expect(portao).toBeGreaterThan(-1);
    expect(portao, 'o portão foi parar depois do rsync').toBeLessThan(rsync);
  });
});
