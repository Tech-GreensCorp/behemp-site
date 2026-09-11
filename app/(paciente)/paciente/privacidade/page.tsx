/**
 * O QUE VOCÊ AUTORIZOU — e como desautorizar.
 *
 * 🔴 ESTA TELA É O ART. 8º §5º, não uma cortesia.
 *
 * A LGPD diz que o consentimento _"pode ser revogado a qualquer momento mediante manifestação
 * expressa do titular, por procedimento gratuito e facilitado"_. "Facilitado" tem um teste
 * prático: se revogar exige abrir um chamado, mandar e-mail ou falar com alguém, não é
 * facilitado. Aqui é o mesmo número de cliques que foi preciso para consentir.
 *
 * ⚠️ E a tela mostra o efeito de desmarcar ANTES de desmarcar. Revogar o retorno ao parceiro
 * para o pedido dele na Greens — se ele descobrir isso depois, a informação chegou tarde.
 */

import type { Metadata } from 'next';

import { meusConsentimentos } from '@/app/(paciente)/_actions/consentimento';

import { PainelDoConsentimento } from './_components/painel-do-consentimento';

export const metadata: Metadata = {
  title: 'Privacidade | Be4Hope',
  description: 'O que você autorizou a Be4Hope a fazer com os seus dados.',
};

export default async function PrivacidadePage() {
  const vigentes = await meusConsentimentos();

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8">
      <header className="space-y-1.5">
        <h1 className="text-foreground text-xl font-semibold">Privacidade</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Aqui fica o que você autorizou. Pode mudar quando quiser — vale a partir do momento em que
          você salva.
        </p>
      </header>

      <PainelDoConsentimento iniciais={vigentes} />

      {/*
        O que a revogação NÃO desfaz. Dizer isto evita a promessa que o sistema não pode
        cumprir: um documento já entregue à Greens não volta porque ele desmarcou uma caixa.
      */}
      <p className="text-muted-foreground/80 border-border/60 border-t pt-4 text-xs leading-relaxed">
        Desmarcar vale daqui para a frente. O que já foi enviado antes continua com quem recebeu —
        se você quiser que apaguem de lá, fale com a gente e nós encaminhamos o pedido.
      </p>
    </div>
  );
}
