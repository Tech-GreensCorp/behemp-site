/**
 * INTEGRAÇÃO — a conferência de identidade da etapa 1, EXECUTADA contra um Postgres real.
 *
 * ADR-0028 · Item 50. O guarda estrutural prova que o código está escrito; este prova que a
 * CONSULTA roda e responde certo com o dado sujo que o banco de verdade tem: CPF com e sem
 * pontuação (Item 52), telefone em quatro formatos (Item 26), e-mail com maiúsculas, linha
 * apagada, e `users` sem conta de acesso criado pelo admin.
 *
 * Um cenário por classe de defeito e um CONTROLE limpo — sem o controle, verde não diz nada.
 * Dados sintéticos: CPFs de teste com dígito verificador válido, e-mails em `exemplo.invalid`.
 *
 * Rodar (ver `vitest.integracao.mts`):
 *   DATABASE_URL=postgresql://postgres:local@localhost:5544/behemp \
 *     npx vitest run --config vitest.integracao.mts __tests__/integracao/a-identidade-e-conferida-na-etapa-1.test.ts
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const sessao = { clerkId: null as string | null, email: '' };
const rede = { ip: '10.0.0.1' };

vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: sessao.clerkId }),
  currentUser: async () =>
    sessao.clerkId
      ? {
          id: sessao.clerkId,
          emailAddresses: [{ emailAddress: sessao.email, verification: { status: 'verified' } }],
        }
      : null,
}));
vi.mock('next/cache', () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
// Fora do Next não há request: o limite e a auditoria leem o IP daqui.
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': rede.ip }),
}));

const { db } = await import('@/lib/db');
const schema = await import('@/db/schema');
const { eq } = await import('drizzle-orm');
const { conferirIdentidade, buscarAchados } = await import('@/lib/cadastro/conferir-identidade');
const {
  TEXTO_DE_MUITAS_TENTATIVAS,
  TEXTO_DO_SUPORTE,
  TEXTO_DO_TELEFONE_EM_USO,
  LIMITE_POR_SOLICITACAO,
} = await import('@/lib/cadastro/veredito-de-identidade');
const { conferirIdentidadeNaEtapa1 } = await import('@/app/_actions/identidade-no-cadastro');
const { concluirCadastroPorLink } = await import('@/app/_actions/cadastro-por-link');
const { gerarToken } = await import('@/lib/chatpro/solicitacao');
const { reconciliarPelaSessao } = await import('@/lib/fluxo/reconciliar');

const CPF = '52998224725';
const CPF_FORMATADO = '529.982.247-25';
const OUTRO_CPF = '11144477735';

async function limpar() {
  await db.delete(schema.logsAuditoria);
  await db.delete(schema.documentos);
  await db.delete(schema.consentimentos);
  await db.delete(schema.pacientes);
  await db.delete(schema.solicitacoesCadastro);
  await db.delete(schema.users);
}

let seq = 0;
async function pessoa(p: {
  email: string;
  clerkId?: string | null;
  telefone?: string | null;
  cpf?: string | null;
  apagada?: 'users' | 'pacientes';
}) {
  const [u] = await db
    .insert(schema.users)
    .values({
      email: p.email,
      nome: 'Pessoa de Teste',
      telefone: p.telefone ?? null,
      clerkId: p.clerkId === undefined ? `user_teste_${++seq}` : p.clerkId,
      deletedAt: p.apagada === 'users' ? new Date() : null,
    })
    .returning();
  if (p.cpf !== undefined) {
    await db.insert(schema.pacientes).values({
      userId: u.id,
      cpf: p.cpf,
      deletedAt: p.apagada === 'pacientes' ? new Date() : null,
    });
  }
  return u;
}

async function solicitacao(dados: { email?: string; cpf?: string | null; telefone?: string }) {
  const { token, hash } = gerarToken();
  const [s] = await db
    .insert(schema.solicitacoesCadastro)
    .values({
      protocolo: `SOL-T${String(++seq).padStart(5, '0')}`,
      tokenHash: hash,
      expiraEm: new Date(Date.now() + 24 * 60 * 60 * 1000),
      nomeCompleto: 'Pessoa do Link',
      email: dados.email ?? 'link@exemplo.invalid',
      telefone: dados.telefone ?? '5511900000000',
      cpf: dados.cpf ?? null,
      origem: 'greens_handoff',
    })
    .returning();
  return { token, id: s.id, protocolo: s.protocolo };
}

/** Por padrão o e-mail do link é o digitado — o caso comum. `emailDoLink` separa os dois. */
const conferir = (
  entrada: { cpf?: string; email?: string; telefone?: string },
  emailDoLink: string | undefined = entrada.email,
) =>
  conferirIdentidade({
    entrada,
    emailDoLink,
    sessao: {
      clerkId: sessao.clerkId,
      emailDaSessao: sessao.email,
      emailsDoCadastro: [entrada.email],
    },
  });

beforeEach(async () => {
  await limpar();
  sessao.clerkId = null;
  sessao.email = '';
  rede.ip = `10.0.${Math.floor(Math.random() * 250)}.${++seq % 250}`;
});

afterAll(limpar);

describe('a consulta, contra o banco de verdade', () => {
  it('✅ CONTROLE: banco com outras pessoas e nenhum dado em comum → livre', async () => {
    await pessoa({ email: 'alguem@exemplo.invalid', telefone: '+5521999990000', cpf: OUTRO_CPF });
    expect(
      await conferir({ cpf: CPF, email: 'nova@exemplo.invalid', telefone: '(11) 98765-4321' }),
    ).toBe('livre');
  });

  it('🔴 CPF gravado FORMATADO numa ficha de outra conta casa com o CPF só com dígitos', async () => {
    await pessoa({ email: 'outra@exemplo.invalid', cpf: CPF_FORMATADO });
    expect(await conferir({ cpf: CPF, email: 'nova@exemplo.invalid' })).toBe('cpf_em_outra_conta');
  });

  it('🔴 o MESMO CPF na conta do MESMO e-mail é a pessoa voltando → login, não suporte', async () => {
    await pessoa({ email: 'volta@exemplo.invalid', cpf: CPF });
    expect(await conferir({ cpf: CPF, email: 'volta@exemplo.invalid' })).toBe('conta_pelo_email');
  });

  it('🔴 e-mail gravado com MAIÚSCULAS casa (o unique do banco diferencia caixa)', async () => {
    await pessoa({ email: 'Fulano.Caixa@Exemplo.invalid' });
    expect(await conferir({ email: 'fulano.caixa@exemplo.invalid' })).toBe('conta_pelo_email');
  });

  it('🔴 `users` SEM `clerkId` (criado pelo admin) não manda ao login — não há conta para entrar', async () => {
    await pessoa({ email: 'sem.acesso@exemplo.invalid', clerkId: null, cpf: CPF });
    expect(await conferir({ cpf: CPF, email: 'sem.acesso@exemplo.invalid' })).toBe('livre');
  });

  it('⚠️ ficha APAGADA não conta', async () => {
    await pessoa({ email: 'apagada@exemplo.invalid', cpf: CPF, apagada: 'pacientes' });
    expect(await conferir({ cpf: CPF, email: 'nova@exemplo.invalid' })).toBe('livre');
  });

  it('⚠️ usuário APAGADO não conta, nem pelo CPF nem pelo e-mail', async () => {
    await pessoa({ email: 'removido@exemplo.invalid', cpf: CPF, apagada: 'users' });
    expect(await conferir({ cpf: CPF, email: 'removido@exemplo.invalid' })).toBe('livre');
  });

  it.each(['+5511987654321', '5511987654321', '11987654321', '(11) 98765-4321'])(
    '🔴 telefone gravado como %s casa com o digitado — os quatro formatos do Item 26',
    async (gravado) => {
      await pessoa({ email: 'dono.do.fone@exemplo.invalid', telefone: gravado });
      expect(await conferir({ email: 'nova@exemplo.invalid', telefone: '(11) 98765-4321' })).toBe(
        'telefone_conhecido',
      );
    },
  );

  it('🔴 fixo gravado com DDI NÃO colide com o celular de outro DDD (achado ao escrever o guarda)', async () => {
    // `551933334444` → "últimos 11" daria `51933334444`, que é o celular (51) 93333-4444.
    await pessoa({ email: 'fixo@exemplo.invalid', telefone: '551933334444' });
    expect(await conferir({ email: 'nova@exemplo.invalid', telefone: '(51) 93333-4444' })).toBe(
      'livre',
    );
  });

  it('🔴 logada na PRÓPRIA conta, com o próprio CPF → segue', async () => {
    const u = await pessoa({ email: 'logada@exemplo.invalid', cpf: CPF });
    sessao.clerkId = u.clerkId;
    sessao.email = 'logada@exemplo.invalid';
    expect(await conferir({ cpf: CPF, email: 'logada@exemplo.invalid' })).toBe('sessao_propria');
  });

  it('🔴 logada em OUTRA conta → "é você?" antes de qualquer coisa', async () => {
    const u = await pessoa({ email: 'dona.da.sessao@exemplo.invalid' });
    sessao.clerkId = u.clerkId;
    sessao.email = 'dona.da.sessao@exemplo.invalid';
    expect(await conferir({ cpf: CPF, email: 'link@exemplo.invalid' })).toBe('sessao_alheia');
  });

  it('🔴 o e-mail DIGITADO não torna o CPF "da pessoa" — o oráculo e-mail ↔ CPF está fechado', async () => {
    // A conta de E tem o CPF C. Quem abre um link de OUTRO e-mail e digita E + C não descobre
    // que C é de E: a resposta é a mesma que para qualquer CPF em outra conta.
    await pessoa({ email: 'e.alvo@exemplo.invalid', cpf: CPF });
    expect(
      await conferir({ cpf: CPF, email: 'e.alvo@exemplo.invalid' }, 'link@exemplo.invalid'),
    ).toBe('cpf_em_outra_conta');
  });

  it('🔴 logada na PRÓPRIA conta, o telefone de outra conta trava já na etapa 1', async () => {
    await pessoa({ email: 'dona.do.fone@exemplo.invalid', telefone: '+5511987654321' });
    const u = await pessoa({ email: 'logada@exemplo.invalid' });
    sessao.clerkId = u.clerkId;
    sessao.email = 'logada@exemplo.invalid';
    expect(await conferir({ email: 'logada@exemplo.invalid', telefone: '(11) 98765-4321' })).toBe(
      'telefone_conhecido',
    );
  });

  it('⚠️ VACUIDADE: a consulta devolve ids, e eles não são os mesmos entre pessoas', async () => {
    const a = await pessoa({ email: 'a@exemplo.invalid', cpf: CPF });
    const achados = await buscarAchados(
      { cpf: CPF, email: 'a@exemplo.invalid' },
      'a@exemplo.invalid',
    );
    expect(achados.donosDoCpf).toEqual([a.id]);
    expect(achados.contaDoEmail?.userId).toBe(a.id);
    expect(achados.contaDoEmailDoLink).toBe(a.id);
  });
});

describe('a action da etapa 1', () => {
  it('🔴 link inválido não consulta nem audita', async () => {
    const r = await conferirIdentidadeNaEtapa1({ token: 'f'.repeat(64), cpf: CPF });
    expect(r.sucesso).toBe(false);
    expect(await db.select().from(schema.logsAuditoria)).toHaveLength(0);
  });

  it('🔴 devolve o veredito, e a auditoria registra o ATO sem CPF, e-mail ou telefone', async () => {
    await pessoa({ email: 'outra@exemplo.invalid', cpf: CPF });
    const s = await solicitacao({});
    const r = await conferirIdentidadeNaEtapa1({
      token: s.token,
      cpf: CPF,
      email: 'nova@exemplo.invalid',
      telefone: '(11) 98765-4321',
    });
    expect(r).toEqual({ sucesso: true, dados: { veredito: 'cpf_em_outra_conta' } });

    const logs = await db.select().from(schema.logsAuditoria);
    expect(logs).toHaveLength(1);
    const texto = JSON.stringify(logs[0]);
    expect(texto).toContain('cpf_em_outra_conta');
    expect(texto).toContain(s.protocolo);
    for (const vazamento of [CPF, 'nova@exemplo.invalid', '98765'])
      expect(texto).not.toContain(vazamento);
  });

  it('🔴 o limite é ALCANÇÁVEL: depois de 5 conferências no mesmo link, não responde mais', async () => {
    await pessoa({ email: 'outra@exemplo.invalid', cpf: CPF });
    const s = await solicitacao({});
    for (let i = 0; i < LIMITE_POR_SOLICITACAO; i++) {
      const r = await conferirIdentidadeNaEtapa1({ token: s.token, cpf: CPF });
      expect(r.sucesso && r.dados.veredito, `conferência ${i + 1}`).toBe('cpf_em_outra_conta');
    }
    const estourou = await conferirIdentidadeNaEtapa1({ token: s.token, cpf: CPF });
    // O CPF continua em outra conta — e a resposta deixa de dizer isso.
    expect(estourou).toEqual({ sucesso: true, dados: { veredito: 'limite' } });
  });
});

describe('a action final confere o CPF de novo', () => {
  const envio = (token: string, email: string) =>
    concluirCadastroPorLink({
      token,
      nomeCompleto: 'Pessoa do Link',
      cpf: CPF,
      telefone: '(11) 98765-4321',
      email,
      jaFazTratamento: false,
      temAutorizacaoAnvisa: null,
      temReceitaMedica: null,
      anexos: [],
      tratamentoAtual: null,
      finalidadesConsentidas: [],
    });

  it('🔴 CPF na ficha de OUTRA conta: recusa com o texto do suporte, e não cria a segunda ficha', async () => {
    await pessoa({ email: 'outra@exemplo.invalid', cpf: CPF });
    const s = await solicitacao({ email: 'nova@exemplo.invalid' });
    sessao.clerkId = 'user_recem_criado';
    sessao.email = 'nova@exemplo.invalid';

    const r = await envio(s.token, 'nova@exemplo.invalid');
    expect(r).toEqual({ sucesso: false, erro: TEXTO_DO_SUPORTE });
    // Uma ficha só com aquele CPF — a que já existia.
    expect(await db.select().from(schema.pacientes)).toHaveLength(1);
    // E o link NÃO foi consumido: a pessoa volta por ele depois do suporte.
    const [sol] = await db
      .select()
      .from(schema.solicitacoesCadastro)
      .where(eq(schema.solicitacoesCadastro.id, s.id));
    expect(sol.usadoEm).toBeNull();
  });

  it('🔴 TELEFONE de outra conta: recusa com "este número está em uso", sem ficha e sem consumir o link (DO-68)', async () => {
    await pessoa({ email: 'dona.do.numero@exemplo.invalid', telefone: '+5511987654321' });
    const s = await solicitacao({ email: 'nova@exemplo.invalid' });
    sessao.clerkId = 'user_do_numero_repetido';
    sessao.email = 'nova@exemplo.invalid';

    const r = await envio(s.token, 'nova@exemplo.invalid');
    expect(r).toEqual({ sucesso: false, erro: TEXTO_DO_TELEFONE_EM_USO });
    expect(await db.select().from(schema.pacientes)).toHaveLength(0);
    const [sol] = await db
      .select()
      .from(schema.solicitacoesCadastro)
      .where(eq(schema.solicitacoesCadastro.id, s.id));
    expect(sol.usadoEm).toBeNull();
  });

  it('✅ CONTROLE: o telefone da PRÓPRIA conta (a do e-mail) não trava', async () => {
    const u = await pessoa({ email: 'mesmo.numero@exemplo.invalid', telefone: '+5511987654321' });
    const s = await solicitacao({ email: 'mesmo.numero@exemplo.invalid' });
    sessao.clerkId = u.clerkId;
    sessao.email = 'mesmo.numero@exemplo.invalid';

    const r = await envio(s.token, 'mesmo.numero@exemplo.invalid');
    expect(r.sucesso, JSON.stringify(r)).toBe(true);
  });

  it('✅ CONTROLE: a mesma pessoa voltando (CPF na conta do próprio e-mail) conclui', async () => {
    const u = await pessoa({ email: 'volta@exemplo.invalid', cpf: CPF });
    const s = await solicitacao({ email: 'volta@exemplo.invalid' });
    sessao.clerkId = u.clerkId;
    sessao.email = 'volta@exemplo.invalid';

    const r = await envio(s.token, 'volta@exemplo.invalid');
    expect(r.sucesso, JSON.stringify(r)).toBe(true);
    expect(await db.select().from(schema.pacientes)).toHaveLength(1);
  });

  it('🔴 as RECUSAS têm limite: depois de 5, a resposta deixa de dizer o motivo', async () => {
    await pessoa({ email: 'outra@exemplo.invalid', cpf: CPF });
    const s = await solicitacao({ email: 'atacante@exemplo.invalid' });
    sessao.clerkId = 'user_atacante';
    sessao.email = 'atacante@exemplo.invalid';
    for (let i = 0; i < LIMITE_POR_SOLICITACAO; i++) {
      expect(await envio(s.token, 'atacante@exemplo.invalid'), `recusa ${i + 1}`).toEqual({
        sucesso: false,
        erro: TEXTO_DO_SUPORTE,
      });
    }
    // O CPF continua em outra conta — e a resposta deixa de dizer isso.
    expect(await envio(s.token, 'atacante@exemplo.invalid')).toEqual({
      sucesso: false,
      erro: TEXTO_DE_MUITAS_TENTATIVAS,
    });
  });

  it('🔴 e-mail gravado pelo admin com MAIÚSCULAS: a transação acha a linha e NÃO duplica a ficha', async () => {
    // O admin cria `users` sem conta de acesso e com o e-mail como foi digitado.
    const admin = await pessoa({ email: 'Maria.Caixa@Exemplo.invalid', clerkId: null, cpf: CPF });
    const s = await solicitacao({ email: 'maria.caixa@exemplo.invalid' });
    sessao.clerkId = 'user_maria_nova';
    sessao.email = 'maria.caixa@exemplo.invalid';

    const r = await envio(s.token, 'maria.caixa@exemplo.invalid');
    expect(r.sucesso, JSON.stringify(r)).toBe(true);
    expect(await db.select().from(schema.users), 'nasceu outra `users`').toHaveLength(1);
    expect(await db.select().from(schema.pacientes), 'nasceu a segunda ficha').toHaveLength(1);
    const [ligada] = await db.select().from(schema.users).where(eq(schema.users.id, admin.id));
    expect(ligada.clerkId).toBe('user_maria_nova');
  });

  it('✅ CONTROLE: CPF que ninguém tem conclui e cria a ficha', async () => {
    const s = await solicitacao({ email: 'primeira@exemplo.invalid' });
    sessao.clerkId = 'user_primeira_vez';
    sessao.email = 'primeira@exemplo.invalid';

    const r = await envio(s.token, 'primeira@exemplo.invalid');
    expect(r.sucesso, JSON.stringify(r)).toBe(true);
    const fichas = await db.select().from(schema.pacientes);
    expect(fichas).toHaveLength(1);
    expect(fichas[0].cpf).toBe(CPF);
  });
});

describe('o login não recria a ficha que o cadastro recusou', () => {
  it('🔴 CPF da solicitação em OUTRA conta: a reconciliação pela sessão não grava nada', async () => {
    // O estado sujo: o cadastro foi recusado pelo CPF, o link ficou aberto, e o webhook do Clerk
    // já criou a `users` e a ficha VAZIA da conta nova. A pessoa entra pela conta.
    await pessoa({ email: 'dona.do.cpf@exemplo.invalid', cpf: CPF });
    await solicitacao({ email: 'conta.nova@exemplo.invalid', cpf: CPF });
    const nova = await pessoa({
      email: 'conta.nova@exemplo.invalid',
      clerkId: 'user_conta_nova',
      cpf: null,
    });

    const r = await reconciliarPelaSessao({
      clerkId: 'user_conta_nova',
      email: 'conta.nova@exemplo.invalid',
    });
    expect(r).toEqual({ reconciliou: false, porque: 'cpf_em_outra_conta' });

    const [ficha] = await db
      .select()
      .from(schema.pacientes)
      .where(eq(schema.pacientes.userId, nova.id));
    expect(ficha.cpf, 'a ficha nova ganhou o CPF alheio').toBeNull();
    expect(await db.select().from(schema.documentos)).toHaveLength(0);
  });
});
