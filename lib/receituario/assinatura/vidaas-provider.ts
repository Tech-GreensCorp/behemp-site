import {
  AssinaturaProvider,
  DadosAssinatura,
  ResultadoAssinatura,
  ProvedorNaoConfiguradoError,
} from './provider';

export class VidaasProvider implements AssinaturaProvider {
  readonly id = 'vidaas' as const;

  configurado(): boolean {
    return Boolean(
      process.env.VIDAAS_CLIENT_ID &&
        process.env.VIDAAS_CLIENT_SECRET &&
        process.env.VIDAAS_BASE_URL,
    );
  }

  async assinarPdf(_dados: DadosAssinatura): Promise<ResultadoAssinatura> {
    if (!this.configurado()) throw new ProvedorNaoConfiguradoError(this.id);
    throw new Error(
      'VidaasProvider.assinarPdf: implementação pendente (credenciais recebidas — implementar fluxo OAuth PKCE).',
    );
  }
}
