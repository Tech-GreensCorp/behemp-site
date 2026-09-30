'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
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
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { atualizarUsuarioAdmin, alterarRoleUsuario } from '@/app/(admin)/_actions/usuarios';

export interface UsuarioEditavel {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  role: string | null;
}

const PAPEIS: Record<string, string> = { admin: 'Admin', paciente: 'Paciente' };

/**
 * Edição de usuário pelo admin: nome, telefone e papel (admin ↔ paciente).
 * O e-mail é só exibido — trocar e-mail mexe no Clerk, no índice único e na flag das triagens.
 * Montado com `key={usuario.id}`: o estado inicial vem das props, sem effect.
 */
export function DialogoEditarUsuario({
  usuario,
  onFechar,
  onSalvo,
}: {
  usuario: UsuarioEditavel;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [nome, setNome] = useState(usuario.nome);
  const [telefone, setTelefone] = useState(usuario.telefone ?? '');
  const [role, setRole] = useState(usuario.role ?? 'paciente');
  const [salvando, setSalvando] = useState(false);

  const ehMedico = usuario.role === 'medico';
  const mudouDados = nome.trim() !== usuario.nome || telefone.trim() !== (usuario.telefone ?? '');
  const mudouRole = !ehMedico && role !== usuario.role;

  async function salvar() {
    setSalvando(true);
    try {
      if (mudouDados) {
        const r = await atualizarUsuarioAdmin(usuario.id, {
          nome: nome.trim(),
          telefone: telefone.trim(),
        });
        if (!r.sucesso) {
          toast.error(r.erro || 'Erro ao salvar os dados');
          return;
        }
      }
      if (mudouRole) {
        const r = await alterarRoleUsuario(usuario.id, role as 'admin' | 'paciente');
        if (!r.sucesso) {
          toast.error(r.erro || 'Erro ao alterar o papel');
          if (mudouDados) onSalvo(); // os dados já foram gravados: atualiza a lista
          return;
        }
      }
      toast.success('Usuário atualizado.');
      onSalvo();
      onFechar();
    } catch {
      toast.error('Erro ao salvar o usuário');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(aberto) => {
        if (!aberto && !salvando) onFechar();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar usuário</DialogTitle>
          <DialogDescription>{usuario.email}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="usuario-nome">Nome</Label>
            <Input
              id="usuario-nome"
              value={nome}
              maxLength={100}
              onChange={(e) => setNome(e.target.value)}
              disabled={salvando}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="usuario-telefone">Telefone</Label>
            <Input
              id="usuario-telefone"
              value={telefone}
              maxLength={20}
              placeholder="(11) 99999-9999"
              onChange={(e) => setTelefone(e.target.value)}
              disabled={salvando}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Papel</Label>
            {ehMedico ? (
              <p className="text-muted-foreground text-xs">
                O papel de um médico não pode ser alterado por esta tela.
              </p>
            ) : (
              <Select value={role} onValueChange={(v) => setRole(v ?? role)} disabled={salvando}>
                <SelectTrigger className="w-full">
                  <SelectValue>{PAPEIS[role] ?? role}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PAPEIS).map(([valor, rotulo]) => (
                    <SelectItem key={valor} value={valor}>
                      {rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button
            onClick={salvar}
            disabled={salvando || nome.trim().length < 2 || (!mudouDados && !mudouRole)}
          >
            {salvando && <Loader2 size={14} className="mr-1.5 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
