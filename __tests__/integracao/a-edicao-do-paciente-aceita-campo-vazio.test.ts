/**
 * Editar um paciente ANTIGO, que não tem dado nenhum, e salvar — EXECUTADO contra Postgres real.
 *
 * 🔴 O defeito (20/10/2026): a tela de edição manda o formulário INTEIRO, e todo campo sem valor
 * vai como `''` (`syncForm` faz `p.campo ?? ''`). A action então
 *   · recusava o `tratamentoTipo: ''` pelo enum Zod ("Invalid enum value. Expected 'cbd' | 'thc'
 *     | 'cbd_thc', received ''") — o erro que o admin viu ao salvar qualquer campo, e
 *   · mesmo sem o enum, mandaria `dataNascimento: ''` e `dataAssociacao: ''` a colunas `date`,
 *     que o Postgres recusa; e gravaria `''` (em vez de NULL) nos campos de texto.
 *
 * ## O que ele prova
 *   1. o formulário de um paciente vazio, com UM campo preenchido, salva; o resto continua NULL
 *   2. preencher tratamento e data de nascimento salva os dois
 *   3. esvaziar um campo que tinha valor o LIMPA (vira NULL), inclusive o tratamento
 *   4. valor inválido continua recusado (a correção não afrouxou o enum)
 *   5. `status` vazio não derruba nem muda o status (coluna obrigatória)
 *
 * Rodar:
 *
 *   docker run -d --name behemp-pg-edicao -e POSTGRES_PASSWORD=local -e POSTGRES_DB=behemp \
 *     -p 5544:5432 postgres:17-alpine
 *   DATABASE_URL=postgresql://postgres:local@localhost:5544/behemp npx drizzle-kit push --force
 *   DATABASE_URL=postgresql://postgres:local@localhost:5544/behemp \
 *     npx vitest run --config vitest.integracao.mts \
 *     __tests__/integracao/a-edicao-do-paciente-aceita-campo-vazio.test.ts
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';

const sessao = { clerkId: null as string | null, role: 'admin' as string };

vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({
    userId: sessao.clerkId,
    sessionClaims: { metadata: { role: sessao.role } },
  }),
  currentUser: async () => ({ id: sessao.clerkId }),
  clerkClient: async () => ({ users: {} }),
}));
vi.mock('next/cache', () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));

const { db } = await import('@/lib/db');
const schema = await import('@/db/schema');
const { atualizarPaciente } = await import('@/app/_actions/pacientes');

/** O que `syncForm` monta para um paciente SEM nenhum dado (cada `null` vira `''`). */
const CAMPOS_DO_FORMULARIO = [
  'dataNascimento',
  'cpf',
  'rg',
  'genero',
  'cep',
  'endereco',
  'cidade',
  'uf',
  'peso',
  'altura',
  'historicoMedico',
  'patologia',
  'atendimento',
  'temAdvogado',
  'nomeAdvogado',
  'cid',
  'categorizacao',
  'comoConheceu',
  'dataAssociacao',
  'entradaPaciente',
  'etapa',
  'hospitalProximo',
  'homeCare',
  'planoSaude',
  'possuiPlanoSaude',
  'rendaFamilia',
  'termoAssociado',
  'valorContribuicao',
  'processoJudicializacao',
  'responsavelNome',
  'responsavelCpf',
  'tratamentoTipo',
] as const;

const formularioVazio = (): Record<string, string> => ({
  ...Object.fromEntries(CAMPOS_DO_FORMULARIO.map((c) => [c, ''])),
  status: 'aguardando_consulta',
});

let pacienteId = '';

async function limpar() {
  await db.delete(schema.logsAuditoria);
  await db.delete(schema.pacientes);
  await db.delete(schema.users);
}

const lerPaciente = async () =>
  (await db.select().from(schema.pacientes).where(eq(schema.pacientes.id, pacienteId)))[0];

beforeEach(async () => {
  await limpar();
  await db
    .insert(schema.users)
    .values({ clerkId: 'ck_adm', email: 'adm@teste.invalid', nome: 'Admin', role: 'admin' });
  const [u] = await db
    .insert(schema.users)
    .values({
      clerkId: 'ck_pac',
      email: 'antigo@teste.invalid',
      nome: 'Paciente Antigo',
      role: 'paciente',
    })
    .returning({ id: schema.users.id });
  // paciente "de antigamente": a ficha existe e NADA além do obrigatório está preenchido
  const [p] = await db
    .insert(schema.pacientes)
    .values({ userId: u.id })
    .returning({ id: schema.pacientes.id });
  pacienteId = p.id;
  sessao.clerkId = 'ck_adm';
  sessao.role = 'admin';
});
afterAll(limpar);

describe('editar um paciente que não tem dado nenhum', () => {
  it('salva UM campo preenchido, e o resto continua NULL (não vira texto vazio)', async () => {
    const r = await atualizarPaciente({ pacienteId, ...formularioVazio(), cidade: 'São Paulo' });
    expect(r).toEqual({ sucesso: true });

    const p = await lerPaciente();
    expect(p.cidade).toBe('São Paulo');
    expect(p.dataNascimento).toBeNull();
    expect(p.dataAssociacao).toBeNull();
    expect(p.tratamentoTipo).toBeNull();
    expect(p.cpf).toBeNull();
    expect(p.historicoMedico).toBeNull();
    expect(p.status).toBe('aguardando_consulta');
  });

  it('tratamento e data de nascimento preenchidos salvam', async () => {
    const r = await atualizarPaciente({
      pacienteId,
      ...formularioVazio(),
      tratamentoTipo: 'cbd_thc',
      dataNascimento: '1990-05-01',
    });
    expect(r).toEqual({ sucesso: true });
    const p = await lerPaciente();
    expect(p.tratamentoTipo).toBe('cbd_thc');
    expect(p.dataNascimento).toBe('1990-05-01');
  });

  it('esvaziar um campo que tinha valor o LIMPA, tratamento inclusive', async () => {
    await db
      .update(schema.pacientes)
      .set({ tratamentoTipo: 'thc', cidade: 'Recife', dataNascimento: '1980-01-02' })
      .where(eq(schema.pacientes.id, pacienteId));

    const r = await atualizarPaciente({ pacienteId, ...formularioVazio() });
    expect(r).toEqual({ sucesso: true });
    const p = await lerPaciente();
    expect(p.tratamentoTipo).toBeNull();
    expect(p.cidade).toBeNull();
    expect(p.dataNascimento).toBeNull();
  });

  it('valor inválido continua recusado: a correção não afrouxou o enum', async () => {
    const r = await atualizarPaciente({
      pacienteId,
      ...formularioVazio(),
      tratamentoTipo: 'xyz' as never,
    });
    expect(r.sucesso).toBe(false);
    expect((await lerPaciente()).tratamentoTipo).toBeNull();
  });

  it('status vazio não derruba nem muda o status', async () => {
    await db
      .update(schema.pacientes)
      .set({ status: 'em_tratamento' })
      .where(eq(schema.pacientes.id, pacienteId));
    const r = await atualizarPaciente({
      pacienteId,
      ...formularioVazio(),
      status: '' as never,
      cidade: 'Natal',
    });
    expect(r).toEqual({ sucesso: true });
    const p = await lerPaciente();
    expect(p.status).toBe('em_tratamento');
    expect(p.cidade).toBe('Natal');
  });
});
