/**
 * `POST /api/chatpro/intake` — a porta JSON, para integrador.
 *
 * Mesma lógica do caminho principal, resposta diferente: aqui devolve JSON com o link, em
 * vez do texto que vira mensagem. Existe para qualquer integração que não seja o bloco
 * "Requisição externa" do painel — inclusive o painel interno, quando um atendente precisar
 * gerar o link à mão.
 *
 * Autenticado por segredo em CABEÇALHO, e não na URL: cabeçalho não vaza em log de acesso,
 * em referrer nem em histórico de navegador.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { contasConfiguradas, identificarConta } from '@/lib/chatpro/contas';
import { lerSegredoDoCabecalho } from '@/lib/chatpro/segredo';
import {
  ErroDeContatoNaoConfirmado,
  ErroDeTelefoneInvalido,
  ServicoDeSolicitacao,
} from '@/lib/chatpro/solicitacao';

export const dynamic = 'force-dynamic';

const entradaSchema = z.object({
  /**
   * Nome COMPLETO — no mínimo duas palavras.
   *
   * O fluxo pergunta "me confirma seu nome completo", e aceitar uma palavra só deixaria
   * passar "Maria", que não serve para documento nem para identificar o paciente depois.
   */
  nome: z
    .string()
    .trim()
    .min(3, 'Nome deve ter no mínimo 3 caracteres')
    .max(200, 'Nome deve ter no máximo 200 caracteres')
    .refine((v) => v.split(/\s+/).length >= 2, 'Informe o nome completo'),
  /** 🔴 O campo que o fluxo do projeto irmão não coleta. Opcional aqui, pedido no bot. */
  email: z.string().trim().email('E-mail inválido').max(200).optional(),
  telefone: z.string().trim().min(8, 'Telefone inválido').max(40),
  leadId: z.string().trim().max(100).optional(),
  sessionId: z.string().trim().max(100).optional(),
});

export async function POST(request: NextRequest) {
  /**
   * 🔴 IDENTIFICA A CONTA, NÃO CONFERE UMA SÓ — corrigido em 14/09/2026, junto da `triagem`.
   *
   * Lia `process.env.CHATPRO_INTAKE_SECRET` direto, que é o segredo da conta **BeHemp**:
   * um integrador da Greens era recusado com 401 por construção. Ver a nota da `triagem`
   * para por que o guarda das duas contas não pegou isto.
   *
   * E a conta não serve só para autenticar: ela decide o `parceiro` da solicitação e para
   * onde o paciente volta no fim. Autenticar pela conta e não repassá-la faria o cadastro
   * da Greens nascer marcado como BeHemp — que é o defeito que o guarda já proíbe no
   * `bot-link`.
   */
  if (contasConfiguradas().length === 0) {
    console.error('[chatpro] nenhuma conta configurada — intake indisponível');
    return NextResponse.json(
      { sucesso: false, erro: 'Integração não configurada', codigo: 'CHATPRO_NAO_CONFIGURADO' },
      { status: 503 },
    );
  }

  const conta = identificarConta(lerSegredoDoCabecalho(request.headers));
  if (!conta) {
    console.warn('[chatpro] intake com segredo inválido');
    return NextResponse.json(
      { sucesso: false, erro: 'Não autorizado', codigo: 'CHATPRO_NAO_AUTORIZADO' },
      { status: 401 },
    );
  }

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json(
      { sucesso: false, erro: 'Corpo inválido', codigo: 'VALIDACAO' },
      { status: 400 },
    );
  }

  const analisado = entradaSchema.safeParse(corpo);
  if (!analisado.success) {
    return NextResponse.json(
      {
        sucesso: false,
        erro: analisado.error.issues[0]?.message ?? 'Dados inválidos',
        codigo: 'VALIDACAO',
      },
      { status: 400 },
    );
  }

  try {
    const r = await new ServicoDeSolicitacao().intake({ ...analisado.data, conta });

    return NextResponse.json({
      sucesso: true,
      solicitacaoId: r.solicitacaoId,
      protocolo: r.protocolo,
      linkDeAcesso: r.linkDeAcesso,
      expiraEm: r.expiraEm.toISOString(),
      // Explícitos de propósito: `reaproveitou` diz que NÃO nasceu protocolo novo, e
      // `linkReemitido` diz que o link anterior parou de valer. Um campo só seria ambíguo.
      reaproveitou: r.reaproveitou,
      linkReemitido: r.linkReemitido,
      origem: r.origem,
    });
  } catch (erro) {
    if (erro instanceof ErroDeTelefoneInvalido || erro instanceof ErroDeContatoNaoConfirmado) {
      return NextResponse.json(
        { sucesso: false, erro: erro.message, codigo: erro.codigo },
        { status: 400 },
      );
    }

    console.error('[chatpro] intake: falha inesperada', {
      mensagem: erro instanceof Error ? erro.message : String(erro),
    });
    return NextResponse.json(
      { sucesso: false, erro: 'Erro ao gerar o link', codigo: 'ERRO_INTERNO' },
      { status: 500 },
    );
  }
}
