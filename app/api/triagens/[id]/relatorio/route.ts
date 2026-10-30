/**
 * O RELATÓRIO MÉDICO ANEXADO À TRIAGEM — o arquivo que o formulário público grava em base64
 * dentro de `triagens.dados.relatorio_medico_arquivo`.
 *
 * Existe porque a listagem (`listarTriagens`) deixou de trazer o anexo: ele ia, de todas as
 * triagens, para o navegador a cada abertura de `/admin/triagens`. Agora sai só quando o admin
 * pede aquele arquivo.
 *
 * Quem pode ler: SÓ o admin, como a listagem e `/api/triagens/[id]/ficha-pdf`. Tudo que não pode
 * responde 404 — nunca 403 —, para a rota não virar oráculo de ids. "Sem sessão" é 401.
 *
 * Quanto tempo fica: nada é gravado aqui; o arquivo continua onde já estava (o `dados` da
 * triagem). `cache-control: private, no-store`.
 *
 * O acesso é auditado, e SEM auditoria não há entrega: se o registro em `logs_auditoria` falhar,
 * a rota responde 500 e o arquivo não sai. É o contrário de `/api/documentos/[id]/arquivo`, de
 * propósito: lá o leitor é o próprio paciente ("auditoria indisponível não pode impedir o
 * paciente de ver o próprio RG"); aqui é o admin lendo o laudo de outra pessoa.
 */
import { and, eq, isNull, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { logsAuditoria, triagens, users } from '@/db/schema';
import { obterUsuarioAtual } from '@/lib/auth/permissions';
import { db } from '@/lib/db';
import { motivoLegivel } from '@/lib/erros/motivo-legivel';
import {
  cabecalhosDoLimite,
  consumir,
  identificarChamador,
} from '@/lib/seguranca/limite-de-requisicao';
import {
  CAMPO_DO_ARQUIVO,
  codificarNomeRfc5987,
  decodificarConteudo,
  lerDataUrl,
  tipoDaEntrega,
} from '@/lib/triagens/anexo-do-relatorio';
import { nomeAscii } from '@/lib/triagens/ficha-formatos';

/** Cada entrega pode ter 10 MB: 20 por minuto por chamador (OWASP API4:2023). */
const LIMITE = 20;
const JANELA_EM_SEGUNDOS = 60;

/** Entrega dado de saúde: nunca pode vir de cache. */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const idSchema = z.string().trim().min(1).max(64);

const NAO_ENCONTRADO = () =>
  NextResponse.json({ erro: 'Relatório não encontrado' }, { status: 404 });

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limite = consumir(
    identificarChamador(request.headers, 'triagem-relatorio'),
    LIMITE,
    JANELA_EM_SEGUNDOS,
  );
  if (!limite.permitido) {
    return NextResponse.json(
      { erro: 'Muitas requisições. Tente novamente em instantes.' },
      { status: 429, headers: cabecalhosDoLimite(limite, LIMITE) },
    );
  }

  const perm = await obterUsuarioAtual();
  if (!perm.autorizado || !perm.clerkId) {
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 });
  }

  const { id: idBruto } = await params;
  const id = idSchema.safeParse(idBruto);
  if (!id.success) return NAO_ENCONTRADO();

  try {
    // O papel vem do banco, não do JWT — mesma fonte de `/api/triagens/[id]/ficha-pdf`.
    const [usuario] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(and(eq(users.clerkId, perm.clerkId), isNull(users.deletedAt)))
      .limit(1);
    if (!usuario || usuario.role !== 'admin') return NAO_ENCONTRADO();

    // Só os dois campos do anexo: o resto do `dados` não precisa sair do banco aqui.
    const [triagem] = await db
      .select({
        id: triagens.id,
        arquivo: sql<string | null>`${triagens.dados} ->> ${CAMPO_DO_ARQUIVO}::text`,
        nome: sql<string | null>`${triagens.dados} ->> 'relatorio_medico_nome'`,
      })
      .from(triagens)
      .where(eq(triagens.id, id.data))
      .limit(1);
    if (!triagem?.arquivo) return NAO_ENCONTRADO();

    // Valida ANTES de auditar: arquivo vazio ou corrompido não é entrega, e não pode virar um
    // "visualizou" no registro. A data URL foi validada na gravação (`criarTriagem`), mas
    // triagem antiga pode não ter sido.
    const dataUrl = lerDataUrl(triagem.arquivo);
    const arquivo = dataUrl ? decodificarConteudo(dataUrl.conteudo) : null;
    if (!dataUrl || !arquivo) return NAO_ENCONTRADO();

    // Insert direto, e não `registrarAuditoria`: o helper engole a própria falha, e aqui a
    // falha tem de impedir a entrega (ver o cabeçalho). O registro leva só ids.
    await db.insert(logsAuditoria).values({
      userId: usuario.id,
      acao: 'visualizar',
      entidade: 'triagens',
      entidadeId: triagem.id,
      dadosDepois: { exportacao: 'triagem_relatorio_medico' },
      ip:
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        request.headers.get('x-real-ip') ??
        null,
    });

    const nomeArquivo = triagem.nome?.trim() || 'relatorio';

    return new NextResponse(new Uint8Array(arquivo), {
      headers: {
        'content-type': tipoDaEntrega(dataUrl.mimeType),
        'content-length': String(arquivo.length),
        'content-disposition': `attachment; filename="${nomeAscii(nomeArquivo) || 'relatorio'}"; filename*=UTF-8''${codificarNomeRfc5987(nomeArquivo)}`,
        'cache-control': 'private, no-store',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch (erro) {
    // `motivoLegivel` diagnostica sem vazar: a mensagem crua do Drizzle traz a query com os
    // valores inline.
    console.error('[triagens] falha ao entregar o relatório:', motivoLegivel(erro));
    return NextResponse.json({ erro: 'Não foi possível baixar o relatório' }, { status: 500 });
  }
}
