/**
 * A chamada de atendimento com suporte, EXECUTADA contra um Postgres de verdade — ADR-0029 §10.
 *
 * Roda as actions e as ROTAS (entrar, mensagem, print, encerrar, sinalizar, TURN, canal Pusher e a
 * entrega do print) e olha o banco e os eventos. Os duplos são só do que é externo: o Clerk (quem
 * está logado), o Pusher (os eventos são CAPTURADOS, para provar o que sairia) e o store privado
 * (esta máquina não tem a chave do Blob).
 *
 * ## O que ele prova
 *
 *   1. só duas pessoas: o paciente DONO do pedido e o admin. Outro paciente recebe o mesmo "não
 *      encontrado" de um pedido inexistente, em todas as portas
 *   2. paciente e admin entrando juntos caem na MESMA sala; a sala tem 32 hex do gerador cripto
 *   3. o print só aceita imagem de verdade (PNG/JPEG/WebP pela assinatura, até 8 MB), vai ao store
 *      privado, e a URL do blob NUNCA sai — nem na resposta, nem no evento do Pusher
 *   4. ver o print: participante vê, e fica auditado; quem não é recebe 404
 *   5. o admin encerra, o paciente não; encerrada, a sala recusa mensagem e sinalização, mas o
 *      print continua legível para quem estava lá
 *   6. a resposta da ANVISA fecha o pedido E a chamada aberta dele
 *
 * Rodar: como os outros de `__tests__/integracao` (ver `vitest.integracao.mts`).
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';

const sessao = { clerkId: null as string | null, role: 'paciente' as string };
const eventos: { canal: string; evento: string; dados: unknown }[] = [];
const guardados = new Map<string, Uint8Array>();

vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({
    userId: sessao.clerkId,
    sessionClaims: { metadata: { role: sessao.role } },
  }),
  currentUser: async () => ({ id: sessao.clerkId }),
  clerkClient: async () => ({ users: {} }),
}));
vi.mock('next/cache', () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock('next/headers', () => ({
  headers: async () => new Map<string, string>() as unknown as Headers,
}));
vi.mock('@/lib/integrations/pusher/server', async (original) => ({
  ...(await original<typeof import('@/lib/integrations/pusher/server')>()),
  getPusherServer: () => ({
    trigger: async (canal: string, evento: string, dados: unknown) => {
      eventos.push({ canal, evento, dados });
    },
  }),
  autenticarCanal: (_s: string, canal: string, presenca?: unknown) => ({
    auth: 'teste',
    canal,
    presenca,
  }),
}));
vi.mock('@/lib/documentos/store-privado', async (original) => ({
  ...(await original<typeof import('@/lib/documentos/store-privado')>()),
  guardarDocumentoPrivado: async (caminho: string, corpo: Uint8Array) => {
    const url = `https://teste.private.blob.vercel-storage.com/${caminho}`;
    guardados.set(url, corpo);
    return { url, pathname: caminho };
  },
  lerDocumentoPrivado: async (url: string) => {
    const b = guardados.get(url);
    return b ? { stream: new Blob([b as BlobPart]).stream(), contentType: 'image/png' } : null;
  },
}));

const { db } = await import('@/lib/db');
const schema = await import('@/db/schema');
const chamada = await import('@/app/_actions/chamada-de-atendimento');
const { encerrarPedidoDaAutorizacao } = await import('@/lib/anvisa/encerrar-pedido-de-atendimento');
const rotaSinalizar = await import('@/app/api/atendimento/sinalizar/route');
const rotaIce = await import('@/app/api/atendimento/ice-servers/route');
const rotaPrint = await import('@/app/api/atendimento/print/[mensagemId]/route');
const rotaPusher = await import('@/app/api/pusher/auth/route');

const como = (clerkId: string, role: string) => {
  sessao.clerkId = clerkId;
  sessao.role = role;
};

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);

let pedidoId = '';

async function limpar() {
  await db.delete(schema.logsAuditoria);
  await db.delete(schema.mensagensDeAtendimento);
  await db.delete(schema.chamadasDeAtendimento);
  await db.delete(schema.pedidosAtendimentoAssistido);
  await db.delete(schema.autorizacoesAnvisa);
  await db.delete(schema.pacientes);
  await db.delete(schema.users);
}

beforeEach(async () => {
  await limpar();
  eventos.length = 0;
  guardados.clear();
  const [ua, ub] = await db
    .insert(schema.users)
    .values([
      { clerkId: 'ck_a', email: 'a@teste.invalid', nome: 'Paciente A', role: 'paciente' },
      { clerkId: 'ck_b', email: 'b@teste.invalid', nome: 'Paciente B', role: 'paciente' },
      { clerkId: 'ck_adm', email: 'adm@teste.invalid', nome: 'Admin', role: 'admin' },
      { clerkId: 'ck_med', email: 'med@teste.invalid', nome: 'Médico', role: 'medico' },
    ])
    .returning({ id: schema.users.id });
  const [pa] = await db
    .insert(schema.pacientes)
    .values([{ userId: ua.id }, { userId: ub.id }])
    .returning({ id: schema.pacientes.id });
  await db.insert(schema.autorizacoesAnvisa).values({ id: 'aut_a', pacienteId: pa.id });
  const [p] = await db
    .insert(schema.pedidosAtendimentoAssistido)
    .values({ autorizacaoId: 'aut_a', pacienteId: pa.id })
    .returning({ id: schema.pedidosAtendimentoAssistido.id });
  pedidoId = p.id;
});
afterAll(limpar);

async function entrarComo(clerkId: string, role: string) {
  como(clerkId, role);
  return chamada.entrarNoAtendimento({ pedidoId });
}

const pedir = (url: string, init?: RequestInit) =>
  new Request(`http://teste.local${url}`, init) as never;

describe('só duas pessoas entram', () => {
  it('o paciente dono e o admin caem na MESMA sala, de 32 hex', async () => {
    const p = await entrarComo('ck_a', 'paciente');
    const a = await entrarComo('ck_adm', 'admin');
    expect(p).toMatchObject({ sucesso: true, dados: { papel: 'paciente' } });
    expect(a).toMatchObject({ sucesso: true, dados: { papel: 'admin' } });
    expect(p.dados?.sala).toMatch(/^[a-f0-9]{32}$/);
    expect(a.dados?.sala).toBe(p.dados?.sala);
  });

  it('entrando os dois ao mesmo tempo, abre UMA chamada só', async () => {
    const [p, a] = await Promise.all([
      entrarComo('ck_a', 'paciente'),
      entrarComo('ck_adm', 'admin'),
    ]);
    expect(p.sucesso && a.sucesso).toBe(true);
    const abertas = await db.select().from(schema.chamadasDeAtendimento);
    expect(abertas).toHaveLength(1);
  });

  /**
   * ⚠️ O caso acima NÃO cria corrida: a sabotagem que tirou o tratamento do 23505 sobreviveu a ele
   * (30/09/2026), porque as duas entradas acabavam em série. Este força: outra transação ocupa a
   * vaga do índice "uma aberta por pedido" sem confirmar; a action não a vê, esbarra no índice ao
   * inserir e espera; a outra confirma, e a action recebe o 23505 — e tem de cair na sala que venceu.
   */
  it('a corrida forçada: quem perde para o índice entra na sala que venceu', async () => {
    const [adm] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.clerkId, 'ck_adm'));
    const { Client } = await import('pg');
    const outra = new Client({ connectionString: process.env.DATABASE_URL });
    await outra.connect();
    const salaQueVenceu = 'f'.repeat(32);
    try {
      await outra.query('begin');
      await outra.query(
        'insert into chamadas_de_atendimento (id, pedido_id, sala, aberta_por) values ($1, $2, $3, $4)',
        ['chamada_venceu', pedidoId, salaQueVenceu, adm.id],
      );
      const emCurso = entrarComo('ck_a', 'paciente');
      await new Promise((r) => setTimeout(r, 400));
      await outra.query('commit');
      expect(await emCurso).toMatchObject({ sucesso: true, dados: { sala: salaQueVenceu } });
    } finally {
      await outra.end();
    }
    expect(await db.select().from(schema.chamadasDeAtendimento)).toHaveLength(1);
  });

  it('outro paciente e um médico recebem "não encontrado", como pedido que não existe', async () => {
    const outro = await entrarComo('ck_b', 'paciente');
    const medico = await entrarComo('ck_med', 'medico');
    como('ck_a', 'paciente');
    const inexistente = await chamada.entrarNoAtendimento({ pedidoId: 'nao-existe' });
    expect(outro).toEqual({ sucesso: false, erro: 'Atendimento não encontrado' });
    expect(medico).toEqual(outro);
    expect(inexistente).toEqual(outro);
    expect(await db.select().from(schema.chamadasDeAtendimento)).toHaveLength(0);
  });

  it('pedido encerrado não abre chamada', async () => {
    await encerrarPedidoDaAutorizacao('aut_a', 'concluido');
    const r = await entrarComo('ck_a', 'paciente');
    expect(r.sucesso).toBe(false);
    expect(await db.select().from(schema.chamadasDeAtendimento)).toHaveLength(0);
  });

  it('entrar fica auditado com o papel', async () => {
    await entrarComo('ck_a', 'paciente');
    const logs = await db
      .select()
      .from(schema.logsAuditoria)
      .where(eq(schema.logsAuditoria.acao, 'ENTRAR_ATENDIMENTO'));
    expect(logs).toHaveLength(1);
    expect(logs[0].dadosDepois).toMatchObject({ papel: 'paciente' });
  });
});

describe('paciente arquivado (PR #140, soft delete)', () => {
  it('ninguém abre nem continua o atendimento de paciente arquivado; o print segue legível', async () => {
    const { dados } = await entrarComo('ck_a', 'paciente');
    const form = new FormData();
    form.set('sala', dados!.sala);
    form.set('arquivo', new File([PNG], 'tela.png', { type: 'image/png' }));
    const { dados: m } = await chamada.enviarPrintNoAtendimento(form);

    const [ua] = await db.select().from(schema.users).where(eq(schema.users.clerkId, 'ck_a'));
    await db
      .update(schema.pacientes)
      .set({ deletedAt: new Date() })
      .where(eq(schema.pacientes.userId, ua.id));

    const admin = await entrarComo('ck_adm', 'admin');
    expect(admin).toEqual({ sucesso: false, erro: 'Este paciente foi arquivado.' });
    expect(
      (await chamada.enviarMensagemNoAtendimento({ sala: dados!.sala, texto: 'oi' })).sucesso,
    ).toBe(false);
    const ver = await rotaPrint.GET(pedir(`/api/atendimento/print/${m!.id}`), {
      params: Promise.resolve({ mensagemId: m!.id }),
    });
    expect(ver.status).toBe(200);
  });
});

describe('o chat e o print', () => {
  it('mensagem de participante vira linha e evento, com o PAPEL e sem ids', async () => {
    const { dados } = await entrarComo('ck_a', 'paciente');
    const r = await chamada.enviarMensagemNoAtendimento({
      sala: dados!.sala,
      texto: 'Oi, travei no passo 5',
    });
    expect(r).toMatchObject({
      sucesso: true,
      dados: { autor: 'paciente', texto: 'Oi, travei no passo 5' },
    });
    const ev = eventos.find((e) => e.evento === 'chat:mensagem');
    expect(ev?.canal).toBe(`presence-atendimento-${dados!.sala}`);
    expect(JSON.stringify(ev?.dados)).not.toMatch(/autorId|userId|ck_a/);
  });

  it('quem não é da chamada não manda mensagem', async () => {
    const { dados } = await entrarComo('ck_a', 'paciente');
    como('ck_b', 'paciente');
    expect(
      (await chamada.enviarMensagemNoAtendimento({ sala: dados!.sala, texto: 'intruso' })).sucesso,
    ).toBe(false);
    expect(await db.select().from(schema.mensagensDeAtendimento)).toHaveLength(0);
  });

  it.each<[string, string, Uint8Array]>([
    ['GIF não é aceito', 'image/gif', new Uint8Array([0x47, 0x49, 0x46, 0x38])],
    ['"PNG" que não começa como PNG é recusado', 'image/png', new Uint8Array([1, 2, 3, 4, 5, 6])],
    ['PDF não é print', 'application/pdf', new Uint8Array([0x25, 0x50, 0x44, 0x46])],
  ])('print: %s', async (_nome, tipo, bytes) => {
    const { dados } = await entrarComo('ck_a', 'paciente');
    const form = new FormData();
    form.set('sala', dados!.sala);
    form.set('arquivo', new File([bytes as BlobPart], 'x', { type: tipo }));
    expect((await chamada.enviarPrintNoAtendimento(form)).sucesso).toBe(false);
    expect(guardados.size).toBe(0);
  });

  it('print maior que 8 MB é recusado antes de subir', async () => {
    const { dados } = await entrarComo('ck_a', 'paciente');
    const grande = new Uint8Array(8 * 1024 * 1024 + 1);
    grande.set(PNG);
    const form = new FormData();
    form.set('sala', dados!.sala);
    form.set('arquivo', new File([grande], 'x.png', { type: 'image/png' }));
    expect((await chamada.enviarPrintNoAtendimento(form)).sucesso).toBe(false);
    expect(guardados.size).toBe(0);
  });

  it('print válido vai ao store PRIVADO, e a URL nunca sai: nem na resposta, nem no evento', async () => {
    const { dados } = await entrarComo('ck_a', 'paciente');
    const form = new FormData();
    form.set('sala', dados!.sala);
    form.set('arquivo', new File([PNG], 'tela.png', { type: 'image/png' }));
    const r = await chamada.enviarPrintNoAtendimento(form);
    expect(r).toMatchObject({ sucesso: true, dados: { temPrint: true } });
    const [linha] = await db.select().from(schema.mensagensDeAtendimento);
    expect(linha.printUrl).toMatch(/\.private\.blob\.vercel-storage\.com\//);
    expect(JSON.stringify(r)).not.toMatch(/blob\.vercel-storage/);
    expect(JSON.stringify(eventos)).not.toMatch(/blob\.vercel-storage/);
  });

  it('ver o print: participante vê e fica auditado; quem não é recebe 404', async () => {
    const { dados } = await entrarComo('ck_a', 'paciente');
    const form = new FormData();
    form.set('sala', dados!.sala);
    form.set('arquivo', new File([PNG], 'tela.png', { type: 'image/png' }));
    const { dados: m } = await chamada.enviarPrintNoAtendimento(form);
    const ver = () =>
      rotaPrint.GET(pedir(`/api/atendimento/print/${m!.id}`), {
        params: Promise.resolve({ mensagemId: m!.id }),
      });

    como('ck_adm', 'admin');
    const r = await ver();
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toBe('private, no-store');
    const vistos = await db
      .select()
      .from(schema.logsAuditoria)
      .where(eq(schema.logsAuditoria.acao, 'visualizar'));
    expect(vistos.map((v) => v.entidadeId)).toContain(m!.id);

    como('ck_b', 'paciente');
    expect((await ver()).status).toBe(404);
    const inexistente = await rotaPrint.GET(pedir('/api/atendimento/print/naoexiste123'), {
      params: Promise.resolve({ mensagemId: 'naoexiste123' }),
    });
    expect(inexistente.status).toBe(404);
  });
});

describe('as mensagens mais recentes', () => {
  it('com mais de 200, entrar de novo traz as ÚLTIMAS 200, em ordem de conversa', async () => {
    const { dados } = await entrarComo('ck_a', 'paciente');
    const [c] = await db.select().from(schema.chamadasDeAtendimento);
    const [ua] = await db.select().from(schema.users).where(eq(schema.users.clerkId, 'ck_a'));
    const base = Date.now() - 300_000;
    await db.insert(schema.mensagensDeAtendimento).values(
      Array.from({ length: 205 }, (_, i) => ({
        chamadaId: c.id,
        autorId: ua.id,
        texto: `m${i}`,
        createdAt: new Date(base + i * 1000),
      })),
    );
    const r = await entrarComo('ck_a', 'paciente');
    const textos = r.dados!.mensagens.map((m) => m.texto);
    expect(textos).toHaveLength(200);
    expect(textos[0]).toBe('m5');
    expect(textos.at(-1)).toBe('m204');
    expect(dados!.sala).toBe(r.dados!.sala);
  });
});

describe('as rotas da chamada', () => {
  it('sinalizar: participante dispara no canal da sala; quem não é recebe 404', async () => {
    const { dados } = await entrarComo('ck_a', 'paciente');
    const corpo = JSON.stringify({ sala: dados!.sala, tipo: 'offer', payload: { sdp: 'x' } });
    const ok = await rotaSinalizar.POST(
      pedir('/api/atendimento/sinalizar', { method: 'POST', body: corpo }),
    );
    expect(ok.status).toBe(200);
    expect(
      eventos.some(
        (e) => e.evento === 'webrtc:offer' && e.canal === `presence-atendimento-${dados!.sala}`,
      ),
    ).toBe(true);

    como('ck_b', 'paciente');
    const fora = await rotaSinalizar.POST(
      pedir('/api/atendimento/sinalizar', { method: 'POST', body: corpo }),
    );
    expect(fora.status).toBe(404);
  });

  it('sinalizar: sala fora do formato é recusada antes do banco', async () => {
    como('ck_a', 'paciente');
    const corpo = JSON.stringify({ sala: 'abc', tipo: 'offer', payload: {} });
    expect(
      (
        await rotaSinalizar.POST(
          pedir('/api/atendimento/sinalizar', { method: 'POST', body: corpo }),
        )
      ).status,
    ).toBe(400);
  });

  it('TURN: participante recebe a lista; quem não é recebe 404', async () => {
    const { dados } = await entrarComo('ck_a', 'paciente');
    const pedirIce = () =>
      rotaIce.GET({
        nextUrl: new URL(`http://t/api/atendimento/ice-servers?sala=${dados!.sala}`),
        headers: new Headers(),
      } as never);
    const ok = await pedirIce();
    expect(ok.status).toBe(200);
    expect(await ok.json()).toHaveProperty('iceServers');
    como('ck_b', 'paciente');
    expect((await pedirIce()).status).toBe(404);
  });

  it('canal Pusher: participante assina com o papel, sem nome nem e-mail; quem não é, não', async () => {
    const { dados } = await entrarComo('ck_a', 'paciente');
    const assinar = () => {
      const f = new FormData();
      f.set('socket_id', '123.456');
      f.set('channel_name', `presence-atendimento-${dados!.sala}`);
      return rotaPusher.POST(pedir('/api/pusher/auth', { method: 'POST', body: f }));
    };
    const ok = await assinar();
    expect(ok.status).toBe(200);
    const corpo = JSON.stringify(await ok.json());
    expect(corpo).toMatch(/"papel":"paciente"/);
    expect(corpo).not.toMatch(/teste\.invalid|Paciente A/);
    // O id interno não vai ao canal: o user_id é opaco (revisão de 30/09/2026).
    const [ua] = await db.select().from(schema.users).where(eq(schema.users.clerkId, 'ck_a'));
    expect(corpo).not.toContain(ua.id);
    como('ck_b', 'paciente');
    expect((await assinar()).status).toBe(404);
  });
});

describe('encerrar', () => {
  it('só o admin encerra; encerrada, a sala recusa mensagem e sinalização, e o print segue legível', async () => {
    const { dados } = await entrarComo('ck_a', 'paciente');
    const form = new FormData();
    form.set('sala', dados!.sala);
    form.set('arquivo', new File([PNG], 'tela.png', { type: 'image/png' }));
    const { dados: m } = await chamada.enviarPrintNoAtendimento(form);

    expect((await chamada.encerrarAtendimento({ sala: dados!.sala })).sucesso).toBe(false);
    como('ck_adm', 'admin');
    expect((await chamada.encerrarAtendimento({ sala: dados!.sala })).sucesso).toBe(true);
    expect(eventos.some((e) => e.evento === 'chamada:encerrada')).toBe(true);
    expect((await chamada.encerrarAtendimento({ sala: dados!.sala })).sucesso).toBe(false);

    como('ck_a', 'paciente');
    expect(
      (await chamada.enviarMensagemNoAtendimento({ sala: dados!.sala, texto: 'depois' })).sucesso,
    ).toBe(false);
    const corpo = JSON.stringify({ sala: dados!.sala, tipo: 'offer', payload: {} });
    expect(
      (
        await rotaSinalizar.POST(
          pedir('/api/atendimento/sinalizar', { method: 'POST', body: corpo }),
        )
      ).status,
    ).toBe(409);
    const ver = await rotaPrint.GET(pedir(`/api/atendimento/print/${m!.id}`), {
      params: Promise.resolve({ mensagemId: m!.id }),
    });
    expect(ver.status).toBe(200);
  });

  it('a resposta da ANVISA fecha o pedido e a chamada aberta dele', async () => {
    const { dados } = await entrarComo('ck_a', 'paciente');
    await encerrarPedidoDaAutorizacao('aut_a', 'rejeitado_anvisa');
    // E avisa as telas: fechar só no banco deixava a voz seguindo (revisão de 30/09/2026).
    expect(
      eventos.some(
        (e) =>
          e.evento === 'chamada:encerrada' && e.canal === `presence-atendimento-${dados!.sala}`,
      ),
    ).toBe(true);
    const [c] = await db
      .select()
      .from(schema.chamadasDeAtendimento)
      .where(eq(schema.chamadasDeAtendimento.sala, dados!.sala));
    expect(c.encerradaEm).toBeInstanceOf(Date);
  });
});
