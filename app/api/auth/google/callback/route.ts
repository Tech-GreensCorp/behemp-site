import { NextRequest, NextResponse } from 'next/server';
import { urlAbsoluta } from '@/lib/url';
import { trocarCodigoPorTokens } from '@/lib/integrations/google-calendar';
import { db } from '@/lib/db';
import { medicos } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Callback do OAuth2 do Google Calendar.
 *
 * Fluxo:
 * 1. O médico clica em "Conectar Google Calendar" na página de configurações
 * 2. É redirecionado para o Google para autorizar
 * 3. Google redireciona de volta para esta rota com o `code` e o `state` (medicoId)
 * 4. Trocamos o code por refresh_token e salvamos no banco
 * 5. Redirecionamos para a página de configurações com mensagem de sucesso
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // medicoId
  const error = searchParams.get('error');

  // Se o usuário negou a autorização
  if (error) {
    return NextResponse.redirect(urlAbsoluta('/medico/configuracoes?google=erro&motivo=negado'));
  }

  if (!code || !state) {
    return NextResponse.redirect(
      urlAbsoluta('/medico/configuracoes?google=erro&motivo=parametros'),
    );
  }

  try {
    // Trocar o authorization code por tokens
    const { refreshToken } = await trocarCodigoPorTokens(code);

    // Salvar o refresh_token no registro do médico
    await db.update(medicos).set({ googleRefreshToken: refreshToken }).where(eq(medicos.id, state));

    // Redirecionar com sucesso
    return NextResponse.redirect(urlAbsoluta('/medico/configuracoes?google=sucesso'));
  } catch (err) {
    console.error('[Google OAuth] Erro no callback:', err);
    return NextResponse.redirect(urlAbsoluta('/medico/configuracoes?google=erro&motivo=token'));
  }
}
