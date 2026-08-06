export type EstampaTipo = 'nenhuma' | 'medico';
export type ProvedorId = 'vidaas' | 'birdid';

export interface EstampaConfig {
  tipo: EstampaTipo;
  opacidade: number;
}

export interface BlocoConfig {
  id: string;
  tipo: string;
  x: number;
  y: number;
  largura: number;
  altura?: number;
  fontSize?: number;
  align?: 'left' | 'center' | 'right';
  negrito?: boolean;
  cor?: string;
  visivel: boolean;
  texto?: string;
}

export interface ReceituarioConfig {
  corPrimaria: string;
  corFundo?: string;
  estampa: EstampaConfig;
  blocos: BlocoConfig[];
}

export interface ContextoReceituario {
  clinica: {
    nome: string;
    logoUrl: string | null;
    corPrimaria: string;
    endereco: string;
    telefone: string;
    email?: string;
    site?: string;
  };
  medico: {
    nome: string;
    crm: string;
    crmUf: string;
    especialidade: string;
    rqe: string;
    telefone: string;
    assinaturaUrl: string | null;
    carimboUrl: string | null;
  };
  paciente: {
    nome: string;
    idade: number | null;
    sexo: string;
  };
  receita: {
    tipoLabel: string;
    diagnostico: string;
    cid: string;
    observacoes: string;
    emitidaEm: Date;
    validade: Date;
  };
  medicamentos: Array<{
    nome: string;
    dose?: string;
    forma?: string;
    posologia?: string;
    quantidade?: string;
  }>;
}

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
