import { describe, expect, it } from 'vitest';
import { decidirContato } from '@/lib/pacientes/contato';

const sem = { email: 'a@x.invalid', telefone: '(81) 9', temContaDeAcesso: false };
const com = { ...sem, temContaDeAcesso: true };
const admin = { eAdmin: true };
const medico = { eAdmin: false };

describe('contato do paciente na edição', () => {
  it('sem conta de acesso: e-mail novo vai em minúsculas e sem espaços, e o Clerk não é chamado', () => {
    expect(decidirContato(sem, { email: '  Novo@X.invalid ' }, medico)).toEqual({
      ok: true,
      gravar: { email: 'novo@x.invalid' },
      trocarNoClerk: false,
    });
  });

  it('com conta de acesso: ADMIN troca o e-mail e o Clerk precisa trocar junto', () => {
    expect(decidirContato(com, { email: 'novo@x.invalid' }, admin)).toEqual({
      ok: true,
      gravar: { email: 'novo@x.invalid' },
      trocarNoClerk: true,
    });
  });

  it('com conta de acesso: quem não é admin não troca o e-mail de login (assumiria a conta)', () => {
    expect(decidirContato(com, { email: 'novo@x.invalid' }, medico).ok).toBe(false);
  });

  it('com conta de acesso: reenviar o mesmo e-mail, mesmo com outra caixa, não é troca', () => {
    expect(decidirContato(com, { email: 'A@X.invalid', telefone: '(11) 1' }, medico)).toEqual({
      ok: true,
      gravar: { telefone: '(11) 1' },
      trocarNoClerk: false,
    });
  });

  it('e-mail vazio ou ausente não toca; telefone vazio apaga; ausente não toca', () => {
    expect(decidirContato(sem, { email: '' }, admin)).toMatchObject({ ok: true, gravar: {} });
    expect(decidirContato(sem, {}, admin)).toMatchObject({ ok: true, gravar: {} });
    expect(decidirContato(sem, { telefone: '  ' }, admin)).toMatchObject({
      ok: true,
      gravar: { telefone: null },
    });
  });

  it('telefone igual ao atual não gera escrita', () => {
    expect(decidirContato(sem, { telefone: '(81) 9' }, admin)).toMatchObject({
      ok: true,
      gravar: {},
    });
  });
});
