import { NextResponse, type NextRequest } from 'next/server';

import { db } from '@/lib/db';
import { medicos, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verificarMedico } from '@/lib/auth';
import { conectar } from '@/lib/mercadopago/conta';
import { trocarCodigoPorTokens } from '@/lib/mercadopago/oauth';
import { verificarState } from '@/lib/mercadopago/state';

/**
 * VOLTA DO OAUTH DO MERCADO PAGO.
 *
 * ## 🔴 AS DUAS CAMADAS, e por que uma só não basta
 *
 * 1. **A assinatura do `state`** prova que o parâmetro saiu daqui. Sozinha, não impede o
 *    ataque que interessa.
 * 2. **O `medicoId` do state tem que ser o da SESSÃO.** É o que fecha o **CSRF de OAuth**:
 *    o atacante inicia o fluxo pela nossa própria rota `/conectar` — e recebe um `state`
 *    legitimamente assinado, para ele mesmo —, captura o `code` da conta de Mercado Pago
 *    DELE e induz o navegador do médico logado a bater aqui. Sem a comparação, a linha do
 *    médico passaria a apontar para a conta do atacante, e **o dinheiro das consultas
 *    daquele médico cairia lá**.
 *
 * ⚠️ É exatamente o padrão que `app/api/auth/google/callback/route.ts` NÃO tem: lá o
 * `state` é o `medicoId` cru, sem assinatura e sem conferência contra a sessão. Aquilo
 * está catalogado; aqui não se repete.
 *
 * ## O que a tela vê
 *
 * Nenhum detalhe de erro chega à URL. O `motivo` é um rótulo fixo e genérico — a causa vai
 * para o log do servidor. Mensagem de erro detalhada em querystring é oráculo para quem
 * está tentando descobrir o que funciona.
 *
 * ⚠️ Esta rota depende do cookie de sessão sobreviver ao redirect vindo de outro site. O
 * Clerk usa `SameSite=Lax`, que **permite** cookie em navegação de topo por GET — que é
 * exatamente o que o Mercado Pago faz. Se um dia a sessão não vier, o middleware manda
 * para o login e o `code` se perde: o sintoma seria "conectei e voltei deslogado".
 */
export async function GET(request: NextRequest) {
  const destino = (qs: string) =>
    NextResponse.redirect(new URL(`/medico/pagamentos/config?${qs}`, request.url));
  const erro = (motivo: string) => destino(`mp=erro&motivo=${motivo}`);

  const params = request.nextUrl.searchParams;
  const code = params.get('code');
  const state = params.get('state');
  const recusado = params.get('error');

  // O médico clicou em "cancelar" no site do Mercado Pago. Não é falha nossa.
  if (recusado) return erro('negado');
  if (!code || !state) return erro('incompleto');

  try {
    const auth = await verificarMedico();
    if (!auth.autorizado || !auth.clerkId) return erro('sessao');

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, auth.clerkId))
      .limit(1);
    if (!user) return erro('sessao');

    const [medico] = await db
      .select({ id: medicos.id })
      .from(medicos)
      .where(eq(medicos.userId, user.id))
      .limit(1);
    if (!medico) return erro('sessao');

    // ── Camada 1: a assinatura ──────────────────────────────────────────────
    const conferido = verificarState(state);
    if (!conferido.valido) {
      console.error('[mercadopago] state recusado:', conferido.motivo);
      return erro('state');
    }

    // ── Camada 2: o state é DESTE médico? ───────────────────────────────────
    if (conferido.medicoId !== medico.id) {
      // 🔴 Isto não é engano de usuário: é um state válido chegando na sessão errada.
      // Registrar como o que é, e não contar nada a quem tentou.
      console.error('[mercadopago] 🔴 state assinado para OUTRO médico — possível CSRF de OAuth.', {
        medicoDaSessao: medico.id,
        medicoDoState: conferido.medicoId,
      });
      return erro('state');
    }

    const tokens = await trocarCodigoPorTokens(code);
    await conectar(medico.id, tokens, user.id);

    return destino('mp=sucesso');
  } catch (e) {
    // Cai aqui: código expirado (vale 10 min), Mercado Pago fora do ar, resposta sem os
    // campos esperados, ou `cifrar` sem a chave. Os quatro são problema nosso ou do MP —
    // nenhum vira detalhe na URL.
    //
    // ⚠️ `erro.name` de um `new Error` é sempre 'Error' — foi o que escondeu por quatro
    // dias uma falha inteira neste repositório. Por isso o objeto vai inteiro para o log.
    console.error('[mercadopago] falha no callback do OAuth:', e);
    return erro('falha');
  }
}
