export type ProvedorId = 'vidaas' | 'birdid' | 'govbr';

export interface DadosAssinatura {
  medico: { id: string; cpf: string | null };
  pdf: Buffer;
  autorizacao?: {
    otp?: string;
    accessToken?: string;
    certificateAlias?: string;
  };
}

export interface ResultadoAssinatura {
  pdfAssinado: Buffer;
  certificadoCN: string;
  hashAssinatura: string;
}

export interface AssinaturaProvider {
  readonly id: ProvedorId;
  configurado(): boolean;
  assinarPdf(dados: DadosAssinatura): Promise<ResultadoAssinatura>;
}

export class ProvedorNaoConfiguradoError extends Error {
  constructor(id: ProvedorId) {
    super(
      `Provedor de assinatura "${id}" ainda não configurado — aguardando credenciais do PSC (Sprint 16, S16.0).`,
    );
    this.name = 'ProvedorNaoConfiguradoError';
  }
}
