import { describe, expect, it } from 'vitest';
import {
  diagnosticoDoErro,
  ERRO_GENERICO_DE_CADASTRO,
  mensagemDoErroDeCadastro,
} from '@/lib/pacientes/erro-de-cadastro';

/** Forma real: DrizzleQueryError com a query e os valores na `message`, e o erro do pg em `cause`. */
const drizzle = (pg: Record<string, unknown>) =>
  Object.assign(new Error("Failed query: insert into pacientes values ('529.982.247-25')"), {
    cause: Object.assign(new Error('invalid input syntax'), pg),
  });

describe('o erro do cadastro diz a causa sem vazar dado', () => {
  it.each([
    ['22007', /data/i],
    ['23505', /já existe/i],
    ['22001', /tamanho/i],
    ['22P02', /formato/i],
    ['23502', /obrigat/i],
  ])('código %s vira mensagem própria', (code, esperado) => {
    expect(mensagemDoErroDeCadastro(drizzle({ code }))).toMatch(esperado);
  });

  it('erro desconhecido cai na mensagem genérica, que orienta o que fazer', () => {
    expect(mensagemDoErroDeCadastro(new Error('boom'))).toBe(ERRO_GENERICO_DE_CADASTRO);
    expect(mensagemDoErroDeCadastro(null)).toBe(ERRO_GENERICO_DE_CADASTRO);
    expect(ERRO_GENERICO_DE_CADASTRO).toMatch(/suporte/i);
  });

  it('nem a mensagem da tela nem o diagnóstico carregam a query ou o valor', () => {
    const e = drizzle({ code: '23505', constraint: 'users_email_idx', table: 'users' });
    expect(mensagemDoErroDeCadastro(e)).not.toMatch(/529|insert|Failed query/);
    expect(diagnosticoDoErro(e)).toBe('23505:users_email_idx:users');
    expect(diagnosticoDoErro(e)).not.toMatch(/529|insert/);
  });

  it('cadeia de cause cíclica não trava', () => {
    const a: Record<string, unknown> = {};
    a.cause = a;
    expect(mensagemDoErroDeCadastro(a)).toBe(ERRO_GENERICO_DE_CADASTRO);
  });
});
