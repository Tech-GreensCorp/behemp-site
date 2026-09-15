'use client';

import { useState } from 'react';
import { Link2, Copy, Check, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { gerarLinkTeleconsultaAdmin } from '@/app/(admin)/_actions/link-teleconsulta';

/**
 * Botão + modal que geram a "porta 3" do cadastro (ADR-0022 §27/§34.1, D-15) — o link que
 * hoje só o ChatPro e o handoff da Greens emitem, agora também pelo painel, para agilizar
 * teste e atendimento manual. Nasce sempre no fluxo da teleconsulta (sem documento do
 * parceiro, receita pendente) — ver `link-teleconsulta.ts`.
 */
export function GerarLinkTeleconsultaDialog() {
  const [aberto, setAberto] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [resultado, setResultado] = useState<{ link: string; protocolo: string } | null>(null);
  const [nomeCompleto, setNomeCompleto] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');

  function resetar() {
    setResultado(null);
    setCopiado(false);
    setNomeCompleto('');
    setTelefone('');
    setEmail('');
  }

  async function handleGerar() {
    setGerando(true);
    const res = await gerarLinkTeleconsultaAdmin({ nomeCompleto, telefone, email });
    setGerando(false);
    if (res.sucesso && res.dados) {
      setResultado(res.dados);
    } else {
      toast.error(res.erro || 'Erro ao gerar o link');
    }
  }

  async function handleCopiar() {
    if (!resultado) return;
    await navigator.clipboard.writeText(resultado.link);
    setCopiado(true);
    toast.success('Link copiado!');
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <Dialog
      open={aberto}
      onOpenChange={(open) => {
        setAberto(open);
        if (!open) resetar();
      }}
    >
      <DialogTrigger render={<Button variant="outline" className="w-full gap-2 sm:w-auto" />}>
        <Link2 size={16} />
        Gerar link
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {!resultado ? (
          <>
            <DialogHeader>
              <DialogTitle>Gerar link de cadastro</DialogTitle>
              <DialogDescription>
                Cria uma solicitação de cadastro pelo fluxo da teleconsulta (sem receita nem
                autorização ANVISA ainda) — para teste ou para agilizar um atendimento manual.
                Todos os campos são opcionais.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="link-nome">Nome completo</Label>
                <Input
                  id="link-nome"
                  value={nomeCompleto}
                  onChange={(e) => setNomeCompleto(e.target.value)}
                  placeholder="Opcional"
                  disabled={gerando}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="link-telefone">Telefone</Label>
                  <Input
                    id="link-telefone"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    placeholder="Opcional"
                    disabled={gerando}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="link-email">E-mail</Label>
                  <Input
                    id="link-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Opcional"
                    disabled={gerando}
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setAberto(false)} disabled={gerando}>
                Cancelar
              </Button>
              <Button onClick={handleGerar} disabled={gerando} className="gap-1.5">
                {gerando ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Link2 size={14} />
                )}
                {gerando ? 'Gerando...' : 'Gerar link'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Link gerado</DialogTitle>
              <DialogDescription>
                Protocolo <strong className="text-foreground">{resultado.protocolo}</strong> —
                vale por 7 dias. O token só existe em hash no banco: se este link se perder,
                gere um novo (o anterior para de valer).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 py-2">
              <Label htmlFor="link-gerado">Link do cadastro</Label>
              <div className="flex gap-2">
                <Input id="link-gerado" value={resultado.link} readOnly className="font-mono text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={handleCopiar}
                >
                  {copiado ? (
                    <Check size={16} className="text-emerald-600" />
                  ) : (
                    <Copy size={16} />
                  )}
                </Button>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={resetar} className="gap-1.5">
                <RotateCcw size={14} />
                Gerar outro
              </Button>
              <Button onClick={() => setAberto(false)}>Fechar</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
