import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ler = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

const acoes = ler('app/(admin)/_actions/usuarios.ts');
const pagina = ler('app/(admin)/admin/usuarios/page.tsx');
const dialogo = ler('app/(admin)/admin/usuarios/_components/dialogo-criar-admin.tsx');

/** Corpo de uma função exportada, até a próxima declaração de topo. */
function corpo(nome: string): string {
  const i = acoes.indexOf(`export async function ${nome}`);
  expect(i, `função ${nome} não encontrada`).toBeGreaterThan(-1);
  const resto = acoes.slice(i + 10);
  const fim = resto.search(/\n(export async function|async function|function|const \w+Schema) /);
  return fim === -1 ? resto : resto.slice(0, fim);
}

/** Bloco `const criarAdminSchema = z.object({ ... });` */
function schema(): string {
  const i = acoes.indexOf('const criarAdminSchema');
  expect(i, 'criarAdminSchema não encontrado').toBeGreaterThan(-1);
  const fim = acoes.indexOf('\n});', i);
  return acoes.slice(i, fim + 4);
}

describe('criar admin pela interface: quem cria admin cria acesso total', () => {
  const fn = corpo('criarAdminUsuario');

  it('vacuidade: o extrator enxerga a função inteira', () => {
    expect(fn.length).toBeGreaterThan(1500);
    expect(fn).toContain('auditarUsuario');
  });

  it('é exclusiva do admin, no servidor', () => {
    expect(fn).toContain('verificarAdmin()');
    expect(fn).not.toContain('verificarMedicoOuAdmin');
  });

  it('o papel NÃO vem do cliente: é fixo em admin no Clerk e no banco', () => {
    expect(schema()).not.toMatch(/role|papel/i);
    expect(fn).toMatch(/publicMetadata: \{ role: 'admin' \}/);
    expect(fn).toMatch(/role: 'admin'/);
    expect(fn).not.toMatch(/parsed\.data\.role/);
  });

  it('valida a entrada com Zod: e-mail normalizado, nome e senha com a política do sistema', () => {
    const s = schema();
    expect(s).toMatch(/email: z\.string\(\)\.trim\(\)\.toLowerCase\(\)\.email\(/);
    expect(s).toMatch(/nome: z\.string\(\)\.trim\(\)\.min\(2/);
    expect(s).toMatch(/\.min\(8,/);
    expect(s).toMatch(/\[A-Z\]/);
    expect(s).toMatch(/\[0-9\]/);
  });

  it('NÃO pula a checagem de senha vazada do Clerk (admin é acesso total)', () => {
    expect(fn).not.toMatch(/skipPasswordChecks:\s*true/);
    expect(fn).not.toMatch(/skipPasswordRequirement/);
  });

  it('recusa e-mail que já tem usuário ativo e aponta para a promoção, sem criar nada', () => {
    const iBusca = fn.indexOf('isNull(users.deletedAt)');
    const iClerk = fn.indexOf('createUser(');
    expect(iBusca).toBeGreaterThan(-1);
    expect(iBusca).toBeLessThan(iClerk);
    expect(fn).toMatch(/Papel/);
  });

  it('o Clerk é criado ANTES do banco, e a falha dele aborta sem tocar no banco', () => {
    const iClerk = fn.indexOf('createUser(');
    const iBanco = fn.indexOf('.insert(users)');
    expect(iClerk).toBeGreaterThan(-1);
    expect(iBanco).toBeGreaterThan(iClerk);
  });

  it('a corrida com o webhook do Clerk não derruba a criação (insert tolera o conflito de e-mail)', () => {
    expect(fn).toMatch(/\.onConflictDoNothing\(\{ target: users\.email \}\)/);
    // ...e quem perdeu a corrida é promovido, não ignorado: a linha do webhook pode ter outro papel.
    expect(fn).toMatch(/\.update\(users\)\s*\.set\(\{[^}]*role: 'admin'/);
  });

  it('se o banco falhar depois do Clerk, o login recém-criado é desfeito (sem admin órfão)', () => {
    expect(fn).toContain('deleteUser(');
    expect(fn.indexOf('deleteUser(')).toBeGreaterThan(fn.indexOf('.insert(users)'));
  });

  it('audita a criação com o e-mail MASCARADO, nunca o original, e nunca a senha', () => {
    expect(fn).toMatch(/auditarUsuario\(\s*auth\.clerkId,\s*'criar'/);
    expect(fn).toContain('mascararEmail(');
    const chamada = fn.slice(fn.indexOf("'criar'"));
    expect(chamada).not.toMatch(/senha/i);
    expect(chamada).not.toMatch(/email: email\b/);
  });

  it('a senha não vai para log', () => {
    const logs = fn.match(/console\.(error|warn|log)\([^)]*\)/g) ?? [];
    for (const l of logs) expect(l).not.toMatch(/senha|password/i);
  });

  it('a auditoria aceita a ação "criar"', () => {
    expect(acoes).toMatch(/acao: 'criar' \| 'atualizar' \| 'deletar'/);
  });
});

describe('criar admin pela interface: a tela', () => {
  it('a página importa E renderiza o diálogo (não vira componente órfão)', () => {
    expect(pagina).toMatch(/import \{ DialogoCriarAdmin \} from/);
    expect(pagina).toMatch(/<DialogoCriarAdmin\b/);
  });

  it('há um botão "Novo admin" no cabeçalho', () => {
    expect(pagina).toMatch(/actions=\{/);
    expect(pagina).toContain('Novo admin');
  });

  it('o diálogo chama a action e recarrega a lista ao criar', () => {
    expect(dialogo).toContain('criarAdminUsuario(');
    expect(dialogo).toMatch(/onCriado\(\)/);
  });

  it('o diálogo não decide papel: nenhum campo de papel é enviado', () => {
    const chamada = dialogo.slice(dialogo.indexOf('criarAdminUsuario('));
    expect(chamada.slice(0, 200)).not.toMatch(/role|papel/i);
  });

  it('a senha é campo de senha (mascarado por padrão)', () => {
    expect(dialogo).toMatch(/type=\{mostrarSenha \? 'text' : 'password'\}/);
    expect(dialogo).toMatch(/useState\(false\)/);
  });
});
