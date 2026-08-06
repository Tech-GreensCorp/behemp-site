import type {
  DadosAssinatura,
  ResultadoAssinatura,
} from '../tipos';
import type { AssinaturaProvider } from './provider';

/**
 * StubProvider — usado enquanto PSC (BirdID/VIDaaS) não libera credenciais.
 * Falha de forma clara e segura — nunca simula uma assinatura real.
 */
export class StubProvider implements AssinaturaProvider {
  readonly id = 'vidaas' as const;

  configurado(): boolean {
    return false;
  }

  async assinarPdf(_dados: DadosAssinatura): Promise<ResultadoAssinatura> {
    throw new Error(
      'Assinatura digital ICP-Brasil aguardando liberação de credenciais pelo PSC. ' +
        'Entre em contato com o suporte BeHemp.',
    );
  }
}
