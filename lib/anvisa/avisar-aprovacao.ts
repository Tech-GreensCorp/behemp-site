/**
 * AVISA O PACIENTE DE QUE A AUTORIZAÇÃO DA ANVISA FOI APROVADA — Item 29.
 *
 * O passo 7 do fluxo Greens 1 pede _"notificação email, celular e no sistema"_. Até 11/09/2026
 * existia **só** o Pusher, que é tempo real: quem não estava com a aba aberta nunca soube.
 *
 * 🔴 O QUE ESTE MÓDULO ENTREGA, E O QUE NÃO ENTREGA:
 *
 * | canal | estado | por quê |
 * | --- | --- | --- |
 * | **no sistema** | ✅ linha em `notificacoes`, que sobrevive à aba fechada | o Pusher sozinho é efêmero |
 * | **e-mail** | ✅ Brevo, o mesmo caminho das outras notificações | — |
 * | **celular (WhatsApp)** | 🔴 **não** | ver abaixo |
 *
 * 🔴 POR QUE O WHATSAPP NÃO ENTRA AQUI, e isto é achado, não esquecimento.
 *
 * `lib/chatpro/cliente.ts` só **busca** contato e sessão — não tem método de envio. Procurei o
 * endpoint de envio ativo nos dois repositórios (aqui e no `greens-corp-backend`) em
 * 11/09/2026: a única ocorrência é o valor de enum `v5_send_message` em
 * `modules/chatpro/types/chatpro.ts`, **sem nenhuma implementação**. Nem o lado deles envia
 * mensagem ativa.
 *
 * Escrever o path por dedução daria um envio que falha em silêncio — e falha em silêncio num
 * canal de aviso é pior que canal ausente, porque alguém passa a contar com ele. Fica no
 * `04-LISTA-DE-AFAZERES.md` como Item 29b, esperando a doc do ChatPro.
 *
 * ⚠️ NUNCA LANÇA. Quem chama está atualizando o status de uma autorização; um provedor de
 * e-mail fora do ar não pode impedir que a aprovação seja registrada. A ordem é: o fato
 * acontece e é gravado; o aviso é consequência.
 */

import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { notificacoes, pacientes, users } from '@/db/schema';
import { enviarEmailAnvisaAprovada } from '@/lib/email/notificacoes';

export interface ResultadoDoAviso {
  noSistema: boolean;
  porEmail: boolean;
}

export async function avisarAnvisaAprovada(params: {
  pacienteId: string;
  numeroProcesso?: string | null;
}): Promise<ResultadoDoAviso> {
  const resultado: ResultadoDoAviso = { noSistema: false, porEmail: false };

  try {
    const [destinatario] = await db
      .select({ userId: users.id, nome: users.nome, email: users.email })
      .from(pacientes)
      .innerJoin(users, eq(users.id, pacientes.userId))
      .where(eq(pacientes.id, params.pacienteId))
      .limit(1);

    if (!destinatario) return resultado;

    /**
     * 1 ── No sistema. Vem primeiro porque é o canal que **não depende de terceiro**: se o
     * Brevo estiver fora, o paciente ainda encontra o aviso ao entrar.
     *
     * `tipo: 'geral'` porque o enum não tem valor para ANVISA. Acrescentar um exigiria
     * migration de enum sem ganho nenhum — `geral` existe exatamente para isto.
     */
    try {
      await db.insert(notificacoes).values({
        userId: destinatario.userId,
        tipo: 'geral',
        titulo: 'Sua autorização da Anvisa foi aprovada',
        mensagem: params.numeroProcesso
          ? `Processo ${params.numeroProcesso}. A autorização vale por dois anos.`
          : 'A autorização vale por dois anos.',
        linkAcao: '/paciente/anvisa',
      });
      resultado.noSistema = true;
    } catch (erro) {
      console.error('[anvisa] falha ao gravar notificação', {
        erro: erro instanceof Error ? erro.name : 'desconhecida',
      });
    }

    // 2 ── E-mail. Sem endereço não há o que tentar — e isso não é erro.
    if (destinatario.email) {
      try {
        await enviarEmailAnvisaAprovada({
          emailPaciente: destinatario.email,
          nomePaciente: destinatario.nome ?? 'paciente',
          numeroProcesso: params.numeroProcesso ?? null,
        });
        resultado.porEmail = true;
      } catch (erro) {
        // 🔴 Nunca o e-mail no log — ele é dado pessoal, e log de erro é lido por muita gente.
        console.error('[anvisa] falha ao enviar e-mail de aprovação', {
          erro: erro instanceof Error ? erro.name : 'desconhecida',
        });
      }
    }

    return resultado;
  } catch (erro) {
    console.error('[anvisa] falha inesperada ao avisar aprovação', {
      erro: erro instanceof Error ? erro.name : 'desconhecida',
    });
    return resultado;
  }
}
