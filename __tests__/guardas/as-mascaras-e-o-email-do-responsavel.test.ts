/**
 * MÁSCARAS DE DIGITAÇÃO E E-MAIL DE BOAS-VINDAS DO RESPONSÁVEL (ADR-0033, 29/10/2026) — unidade pura + guarda estrutural.
 *
 *  1. `mascaraCpf` e `mascaraTelefone` formatam enquanto se digita e nunca passam de 11 dígitos
 *  2. o formulário "Novo responsável" USA as duas máscaras (senão o campo volta a aceitar texto solto)
 *  3. o e-mail de boas-vindas NÃO carrega senha, aponta para `/entrar` e escapa o nome
 *  4. a action só envia o e-mail DEPOIS de gravar, e a falha de envio não vira falha do cadastro
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { montarEmailBoasVindasResponsavel } from '@/lib/email/boas-vindas-do-responsavel';
import { mascaraCpf, mascaraTelefone } from '@/lib/validacao/mascaras';

const raiz = process.cwd();
const ler = (c: string) => readFileSync(join(raiz, c), 'utf8').replace(/\r\n/g, '\n');

describe('máscara de CPF', () => {
  it.each([
    ['', ''],
    ['5', '5'],
    ['5299', '529.9'],
    ['529982', '529.982'],
    ['5299822', '529.982.2'],
    ['52998224725', '529.982.247-25'],
    ['529.982.247-25', '529.982.247-25'],
    ['abc529def982ghi247jkl25', '529.982.247-25'],
    ['5299822472599999', '529.982.247-25'],
  ])('%j → %j', (entrada, esperado) => {
    expect(mascaraCpf(entrada)).toBe(esperado);
  });
});

describe('máscara de telefone', () => {
  it.each([
    ['', ''],
    ['1', '(1'],
    ['11', '(11'],
    ['119', '(11) 9'],
    ['11999', '(11) 999'],
    ['1133334', '(11) 3333-4'],
    ['1133334444', '(11) 3333-4444'],
    ['11999991234', '(11) 99999-1234'],
    ['(11) 99999-1234', '(11) 99999-1234'],
    ['+55 11 99999-1234', '(11) 99999-1234'],
    ['119999912345678', '(11) 99999-1234'],
  ])('%j → %j', (entrada, esperado) => {
    expect(mascaraTelefone(entrada)).toBe(esperado);
  });
});

describe('o formulário "Novo responsável"', () => {
  const dialogo = ler('components/admin/responsaveis/dialogo-criar-responsavel.tsx');

  it('🔴 aplica a máscara de CPF e a de telefone ao digitar', () => {
    expect(dialogo).toMatch(/setCpf\(mascaraCpf\(/);
    expect(dialogo).toMatch(/setTelefone\(mascaraTelefone\(/);
  });

  it('o limite do campo cabe no formato com máscara (CPF 14, telefone 15)', () => {
    expect(dialogo).toMatch(/maxLength=\{14\}/);
    expect(dialogo).toMatch(/maxLength=\{15\}/);
  });

  it('o aviso da tela diz que a senha NÃO vai no e-mail', () => {
    expect(dialogo).toMatch(/senha NÃO vai nele/);
  });
});

describe('o e-mail de boas-vindas', () => {
  const { assunto, html } = montarEmailBoasVindasResponsavel({ nome: 'Maria <b>Silva</b>' });

  it('aponta para a tela de entrada e orienta a trocar a senha por lá', () => {
    expect(html).toMatch(/\/entrar"/);
    expect(html).toMatch(/Esqueci minha senha/);
    expect(assunto).toMatch(/responsável/i);
  });

  it('🔴 não carrega senha nem pede para respondê-la', () => {
    expect(html).toMatch(/não vai neste e-mail/);
    expect(html).not.toMatch(/sua senha é|senha:\s*\S/i);
  });

  it('escapa o nome (nada de HTML do usuário no corpo)', () => {
    expect(html).not.toContain('<b>Silva</b>');
    expect(html).toContain('Olá, Maria!');
  });
});

describe('a action de criar responsável', () => {
  const action = ler('app/_actions/admin-responsaveis.ts');
  const corpo = action.slice(action.indexOf('export async function criarResponsavelAdmin'));

  it('🔴 só envia o e-mail DEPOIS de gravar no banco e registrar a auditoria', () => {
    const iBanco = corpo.indexOf('.insert(users)');
    const iAuditoria = corpo.indexOf('registrarAuditoria(');
    const iEmail = corpo.indexOf('enviarBoasVindasDoResponsavel(');
    expect(iBanco).toBeGreaterThan(-1);
    expect(iEmail).toBeGreaterThan(iAuditoria);
    expect(iAuditoria).toBeGreaterThan(iBanco);
  });

  it('o envio é um helper que engole a falha: e-mail não derruba o cadastro', () => {
    const helper = ler('lib/email/boas-vindas-do-responsavel.ts');
    expect(helper).toMatch(/catch \{[\s\S]*return false/);
    // o resultado do envio é guardado e devolvido (não é fire-and-forget que some)
    expect(corpo).toMatch(/const emailEnviado = await enviarBoasVindasDoResponsavel\(/);
    expect(corpo).toMatch(/dados: \{ id: userId, emailEnviado \}/);
  });
});

describe('o papel do responsável não vira "paciente" por acidente (29/10/2026)', () => {
  it('🔴 sem linha no banco, `obterRoleComFallback` NÃO grava o default `paciente` no Clerk', () => {
    const perm = ler('lib/auth/permissions.ts');
    const i = perm.indexOf('Nenhum registro no banco para clerkId');
    expect(i, 'o ponto do aviso existe (vacuidade)').toBeGreaterThan(-1);
    const bloco = perm.slice(i, perm.indexOf('} catch (dbError)', i));
    // O `publicMetadata` é lido PRIMEIRO; um 'paciente' gravado aqui fixava o papel errado de um responsável novo.
    expect(bloco).toMatch(/precisaSincronizar = false/);
  });

  it('🔴 "Minha área de paciente" é decidida pela FICHA, não pelo papel do Clerk', () => {
    const layout = ler('app/(responsavel)/layout.tsx');
    expect(layout).toMatch(/temFichaDePaciente\(/);
    expect(layout).not.toMatch(/temAreaDePaciente=\{role === 'paciente'\}/);
  });
});
