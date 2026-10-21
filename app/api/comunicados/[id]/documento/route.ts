/**
 * Entrega autenticada do PDF preenchido de um comunicado (minuta/carta enviada ao paciente).
 *
 * Exibido no card de Atualização do Programa de Doação (admin) para conferência e download.
 * Permissão: admin (ou o próprio paciente dono da linha).
 */
import { NextRequest, NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';

import { comunicadosAssinatura, pacientes, users } from '@/db/schema';
import { obterUsuarioAtual } from '@/lib/auth/permissions';
import { db } from '@/lib/db';
import { gerarPdfCartaDoacao } from '@/lib/comunicados/carta-doacao-pdf';
import { dataPorExtenso } from '@/lib/comunicados/puro';
import {
  cabecalhosDoLimite,
  consumir,
  identificarChamador,
} from '@/lib/seguranca/limite-de-requisicao';
import { registrarAuditoria } from '@/lib/utils/audit';

const LIMITE = 30;
const JANELA_EM_SEGUNDOS = 60;

export const dynamic = 'force-dynamic';

const NAO_ENCONTRADO = () =>
  NextResponse.json({ erro: 'Documento não encontrado' }, { status: 404 });

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const limite = consumir(
    identificarChamador(request.headers, 'comunicado-documento'),
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

  const [user] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(and(eq(users.clerkId, perm.clerkId), isNull(users.deletedAt)))
    .limit(1);
  if (!user) return NAO_ENCONTRADO();

  const [c] = await db
    .select({
      id: comunicadosAssinatura.id,
      pacienteId: comunicadosAssinatura.pacienteId,
      titulo: comunicadosAssinatura.titulo,
      status: comunicadosAssinatura.status,
      enviadoEm: comunicadosAssinatura.enviadoEm,
      nomeDestino: comunicadosAssinatura.nomeDestino,
      emailDestino: comunicadosAssinatura.emailDestino,
    })
    .from(comunicadosAssinatura)
    .where(eq(comunicadosAssinatura.id, id))
    .limit(1);
  if (!c) return NAO_ENCONTRADO();

  // Escopo de objeto: admin ou o paciente dono do comunicado.
  if (user.role !== 'admin') {
    const [dono] = await db
      .select({ id: pacientes.id })
      .from(pacientes)
      .where(
        and(
          eq(pacientes.id, c.pacienteId),
          eq(pacientes.userId, user.id),
          isNull(pacientes.deletedAt),
        ),
      )
      .limit(1);
    if (!dono) return NAO_ENCONTRADO();
  }

  const [pac] = await db
    .select({ cpf: pacientes.cpf })
    .from(pacientes)
    .where(eq(pacientes.id, c.pacienteId))
    .limit(1);

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await gerarPdfCartaDoacao({
      nomePaciente: c.nomeDestino,
      emailPaciente: c.emailDestino,
      cpfPaciente: pac?.cpf?.trim() || 'Não informado',
      dataPorExtenso: dataPorExtenso(c.enviadoEm),
    });
  } catch (erro) {
    console.error(
      '[comunicados] erro ao gerar documento original:',
      erro instanceof Error ? erro.message : 'desconhecido',
    );
    return NextResponse.json({ erro: 'Erro ao gerar o documento' }, { status: 500 });
  }

  const download = request.nextUrl.searchParams.get('download') === '1';

  await registrarAuditoria({
    userId: user.id,
    acao: 'visualizar',
    entidade: 'comunicados_assinatura',
    entidadeId: c.id,
    dadosDepois: { tipo: 'documento_preenchido', download },
  }).catch(() => {});

  const nomeSanitizado = (c.nomeDestino || 'paciente')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_');
  const nomeArquivo = `Atualizacao-Programa-Doacao-${nomeSanitizado}.pdf`;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'content-type': 'application/pdf',
      'content-length': String(pdfBuffer.length),
      'content-disposition': `${download ? 'attachment' : 'inline'}; filename="${nomeArquivo}"`,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}
