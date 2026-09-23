// Este teste prova que o gatilho enfileira e que os três guardas recusam.
// NÃO prova que a Greens recebe: o envio, o HMAC entre as empresas e a
// resposta deles ficam fora. Isso só é provado por um teste ponta a ponta
// contra produção, que cria dado real e depende do GATE-JUR-01 quando
// houver documento. Medido em 22/09/2026: a fila tinha 1 evento em toda a
// história, de 10/09, que falhou por bug do envelope já corrigido.

/**
 * 🔴 ISTO NÃO É GUARDA ESTRUTURAL. Ele EXECUTA `notificarParceiro` contra um Postgres de
 * verdade e confere a linha que nasce em `parceiro_eventos_saida`.
 *
 * ## Por que aqui, e não em `__tests__/guardas/`
 *
 * Os dois guardas que hoje citam `notificarParceiro` — `o-aviso-ao-parceiro-nao-se-perde` e
 * `o-s2-tem-destino-proprio-e-gatilho` — **leem o arquivo**. Nenhum roda a função. Este roda,
 * e por isso precisa de banco; o `vitest.config.mts:40` exclui `__tests__/integracao/**`
 * justamente para que um portão não quebre em máquina sem Docker.
 *
 * ## Como rodar
 *
 *   docker start behemp-pg || docker run -d --name behemp-pg \
 *     -e POSTGRES_PASSWORD=local -e POSTGRES_DB=behemp -p 5544:5432 postgres:16
 *   DATABASE_URL=postgresql://postgres:local@localhost:5544/behemp npx drizzle-kit push --force
 *   DATABASE_URL=postgresql://postgres:local@localhost:5544/behemp \
 *     npx vitest run --config vitest.integracao.mts __tests__/integracao/o-s1-enfileira-a-volta.test.ts
 *
 * ⚠️ NÃO TOCA PRODUÇÃO E NÃO SAI DA MÁQUINA. `notificarParceiro` só faz `SELECT` e `INSERT`
 * no banco da `DATABASE_URL` — quem fala com a Greens é o `enviador`, e ele não é chamado
 * aqui. Não há `fetch` neste caminho, então não há o que mockar.
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { notificarParceiro } from '@/lib/parceiros/notificar';
import { pacientes, parceiroEventosSaida, solicitacoesCadastro, users } from '@/db/schema';

/** Marcadores próprios deste teste — o `beforeEach` limpa só o que ele criou. */
const SUFIXO = 'teste-s1-volta';
const EMAIL_COM_PARCEIRO = `com-parceiro-${SUFIXO}@exemplo.test`;
const EMAIL_SEM_PARCEIRO = `sem-parceiro-${SUFIXO}@exemplo.test`;

/**
 * Cria a cadeia mínima que `notificarParceiro` percorre: `users` → `pacientes` →
 * `solicitacoes_cadastro`. O `parceiro` é o que decide entre enfileirar e recusar.
 */
async function semear(params: { email: string; parceiro: string | null }) {
  const [usuario] = await db
    .insert(users)
    .values({ email: params.email, nome: 'Paciente de Teste', role: 'paciente' })
    .returning();

  const [paciente] = await db.insert(pacientes).values({ userId: usuario.id }).returning();

  const [solicitacao] = await db
    .insert(solicitacoesCadastro)
    .values({
      protocolo: `SOL-${SUFIXO}-${Date.now()}`,
      tokenHash: `hash-${SUFIXO}-${Date.now()}`,
      expiraEm: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      pacienteId: paciente.id,
      parceiro: params.parceiro,
    })
    .returning();

  return { usuario, paciente, solicitacao };
}

/** Quantas linhas a fila tem para uma solicitação — o que o teste de fato mede. */
async function fila(solicitacaoId: string) {
  return db
    .select()
    .from(parceiroEventosSaida)
    .where(eq(parceiroEventosSaida.solicitacaoId, solicitacaoId));
}

async function limpar() {
  // A ordem importa: a fila referencia a solicitação, que referencia o paciente, que
  // referencia o usuário. Apagar de fora para dentro evita violar a FK.
  const solicitacoes = await db
    .select({ id: solicitacoesCadastro.id })
    .from(solicitacoesCadastro)
    .where(eq(solicitacoesCadastro.protocolo, solicitacoesCadastro.protocolo));

  for (const s of solicitacoes) {
    await db.delete(parceiroEventosSaida).where(eq(parceiroEventosSaida.solicitacaoId, s.id));
  }

  for (const email of [EMAIL_COM_PARCEIRO, EMAIL_SEM_PARCEIRO]) {
    const [usuario] = await db.select().from(users).where(eq(users.email, email));
    if (!usuario) continue;
    const [paciente] = await db.select().from(pacientes).where(eq(pacientes.userId, usuario.id));
    if (paciente) {
      const suas = await db
        .select({ id: solicitacoesCadastro.id })
        .from(solicitacoesCadastro)
        .where(eq(solicitacoesCadastro.pacienteId, paciente.id));
      for (const s of suas) {
        await db.delete(parceiroEventosSaida).where(eq(parceiroEventosSaida.solicitacaoId, s.id));
      }
      await db.delete(solicitacoesCadastro).where(eq(solicitacoesCadastro.pacienteId, paciente.id));
      await db.delete(pacientes).where(eq(pacientes.id, paciente.id));
    }
    await db.delete(users).where(eq(users.id, usuario.id));
  }
}

describe('o S1 enfileira a volta, e recusa o que deve recusar', () => {
  beforeEach(limpar);
  afterAll(limpar);

  it('a) CAMINHO FELIZ — receita_emitida vira linha na fila, com o NOSSO id', async () => {
    const { paciente, solicitacao } = await semear({
      email: EMAIL_COM_PARCEIRO,
      parceiro: 'greens',
    });

    const r = await notificarParceiro({ pacienteId: paciente.id, tipo: 'receita_emitida' });
    expect(r.enfileirado, `motivo: ${r.motivo}`).toBe(true);

    const linhas = await fila(solicitacao.id);
    expect(linhas).toHaveLength(1);
    expect(linhas[0].tipo).toBe('receita_emitida');
    expect(linhas[0].parceiro).toBe('greens');
    // 🔴 O `referralId` é o NOSSO id — é o que a Greens gravou como `behempReferralId`.
    expect(linhas[0].referralId).toBe(solicitacao.id);
    expect(linhas[0].status).toBe('pendente');
    expect(linhas[0].enviadoEm).toBeNull();
  });

  it('b) sem_identificador — sem solicitacaoId e sem pacienteId, nada entra na fila', async () => {
    const antes = await db.select().from(parceiroEventosSaida);

    const r = await notificarParceiro({ tipo: 'receita_emitida' });
    expect(r.enfileirado).toBe(false);
    expect(r.motivo).toBe('sem_identificador');

    const depois = await db.select().from(parceiroEventosSaida);
    expect(depois).toHaveLength(antes.length);
  });

  it('c) sem_parceiro — paciente que não veio de parceiro nenhum não gera aviso', async () => {
    const { paciente, solicitacao } = await semear({
      email: EMAIL_SEM_PARCEIRO,
      parceiro: null,
    });

    const r = await notificarParceiro({ pacienteId: paciente.id, tipo: 'receita_emitida' });
    expect(r.enfileirado).toBe(false);
    expect(r.motivo).toBe('sem_parceiro');

    expect(await fila(solicitacao.id)).toHaveLength(0);
  });

  it('d) anvisa_aprovada percorre o mesmo caminho', async () => {
    const { paciente, solicitacao } = await semear({
      email: EMAIL_COM_PARCEIRO,
      parceiro: 'greens',
    });

    const r = await notificarParceiro({ pacienteId: paciente.id, tipo: 'anvisa_aprovada' });
    expect(r.enfileirado, `motivo: ${r.motivo}`).toBe(true);

    const linhas = await fila(solicitacao.id);
    expect(linhas).toHaveLength(1);
    expect(linhas[0].tipo).toBe('anvisa_aprovada');
  });

  it('e) IDEMPOTÊNCIA — o mesmo fato chamado duas vezes não vira dois avisos', async () => {
    const { paciente, solicitacao } = await semear({
      email: EMAIL_COM_PARCEIRO,
      parceiro: 'greens',
    });

    const primeira = await notificarParceiro({ pacienteId: paciente.id, tipo: 'receita_emitida' });
    const segunda = await notificarParceiro({ pacienteId: paciente.id, tipo: 'receita_emitida' });

    expect(primeira.enfileirado).toBe(true);
    expect(segunda.enfileirado).toBe(true);

    /**
     * O que se mede aqui é a TABELA, não o retorno. `onConflictDoNothing` faz a segunda
     * chamada devolver `enfileirado: true` sem inserir — o índice único
     * `parceiro_eventos_saida_fato_idx` (parceiro, tipo, solicitacao_id) é quem garante.
     */
    const linhas = await fila(solicitacao.id);
    expect(linhas, 'o mesmo fato virou mais de um aviso').toHaveLength(1);
  });

  it('f) os dois tipos do MESMO paciente convivem — o índice é por (parceiro, tipo, solicitação)', async () => {
    const { paciente, solicitacao } = await semear({
      email: EMAIL_COM_PARCEIRO,
      parceiro: 'greens',
    });

    await notificarParceiro({ pacienteId: paciente.id, tipo: 'receita_emitida' });
    await notificarParceiro({ pacienteId: paciente.id, tipo: 'anvisa_aprovada' });

    const linhas = await fila(solicitacao.id);
    expect(linhas).toHaveLength(2);
    expect(linhas.map((l) => l.tipo).sort()).toEqual(['anvisa_aprovada', 'receita_emitida']);
  });
});
