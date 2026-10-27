/**
 * O REGISTRO MANUAL DA ASSINATURA DE UM COMUNICADO — só admin (ADR-0032).
 *
 * O paciente assinou a carta por OUTRA plataforma e mandou o arquivo (WhatsApp). O admin anexa o
 * documento assinado e confirma; a lib marca o comunicado como assinado, guarda o arquivo em store
 * PRIVADO e deixa o registro marcado como manual e auditado.
 *
 * É uma API route (e não Server Action) pelo mesmo motivo de `/api/upload-documento`: FormData com
 * arquivo binário em Server Action conflita com o middleware do Clerk.
 *
 * As três perguntas do `.claude/rules/seguranca-lgpd.md`: quem pode ler/gravar (só admin; quem não
 * é recebe 404, nunca 403, para a rota não virar oráculo de ids), quanto tempo fica (retenção ainda
 * é decisão jurídica — não há prazo, como no PDF assinado do DocuSign) e o acesso é auditado
 * (registro aqui; leitura em `/api/comunicados/[id]/arquivo`).
 */
import { NextRequest, NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

import { users } from '@/db/schema';
import { verificarAdmin } from '@/lib/auth/permissions';
import { registrarAssinaturaManual } from '@/lib/comunicados/assinatura';
import {
  LIMITE_DO_ARQUIVO_MANUAL,
  identificarArquivoDaAssinatura,
  validarDataDaAssinatura,
} from '@/lib/comunicados/registro-manual';
import { db } from '@/lib/db';
import {
  cabecalhosDoLimite,
  consumir,
  identificarChamador,
} from '@/lib/seguranca/limite-de-requisicao';

/** 10 registros por minuto por chamador: é um gesto manual, e cada um carrega até 10 MB. */
const LIMITE = 10;
const JANELA_EM_SEGUNDOS = 60;

export const dynamic = 'force-dynamic';

const idSchema = z.string().min(1).max(64);
const observacaoSchema = z
  .string()
  .trim()
  .max(500, 'A observação pode ter no máximo 500 caracteres.');

const erro = (mensagem: string, status: number) =>
  NextResponse.json({ sucesso: false, erro: mensagem }, { status });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idBruto } = await params;

  // O limite vem ANTES da autenticação: cada tentativa custaria uma consulta ao banco — NOSSA.
  const limite = consumir(
    identificarChamador(request.headers, 'comunicado-manual'),
    LIMITE,
    JANELA_EM_SEGUNDOS,
  );
  if (!limite.permitido) {
    return NextResponse.json(
      { sucesso: false, erro: 'Muitas requisições. Tente novamente em instantes.' },
      { status: 429, headers: cabecalhosDoLimite(limite, LIMITE) },
    );
  }

  const admin = await verificarAdmin();
  if (!admin.autorizado || !admin.clerkId) return erro('Comunicado não encontrado.', 404);
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.clerkId, admin.clerkId), isNull(users.deletedAt)))
    .limit(1);
  if (!user) return erro('Comunicado não encontrado.', 404);

  const id = idSchema.safeParse(idBruto);
  if (!id.success) return erro('Comunicado inválido.', 400);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return erro('Não foi possível ler o envio. Tente de novo.', 400);
  }

  const arquivo = formData.get('arquivo');
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return erro('Anexe o documento assinado.', 400);
  }
  // O tamanho vem ANTES de o arquivo ir para a memória.
  if (arquivo.size > LIMITE_DO_ARQUIVO_MANUAL) {
    return erro(
      `O arquivo tem ${(arquivo.size / (1024 * 1024)).toFixed(1)} MB e o limite é ${LIMITE_DO_ARQUIVO_MANUAL / (1024 * 1024)} MB.`,
      400,
    );
  }

  const data = validarDataDaAssinatura(String(formData.get('dataAssinatura') ?? ''));
  if (!data.ok) return erro(data.erro, 400);

  const observacao = observacaoSchema.safeParse(String(formData.get('observacao') ?? ''));
  if (!observacao.success) {
    return erro(observacao.error.issues[0]?.message ?? 'Observação inválida.', 400);
  }

  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const tipo = identificarArquivoDaAssinatura(bytes, arquivo.type);
  if (!tipo) return erro('Envie um PDF, JPG ou PNG válido.', 400);

  const r = await registrarAssinaturaManual({
    comunicadoId: id.data,
    adminUserId: user.id,
    arquivo: bytes,
    tipoDoArquivo: tipo,
    nomeDoArquivo: arquivo.name,
    dataDaAssinatura: data.data,
    observacao: observacao.data || null,
  });
  if (!r.sucesso) return erro(r.erro, r.erro === 'Comunicado não encontrado.' ? 404 : 409);

  return NextResponse.json({ sucesso: true });
}
