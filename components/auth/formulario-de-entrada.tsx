'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSignIn } from '@clerk/nextjs/legacy';
import { isClerkAPIResponseError } from '@clerk/nextjs/errors';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { entrarSemCodigo } from '@/app/_actions/entrar-so-com-senha';

/**
 * Formulário de e-mail e senha da tela OFICIAL de login (`/entrar`).
 *
 * Por que não é o `<SignIn/>` do Clerk: o widget não deixa rodar uma checagem nossa entre o envio
 * da senha e o pedido do código por e-mail. Aqui o envio faz, nesta ordem:
 *   1. `entrarSemCodigo` — o servidor confere se ESTE paciente foi liberado pelo admin para entrar
 *      sem o código (`lib/auth/login-simplificado.ts`). Se sim, devolve um ticket de uso único e o
 *      paciente entra direto.
 *   2. Qualquer recusa (não é paciente liberado, senha errada, limite) segue o fluxo NORMAL do
 *      Clerk: `signIn.create` com a senha e, se o Clerk pedir verificação de dispositivo, o código
 *      por e-mail. Ninguém é bloqueado por esta checagem: quem não foi liberado vê o que sempre viu.
 *
 * Google, código por e-mail sem senha e "esqueci a senha" continuam no widget do Clerk
 * (`onOutrasFormas`).
 *
 * ⚠️ A senha de TODO login passa a ir também ao nosso servidor (por TLS), e não só ao Clerk: é o
 * preço de decidir antes do código. O servidor só a usa para o paciente liberado e a descarta.
 */

type Etapa = 'credenciais' | 'codigo';

const MENSAGEM_GENERICA = 'Não foi possível entrar. Confira o e-mail e a senha e tente de novo.';
const MENSAGEM_CREDENCIAIS = 'E-mail ou senha incorretos.';

function mensagemDoErro(erro: unknown): string {
  if (isClerkAPIResponseError(erro)) {
    const codigo = erro.errors[0]?.code;
    if (codigo === 'form_password_incorrect' || codigo === 'form_identifier_not_found') {
      return MENSAGEM_CREDENCIAIS;
    }
    if (codigo === 'strategy_for_user_invalid') {
      return 'Esta conta não entra com senha. Use "Outras formas de entrar".';
    }
    if (codigo === 'too_many_requests') {
      return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.';
    }
    if (codigo === 'form_code_incorrect' || codigo === 'verification_failed') {
      return 'Código incorreto. Confira o e-mail e tente de novo.';
    }
    if (codigo === 'verification_expired') {
      return 'O código expirou. Peça um novo.';
    }
  }
  return MENSAGEM_GENERICA;
}

const classeDoCampo =
  'h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-base text-gray-900 outline-none transition-colors duration-200 focus:border-[#EA5429] focus:ring-2 focus:ring-[#EA5429]/20 disabled:opacity-60';
const classeDoBotao =
  'inline-flex h-12 w-full items-center justify-center rounded-full bg-[#EA5429] px-8 font-semibold tracking-wide text-white transition-colors duration-200 hover:bg-[#D64319] disabled:opacity-60';

export function FormularioDeEntrada({
  destino,
  onOutrasFormas,
}: {
  destino: string;
  onOutrasFormas: () => void;
}) {
  const { isLoaded, signIn, setActive } = useSignIn();
  const router = useRouter();

  const [etapa, setEtapa] = useState<Etapa>('credenciais');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrar, setMostrar] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');

  async function concluir(sessionId: string) {
    if (!setActive) return;
    setSenha('');
    await setActive({ session: sessionId });
    router.replace(destino);
  }

  async function pedirCodigo(): Promise<boolean> {
    if (!signIn) return false;
    const fator = signIn.supportedSecondFactors?.find((f) => f.strategy === 'email_code');
    if (!fator) return false;
    await signIn.prepareSecondFactor({ strategy: 'email_code' });
    return true;
  }

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || enviando) return;
    setEnviando(true);
    setErro('');
    setAviso('');
    try {
      // 1. O paciente liberado pela equipe entra sem o código.
      const liberado = await entrarSemCodigo({ email, senha });
      if (liberado.sucesso) {
        const tentativa = await signIn.create({ strategy: 'ticket', ticket: liberado.ticket });
        if (tentativa.status === 'complete' && tentativa.createdSessionId) {
          await concluir(tentativa.createdSessionId);
          return;
        }
      }

      // 2. Todos os outros: o fluxo normal do Clerk, com o código quando ele pedir.
      const tentativa = await signIn.create({ identifier: email.trim(), password: senha });
      if (tentativa.status === 'complete' && tentativa.createdSessionId) {
        await concluir(tentativa.createdSessionId);
        return;
      }
      if (tentativa.status === 'needs_second_factor' || tentativa.status === 'needs_client_trust') {
        if (await pedirCodigo()) {
          setSenha('');
          setCodigo('');
          setEtapa('codigo');
          return;
        }
      }
      setErro(MENSAGEM_GENERICA);
    } catch (erroCapturado) {
      setErro(mensagemDoErro(erroCapturado));
    } finally {
      setEnviando(false);
    }
  }

  async function confirmarCodigo(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || enviando) return;
    setEnviando(true);
    setErro('');
    setAviso('');
    try {
      const tentativa = await signIn.attemptSecondFactor({
        strategy: 'email_code',
        code: codigo.trim(),
      });
      if (tentativa.status === 'complete' && tentativa.createdSessionId) {
        await concluir(tentativa.createdSessionId);
        return;
      }
      setErro(MENSAGEM_GENERICA);
    } catch (erroCapturado) {
      setErro(mensagemDoErro(erroCapturado));
    } finally {
      setEnviando(false);
    }
  }

  async function reenviar() {
    if (!isLoaded || enviando) return;
    setEnviando(true);
    setErro('');
    setAviso('');
    try {
      await signIn.prepareSecondFactor({ strategy: 'email_code' });
      setCodigo('');
      setAviso('Enviamos um novo código. O anterior deixou de valer.');
    } catch (erroCapturado) {
      setErro(mensagemDoErro(erroCapturado));
    } finally {
      setEnviando(false);
    }
  }

  function voltar() {
    setEtapa('credenciais');
    setCodigo('');
    setErro('');
    setAviso('');
  }

  return (
    <div className="rounded-2xl border border-gray-100/80 bg-white p-6 shadow-xl shadow-gray-200/60">
      {etapa === 'credenciais' ? (
        <form onSubmit={entrar} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="entrar-email" className="text-sm font-medium text-gray-700">
              E-mail
            </label>
            <input
              id="entrar-email"
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              disabled={enviando}
              className={classeDoCampo}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="entrar-senha" className="text-sm font-medium text-gray-700">
              Senha
            </label>
            <div className="relative">
              <input
                id="entrar-senha"
                type={mostrar ? 'text' : 'password'}
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                value={senha}
                onChange={(ev) => setSenha(ev.target.value)}
                disabled={enviando}
                className={`${classeDoCampo} pr-12`}
              />
              <button
                type="button"
                onClick={() => setMostrar((v) => !v)}
                aria-label={mostrar ? 'Esconder a senha' : 'Mostrar a senha'}
                className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-gray-400 hover:text-gray-700"
              >
                {mostrar ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {erro && (
            <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {erro}
            </p>
          )}

          <button
            type="submit"
            disabled={!isLoaded || enviando || !email.trim() || !senha}
            className={classeDoBotao}
          >
            {enviando && <Loader2 size={16} className="mr-2 animate-spin" />}
            Entrar
          </button>

          <button
            type="button"
            onClick={onOutrasFormas}
            className="w-full text-center text-sm font-semibold text-[#EA5429] hover:text-[#D64319]"
          >
            Outras formas de entrar (Google, código por e-mail, esqueci a senha)
          </button>
        </form>
      ) : (
        <form onSubmit={confirmarCodigo} className="space-y-4" noValidate>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-gray-900">Confirme que é você</h3>
            <p className="text-sm text-gray-500">
              Você está entrando de um novo dispositivo. Enviamos um código para{' '}
              <span className="font-medium text-gray-700">{email.trim()}</span>.
            </p>
          </div>

          <input
            aria-label="Código de verificação"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            value={codigo}
            onChange={(ev) => setCodigo(ev.target.value.replace(/\D/g, ''))}
            disabled={enviando}
            className={`${classeDoCampo} text-center font-mono text-xl tracking-[0.4em]`}
          />

          {aviso && (
            <p role="status" className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">
              {aviso}
            </p>
          )}
          {erro && (
            <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {erro}
            </p>
          )}

          <button
            type="submit"
            disabled={!isLoaded || enviando || codigo.length < 6}
            className={classeDoBotao}
          >
            {enviando && <Loader2 size={16} className="mr-2 animate-spin" />}
            Continuar
          </button>

          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={reenviar}
              disabled={enviando}
              className="font-semibold text-[#EA5429] hover:text-[#D64319] disabled:opacity-60"
            >
              Reenviar código
            </button>
            <button
              type="button"
              onClick={voltar}
              disabled={enviando}
              className="text-gray-500 hover:text-gray-800 disabled:opacity-60"
            >
              Voltar
            </button>
          </div>
        </form>
      )}

      {etapa === 'credenciais' && (
        <p className="mt-5 border-t border-gray-100 pt-4 text-center text-sm text-gray-500">
          Não tem conta?{' '}
          <Link href="/registrar-se" className="font-semibold text-[#EA5429] hover:text-[#D64319]">
            Registre-se
          </Link>
        </p>
      )}
    </div>
  );
}
