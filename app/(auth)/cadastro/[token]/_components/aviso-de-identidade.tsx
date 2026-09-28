'use client';

/**
 * O AVISO DA CONFERÊNCIA DE IDENTIDADE, NA ETAPA 1 DO CADASTRO — ADR-0028.
 *
 * Aparece quando o servidor devolveu um dos dois vereditos com aviso (`VEREDITOS_COM_AVISO`).
 * O telefone em uso não passa por aqui: ele trava o próprio campo (`DO-68`).
 *
 * 🔴 NENHUM TEXTO DAQUI DIZ QUAL DADO BATEU. Nem "este CPF já está cadastrado", nem o e-mail da
 * outra conta, nem mascarado. O link chega por WhatsApp e quem o abre nem sempre é o paciente;
 * dizer o que foi encontrado contaria a um terceiro que aquela pessoa é paciente desta
 * plataforma (`OWASP-01`, `LGPD-06`). O aviso diz O QUE FAZER, não O QUE ACHOU.
 *
 * ⚠️ Só tokens e padrões que a própria tela do cadastro já usa: a caixa `border-secondary/25
 * bg-secondary/5` dos avisos de sessão, a âmbar do aviso de conta alheia, e o `Button` do
 * `base-ui` compondo `Link` por `render`. Nenhuma cor nem animação nova.
 */

import Link from 'next/link';
import { MessageCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  TEXTO_DO_SUPORTE,
  linkDoSuporteComProtocolo,
  type VereditoComAviso,
} from '@/lib/cadastro/veredito-de-identidade';

interface Props {
  veredito: VereditoComAviso;
  token: string;
  protocolo: string;
  /** O WhatsApp da BeHemp (`NEXT_PUBLIC_WHATSAPP_BEHEMP`), montado no servidor. */
  linkDoSuporte: string;
  /** Volta aos campos editáveis — para quem quer usar outro e-mail. */
  aoCorrigir: () => void;
}

export function AvisoDeIdentidade({
  veredito,
  token,
  protocolo,
  linkDoSuporte,
  aoCorrigir,
}: Props) {
  /**
   * O login volta a ESTE cadastro. Sem `redirect_url`, quem entra cai no painel e o fluxo morre
   * — o defeito que o guarda `o-login-nao-leva-para-fora` já conhece. É o mesmo destino do botão
   * "Entrar na minha conta" que a tela já tinha.
   */
  const entrar = `/entrar?redirect_url=${encodeURIComponent(`/cadastro/${token}`)}`;

  if (veredito === 'cpf_em_outra_conta') {
    /**
     * 🔴 `DO-62`: CPF que bate vai ao suporte da BeHemp. O cadastro PARA aqui — e o link
     * continua valendo, para voltar pelo mesmo caminho depois que o suporte resolver.
     */
    return (
      <div
        role="status"
        id="aviso-de-identidade"
        // Recebe o foco quando o veredito chega: sem isto o "Continuar" some com o foco dentro, e
        // quem usa leitor de tela não ouve nada (revisão de frontend, 28/09/2026).
        tabIndex={-1}
        className="animate-fade-in space-y-3 rounded-xl border border-amber-300/60 bg-amber-50/60 px-4 py-4"
      >
        <p className="text-foreground text-sm leading-relaxed">{TEXTO_DO_SUPORTE}</p>
        <p className="text-muted-foreground text-sm">
          Seu protocolo: <strong className="font-mono">{protocolo}</strong>. Depois, é só voltar por
          este mesmo link.
        </p>
        <Button
          className="h-11 w-full rounded-xl"
          // O elemento é um <a>: sem isto o Base UI o trata como <button> nativo e avisa em dev.
          nativeButton={false}
          render={
            <a
              href={linkDoSuporteComProtocolo(linkDoSuporte, protocolo)}
              target="_blank"
              rel="noopener noreferrer"
            />
          }
        >
          <MessageCircle size={16} />
          Falar com o suporte no WhatsApp
        </Button>
      </div>
    );
  }

  /**
   * ⚠️ EXAUSTIVO: um veredito novo em `VEREDITOS_COM_AVISO` sem tela aqui não compila — em vez de
   * cair em silêncio no aviso do e-mail. O telefone em uso não é aviso: trava o campo (`DO-68`).
   */
  if (veredito !== 'conta_pelo_email') {
    const semTela: never = veredito;
    return semTela;
  }

  /** ADR-0016 D-07: o e-mail que já tem conta vai ao login — agora ANTES de preencher tudo. */
  return (
    <div
      role="status"
      id="aviso-de-identidade"
      // Recebe o foco quando o veredito chega: sem isto o "Continuar" some com o foco dentro, e
      // quem usa leitor de tela não ouve nada (revisão de frontend, 28/09/2026).
      tabIndex={-1}
      className="animate-fade-in border-secondary/25 bg-secondary/5 space-y-3 rounded-xl border px-4 py-4"
    >
      <p className="text-foreground text-sm leading-relaxed">
        Você já tem conta na BeHemp? Entre para continuar — o seu cadastro fica esperando por você
        neste mesmo link.
      </p>
      <Button
        className="h-11 w-full rounded-xl"
        nativeButton={false}
        render={<Link href={entrar} />}
      >
        Entrar na minha conta
      </Button>
      <Button
        variant="outline"
        className="h-11 w-full rounded-xl"
        type="button"
        onClick={aoCorrigir}
      >
        Quero usar outro e-mail
      </Button>
    </div>
  );
}
