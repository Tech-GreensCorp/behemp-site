/**
 * Para onde o DocuSign devolve o paciente depois da tela de assinatura.
 *
 * 🔴 Esta rota NÃO decide nada pelo que veio na URL. O DocuSign acrescenta `?event=…`, mas isso é
 * entrada de quem chama — qualquer um pode digitar `event=signing_complete`. O paciente voltar
 * aqui é só um GATILHO: pergunta-se ao DocuSign o status real (`sincronizarComunicado`) e só
 * então o paciente é levado de volta à tela de Documentos, que mostra o que o banco diz.
 */
import { NextRequest, NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';

import { comunicadosAssinatura, pacientes, users } from '@/db/schema';
import { sincronizarComunicado } from '@/lib/comunicados/assinatura';
import { obterUsuarioAtual } from '@/lib/auth/permissions';
import { db } from '@/lib/db';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // URL de destino montada com a origem OFICIAL, nunca com o Host da requisição (proxy reverso).
  const destino = new URL('/paciente/documentos', env.NEXT_PUBLIC_APP_URL);

  const perm = await obterUsuarioAtual();
  if (!perm.autorizado || !perm.clerkId) return NextResponse.redirect(destino);

  const [dono] = await db
    .select({ id: comunicadosAssinatura.id })
    .from(comunicadosAssinatura)
    .innerJoin(pacientes, eq(pacientes.id, comunicadosAssinatura.pacienteId))
    .innerJoin(users, eq(users.id, pacientes.userId))
    .where(
      and(
        eq(comunicadosAssinatura.id, id),
        eq(users.clerkId, perm.clerkId),
        isNull(pacientes.deletedAt),
      ),
    )
    .limit(1);

  if (dono) {
    await sincronizarComunicado(dono.id).catch((erro) =>
      console.error('[comunicados] retorno:', erro instanceof Error ? erro.message : 'erro'),
    );
    destino.searchParams.set('comunicado', dono.id);
  }
  return NextResponse.redirect(destino);
}
