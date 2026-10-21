import { NextRequest, NextResponse } from 'next/server';
import { urlAbsoluta } from '@/lib/url';
import { trocarCodigoPorTokens } from '@/lib/integrations/google-calendar';

/**
 * Callback do OAuth2 do Google.
 * Recebe o authorization code e troca por tokens.
 * O state contém o medicoId para vincular o refresh_token.
 *
 * TODO: Atualizar a tabela medicos com o refresh_token via Server Action.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // medicoId
    const error = searchParams.get('error');

    if (error) {
      console.error('[Google Callback] Erro na autorização:', error);
      return NextResponse.redirect(urlAbsoluta('/medico?erro=autorizacao_google'));
    }

    if (!code || !state) {
      return NextResponse.redirect(urlAbsoluta('/medico?erro=parametros_invalidos'));
    }

    const tokens = await trocarCodigoPorTokens(code);

    // TODO: Salvar tokens.refreshToken na tabela medicos para o medicoId (state)
    // await atualizarRefreshTokenMedico(state, tokens.refreshToken);

    console.log(
      `[Google Callback] Tokens obtidos para médico ${state}. refreshToken: ${tokens.refreshToken ? '✅' : '❌'}`,
    );

    return NextResponse.redirect(urlAbsoluta('/medico?sucesso=google_conectado'));
  } catch (error) {
    console.error('[Google Callback] Erro ao processar callback:', error);
    return NextResponse.redirect(urlAbsoluta('/medico?erro=google_callback'));
  }
}
