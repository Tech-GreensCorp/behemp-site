import { lerSegredoDoCabecalho, segredosConferem } from '@/lib/chatpro/segredo';
import { mascararTelefone, removerSufixoWhatsapp } from '@/lib/chatpro/telefone';
import { situacaoDoContato } from '@/lib/chatpro/triagem';
import { interpretarResposta } from '@/lib/chatpro/resposta-do-paciente';
import { textoDaTriagem } from '@/lib/chatpro/texto-da-triagem';
import { parametrosDoPainel } from '@/lib/chatpro/query-do-painel';

export const dynamic = 'force-dynamic';

/**
 * A TRIAGEM DO BOT — decide se este contato precisa do link (ADR-0017).
 *
 * Como o `bot-link`, responde **texto puro**: o bloco "Requisição externa" do construtor
 * de fluxo entrega o corpo da resposta COMO MENSAGEM na conversa.
 *
 * 🔴 O QUE SAI DAQUI É O QUE O PACIENTE LÊ. O motivo interno da decisão
 * (`falta_receita`, `receita_vencida`) fica no cabeçalho `x-triagem-motivo`, para o painel
 * rotear — nunca no corpo.
 *
 * ⚠️ E o corpo NUNCA diz que a receita de alguém é inválida: receita de outro médico é
 * legalmente válida, e afirmar o contrário é declaração falsa sobre ato de terceiro. O
 * único motivo nomeado ao paciente é o **vencimento**, que é fato público e verificável.
 */
export async function GET(request: Request) {
  const esperado = process.env.CHATPRO_INTAKE_SECRET?.trim();
  if (!esperado) {
    console.error('[chatpro] CHATPRO_INTAKE_SECRET ausente — triagem indisponível');
    return new Response('Não configurado', { status: 503 });
  }
  if (!segredosConferem(lerSegredoDoCabecalho(request.headers), esperado)) {
    console.warn('[chatpro] triagem com segredo inválido');
    return new Response('Não autorizado', { status: 401 });
  }

  /**
   * 🔴 Tolera `?` usado como separador — a mesma armadilha do `bot-link`, e esta rota é
   * chamada pelo mesmo painel. Ver `query-do-painel.ts`.
   */
  const parametros = parametrosDoPainel(new URL(request.url));
  const p = (n: string[]) => n.map((k) => parametros.get(k)).find((v) => v?.trim()) ?? null;

  const telefone = removerSufixoWhatsapp(p(['phone', 'telefone', 'number']) ?? '');
  const nome = p(['name', 'nome']);
  const cru = p(['resposta', 'answer']);

  /**
   * A resposta chega como TEXTO LIVRE do fluxo. Ver `resposta-do-paciente.ts` para por que
   * isto não é um `switch` de três palavras — a primeira versão deste arquivo usava um, e
   * "Não, ainda não" não casava com nada.
   */
  const resposta = interpretarResposta(cru);

  try {
    const situacao = await situacaoDoContato({ telefone, resposta });

    console.info('[chatpro] triagem', {
      motivo: situacao.motivo,
      oferece: situacao.deveOferecerLink,
      achouCandidato: Boolean(situacao.candidato),
      telefone: mascararTelefone(telefone),
    });

    return new Response(textoDaTriagem(situacao, nome), {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        // Para o painel rotear. NÃO vai no corpo — o corpo o paciente lê.
        'x-triagem-motivo': situacao.motivo,
        'x-triagem-oferecer': situacao.deveOferecerLink ? 'sim' : 'nao',
      },
    });
  } catch (erro) {
    console.error('[chatpro] triagem: falha inesperada', {
      erro: erro instanceof Error ? erro.name : 'desconhecida',
    });
    /**
     * 🔴 ERRO É DE PROPÓSITO — é a rede de segurança herdada da ADR-0015.
     * Status não-2xx dispara a "Ação em caso de falha" do painel, que transfere para uma
     * pessoa. "Falhar" aqui significa "um humano assume", não "o paciente fica sem
     * resposta".
     */
    return new Response('Não consegui verificar agora. Vou chamar um atendente.', { status: 503 });
  }
}
