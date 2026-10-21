import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, LogIn, UserPlus } from 'lucide-react';

/**
 * P4 — A TELA DE ESCOLHA: "já tenho conta" ou "não tenho".
 *
 * Pedida pelo fluxo Greens 3 (recompra): o bot manda um link com dois caminhos, e quem já é
 * paciente vai para o login em vez de tentar criar uma conta que já existe.
 *
 * 🔴 POR QUE UMA TELA, E NÃO DOIS LINKS NO BOT
 *
 * Dois links no bot parecem mais simples e não são: o paciente de recompra muitas vezes não
 * lembra se já criou conta aqui — ele lembra de ter comprado na Greens. Uma tela com os dois
 * caminhos lado a lado deixa a dúvida visível e recuperável; dois links exigem que ele acerte
 * na primeira tentativa, e quem erra volta para o WhatsApp pedir outro.
 *
 * ⚠️ NÃO É ROTA PROTEGIDA e não deve ser: quem chega aqui ainda não provou quem é. Ela não
 * revela nada — só oferece dois caminhos que já são públicos.
 */
export const metadata: Metadata = {
  title: 'Acesse sua conta | Be4Hope',
  description: 'Entre na sua conta ou crie a sua para continuar o atendimento.',
};

export default function AcessoPage() {
  return (
    <div className="mx-auto w-full max-w-md px-5 py-14">
      <header className="animate-fade-up mb-8 text-center">
        <h1 className="font-display text-foreground text-3xl font-semibold tracking-tight">
          Vamos continuar de onde você parou
        </h1>
        <p className="text-muted-foreground mx-auto mt-3 max-w-sm text-sm leading-relaxed">
          Se você já se consultou com a Be4Hope, entre com o seu e-mail. Se é a primeira vez, leva
          um minuto para criar sua conta.
        </p>
      </header>

      <div className="space-y-3">
        <Link
          href="/entrar"
          className="border-border bg-card hover:border-primary/40 group flex items-center gap-4 rounded-2xl border p-5 transition-all duration-300 hover:shadow-[0_0_0_3px_rgba(234,84,41,0.08)]"
        >
          <span className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
            <LogIn size={19} />
          </span>
          <span className="flex-1">
            <span className="text-foreground block text-sm font-medium">Já tenho conta</span>
            <span className="text-muted-foreground block text-xs">Entrar com e-mail e senha</span>
          </span>
          <ArrowRight
            size={17}
            className="text-muted-foreground group-hover:text-primary transition-colors"
          />
        </Link>

        <Link
          href="/registrar-se"
          className="border-border bg-card hover:border-primary/40 group flex items-center gap-4 rounded-2xl border p-5 transition-all duration-300 hover:shadow-[0_0_0_3px_rgba(234,84,41,0.08)]"
        >
          <span className="bg-secondary/10 text-secondary flex size-11 shrink-0 items-center justify-center rounded-xl">
            <UserPlus size={19} />
          </span>
          <span className="flex-1">
            <span className="text-foreground block text-sm font-medium">
              É a minha primeira vez
            </span>
            <span className="text-muted-foreground block text-xs">
              Criar conta e enviar os documentos
            </span>
          </span>
          <ArrowRight
            size={17}
            className="text-muted-foreground group-hover:text-primary transition-colors"
          />
        </Link>
      </div>

      {/*
        🔴 A SAÍDA PARA QUEM NÃO SABE RESPONDER.
        O paciente de recompra costuma não lembrar se criou conta aqui. Sem esta linha, ele
        escolhe no chute — e metade dos chutes termina em "e-mail já cadastrado", que é um
        erro que ele não sabe resolver sozinho.
      */}
      <p className="text-muted-foreground mt-6 text-center text-xs leading-relaxed">
        Não lembra se já tem conta? Tente entrar primeiro — se o e-mail não estiver cadastrado,
        avisamos ali mesmo.
      </p>
    </div>
  );
}
