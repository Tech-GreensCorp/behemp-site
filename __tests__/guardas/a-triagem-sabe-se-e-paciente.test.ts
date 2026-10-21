import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { marcarPacientes, normalizarEmail } from '@/lib/triagens/e-paciente';

const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), 'utf8');

describe('regra "a pessoa triada é paciente" (ficha ativa, por e-mail)', () => {
  const pacientes = new Set(['maria@exemplo.com']);

  it('marca paciente quando o e-mail bate', () => {
    const [t] = marcarPacientes([{ emailContato: 'maria@exemplo.com' }], pacientes);
    expect(t.ehPaciente).toBe(true);
  });

  it('ignora caixa e espaços', () => {
    const [t] = marcarPacientes([{ emailContato: '  Maria@Exemplo.COM ' }], pacientes);
    expect(t.ehPaciente).toBe(true);
  });

  it('CONTROLE: e-mail desconhecido não é paciente', () => {
    const [t] = marcarPacientes([{ emailContato: 'outra@exemplo.com' }], pacientes);
    expect(t.ehPaciente).toBe(false);
  });

  it('triagem sem e-mail nunca é paciente (ausência não prova vínculo)', () => {
    const r = marcarPacientes([{ emailContato: null }, { emailContato: '   ' }], pacientes);
    expect(r.map((t) => t.ehPaciente)).toEqual([false, false]);
  });

  it('preserva os demais campos e a ordem', () => {
    const r = marcarPacientes(
      [
        { id: 'a', emailContato: 'x@x.com' },
        { id: 'b', emailContato: 'maria@exemplo.com' },
      ],
      pacientes,
    );
    expect(r.map((t) => t.id)).toEqual(['a', 'b']);
    expect(r.map((t) => t.ehPaciente)).toEqual([false, true]);
  });

  it('normalizarEmail devolve null para vazio', () => {
    expect(normalizarEmail(undefined)).toBeNull();
    expect(normalizarEmail('')).toBeNull();
  });
});

describe('estrutura: a flag chega à tela e o acesso segue restrito', () => {
  const action = ler('app/(public)/_actions/triagem.ts');

  it('listarTriagens continua exclusiva do admin e devolve a flag', () => {
    const corpo = action.slice(action.indexOf('export async function listarTriagens()'));
    const fim = corpo.indexOf('export async function', 10);
    const fn = corpo.slice(0, fim);
    expect(fn).toContain('verificarAdmin');
    expect(fn).toContain('marcarPacientes');
  });

  it('a ficha só conta se não estiver apagada (soft delete)', () => {
    expect(action).toMatch(/isNull\(pacientes\.deletedAt\)/);
  });

  it('a tela de triagens renderiza a flag', () => {
    const tela = ler('app/(admin)/admin/triagens/page.tsx');
    expect(tela).toContain('triagem.ehPaciente');
  });

  it('a listagem de pacientes do admin exige admin, não médico', () => {
    const a = ler('app/_actions/admin-pacientes.ts');
    expect(a).toContain('verificarAdmin');
    expect(a).not.toContain('verificarMedicoOuAdmin');
  });

  it('a lista do admin não leva para a área do médico (a sidebar trocava sozinha)', () => {
    const lista = ler('app/(admin)/admin/pacientes/page.tsx');
    expect(lista).not.toMatch(/['"`]\/medico\//);
    expect(lista).toContain('/admin/pacientes/${paciente.id}');
    expect(lista).toContain('/admin/pacientes/novo');
  });

  it('as telas de detalhe e cadastro existem sob /admin e "voltar" respeita a área', () => {
    expect(ler('app/(admin)/admin/pacientes/[id]/page.tsx')).toContain(
      'medico/pacientes/[id]/page',
    );
    expect(ler('app/(admin)/admin/pacientes/novo/page.tsx')).toContain(
      'medico/pacientes/novo/page',
    );
    for (const p of [
      'app/(medico)/medico/pacientes/[id]/page.tsx',
      'app/(medico)/medico/pacientes/novo/page.tsx',
    ]) {
      const src = ler(p);
      expect(src).toContain("startsWith('/admin/')");
      expect(src).not.toMatch(/href="\/medico\/pacientes"/);
    }
  });

  it('o item Pacientes está na sidebar do admin e a do médico não ganhou rota de admin', () => {
    expect(ler('components/shared/admin-sidebar.tsx')).toContain("href: '/admin/pacientes'");
    expect(ler('components/shared/medico-sidebar.tsx')).not.toContain('/admin/');
  });
});

describe('arquivar paciente (admin): soft delete, nunca apagar', () => {
  const action = ler('app/_actions/admin-pacientes.ts');
  const inicio = action.indexOf('export async function arquivarPacienteAdmin');
  const fn = action.slice(inicio);

  it('é exclusiva do admin e não reaproveita a action que aceita médico sem escopo', () => {
    expect(fn).toContain('verificarAdmin');
    expect(fn).not.toContain('verificarMedicoOuAdmin');
    expect(fn).not.toContain('arquivarPaciente(');
  });

  it('nunca apaga a linha: só marca status e deletedAt', () => {
    expect(fn).not.toMatch(/\.delete\(/);
    expect(fn).toMatch(/status: 'arquivado', deletedAt:/);
  });

  it('o UPDATE só atinge ficha ainda ativa (cliques simultâneos não arquivam duas vezes)', () => {
    const update = fn.slice(fn.indexOf('.update(pacientes)'));
    expect(update.slice(0, update.indexOf('.returning'))).toContain('isNull(pacientes.deletedAt)');
  });

  it('registra auditoria com o estado anterior e o motivo', () => {
    expect(fn).toContain('registrarAuditoria');
    expect(fn).toMatch(/dadosAntes: \{ status: atual\.status \}/);
    expect(fn).toContain('motivo');
  });

  it('a tela pede confirmação e o botão não deixa a linha navegar', () => {
    const tela = ler('app/(admin)/admin/pacientes/page.tsx');
    expect(tela).toContain('arquivarPacienteAdmin');
    expect(tela).toContain('AlertDialog');
    expect(tela).toContain('e.preventDefault()');
  });
});
