/**
 * Guarda: a edição de um paciente ANTIGO (sem dado nenhum) salva.
 *
 * 🔴 O defeito (20/10/2026): a tela manda o formulário inteiro e todo campo sem valor vai como `''`.
 * `tratamentoTipo: ''` não passava no enum Zod ("Invalid enum value ... received ''"), e `''` em
 * coluna `date` seria recusado pelo Postgres. O comportamento contra banco real está em
 * `__tests__/integracao/a-edicao-do-paciente-aceita-campo-vazio.test.ts`; aqui ficam as regras
 * puras e o que impede a action de voltar a gravar o formulário cru.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  statusDaEdicaoSchema,
  tratamentoDaEdicaoSchema,
  valoresParaGravar,
} from '@/lib/pacientes/edicao';

const RAIZ = join(__dirname, '..', '..');
const ler = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('o formulário manda "" para campo sem valor', () => {
  it('o tratamento aceita um valor válido ou "" (limpar), e nada além disso', () => {
    for (const v of ['cbd', 'thc', 'cbd_thc', '']) {
      expect(tratamentoDaEdicaoSchema.safeParse(v).success, v).toBe(true);
    }
    for (const v of ['xyz', 'CBD', ' ', 'cbd ', null, 1]) {
      expect(tratamentoDaEdicaoSchema.safeParse(v).success, String(v)).toBe(false);
    }
  });

  it('o status aceita os quatro valores ou "", e nada além disso', () => {
    for (const v of ['aguardando_consulta', 'em_tratamento', 'concluido', 'arquivado', '']) {
      expect(statusDaEdicaoSchema.safeParse(v).success, v).toBe(true);
    }
    expect(statusDaEdicaoSchema.safeParse('ativo').success).toBe(false);
  });

  it('"" e só espaços viram NULL; valor preenchido passa como veio; ausente não é tocado', () => {
    const r = valoresParaGravar(
      {
        cidade: 'São Paulo',
        cpf: '',
        rg: '   ',
        dataNascimento: '',
        tratamentoTipo: '',
        uf: undefined,
      },
      ['cidade', 'cpf', 'rg', 'dataNascimento', 'tratamentoTipo', 'uf', 'genero'],
    );
    expect(r).toEqual({
      cidade: 'São Paulo',
      cpf: null,
      rg: null,
      dataNascimento: null,
      tratamentoTipo: null,
    });
    expect('uf' in r).toBe(false);
    expect('genero' in r).toBe(false);
  });

  it('status vazio é ignorado (coluna obrigatória); status preenchido passa', () => {
    expect(valoresParaGravar({ status: '' }, ['status'])).toEqual({});
    expect(valoresParaGravar({ status: 'em_tratamento' }, ['status'])).toEqual({
      status: 'em_tratamento',
    });
  });

  it('só campos da lista vão ao UPDATE (o resto do formulário não passa)', () => {
    expect(valoresParaGravar({ cidade: 'X', role: 'admin' }, ['cidade'])).toEqual({ cidade: 'X' });
  });
});

describe('a action não grava o formulário cru', () => {
  const codigo = semComentarios(ler('app/_actions/pacientes.ts'));
  const i = codigo.indexOf('export async function atualizarPaciente(');
  const corpo = codigo.slice(i, codigo.indexOf('\nexport async function ', i + 1));

  it('monta o UPDATE por valoresParaGravar, e não copiando o valor cru', () => {
    expect(corpo).toContain('valoresParaGravar(');
    expect(corpo).not.toMatch(/if \(valor !== undefined\) updatePaciente\[campo\] = valor/);
  });

  it('o schema da edição usa os schemas que aceitam ""', () => {
    expect(codigo).toMatch(/tratamentoTipo:\s*tratamentoDaEdicaoSchema/);
    expect(codigo).toMatch(/status:\s*statusDaEdicaoSchema/);
    // o `status` da edição não pode voltar ao enum puro
    const schema = codigo.slice(codigo.indexOf('const atualizarPacienteSchema'));
    expect(schema.slice(0, schema.indexOf('});'))).not.toContain("z.enum(['aguardando_consulta'");
  });
});
