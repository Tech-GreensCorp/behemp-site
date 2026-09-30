'use client';

import { useState } from 'react';
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
import { apagarAutorizacaoAnvisaAdmin } from '@/app/(admin)/_actions/documentos-regulatorios';

/**
 * Apagar Autorização ANVISA (soft delete). Só as NÃO aprovadas: a aprovada é registro
 * regulatório em uso e ainda alimenta o motor de alertas de vencimento.
 */
export function BotaoApagarAutorizacao({
  id,
  pacienteNome,
  aprovada,
  temProcuracao,
  onApagado,
}: {
  id: string;
  pacienteNome: string;
  aprovada: boolean;
  temProcuracao: boolean;
  onApagado: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [apagando, setApagando] = useState(false);

  async function apagar() {
    setApagando(true);
    try {
      const r = await apagarAutorizacaoAnvisaAdmin(id);
      if (r.sucesso) {
        toast.success('Autorização apagada.');
        if (r.dados && r.dados.procuracoesLigadas > 0) {
          toast.info(
            `${r.dados.procuracoesLigadas} procuração(ões) ligada(s) continuam na tela de Procurações.`,
            { duration: 10000 },
          );
        }
        setAberto(false);
        onApagado();
      } else {
        toast.error(r.erro || 'Erro ao apagar a autorização');
      }
    } catch {
      toast.error('Erro ao apagar a autorização');
    } finally {
      setApagando(false);
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="text-muted-foreground hover:text-destructive gap-1.5"
        disabled={aprovada}
        title={
          aprovada
            ? 'Uma autorização aprovada não pode ser apagada por esta tela'
            : 'Apagar autorização'
        }
        aria-label={`Apagar a autorização de ${pacienteNome}`}
        onClick={() => setAberto(true)}
      >
        <Trash2 size={14} />
        Apagar
      </Button>

      <AlertDialog
        open={aberto}
        onOpenChange={(v) => {
          if (!v && !apagando) setAberto(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar a autorização de {pacienteNome}?</AlertDialogTitle>
            <AlertDialogDescription>
              Ela sai desta lista e das telas do paciente. O registro e os documentos enviados ficam
              preservados, e a ação fica na auditoria.
              {temProcuracao && (
                <>
                  {' '}
                  A procuração ligada a ela <strong>não é apagada</strong>: ela continua na tela de
                  Procurações e se apaga à parte.
                </>
              )}
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
              {apagando ? 'Apagando...' : 'Apagar autorização'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
