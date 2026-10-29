/**
 * O RESPONSÁVEL PEDE E LÊ SÓ DO DEPENDENTE DELE — EXECUTADO contra Postgres real (ADR-0033, 29/10/2026).
 *
 * Cobre o que o responsável FAZ por um dependente depois do cadastro: solicitar recompra em nome dele, ler as
 * listas dele e abrir os documentos dele. Os cenários são os do pedido: responsável SEM dependentes, com UM, e
 * com VÁRIOS (e nada se mistura entre eles).
 *
 * ## O que ele prova
 *   1. a recompra pedida em nome do dependente nasce com `paciente_id` do dependente e `solicitante` = o
 *      responsável; o lembrete e o e-mail da equipe falam do DEPENDENTE, com o contato do RESPONSÁVEL (nunca o
 *      endereço técnico)
 *   2. 🔴 um responsável SEM vínculo, e um paciente qualquer, mandando o `pacienteId` de outro: recusados com a
 *      MESMA resposta de "não existe" (era o buraco do Item 83: o `pacienteId` valia para qualquer logado)
 *   3. a equipe (médico, admin) continua pedindo para qualquer paciente, como antes
 *   4. com VÁRIOS dependentes, cada lista é de UM só: recompras, documentos, medicamentos, consultas
 *   5. um responsável SEM dependentes recebe listas vazias, e nada de paciente
 *   6. o paciente que também é responsável: as recompras dos dependentes NÃO aparecem na lista dele como
 *      paciente (`listarMinhasRecompras`), e as dele não aparecem na dos dependentes
 *   7. o documento do dependente abre pelo vínculo `ativo` (e só por ele): outro responsável, vínculo encerrado
 *      e paciente alheio recebem 404
 *
 * Rodar (banco descartável): ver `o-responsavel-age-so-por-vinculo-provado.test.ts`.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq, sql } from 'drizzle-orm';

const sessao = { clerkId: null as string | null, role: 'responsavel' as string };

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

const eventos: Array<{ name: string; data: Record<string, unknown> }> = [];
vi.mock('@/lib/integrations/inngest', () => ({
  inngest: {
    send: async (e: { name: string; data: Record<string, unknown> }) => {
      eventos.push(e);
    },
  },
}));
const emailsDaEquipe: Array<Record<string, unknown>> = [];
vi.mock('@/lib/email/notificacoes', () => ({
  enviarEmailRecompraCompletoEquipe: async (p: Record<string, unknown>) => {
    emailsDaEquipe.push(p);
  },
}));

const { db } = await import('@/lib/db');
const schema = await import('@/db/schema');
const { cadastrarDependente } = await import('@/app/_actions/dependentes');
const { solicitarRecompraManual, listarMinhasRecompras } = await import('@/app/_actions/recompras');
const { garantirLeitorDoDocumento } = await import('@/lib/auth/escopo-documento');
const {
  listarConsultasDoDependente,
  listarDocumentosDoDependente,
  listarMedicamentosDoDependente,
  listarRecomprasDoDependente,
  obterFichaDoDependente,
  resumoDoDependente,
} = await import('@/lib/dependentes/leituras');
const { garantirResponsavelDoPaciente, listarDependentesDoResponsavel } = await import(
  '@/lib/auth/escopo-do-responsavel'
);

const CPF = '529.982.247-25';
const NAO_ENCONTRADO = { ok: false, erro: 'Paciente não encontrado' };

async function limpar() {
  const host = new URL(process.env.DATABASE_URL ?? 'postgresql://x@invalido/x').hostname;
  if (host !== 'localhost' && host !== '127.0.0.1') {
    throw new Error(`Este teste apaga dados e só roda em banco local (host: ${host}).`);
  }
  await db.execute(
    sql`TRUNCATE TABLE recompras, notificacoes, documentos, consultas, itens_ajuste_dosagem, ajustes_dosagem, responsaveis_pacientes, responsaveis, logs_auditoria, medicos, pacientes, users CASCADE`,
  );
}

async function criarUsuario(
  chave: string,
  role: 'responsavel' | 'paciente' | 'medico' | 'admin',
): Promise<string> {
  const [u] = await db
    .insert(schema.users)
    .values({
      clerkId: `ck_${chave}`,
      email: `${chave}@teste.invalid`,
      nome: `Usuário ${chave}`,
      role,
    })
    .returning({ id: schema.users.id });
  return u.id;
}

const entrarComo = (chave: string, role: string) => {
  sessao.clerkId = `ck_${chave}`;
  sessao.role = role;
};

const novaRecompra = (extra: Record<string, unknown> = {}) => ({
  medicamentoNome: 'Óleo CBD 3000',
  mlFrasco: 30,
  gotasPorDia: 10,
  dataInicioUso: '2026-10-01',
  contatoTelefone: '11988887777',
  ...extra,
});

async function cadastrar(nome: string): Promise<string> {
  const r = await cadastrarDependente({
    nome,
    dataNascimento: '2016-04-10',
    parentesco: 'Mãe',
    cpfDoResponsavel: CPF,
  });
  expect(r.sucesso, r.erro).toBe(true);
  return r.dados!.pacienteId;
}

async function criarDocumento(pacienteId: string, nome: string): Promise<string> {
  const [d] = await db
    .insert(schema.documentos)
    .values({
      pacienteId,
      tipo: 'rg',
      urlBlob: `https://blob.invalid/${nome}`,
      nomeArquivo: nome,
      dataEmissao: '2026-01-01',
      dataValidade: '2030-01-01',
    })
    .returning({ id: schema.documentos.id });
  return d.id;
}

beforeEach(async () => {
  await limpar();
  eventos.length = 0;
  emailsDaEquipe.length = 0;
  await criarUsuario('resp', 'responsavel');
  await criarUsuario('outro', 'responsavel');
  entrarComo('resp', 'responsavel');
});
afterAll(limpar);

describe('responsável SEM dependentes', () => {
  it('não tem nada de paciente: lista vazia e nenhuma leitura', async () => {
    expect(await listarDependentesDoResponsavel()).toEqual([]);
    expect(await garantirResponsavelDoPaciente('qualquer-id')).toEqual(NAO_ENCONTRADO);
  });

  it('não consegue pedir recompra: não há de quem', async () => {
    const r = await solicitarRecompraManual(novaRecompra({ pacienteId: 'id-que-nao-existe' }));
    expect(r.sucesso).toBe(false);
    expect(r.erro).toBe('Paciente não encontrado');
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.recompras);
    expect(n).toBe(0);
  });
});

describe('responsável com UM dependente', () => {
  it('a recompra em nome dele nasce no dependente; lembrete e e-mail falam dele, com o contato do responsável', async () => {
    const dep = await cadastrar('Criança Um');
    const r = await solicitarRecompraManual(novaRecompra({ pacienteId: dep }));
    expect(r.sucesso, r.erro).toBe(true);

    const [rec] = await db.select().from(schema.recompras);
    expect(rec.pacienteId).toBe(dep);
    const [resp] = await db.select().from(schema.users).where(eq(schema.users.clerkId, 'ck_resp'));
    expect(rec.solicitanteId).toBe(resp.id);

    // O lembrete (Inngest) fala do DEPENDENTE e vai para o e-mail do RESPONSÁVEL.
    expect(eventos).toHaveLength(1);
    expect(eventos[0].data.pacienteNome).toBe('Criança Um');
    expect(eventos[0].data.pacienteEmail).toBe('resp@teste.invalid');
  });

  it('o e-mail da equipe leva o nome do dependente, o papel Responsável e NUNCA o endereço técnico', async () => {
    // A equipe precisa existir para haver destinatário.
    await criarUsuario('adm', 'admin');
    const dep = await cadastrar('Criança Um');
    await solicitarRecompraManual(novaRecompra({ pacienteId: dep }));
    expect(emailsDaEquipe).toHaveLength(1);
    const e = emailsDaEquipe[0];
    expect(e.pacienteNome).toBe('Criança Um');
    expect(e.solicitanteRole).toBe('responsavel');
    expect(e.solicitanteNome).toBe('Usuário resp');
    expect(e.pacienteEmail).toBe('resp@teste.invalid');
    expect(JSON.stringify(e)).not.toContain('dependente.invalid');
  });

  it('a ficha, o resumo e as listas dele funcionam; o documento abre pelo vínculo', async () => {
    const dep = await cadastrar('Criança Um');
    const docId = await criarDocumento(dep, 'laudo.pdf');

    const ficha = await obterFichaDoDependente(dep);
    expect(ficha?.nome).toBe('Criança Um');
    expect(ficha?.status).toBe('aguardando_consulta');
    // A ficha lida NÃO traz os campos internos da associação.
    expect(ficha).not.toHaveProperty('valorContribuicao');
    expect(ficha).not.toHaveProperty('termoAssociado');

    const resumo = await resumoDoDependente(dep);
    expect(resumo.totalDocumentos).toBe(1);
    expect(resumo.medicamentoAtivo).toBeNull();
    expect(resumo.proximaConsulta).toBeNull();

    expect((await listarDocumentosDoDependente(dep)).map((d) => d.id)).toEqual([docId]);
    expect(await listarMedicamentosDoDependente(dep)).toEqual([]);
    expect(await listarConsultasDoDependente(dep)).toEqual([]);

    const leitura = await garantirLeitorDoDocumento(docId);
    expect(leitura.ok).toBe(true);
  });
});

describe('responsável com VÁRIOS dependentes: nada se mistura', () => {
  it('cada lista é de UM dependente só', async () => {
    const ana = await cadastrar('Ana');
    const bia = await cadastrar('Bia');
    const caio = await cadastrar('Caio');

    await solicitarRecompraManual(
      novaRecompra({ pacienteId: ana, medicamentoNome: 'Remédio da Ana' }),
    );
    await solicitarRecompraManual(
      novaRecompra({ pacienteId: ana, medicamentoNome: 'Outro da Ana' }),
    );
    await solicitarRecompraManual(
      novaRecompra({ pacienteId: bia, medicamentoNome: 'Remédio da Bia' }),
    );

    const docAna = await criarDocumento(ana, 'ana.pdf');
    const docBia = await criarDocumento(bia, 'bia.pdf');

    expect((await listarRecomprasDoDependente(ana)).map((r) => r.medicamentoNome).sort()).toEqual([
      'Outro da Ana',
      'Remédio da Ana',
    ]);
    expect((await listarRecomprasDoDependente(bia)).map((r) => r.medicamentoNome)).toEqual([
      'Remédio da Bia',
    ]);
    expect(await listarRecomprasDoDependente(caio)).toEqual([]);

    expect((await listarDocumentosDoDependente(ana)).map((d) => d.id)).toEqual([docAna]);
    expect((await listarDocumentosDoDependente(bia)).map((d) => d.id)).toEqual([docBia]);
    expect(await listarDocumentosDoDependente(caio)).toEqual([]);

    expect((await resumoDoDependente(ana)).totalDocumentos).toBe(1);
    expect((await resumoDoDependente(caio)).totalDocumentos).toBe(0);

    expect((await listarDependentesDoResponsavel()).map((d) => d.nome)).toEqual([
      'Ana',
      'Bia',
      'Caio',
    ]);
  });
});

describe('🔴 o `pacienteId` do cliente só vale com vínculo provado (o buraco do Item 83)', () => {
  it('outro responsável, SEM vínculo, recebe a resposta de "não existe", igual a um id que não existe', async () => {
    const dep = await cadastrar('Criança Um');
    entrarComo('outro', 'responsavel');
    const alheio = await solicitarRecompraManual(novaRecompra({ pacienteId: dep }));
    const inexistente = await solicitarRecompraManual(novaRecompra({ pacienteId: 'nao-existe' }));
    expect(alheio).toEqual({ sucesso: false, erro: 'Paciente não encontrado' });
    expect(inexistente).toEqual(alheio);
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.recompras);
    expect(n).toBe(0);
  });

  it('um PACIENTE qualquer mandando o `pacienteId` de outro é recusado', async () => {
    const dep = await cadastrar('Criança Um');
    await criarUsuario('pac', 'paciente');
    entrarComo('pac', 'paciente');
    const r = await solicitarRecompraManual(novaRecompra({ pacienteId: dep }));
    expect(r).toEqual({ sucesso: false, erro: 'Paciente não encontrado' });
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.recompras);
    expect(n).toBe(0);
  });

  it('o vínculo encerrado não pede mais', async () => {
    const dep = await cadastrar('Criança Um');
    await db
      .update(schema.responsaveisPacientes)
      .set({ status: 'encerrado', encerradoEm: new Date() })
      .where(eq(schema.responsaveisPacientes.pacienteId, dep));
    const r = await solicitarRecompraManual(novaRecompra({ pacienteId: dep }));
    expect(r.sucesso).toBe(false);
  });

  it('a EQUIPE continua pedindo para qualquer paciente, como antes', async () => {
    const dep = await cadastrar('Criança Um');
    await criarUsuario('adm', 'admin');
    entrarComo('adm', 'admin');
    const r = await solicitarRecompraManual(novaRecompra({ pacienteId: dep }));
    expect(r.sucesso, r.erro).toBe(true);
    const [rec] = await db.select().from(schema.recompras);
    expect(rec.pacienteId).toBe(dep);
  });
});

describe('o paciente que também é responsável', () => {
  it('as recompras dos dependentes NÃO aparecem na lista dele como paciente, e as dele não na dos dependentes', async () => {
    const [u] = await db
      .insert(schema.users)
      .values({
        clerkId: 'ck_mae',
        email: 'mae@teste.invalid',
        nome: 'Mãe Paciente',
        role: 'paciente',
      })
      .returning({ id: schema.users.id });
    const [fichaDela] = await db
      .insert(schema.pacientes)
      .values({ userId: u.id, status: 'aguardando_consulta', jornadaFase: 'acolhimento' })
      .returning({ id: schema.pacientes.id });

    entrarComo('mae', 'paciente');
    const dep = await cadastrar('Filho da Mãe');
    // Uma recompra PARA O FILHO e uma PARA ELA MESMA.
    await solicitarRecompraManual(novaRecompra({ pacienteId: dep, medicamentoNome: 'Do filho' }));
    await solicitarRecompraManual(novaRecompra({ medicamentoNome: 'Dela' }));

    const minhas = await listarMinhasRecompras();
    expect(minhas.sucesso).toBe(true);
    expect(minhas.dados!.map((r) => r.medicamentoNome)).toEqual(['Dela']);

    expect((await listarRecomprasDoDependente(dep)).map((r) => r.medicamentoNome)).toEqual([
      'Do filho',
    ]);
    expect(await listarRecomprasDoDependente(fichaDela.id)).toHaveLength(1); // a dela, por paciente_id
  });
});

describe('o documento do dependente abre pelo vínculo ativo, e só por ele', () => {
  it('outro responsável, o paciente alheio e o vínculo encerrado recebem 404', async () => {
    const dep = await cadastrar('Criança Um');
    const docId = await criarDocumento(dep, 'laudo.pdf');

    expect((await garantirLeitorDoDocumento(docId)).ok).toBe(true);

    entrarComo('outro', 'responsavel');
    expect(await garantirLeitorDoDocumento(docId)).toMatchObject({ ok: false, status: 404 });

    await criarUsuario('pac', 'paciente');
    entrarComo('pac', 'paciente');
    expect(await garantirLeitorDoDocumento(docId)).toMatchObject({ ok: false, status: 404 });

    entrarComo('resp', 'responsavel');
    await db
      .update(schema.responsaveisPacientes)
      .set({ status: 'encerrado', encerradoEm: new Date() })
      .where(eq(schema.responsaveisPacientes.pacienteId, dep));
    expect(await garantirLeitorDoDocumento(docId)).toMatchObject({ ok: false, status: 404 });
  });
});
