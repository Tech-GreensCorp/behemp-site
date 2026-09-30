'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
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
import { excluirUsuarioAdmin, resumirVinculosDoUsuario } from '@/app/(admin)/_actions/usuarios';

type Vinculos = { pacientes: number; consultasFuturas: number } | 'indisponivel';

/**
 * Apagar conta — DEFINITIVO no Clerk. Confirmação forte: digitar o e-mail do usuário.
 * Montado com `key={usuario.id}` para o campo nascer vazio a cada abertura.
 */
export function DialogoExcluirUsuario({
  usuario,
  onFechar,
  onApagado,
}: {
  usuario: { id: string; nome: string; email: string; role: string | null };
  onFechar: () => void;
  onApagado: () => void;
}) {
  const [digitado, setDigitado] = useState('');
  const [apagando, setApagando] = useState(false);
  // Só médico tem vínculos a mostrar. null = ainda consultando.
  const ehMedico = usuario.role === 'medico';
  const [vinculos, setVinculos] = useState<Vinculos | null>(null);

  useEffect(() => {
    if (!ehMedico) return;
    let cancelado = false;
    resumirVinculosDoUsuario(usuario.id)
      .then((r) => {
        if (!cancelado) setVinculos(r.sucesso && r.dados ? r.dados : 'indisponivel');
      })
      .catch(() => {
        if (!cancelado) setVinculos('indisponivel');
      });
    return () => {
      cancelado = true;
    };
  }, [ehMedico, usuario.id]);

  const confirmado = digitado.trim().toLowerCase() === usuario.email.toLowerCase();

  async function apagar() {
    setApagando(true);
    try {
      const r = await excluirUsuarioAdmin(usuario.id);
      if (r.sucesso) {
        toast.success(`A conta de ${usuario.nome} foi apagada.`);
        if (r.dados && r.dados.consultasFuturas > 0) {
          toast.warning(
            `${r.dados.consultasFuturas} consulta(s) futura(s) continuam agendadas com este médico. Reatribua ou cancele.`,
            { duration: 12000 },
          );
        }
        if (r.dados && r.dados.pacientesDesvinculados > 0) {
          toast.info(
            `${r.dados.pacientesDesvinculados} paciente(s) voltaram para a fila "Atribuir Médico".`,
            { duration: 12000 },
          );
        }
        onApagado();
        onFechar();
      } else {
        toast.error(r.erro || 'Erro ao apagar o usuário');
      }
    } catch {
      toast.error('Erro ao apagar o usuário');
    } finally {
      setApagando(false);
    }
  }

  return (
    <AlertDialog
      open
      onOpenChange={(aberto) => {
        if (!aberto && !apagando) onFechar();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Apagar a conta de {usuario.nome}?</AlertDialogTitle>
          <AlertDialogDescription>
            O login é apagado <strong>definitivamente</strong> e não tem como desfazer: para voltar,
            a pessoa precisa fazer um cadastro novo.
            {usuario.role === 'paciente' && ' A ficha de paciente é arquivada.'} O histórico clínico
            é preservado, o telefone é removido e o e-mail fica liberado. A ação fica registrada na
            auditoria.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {ehMedico && (
          <div
            role="alert"
            className="border-destructive/30 bg-destructive/5 rounded-lg border p-3 text-sm"
          >
            <p className="font-medium">Este usuário é médico.</p>
            {vinculos === null && (
              <p className="text-muted-foreground mt-1 text-xs">Consultando vínculos...</p>
            )}
            {vinculos === 'indisponivel' && (
              <p className="text-muted-foreground mt-1 text-xs">
                Não foi possível consultar os vínculos. Os pacientes dele serão desvinculados e as
                consultas futuras não serão canceladas.
              </p>
            )}
            {vinculos && vinculos !== 'indisponivel' && (
              <ul className="text-muted-foreground mt-1 list-disc space-y-0.5 pl-4 text-xs">
                <li>
                  <strong>{vinculos.pacientes}</strong> paciente(s) vinculado(s) voltam para a fila
                  &quot;Atribuir Médico&quot;.
                </li>
                <li>
                  <strong>{vinculos.consultasFuturas}</strong> consulta(s) futura(s) agendada(s)
                  <strong> não são canceladas</strong> — reatribua ou cancele depois.
                </li>
              </ul>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <p className="text-muted-foreground text-xs">
            Para confirmar, digite o e-mail <strong>{usuario.email}</strong>
          </p>
          <Input
            value={digitado}
            onChange={(e) => setDigitado(e.target.value)}
            placeholder={usuario.email}
            disabled={apagando}
            autoComplete="off"
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={apagando}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault(); // só fecha quando a action responder
              apagar();
            }}
            disabled={!confirmado || apagando}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-1.5"
          >
            {apagando ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            {apagando ? 'Apagando...' : 'Apagar conta'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
