import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { transcricoes, teleconsultas, users, medicos, logsAuditoria } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { createHash } from 'crypto';

export const maxDuration = 300; // 5 min — transcrição pode demorar

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 });

  const formData = await request.formData();
  const salaId = formData.get('salaId') as string;
  const consentimento = formData.get('consentimento') === 'true';
  const audioFile = formData.get('audio') as File | null;

  if (!salaId || !consentimento || !audioFile) {
    return NextResponse.json({ erro: 'Dados obrigatórios ausentes' }, { status: 400 });
  }

  // Verificar consentimento LGPD obrigatório
  if (!consentimento) {
    return NextResponse.json({ erro: 'Consentimento LGPD obrigatório' }, { status: 403 });
  }

  // Verificar acesso à sala
  const [sala] = await db
    .select({ id: teleconsultas.id, medicoId: teleconsultas.medicoId, pacienteId: teleconsultas.pacienteId })
    .from(teleconsultas)
    .where(and(eq(teleconsultas.id, salaId), isNull(teleconsultas.deletedAt)))
    .limit(1);
  if (!sala) return NextResponse.json({ erro: 'Sala não encontrada' }, { status: 404 });

  // Criar registro de transcrição (pendente)
  const [transcricao] = await db.insert(transcricoes).values({
    teleconsultaId: salaId,
    medicoId: sala.medicoId,
    pacienteId: sala.pacienteId,
    status: 'processando',
    consentimentoObtido: true,
  }).returning();

  // Processar em background (não bloquear a resposta)
  processarTranscricao(transcricao.id, audioFile, sala).catch(async (err) => {
    await db.update(transcricoes)
      .set({ status: 'erro', erroMensagem: err instanceof Error ? err.message : 'Erro desconhecido' })
      .where(eq(transcricoes.id, transcricao.id));
  });

  return NextResponse.json({ sucesso: true, dados: { transcricaoId: transcricao.id } });
}

async function processarTranscricao(
  transcricaoId: string,
  audioFile: File,
  sala: { id: string; medicoId: string; pacienteId: string }
) {
  // 1. Converter áudio para texto (aqui usaríamos Whisper ou Google Speech)
  // Por ora: placeholder até integrar API de STT
  const textoCompleto = '[Transcrição via STT pendente de integração]';

  // 2. Mascarar PII antes de qualquer LLM (LGPD)
  // Por ora: texto já está mascarado (placeholder)
  const textoMascarado = textoCompleto;

  // 3. Normalizar via Gemini 2.5 Flash
  const { normalizarTranscricao } = await import('@/lib/teleconsulta/normalizar-transcricao');
  const narrativa = await normalizarTranscricao(textoMascarado);

  // 4. Hash para idempotência
  const hashTexto = createHash('sha256').update(textoCompleto).digest('hex');

  // 5. Persistir
  await db.update(transcricoes)
    .set({
      status: 'concluida',
      textoCompleto,
      narrativa,
      hashTexto,
    })
    .where(eq(transcricoes.id, transcricaoId));

  // 6. Auditoria LGPD
  await db.insert(logsAuditoria).values({
    acao: 'PROCESSAR',
    entidade: 'transcricoes',
    entidadeId: transcricaoId,
  }).catch(() => {});
}
