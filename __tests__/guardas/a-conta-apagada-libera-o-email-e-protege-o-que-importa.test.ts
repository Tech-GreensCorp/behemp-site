import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ler = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

const ARQ = 'app/(admin)/_actions/usuarios.ts';
const acoes = ler(ARQ);

/** Corpo de uma função exportada, até a próxima declaração de topo. */
function corpo(nome: string): string {
  const i = acoes.indexOf(`export async function ${nome}`);
  expect(i, `função ${nome} não encontrada`).toBeGreaterThan(-1);
  const resto = acoes.slice(i + 10);
  const fim = resto.search(/\n(export async function|async function|function|const \w+Schema) /);
  return fim === -1 ? resto : resto.slice(0, fim);
}

describe('apagar conta (admin): definitivo no Clerk, sem orfanar o histórico', () => {
  const fn = corpo('excluirUsuarioAdmin');

  it('vacuidade: o extrator enxerga a função inteira', () => {
    expect(fn.length).toBeGreaterThan(1500);
    expect(fn).toContain('auditarUsuario');
  });

  it('é exclusiva do admin', () => {
    expect(fn).toContain('verificarAdmin');
    expect(fn).not.toContain('verificarMedicoOuAdmin');
  });

  it('recusa a si mesmo e o único admin — no servidor, não só na tela', () => {
    expect(fn).toMatch(/clerkId === auth\.clerkId/);
    expect(fn).toContain('existeOutroAdmin(');
  });

  // Decisão do dono, 30/09/2026 ("qualquer usuário"): médico PODE ser apagado. O guarda
  // deixou de exigir a recusa e passou a exigir o que torna isso seguro.
  it('médico NÃO é mais recusado, e a recusa não volta por engano', () => {
    expect(fn).not.toMatch(/return \{ sucesso: false, erro: 'Médico não pode ser apagado/);
  });

  it('médico apagado: pacientes desvinculados (fila Atribuir Médico), linha de `medicos` preservada', () => {
    expect(fn).toMatch(/\.set\(\{ medicoId: null \}\)/);
    expect(fn).not.toMatch(/\.delete\(medicos\)/);
  });

  it('consultas futuras NÃO são canceladas sozinhas (ADR-0025 D-05 #3): só contadas e devolvidas', () => {
    expect(fn).not.toMatch(/\.update\(consultas\)/);
    expect(fn).toContain('consultasFuturas');
    expect(acoes).toMatch(
      /inArray\(consultas\.status, \['reservada', 'agendada', 'confirmada'\]\)/,
    );
  });

  it('o resumo de vínculos é só do admin e devolve números, não dados de paciente', () => {
    const r = corpo('resumirVinculosDoUsuario');
    expect(r).toContain('verificarAdmin');
    expect(r).not.toMatch(/nome|email|cpf/i);
  });

  it('nunca apaga a linha de users: soft delete', () => {
    expect(fn).not.toMatch(/\.delete\(users\)/);
    expect(fn).toMatch(/deletedAt: new Date\(\)/);
  });

  it('LIBERA o e-mail (índice único + webhook que religa por e-mail) e zera clerkId e telefone', () => {
    const update = fn.slice(fn.indexOf('.update(users)'));
    expect(update).toMatch(/email: `apagado\+\$\{usuarioId\}@removido\.invalid`/);
    expect(update).toMatch(/clerkId: null/);
    expect(update).toMatch(/telefone: null/);
  });

  it('o Clerk é apagado ANTES do banco, e a falha dele aborta sem tocar no banco', () => {
    const iClerk = fn.indexOf('deleteUser(');
    const iBanco = fn.indexOf('.update(pacientes)');
    expect(iClerk).toBeGreaterThan(-1);
    expect(iClerk).toBeLessThan(iBanco);
    expect(fn).toMatch(/Nada foi alterado/);
  });

  it('Clerk "não encontrado" (404) é tratado como já apagado, para a repetição funcionar', () => {
    expect(fn).toMatch(/status !== 404/);
  });

  it('arquiva a ficha de paciente junto', () => {
    expect(fn).toMatch(/\.update\(pacientes\)[\s\S]*status: 'arquivado'/);
  });

  it('a auditoria guarda o e-mail MASCARADO, nunca o original', () => {
    expect(fn).toContain('mascararEmail(usuario.email)');
    expect(fn).not.toMatch(/dadosAntes[^}]*email: usuario\.email/);
  });
});

describe('alterar papel (admin): identidade do servidor, Clerk primeiro, sem médico', () => {
  const fn = corpo('alterarRoleUsuario');

  it('vacuidade: o extrator enxerga a função inteira', () => {
    expect(fn.length).toBeGreaterThan(1500);
  });

  it('NÃO recebe a identidade do admin do cliente', () => {
    const assinatura = acoes.slice(
      acoes.indexOf('export async function alterarRoleUsuario'),
      acoes.indexOf(
        '): Promise<ActionResult>',
        acoes.indexOf('export async function alterarRoleUsuario'),
      ),
    );
    expect(assinatura).not.toMatch(/adminClerkId/);
    expect(fn).toMatch(/clerkId === auth\.clerkId/);
  });

  it('só alterna admin ↔ paciente e recusa mexer em médico', () => {
    expect(acoes).toMatch(/novaRole: z\.enum\(\['admin', 'paciente'\]\)/);
    expect(fn).toMatch(/role === 'medico'/);
  });

  it('a falha do Clerk ABORTA (o papel efetivo vem do Clerk) e o Clerk vem antes do banco', () => {
    const iClerk = fn.indexOf('updateUserMetadata(');
    const iBanco = fn.indexOf('.update(users).set({ role: novaRole })');
    expect(iClerk).toBeGreaterThan(-1);
    expect(iClerk).toBeLessThan(iBanco);
    expect(fn).toMatch(/Nada foi alterado/);
    expect(fn).not.toMatch(/console\.warn\([^)]*Clerk/);
  });

  it('não deixa a plataforma sem admin', () => {
    expect(fn).toContain('existeOutroAdmin(');
  });

  it('quem vira paciente ganha ficha, sem sobrescrever a existente', () => {
    expect(fn).toMatch(/onConflictDoNothing\(\{ target: pacientes\.userId \}\)/);
  });
});

describe('listagem e tela de Usuários', () => {
  it('usuário apagado não aparece na lista nem nos KPIs', () => {
    const fn = corpo('listarUsuariosAdmin');
    expect(fn).toMatch(/\$\{users\.deletedAt\} IS NULL/);
    expect(fn).toMatch(/WHERE deleted_at IS NULL/);
  });

  it('editar nome/telefone só age em usuário ativo e audita o antes e o depois', () => {
    const fn = corpo('atualizarUsuarioAdmin');
    expect(fn).toMatch(/isNull\(users\.deletedAt\)/);
    expect(fn).toContain('auditarUsuario(');
  });

  it('a tela liga as ações, desabilita apagar só para si mesmo, e pede o e-mail digitado', () => {
    const pagina = ler('app/(admin)/admin/usuarios/page.tsx');
    expect(pagina).toContain('DialogoEditarUsuario');
    expect(pagina).toContain('DialogoExcluirUsuario');
    expect(pagina).not.toMatch(/disabled=\{[^}]*role === 'medico'/);
    expect(pagina).toMatch(/user\.clerkId === euMesmo\?\.id/);
    const excluir = ler('app/(admin)/admin/usuarios/_components/dialogo-excluir-usuario.tsx');
    expect(excluir).toMatch(
      /digitado\.trim\(\)\.toLowerCase\(\) === usuario\.email\.toLowerCase\(\)/,
    );
    expect(excluir).toMatch(/disabled=\{!confirmado/);
  });

  it('os diálogos não importam o `db` (cliente não fala com o banco)', () => {
    for (const f of ['dialogo-editar-usuario.tsx', 'dialogo-excluir-usuario.tsx']) {
      expect(ler(`app/(admin)/admin/usuarios/_components/${f}`)).not.toMatch(/@\/lib\/db/);
    }
  });
});
