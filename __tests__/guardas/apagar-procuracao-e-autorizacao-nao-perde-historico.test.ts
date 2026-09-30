import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ler = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

const ARQ = 'app/(admin)/_actions/documentos-regulatorios.ts';
const acoes = ler(ARQ);

function corpo(nome: string): string {
  const i = acoes.indexOf(`export async function ${nome}`);
  expect(i, `função ${nome} não encontrada`).toBeGreaterThan(-1);
  const resto = acoes.slice(i + 10);
  const fim = resto.search(/\n(export async function|async function) /);
  return fim === -1 ? resto : resto.slice(0, fim);
}

describe('apagar Procuração e Autorização ANVISA: soft delete, sem perder histórico', () => {
  const proc = corpo('apagarProcuracaoAdmin');
  const aut = corpo('apagarAutorizacaoAnvisaAdmin');

  it('vacuidade: o extrator enxerga as duas funções inteiras', () => {
    expect(proc.length).toBeGreaterThan(800);
    expect(aut.length).toBeGreaterThan(1000);
  });

  it('as duas são exclusivas do admin', () => {
    for (const fn of [proc, aut]) {
      expect(fn).toContain('verificarAdmin');
      expect(fn).not.toContain('verificarMedicoOuAdmin');
    }
  });

  it('nunca apagam a linha: só deletedAt', () => {
    expect(acoes).not.toMatch(/\.delete\(/);
    expect(proc).toMatch(/\.set\(\{ deletedAt: new Date\(\) \}\)/);
    expect(aut).toMatch(/\.set\(\{ deletedAt: new Date\(\) \}\)/);
  });

  it('não removem blob algum (AGENTS.md: histórico precisa existir)', () => {
    expect(acoes).not.toMatch(/\bdel\(|@vercel\/blob/);
  });

  it('o UPDATE só atinge linha ainda ativa (clique duplo não apaga duas vezes)', () => {
    for (const fn of [proc, aut]) {
      const update = fn.slice(fn.indexOf('.update('));
      expect(update.slice(0, update.indexOf('.returning'))).toContain('isNull(');
    }
  });

  it('autorização APROVADA é recusada no servidor, e o UPDATE repete a condição', () => {
    expect(aut).toMatch(/status === 'aprovado'/);
    const update = aut.slice(aut.indexOf('.update('));
    expect(update.slice(0, update.indexOf('.returning'))).toMatch(
      /ne\(autorizacoesAnvisa\.status, 'aprovado'\)/,
    );
  });

  it('apagar autorização NÃO apaga as procurações ligadas (só conta e avisa)', () => {
    expect(aut).not.toMatch(/\.update\(procuracoesEspecificas\)/);
    expect(aut).toContain('procuracoesLigadas');
  });

  it('as duas gravam auditoria', () => {
    expect(proc).toContain('auditar(');
    expect(aut).toContain('auditar(');
    expect(acoes).toMatch(/acao: 'deletar'/);
  });

  it('o motor de alertas continua intocado por este trabalho (hook o protege)', () => {
    // Se alguém passar a permitir apagar APROVADA, o coletor precisa filtrar deletedAt antes.
    const coletor = ler('lib/alertas/coletor.ts');
    const temFiltro = /deletedAt|deleted_at/.test(coletor);
    const recusaAprovada = /status === 'aprovado'/.test(aut);
    expect(temFiltro || recusaAprovada).toBe(true);
  });
});

describe('quem lê precisa esconder o apagado', () => {
  it('a lista de Procurações ignora apagadas', () => {
    expect(ler('app/(admin)/admin/procuracoes/page.tsx')).toMatch(
      /isNull\(procuracoesEspecificas\.deletedAt\)/,
    );
  });

  it('a listagem da ANVISA ignora autorização apagada E procuração apagada', () => {
    const rota = ler('app/api/admin/anvisa/listar/route.ts');
    expect(rota).toMatch(/isNull\(autorizacoesAnvisa\.deletedAt\)/);
    expect(rota).toMatch(/isNull\(procuracoesEspecificas\.deletedAt\)/);
  });

  it('atualizar status não "aprova" autorização apagada (aba antiga aberta)', () => {
    const rota = ler('app/api/anvisa/atualizar-status/route.ts');
    const update = rota.slice(rota.indexOf('.update(autorizacoesAnvisa)'));
    expect(update.slice(0, update.indexOf('.returning'))).toContain(
      'isNull(autorizacoesAnvisa.deletedAt)',
    );
    expect(rota).toMatch(/if \(!atualizado\)/);
  });

  it('os botões existem, pedem confirmação, e o de autorização é desabilitado para aprovada', () => {
    const botaoProc = ler('app/(admin)/admin/procuracoes/_components/botao-apagar-procuracao.tsx');
    expect(botaoProc).toContain('AlertDialog');
    expect(ler('app/(admin)/admin/procuracoes/page.tsx')).toContain('BotaoApagarProcuracao');

    const botaoAut = ler('app/(admin)/admin/anvisa/_components/botao-apagar-autorizacao.tsx');
    expect(botaoAut).toContain('AlertDialog');
    expect(botaoAut).toMatch(/disabled=\{aprovada\}/);
    expect(ler('app/(admin)/admin/anvisa/page.tsx')).toMatch(
      /aprovada=\{aut\.status === 'aprovado'\}/,
    );
  });

  it('os botões não importam o `db` (cliente não fala com o banco)', () => {
    for (const f of [
      'app/(admin)/admin/procuracoes/_components/botao-apagar-procuracao.tsx',
      'app/(admin)/admin/anvisa/_components/botao-apagar-autorizacao.tsx',
    ]) {
      expect(ler(f)).not.toMatch(/@\/lib\/db/);
    }
  });
});
