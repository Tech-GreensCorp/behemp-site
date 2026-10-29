'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

import { criarResponsavelAdmin } from '@/app/_actions/admin-responsaveis';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { mascaraCpf, mascaraTelefone } from '@/lib/validacao/mascaras';

/**
 * Cadastro de um RESPONSÁVEL pelo admin (ao lado de "Novo paciente" e em Controle > Usuários).
 *
 * O papel não é escolhido aqui: a action grava sempre `responsavel`. O responsável nasce sem dependentes e sem
 * ficha de paciente; ele cadastra os dependentes na área dele. A senha é temporária e deve ser passada à pessoa
 * por outro canal: nenhum e-mail de convite sai daqui. Montado só quando aberto (o estado nasce limpo).
 */
export function DialogoCriarResponsavel({
  onFechar,
  onCriado,
}: {
  onFechar: () => void;
  onCriado?: () => void;
}) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cpf, setCpf] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const pronto = nome.trim().length >= 2 && email.trim().length > 3 && senha.length >= 8;

  async function criar() {
    setSalvando(true);
    try {
      const r = await criarResponsavelAdmin({ nome, email, telefone, cpf, senha });
      if (!r.sucesso) {
        toast.error(r.erro || 'Erro ao criar o responsável');
        return;
      }
      toast.success(
        r.dados?.emailEnviado
          ? 'Responsável criado e e-mail de boas-vindas enviado. Passe a senha temporária à pessoa por outro canal.'
          : 'Responsável criado, mas o e-mail de boas-vindas não saiu. Avise a pessoa e passe a senha por outro canal.',
      );
      onCriado?.();
      onFechar();
    } catch {
      toast.error('Erro ao criar o responsável');
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
          <DialogTitle>Novo responsável</DialogTitle>
          <DialogDescription>
            Cria a conta de quem cuida de um ou mais pacientes. Os dependentes ele mesmo cadastra
            depois de entrar.
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
            <Label htmlFor="resp-nome">Nome</Label>
            <Input
              id="resp-nome"
              value={nome}
              maxLength={100}
              autoComplete="off"
              onChange={(e) => setNome(e.target.value)}
              disabled={salvando}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="resp-email">E-mail</Label>
            <Input
              id="resp-email"
              type="email"
              value={email}
              maxLength={254}
              autoComplete="off"
              onChange={(e) => setEmail(e.target.value)}
              disabled={salvando}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="resp-tel">Telefone</Label>
              <Input
                id="resp-tel"
                value={telefone}
                maxLength={15}
                autoComplete="off"
                inputMode="tel"
                placeholder="(11) 99999-1234"
                onChange={(e) => setTelefone(mascaraTelefone(e.target.value))}
                disabled={salvando}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="resp-cpf">CPF</Label>
              <Input
                id="resp-cpf"
                value={cpf}
                maxLength={14}
                autoComplete="off"
                inputMode="numeric"
                placeholder="000.000.000-00"
                onChange={(e) => setCpf(mascaraCpf(e.target.value))}
                disabled={salvando}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="resp-senha">Senha temporária</Label>
            <div className="relative">
              <Input
                id="resp-senha"
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
              A pessoa recebe um e-mail de boas-vindas, mas a senha NÃO vai nele: passe-a por
              telefone ou pessoalmente. Ela também pode trocá-la em &quot;Esqueci minha senha&quot;.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onFechar} disabled={salvando}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando || !pronto}>
              {salvando && <Loader2 size={14} className="mr-1.5 animate-spin" />}
              Criar responsável
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
