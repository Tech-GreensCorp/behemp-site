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
import { apagarProcuracaoAdmin } from '@/app/(admin)/_actions/documentos-regulatorios';

/** Apagar Procuração Específica (soft delete). O PDF e o histórico ficam preservados. */
export function BotaoApagarProcuracao({
  id,
  nome,
  assinada,
}: {
  id: string;
  nome: string;
  assinada: boolean;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [apagando, setApagando] = useState(false);

  async function apagar() {
    setApagando(true);
    try {
      const r = await apagarProcuracaoAdmin(id);
      if (r.sucesso) {
        toast.success('Procuração apagada.');
        setAberto(false);
        router.refresh();
      } else {
        toast.error(r.erro || 'Erro ao apagar a procuração');
      }
    } catch {
      toast.error('Erro ao apagar a procuração');
    } finally {
      setApagando(false);
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-destructive"
        title="Apagar procuração"
        aria-label={`Apagar a procuração de ${nome}`}
        onClick={() => setAberto(true)}
      >
        <Trash2 size={16} />
      </Button>

      <AlertDialog
        open={aberto}
        onOpenChange={(v) => {
          if (!v && !apagando) setAberto(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar a procuração de {nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              Ela sai desta lista e das telas do paciente e da ANVISA. O PDF e o registro ficam
              preservados e a ação fica na auditoria.
              {assinada && (
                <>
                  {' '}
                  <strong>Esta procuração já foi assinada</strong> — é um documento jurídico.
                </>
              )}{' '}
              O envelope no DocuSign <strong>não</strong> é cancelado e o paciente não é avisado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={apagando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault(); // só fecha quando a action responder
                apagar();
              }}
              disabled={apagando}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-1.5"
            >
              {apagando ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              {apagando ? 'Apagando...' : 'Apagar procuração'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
