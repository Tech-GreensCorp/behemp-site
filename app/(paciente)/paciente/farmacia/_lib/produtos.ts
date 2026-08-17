/**
 * Dados mockados da "Nossa Farmácia".
 *
 * Fase de UI/UX — sem integração com dados reais, checkout ou backend de produtos.
 * Estrutura pensada para troca futura por uma fonte real (schema Drizzle / API)
 * sem precisar alterar os componentes que consomem `listarProdutos` / `obterProdutoPorId`.
 */

export type CategoriaProdutoSlug = 'oleos-sublinguais' | 'capsulas-softgels' | 'outros-produtos';

export interface CategoriaProduto {
  slug: CategoriaProdutoSlug;
  nome: string;
  descricao: string;
}

export interface Produto {
  id: string;
  slug: string;
  nome: string;
  marca: string;
  categoria: CategoriaProdutoSlug;
  descricaoCurta: string;
  descricao: string;
  preco: number;
  precoOriginal?: number;
  imagem: string;
  badges: string[];
  destaques: string[];
  disponibilidade: 'disponivel' | 'sob_consulta';
}

export const CATEGORIAS: CategoriaProduto[] = [
  {
    slug: 'oleos-sublinguais',
    nome: 'Óleos Sublinguais',
    descricao: 'Extratos de cannabis medicinal em óleo, para uso sob prescrição.',
  },
  {
    slug: 'capsulas-softgels',
    nome: 'Cápsulas e Softgels',
    descricao: 'Dosagem prática e discreta em cápsulas gelatinosas.',
  },
  {
    slug: 'outros-produtos',
    nome: 'Outros Produtos',
    descricao: 'Demais itens do ecossistema Be4Hope.',
  },
];

const IMAGEM_TARJA_PRETA = '/images/farmacia/produto-tarja-preta.jpg';
const IMAGEM_TARJA_VERMELHA = '/images/farmacia/produto-tarja-vermelha.jpg';

let contadorImagem = 0;

/** Alterna as duas fotos de referência entre os produtos mockados. */
function proximaImagem() {
  contadorImagem += 1;
  return contadorImagem % 2 === 0 ? IMAGEM_TARJA_VERMELHA : IMAGEM_TARJA_PRETA;
}

function slugify(nome: string) {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

type NovoProduto = Omit<Produto, 'id' | 'slug' | 'imagem' | 'disponibilidade' | 'badges' | 'destaques'> & {
  disponibilidade?: Produto['disponibilidade'];
  badges?: string[];
  destaques?: string[];
};

function produto(dados: NovoProduto): Produto {
  const slug = slugify(dados.nome);
  return {
    ...dados,
    id: slug,
    slug,
    imagem: proximaImagem(),
    disponibilidade: dados.disponibilidade ?? 'disponivel',
    badges: dados.badges ?? [],
    destaques: dados.destaques ?? [],
  };
}

const OLEOS: Produto[] = [
  produto({
    nome: 'Greens MED 1500mg Full Spectrum',
    marca: 'Greens MED',
    categoria: 'oleos-sublinguais',
    descricaoCurta: 'Óleo full spectrum 30ml, indicado para início de tratamento.',
    descricao:
      'Extrato de cannabis full spectrum, com perfil completo de canabinoides e terpenos da planta. Indicado para pacientes em fase inicial de titulação, sob orientação médica.',
    preco: 289.9,
    badges: ['Mais vendido'],
    destaques: ['30ml · 900 gotas', 'CBD 1500mg', 'Full Spectrum', 'Uso sublingual'],
  }),
  produto({
    nome: 'Greens MED 1500mg Broad Spectrum',
    marca: 'Greens MED',
    categoria: 'oleos-sublinguais',
    descricaoCurta: 'Óleo broad spectrum 30ml, sem THC detectável.',
    descricao:
      'Extrato broad spectrum com canabinoides e terpenos preservados, sem THC detectável na formulação. Alternativa para pacientes com restrição a THC.',
    preco: 299.9,
    destaques: ['30ml · 900 gotas', 'CBD 1500mg', 'Broad Spectrum', 'Sem THC detectável'],
  }),
  produto({
    nome: 'Greens MED 3000mg Full Spectrum',
    marca: 'Greens MED',
    categoria: 'oleos-sublinguais',
    descricaoCurta: 'Concentração intermediária para ajuste de dose.',
    descricao:
      'Versão de maior concentração para pacientes em processo de ajuste de dosagem, mantendo o perfil completo de canabinoides do full spectrum.',
    preco: 419.9,
    precoOriginal: 459.9,
    badges: ['Promoção'],
    destaques: ['30ml · 900 gotas', 'CBD 3000mg', 'Full Spectrum', 'Uso sublingual'],
  }),
  produto({
    nome: 'Greens MED 3000mg Broad Spectrum',
    marca: 'Greens MED',
    categoria: 'oleos-sublinguais',
    descricaoCurta: 'Broad spectrum de média concentração, sem THC detectável.',
    descricao:
      'Formulação intermediária broad spectrum, sem THC detectável, para pacientes que já passaram pela fase inicial de titulação.',
    preco: 429.9,
    destaques: ['30ml · 900 gotas', 'CBD 3000mg', 'Broad Spectrum'],
  }),
  produto({
    nome: 'Greens MED 6000mg Full Spectrum',
    marca: 'Greens MED',
    categoria: 'oleos-sublinguais',
    descricaoCurta: 'Alta concentração para tratamentos de longo prazo.',
    descricao:
      'Alta concentração de canabinoides, indicada para pacientes com dosagem já estabelecida pelo médico responsável, reduzindo o volume de gotas necessário.',
    preco: 649.9,
    badges: ['Alta concentração'],
    destaques: ['30ml · 900 gotas', 'CBD 6000mg', 'Full Spectrum'],
  }),
  produto({
    nome: 'Greens MED 6000mg Broad Spectrum',
    marca: 'Greens MED',
    categoria: 'oleos-sublinguais',
    descricaoCurta: 'Alta concentração, sem THC detectável.',
    descricao:
      'Alta concentração broad spectrum, sem THC detectável, para pacientes com necessidade de dosagens maiores e restrição ao THC.',
    preco: 669.9,
    destaques: ['30ml · 900 gotas', 'CBD 6000mg', 'Broad Spectrum'],
  }),
  produto({
    nome: 'Greens LIFE 1500mg Isolado',
    marca: 'Greens LIFE',
    categoria: 'oleos-sublinguais',
    descricaoCurta: 'CBD isolado, indicado para maior sensibilidade a outros compostos.',
    descricao:
      'CBD isolado, sem demais canabinoides ou terpenos da planta. Indicado para pacientes com maior sensibilidade ou que buscam apenas o canabidiol.',
    preco: 259.9,
    destaques: ['30ml · 900 gotas', 'CBD 1500mg', 'Isolado', 'Sem THC'],
  }),
  produto({
    nome: 'Greens LIFE 3000mg Isolado',
    marca: 'Greens LIFE',
    categoria: 'oleos-sublinguais',
    descricaoCurta: 'CBD isolado de média concentração.',
    descricao:
      'Versão de maior concentração do CBD isolado Greens LIFE, mantendo a ausência de THC e demais canabinoides.',
    preco: 389.9,
    destaques: ['30ml · 900 gotas', 'CBD 3000mg', 'Isolado'],
  }),
  produto({
    nome: 'Greens LIFE 6000mg Isolado',
    marca: 'Greens LIFE',
    categoria: 'oleos-sublinguais',
    descricaoCurta: 'CBD isolado de alta concentração.',
    descricao:
      'Alta concentração de CBD isolado, indicada para pacientes com dosagem já estabelecida e necessidade de reduzir o volume de gotas.',
    preco: 599.9,
    destaques: ['30ml · 900 gotas', 'CBD 6000mg', 'Isolado'],
  }),
  produto({
    nome: 'Greens MED CBN 1500mg Sono',
    marca: 'Greens MED',
    categoria: 'oleos-sublinguais',
    descricaoCurta: 'Formulação com CBN, associada ao suporte do sono.',
    descricao:
      'Óleo formulado com canabinol (CBN) associado ao CBD, indicado como suporte em protocolos relacionados à qualidade do sono, sob orientação médica.',
    preco: 349.9,
    badges: ['Novo'],
    destaques: ['30ml · 900 gotas', 'CBD + CBN', 'Uso noturno'],
  }),
  produto({
    nome: 'Greens MED CBG 1500mg Foco',
    marca: 'Greens MED',
    categoria: 'oleos-sublinguais',
    descricaoCurta: 'Formulação com CBG para uso diurno.',
    descricao:
      'Óleo formulado com canabigerol (CBG) associado ao CBD, indicado como suporte em protocolos de uso diurno, sob orientação médica.',
    preco: 349.9,
    badges: ['Novo'],
    destaques: ['30ml · 900 gotas', 'CBD + CBG', 'Uso diurno'],
  }),
  produto({
    nome: 'Greens LIFE Spray Sublingual 1000mg',
    marca: 'Greens LIFE',
    categoria: 'oleos-sublinguais',
    descricaoCurta: 'Aplicador em spray, alternativa ao conta-gotas.',
    descricao:
      'Mesma formulação do óleo sublingual, em frasco spray, para pacientes que preferem um aplicador mais prático que o conta-gotas tradicional.',
    preco: 279.9,
    destaques: ['30ml', 'CBD 1000mg', 'Aplicador spray'],
  }),
];

const CAPSULAS: Produto[] = [
  produto({
    nome: 'Greens MED Softgel 10mg CBD',
    marca: 'Greens MED',
    categoria: 'capsulas-softgels',
    descricaoCurta: 'Cápsulas de dose baixa, prática para o dia a dia.',
    descricao:
      'Cápsulas gelatinosas com dose baixa de CBD, indicadas para pacientes em manutenção que preferem a praticidade da cápsula ao óleo.',
    preco: 199.9,
    destaques: ['60 cápsulas', 'CBD 10mg por cápsula', 'Sem sabor residual'],
  }),
  produto({
    nome: 'Greens MED Softgel 25mg CBD',
    marca: 'Greens MED',
    categoria: 'capsulas-softgels',
    descricaoCurta: 'Dose intermediária em formato de cápsula.',
    descricao:
      'Cápsulas com dose intermediária de CBD, mantendo a praticidade de dosagem fixa por unidade.',
    preco: 259.9,
    destaques: ['60 cápsulas', 'CBD 25mg por cápsula'],
  }),
  produto({
    nome: 'Greens MED Softgel 50mg CBD Full Spectrum',
    marca: 'Greens MED',
    categoria: 'capsulas-softgels',
    descricaoCurta: 'Alta dosagem, perfil completo de canabinoides.',
    descricao:
      'Cápsulas de alta dosagem com perfil full spectrum, indicadas para pacientes com dosagem já estabelecida pelo médico.',
    preco: 349.9,
    badges: ['Alta concentração'],
    destaques: ['60 cápsulas', 'CBD 50mg por cápsula', 'Full Spectrum'],
  }),
  produto({
    nome: 'Greens LIFE Cápsula 10mg Isolado',
    marca: 'Greens LIFE',
    categoria: 'capsulas-softgels',
    descricaoCurta: 'CBD isolado em cápsula, dose baixa.',
    descricao: 'Cápsulas com CBD isolado, sem THC, em dose baixa para manutenção do tratamento.',
    preco: 189.9,
    destaques: ['60 cápsulas', 'CBD 10mg', 'Isolado'],
  }),
  produto({
    nome: 'Greens LIFE Cápsula 25mg Isolado',
    marca: 'Greens LIFE',
    categoria: 'capsulas-softgels',
    descricaoCurta: 'CBD isolado em cápsula, dose intermediária.',
    descricao: 'Cápsulas com CBD isolado, sem THC, em dose intermediária.',
    preco: 249.9,
    destaques: ['60 cápsulas', 'CBD 25mg', 'Isolado'],
  }),
  produto({
    nome: 'Greens MED Softgel Noite CBN 15mg',
    marca: 'Greens MED',
    categoria: 'capsulas-softgels',
    descricaoCurta: 'Cápsula noturna com CBD e CBN.',
    descricao:
      'Cápsulas formuladas com CBD e CBN, pensadas para o uso noturno dentro do protocolo definido pelo médico.',
    preco: 269.9,
    badges: ['Novo'],
    destaques: ['30 cápsulas', 'CBD + CBN', 'Uso noturno'],
  }),
  produto({
    nome: 'Greens MED Softgel Dia CBG 15mg',
    marca: 'Greens MED',
    categoria: 'capsulas-softgels',
    descricaoCurta: 'Cápsula diurna com CBD e CBG.',
    descricao:
      'Cápsulas formuladas com CBD e CBG, indicadas para o período diurno dentro do protocolo definido pelo médico.',
    preco: 269.9,
    badges: ['Novo'],
    destaques: ['30 cápsulas', 'CBD + CBG', 'Uso diurno'],
  }),
  produto({
    nome: 'Greens LIFE Multi Cápsula CBD + CBG',
    marca: 'Greens LIFE',
    categoria: 'capsulas-softgels',
    descricaoCurta: 'Combinação de canabinoides em uma única cápsula.',
    descricao: 'Cápsulas com combinação de CBD e CBG, pensadas para protocolos combinados.',
    preco: 289.9,
    destaques: ['60 cápsulas', 'CBD + CBG'],
  }),
  produto({
    nome: 'Greens MED Softgel 50mg Broad Spectrum',
    marca: 'Greens MED',
    categoria: 'capsulas-softgels',
    descricaoCurta: 'Alta dosagem, sem THC detectável.',
    descricao:
      'Cápsulas de alta dosagem em broad spectrum, sem THC detectável, para pacientes com restrição ao composto.',
    preco: 359.9,
    destaques: ['60 cápsulas', 'CBD 50mg', 'Broad Spectrum'],
  }),
  produto({
    nome: 'Greens LIFE Cápsula Vegana 20mg CBD',
    marca: 'Greens LIFE',
    categoria: 'capsulas-softgels',
    descricaoCurta: 'Versão vegana das cápsulas de CBD.',
    descricao: 'Cápsula vegetal, sem gelatina animal, com 20mg de CBD isolado por unidade.',
    preco: 239.9,
    badges: ['Vegano'],
    destaques: ['60 cápsulas', 'CBD 20mg', 'Cápsula vegetal'],
  }),
];

const OUTROS: Produto[] = [
  produto({
    nome: 'Greens Pet Óleo CBD 1000mg',
    marca: 'Greens Pet',
    categoria: 'outros-produtos',
    descricaoCurta: 'Óleo formulado para cães e gatos.',
    descricao: 'Óleo com CBD formulado para uso veterinário em cães e gatos, sob orientação de médico veterinário.',
    preco: 219.9,
    badges: ['Pet'],
    destaques: ['30ml', 'Uso veterinário', 'Cães e gatos'],
  }),
  produto({
    nome: 'Vaporizador Pessoal Be4Hope',
    marca: 'Be4Hope',
    categoria: 'outros-produtos',
    descricaoCurta: 'Acessório para uso indicado pelo médico responsável.',
    descricao: 'Vaporizador pessoal, disponível conforme indicação do médico responsável pelo tratamento.',
    preco: 449.9,
    disponibilidade: 'sob_consulta',
    destaques: ['Uso conforme prescrição médica'],
  }),
  produto({
    nome: 'Spray Bucal CBD 300mg',
    marca: 'Greens LIFE',
    categoria: 'outros-produtos',
    descricaoCurta: 'Aplicação bucal prática.',
    descricao: 'Spray bucal com CBD, alternativa prática de aplicação para uso fora de casa.',
    preco: 169.9,
    destaques: ['20ml', 'CBD 300mg', 'Aplicador spray'],
  }),
  produto({
    nome: 'Gomas CBD 10mg (30 unidades)',
    marca: 'Greens LIFE',
    categoria: 'outros-produtos',
    descricaoCurta: 'Gomas mastigáveis com dose fixa de CBD.',
    descricao: 'Gomas mastigáveis com 10mg de CBD por unidade, dose fixa e sabor agradável.',
    preco: 149.9,
    badges: ['Mais vendido'],
    destaques: ['30 unidades', 'CBD 10mg por goma'],
  }),
  produto({
    nome: 'Chá Funcional CBD + Camomila',
    marca: 'Greens LIFE',
    categoria: 'outros-produtos',
    descricaoCurta: 'Blend funcional para o final do dia.',
    descricao: 'Chá funcional combinando CBD e camomila, indicado para o momento de relaxamento noturno.',
    preco: 59.9,
    destaques: ['20 sachês', 'CBD + Camomila'],
  }),
  produto({
    nome: 'Adesivo Transdérmico CBD',
    marca: 'Greens LIFE',
    categoria: 'outros-produtos',
    descricaoCurta: 'Liberação gradual ao longo do dia.',
    descricao: 'Adesivo transdérmico com liberação gradual de CBD ao longo do dia de uso.',
    preco: 189.9,
    badges: ['Novo'],
    destaques: ['4 adesivos', 'Liberação gradual'],
  }),
  produto({
    nome: 'Óleo de Massagem CBD 500ml',
    marca: 'Greens LIFE',
    categoria: 'outros-produtos',
    descricaoCurta: 'Formato profissional para sessões de massagem.',
    descricao: 'Óleo de massagem com CBD, em formato de 500ml para uso contínuo.',
    preco: 199.9,
    destaques: ['500ml', 'Uso em massagem'],
  }),
  produto({
    nome: 'Barra de Proteína CBD 20g',
    marca: 'Greens LIFE',
    categoria: 'outros-produtos',
    descricaoCurta: 'Snack funcional com CBD.',
    descricao: 'Barra de proteína com CBD adicionado, pensada como snack funcional do dia a dia.',
    preco: 19.9,
    destaques: ['Unidade de 40g', 'CBD 20mg'],
  }),
  produto({
    nome: 'Suplemento CBD + Magnésio',
    marca: 'Greens LIFE',
    categoria: 'outros-produtos',
    descricaoCurta: 'Combinação de CBD e magnésio em cápsulas.',
    descricao: 'Suplemento em cápsulas combinando CBD e magnésio para a rotina diária.',
    preco: 179.9,
    destaques: ['60 cápsulas', 'CBD + Magnésio'],
  }),
  produto({
    nome: 'Kit Viagem Be4Hope',
    marca: 'Be4Hope',
    categoria: 'outros-produtos',
    descricaoCurta: 'Frasco dosador e estojo para levar o tratamento para qualquer lugar.',
    descricao: 'Estojo de viagem com frasco dosador, pensado para manter o tratamento em dia fora de casa.',
    preco: 89.9,
    destaques: ['Frasco dosador 10ml', 'Estojo compacto'],
  }),
];

export const PRODUTOS: Produto[] = [...OLEOS, ...CAPSULAS, ...OUTROS];

export function listarCategorias(): CategoriaProduto[] {
  return CATEGORIAS;
}

export function obterCategoria(slug: string): CategoriaProduto | undefined {
  return CATEGORIAS.find((categoria) => categoria.slug === slug);
}

export interface FiltroProdutos {
  busca?: string;
  categoria?: string;
  pagina?: number;
  porPagina?: number;
}

export interface ResultadoProdutos {
  itens: Produto[];
  total: number;
  totalPaginas: number;
  paginaAtual: number;
}

export function listarProdutos(filtro: FiltroProdutos = {}): ResultadoProdutos {
  const { busca, categoria, pagina = 1, porPagina = 12 } = filtro;

  let filtrados = PRODUTOS;

  if (categoria) {
    filtrados = filtrados.filter((p) => p.categoria === categoria);
  }

  if (busca && busca.trim().length > 0) {
    const termo = busca.trim().toLowerCase();
    filtrados = filtrados.filter(
      (p) =>
        p.nome.toLowerCase().includes(termo) ||
        p.descricaoCurta.toLowerCase().includes(termo) ||
        p.marca.toLowerCase().includes(termo),
    );
  }

  const total = filtrados.length;
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const paginaAtual = Math.min(Math.max(1, pagina), totalPaginas);
  const inicio = (paginaAtual - 1) * porPagina;

  return {
    itens: filtrados.slice(inicio, inicio + porPagina),
    total,
    totalPaginas,
    paginaAtual,
  };
}

export function obterProdutoPorId(id: string): Produto | undefined {
  return PRODUTOS.find((p) => p.id === id);
}

export function listarProdutosRelacionados(produtoAtual: Produto, limite = 4): Produto[] {
  return PRODUTOS.filter((p) => p.categoria === produtoAtual.categoria && p.id !== produtoAtual.id).slice(
    0,
    limite,
  );
}

export function listarProdutosEmDestaque(limite = 8): Produto[] {
  return PRODUTOS.filter((p) => p.badges.length > 0).slice(0, limite);
}

export function formatarPreco(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
