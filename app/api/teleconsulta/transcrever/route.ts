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
  const googleApiKey = process.env.GOOGLE_API_KEY;

  // ── MODO STUB (sem GOOGLE_API_KEY) ────────────────────────────
  if (!googleApiKey) {
    console.log('[Transcrição STUB] GOOGLE_API_KEY não configurada — salvando stub');

    await db.update(transcricoes)
      .set({
        status: 'concluida',
        textoCompleto: '[STUB] Transcrição pendente — GOOGLE_API_KEY não configurada.',
        narrativa: [
          'Queixa principal: [aguardando integração Google Speech-to-Text]',
          'HDA (início, duração, evolução, fatores de melhora/piora): não relatado',
          'Sintomas afirmados: não relatado',
          'Negativos pertinentes: não relatado',
          'Antecedentes / comorbidades / hábitos: não relatado',
          'Medicações em uso: não relatado',
        ].join('\n'),
        hashTexto: 'stub-sem-api-key',
        modeloUsado: 'stub',
        duracaoSegundos: Math.round(audioFile.size / 16000), // estimativa
      })
      .where(eq(transcricoes.id, transcricaoId));

    await db.insert(logsAuditoria).values({
      acao: 'TRANSCRICAO_STUB',
      entidade: 'transcricoes',
      entidadeId: transcricaoId,
    }).catch(() => {});

    return;
  }

  // ── MODO PRODUÇÃO (com GOOGLE_API_KEY) ───────────────────────
  // ETAPA A: Converter áudio para texto via Google Speech-to-Text v2
  const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
  const audioBase64 = audioBuffer.toString('base64');

  // Detectar codec (webm/opus padrão da Web API)
  const mimeType = audioFile.type || 'audio/webm;codecs=opus';

  const sttResponse = await fetch(
    `https://speech.googleapis.com/v1/speech:recognize?key=${googleApiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: {
          encoding: 'WEBM_OPUS',
          sampleRateHertz: 48000,
          audioChannelCount: 2,          // dual-channel: médico (L) + paciente (R)
          enableSeparateRecognitionPerChannel: true, // separação por canal
          languageCode: 'pt-BR',
          model: 'medical_conversation',  // modelo otimizado para consultas médicas
          useEnhanced: true,
          enableAutomaticPunctuation: true,
          diarizationConfig: {           // identificação de falantes
            enableSpeakerDiarization: true,
            minSpeakerCount: 2,
            maxSpeakerCount: 2,
          },
        },
        audio: { content: audioBase64 },
      }),
      signal: AbortSignal.timeout(120_000), // 2 min para áudios longos
    }
  );

  if (!sttResponse.ok) {
    const erro = await sttResponse.text();
    throw new Error(`Google STT error: ${sttResponse.status} — ${erro}`);
  }

  const sttData = await sttResponse.json() as {
    results?: Array<{
      alternatives?: Array<{ transcript: string }>;
      channelTag?: number;
    }>;
  };

  // Montar texto completo com separação por canal (médico/paciente)
  const textoCompleto = (sttData.results ?? [])
    .map((result) => {
      const texto = result.alternatives?.[0]?.transcript ?? '';
      const canal = result.channelTag === 1 ? '[MÉDICO]' : '[PACIENTE]';
      return `${canal} ${texto}`;
    })
    .filter(Boolean)
    .join('\n');

  if (!textoCompleto.trim()) {
    throw new Error('Transcrição vazia — áudio sem fala detectada');
  }

  // ETAPA B: Mascarar PII antes do Gemini (LGPD)
  // Remover CPF, RG, telefones, emails, endereços
  const textoMascarado = textoCompleto
    .replace(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g, '[CPF]')
    .replace(/\d{1,2}\.\d{3}\.\d{3}-?\d{1}/g, '[RG]')
    .replace(/\(\d{2}\)\s?\d{4,5}-?\d{4}/g, '[TELEFONE]')
    .replace(/[\w.-]+@[\w.-]+\.\w+/g, '[EMAIL]');

  // ETAPA C: Normalizar via Gemini 2.5 Flash
  const { normalizarTranscricao } = await import('@/lib/teleconsulta/normalizar-transcricao');
  const narrativa = await normalizarTranscricao(textoMascarado);

  // ETAPA D: Hash para idempotência e persistência
  const hashTexto = createHash('sha256').update(textoCompleto).digest('hex');

  await db.update(transcricoes)
    .set({
      status: 'concluida',
      textoCompleto: textoMascarado, // Salvar versão mascarada (LGPD)
      narrativa,
      hashTexto,
      modeloUsado: 'gemini-2.5-flash',
      duracaoSegundos: Math.round(audioFile.size / 16000),
    })
    .where(eq(transcricoes.id, transcricaoId));

  await db.insert(logsAuditoria).values({
    acao: 'PROCESSAR',
    entidade: 'transcricoes',
    entidadeId: transcricaoId,
  }).catch(() => {});
}
