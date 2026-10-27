/**
 * A ENTREGA AUTENTICADA DE UM DOCUMENTO DO CHECKLIST DA ANVISA — para o admin.
 *
 * O "Ver" do painel era `<a href={doc.urlBlob}>`. Os itens do checklist são copiados de
 * `documentos.urlBlob`, que desde 13/09/2026 é PRIVADO e responde 403 no link direto; os
 * enviados pelo próprio checklist ficam em store público e abriam SEM autenticação nem
 * auditoria. O checklist é um JSON sem o `id` da linha de `documentos`, e há itens que nem têm
 * linha lá — por isso esta rota resolve por `(autorizacaoId, tipo)`, lendo o próprio JSON, e o
 * navegador nunca recebe a URL.
 *
 * `tipo` = o tipo do item (`rg`, `receita_medica`…) ou `procuracao_assinada` para o PDF
 * assinado da procuração específica.
 *
 * As três perguntas do `.claude/rules/seguranca-lgpd.md`: quem pode ler (só admin), quanto
 * tempo fica (autorização apagada não abre) e o acesso é auditado (`visualizar`).
 */

import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, isNull } from 'drizzle-orm';

import { autorizacoesAnvisa, procuracoesEspecificas, users } from '@/db/schema';
import { verificarAdmin } from '@/lib/auth/permissions';
import { db } from '@/lib/db';
import { entregarBlob } from '@/lib/documentos/entregar-blob';
import {
  cabecalhosDoLimite,
  consumir,
  identificarChamador,
} from '@/lib/seguranca/limite-de-requisicao';
import { registrarAuditoria } from '@/lib/utils/audit';

const LIMITE = 30;
const JANELA_EM_SEGUNDOS = 60;
const TIPO_PROCURACAO = 'procuracao_assinada';

export const dynamic = 'force-dynamic';

const naoEncontrado = () =>
  NextResponse.json({ erro: 'Documento não encontrado' }, { status: 404 });

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ autorizacaoId: string; tipo: string }> },
) {
  const { autorizacaoId, tipo } = await params;

  // O limite vem ANTES da autenticação: cada tentativa custaria uma consulta ao banco — NOSSA.
  const limite = consumir(
    identificarChamador(request.headers, 'anvisa-doc'),
    LIMITE,
    JANELA_EM_SEGUNDOS,
  );
  if (!limite.permitido) {
    return NextResponse.json(
      { erro: 'Muitas requisições. Tente novamente em instantes.' },
      { status: 429, headers: cabecalhosDoLimite(limite, LIMITE) },
    );
  }

  const admin = await verificarAdmin();
  if (!admin.autorizado || !admin.clerkId) return naoEncontrado();

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, admin.clerkId))
    .limit(1);
  if (!user) return naoEncontrado();

  const [autorizacao] = await db
    .select({ id: autorizacoesAnvisa.id, documentos: autorizacoesAnvisa.documentos })
    .from(autorizacoesAnvisa)
    .where(and(eq(autorizacoesAnvisa.id, autorizacaoId), isNull(autorizacoesAnvisa.deletedAt)))
    .limit(1);
  if (!autorizacao) return naoEncontrado();

  let url: string | null = null;
  let nomeArquivo: string | null = null;

  if (tipo === TIPO_PROCURACAO) {
    const [procuracao] = await db
      .select({ urlPdfAssinado: procuracoesEspecificas.urlPdfAssinado })
      .from(procuracoesEspecificas)
      .where(
        and(
          eq(procuracoesEspecificas.autorizacaoId, autorizacao.id),
          isNull(procuracoesEspecificas.deletedAt),
        ),
      )
      .orderBy(desc(procuracoesEspecificas.createdAt))
      .limit(1);
    url = procuracao?.urlPdfAssinado ?? null;
    nomeArquivo = 'procuracao-especifica-assinada.pdf';
  } else {
    const itens = Array.isArray(autorizacao.documentos)
      ? (autorizacao.documentos as {
          tipo?: string;
          urlBlob?: string | null;
          nomeArquivo?: string | null;
        }[])
      : [];
    const item = itens.find((d) => d?.tipo === tipo);
    url = item?.urlBlob ?? null;
    nomeArquivo = item?.nomeArquivo ?? null;
  }
  if (!url) return naoEncontrado();

  // Nunca lança: auditoria indisponível não pode impedir o admin de conferir o documento.
  await registrarAuditoria({
    userId: user.id,
    acao: 'visualizar',
    entidade: 'autorizacoes_anvisa',
    entidadeId: autorizacao.id,
    dadosDepois: { documento: tipo },
  }).catch(() => {});

  return entregarBlob(url, nomeArquivo, `${tipo}`, 'anvisa-admin');
}
