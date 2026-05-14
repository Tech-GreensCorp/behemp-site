'use server';

import { db } from '@/lib/db';
import { documentos, users, pacientes } from '@/db/schema';
import { eq, and, isNull, desc, sql } from 'drizzle-orm';
import { z } from 'zod';
import { obterUsuarioAtual } from '@/lib/auth';
import { put } from '@vercel/blob';

/**
 * Server Actions de documentos — uso pelo paciente autenticado.
 *
 * O pacienteId é inferido automaticamente a partir do clerkId da sessão.
 * Se o registro de paciente não existir, ele é criado automaticamente.
 */

const TIPOS_VALIDOS = [
  'rg',
  'receita_medica',
  'comprovante_residencia',
  'autorizacao_anvisa',
  'oficio_anvisa',
  'documento_pessoal',
] as const;

const uploadSchema = z.object({
  tipo: z.enum(TIPOS_VALIDOS),
  dataEmissao: z.string().min(1, 'Data de emissão é obrigatória'),
});

/**
 * Busca o pacienteId a partir do clerkId.
 * Usa SQL raw para evitar problemas com JOIN e camelCase do Drizzle.
 */
async function obterOuCriarPacienteId(clerkId: string): Promise<string | null> {
  // 1) Tentar buscar pelo clerkId via SQL raw para garantir a query correta
  const resultado = await db.execute(sql`
    SELECT p.id
    FROM users u
    INNER JOIN pacientes p ON p.user_id = u.id
    WHERE u.clerk_id = ${clerkId}
      AND p.deleted_at IS NULL
    LIMIT 1
  `);

  if (resultado.rows.length > 0) {
    return (resultado.rows[0] as { id: string }).id;
  }

  // 2) Paciente não encontrado: buscar o userId interno para criar o registro
  const userResult = await db.execute(sql`
    SELECT id, role FROM users WHERE clerk_id = ${clerkId} LIMIT 1
  `);

  if (userResult.rows.length === 0) {
    console.error('[documentos-self] Usuário não encontrado para clerkId:', clerkId);
    return null;
  }

  const user = userResult.rows[0] as { id: string; role: string };

  // Só cria registro de paciente se o role for 'paciente'
  if (user.role !== 'paciente') {
    console.warn('[documentos-self] Usuário não é paciente:', user.role);
    return null;
  }

  // 3) Criar registro de paciente automaticamente
  console.info('[documentos-self] Criando registro de paciente para userId:', user.id);
  const [novoPaciente] = await db
    .insert(pacientes)
    .values({
      userId: user.id,
      status: 'aguardando_consulta',
      jornadaFase: 'acolhimento',
    })
    .returning({ id: pacientes.id });

  return novoPaciente?.id ?? null;
}

/**
 * Upload de documento pelo próprio paciente.
 */
export async function uploadDocumentoPaciente(formData: FormData) {
  try {
    const auth = await obterUsuarioAtual();
    if (!auth.autorizado || !auth.clerkId) {
      return { sucesso: false, erro: 'Não autenticado' };
    }

    const pacienteId = await obterOuCriarPacienteId(auth.clerkId);
    if (!pacienteId) {
      return {
        sucesso: false,
        erro: 'Sua conta ainda não foi vinculada como paciente. Entre em contato com a clínica.',
      };
    }

    // Validar arquivo
    const file = formData.get('arquivo') as File | null;
    if (!file || file.size === 0) {
      return { sucesso: false, erro: 'Selecione um arquivo.' };
    }
    if (file.size > 100 * 1024 * 1024) {
      return { sucesso: false, erro: 'Arquivo excede 100MB.' };
    }
    const tiposPermitidos = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!tiposPermitidos.includes(file.type)) {
      return { sucesso: false, erro: 'Use PDF, JPG ou PNG.' };
    }

    // Validar campos
    const parsed = uploadSchema.safeParse({
      tipo: formData.get('tipo'),
      dataEmissao: formData.get('dataEmissao'),
    });
    if (!parsed.success) {
      return { sucesso: false, erro: parsed.error.errors[0].message };
    }

    // Upload para Vercel Blob
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin';
    const nomeSeguro = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const blobPath = `documentos/${pacienteId}/${nomeSeguro}`;

    const blob = await put(blobPath, file, {
      access: 'public',
      token: process.env.BLOB_BEHEMP_READ_WRITE_TOKEN,
    });

    // Calcular validade
    const emissao = new Date(parsed.data.dataEmissao);
    const validade = new Date(emissao);
    if (parsed.data.tipo === 'autorizacao_anvisa' || parsed.data.tipo === 'oficio_anvisa') {
      validade.setMonth(validade.getMonth() + 24);
    } else if (parsed.data.tipo === 'receita_medica') {
      validade.setMonth(validade.getMonth() + 6);
    } else {
      validade.setFullYear(validade.getFullYear() + 10);
    }

    const [doc] = await db
      .insert(documentos)
      .values({
        pacienteId,
        tipo: parsed.data.tipo as typeof documentos.$inferInsert.tipo,
        urlBlob: blob.url,
        nomeArquivo: file.name,
        dataEmissao: parsed.data.dataEmissao,
        dataValidade: validade.toISOString().split('T')[0],
        observacoes: null,
      })
      .returning();

    return { sucesso: true, dados: doc };
  } catch (error) {
    console.error('[Action] Erro ao fazer upload (paciente):', error);
    return { sucesso: false, erro: 'Erro ao enviar documento. Tente novamente.' };
  }
}

/**
 * Lista os documentos do paciente autenticado.
 */
export async function listarDocumentosPaciente() {
  try {
    const auth = await obterUsuarioAtual();
    if (!auth.autorizado || !auth.clerkId) {
      return { sucesso: false, erro: 'Não autenticado' };
    }

    // Busca via SQL raw com aliases camelCase para o frontend
    const resultado = await db.execute(sql`
      SELECT
        d.id,
        d.tipo,
        d.url_blob         AS "urlBlob",
        d.nome_arquivo     AS "nomeArquivo",
        d.data_emissao     AS "dataEmissao",
        d.data_validade    AS "dataValidade",
        d.observacoes,
        d.created_at       AS "createdAt"
      FROM documentos d
      INNER JOIN pacientes p ON p.id = d.paciente_id
      INNER JOIN users u ON u.id = p.user_id
      WHERE u.clerk_id = ${auth.clerkId}
        AND d.deleted_at IS NULL
        AND p.deleted_at IS NULL
      ORDER BY d.created_at DESC
    `);

    return { sucesso: true, dados: resultado.rows };
  } catch (error) {
    console.error('[Action] Erro ao listar documentos (paciente):', error);
    return { sucesso: false, erro: 'Erro ao listar documentos' };
  }
}

/**
 * Retorna os dados de perfil do paciente autenticado (nome, email, telefone).
 */
export async function obterPerfilPaciente(): Promise<{
  sucesso: boolean;
  dados?: { nome: string | null; email: string | null; telefone: string | null };
  erro?: string;
}> {
  try {
    const auth = await obterUsuarioAtual();
    if (!auth.autorizado || !auth.clerkId) {
      return { sucesso: false, erro: 'Não autenticado' };
    }

    const resultado = await db.execute(sql`
      SELECT u.nome, u.email, u.telefone
      FROM users u
      WHERE u.clerk_id = ${auth.clerkId}
        AND u.deleted_at IS NULL
      LIMIT 1
    `);

    if (resultado.rows.length === 0) {
      return { sucesso: false, erro: 'Usuário não encontrado' };
    }

    const row = resultado.rows[0] as { nome: string | null; email: string | null; telefone: string | null };
    return { sucesso: true, dados: row };
  } catch (error) {
    console.error('[Action] Erro ao obter perfil do paciente:', error);
    return { sucesso: false, erro: 'Erro ao carregar perfil' };
  }
}
