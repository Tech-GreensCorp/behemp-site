import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { transcricoes } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { createHash } from 'crypto';
import { garantirDonoDaSala } from '@/lib/auth/escopo-sala';
import { registrarAuditoria } from '@/lib/utils/audit';

export const maxDuration = 300; // 5 min — transcrição pode demorar

// 🔴 CORRIGIDO EM 20/08/2026 — Item 11 de docs/04-LISTA-DE-AFAZERES.md.
// Duas correções aqui:
//   1. o comentário dizia "Verificar acesso à sala" e só verificava EXISTÊNCIA. Qualquer
//      usuário autenticado enviava áudio para uma sala alheia, e a transcrição nascia com o
//      medicoId da sala — não do autor. Agora há escopo de objeto.
//   2. o consentimento LGPD vinha do formData, isto é, do CLIENTE, e era gravado como
//      `consentimentoObtido: true` sem nunca consultar o banco. Resposta ao entregável 6 da
//      Sprint 1: o campo existia e não governava nada. Agora vale o que está no banco.
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const salaId = formData.get('salaId') as string;
  const audioFile = formData.get('audio') as File | null;

  if (!salaId || !audioFile) {
    return NextResponse.json({ erro: 'Dados obrigatórios ausentes' }, { status: 400 });
  }

  // Autenticação E escopo: a sala tem de ser de quem está pedindo.
  const escopo = await garantirDonoDaSala({ salaId });
  if (!escopo.ok) {
    return NextResponse.json({ erro: escopo.erro }, { status: escopo.status });
  }
  const sala = {
    id: escopo.sala.salaId,
    medicoId: escopo.sala.medicoId,
    pacienteId: escopo.sala.pacienteId,
  };

  // O consentimento vale pelo REGISTRO, não pela afirmação de quem chama, e exige os DOIS
  // lados na versão ATUAL do texto (ADR-0007, `DO-23`). Enviar áudio de consulta ao Google e
  // ao Gemini sem os dois aceites é o que esta guarda impede.
  // ⚠️ Isto NÃO bloqueia a videochamada — ela tem base legal própria (LGPD art. 11, II, "f").
  // Bloqueia só a transcrição, que é o que depende de consentimento.
  if (!escopo.sala.consentimentoIaLiberado) {
    return NextResponse.json(
      {
        erro: 'Transcrição não autorizada: é necessário o consentimento do paciente e do médico, na versão atual do texto.',
      },
      { status: 403 },
    );
  }

  // Criar registro de transcrição (pendente)
  const [transcricao] = await db
    .insert(transcricoes)
    .values({
      teleconsultaId: sala.id,
      medicoId: sala.medicoId,
      pacienteId: sala.pacienteId,
      status: 'processando',
      consentimentoObtido: true,
    })
    .returning();

  await registrarAuditoria({
    userId: escopo.sala.userId,
    acao: 'criar',
    entidade: 'transcricoes',
    entidadeId: transcricao.id,
    dadosDepois: { teleconsultaId: sala.id, enviadoA: ['google-stt', 'gemini'] },
  });

  // Processar em background (não bloquear a resposta)
  processarTranscricao(transcricao.id, audioFile, sala, escopo.sala.userId).catch(async (err) => {
    await db
      .update(transcricoes)
      .set({
        status: 'erro',
        erroMensagem: err instanceof Error ? err.message : 'Erro desconhecido',
      })
      .where(eq(transcricoes.id, transcricao.id));
  });

  return NextResponse.json({ sucesso: true, dados: { transcricaoId: transcricao.id } });
}

async function processarTranscricao(
  transcricaoId: string,
  audioFile: File,
  sala: { id: string; medicoId: string; pacienteId: string },
  // Quem pediu a transcrição. O processamento é assíncrono, mas a auditoria tem de
  // apontar para uma pessoa — auditoria sem autor não responsabiliza ninguém.
  userIdSolicitante: string,
) {
  const googleApiKey = process.env.GOOGLE_API_KEY;

  // ── MODO STUB (sem GOOGLE_API_KEY) ────────────────────────────
  if (!googleApiKey) {
    console.log('[Transcrição STUB] GOOGLE_API_KEY não configurada — salvando stub');

    await db
      .update(transcricoes)
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

    await registrarAuditoria({
      userId: userIdSolicitante,
      acao: 'atualizar',
      entidade: 'transcricoes',
      entidadeId: transcricaoId,
      dadosDepois: { modo: 'stub' },
    });

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
          audioChannelCount: 2, // dual-channel: médico (L) + paciente (R)
          enableSeparateRecognitionPerChannel: true, // separação por canal
          languageCode: 'pt-BR',
          model: 'medical_conversation', // modelo otimizado para consultas médicas
          useEnhanced: true,
          enableAutomaticPunctuation: true,
          diarizationConfig: {
            // identificação de falantes
            enableSpeakerDiarization: true,
            minSpeakerCount: 2,
            maxSpeakerCount: 2,
          },
        },
        audio: { content: audioBase64 },
      }),
      signal: AbortSignal.timeout(120_000), // 2 min para áudios longos
    },
  );

  if (!sttResponse.ok) {
    const erro = await sttResponse.text();
    throw new Error(`Google STT error: ${sttResponse.status} — ${erro}`);
  }

  const sttData = (await sttResponse.json()) as {
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

  await db
    .update(transcricoes)
    .set({
      status: 'concluida',
      textoCompleto: textoMascarado, // Salvar versão mascarada (LGPD)
      narrativa,
      hashTexto,
      modeloUsado: 'gemini-2.5-flash',
      duracaoSegundos: Math.round(audioFile.size / 16000),
    })
    .where(eq(transcricoes.id, transcricaoId));

  await registrarAuditoria({
    userId: userIdSolicitante,
    acao: 'atualizar',
    entidade: 'transcricoes',
    entidadeId: transcricaoId,
    dadosDepois: { modeloUsado: 'gemini-2.5-flash', piiMascarada: true },
  });
}
