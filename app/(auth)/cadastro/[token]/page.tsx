import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertCircle, Clock, CheckCircle2, MessageCircle } from 'lucide-react';

import {
  validarTokenDeCadastro,
  registrarPrimeiroAcesso,
  type MotivoDeRecusa,
} from '@/lib/chatpro/token-de-cadastro';
import { Button } from '@/components/ui/button';
import { pendenciasDe, recebidosDe } from '@/lib/parceiros/documentos';

import { FormularioDeCadastro } from './_components/formulario-de-cadastro';

export const metadata: Metadata = {
  title: 'Concluir cadastro | BeHemp',
  description: 'Crie sua conta para agendar a teleconsulta.',
  // O link é uma credencial. Indexar esta página exporia tokens em busca.
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * O WhatsApp do atendimento.
 *
 * ⚠️ REUSA `NEXT_PUBLIC_WHATSAPP_BEHEMP`, que já existe e já é usada em
 * `patologias-picker.tsx` e na recompra do paciente — com o MESMO fallback delas. Uma
 * variável nova só para esta tela criaria dois números de atendimento configuráveis em
 * lugares diferentes, e no dia em que o número mudasse alguém trocaria um e esqueceria
 * o outro.
 */
const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_BEHEMP ?? '5511932047360';
const LINK_DO_WHATSAPP = `https://wa.me/${WHATSAPP}`;

/**
 * A TELA QUE O PACIENTE ABRE AO CLICAR NO LINK DO WHATSAPP.
 *
 * O link chega pelo bot do ChatPro — tanto do WhatsApp da BeHemp quanto do da Greens, que
 * envia este mesmo endereço. Quem chega aqui não tem receita e precisa da teleconsulta;
 * esta tela é o que o transforma em paciente com conta, para poder agendar.
 *
 * Server Component de propósito: a validação do token acontece **antes** de qualquer byte
 * de formulário existir. Um link expirado nunca chega a pintar campos que não serão aceitos.
 */
const RECUSA: Record<
  MotivoDeRecusa,
  { icone: typeof AlertCircle; titulo: string; texto: string; tom: string }
> = {
  invalido: {
    icone: AlertCircle,
    titulo: 'Link inválido',
    // Não diz se o link existiu: quem chegou aqui chutando não descobre que acertou.
    texto:
      'Confira se você copiou o endereço inteiro. Se veio pelo WhatsApp, toque no link direto na conversa.',
    tom: 'text-destructive',
  },
  expirado: {
    icone: Clock,
    titulo: 'Este link expirou',
    texto:
      'Por segurança, o link vale por tempo limitado. Peça um novo pelo WhatsApp — leva alguns segundos.',
    tom: 'text-primary',
  },
  ja_utilizado: {
    icone: CheckCircle2,
    // Não é erro: é sucesso passado. O tom não pode assustar quem já concluiu.
    titulo: 'Você já concluiu este cadastro',
    texto: 'Seus dados já foram recebidos. Entre com o seu e-mail e a senha que você criou.',
    tom: 'text-secondary',
  },
  cancelado: {
    icone: AlertCircle,
    titulo: 'Solicitação cancelada',
    texto:
      'Esta solicitação foi cancelada. Fale com o atendimento pelo WhatsApp para gerar uma nova.',
    tom: 'text-destructive',
  },
};

export default async function CadastroPorLinkPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const resultado = await validarTokenDeCadastro(token);

  if (!resultado.valida) {
    const { icone: Icone, titulo, texto, tom } = RECUSA[resultado.motivo];
    return (
      <div className="relative flex min-h-[calc(100vh-3rem)] items-center justify-center overflow-hidden px-4 py-16">
        <AuroraDeFundo />
        <div className="animate-fade-up border-border/60 bg-card/80 relative w-full max-w-md rounded-3xl border p-8 text-center shadow-[0_1px_2px_rgba(26,22,18,0.04),0_12px_32px_-12px_rgba(26,22,18,0.12)] backdrop-blur-xl sm:p-10">
          <div className="bg-muted mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl">
            <Icone size={26} className={tom} strokeWidth={1.75} />
          </div>
          <h1 className="font-display text-foreground text-2xl font-semibold tracking-tight">
            {titulo}
          </h1>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed">{texto}</p>

          <div className="mt-7 flex flex-col gap-2.5">
            {/* Este Button é do `base-ui`: compõe por `render`, não por `asChild`. */}
            {resultado.motivo === 'ja_utilizado' ? (
              <Button className="h-11 rounded-xl" render={<Link href="/entrar" />}>
                Entrar na minha conta
              </Button>
            ) : (
              <Button
                className="h-11 rounded-xl"
                render={<a href={LINK_DO_WHATSAPP} target="_blank" rel="noopener noreferrer" />}
              >
                <MessageCircle size={16} />
                Falar no WhatsApp
              </Button>
            )}
            <Button variant="ghost" className="h-11 rounded-xl" render={<Link href="/" />}>
              Voltar ao início
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Só depois de validar. Um token recusado não produz escrita nenhuma.
  await registrarPrimeiroAcesso(resultado.id);

  return (
    <div className="relative min-h-[calc(100vh-3rem)] overflow-hidden px-4 py-10 sm:py-16">
      <AuroraDeFundo />
      <FormularioDeCadastro
        token={token}
        protocolo={resultado.protocolo}
        /**
         * 🔴 O NÚMERO QUE ELE VIU NA TELA DO PARCEIRO.
         *
         * Os dois lados numeram com o MESMO formato `SOL-000000`, em sequências
         * independentes — medido em 11/09/2026. Sem mostrar os dois, o paciente vê um número
         * diferente do que anotou e conclui que algo se perdeu.
         */
        pedidoDoParceiro={resultado.pedidoDoParceiro}
        pendencias={pendenciasDe(resultado.documentosDoParceiro)}
        /**
         * 🔴 O QUE JÁ CHEGOU TAMBÉM APARECE.
         *
         * Levantado pelo dono em 10/09/2026: a tela dizia só o que FALTA. Quem preencheu o
         * formulário da Greens e subiu RG e comprovante não via confirmação nenhuma de que
         * aquilo chegou — e "será que perderam meus documentos?" é o tipo de dúvida que faz
         * o paciente parar no meio e ligar para o atendimento.
         */
        recebidos={recebidosDe(resultado.documentosDoParceiro)}
        urlDeRetorno={resultado.urlDeRetorno}
        // ⚠️ Qualquer um destes pode ser null — existe contato de WhatsApp sem nome
        // nenhum. O formulário pede o que faltar em vez de assumir presença.
        nomeInicial={resultado.nomeCompleto}
        emailInicial={resultado.email}
        telefoneInicial={resultado.telefone}
        cpfInicial={resultado.cpf}
        /**
         * 🔴 QUEM VEIO DO FORMULÁRIO DO PARCEIRO NÃO DIGITA NADA DE NOVO.
         *
         * Ele já preencheu nome, CPF, telefone e e-mail lá. A tela CONFIRMA o que chegou e
         * pede só o que ainda não existe: a senha e o código do e-mail. Pedir tudo de novo é
         * fazer o trabalho duas vezes, e é onde se perde gente no meio do cadastro.
         */
        veioDeParceiro={!!resultado.parceiro}
        /**
         * 🔴 QUEM VEIO DO FORMULÁRIO DO PARCEIRO JÁ RESPONDEU SOBRE A ANVISA.
         *
         * No formulário da Greens ele marcou se tem ou não a autorização, e anexou o que
         * tinha. Repetir a pergunta aqui é pedir a mesma resposta duas vezes.
         *
         * ⚠️ `parceiro` não serve para isso: o BOT da Greens também grava `parceiro:
         * 'greens'`, e ele não perguntou nada. Quem responde é a ORIGEM.
         */
        jaDeclarouSobreAnvisa={
          resultado.origem === 'greens_handoff' || resultado.declarouTerAutorizacaoAnvisa !== null
        }
        /**
         * 🔴 SEPARADA DA ANVISA desde 11/09/2026 (Item 33).
         *
         * Antes, uma flag só decidia as DUAS perguntas: quem viesse do formulário da Greens
         * não era perguntado sobre receita, mesmo que ninguém lá tivesse perguntado. Agora
         * cada pergunta olha a própria declaração.
         *
         * ⚠️ `!== null` e não `=== true`: quem respondeu "não tenho" também já respondeu, e
         * repetir a pergunta a ele é o mesmo defeito.
         */
        jaDeclarouSobreReceita={
          resultado.origem === 'greens_handoff' || resultado.declarouTerReceitaMedica !== null
        }
      />
    </div>
  );
}

/**
 * O fundo "fluid": três manchas de cor que se deslocam devagar.
 *
 * Usa APENAS os tokens do design system (primary, secondary, peach) — nenhuma cor nova.
 * `aria-hidden` porque não carrega informação, e `motion-reduce:animate-none` porque
 * movimento contínuo em tela cheia é gatilho vestibular para parte das pessoas.
 */
export function AuroraDeFundo() {
  return (
    <>
      {/*
        React 19 eleva este bloco para o <head> e o deduplica por `href` — então ele
        aparece uma vez, mesmo que a página renderize a aurora em dois caminhos.
        Fica AQUI, e não em `app/globals.css`, de propósito: é decoração de UMA tela.
        O design system global é o que todas as telas compartilham, e engordá-lo com
        efeito de página é como o `globals.css` deste tipo de projeto chega a 448 linhas
        das quais metade serve a um lugar só.
      */}
      <style href="bh-aurora-cadastro" precedence="medium">{`
        .bh-blob {
          position: absolute;
          border-radius: 9999px;
          filter: blur(72px);
          opacity: 0.5;
          will-change: transform;
        }
        /* Só tokens do design system — nenhuma cor nova entra por aqui. */
        .bh-blob-1 {
          top: -14%; left: -10%;
          width: 46vw; height: 46vw; min-width: 320px; min-height: 320px;
          background: var(--primary);
          opacity: 0.22;
          animation: bh-drift-1 26s ease-in-out infinite alternate;
        }
        .bh-blob-2 {
          bottom: -20%; right: -12%;
          width: 52vw; height: 52vw; min-width: 340px; min-height: 340px;
          background: var(--secondary);
          opacity: 0.18;
          animation: bh-drift-2 32s ease-in-out infinite alternate;
        }
        .bh-blob-3 {
          top: 34%; right: 18%;
          width: 30vw; height: 30vw; min-width: 220px; min-height: 220px;
          background: var(--color-peach);
          opacity: 0.28;
          animation: bh-drift-3 24s ease-in-out infinite alternate;
        }
        @keyframes bh-drift-1 {
          from { transform: translate3d(0,0,0) scale(1); }
          to   { transform: translate3d(6vw, 4vh, 0) scale(1.12); }
        }
        @keyframes bh-drift-2 {
          from { transform: translate3d(0,0,0) scale(1.06); }
          to   { transform: translate3d(-7vw, -5vh, 0) scale(1); }
        }
        @keyframes bh-drift-3 {
          from { transform: translate3d(0,0,0) scale(0.94); }
          to   { transform: translate3d(-4vw, 6vh, 0) scale(1.1); }
        }
        /*
          🔴 Movimento contínuo em tela cheia é gatilho vestibular. Quem pediu menos
          movimento no sistema operacional recebe o mesmo desenho, parado.
        */
        @media (prefers-reduced-motion: reduce) {
          .bh-blob { animation: none !important; }
        }
      `}</style>
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="bh-blob bh-blob-1" />
        <div className="bh-blob bh-blob-2" />
        <div className="bh-blob bh-blob-3" />
        <div className="bg-background/40 absolute inset-0 backdrop-blur-[80px]" />
      </div>
    </>
  );
}
