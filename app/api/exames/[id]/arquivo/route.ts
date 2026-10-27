/**
 * A ENTREGA AUTENTICADA DE UM EXAME DE PACIENTE.
 *
 * Irmã de `GET /api/documentos/{id}/arquivo`. Até aqui a tela abria `exames.urlArquivo` direto
 * — a URL de um blob PÚBLICO, que qualquer pessoa com o link lê sem autenticação, e que a
 * lista entregava ao navegador. Esta rota é a porta: limita, confere que quem chama é o médico
 * DO paciente (ou admin), audita e só então entrega os bytes.
 *
 * As três perguntas do `.claude/rules/seguranca-lgpd.md`: quem pode ler (acima), quanto tempo
 * fica (soft delete — o exame apagado não abre), e o acesso é auditado (`visualizar`).
 */

import { NextRequest, NextResponse } from 'next/server';

import { garantirLeitorDoExame } from '@/lib/auth/escopo-exame';
import { entregarBlob } from '@/lib/documentos/entregar-blob';
import {
  cabecalhosDoLimite,
  consumir,
  identificarChamador,
} from '@/lib/seguranca/limite-de-requisicao';
import { registrarAuditoria } from '@/lib/utils/audit';

const LIMITE = 30;
const JANELA_EM_SEGUNDOS = 60;

/** Lê dado de saúde: nunca pode ser servida de cache compartilhado. */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // O limite vem ANTES do escopo: conferir o vínculo custa uma consulta ao banco — NOSSA.
  const limite = consumir(
    identificarChamador(request.headers, 'exame'),
    LIMITE,
    JANELA_EM_SEGUNDOS,
  );
  if (!limite.permitido) {
    return NextResponse.json(
      { erro: 'Muitas requisições. Tente novamente em instantes.' },
      { status: 429, headers: cabecalhosDoLimite(limite, LIMITE) },
    );
  }

  const leitura = await garantirLeitorDoExame(id);
  if (!leitura.ok) {
    return NextResponse.json({ erro: leitura.erro }, { status: leitura.status });
  }

  // Nunca lança: auditoria indisponível não pode impedir o médico de ver o exame do paciente.
  await registrarAuditoria({
    userId: leitura.userId,
    acao: 'visualizar',
    entidade: 'exames',
    entidadeId: id,
  }).catch(() => {});

  return entregarBlob(leitura.exame.urlArquivo, leitura.exame.nomeArquivo, id, 'exames');
}
