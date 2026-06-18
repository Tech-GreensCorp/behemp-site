'use client';

import { useState } from 'react';
import { Search, Download, BookOpen, Leaf, Brain, Heart, Microscope, ChevronRight, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/* ──────────────────────────────────────────────
   Tipos
─────────────────────────────────────────────── */
interface Ebook {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  pages: number;
  year: number;
  tag: string;
  color: string; // gradient css string
  available: boolean;
}

/* ──────────────────────────────────────────────
   Dados mockados — serão substituídos por CMS
─────────────────────────────────────────────── */
const CATEGORIES = [
  { id: 'todos', label: 'Todos', icon: BookOpen },
  { id: 'cannabis', label: 'Cannabis Medicinal', icon: Leaf },
  { id: 'neurologia', label: 'Neurologia', icon: Brain },
  { id: 'cronicas', label: 'Doenças Crônicas', icon: Heart },
  { id: 'ciencia', label: 'Ciência', icon: Microscope },
];

const EBOOKS: Ebook[] = [
  {
    id: '1',
    title: 'Guia Completo da Medicina Endocanabinóide',
    subtitle: 'Uma introdução aprofundada ao sistema endocanabinoide e seus mecanismos.',
    category: 'ciencia',
    pages: 48,
    year: 2024,
    tag: 'Introdução',
    color: 'linear-gradient(135deg, #2D4F3C 0%, #3d6e53 100%)',
    available: false,
  },
  {
    id: '2',
    title: 'Cannabis e Epilepsia: O que a Ciência Diz',
    subtitle: 'Revisão das evidências clínicas sobre canabidiol no controle de crises epilépticas.',
    category: 'neurologia',
    pages: 36,
    year: 2024,
    tag: 'Pesquisa',
    color: 'linear-gradient(135deg, #C34C32 0%, #d96b50 100%)',
    available: false,
  },
  {
    id: '3',
    title: 'Dor Crônica e Canabinoides',
    subtitle: 'Entenda como os canabinoides modulam a percepção da dor e melhoram a qualidade de vida.',
    category: 'cronicas',
    pages: 52,
    year: 2025,
    tag: 'Clínico',
    color: 'linear-gradient(135deg, #8A7F73 0%, #a89e91 100%)',
    available: false,
  },
  {
    id: '4',
    title: 'Fibromialgia e Cannabis Medicinal',
    subtitle: 'Protocolo de acompanhamento e evidências para pacientes com fibromialgia.',
    category: 'cronicas',
    pages: 40,
    year: 2025,
    tag: 'Protocolo',
    color: 'linear-gradient(135deg, #4a3728 0%, #6b5040 100%)',
    available: false,
  },
  {
    id: '5',
    title: 'Ansiedade e CBD: Guia Prático',
    subtitle: 'Como o canabidiol age sobre o sistema nervoso e os estudos mais recentes sobre ansiedade.',
    category: 'neurologia',
    pages: 32,
    year: 2024,
    tag: 'Prático',
    color: 'linear-gradient(135deg, #2D4F3C 0%, #4a7a5e 100%)',
    available: false,
  },
  {
    id: '6',
    title: 'Regulamentação da Cannabis no Brasil',
    subtitle: 'Um panorama completo sobre a legislação brasileira e como obter acesso legal ao tratamento.',
    category: 'cannabis',
    pages: 28,
    year: 2025,
    tag: 'Jurídico',
    color: 'linear-gradient(135deg, #C34C32 0%, #e8896e 100%)',
    available: false,
  },
];

/* ──────────────────────────────────────────────
   Componente principal
─────────────────────────────────────────────── */
export function EbooksContent() {
  const [activeCategory, setActiveCategory] = useState('todos');
  const [search, setSearch] = useState('');

  const filtered = EBOOKS.filter((e) => {
    const matchCat = activeCategory === 'todos' || e.category === activeCategory;
    const matchSearch =
      search === '' ||
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.subtitle.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="space-y-10">
      {/* ── Search ─────────────────────────────── */}
      <div className="relative max-w-lg mx-auto">
        <Search
          size={16}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
        />
        <input
          type="text"
          placeholder="Buscar ebook..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-12 rounded-full border border-border bg-card pl-11 pr-5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-secondary/40 transition-shadow"
        />
      </div>

      {/* ── Category filters ───────────────────── */}
      <div className="flex flex-wrap justify-center gap-2">
        {CATEGORIES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveCategory(id)}
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-all duration-200 border',
              activeCategory === id
                ? 'bg-secondary text-white border-secondary shadow-md'
                : 'bg-card text-foreground/70 border-border hover:border-secondary/40 hover:text-secondary'
            )}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Grid ──────────────────────────────── */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((ebook) => (
            <EbookCard key={ebook.id} ebook={ebook} />
          ))}
        </div>
      ) : (
        <div className="py-24 text-center text-muted-foreground text-sm">
          Nenhum ebook encontrado para esta busca.
        </div>
      )}

      {/* ── Coming-soon notice ─────────────────── */}
      <p className="text-center text-xs text-muted-foreground pt-4">
        Novos materiais sendo preparados pela nossa equipe clínica. Fique atento.
      </p>
    </div>
  );
}

/* ──────────────────────────────────────────────
   Card de ebook
─────────────────────────────────────────────── */
function EbookCard({ ebook }: { ebook: Ebook }) {
  return (
    <div
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card',
        'shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1'
      )}
    >
      {/* Cover */}
      <div
        className="relative h-48 flex flex-col items-center justify-center px-6"
        style={{ background: ebook.color }}
      >
        {/* Pattern overlay */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(255,255,255,.15) 20px, rgba(255,255,255,.15) 21px)',
          }}
        />

        {/* Coming soon badge */}
        {!ebook.available && (
          <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-white/20 backdrop-blur-sm px-3 py-1 text-[10px] font-semibold text-white uppercase tracking-wider">
            <Lock size={9} />
            Em breve
          </span>
        )}

        {/* Tag */}
        <span className="mb-3 rounded-full bg-white/20 backdrop-blur-sm px-3 py-0.5 text-[10px] font-bold text-white uppercase tracking-widest">
          {ebook.tag}
        </span>

        {/* Title on cover */}
        <h3 className="font-display text-center text-lg font-bold leading-snug text-white drop-shadow-sm line-clamp-3">
          {ebook.title}
        </h3>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-4 p-5">
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">{ebook.subtitle}</p>

        {/* Meta */}
        <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground">
          <span>{ebook.pages} páginas</span>
          <span>{ebook.year}</span>
        </div>

        {/* Action */}
        {ebook.available ? (
          <Button
            size="sm"
            className="w-full rounded-full bg-secondary text-white font-semibold shadow-sm hover:bg-secondary/90 transition-all duration-200 flex items-center justify-center gap-2 border-0"
            nativeButton={false}
          >
            <Download size={14} />
            Baixar Grátis
          </Button>
        ) : (
          <button
            disabled
            className="w-full rounded-full border border-border bg-muted/50 text-muted-foreground text-sm font-medium py-2 cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Lock size={13} />
            Em breve
          </button>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   CTA section (exported separately for page)
─────────────────────────────────────────────── */
export function EbooksCta() {
  return (
    <div className="mt-24 rounded-3xl border border-secondary/20 bg-secondary/5 px-8 py-14 text-center">
      <span className="inline-block rounded-full bg-secondary/10 px-4 py-1 text-xs font-semibold text-secondary uppercase tracking-widest mb-5">
        Conteúdo exclusivo
      </span>
      <h2 className="font-display text-2xl font-bold sm:text-3xl mb-3">
        Quer receber os ebooks{' '}
        <span className="text-accent-italic">em primeira mão?</span>
      </h2>
      <p className="text-sm text-muted-foreground max-w-lg mx-auto mb-8 leading-relaxed">
        Seja acolhido pela nossa equipe e tenha acesso antecipado a materiais educativos, protocolos e guias clínicos
        desenvolvidos pelos nossos especialistas.
      </p>
      <a href="/#condicoes">
        <Button
          size="lg"
          className="bg-secondary hover:bg-secondary/90 text-white font-semibold rounded-full shadow-md hover:shadow-lg transition-all duration-300 px-8 h-12 flex items-center justify-center gap-2 border-0 text-sm cursor-pointer"
          nativeButton={false}
        >
          Iniciar acolhimento
          <ChevronRight size={16} />
        </Button>
      </a>
    </div>
  );
}
