import { NextResponse } from 'next/server';
import { z } from 'zod';

import { lerCabecalhos, verificarAssinatura } from '@/lib/parceiros/assinatura';
import { ErroDeContatoInsuficiente, ServicoDeHandoff } from '@/lib/parceiros/handoff';
import { mascararEmail, mascararTelefone } from '@/lib/chatpro/telefone';

export const dynamic = 'force-dynamic';

/**
 * O CADASTRO QUE VEM DA GREENS (ADR-0016).
 *
 * O paciente preencheu o formulário de intake lá e escolheu continuar aqui. Os dados
 * chegam por esta rota, **de servidor a servidor**; com o paciente viaja apenas o token
 * que devolvemos.
 *
 * 🔴 POR QUE OS DADOS NÃO VÊM NA URL DO PACIENTE
 * A OWASP classifica dado pessoal em query string como exposição, e o ponto que decide é
 * que **HTTPS não resolve**: a URL fica no histórico do navegador, no log do servidor e em
 * qualquer proxy do caminho — e ainda vaza pelo `Referer` ao seguir link externo.
 *
 * 🔴 ESTA ROTA MEXE NO PREÇO DE UMA COMPRA
 * Do lado da Greens, `behempJourney != NONE` roteia o pagamento para o Mercado Pago **com
 * desconto collab**; `NONE` vai para a Cannect. Um handoff duplicado ou perdido não erra
 * só um cadastro: erra o gateway e o valor. É por isso que a idempotência por id de evento
 * é requisito, não boa prática.
 */
const esquema = z.object({
  /**
   * OPCIONAL de propósito: a fonte do id é o CABEÇALHO ASSINADO, não o corpo.
   * Aceitá-lo aqui serve só para detectar divergência — ver a checagem abaixo.
   */
  eventoId: z.string().trim().min(8).max(64).optional(),
  nomeCompleto: z.string().trim().max(200).optional().nullable(),
  email: z.string().trim().toLowerCase().email().optional().nullable(),
  telefone: z.string().trim().max(40).optional().nullable(),
  cpf: z.string().trim().max(20).optional().nullable(),
  pedidoDoParceiro: z.string().trim().max(64).optional().nullable(),
  /** Quais dos 5 documentos o parceiro JÁ tem. O que faltar vira pendência não bloqueante. */
  documentos: z.array(z.string()).max(20).optional().nullable(),
  /** Para onde devolver o paciente. Conferida contra a lista de origens permitidas. */
  urlDeRetorno: z.string().trim().max(500).optional().nullable(),
});

export async function POST(request: Request) {
  /**
   * 🔴 O CORPO É LIDO COMO TEXTO, E ESSA ORDEM É OBRIGATÓRIA.
   * A assinatura cobre os bytes exatos que chegaram. `request.json()` faria o parse antes,
   * e reserializar para conferir produziria uma string diferente da assinada — chaves em
   * outra ordem, espaço a mais, número normalizado. A assinatura falharia sem motivo
   * aparente. Lê-se cru, verifica-se, e só então faz o parse.
   */
  const corpoCru = await request.text();
  const cabecalhos = lerCabecalhos(request.headers);

  const conferencia = verificarAssinatura({
    cabecalhos,
    corpoCru,
    segredo: process.env.PARCEIRO_GREENS_SEGREDO_ENTRADA,
  });

  if (!conferencia.valida) {
    if (conferencia.motivo === 'sem_segredo') {
      console.error('[parceiros] PARCEIRO_GREENS_SEGREDO_ENTRADA ausente — rota indisponível');
      return NextResponse.json({ sucesso: false, erro: 'Não configurado' }, { status: 503 });
    }
    // Um só status para todos os motivos: distinguir "assinatura inválida" de "fora da
    // janela" diria a quem tenta se o segredo está certo e só o relógio está errado.
    console.warn('[parceiros] handoff recusado', { motivo: conferencia.motivo });
    return NextResponse.json({ sucesso: false, erro: 'Não autorizado' }, { status: 401 });
  }

  let corpo: unknown;
  try {
    corpo = JSON.parse(corpoCru);
  } catch {
    return NextResponse.json({ sucesso: false, erro: 'Corpo inválido' }, { status: 400 });
  }

  const analise = esquema.safeParse(corpo);
  if (!analise.success) {
    return NextResponse.json(
      { sucesso: false, erro: analise.error.issues[0]?.message ?? 'Dados inválidos' },
      { status: 422 },
    );
  }

  /**
   * 🔴 SE O CORPO TRAZ UM `eventoId` DIFERENTE DO CABEÇALHO, RECUSA.
   *
   * O cabeçalho é o que está assinado; o corpo também está, mas os dois divergirem só
   * acontece por bug do cliente ou por tentativa de descolar a chave de idempotência do
   * que foi autenticado. Escolher um em silêncio esconderia o problema — e, como a
   * idempotência aqui decide gateway e desconto, escondê-lo custaria dinheiro.
   *
   * ⚠️ A primeira versão deste arquivo espalhava `...analise.data` DEPOIS de `eventoId`,
   * o que fazia o corpo sobrescrever o cabeçalho — o oposto do que o comentário dizia. O
   * type-check acusou (TS2783). Comentário não é garantia; ordem de spread é.
   */
  if (analise.data.eventoId && analise.data.eventoId !== cabecalhos.id) {
    return NextResponse.json(
      { sucesso: false, erro: 'Identificador do evento divergente', codigo: 'EVENTO_DIVERGENTE' },
      { status: 422 },
    );
  }

  try {
    /**
     * 🔴 CAMPO A CAMPO, SEM SPREAD — e isso é a correção, não estilo.
     *
     * A primeira versão fazia `...analise.data` e o corpo sobrescrevia o `eventoId` do
     * cabeçalho (TS2783). Trocar a ordem do spread resolveria o caso; escrever os campos
     * elimina a CLASSE: nenhum campo novo no corpo, amanhã, pode alcançar um parâmetro
     * que não esteja listado aqui de propósito.
     */
    const resultado = await new ServicoDeHandoff().receber({
      parceiro: 'greens',
      // A fonte do id é o cabeçalho ASSINADO — nunca o corpo.
      eventoId: cabecalhos.id,
      nomeCompleto: analise.data.nomeCompleto,
      email: analise.data.email,
      telefone: analise.data.telefone,
      cpf: analise.data.cpf,
      pedidoDoParceiro: analise.data.pedidoDoParceiro,
      documentos: analise.data.documentos,
      urlDeRetorno: analise.data.urlDeRetorno,
    });

    console.info('[parceiros] handoff recebido', {
      protocolo: resultado.protocolo,
      reenvio: resultado.reenvio,
      // Só mascarado — e-mail e telefone são dado pessoal, e log fica anos sem ninguém ler.
      email: mascararEmail(analise.data.email),
      telefone: mascararTelefone(analise.data.telefone),
    });

    return NextResponse.json({
      sucesso: true,
      dados: {
        // 🔴 É o `behempReferralId` do outro lado. O schema deles espera até 64 caracteres,
        // e é por ele que o nosso webhook de volta vai localizar a solicitação lá.
        referralId: resultado.referralId,
        protocolo: resultado.protocolo,
        urlDeContinuacao: resultado.linkDeAcesso,
        expiraEm: resultado.expiraEm.toISOString(),
        reenvio: resultado.reenvio,
      },
    });
  } catch (erro) {
    if (erro instanceof ErroDeContatoInsuficiente) {
      return NextResponse.json(
        { sucesso: false, erro: erro.message, codigo: erro.codigo },
        { status: 422 },
      );
    }
    console.error('[parceiros] handoff: falha inesperada', {
      // Nome do erro apenas: a mensagem do Postgres carrega o valor da coluna que violou
      // a constraint, e as colunas aqui são e-mail, telefone e CPF.
      erro: erro instanceof Error ? erro.name : 'desconhecido',
    });
    return NextResponse.json({ sucesso: false, erro: 'Falha ao processar' }, { status: 500 });
  }
}
