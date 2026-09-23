import { NextResponse, type NextRequest } from 'next/server';

import { db } from '@/lib/db';
import { medicos, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verificarMedico } from '@/lib/auth';
import { gerarUrlAutorizacao, oauthConfigurado } from '@/lib/mercadopago/oauth';

/**
 * INÍCIO DO OAUTH — manda o médico autorizar a conta dele no Mercado Pago.
 *
 * 🔴 O `medicoId` SAI DA SESSÃO, nunca de query param. Se viesse do cliente, qualquer
 * médico autenticado montaria a URL com o id de outro e o vínculo nasceria errado — é
 * OWASP API1 (BOLA), o risco número um deste projeto. O que não é recebido não pode ser
 * trocado.
 *
 * A rota vive sob `/api/medico/`, que o middleware já protege; o `verificarMedico` aqui é
 * a segunda camada, e é ela que dá o `clerkId` para resolver o médico.
 */
export async function GET(request: NextRequest) {
  const erro = (motivo: string) =>
    NextResponse.redirect(
      new URL(`/medico/pagamentos/config?mp=erro&motivo=${motivo}`, request.url),
    );

  try {
    const auth = await verificarMedico();
    if (!auth.autorizado || !auth.clerkId) return erro('sessao');

    if (!oauthConfigurado()) {
      // Configuração ausente é problema NOSSO, e o médico precisa saber que não é ele.
      console.error('[mercadopago] conectar recusado: CLIENT_ID/CLIENT_SECRET ausentes');
      return erro('configuracao');
    }

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

    return NextResponse.redirect(gerarUrlAutorizacao(medico.id));
  } catch (e) {
    // `gerarUrlAutorizacao` lança sem a chave que assina o state — e sem assinatura o
    // fluxo ficaria aberto a CSRF de OAuth. Falha fechada, e o motivo fica no log.
    console.error('[mercadopago] falha ao montar a autorização:', e);
    return erro('configuracao');
  }
}
