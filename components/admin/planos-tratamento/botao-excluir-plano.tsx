'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Trash2 } from 'lucide-react';
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
} from '@/components/ui/alert-dialog';
import { deletarPlanoTratamento } from '@/app/(admin)/_actions/planos-tratamento';

/**
 * Excluir plano de tratamento (soft delete) — mesmo padrão de `BotaoApagarAutorizacao`.
 *
 * Só ADMIN: a página de edição só renderiza este botão quando `verificarAdmin()` autoriza, e
 * a action `deletarPlanoTratamento` confere o papel de novo no servidor — esconder o botão é
 * conveniência, a action é que barra.
 *
 * O plano sai da lista e o número volta a ficar livre (o índice único é parcial em
 * `deleted_at IS NULL`); o registro fica no banco e a exclusão fica na auditoria.
 */
export function BotaoExcluirPlano({ id, numero }: { id: string; numero: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  async function excluir() {
    setExcluindo(true);
    try {
      const r = await deletarPlanoTratamento(id);
      if (r.sucesso) {
        toast.success('Plano de tratamento excluído.');
        // `excluindo` fica true: o diálogo segue travado até a lista carregar.
        router.push('/admin/planos-tratamento');
        router.refresh();
        return;
      }
      toast.error(r.erro || 'Não foi possível excluir o plano de tratamento.');
    } catch {
      toast.error('Não foi possível excluir o plano. Verifique a conexão e tente de novo.');
    }
    setExcluindo(false);
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="text-muted-foreground hover:text-destructive gap-2"
        aria-label={`Excluir o plano ${numero}`}
        onClick={() => setAberto(true)}
      >
        <Trash2 size={16} />
        Excluir
      </Button>

      <AlertDialog
        open={aberto}
        onOpenChange={(v) => {
          if (!v && !excluindo) setAberto(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir o plano {numero}?</AlertDialogTitle>
            <AlertDialogDescription>
              Ele sai da lista de planos de tratamento e o documento deixa de abrir. O registro fica
              preservado no banco e a exclusão fica na auditoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault(); // só fecha quando a action responder
                excluir();
              }}
              disabled={excluindo}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-1.5"
            >
              {excluindo ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              {excluindo ? 'Excluindo...' : 'Excluir plano'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
