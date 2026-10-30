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
 * O acesso é auditado: cada entrega grava `visualizar` em `logs_auditoria`, só com ids.
 */
import { and, eq, isNull, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { triagens, users } from '@/db/schema';
import { obterUsuarioAtual } from '@/lib/auth/permissions';
import { db } from '@/lib/db';
import { motivoLegivel } from '@/lib/erros/motivo-legivel';
import {
  cabecalhosDoLimite,
  consumir,
  identificarChamador,
} from '@/lib/seguranca/limite-de-requisicao';
import { nomeAscii } from '@/lib/triagens/ficha-formatos';
import { registrarAuditoria } from '@/lib/utils/audit';

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

  // O papel vem do banco, não do JWT — mesma fonte de `/api/triagens/[id]/ficha-pdf`.
  const [usuario] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(and(eq(users.clerkId, perm.clerkId), isNull(users.deletedAt)))
    .limit(1);
  if (!usuario || usuario.role !== 'admin') return NAO_ENCONTRADO();

  try {
    // Só os dois campos do anexo: o resto do `dados` não precisa sair do banco aqui.
    const [triagem] = await db
      .select({
        id: triagens.id,
        arquivo: sql<string | null>`${triagens.dados} ->> 'relatorio_medico_arquivo'`,
        nome: sql<string | null>`${triagens.dados} ->> 'relatorio_medico_nome'`,
      })
      .from(triagens)
      .where(eq(triagens.id, id.data))
      .limit(1);
    if (!triagem?.arquivo) return NAO_ENCONTRADO();

    // A data URL foi validada na gravação (`criarTriagem`), mas triagem antiga pode não ter sido.
    const partes = /^data:([^;,]+);base64,([\s\S]+)$/.exec(triagem.arquivo);
    if (!partes) return NAO_ENCONTRADO();
    const [, mimeType, conteudo] = partes;
    const arquivo = Buffer.from(conteudo, 'base64');

    // Audita ANTES de entregar. O registro leva só ids.
    await registrarAuditoria({
      userId: usuario.id,
      acao: 'visualizar',
      entidade: 'triagens',
      entidadeId: triagem.id,
      dadosDepois: { exportacao: 'triagem_relatorio_medico' },
    });

    const nomeArquivo = triagem.nome?.trim() || 'relatorio.pdf';

    return new NextResponse(new Uint8Array(arquivo), {
      headers: {
        'content-type': mimeType,
        'content-length': String(arquivo.length),
        'content-disposition': `attachment; filename="${nomeAscii(nomeArquivo) || 'relatorio'}"; filename*=UTF-8''${encodeURIComponent(nomeArquivo)}`,
        'cache-control': 'private, no-store',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch (erro) {
    console.error('[triagens] falha ao entregar o relatório:', motivoLegivel(erro));
    return NextResponse.json({ erro: 'Não foi possível baixar o relatório' }, { status: 500 });
  }
}
