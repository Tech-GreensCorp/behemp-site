'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
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
import { criarAdminUsuario } from '@/app/(admin)/_actions/usuarios';

/**
 * Criação de um usuário admin pelo admin (Controle > Usuários).
 * O papel não é escolhido aqui: a action grava sempre 'admin'. A senha é temporária e deve ser
 * passada à pessoa por outro canal — nenhum e-mail de convite sai daqui.
 * Montado só quando aberto: o estado nasce limpo a cada abertura, sem effect.
 */
export function DialogoCriarAdmin({
  onFechar,
  onCriado,
}: {
  onFechar: () => void;
  onCriado: () => void;
}) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const pronto = nome.trim().length >= 2 && email.trim().length > 3 && senha.length >= 8;

  async function criar() {
    setSalvando(true);
    try {
      const r = await criarAdminUsuario({ nome, email, senha });
      if (!r.sucesso) {
        toast.error(r.erro || 'Erro ao criar o admin');
        return;
      }
      toast.success('Admin criado. Passe a senha temporária à pessoa por outro canal.');
      onCriado();
      onFechar();
    } catch {
      toast.error('Erro ao criar o admin');
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
          <DialogTitle>Novo admin</DialogTitle>
          <DialogDescription>
            Cria uma conta com acesso total à administração da plataforma.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (pronto && !salvando) criar();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="admin-nome">Nome</Label>
            <Input
              id="admin-nome"
              value={nome}
              maxLength={100}
              autoComplete="off"
              onChange={(e) => setNome(e.target.value)}
              disabled={salvando}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="admin-email">E-mail</Label>
            <Input
              id="admin-email"
              type="email"
              value={email}
              maxLength={254}
              autoComplete="off"
              onChange={(e) => setEmail(e.target.value)}
              disabled={salvando}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="admin-senha">Senha temporária</Label>
            <div className="relative">
              <Input
                id="admin-senha"
                type={mostrarSenha ? 'text' : 'password'}
                value={senha}
                maxLength={72}
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres, 1 maiúscula, 1 número"
                className="pr-10"
                onChange={(e) => setSenha(e.target.value)}
                disabled={salvando}
              />
              <button
                type="button"
                onClick={() => setMostrarSenha(!mostrarSenha)}
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
                aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                tabIndex={-1}
              >
                {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="text-muted-foreground text-xs">
              Passe-a à pessoa por outro canal. Não é enviado e-mail de convite.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onFechar} disabled={salvando}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando || !pronto}>
              {salvando && <Loader2 size={14} className="mr-1.5 animate-spin" />}
              Criar admin
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
