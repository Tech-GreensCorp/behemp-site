/**
 * Guarda dos hooks de bloqueio — .claude/hooks/git-perigoso.py e escopo-autorizado.py
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * Em 19/08/2026, na primeira hora de vida, `git-perigoso.py` acusou dois inocentes:
 *   1. um `cat >> CLAUDE.md <<EOF` cujo TEXTO mencionava o comando de formatação global;
 *   2. o próprio script que consertava o defeito (1), pelo mesmo motivo.
 * Causa: o padrão era procurado em qualquer posição da string, não em posição de comando,
 * e o corpo do heredoc era lido como se fosse execução. Granularidade errada — Regra 2 de
 * docs/TECNICA-DOS-GUARDAS.md.
 *
 * Os casos estão abaixo como CONTROLE (devem PASSAR). Sem eles, a correção não tem prova,
 * e a terceira falsa acusação chega sem aviso.
 *
 * O QUE ESTE GUARDA TESTA, E O QUE NÃO TESTA
 * Testa os hooks REAIS, executados como o Claude Code os executa: python3, JSON no stdin,
 * decisão lida do stdout. Não reimplementa a lógica em TypeScript — guarda que reimplementa
 * o alvo passa quando o alvo quebra.
 *
 * Migrado de bash para Vitest na Sprint 0 (20/08/2026), preservando os 34 casos.
 * Origem: __tests__/guardas/hooks-de-escopo.test.sh
 *
 * 🔴 O QUE A PROVA DE SABOTAGEM ENCONTROU, NA MIGRAÇÃO (20/08/2026)
 * Sabotei as 5 proteções dos dois hooks. Quatro mutantes morreram. Um SOBREVIVEU:
 * neutralizar `sem_heredoc` — a função que remove o corpo de heredoc antes da checagem —
 * e os 34 casos continuaram verdes.
 *
 * Causa: as duas proteções do hook são independentes, mas os 3 casos de regressão só
 * exercitavam UMA delas. Em todos os três, o comando perigoso aparecia no MEIO da linha
 * (`- nao usar git reset --hard`, `t.replace("pnpm format", ...)`), então quem os salvava
 * era a BORDA de posição de comando. O corpo de heredoc cuja linha COMEÇA com o comando
 * nunca foi testado — e é justamente o caso que só `sem_heredoc` protege.
 *
 * Medido: com o hook íntegro esse caso PASSA; com `sem_heredoc` neutralizado, BLOQUEIA.
 * Virou a REGRESSAO 4 abaixo, e com ela o quinto mutante morre. São 35 casos.
 * Regra 2 e §4 de docs/TECNICA-DOS-GUARDAS.md — mutante sobrevivente é defeito do guarda.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const RAIZ = join(import.meta.dirname, '..', '..');
const GIT = '.claude/hooks/git-perigoso.py';
const ESC = '.claude/hooks/escopo-autorizado.py';

type Decisao = 'BLOQUEIA' | 'PASSA';

/** Executa o hook como o Claude Code executa, e diz se ele BLOQUEOU. */
function roda(script: string, payload: unknown, cwd: string = RAIZ): Decisao {
  let saida = '';
  try {
    saida = execFileSync('python3', [join(RAIZ, script)], {
      input: JSON.stringify(payload),
      cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
  } catch {
    // Hook que estoura é hook sem opinião — o bash original tratava igual.
    return 'PASSA';
  }
  return /"permissionDecision":\s*"deny"/.test(saida) ? 'BLOQUEIA' : 'PASSA';
}

const bash = (command: string) => ({ tool_name: 'Bash', tool_input: { command } });
const escreve = (file_path: string, tool_name = 'Write') => ({
  tool_name,
  tool_input: { file_path },
});

// ─────────────────────────────────────────────────────────────────────────────
// Sem esta seção, um hook apagado faria todos os "PASSA" abaixo passarem sobre
// nada. É o teste de vacuidade da Regra 3 de docs/TECNICA-DOS-GUARDAS.md.
// ─────────────────────────────────────────────────────────────────────────────
describe('teste de vacuidade: os hooks existem e respondem', () => {
  it.each([GIT, ESC])('%s existe e compila', (hook) => {
    const caminho = join(RAIZ, hook);
    expect(existsSync(caminho), `${hook} não existe`).toBe(true);
    expect(() =>
      execFileSync(
        'python3',
        ['-c', 'import ast,sys; ast.parse(open(sys.argv[1]).read())', caminho],
        {
          stdio: 'ignore',
        },
      ),
    ).not.toThrow();
  });

  it('git-perigoso enxerga >=8 padrões em posição de comando', () => {
    const fonte = readFileSync(join(RAIZ, GIT), 'utf8');
    const padroes = fonte.match(/BORDA \+/g) ?? [];
    expect(padroes.length, 'regex ou lista de padrões quebrada').toBeGreaterThanOrEqual(8);
  });

  // INCIDENTE 3 (19/08/2026): o command do settings.json usava caminho RELATIVO
  // (`python3 .claude/hooks/x.py`). Quando o shell não estava na raiz do repo, python3
  // saía com código 2 — que é BLOQUEIO — e o hook passou a bloquear tudo, inclusive a
  // própria correção.
  it('settings.json resolve o hook pela raiz do repo, não por caminho relativo', () => {
    const settings = readFileSync(join(RAIZ, '.claude/settings.json'), 'utf8');
    expect(settings, 'caminho relativo no command bloqueia tudo fora da raiz').toContain(
      'rev-parse --show-toplevel',
    );
  });

  it('hook executa a partir de um subdiretório (INCIDENTE 3)', () => {
    expect(() =>
      execFileSync('python3', [join(RAIZ, GIT)], {
        input: JSON.stringify(bash('git status')),
        cwd: join(RAIZ, 'docs'),
        stdio: ['pipe', 'ignore', 'ignore'],
      }),
    ).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PARIDADE COM O GUARDA EM BASH
// O dono decidiu em 20/08/2026 manter os dois guardas: o `.sh` roda sem node_modules,
// o que serve para conferir os hooks antes de `pnpm install` — o estado real do
// repositório nas duas primeiras sessões. O preço de manter dois é a divergência
// silenciosa: um ganha um caso, o outro não, e o que ficou atrás mente por omissão.
// Este caso cobra a paridade pelo NOME de cada caso, então acrescentar caso no `.sh`
// sem acrescentar aqui fica vermelho — com o nome do caso que falta.
// ─────────────────────────────────────────────────────────────────────────────
describe('paridade entre os dois guardas', () => {
  const SH = '__tests__/guardas/hooks-de-escopo.test.sh';

  it('todo caso do guarda em bash existe também aqui', () => {
    const bashFonte = readFileSync(join(RAIZ, SH), 'utf8');
    const nomes = [...bashFonte.matchAll(/^verifica\s+(?:BLOQUEIA|PASSA)\s+"([^"]+)"/gm)].map(
      (m) => m[1],
    );

    // Vacuidade: se o regex parar de casar, a paridade passaria sobre zero.
    expect(nomes.length, 'nenhum caso extraído do .sh — o regex quebrou').toBeGreaterThanOrEqual(
      20,
    );

    const esteArquivo = readFileSync(
      join(RAIZ, '__tests__/guardas/hooks-de-escopo.test.ts'),
      'utf8',
    );
    const ausentes = nomes.filter((n) => !esteArquivo.includes(n));
    expect(ausentes, `casos que existem no .sh e faltam aqui: ${ausentes.join(' · ')}`).toEqual([]);
  });
});

describe('git-perigoso: deve BLOQUEAR', () => {
  it.each([
    ['git reset --hard', 'git reset --hard HEAD~1'],
    ['git push --force', 'git push --force origin feat/x'],
    ['git push origin main', 'git push origin main'],
    ['git branch -D', 'git branch -D feat/x'],
    ['git clean -fd', 'git clean -fd'],
    ['rm -rf', 'rm -rf node_modules'],
    ['formatacao global', 'pnpm format'],
    ['depois de && (posicao de comando)', 'pnpm lint && git reset --hard'],
  ])('%s', (_nome, comando) => {
    expect(roda(GIT, bash(comando))).toBe('BLOQUEIA');
  });
});

describe('git-perigoso: deve PASSAR (controle)', () => {
  it.each([
    ['git status', 'git status --short --branch'],
    ['format:check (nao e o global)', 'pnpm format:check CLAUDE.md'],
    ['git restore --staged', 'git restore --staged CLAUDE.md'],
    ['git push em branch de feature', 'git push origin feat/flow-representatives'],
    // Prova que autorização POR ESCRITO em .claude/autorizacoes.txt libera o bloqueio.
    // Remover aquela linha do arquivo faz este caso ficar vermelho — de propósito.
    ['comando autorizado por escrito (mecanismo)', 'git rm -r docs/kit-claude-code'],
  ])('%s', (_nome, comando) => {
    expect(roda(GIT, bash(comando))).toBe('PASSA');
  });

  it('ferramenta que nao e Bash', () => {
    expect(roda(GIT, { tool_name: 'Write', tool_input: { command: 'git reset --hard' } })).toBe(
      'PASSA',
    );
  });
});

// As três regressões de FALSA ACUSAÇÃO. Cada uma é um incidente real de 19/08/2026.
// Guarda sem estes casos deixa a próxima falsa acusação chegar sem aviso.
describe('git-perigoso: os INCIDENTES de falsa acusação (19/08/2026)', () => {
  it('REGRESSAO 1: heredoc que MENCIONA o comando', () => {
    const comando =
      'cat >> CLAUDE.md <<EOF\n- nao rodar pnpm format global\n- nao usar git reset --hard\nEOF';
    expect(roda(GIT, bash(comando))).toBe('PASSA');
  });

  it('REGRESSAO 2: script que conserta o proprio hook', () => {
    const comando =
      'python3 - <<PYEOF\nt = t.replace("pnpm format", "x")\nt = t.replace("git reset --hard", "y")\nPYEOF';
    expect(roda(GIT, bash(comando))).toBe('PASSA');
  });

  it('REGRESSAO 3: comentario mencionando o comando', () => {
    expect(roda(GIT, bash('echo ok # lembrar: nunca git reset --hard aqui'))).toBe('PASSA');
  });

  // REGRESSAO 4 — nasceu da sabotagem desta migração, não de um incidente em produção.
  // É o ÚNICO caso que discrimina a proteção `sem_heredoc`: aqui o comando perigoso está
  // no INÍCIO de uma linha do corpo do heredoc, onde a BORDA de posição de comando casa.
  // Sem `sem_heredoc`, este documento voltaria a ser lido como execução — a falsa acusação
  // de 19/08/2026, de novo. Ver o parágrafo no topo do arquivo.
  it('REGRESSAO 4: heredoc cuja LINHA COMECA com o comando', () => {
    const comando =
      'cat >> docs/x.md <<EOF\ngit reset --hard descarta trabalho\npnpm format reescreve 360 arquivos\nEOF';
    expect(roda(GIT, bash(comando))).toBe('PASSA');
  });
});

describe('escopo-autorizado: deve BLOQUEAR escrita', () => {
  it.each([
    ['area clinica (medico)', 'app/(medico)/medico/x.tsx', 'Write'],
    ['area clinica (paciente)', 'app/(paciente)/paciente/x.tsx', 'Edit'],
    ['migration gerada', 'db/migrations/0018_x.sql', 'Edit'],
    ['schema de medicos (clinico)', 'db/schema/medicos.ts', 'Write'],
    ['lib de receituario', 'lib/receituario/tipos.ts', 'Edit'],
    // ⚠️ Em 20/08/2026 `deploy.yml` e `ci.yml` foram AUTORIZADOS por escrito para receber
    // o portão de qualidade. Este caso passou a usar um workflow NÃO autorizado, para
    // continuar provando a proteção genérica de `.github/workflows/`. Quando o guarda
    // acusou essa mudança, ele estava certo — é para isso que ele existe.
    ['workflow NAO autorizado', '.github/workflows/novo-pipeline.yml', 'Edit'],
    ['contrato do projeto', 'AGENTS.md', 'Edit'],
  ])('%s', (_nome, caminho, ferramenta) => {
    expect(roda(ESC, escreve(caminho, ferramenta))).toBe('BLOQUEIA');
  });
});

describe('escopo-autorizado: deve PASSAR (controle)', () => {
  it.each([
    ['componente compartilhado novo', 'components/shared/novo-componente.tsx', 'Write'],
    ['schema novo (nao clinico)', 'db/schema/nova-entidade.ts', 'Write'],
    ['docs do projeto', 'docs/03-CHECKLIST-MESTRE.md', 'Write'],
    ['guarda novo', '__tests__/guardas/roleDerivaDoEnum.test.ts', 'Write'],
    // Leitura NUNCA é bloqueada. É a fronteira que separa este hook de um que
    // impediria diagnóstico — e diagnóstico é sempre permitido.
    ['LEITURA de area protegida nunca bloqueia', 'app/(medico)/medico/x.tsx', 'Read'],
    // O análogo, para caminho, do caso `comando autorizado por escrito`: prova que uma
    // linha `path:` em .claude/autorizacoes.txt libera o bloqueio. Remover aquela linha
    // faz este caso ficar vermelho — de propósito.
    ['workflow autorizado por escrito (mecanismo path:)', '.github/workflows/deploy.yml', 'Edit'],
  ])('%s', (_nome, caminho, ferramenta) => {
    expect(roda(ESC, escreve(caminho, ferramenta))).toBe('PASSA');
  });
});
