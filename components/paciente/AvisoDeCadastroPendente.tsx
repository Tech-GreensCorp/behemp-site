/**
 * HÁ UM CADASTRO ESPERANDO VOCÊ — o aviso que faltava no painel.
 *
 * 🔴 ADR-0022, D-02. O dono percorreu o fluxo 1 da Greens e ficou com uma conta funcionando,
 * um painel vazio e nenhuma pista do que fazer: _"eu entrei na conta e vim na área de meus
 * documentos: nenhum dos documentos que eu enviei chegaram na minha conta"_.
 *
 * ⚠️ E OS DOCUMENTOS ESTAVAM LÁ — na solicitação, intactos. O que não existia era uma tela
 * que ligasse as duas coisas. Medido em produção no mesmo dia: o link dele ainda respondia
 * `Confirme seus dados` enquanto o painel dizia "nenhum documento enviado". As duas coisas
 * eram verdade, e nenhuma tela contava isso a ele.
 *
 * 🔴 POR QUE NÃO HÁ BOTÃO "CONTINUAR AQUI". O banco guarda `tokenHash`, nunca o token em
 * claro (ADR-0016 D-04) — quem lê o banco não consegue abrir o cadastro de ninguém, e
 * **preservar isso vale mais** que a conveniência de um botão. Então o aviso orienta: diz o
 * protocolo, o prazo, e leva ao WhatsApp para pedir o link de novo. Prometer um caminho que
 * não pode existir seria pior que não avisar.
 *
 * ⚠️ AVISA, NÃO BLOQUEIA (ADR-0016 D-06). Sem cadastro pendente, não renderiza nada — o
 * componente decide sozinho, como o `AvisoDaProcuracao` ao lado.
 */

'use client';

import Link from 'next/link';
import { ArrowRight, FileClock } from 'lucide-react';

import { Button } from '@/components/ui/button';

/** Reusa a variável que já existe e já é usada em `patologias-picker` e no cadastro. */
const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_BEHEMP ?? '5511932047360';

export interface AvisoDeCadastroPendenteProps {
  cadastro: { protocolo: string; parceiro: string | null; expiraEm: Date | string } | null;
}

export function AvisoDeCadastroPendente({ cadastro }: AvisoDeCadastroPendenteProps) {
  if (!cadastro) return null;

  const expira = new Date(cadastro.expiraEm);
  const dias = Math.max(0, Math.ceil((expira.getTime() - Date.now()) / 86_400_000));

  const mensagem = encodeURIComponent(
    `Olá! Comecei meu cadastro na Be4Hope (protocolo ${cadastro.protocolo}) e preciso do link para concluir.`,
  );

  return (
    <div className="animate-fade-up border-secondary/30 bg-secondary/5 mb-5 rounded-3xl border p-5">
      <div className="flex items-start gap-4">
        <span className="bg-secondary/15 text-secondary flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl">
          <FileClock className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-foreground text-sm font-semibold">
            Você tem um cadastro para concluir
          </p>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            O protocolo <strong>{cadastro.protocolo}</strong> está aberto
            {cadastro.parceiro ? ' e veio de um parceiro' : ''}.{' '}
            <strong>Os documentos que você já enviou estão guardados</strong> — eles aparecem aqui
            assim que o cadastro for concluído.
            {dias > 0 ? ` O link vale por mais ${dias} ${dias === 1 ? 'dia' : 'dias'}.` : ''}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {/*
              O link do cadastro NÃO pode ser remontado aqui (só existe o hash do token), então
              o caminho honesto é pedir o link de novo a quem pode emiti-lo.
            */}
            <Button
              size="sm"
              className="rounded-xl"
              render={
                <Link
                  href={`https://wa.me/${WHATSAPP}?text=${mensagem}`}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              Pedir meu link pelo WhatsApp
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl"
              render={<Link href="/paciente/documentos" />}
            >
              Enviar documento por aqui
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
