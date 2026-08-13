'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Loader2, Upload, FileText, X } from 'lucide-react';
import { removerArquivoProduto } from '@/app/(admin)/_actions/produtos';
import type { ProdutoArquivoAdmin } from '@/app/(admin)/_actions/produtos';

type Categoria = ProdutoArquivoAdmin['categoria'];

interface ProdutoArquivosSectionProps {
  produtoId: string;
  arquivos: ProdutoArquivoAdmin[];
}

const IMAGENS: { categoria: Categoria; label: string; ajuda: string }[] = [
  { categoria: 'imagem', label: 'Produto', ajuda: 'Aparece no catálogo e na listagem.' },
  { categoria: 'formula', label: 'Fórmula', ajuda: 'Imagem da fórmula/composição do produto.' },
];

const DOCUMENTOS: { categoria: Categoria; label: string }[] = [
  { categoria: 'coa', label: 'COA' },
  { categoria: 'ficha_tecnica', label: 'Ficha Técnica' },
  { categoria: 'ficha_informativa', label: 'Ficha Informativa' },
];

export function ProdutoArquivosSection({ produtoId, arquivos }: ProdutoArquivosSectionProps) {
  return (
    <div className="bg-card space-y-6 rounded-xl border p-5 shadow-sm">
      <div>
        <h2 className="text-sm font-semibold">Imagens</h2>
        <p className="text-muted-foreground text-xs">Foto do produto e imagem da fórmula.</p>
        <div className="mt-3 grid max-w-sm grid-cols-2 gap-4">
          {IMAGENS.map((img) => (
            <div key={img.categoria} className="space-y-1.5">
              <p className="text-xs font-medium">{img.label}</p>
              <ImagemSlot
                produtoId={produtoId}
                categoria={img.categoria}
                arquivo={arquivos.find((a) => a.categoria === img.categoria)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="border-t pt-5">
        <h2 className="text-sm font-semibold">Documentos (opcional)</h2>
        <p className="text-muted-foreground text-xs">
          Substitua ou adicione documentos se necessário
        </p>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {DOCUMENTOS.map((doc) => (
            <DocumentoSlot
              key={doc.categoria}
              produtoId={produtoId}
              categoria={doc.categoria}
              label={doc.label}
              arquivo={arquivos.find((a) => a.categoria === doc.categoria)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function useUpload(produtoId: string, categoria: Categoria) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);

  const enviar = async (file: File) => {
    setEnviando(true);
    const formData = new FormData();
    formData.append('arquivo', file);
    formData.append('produtoId', produtoId);
    formData.append('categoria', categoria);

    try {
      const res = await fetch('/api/upload-produto-arquivo', { method: 'POST', body: formData });
      const json = await res.json();
      if (!json.sucesso) {
        toast.error(json.erro ?? 'Erro ao enviar arquivo');
      } else {
        toast.success('Arquivo enviado');
        router.refresh();
      }
    } catch {
      toast.error('Erro ao enviar arquivo');
    } finally {
      setEnviando(false);
    }
  };

  return { enviar, enviando };
}

function DocumentoSlot({
  produtoId,
  categoria,
  label,
  arquivo,
}: {
  produtoId: string;
  categoria: Categoria;
  label: string;
  arquivo?: ProdutoArquivoAdmin;
}) {
  const { enviar, enviando } = useUpload(produtoId, categoria);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-1.5">
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) enviar(file);
          e.target.value = '';
        }}
      />
      {arquivo ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={enviando}
          className="bg-muted/30 hover:bg-muted/50 flex h-11 w-full items-center gap-2 rounded-lg border px-3 text-left transition-colors disabled:opacity-60"
        >
          <FileText size={16} className="text-muted-foreground shrink-0" />
          <span className="text-foreground flex-1 truncate text-xs">
            {arquivo.nomeArquivo ?? arquivo.id}
          </span>
          {enviando ? (
            <Loader2 size={14} className="text-muted-foreground shrink-0 animate-spin" />
          ) : (
            <Upload size={14} className="text-muted-foreground shrink-0" />
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={enviando}
          className="text-muted-foreground hover:border-primary/40 hover:text-primary flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-dashed text-xs transition-colors disabled:opacity-60"
        >
          {enviando ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          Selecionar arquivo
        </button>
      )}
    </div>
  );
}

function ImagemSlot({
  produtoId,
  categoria,
  arquivo,
}: {
  produtoId: string;
  categoria: Categoria;
  arquivo?: ProdutoArquivoAdmin;
}) {
  const { enviar, enviando } = useUpload(produtoId, categoria);
  const [removendo, setRemovendo] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const desabilitado = enviando || removendo;

  const handleRemover = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!arquivo) return;
    setRemovendo(true);
    const res = await removerArquivoProduto(arquivo.id);
    setRemovendo(false);
    if (res.sucesso) {
      toast.success('Imagem removida');
      router.refresh();
    } else {
      toast.error(res.erro ?? 'Erro ao remover imagem');
    }
  };

  const abrirSeletor = () => {
    if (!desabilitado) inputRef.current?.click();
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) enviar(file);
          e.target.value = '';
        }}
      />
      {/*
        Div (não <button>) porque o estado "preenchido" renderiza um botão de
        remover dentro deste container — <button> dentro de <button> é HTML
        inválido e quebra a hidratação do React. Mantém semântica de botão via
        role/tabIndex/onKeyDown.
      */}
      <div
        role="button"
        tabIndex={desabilitado ? -1 : 0}
        aria-disabled={desabilitado}
        onClick={abrirSeletor}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            abrirSeletor();
          }
        }}
        className={cn(
          'group bg-muted/20 hover:border-primary/40 relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border border-dashed transition-colors',
          desabilitado && 'pointer-events-none opacity-60',
        )}
      >
        {arquivo ? (
          <>
            <Image
              src={arquivo.urlBlob}
              alt={arquivo.nomeArquivo ?? ''}
              fill
              className="object-contain p-2"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
              <Upload size={18} className="text-white" />
            </div>
            <button
              type="button"
              onClick={handleRemover}
              disabled={removendo}
              className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/80"
            >
              {removendo ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
            </button>
          </>
        ) : enviando ? (
          <Loader2 size={20} className="text-muted-foreground animate-spin" />
        ) : (
          <div className="text-muted-foreground flex flex-col items-center gap-1.5">
            <Upload size={18} />
            <span className="text-[11px]">Selecionar</span>
          </div>
        )}
      </div>
    </>
  );
}
