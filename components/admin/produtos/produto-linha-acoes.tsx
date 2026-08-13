'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Trash2 } from 'lucide-react';
import { alternarAtivoProduto, excluirProduto } from '@/app/(admin)/_actions/produtos';

interface ProdutoLinhaAcoesProps {
  produtoId: string;
  nome: string;
  ativo: boolean;
  excluido: boolean;
}

export function ProdutoLinhaAcoes({ produtoId, nome, ativo, excluido }: ProdutoLinhaAcoesProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleToggleAtivo = (checked: boolean) => {
    startTransition(async () => {
      const res = await alternarAtivoProduto(produtoId, checked);
      if (res.sucesso) {
        toast.success(checked ? 'Produto ativado' : 'Produto desativado');
        router.refresh();
      } else {
        toast.error(res.erro ?? 'Erro ao alterar status');
      }
    });
  };

  const handleExcluir = () => {
    startTransition(async () => {
      const res = await excluirProduto(produtoId);
      if (res.sucesso) {
        toast.success('Produto excluído');
        router.refresh();
      } else {
        toast.error(res.erro ?? 'Erro ao excluir produto');
      }
    });
  };

  if (excluido) {
    return <span className="text-muted-foreground text-xs">Excluído</span>;
  }

  return (
    <div className="flex items-center justify-end gap-3">
      <Switch checked={ativo} onCheckedChange={handleToggleAtivo} disabled={isPending} />
      <AlertDialog>
        <AlertDialogTrigger
          render={<Button variant="ghost" size="icon" className="text-destructive h-8 w-8" />}
        >
          <Trash2 size={14} />
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir &quot;{nome}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              O produto sai imediatamente do catálogo. O histórico é preservado (soft delete), mas
              não há mais como visualizá-lo na listagem.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleExcluir}
              disabled={isPending}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
