'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Search,
  BookOpen,
  X,
  ChevronRight,
  Smile,
  Shield,
  HeartPulse,
  Brain,
  Sparkles,
  Heart,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Story {
  id: string;
  nome: string;
  idade: number;
  condicao: string;
  categoria: 'Autismo & TDAH' | 'Dor Crônica' | 'Saúde Mental' | 'Oncologia';
  depoimento: string;
  jornadaAntes: string;
  jornadaAcolhimento: string;
  jornadaDepois: string;
  relatoPor?: string;
  tempoAcompanhamento: string;
}

const CATEGORIES = ['Todas', 'Autismo & TDAH', 'Dor Crônica', 'Saúde Mental', 'Oncologia'] as const;

const STORIES_MOCK: Story[] = [
  {
    id: 'helena',
    nome: 'Helena Costa',
    idade: 64,
    condicao: 'Fibromialgia e Insônia Refratária',
    categoria: 'Dor Crônica',
    depoimento: 'Eu vivia à base de analgésicos fortes que agrediam meu estômago e não resolviam a dor. Com o acompanhamento da Be4Hope e a medicina endocanabinóide, voltei a dormir a noite inteira e a caminhar no parque sem dor.',
    jornadaAntes: 'Helena sofria há mais de 10 anos com dores generalizadas e fadiga crônica. As noites eram em claro, o que agravava ainda mais a fadiga no dia seguinte. Medicamentos alopáticos pesados causavam gastrite severa e pouca eficácia na modulação da dor.',
    jornadaAcolhimento: 'Após passar pela triagem gratuita na Be4Hope, ela foi prontamente acolhida pela equipe e encaminhada para um médico clínico de dor habilitado. Ela obteve sua prescrição personalizada de óleo de CBD de espectro completo (Full Spectrum) e o suporte para emitir a autorização da ANVISA de forma simples e rápida.',
    jornadaDepois: 'Em apenas 3 semanas de uso orientado do óleo de CBD, Helena relatou uma melhora de mais de 80% nas crises de dor. O sono regularizou completamente e ela pôde abandonar os analgésicos tradicionais, recuperando sua mobilidade e qualidade de vida diária.',
    tempoAcompanhamento: '1 ano de tratamento',
  },
  {
    id: 'julio',
    nome: 'Júlio',
    idade: 9,
    condicao: 'Autismo Nível 2 e TDAH',
    categoria: 'Autismo & TDAH',
    relatoPor: 'relato da mãe, Sandra',
    depoimento: 'O Júlio tinha crises frequentes de choro e autoagressão por não conseguir expressar suas frustrações. O tratamento trouxe a calma que ele precisava para focar na escola e se desenvolver.',
    jornadaAntes: 'Júlio passava por altos níveis de ansiedade e hipersensibilidade sensorial, gerando crises de desregulação emocional intensas que afetavam o ambiente familiar e escolar. Ele tinha extrema dificuldade de manter o foco nas sessões de terapia comportamental.',
    jornadaAcolhimento: 'A família buscou acolhimento na Be4Hope. Através de um neurologista infantil parceiro, foi introduzido um protocolo à base de fitocanabinóides isolados e microdoses de THC. A Be4Hope auxiliou na documentação e forneceu o acompanhamento de dosagem pós-consulta.',
    jornadaDepois: 'Com a estabilização da dosagem, o número de crises de choro reduziu drasticamente. Júlio passou a se comunicar melhor, a dormir de forma contínua e a render muito mais nas sessões de terapia ocupacional e fonoaudiologia, promovendo harmonia em casa.',
    tempoAcompanhamento: '8 meses de tratamento',
  },
  {
    id: 'roberto',
    nome: 'Roberto Antunes',
    idade: 47,
    condicao: 'Dor Neuropática (Hérnia de Disco)',
    categoria: 'Dor Crônica',
    depoimento: 'A dor na perna era constante, como choques elétricos insuportáveis. O tratamento equilibrado me devolveu a capacidade de trabalhar e a alegria de viver.',
    jornadaAntes: 'Com duas hérnias de disco lombares, Roberto sentia dor constante irradiada para os membros inferiores. Passou por múltiplos bloqueios analgésicos e cirurgias descompressivas, mas as dores neuropáticas continuavam ativas, limitando suas atividades profissionais.',
    jornadaAcolhimento: 'Roberto realizou a triagem na Be4Hope. Foi encaminhado a um neurocirurgião especialista em canabinóides, que prescreveu uma formulação de CBD associada ao THC em proporções controladas para modular os impulsos neurais da dor.',
    jornadaDepois: 'O alívio da dor neuropática permitiu a Roberto diminuir em mais de 70% o uso de analgésicos opioides. Ele retornou às suas atividades de escritório sem desconfortos limitantes e reiniciou exercícios físicos de fortalecimento.',
    tempoAcompanhamento: '18 meses de tratamento',
  },
  {
    id: 'mariana',
    nome: 'Mariana Azevedo',
    idade: 32,
    condicao: 'Ansiedade Generalizada e Síndrome do Pânico',
    categoria: 'Saúde Mental',
    depoimento: 'Eu não conseguia sair de casa com medo de sofrer crises de pânico repentinas. A cannabis medicinal regulou meu sistema nervoso de forma equilibrada e sem os efeitos colaterais dos tarjas-pretas.',
    jornadaAntes: 'Diagnosticada com transtorno de ansiedade generalizada (TAG), Mariana enfrentava insônia, crises de taquicardia diárias e crises de pânico recorrentes que começaram a isolá-la socialmente. Os ansiolíticos convencionais causavam fadiga extrema durante o dia.',
    jornadaAcolhimento: 'Por meio do acolhimento Be4Hope, Mariana foi direcionada a uma psiquiatra integrativa. Juntas, estruturaram um tratamento com CBD de amplo espectro (Broad Spectrum) para uso diário sublingual, visando a regulação do sistema endocanabinóide.',
    jornadaDepois: 'Após a regulação da dose, Mariana relatou uma sensação de calma contínua sem letargia. As crises de pânico desapareceram e ela conseguiu retirar a medicação controlada sob supervisão médica, retomando sua rotina profissional e social.',
    tempoAcompanhamento: '6 meses de tratamento',
  },
  {
    id: 'beatriz',
    nome: 'Beatriz Vasconcellos',
    idade: 58,
    condicao: 'Suporte Oncológico (Câncer de Mama)',
    categoria: 'Oncologia',
    depoimento: 'A quimioterapia tirava todo o meu apetite e causava enjoos insuportáveis. O suporte fitoterápico foi essencial para eu conseguir me alimentar bem e manter minhas forças.',
    jornadaAntes: 'No início da quimioterapia, Beatriz sofria com náuseas severas refratárias a antieméticos tradicionais. A perda acelerada de peso e a falta de energia colocavam em risco a continuidade dos ciclos do tratamento oncológico.',
    jornadaAcolhimento: 'A Be4Hope prestou acolhimento humanizado a Beatriz, conectando-a a um oncologista integrativo. Foi receitado um óleo com proporções balanceadas de CBD e THC para controle de efeitos colaterais quimioterápicos.',
    jornadaDepois: 'Com o uso do fitoterápico canábico, a náusea diminuiu quase por completo. Beatriz recuperou o apetite, ganhou peso e conseguiu completar todas as sessões de quimioterapia planejadas com muito mais energia e disposição.',
    tempoAcompanhamento: '5 meses de tratamento',
  },
  {
    id: 'lucas',
    nome: 'Lucas Martins',
    idade: 23,
    condicao: 'TDAH e Ansiedade Acadêmica',
    categoria: 'Autismo & TDAH',
    depoimento: 'Eu não conseguia me concentrar por mais de 10 minutos seguidos nos estudos de Engenharia. O tratamento me ajudou a desacelerar os pensamentos ansiosos e ter foco.',
    jornadaAntes: 'Diagnosticado com TDAH desde a infância, Lucas sofria com hiperatividade mental e ansiedade em períodos de exames universitários. Medicamentos psicoestimulantes convencionais causavam taquicardia intensa e picos de irritabilidade.',
    jornadaAcolhimento: 'A Be4Hope o conectou a um médico neurologista. O especialista indicou o uso de óleo de CBD isolado associado a canabinóides secundários para suporte cognitivo e modulação de ansiedade.',
    jornadaDepois: 'Lucas passou a estudar com foco mais calmo e prolongado, sem os efeitos rebotes causados por estimulantes sintéticos. A qualidade do seu sono melhorou significativamente, diminuindo os níveis de estresse acadêmico.',
    tempoAcompanhamento: '1 ano de tratamento',
  },
];

export function HistoriasContent() {
  const [selectedCategory, setSelectedCategory] = React.useState<typeof CATEGORIES[number]>('Todas');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [activeStory, setActiveStory] = React.useState<Story | null>(null);

  const filteredStories = React.useMemo(() => {
    return STORIES_MOCK.filter((story) => {
      const matchCategory = selectedCategory === 'Todas' || story.categoria === selectedCategory;
      const matchSearch =
        story.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
        story.condicao.toLowerCase().includes(searchQuery.toLowerCase()) ||
        story.depoimento.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [selectedCategory, searchQuery]);

  const getCategoryIcon = (category: Story['categoria']) => {
    switch (category) {
      case 'Autismo & TDAH':
        return <Brain size={18} />;
      case 'Dor Crônica':
        return <HeartPulse size={18} />;
      case 'Saúde Mental':
        return <Smile size={18} />;
      case 'Oncologia':
        return <Shield size={18} />;
    }
  };

  return (
    <div className="space-y-12">
      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 bg-card p-6 rounded-2xl shadow-sm border border-border/40">
        {/* Categorias */}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => {
            const count = cat === 'Todas'
              ? STORIES_MOCK.length
              : STORIES_MOCK.filter((s) => s.categoria === cat).length;
            const isSelected = selectedCategory === cat;

            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  'px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer border',
                  isSelected
                    ? 'bg-secondary text-white border-secondary'
                    : 'bg-muted/40 hover:bg-muted text-stone-600 border-border/60'
                )}
              >
                {cat !== 'Todas' && getCategoryIcon(cat as Story['categoria'])}
                <span>{cat}</span>
                <span className={cn(
                  'h-4 min-w-4 px-1 rounded-full text-[10px] flex items-center justify-center font-bold',
                  isSelected ? 'bg-white/20 text-white' : 'bg-stone-200 text-stone-700'
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Busca */}
        <div className="relative w-full md:max-w-xs">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar relatos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-full bg-muted/40 hover:bg-muted/60 focus:bg-background border border-border/60 focus:border-primary/50 text-sm outline-none transition-all"
          />
        </div>
      </div>

      {/* Grid de Histórias */}
      {filteredStories.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredStories.map((story) => (
            <Card
              key={story.id}
              onClick={() => setActiveStory(story)}
              className="group border-0 bg-card shadow-sm hover:shadow-md transition-all duration-300 rounded-2xl cursor-pointer flex flex-col justify-between"
            >
              <CardContent className="p-8 flex flex-col justify-between h-full space-y-6">
                <div>
                  {/* Badge da Categoria */}
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary mb-5">
                    {getCategoryIcon(story.categoria)}
                    {story.categoria}
                  </span>

                  {/* Depoimento Rápido */}
                  <p className="text-foreground font-display text-lg leading-relaxed font-semibold italic">
                    “{story.depoimento}”
                  </p>
                </div>

                <div className="border-t border-border/60 pt-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-stone-800">
                      {story.nome}, {story.idade} anos
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      {story.relatoPor ? `${story.relatoPor} · ` : ''}{story.condicao}
                    </p>
                  </div>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary/10 text-secondary transition-colors group-hover:bg-secondary group-hover:text-white">
                    <ChevronRight size={16} />
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-card border border-border/40 rounded-2xl space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted text-stone-400">
            <BookOpen size={28} />
          </div>
          <h3 className="font-semibold text-lg">Nenhum relato encontrado</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Não encontramos nenhuma história contendo os filtros ou termos digitados. Tente alterar sua pesquisa.
          </p>
        </div>
      )}

      {/* Modal / Dialog de Detalhe da Jornada */}
      {activeStory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-[#F5F2ED] rounded-2xl shadow-2xl border border-border flex flex-col p-6 sm:p-10 animate-fade-up">
            {/* Botão fechar */}
            <button
              onClick={() => setActiveStory(null)}
              className="absolute right-4 top-4 h-9 w-9 rounded-full bg-[#1A1612]/5 hover:bg-[#1A1612]/10 flex items-center justify-center text-stone-700 transition-colors cursor-pointer"
              aria-label="Fechar modal"
            >
              <X size={18} />
            </button>

            {/* Header do Modal */}
            <div className="space-y-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary">
                {getCategoryIcon(activeStory.categoria)}
                {activeStory.categoria}
              </span>
              <h2 className="font-display text-3xl font-bold text-foreground">
                A jornada de {activeStory.nome}
              </h2>
              <p className="text-sm text-stone-500">
                {activeStory.idade} anos · {activeStory.condicao}
              </p>
            </div>

            {/* Divisor */}
            <div className="h-px bg-border/80 my-6" />

            {/* Painel de Metadados do Tratamento */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-white/70 border border-border/40 p-5 rounded-2xl mb-8">
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-primary" />
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Acompanhamento</p>
                  <p className="text-xs font-semibold text-stone-800">{activeStory.tempoAcompanhamento}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Smile size={18} className="text-secondary" />
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Status Atual</p>
                  <p className="text-xs font-semibold text-stone-800">Melhora significativa</p>
                </div>
              </div>
              <div className="flex items-center gap-2 col-span-2 sm:col-span-1">
                <Heart size={18} className="text-rose-500" />
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Apoio Be4Hope</p>
                  <p className="text-xs font-semibold text-stone-800">Acolhimento & Suporte Anvisa</p>
                </div>
              </div>
            </div>

            {/* Conteúdo da História (Capítulos) */}
            <div className="space-y-6 text-sm text-stone-700 leading-relaxed">
              <div className="border-l-2 border-primary/20 pl-4 space-y-2">
                <h4 className="font-bold text-foreground uppercase tracking-wider text-[11px]">1. O Início das Dificuldades</h4>
                <p>{activeStory.jornadaAntes}</p>
              </div>

              <div className="border-l-2 border-secondary/20 pl-4 space-y-2">
                <h4 className="font-bold text-foreground uppercase tracking-wider text-[11px]">2. O Encontro com a Be4Hope</h4>
                <p>{activeStory.jornadaAcolhimento}</p>
              </div>

              <div className="border-l-2 border-emerald-500/20 pl-4 space-y-2">
                <h4 className="font-bold text-foreground uppercase tracking-wider text-[11px]">3. A Transformação Real</h4>
                <p>{activeStory.jornadaDepois}</p>
              </div>
            </div>

            {/* Footer do Modal */}
            <div className="mt-8 pt-6 border-t border-border/80 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setActiveStory(null)}
                className="rounded-full px-6 text-stone-700 hover:bg-stone-100"
              >
                Fechar
              </Button>
              <a href="/#condicoes" onClick={() => setActiveStory(null)}>
                <Button
                  className="bg-[#16a34a] hover:bg-[#148f43] text-white rounded-full px-6 border-0"
                >
                  Iniciar meu acolhimento
                </Button>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
