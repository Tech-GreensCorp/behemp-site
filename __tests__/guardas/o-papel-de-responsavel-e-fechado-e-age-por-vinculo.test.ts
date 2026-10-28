/**
 * O PAPEL DE RESPONSÁVEL É FECHADO E AGE SÓ POR VÍNCULO — ADR-0033 D-02, D-03, D-09, D-10.
 *
 * Reúne as invariantes estruturais do papel novo. O COMPORTAMENTO (resolvedor, vínculo, 404 indistinto, índice
 * único) é provado contra Postgres real em `__tests__/integracao/o-responsavel-age-so-por-vinculo-provado`.
 *
 * 🔴 TRÊS CLASSES DE ERRO, e cada uma já aconteceu em família neste produto:
 *
 *   1. **O perfil escolhido virar poder.** `unsafeMetadata` é entrada do usuário (o Clerk o deixa reescrever).
 *      A tradução em papel é UMA função pura, fechada em dois valores, que ignora OAuth, e que só pode ser lida
 *      NA CRIAÇÃO da conta. Se um login relesse o perfil, um paciente viraria `responsavel` editando o metadado.
 *
 *   2. **O responsável ganhar ficha de paciente.** Ele NÃO é paciente (P-02). O webhook e o `/redirect`
 *      criavam ficha para todo usuário novo; só `paciente` pode ganhá-la.
 *
 *   3. **Vínculo criado por declaração.** O responsável cria o dependente do zero; NUNCA informa um paciente
 *      que já existe. Uma única porta insere vínculo, e a action não recebe `pacienteId`.
 *
 * ⚠️ O QUE ESTE GUARDA NÃO PROVA: que o `/responsavel` renderiza, nem que o Clerk grava o perfil no cadastro —
 * isso exige uma conta real no Clerk de desenvolvimento, e NÃO foi feito.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { semComentarios } from './_apoio/codigo';
import { perfilDaConta } from '../../lib/auth/perfil-da-conta';
import { dataDeNascimentoPlausivel } from '../../lib/dependentes/regras';

const RAIZ = join(__dirname, '..', '..');
const ler = (p: string) => readFileSync(join(RAIZ, p), 'utf8');
const codigo = (p: string) => semComentarios(ler(p));

function arquivos(dir: string, acc: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    if (nome === 'node_modules' || nome === '.next') continue;
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) arquivos(caminho, acc);
    else if (/\.(ts|tsx)$/.test(nome)) acc.push(caminho);
  }
  return acc;
}
const PRODUCAO = ['app', 'lib', 'components']
  .flatMap((d) => arquivos(join(RAIZ, d)))
  .map((p) => ({
    caminho: relative(RAIZ, p).replace(/\\/g, '/'),
    codigo: semComentarios(readFileSync(p, 'utf8')),
  }));

describe('1. o perfil escolhido só vira papel por uma função fechada', () => {
  it('só devolve `paciente` ou `responsavel`, qualquer que seja a entrada', () => {
    const entradas = [
      'admin',
      'medico',
      'ADMIN',
      'responsavel ',
      '',
      null,
      undefined,
      1,
      true,
      {},
      ['admin'],
    ];
    for (const perfil of entradas) {
      const r = perfilDaConta({ unsafeMetadata: { perfil }, temContaExterna: false });
      expect(['paciente', 'responsavel'], `entrada ${JSON.stringify(perfil)}`).toContain(r);
    }
    expect(
      perfilDaConta({ unsafeMetadata: { perfil: 'responsavel' }, temContaExterna: false }),
    ).toBe('responsavel');
  });

  it('🔴 conta criada por OAuth NUNCA ganha `responsavel`', () => {
    expect(
      perfilDaConta({ unsafeMetadata: { perfil: 'responsavel' }, temContaExterna: true }),
    ).toBe('paciente');
  });

  it('sem metadado, é paciente (o padrão não mudou)', () => {
    expect(perfilDaConta({ unsafeMetadata: undefined, temContaExterna: false })).toBe('paciente');
    expect(perfilDaConta({ unsafeMetadata: null, temContaExterna: false })).toBe('paciente');
    expect(perfilDaConta({ unsafeMetadata: {}, temContaExterna: false })).toBe('paciente');
  });

  it('🔴 `unsafeMetadata.perfil` só é lido em `perfil-da-conta.ts` (nunca num login)', () => {
    const leitores = PRODUCAO.filter((f) =>
      /unsafe_?[Mm]etadata\??\.perfil|unsafe_?[Mm]etadata\??\.\[?['"]perfil/.test(f.codigo),
    ).map((f) => f.caminho);
    // O ÚNICO leitor é a própria função fechada (e ele precisa existir: senão o guarda não olha nada).
    expect(leitores, 'o perfil é lido fora da função fechada').toEqual([
      'lib/auth/perfil-da-conta.ts',
    ]);

    // Os dois pontos de CRIAÇÃO de conta passam pela função; nenhum outro precisa dela.
    for (const p of ['app/api/webhooks/clerk/route.ts', 'app/(auth)/redirect/page.tsx']) {
      expect(codigo(p), `${p} não usa perfilDaConta`).toMatch(/perfilDaConta\(/);
    }
  });

  it('⚠️ VACUIDADE: o webhook e o /redirect ainda existem como o guarda os leu', () => {
    expect(codigo('app/api/webhooks/clerk/route.ts')).toMatch(/processarNovoUsuario/);
    expect(codigo('app/(auth)/redirect/page.tsx')).toMatch(/redirect\('\/medico'\)/);
  });
});

describe('2. o responsável não ganha ficha de paciente', () => {
  it('🔴 a ficha só nasce para `paciente`: o webhook e o /redirect condicionam o insert ao papel', () => {
    expect(codigo('app/api/webhooks/clerk/route.ts')).toMatch(
      /if \(roleEfetivo === 'paciente'\) \{[\s\S]*?insert\(pacientes\)/,
    );
    expect(codigo('app/(auth)/redirect/page.tsx')).toMatch(
      /if \(userRole === 'paciente'\) \{[\s\S]*?insert\(pacientes\)/,
    );
  });

  it('🔴 o /registrar-se só grava endereço de paciente quando o perfil é paciente', () => {
    // `atualizarPerfilCompletoPaciente` CRIA a ficha se ela não existir: chamá-la para o responsável a criaria.
    expect(codigo('app/(auth)/registrar-se/[[...sign-up]]/page.tsx')).toMatch(
      /if \(perfil === 'paciente'\) \{[\s\S]*?atualizarPerfilCompletoPaciente\(/,
    );
  });

  it('o login leva o responsável à área dele, nas duas portas', () => {
    expect(codigo('app/(auth)/redirect/page.tsx')).toMatch(
      /role === 'responsavel'\) redirect\('\/responsavel'\)/,
    );
    expect(codigo('app/api/auth/callback/route.ts')).toMatch(
      /role === 'responsavel'\) redirect\('\/responsavel'\)/,
    );
  });
});

describe('3. o vínculo nasce com o dependente, e só por uma porta', () => {
  it('🔴 só `criar-dependente.ts` insere em `responsaveis_pacientes`', () => {
    const onde = PRODUCAO.filter((f) => /insert\(\s*responsaveisPacientes\s*\)/.test(f.codigo)).map(
      (f) => f.caminho,
    );
    expect(onde).toEqual(['lib/dependentes/criar-dependente.ts']);
  });

  it('🔴 a função que cria o vínculo não recebe `pacienteId`', () => {
    const c = codigo('lib/dependentes/criar-dependente.ts');
    const iface = c.slice(
      c.indexOf('export interface EntradaDoDependente'),
      c.indexOf('export interface DependenteCriado'),
    );
    expect(iface.length).toBeGreaterThan(50);
    expect(iface, 'o responsável passaria a informar um paciente existente').not.toMatch(
      /pacienteId/,
    );
  });

  it('🔴 a action não aceita `pacienteId` no schema, e não o repassa', () => {
    const a = codigo('app/_actions/dependentes.ts');
    const schema = a.slice(
      a.indexOf('const dependenteSchema'),
      a.indexOf('export type ResultadoDoCadastroDeDependente'),
    );
    expect(schema.length).toBeGreaterThan(100);
    expect(schema).not.toMatch(/pacienteId|paciente_id/);
    expect(a, 'a action lê o paciente do corpo').not.toMatch(
      /entrada\.pacienteId|\.data\.pacienteId/,
    );
  });

  it('🔴 a action prova o papel ANTES de validar e de gravar', () => {
    const a = codigo('app/_actions/dependentes.ts');
    const papel = a.indexOf('await responsavelDaSessao()');
    expect(papel).toBeGreaterThan(-1);
    expect(papel).toBeLessThan(a.indexOf('dependenteSchema.safeParse'));
    expect(papel).toBeLessThan(a.indexOf('await criarDependente('));
  });

  it('a criação usa o cliente TRANSACIONAL, não `db` (neon-http não tem transaction)', () => {
    const c = codigo('lib/dependentes/criar-dependente.ts');
    expect(c).toMatch(/dbTransacional\(\)\.transaction\(/);
    expect(c).not.toMatch(/\bdb\.transaction\(/);
  });
});

describe('4. o resolvedor responde igual e olha o vínculo ativo', () => {
  const r = codigo('lib/auth/escopo-do-responsavel.ts');

  it('🔴 só `responsavel` e `paciente` podem responder, lidos do BANCO: admin e médico ficam de fora', () => {
    // Regra de 28/10/2026: quem faz o próprio tratamento também pode ser responsável. O vínculo, não o papel,
    // é o que prova o acesso a cada dependente.
    expect(r).toMatch(/PAPEIS_QUE_PODEM_RESPONDER: string\[\] = \['responsavel', 'paciente'\]/);
    expect(r).toMatch(/PAPEIS_QUE_PODEM_RESPONDER\.includes\(user\.role\)/);
  });

  it('🔴 o vínculo é do responsável certo e ATIVO', () => {
    expect(r).toMatch(/eq\(responsaveisPacientes\.responsavelUserId, responsavel\.id\)/);
    expect(r).toMatch(/eq\(responsaveisPacientes\.status, 'ativo'\)/);
  });

  it('🔴 404 indistinto: uma só mensagem de recusa, e nenhuma resposta 403', () => {
    // As três recusas de `garantirResponsavelDoPaciente` (id inválido, sem papel, sem vínculo) são a MESMA.
    expect([...r.matchAll(/return { ok: false, erro: ([A-Za-z_]+) }/g)].map((m) => m[1])).toEqual([
      'NAO_ENCONTRADO',
      'NAO_ENCONTRADO',
      'NAO_ENCONTRADO',
    ]);
    expect(r).not.toMatch(/403|Acesso negado|não é seu|encerrado/i);
  });

  it('só o resolvedor lê o vínculo: nenhum outro arquivo faz select em `responsaveis_pacientes`', () => {
    const permitidos = new Set([
      'lib/auth/escopo-do-responsavel.ts',
      'lib/dependentes/criar-dependente.ts',
      'db/schema/responsaveis.ts',
    ]);
    const onde = PRODUCAO.filter((f) => /\.from\(\s*responsaveisPacientes\s*\)/.test(f.codigo))
      .map((f) => f.caminho)
      .filter((c) => !permitidos.has(c));
    expect(onde, 'leitura do vínculo fora do resolvedor').toEqual([]);
  });
});

describe('5. o dependente pode ter qualquer idade (regra de 28/10/2026), mas a data tem de ser plausível', () => {
  it('aceita menor, maior e idoso', () => {
    const hoje = new Date('2026-10-28T12:00:00Z');
    for (const d of ['2021-03-10', '2008-10-28', '1990-01-01', '1948-01-30', '1900-01-01']) {
      expect(dataDeNascimentoPlausivel(d, hoje), d).toBe(true);
    }
  });

  it('recusa data futura, inexistente, absurda e mal formada', () => {
    const hoje = new Date('2026-10-28T12:00:00Z');
    for (const d of [
      '2026-10-29',
      '2999-01-01',
      '2020-02-30',
      '1899-12-31',
      '1850-01-01',
      '2020-13-01',
      '',
      'ontem',
      '10/03/2021',
    ]) {
      expect(dataDeNascimentoPlausivel(d, hoje), d).toBe(false);
    }
  });

  it('hoje conta (nasceu hoje)', () => {
    expect(dataDeNascimentoPlausivel('2026-10-28', new Date('2026-10-28T03:00:00Z'))).toBe(true);
  });

  it('🔴 a action não exige mais ser menor de idade', () => {
    const a = codigo('app/_actions/dependentes.ts');
    expect(a).not.toMatch(/ehMenorDeIdade|menor de 18|menor de idade/);
    expect(a).toMatch(/dataDeNascimentoPlausivel\(/);
  });
});
