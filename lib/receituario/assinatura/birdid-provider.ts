import {
  AssinaturaProvider,
  DadosAssinatura,
  ResultadoAssinatura,
  ProvedorNaoConfiguradoError,
} from './provider';

export class BirdIdProvider implements AssinaturaProvider {
  readonly id = 'birdid' as const;

  configurado(): boolean {
    return Boolean(
      process.env.BIRDID_CLIENT_ID &&
        process.env.BIRDID_CLIENT_SECRET &&
        process.env.BIRDID_BASE_URL,
    );
  }

  async assinarPdf(_dados: DadosAssinatura): Promise<ResultadoAssinatura> {
    if (!this.configurado()) throw new ProvedorNaoConfiguradoError(this.id);
    throw new Error(
      'BirdIdProvider.assinarPdf: implementação pendente (credenciais recebidas — implementar fluxo upload/download).',
    );
  }
}
