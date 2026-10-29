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
import {
  CAMPOS_INTERNOS_DA_ASSOCIACAO,
  cadastroDeDependenteSchema,
  fichaDoDependenteSchema,
} from '../../lib/dependentes/ficha-do-dependente';
import { criarPacienteSchema } from '../../lib/pacientes/ficha';

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

  it('🔴 o schema do cadastro não aceita `pacienteId`, e a action não o lê do corpo', () => {
    const campos = Object.keys(cadastroDeDependenteSchema.shape);
    expect(campos.length).toBeGreaterThan(20); // a ficha completa: o guarda não está olhando um schema vazio
    expect(campos).not.toContain('pacienteId');
    expect(campos).not.toContain('paciente_id');
    const a = codigo('app/_actions/dependentes.ts');
    expect(a, 'a action lê o paciente do corpo').not.toMatch(
      /entrada\.pacienteId|\.data\.pacienteId/,
    );
  });
  it('🔴 a action prova o papel ANTES de validar e de gravar', () => {
    const a = codigo('app/_actions/dependentes.ts');
    const papel = a.indexOf('await responsavelDaSessao()');
    expect(papel).toBeGreaterThan(-1);
    expect(papel).toBeLessThan(a.indexOf('cadastroDeDependenteSchema.safeParse'));
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
      // A LISTAGEM do admin ("Pacientes e responsáveis"): o admin vê todos os vínculos, então não há regra de acesso
      // para duplicar; o teste de integração dela prova que só o admin lê (`o-admin-lista-responsaveis-…`).
      'app/_actions/admin-responsaveis.ts',
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

  it('🔴 o cadastro não exige mais ser menor de idade, e a data continua obrigatória e plausível', () => {
    const s = codigo('lib/dependentes/ficha-do-dependente.ts');
    expect(s).not.toMatch(/ehMenorDeIdade|menor de 18|menor de idade/);
    expect(s).toMatch(/dataDeNascimentoPlausivel\(/);
    expect(codigo('app/_actions/dependentes.ts')).toMatch(/cadastroDeDependenteSchema\.safeParse/);
  });
});

/**
 * Os campos INTERNOS da associação, ESCRITOS AQUI de propósito. Quem decide que um campo é da equipe e não do
 * responsável é o NEGÓCIO (Dryelle, 29/10/2026), e a lista do código não pode ser a régua do próprio teste: se um
 * campo sair dela, um teste que a percorre deixa de conferi-lo (foi o que a sabotagem A2 mostrou). Mudar esta
 * lista é mudar a política: precisa de decisão do dono.
 */
const INTERNOS_DA_EQUIPE = [
  'atendimento',
  'categorizacao',
  'dataAssociacao',
  'entradaPaciente',
  'etapa',
  'termoAssociado',
  'valorContribuicao',
] as const;

describe('6. a ficha do dependente é a do cadastro da equipe, menos o que não é do responsável', () => {
  const dependente = Object.keys(fichaDoDependenteSchema.shape);
  const equipe = Object.keys(criarPacienteSchema.shape);

  it('⚠️ VACUIDADE: os dois schemas têm campo de verdade', () => {
    expect(equipe.length).toBeGreaterThan(30);
    expect(dependente.length).toBeGreaterThan(20);
  });

  it('🔴 os campos INTERNOS da associação NÃO estão no schema do responsável', () => {
    for (const campo of INTERNOS_DA_EQUIPE) {
      expect(dependente, `${campo} é da equipe`).not.toContain(campo);
      expect(equipe, `${campo} sumiu do cadastro da equipe: a lista está velha`).toContain(campo);
    }
    // A lista do código É a política escrita acima: se divergirem, alguém mudou a regra sem o dono.
    expect([...CAMPOS_INTERNOS_DA_ASSOCIACAO].sort()).toEqual([...INTERNOS_DA_EQUIPE].sort());
  });

  it('🔴 contato e responsável NÃO se digitam: vêm do vínculo', () => {
    for (const campo of ['email', 'telefone', 'responsavelNome', 'responsavelCpf']) {
      expect(dependente, campo).not.toContain(campo);
    }
  });

  it('🔴 todo o resto do cadastro da equipe é do dependente: nenhum campo some por esquecimento', () => {
    const fora = new Set<string>([
      ...INTERNOS_DA_EQUIPE,
      'email',
      'telefone',
      'responsavelNome',
      'responsavelCpf',
    ]);
    const esperados = equipe.filter((c) => !fora.has(c));
    for (const campo of esperados)
      expect(dependente, `${campo} faltou na ficha do dependente`).toContain(campo);
  });

  it('🔴 o cadastro da equipe e o do dependente usam o MESMO mapeamento de colunas', () => {
    expect(codigo('app/_actions/pacientes.ts')).toMatch(/\.\.\.camposDaFicha\(d\)/);
    expect(codigo('lib/dependentes/criar-dependente.ts')).toMatch(/\.\.\.camposDaFicha\(/);
    // E o `criarPaciente` não voltou a ter o schema ou o mapeamento copiados.
    expect(codigo('app/_actions/pacientes.ts')).not.toMatch(/const criarPacienteSchema\s*=/);
  });

  it('o cadastro de dependente que o servidor recebe é validado pelo schema da ficha', () => {
    const ok = cadastroDeDependenteSchema.safeParse({
      nome: 'Fulano',
      dataNascimento: '2015-05-05',
      parentesco: 'Pai',
      cpfDoResponsavel: '529.982.247-25',
      valorContribuicao: 'R$ 1',
    });
    expect(ok.success).toBe(true);
    // O Zod DESCARTA o campo interno: ele não chega à gravação.
    if (ok.success) expect(ok.data).not.toHaveProperty('valorContribuicao');
  });
});
