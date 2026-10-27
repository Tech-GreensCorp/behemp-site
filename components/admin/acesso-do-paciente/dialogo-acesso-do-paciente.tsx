'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { KeyRound, Loader2, ShieldCheck, Sparkles, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  alterarLoginSimplificado,
  consultarAcessoDoUsuario,
  criarAcessoDoUsuario,
  definirSenhaDoPaciente,
  type AcessoDoUsuario,
} from '@/app/_actions/acesso-do-paciente';
import { gerarSenhaLegivel } from '@/lib/auth/login-simplificado';

/**
 * Acesso do paciente ao sistema, pelo admin: criar o login, definir a senha e liberar a entrada
 * sem o código por e-mail (decisão por paciente — nada muda para os demais).
 *
 * A senha gerada nasce AQUI, no navegador do admin (`crypto.getRandomValues`): nenhuma resposta de
 * API a devolve. Ela fica visível no campo até o diálogo fechar, para o admin poder passá-la ao
 * paciente por outro canal (telefone, pessoalmente) — nunca por e-mail ou mensagem junto do login.
 */
export function DialogoAcessoDoPaciente({
  usuario,
  onFechar,
}: {
  usuario: { id: string; nome: string; email: string };
  onFechar: () => void;
}) {
  const [acesso, setAcesso] = useState<AcessoDoUsuario | null>(null);
  const [falhouAoCarregar, setFalhouAoCarregar] = useState(false);
  const [senha, setSenha] = useState('');
  const [ocupado, setOcupado] = useState<null | 'criar' | 'senha' | 'flag'>(null);

  useEffect(() => {
    let vivo = true;
    consultarAcessoDoUsuario(usuario.id).then((r) => {
      if (!vivo) return;
      if (r.sucesso && r.dados) setAcesso(r.dados);
      else setFalhouAoCarregar(true);
    });
    return () => {
      vivo = false;
    };
  }, [usuario.id]);

  async function recarregar() {
    const r = await consultarAcessoDoUsuario(usuario.id);
    if (r.sucesso && r.dados) setAcesso(r.dados);
  }

  async function criarAcesso() {
    setOcupado('criar');
    try {
      const r = await criarAcessoDoUsuario(usuario.id);
      if (!r.sucesso) {
        toast.error(r.erro || 'Não foi possível criar o acesso');
        return;
      }
      toast.success(
        'Acesso criado. Agora defina uma senha ou peça ao paciente para entrar por código.',
      );
      await recarregar();
    } finally {
      setOcupado(null);
    }
  }

  async function definirSenha() {
    setOcupado('senha');
    try {
      const r = await definirSenhaDoPaciente(usuario.id, senha);
      if (!r.sucesso) {
        toast.error(r.erro || 'Não foi possível definir a senha');
        return;
      }
      toast.success('Senha definida. Passe-a ao paciente por telefone ou pessoalmente.');
      await recarregar();
    } finally {
      setOcupado(null);
    }
  }

  async function alternarFlag(ativo: boolean) {
    setOcupado('flag');
    try {
      const r = await alterarLoginSimplificado(usuario.id, ativo);
      if (!r.sucesso) {
        toast.error(r.erro || 'Não foi possível alterar o acesso');
        return;
      }
      toast.success(ativo ? 'Entrada sem código liberada.' : 'Entrada sem código desligada.');
      await recarregar();
    } finally {
      setOcupado(null);
    }
  }

  const gerar = () => setSenha(gerarSenhaLegivel((n) => crypto.getRandomValues(new Uint8Array(n))));

  const carregando = !acesso && !falhouAoCarregar;

  return (
    <Dialog
      open
      onOpenChange={(aberto) => {
        if (!aberto && !ocupado) onFechar();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Acesso ao sistema</DialogTitle>
          <DialogDescription>
            {usuario.nome} · {usuario.email}
          </DialogDescription>
        </DialogHeader>

        {carregando && (
          <div className="flex justify-center py-8">
            <Loader2 className="text-primary animate-spin" size={24} />
          </div>
        )}

        {falhouAoCarregar && (
          <p className="text-destructive text-sm">
            Não foi possível consultar o acesso deste usuário.
          </p>
        )}

        {acesso && !acesso.ehPaciente && (
          <p className="text-muted-foreground text-sm">
            Esta tela só gerencia o acesso de pacientes.
          </p>
        )}

        {acesso?.ehPaciente && !acesso.temConta && (
          <div className="bg-muted/50 space-y-3 rounded-xl p-4">
            <p className="text-sm">
              Este paciente <strong>não tem login</strong>. Foi cadastrado pela equipe e, por isso,
              ao tentar entrar recebe “usuário não encontrado”.
            </p>
            <Button onClick={criarAcesso} disabled={ocupado !== null}>
              {ocupado === 'criar' ? (
                <Loader2 size={14} className="mr-1.5 animate-spin" />
              ) : (
                <UserPlus size={14} className="mr-1.5" />
              )}
              Criar acesso
            </Button>
            <p className="text-muted-foreground text-xs">
              Não envia e-mail nem define senha. Depois, use a senha abaixo ou oriente o paciente a
              entrar por “Esqueci a senha / código”.
            </p>
          </div>
        )}

        {acesso?.ehPaciente && acesso.temConta && (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="acesso-senha">
                {acesso.temSenha ? 'Redefinir a senha' : 'Definir a senha'}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="acesso-senha"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  maxLength={72}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Mínimo de 8, com letra e número"
                  className="font-mono"
                  disabled={ocupado !== null}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={gerar}
                  disabled={ocupado !== null}
                  title="Gera uma senha forte, sem caracteres que se confundem"
                >
                  <Sparkles size={14} className="mr-1.5" />
                  Gerar
                </Button>
              </div>
              <Button
                onClick={definirSenha}
                disabled={ocupado !== null || senha.length < 8}
                className="w-full"
              >
                {ocupado === 'senha' ? (
                  <Loader2 size={14} className="mr-1.5 animate-spin" />
                ) : (
                  <KeyRound size={14} className="mr-1.5" />
                )}
                {acesso.temSenha ? 'Redefinir senha' : 'Definir senha'}
              </Button>
              <p className="text-muted-foreground text-xs">
                A senha não é guardada por nós nem enviada ao paciente: passe-a por telefone ou
                pessoalmente. Ao redefinir, as outras sessões do paciente são encerradas.
              </p>
            </div>

            <div className="border-border/60 flex items-start gap-3 rounded-xl border p-4">
              <ShieldCheck size={18} className="text-secondary mt-0.5 shrink-0" />
              <div className="flex-1 space-y-1">
                <Label htmlFor="acesso-flag" className="text-sm font-medium">
                  Entrar sem o código do e-mail
                </Label>
                <p className="text-muted-foreground text-xs">
                  Só para este paciente: ele entra pela tela de login normal, com e-mail e senha, sem digitar
                  código. A senha passa a ser o único fator — use para quem não consegue acessar o
                  e-mail.
                </p>
                {!acesso.temSenha && (
                  <p className="text-xs text-amber-700">Defina uma senha primeiro.</p>
                )}
              </div>
              <Switch
                id="acesso-flag"
                checked={acesso.loginSimplificado}
                disabled={ocupado !== null || (!acesso.temSenha && !acesso.loginSimplificado)}
                onCheckedChange={(v) => alternarFlag(Boolean(v))}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onFechar} disabled={ocupado !== null}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
