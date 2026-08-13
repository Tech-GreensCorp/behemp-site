'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Save, Plus, X } from 'lucide-react';
import { criarProduto, atualizarProduto } from '@/app/(admin)/_actions/produtos';
import type { ProdutoAdmin, ProdutoArquivoAdmin } from '@/app/(admin)/_actions/produtos';
import { LINHAS_PRODUTO } from '@/lib/catalogo/linhas';
import { ProdutoArquivosSection } from './produto-arquivos-section';

interface ProdutoFormProps {
  produto?: ProdutoAdmin & { arquivos: ProdutoArquivoAdmin[] };
}

function maskSku(valor: string) {
  return valor.toUpperCase().replace(/[^A-Z0-9-]/g, '');
}

function precoParaDisplay(valor: string | null | undefined): string {
  if (!valor) return '';
  const numero = Number(valor);
  if (Number.isNaN(numero)) return '';
  return numero.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function maskPreco(digitado: string): string {
  const digitos = digitado.replace(/\D/g, '');
  if (!digitos) return '';
  const centavos = parseInt(digitos, 10);
  return (centavos / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function precoDisplayParaRaw(display: string): string | undefined {
  if (!display) return undefined;
  const semMilhar = display.replace(/\./g, '').replace(',', '.');
  return semMilhar;
}

export function ProdutoForm({ produto }: ProdutoFormProps) {
  const router = useRouter();
  const isEdit = !!produto;
  const [salvando, setSalvando] = useState(false);

  const [sku, setSku] = useState(produto?.sku ?? '');
  const [nome, setNome] = useState(produto?.nome ?? '');
  const [linhaProduto, setLinhaProduto] = useState(produto?.linhaProduto ?? '');
  const [precoDisplay, setPrecoDisplay] = useState(precoParaDisplay(produto?.preco));
  const [urlCompra, setUrlCompra] = useState(produto?.urlCompra ?? '');
  const [ativo, setAtivo] = useState(produto?.ativo ?? true);
  const [descricao, setDescricao] = useState<string[]>(
    produto?.descricao?.length ? produto.descricao : [''],
  );

  const atualizarLinhaDescricao = (idx: number, valor: string) => {
    setDescricao((atual) => atual.map((d, i) => (i === idx ? valor : d)));
  };

  const removerLinhaDescricao = (idx: number) => {
    setDescricao((atual) => atual.filter((_, i) => i !== idx));
  };

  const adicionarLinhaDescricao = () => setDescricao((atual) => [...atual, '']);

  const handleSalvar = async () => {
    setSalvando(true);
    const dados = {
      sku: sku.trim(),
      nome: nome.trim(),
      linhaProduto: (linhaProduto || undefined) as (typeof LINHAS_PRODUTO)[number] | undefined,
      descricao: descricao.map((d) => d.trim()).filter(Boolean),
      preco: precoDisplayParaRaw(precoDisplay),
      urlCompra: urlCompra.trim(),
      ativo,
    };

    if (isEdit) {
      const res = await atualizarProduto(produto.id, dados);
      setSalvando(false);
      if (!res.sucesso) {
        toast.error(res.erro ?? 'Erro ao salvar produto');
        return;
      }
      toast.success('Produto atualizado');
      router.refresh();
      return;
    }

    const res = await criarProduto(dados);
    setSalvando(false);
    if (!res.sucesso || !res.dados) {
      toast.error(res.erro ?? 'Erro ao criar produto');
      return;
    }
    toast.success('Produto criado');
    router.push(`/admin/produtos/${res.dados.produtoId}`);
  };

  return (
    <div className="space-y-4">
      <div className="bg-card space-y-4 rounded-xl border p-5 shadow-sm">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="col-span-1 space-y-1">
            <Label htmlFor="sku" className="text-xs">
              SKU
            </Label>
            <Input
              id="sku"
              value={sku}
              onChange={(e) => setSku(maskSku(e.target.value))}
              placeholder="Código único do produto"
              className="h-9"
            />
          </div>
          <div className="col-span-1 space-y-1">
            <Label htmlFor="linha" className="text-xs">
              Linha
            </Label>
            <Select value={linhaProduto} onValueChange={(v) => v && setLinhaProduto(v)}>
              <SelectTrigger id="linha" className="h-9 w-full">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {LINHAS_PRODUTO.map((linha) => (
                  <SelectItem key={linha} value={linha}>
                    {linha}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-1 space-y-1">
            <Label htmlFor="preco" className="text-xs">
              Preço (R$)
            </Label>
            <div className="relative">
              <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xs">
                R$
              </span>
              <Input
                id="preco"
                inputMode="decimal"
                value={precoDisplay}
                onChange={(e) => setPrecoDisplay(maskPreco(e.target.value))}
                placeholder="0,00"
                className="h-9 pl-8"
              />
            </div>
          </div>
          <div className="col-span-1 flex items-end justify-between gap-2 sm:justify-start">
            <Label htmlFor="ativo" className="text-xs">
              Ativo
            </Label>
            <Switch
              id="ativo"
              checked={ativo}
              onCheckedChange={setAtivo}
              className="ml-auto sm:ml-2"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="nome" className="text-xs">
              Nome
            </Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome comercial do produto"
              className="h-9"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="url-compra" className="text-xs">
              URL da plataforma de compra
            </Label>
            <Input
              id="url-compra"
              value={urlCompra}
              onChange={(e) => setUrlCompra(e.target.value)}
              placeholder="https://loja.parceira.com/produto/..."
              className="h-9"
            />
          </div>
        </div>

        <div className="space-y-1.5 border-t pt-3">
          <Label className="text-xs">Descrição</Label>
          <p className="text-muted-foreground text-[11px]">
            Especificações técnicas, um item por linha. Evite termos de indicação terapêutica
            (&quot;trata&quot;, &quot;cura&quot;) — catálogo institucional, não bula.
          </p>
          <div className="space-y-1.5">
            {descricao.map((linha, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <Input
                  value={linha}
                  onChange={(e) => atualizarLinhaDescricao(idx, e.target.value)}
                  placeholder="Ex: Concentração de 3% CBD"
                  className="h-8 text-sm"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground h-8 w-8 shrink-0"
                  onClick={() => removerLinhaDescricao(idx)}
                  disabled={descricao.length === 1}
                >
                  <X size={13} />
                </Button>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={adicionarLinhaDescricao}>
            <Plus size={14} />
            Adicionar linha
          </Button>
        </div>

        <div className="flex justify-end gap-2 border-t pt-3">
          <Button variant="outline" size="sm" onClick={() => router.push('/admin/produtos')}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSalvar} disabled={salvando} className="gap-2">
            {salvando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {isEdit ? 'Salvar alterações' : 'Criar produto'}
          </Button>
        </div>
        {!isEdit && (
          <p className="text-muted-foreground text-right text-[11px]">
            Imagens e documentos ficam disponíveis após criar o produto.
          </p>
        )}
      </div>

      {isEdit && <ProdutoArquivosSection produtoId={produto.id} arquivos={produto.arquivos} />}
    </div>
  );
}
