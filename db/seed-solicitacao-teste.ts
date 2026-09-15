/**
 * SEED DE SOLICITAÇÃO DE CADASTRO DE TESTE — para ver a tela `/cadastro/[token]`.
 *
 * O QUE FAZ
 * Cria UMA `solicitacoes_cadastro` sem nenhum documento do parceiro — o cenário "chegou
 * pelo bot, sem nada ainda" — para que os 5 documentos do fluxo (incluindo `receita_medica`)
 * fiquem pendentes e a tela entre no `fluxoDaTeleconsulta` (DO-57/DO-58, ADR-0023).
 *
 * COMO SE DESFAZ
 * `pnpm tsx --env-file=.env.local db/seed-solicitacao-teste.ts --remover` apaga só a linha
 * criada, pelo protocolo abaixo. Nada mais é tocado.
 *
 * IDEMPOTENTE: sim. Rodar duas vezes atualiza a mesma linha (mesmo protocolo) em vez de
 * duplicar, e emite um token novo a cada execução (o hash antigo para de bater).
 *
 * 🔴 RECUSA RODAR EM PRODUÇÃO. Mesma trava dupla do `seed-perfis-teste.ts`: NODE_ENV e URL
 * de Neon — nunca gravar solicitação de cadastro sintética num banco que pode ser real.
 */
import { eq } from 'drizzle-orm';

import { solicitacoesCadastro } from '@/db/schema';
import { db } from '@/lib/db';
import { gerarToken, montarLink } from '@/lib/chatpro/solicitacao';

const PROTOCOLO_TESTE = 'SOL-000000';

function abortarSeProducao() {
  const url = process.env.DATABASE_URL ?? '';
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seed de teste não roda com NODE_ENV=production.');
  }
  if (/neon\.tech|neon\.build/.test(url)) {
    throw new Error(
      'DATABASE_URL aponta para o Neon. Este seed cria solicitação de cadastro — não roda contra produção.',
    );
  }
  if (!url) throw new Error('DATABASE_URL não definida.');
}

async function remover() {
  abortarSeProducao();
  const apagado = await db
    .delete(solicitacoesCadastro)
    .where(eq(solicitacoesCadastro.protocolo, PROTOCOLO_TESTE))
    .returning({ id: solicitacoesCadastro.id });
  console.log(apagado.length > 0 ? `Removida (${PROTOCOLO_TESTE}).` : 'Nada para remover.');
}

async function criar() {
  abortarSeProducao();
  console.log(`Banco: ${process.env.DATABASE_URL?.replace(/:[^:@]*@/, ':***@')}\n`);

  const { token, hash } = gerarToken();
  const expiraEm = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const [existente] = await db
    .select({ id: solicitacoesCadastro.id })
    .from(solicitacoesCadastro)
    .where(eq(solicitacoesCadastro.protocolo, PROTOCOLO_TESTE))
    .limit(1);

  const valores = {
    protocolo: PROTOCOLO_TESTE,
    nomeCompleto: 'Paciente Teste (fluxo teleconsulta)',
    email: 'paciente.teste+teleconsulta@example.com',
    telefone: '5511999990000',
    tokenHash: hash,
    expiraEm,
    status: 'link_gerado' as const,
    origem: 'chatpro_bot' as const,
    // Nenhum documento do parceiro — os 5 ficam pendentes, incluindo receita_medica.
    documentosDoParceiro: null,
    parceiro: null,
    declarouTerAutorizacaoAnvisa: null,
    declarouTerReceitaMedica: null,
    usadoEm: null,
    canalDeEntrega: 'bot_reply',
  };

  if (existente) {
    await db
      .update(solicitacoesCadastro)
      .set(valores)
      .where(eq(solicitacoesCadastro.id, existente.id));
    console.log(`  = ${PROTOCOLO_TESTE} atualizada (token novo)`);
  } else {
    await db.insert(solicitacoesCadastro).values(valores);
    console.log(`  + ${PROTOCOLO_TESTE} criada`);
  }

  console.log(`
┌─ Solicitação de teste (fluxo da teleconsulta) ────────────────────────────┐
│  protocolo   ${PROTOCOLO_TESTE.padEnd(58)}│
│  expira em   ${expiraEm.toLocaleString('pt-BR').padEnd(58)}│
└──────────────────────────────────────────────────────────────────────────┘

Link (vale uma vez a exibição — o token não fica salvo em claro):

  ${montarLink(token)}

Para desfazer:  pnpm tsx --env-file=.env.local db/seed-solicitacao-teste.ts --remover
`);
}

const alvo = process.argv.includes('--remover') ? remover : criar;
alvo()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('\n🔴', e instanceof Error ? e.message : e);
    process.exit(1);
  });
