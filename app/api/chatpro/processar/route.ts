import { NextResponse } from 'next/server';

import { ProcessadorDeEventos } from '@/lib/chatpro/processador';
import { ServicoDeDiretorio } from '@/lib/chatpro/diretorio';
import { segredosConferem } from '@/lib/chatpro/segredo';

export const dynamic = 'force-dynamic';
// Um lote de 25 eventos com confirmação reversa cabe folgado; o teto evita que uma
// indisponibilidade da API do ChatPro segure a função até o limite da plataforma.
export const maxDuration = 60;

/**
 * DISPARA O CONSUMO DA FILA DE EVENTOS DO WEBHOOK.
 *
 * Chamada por cron. Não faz nada que o handler do webhook devesse ter feito — ela existe
 * justamente porque o handler NÃO processa: ele grava e responde `202` (ver
 * `db/schema/chatpro-eventos.ts`).
 *
 * 🔴 FALHA FECHADA, DE PROPÓSITO.
 * As rotas de cron mais antigas deste repositório usam `if (cronSecret && ...)`, o que
 * deixa o endpoint ABERTO quando a variável não está configurada — exatamente o cenário
 * de um ambiente novo, mal provisionado. Aqui a ausência de segredo é `503`: um cron que
 * não roda é visível no monitoramento; um endpoint público que qualquer um dispara, não.
 */
export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET?.trim();
  if (!segredo) {
    console.error('[chatpro] CRON_SECRET ausente — processador indisponível');
    return NextResponse.json(
      { sucesso: false, erro: 'Processador não configurado' },
      { status: 503 },
    );
  }

  const cabecalho = request.headers.get('authorization') ?? '';
  const recebido = cabecalho.replace(/^Bearer\s+/i, '').trim();
  // Comparação em tempo constante — o mesmo helper do segredo do intake.
  if (!segredosConferem(recebido, segredo)) {
    return NextResponse.json({ sucesso: false, erro: 'Não autorizado' }, { status: 401 });
  }

  try {
    /**
     * Sincroniza o diretório ANTES de processar, e o resultado não é condição para nada.
     * Assim um departamento criado no painel hoje já é traduzido nos eventos de hoje,
     * sem deploy. Se a API estiver fora, `nomeDe` devolve o próprio UUID e o evento é
     * processado do mesmo jeito — nome de fila é leitura, evento é dado.
     */
    const diretorio = await new ServicoDeDiretorio().sincronizar();
    const resultado = await new ProcessadorDeEventos().processarLote();

    return NextResponse.json({ sucesso: true, dados: { ...resultado, diretorio } });
  } catch (erro) {
    console.error('[chatpro] processador: falha inesperada', {
      mensagem: erro instanceof Error ? erro.message : 'desconhecida',
    });
    return NextResponse.json({ sucesso: false, erro: 'Falha ao processar' }, { status: 500 });
  }
}
