'use client';

import { useEffect, useRef, useState } from 'react';
import { useSignIn } from '@clerk/nextjs/legacy';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

/**
 * Tela do link "Definir minha senha" do e-mail de boas-vindas (`lib/pacientes/boas-vindas.ts`).
 *
 * O token chega no FRAGMENTO da URL (`#ticket=`), nunca no query: o fragmento não vai ao servidor.
 * Ele entra o paciente (estratégia `ticket` do Clerk, uso único, expira) e a senha é escolhida por
 * ele mesmo e vai direto ao Clerk. Nenhuma senha passa pelo nosso servidor.
 *
 * Fica sob `/entrar/` porque essa árvore já é pública no middleware: quem chega ainda não provou
 * quem é.
 */

type Fase = 'entrando' | 'escolher' | 'salvando' | 'invalido';

export default function DefinirSenhaPage() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const { user } = useUser();
  const router = useRouter();
  const [fase, setFase] = useState<Fase>('entrando');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  // O token sai da barra de endereço na primeira leitura; em StrictMode o effect roda duas vezes,
  // e a segunda não o encontraria. A trava garante UMA tentativa.
  const iniciou = useRef(false);

  useEffect(() => {
    if (!isLoaded || iniciou.current) return;
    iniciou.current = true;
    const ticket = new URLSearchParams(window.location.hash.slice(1)).get('ticket');
    // Tira o token da barra de endereço: não fica no histórico nem num print.
    window.history.replaceState(null, '', window.location.pathname);
    const tentativa = ticket
      ? signIn.create({ strategy: 'ticket', ticket })
      : Promise.reject(new Error('sem ticket'));
    tentativa
      .then(async (r) => {
        if (r.status !== 'complete') throw new Error('incompleto');
        await setActive({ session: r.createdSessionId });
        setFase('escolher');
      })
      .catch(() => setFase('invalido'));
  }, [isLoaded, signIn, setActive]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (senha.length < 8) return setErro('Use pelo menos 8 caracteres.');
    if (senha !== confirmacao) return setErro('As duas senhas precisam ser iguais.');
    if (!user) return setErro('Sessão ainda carregando. Tente de novo em instantes.');
    setFase('salvando');
    try {
      await user.updatePassword({ newPassword: senha });
      router.push('/redirect');
    } catch (err) {
      const codigo = (err as { errors?: { code?: string }[] })?.errors?.[0]?.code;
      setErro(
        codigo === 'form_password_pwned'
          ? 'Esta senha apareceu em vazamentos de dados. Escolha outra.'
          : codigo === 'form_password_not_strong_enough' ||
              codigo === 'form_password_length_too_short'
            ? 'A senha é fraca demais. Use uma mais longa e variada.'
            : 'Não foi possível salvar a senha. Tente novamente.',
      );
      setFase('escolher');
    }
  }

  return (
    <div className="mx-auto w-full max-w-md px-5 py-14">
      <h1 className="font-display text-foreground mb-2 text-center text-3xl font-semibold tracking-tight">
        Defina sua senha
      </h1>

      {fase === 'entrando' && (
        <div className="text-muted-foreground mt-8 flex items-center justify-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Validando seu link…
        </div>
      )}

      {fase === 'invalido' && (
        <div className="mt-6 space-y-4 text-center">
          <p className="text-muted-foreground text-sm leading-relaxed">
            Este link expirou ou já foi usado. Entre com o seu e-mail e use &quot;Esqueci minha
            senha&quot; para receber um novo código.
          </p>
          <Link href="/entrar" className="text-primary text-sm font-medium underline">
            Ir para a tela de entrada
          </Link>
        </div>
      )}

      {(fase === 'escolher' || fase === 'salvando') && (
        <form onSubmit={salvar} className="mt-6 space-y-4">
          <p className="text-muted-foreground text-center text-sm">
            Escolha uma senha para os próximos acessos.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="senha">Nova senha</Label>
            <Input
              id="senha"
              type="password"
              autoComplete="new-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              disabled={fase === 'salvando'}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirmacao">Repita a senha</Label>
            <Input
              id="confirmacao"
              type="password"
              autoComplete="new-password"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              disabled={fase === 'salvando'}
            />
          </div>
          {erro && (
            <p role="alert" className="text-destructive text-sm">
              {erro}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={fase === 'salvando'}>
            {fase === 'salvando' ? 'Salvando…' : 'Salvar senha e entrar'}
          </Button>
        </form>
      )}
    </div>
  );
}
