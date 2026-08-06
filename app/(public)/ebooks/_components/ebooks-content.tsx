'use client';

import { useState } from 'react';
import { Search, Download, BookOpen, Leaf, Brain, Heart, Microscope, ChevronRight, Lock, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { salvarLeadEbook } from '@/app/(public)/_actions/ebooks';
import { toast } from 'sonner';

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
  filename: string;
}

/* ──────────────────────────────────────────────
   Dados mockados — serão substituídos por CMS
─────────────────────────────────────────────── */
const CATEGORIES = [
  { id: 'todos', label: 'Todos', icon: BookOpen },
  { id: 'cannabis', label: 'Medicina Endocanabinoide', icon: Leaf },
  { id: 'neurologia', label: 'Neurologia', icon: Brain },
];

const EBOOKS: Ebook[] = [
  {
    id: '1',
    title: 'Guia de Medicina Endocanabinoide',
    subtitle: 'Um guia prático sobre a história, a ciência e os tratamentos com canabinoides no Brasil.',
    category: 'cannabis',
    pages: 33,
    year: 2026,
    tag: 'Guia Prático',
    color: 'linear-gradient(135deg, #2D4F3C 0%, #3d6e53 100%)',
    available: true,
    filename: 'ebook_cannabis_medicinal.pdf',
  },
  {
    id: '2',
    title: 'Autismo e Medicina Endocanabinoide',
    subtitle: 'Como os canabinoides podem auxiliar no manejo de sintomas, comportamento e qualidade de vida no TEA.',
    category: 'neurologia',
    pages: 78,
    year: 2026,
    tag: 'Autismo',
    color: 'linear-gradient(135deg, #8A7F73 0%, #a89e91 100%)',
    available: true,
    filename: 'EBOOK BE AUTISMO.pdf',
  },
  {
    id: '3',
    title: 'Epilepsia e Medicina Endocanabinoide',
    subtitle: 'O papel do CBD e outros fitocanabinoides no controle de crises refratárias e qualidade de vida.',
    category: 'neurologia',
    pages: 78,
    year: 2026,
    tag: 'Epilepsia',
    color: 'linear-gradient(135deg, #C34C32 0%, #d96b50 100%)',
    available: true,
    filename: 'EBOOK BE EPILEPSIA.pdf',
  },
];

/* ──────────────────────────────────────────────
   Componente principal
─────────────────────────────────────────────── */
export function EbooksContent() {
  const [activeCategory, setActiveCategory] = useState('todos');
  const [search, setSearch] = useState('');

  // Lead capture form state
  const [selectedEbook, setSelectedEbook] = useState<Ebook | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const formatTelefone = (val: string) => {
    const clean = val.replace(/\D/g, '');
    if (clean.length <= 10) {
      return clean.replace(/(\d{2})(\d{4})(\d{0,4})/, (_, p1, p2, p3) => {
        let res = '';
        if (p1) res += `(${p1}`;
        if (p2) res += `) ${p2}`;
        if (p3) res += `-${p3}`;
        return res;
      });
    } else {
      return clean.slice(0, 11).replace(/(\d{2})(\d{5})(\d{0,4})/, (_, p1, p2, p3) => {
        let res = '';
        if (p1) res += `(${p1}`;
        if (p2) res += `) ${p2}`;
        if (p3) res += `-${p3}`;
        return res;
      });
    }
  };

  const handleDownloadClick = (ebook: Ebook) => {
    setSelectedEbook(ebook);
    setIsOpen(true);
  };

  const handleManualDownload = () => {
    if (!selectedEbook) return;
    const link = document.createElement('a');
    link.href = `/ebooks/${encodeURIComponent(selectedEbook.filename)}`;
    link.download = selectedEbook.filename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Download reiniciado!');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEbook) return;

    if (!nome.trim() || !email.trim() || !telefone.trim()) {
      toast.error('Por favor, preencha todos os campos.');
      return;
    }

    setEnviando(true);
    try {
      const res = await salvarLeadEbook({
        nome,
        email,
        telefone,
        ebookId: selectedEbook.id,
        ebookTitle: selectedEbook.title,
      });

      if (res.sucesso) {
        setIsSuccess(true);
        setNome('');
        setEmail('');
        setTelefone('');

        // Programmatic download
        const link = document.createElement('a');
        link.href = `/ebooks/${encodeURIComponent(selectedEbook.filename)}`;
        link.download = selectedEbook.filename;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        toast.error(res.erro || 'Erro ao processar o download. Tente novamente.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Ocorreu um erro ao processar seu download.');
    } finally {
      setEnviando(false);
    }
  };

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
      {/* <div className="relative max-w-lg mx-auto">
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
      </div> */}

      {/* ── Category filters ───────────────────── */}
      <div className="flex flex-wrap justify-center gap-2">
        {CATEGORIES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveCategory(id)}
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-all duration-200 border',
              activeCategory === id
                ? 'bg-primary text-white border-primary shadow-md'
                : 'bg-card text-foreground/70 border-border hover:border-primary/40 hover:text-primary'
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
            <EbookCard
              key={ebook.id}
              ebook={ebook}
              onDownloadClick={handleDownloadClick}
            />
          ))}
        </div>
      ) : (
        <div className="py-24 text-center text-muted-foreground text-sm">
          Nenhum ebook encontrado para esta busca.
        </div>
      )}

      {/* ── Lead Capture Dialog ────────────────── */}
      <Dialog open={isOpen} onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) {
          setIsSuccess(false);
        }
      }}>
        <DialogContent className="sm:max-w-md bg-popover border border-border rounded-2xl p-6 shadow-xl z-[100]">
          {!isSuccess ? (
            <>
              <DialogHeader className="space-y-2 text-center">
                <DialogTitle className="font-display text-2xl font-semibold text-primary">
                  Liberar material
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Preencha os dados abaixo para abrir o ebook gratuito:{' '}
                  <strong className="text-foreground">{selectedEbook?.title}</strong>
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4 mt-4 text-left">
                <div className="space-y-1.5">
                  <Label htmlFor="nome" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Nome completo
                  </Label>
                  <Input
                    id="nome"
                    type="text"
                    placeholder="Seu nome completo"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required
                    className="bg-background border-border rounded-xl h-10 px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    E-mail
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-background border-border rounded-xl h-10 px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="telefone" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    WhatsApp / Telefone
                  </Label>
                  <Input
                    id="telefone"
                    type="tel"
                    placeholder="(11) 99999-9999"
                    value={telefone}
                    onChange={(e) => setTelefone(formatTelefone(e.target.value))}
                    required
                    className="bg-background border-border rounded-xl h-10 px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={enviando}
                  className="w-full bg-primary hover:bg-primary/90 text-white font-semibold rounded-full h-11 transition-all duration-300 shadow-md flex items-center justify-center gap-2 cursor-pointer mt-6"
                >
                  {enviando ? (
                    <span>Acessando...</span>
                  ) : (
                    <>
                      <Download size={16} />
                      Baixar Grátis
                    </>
                  )}
                </Button>
              </form>

              <p className="text-[10px] text-center text-muted-foreground mt-4">
                🔒 Seus dados estão seguros e protegidos de acordo com a LGPD.
              </p>
            </>
          ) : (
            <div className="text-center py-6 space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <CheckCircle2 size={36} className="text-primary animate-in zoom-in duration-300" />
              </div>
              <DialogHeader className="space-y-2 text-center">
                <DialogTitle className="font-display text-2xl font-semibold text-primary">
                  Download Iniciado!
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
                  O download do ebook <strong className="text-foreground">{selectedEbook?.title}</strong> foi iniciado automaticamente.
                </DialogDescription>
              </DialogHeader>

              <div className="pt-4 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Se o download não iniciou automaticamente, clique no botão abaixo para baixar novamente:
                </p>
                <Button
                  onClick={handleManualDownload}
                  className="w-full bg-primary hover:bg-primary/90 text-white font-semibold rounded-full h-11 transition-all duration-300 shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download size={16} />
                  Baixar Novamente
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  className="w-full rounded-full border-border hover:bg-muted text-foreground font-semibold h-11 transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
                >
                  Fechar Janela
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Coming-soon notice ─────────────────── */}
      <p className="text-center text-xs text-muted-foreground pt-4 -mb-10">
        Biblioteca em atualização contínua: nossa equipe clínica publica novos materiais todos os meses.
      </p>
    </div>
  );
}

/* ──────────────────────────────────────────────
   Card de ebook
─────────────────────────────────────────────── */
interface EbookCardProps {
  ebook: Ebook;
  onDownloadClick: (ebook: Ebook) => void;
}

function EbookCard({ ebook, onDownloadClick }: EbookCardProps) {
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
        <h3 className="text-center text-lg font-bold leading-snug text-white drop-shadow-sm line-clamp-3">
          {ebook.title}
        </h3>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-4 p-5">
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">{ebook.subtitle}</p>

        {/* Meta */}
        <div className="mt-auto pt-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
          <span>{ebook.pages} páginas</span>
          <span>{ebook.year}</span>
        </div>

        {/* Action */}
        {ebook.available ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDownloadClick(ebook)}
            className="w-full rounded-full border-primary/40 text-primary hover:bg-primary hover:text-white hover:border-primary font-semibold transition-all duration-300 flex items-center justify-center gap-2 h-10 cursor-pointer text-sm"
            nativeButton={false}
          >
            <Download size={14} />
            Baixar Grátis
          </Button>
        ) : (
          <button
            disabled
            className="w-full rounded-full border border-border bg-muted/30 text-muted-foreground/50 text-xs font-medium h-10 cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Lock size={12} />
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
    <div className="mt-24 rounded-2xl border border-secondary/20 bg-secondary/5 px-8 py-14 text-center">
      <span className="inline-block rounded-full bg-secondary/10 px-4 py-1 text-xs font-semibold text-secondary uppercase tracking-widest mb-5">
        Cuidado e Acolhimento
      </span>
      <h2 className="font-display text-2xl font-bold sm:text-3xl mb-3">
        <span className="text-accent-italic">Você {' '}</span>
        não precisa enfrentar tudo sozinho.
      </h2>
      <p className="text-sm text-muted-foreground max-w-lg mx-auto mb-8 leading-relaxed">
        Seja acolhido pela nossa equipe e tenha acesso antecipado a materiais educativos, protocolos e guias clínicos
        desenvolvidos pelos nossos especialistas.
      </p>
      <div className="flex justify-center">
        <a href="/#condicoes">
          <Button
            size="lg"
            className="bg-[#16a34a] hover:bg-[#148f43] text-white font-semibold rounded-full shadow-md hover:shadow-lg transition-all duration-300 px-8 h-12 inline-flex items-center justify-center gap-2 border-0 text-sm cursor-pointer animate-active-pulse"
            nativeButton={false}
          >
            Iniciar acolhimento
            <ChevronRight size={16} />
          </Button>
        </a>
      </div>
    </div>
  );
}
