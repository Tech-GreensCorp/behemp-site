/**
 * A TRIAGEM EM PDF — o mesmo conteúdo do modal de detalhes de `/admin/triagens`.
 *
 * Quem pode ler: SÓ o admin, como a própria listagem (`listarTriagens`). Médico não: a lista dele
 * só traz as triagens que ele criou, e esta rota recebe um id qualquer.
 * Tudo que não pode responde 404 — nunca 403 —, para a rota não virar oráculo de ids (mesma
 * decisão de `/api/comunicados/[id]/arquivo` e `/api/documentos/[id]/arquivo`). A única
 * exceção é "sem sessão", que é 401: não revela nada sobre o objeto.
 *
 * Quanto tempo fica: o PDF NÃO é gravado. Nasce na requisição, vai direto ao navegador e some
 * do servidor — não há arquivo para vazar depois. `cache-control: private, no-store`.
 *
 * O acesso é auditado: cada geração grava `visualizar` em `logs_auditoria`, com quem pediu e a
 * triagem — e nenhum dado pessoal no registro.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { and, eq, isNull } from 'drizzle-orm';
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
import { nomeAscii, nomeDoArquivoDaFicha } from '@/lib/triagens/ficha-formatos';
import { gerarPdfDaTriagem, nomeDaTriagem } from '@/lib/triagens/triagem-pdf';
import { registrarAuditoria } from '@/lib/utils/audit';

/** Gerar PDF custa CPU: 10 por minuto por chamador (OWASP API4:2023). */
const LIMITE = 10;
const JANELA_EM_SEGUNDOS = 60;

/** Lê dado de saúde e gera o arquivo na hora: nunca pode vir de cache. */
export const dynamic = 'force-dynamic';
/** `@react-pdf/renderer` e `node:fs` pedem Node, não Edge. */
export const runtime = 'nodejs';

const idSchema = z.string().trim().min(1).max(64);

const NAO_ENCONTRADO = () => NextResponse.json({ erro: 'Triagem não encontrada' }, { status: 404 });

async function lerLogo(): Promise<Buffer | null> {
  try {
    return await readFile(path.join(process.cwd(), 'public', 'logo.png'));
  } catch {
    // Sem a marca o documento continua correto; só fica sem a logo.
    return null;
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limite = consumir(
    identificarChamador(request.headers, 'triagem-pdf'),
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

  // O papel vem do banco, não do JWT: o claim pode atrasar (ver `middleware.ts`) e esta rota
  // entrega dado de saúde. Mesma fonte que `/api/comunicados/[id]/arquivo`.
  const [usuario] = await db
    .select({ id: users.id, nome: users.nome, role: users.role })
    .from(users)
    .where(and(eq(users.clerkId, perm.clerkId), isNull(users.deletedAt)))
    .limit(1);
  if (!usuario || usuario.role !== 'admin') return NAO_ENCONTRADO();

  try {
    const [triagem] = await db.select().from(triagens).where(eq(triagens.id, id.data)).limit(1);
    if (!triagem) return NAO_ENCONTRADO();

    // Audita ANTES de entregar. O registro leva só ids: nome, CPF e e-mail não entram no log.
    await registrarAuditoria({
      userId: usuario.id,
      acao: 'visualizar',
      entidade: 'triagens',
      entidadeId: triagem.id,
      dadosDepois: { exportacao: 'triagem_pdf' },
    });

    const arquivo = await gerarPdfDaTriagem(triagem, usuario.nome, await lerLogo());
    const nomeArquivo = nomeDoArquivoDaFicha(nomeDaTriagem(triagem));

    return new NextResponse(new Uint8Array(arquivo), {
      headers: {
        'content-type': 'application/pdf',
        'content-length': String(arquivo.length),
        // `filename*` carrega o nome com acento; `filename` é o fallback ASCII dos clientes antigos.
        'content-disposition': `attachment; filename="${nomeAscii(nomeArquivo) || 'Paciente.pdf'}"; filename*=UTF-8''${encodeURIComponent(nomeArquivo)}`,
        'cache-control': 'private, no-store',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch (erro) {
    // `motivoLegivel` diagnostica sem vazar: a mensagem crua do Drizzle traz a query com os
    // valores inline — CPF e e-mail do paciente iriam para o log.
    console.error('[triagens] falha ao gerar o PDF:', motivoLegivel(erro));
    return NextResponse.json({ erro: 'Não foi possível gerar o PDF' }, { status: 500 });
  }
}
