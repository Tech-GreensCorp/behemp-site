'use client';

import { useState, useTransition } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, FileText, Send } from 'lucide-react';
import { toast } from 'sonner';

interface ModalDadosProcuracaoProps {
  aberto: boolean;
  onFechar: () => void;
  autorizacaoId: string;
  dadosIniciais: {
    nacionalidade?: string;
    estadoCivil?: string;
    profissao?: string;
  };
  onSucesso: (resultado: {
    procuracaoId: string;
    urlPdf: string;
    stub: boolean;
    mensagem: string;
  }) => void;
}

export function ModalDadosProcuracao({
  aberto,
  onFechar,
  autorizacaoId,
  dadosIniciais,
  onSucesso,
}: ModalDadosProcuracaoProps) {
  const [isPending, startTransition] = useTransition();
  const [nacionalidade, setNacionalidade] = useState(dadosIniciais.nacionalidade ?? 'brasileiro(a)');
  const [estadoCivil, setEstadoCivil] = useState(dadosIniciais.estadoCivil ?? '');
  const [profissao, setProfissao] = useState(dadosIniciais.profissao ?? '');

  const handleGerar = () => {
    if (!estadoCivil) {
      toast.error('Informe seu estado civil.');
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch('/api/anvisa/procuracao', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            autorizacaoId,
            dadosComplementares: { nacionalidade, estadoCivil, profissao },
          }),
        });

        const data = await res.json() as {
          sucesso: boolean;
          dados?: { procuracaoId: string; urlPdf: string; docusignStatus: string; stub: boolean; mensagem: string };
          erro?: string;
        };

        if (data.sucesso && data.dados) {
          onSucesso(data.dados);
          onFechar();
        } else {
          toast.error(data.erro ?? 'Erro ao gerar documento.');
        }
      } catch {
        toast.error('Erro de conexão. Tente novamente.');
      }
    });
  };

  return (
    <Dialog open={aberto} onOpenChange={onFechar}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display font-bold text-lg">
            Dados para a Procuração Específica
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Informe os dados abaixo para gerar o documento. Serão salvos no seu perfil
            para uso futuro.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Nacionalidade */}
          <div className="space-y-1.5">
            <Label htmlFor="nacionalidade" className="text-sm font-medium">
              Nacionalidade
            </Label>
            <Input
              id="nacionalidade"
              value={nacionalidade}
              onChange={(e) => setNacionalidade(e.target.value)}
              placeholder="brasileiro(a)"
              className="rounded-xl"
            />
          </div>

          {/* Estado Civil */}
          <div className="space-y-1.5">
            <Label htmlFor="estado-civil" className="text-sm font-medium">
              Estado Civil <span className="text-primary">*</span>
            </Label>
            <Select value={estadoCivil} onValueChange={(val) => setEstadoCivil(val || '')}>
              <SelectTrigger id="estado-civil" className="rounded-xl">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="solteiro(a)">Solteiro(a)</SelectItem>
                <SelectItem value="casado(a)">Casado(a)</SelectItem>
                <SelectItem value="divorciado(a)">Divorciado(a)</SelectItem>
                <SelectItem value="viúvo(a)">Viúvo(a)</SelectItem>
                <SelectItem value="união estável">União Estável</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Profissão */}
          <div className="space-y-1.5">
            <Label htmlFor="profissao" className="text-sm font-medium">
              Profissão
            </Label>
            <Input
              id="profissao"
              value={profissao}
              onChange={(e) => setProfissao(e.target.value)}
              placeholder="Ex: Autônomo, Professor, Aposentado..."
              className="rounded-xl"
            />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            onClick={onFechar}
            disabled={isPending}
            className="flex-1 rounded-xl"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleGerar}
            disabled={isPending || !estadoCivil}
            className="flex-1 rounded-xl bg-secondary hover:bg-secondary/90 text-white gap-2"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {isPending ? 'Gerando...' : 'Gerar e Enviar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
