/**
 * Linhas de produto do catálogo — lista fechada, definida pelo negócio.
 * Diferente de outros campos do módulo, aqui o valor é um domínio fixo,
 * não texto livre: um select, não um enum de banco (mudança de marketing
 * não deve exigir migration).
 */
export const LINHAS_PRODUTO = ['GLife', 'GBalance', 'GMed'] as const;

export type LinhaProduto = (typeof LINHAS_PRODUTO)[number];

export function isLinhaProduto(valor: string | null | undefined): valor is LinhaProduto {
  return !!valor && (LINHAS_PRODUTO as readonly string[]).includes(valor);
}

/** Texto institucional fixo exibido na seção "Sobre a linha" do produto. */
export const SOBRE_LINHA: Record<LinhaProduto, string> = {
  GLife:
    'Após três anos de atuação clínica estruturada, a Greens expandiu sua experiência científica para uma linha voltada ao cotidiano. Nasce então a Greens Life (Essencialidade para o Dia a Dia).',
  GBalance:
    'A Greens Balance representa o estágio mais tecnológico da Greens. Conhecida como G-Balance, essa linha foi desenvolvida com aplicação de nanotecnologia e formulações baseadas em canabinoides isolados. Ela é a expressão da engenharia farmacêutica avançada da companhia.',
  GMed: 'A GMED é a divisão clínica avançada da Greens. Voltada a patologias complexas, crônicas e condições de alta demanda terapêutica, essa linha foi responsável por consolidar a base científica da empresa no Brasil.',
};

/**
 * Classes de cor por linha — badge sólido para dar destaque real
 * (a versão anterior, com fundo em 10% de opacidade, ficava apagada
 * demais para funcionar como identificador rápido na listagem/card).
 * Reaproveita tons já presentes no design system (leaf, sky, primary).
 */
export const LINHA_ESTILO: Record<LinhaProduto, { badge: string }> = {
  GLife: { badge: 'bg-[#4E9E6A] text-white shadow-sm' },
  GBalance: { badge: 'bg-[#4A80E5] text-white shadow-sm' },
  GMed: { badge: 'bg-primary text-white shadow-sm' },
};

export function estiloLinha(linha: string | null | undefined) {
  if (isLinhaProduto(linha)) return LINHA_ESTILO[linha];
  return { badge: 'bg-muted text-muted-foreground' };
}
