'use server';

import { db } from '@/lib/db';
import { triagens } from '@/db/schema';
import { eq, desc, inArray } from 'drizzle-orm';
import { z } from 'zod';

/**
 * Server Actions de triagem.
 * Formulário público (sem login) + formulário do médico (logado).
 * Visualização: admin vê todas, médico vê apenas as que ele criou.
 */

// ── Schemas ───────────────────────────────────────────────────

/**
 * Espelha os campos `obrigatorio: true` de STEPS em components/shared/triagem-form.tsx.
 * O front já valida isso, mas a action é acessível diretamente — sem isso o backend
 * aceitava qualquer objeto não-vazio em `dados`.
 */
const campoObrigatorio = (mensagem: string) => z.string().trim().min(1, mensagem);

const dadosTriagemSchema = z
  .object({
    nome_paciente: campoObrigatorio('Nome do paciente é obrigatório'),
    cpf: campoObrigatorio('CPF é obrigatório'),
    data_nascimento: campoObrigatorio('Data de nascimento é obrigatória'),
    peso: campoObrigatorio('Peso é obrigatório'),
    altura: campoObrigatorio('Altura é obrigatória'),
    email: z.string().trim().email('E-mail inválido'),
    telefone: campoObrigatorio('Telefone é obrigatório'),
    cep: campoObrigatorio('CEP é obrigatório'),
    estado: campoObrigatorio('Estado é obrigatório'),
    endereco: campoObrigatorio('Endereço é obrigatório'),
    como_chegou: campoObrigatorio('Campo "Como chegou até nós" é obrigatório'),
    diagnostico_principal: campoObrigatorio('Diagnóstico principal é obrigatório'),
    nivel_tratamento: campoObrigatorio('Nível de tratamento é obrigatório'),
    historico_tratamentos: campoObrigatorio('Histórico de tratamentos é obrigatório'),
    medicamentos_atuais: campoObrigatorio('Medicamentos atuais é obrigatório'),
    total_residencia: campoObrigatorio('Total de pessoas na residência é obrigatório'),
    num_criancas: campoObrigatorio('Número de crianças é obrigatório'),
    num_idosos: campoObrigatorio('Número de idosos é obrigatório'),
    num_deficiencia: campoObrigatorio('Número de pessoas com deficiência é obrigatório'),
    responsavel_financeiro: campoObrigatorio('Campo "Responsável financeiro" é obrigatório'),
    renda_total: campoObrigatorio('Renda total mensal é obrigatória'),
    fontes_renda: campoObrigatorio('Fontes de renda são obrigatórias'),
    situacao_trabalho: campoObrigatorio('Situação de trabalho é obrigatória'),
    profissao: campoObrigatorio('Profissão é obrigatória'),
    programas_sociais: campoObrigatorio('Campo "Programas sociais" é obrigatório'),
    convenio_medico: campoObrigatorio('Campo "Convênio médico" é obrigatório'),
    condicao_moradia: campoObrigatorio('Condição de moradia é obrigatória'),
    despesas_medicas: campoObrigatorio('Despesas médicas mensais são obrigatórias'),
  })
  // demais campos são opcionais/condicionais (ex: convenio_qual, relatorio_medico_arquivo)
  .passthrough();

const criarTriagemSchema = z.object({
  dados: dadosTriagemSchema,
  emailContato: z.string().email('E-mail inválido').optional(),
  telefoneContato: z.string().optional(),
  nomeContato: z.string().optional(),
  medicoClerkId: z.string().optional(),
});

// ── Validação do anexo (relatório médico) ──────────────────────

/** Mesmos formatos aceitos pelo input do formulário (accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"). */
const MIME_TYPES_PERMITIDOS = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const TAMANHO_MAXIMO_ARQUIVO_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Valida o anexo em Base64 (data URL) recebido do formulário.
 * O `accept` do input é só client-side e não protege o backend.
 */
function validarArquivoBase64(dataUrl: string): { valido: boolean; erro?: string } {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    return { valido: false, erro: 'Arquivo do relatório médico em formato inválido.' };
  }

  const [, mimeType, conteudo] = match;
  if (!MIME_TYPES_PERMITIDOS.has(mimeType)) {
    return {
      valido: false,
      erro: 'Formato de arquivo não permitido. Envie PDF, JPG, PNG, DOC ou DOCX.',
    };
  }

  const padding = (conteudo.match(/=+$/) || [''])[0].length;
  const tamanhoBytes = Math.floor((conteudo.length * 3) / 4) - padding;
  if (tamanhoBytes > TAMANHO_MAXIMO_ARQUIVO_BYTES) {
    return {
      valido: false,
      erro: 'Arquivo do relatório médico excede o tamanho máximo permitido (10MB).',
    };
  }

  return { valido: true };
}

// ── Types ─────────────────────────────────────────────────────

interface ActionResult<T = unknown> {
  sucesso: boolean;
  dados?: T;
  erro?: string;
}

/**
 * Formato bruto recebido do client (dados montado dinamicamente pelo form,
 * então não dá pra tipar como o shape validado de `dadosTriagemSchema`).
 * A validação estrita dos campos obrigatórios acontece em runtime, via Zod.
 */
interface CriarTriagemInput {
  dados: Record<string, unknown>;
  emailContato?: string;
  telefoneContato?: string;
  nomeContato?: string;
  medicoClerkId?: string;
}

// ── Actions ───────────────────────────────────────────────────

/**
 * Cria uma nova triagem (chamada pelo formulário público ou pelo médico).
 * Se `medicoClerkId` estiver presente, vincula a triagem ao médico.
 * Após salvar no banco, insere automaticamente na planilha Google Sheets.
 */
export async function criarTriagem(
  dados: CriarTriagemInput,
): Promise<ActionResult<{ triagemId: string }>> {
  try {
    const parsed = criarTriagemSchema.safeParse(dados);
    if (!parsed.success) {
      return { sucesso: false, erro: parsed.error.errors[0].message };
    }

    const arquivoBase64 = parsed.data.dados['relatorio_medico_arquivo'];
    if (typeof arquivoBase64 === 'string' && arquivoBase64.length > 0) {
      const validacaoArquivo = validarArquivoBase64(arquivoBase64);
      if (!validacaoArquivo.valido) {
        return { sucesso: false, erro: validacaoArquivo.erro };
      }
    }

    const [nova] = await db
      .insert(triagens)
      .values({
        dados: parsed.data.dados,
        emailContato: parsed.data.emailContato,
        telefoneContato: parsed.data.telefoneContato,
        nomeContato: parsed.data.nomeContato,
        statusVisualizacao: 'pendente',
        medicoClerkId: parsed.data.medicoClerkId ?? null,
      })
      .returning({ id: triagens.id });

    // Insere na planilha em paralelo — falha não impacta o usuário
    const { inserirLinhaTriagem } = await import('@/lib/integrations/google-sheets');
    const resultadoSheets = await Promise.allSettled([
      inserirLinhaTriagem({
        nomeContato: parsed.data.nomeContato ?? null,
        emailContato: parsed.data.emailContato ?? null,
        telefoneContato: parsed.data.telefoneContato ?? null,
        createdAt: new Date(),
        statusVisualizacao: 'pendente',
        dados: parsed.data.dados as Record<string, unknown>,
      }),
    ]);

    if (resultadoSheets[0].status === 'rejected') {
      console.error('[Action] Falha ao inserir no Google Sheets (triagem salva no banco):', resultadoSheets[0].reason);
    }

    return { sucesso: true, dados: { triagemId: nova.id } };
  } catch (error) {
    console.error('[Action] Erro ao criar triagem:', error);
    return { sucesso: false, erro: 'Erro ao enviar triagem' };
  }
}

/**
 * Lista todas as triagens (admin only).
 */
export async function listarTriagens(): Promise<
  ActionResult<typeof triagens.$inferSelect[]>
> {
  try {
    const { verificarAdmin } = await import('@/lib/auth');
    const auth = await verificarAdmin();
    if (!auth.autorizado) {
      return { sucesso: false, erro: auth.erro };
    }

    const resultado = await db
      .select()
      .from(triagens)
      .orderBy(desc(triagens.createdAt));

    return { sucesso: true, dados: resultado };
  } catch (error) {
    console.error('[Action] Erro ao listar triagens:', error);
    return { sucesso: false, erro: 'Erro ao listar triagens' };
  }
}

/**
 * Lista triagens criadas por um médico específico.
 * Acessível por médico (vê só as próprias) e admin (vê de qualquer médico).
 */
export async function listarTriagensMedico(medicoClerkId?: string): Promise<
  ActionResult<typeof triagens.$inferSelect[]>
> {
  try {
    const { verificarMedicoOuAdmin } = await import('@/lib/auth');
    const auth = await verificarMedicoOuAdmin();
    if (!auth.autorizado) {
      return { sucesso: false, erro: auth.erro };
    }

    // Médico vê apenas as próprias, admin pode ver de qualquer médico
    const clerkIdFiltro =
      auth.role === 'admin' && medicoClerkId ? medicoClerkId : auth.clerkId;

    if (!clerkIdFiltro) {
      return { sucesso: false, erro: 'Não foi possível identificar o médico' };
    }

    const resultado = await db
      .select()
      .from(triagens)
      .where(eq(triagens.medicoClerkId, clerkIdFiltro))
      .orderBy(desc(triagens.createdAt));

    return { sucesso: true, dados: resultado };
  } catch (error) {
    console.error('[Action] Erro ao listar triagens do médico:', error);
    return { sucesso: false, erro: 'Erro ao listar triagens' };
  }
}

/**
 * Marca triagem como visualizada/respondida.
 */
export async function atualizarStatusTriagem(
  triagemId: string,
  status: 'visualizada' | 'respondida',
): Promise<ActionResult> {
  try {
    const { verificarMedicoOuAdmin } = await import('@/lib/auth');
    const auth = await verificarMedicoOuAdmin();
    if (!auth.autorizado) {
      return { sucesso: false, erro: auth.erro };
    }

    if (!triagemId) {
      return { sucesso: false, erro: 'ID da triagem é obrigatório' };
    }

    // Médico só pode atualizar as próprias triagens (mesma regra de listarTriagensMedico).
    if (auth.role === 'medico') {
      const [triagem] = await db
        .select({ medicoClerkId: triagens.medicoClerkId })
        .from(triagens)
        .where(eq(triagens.id, triagemId))
        .limit(1);

      if (!triagem || triagem.medicoClerkId !== auth.clerkId) {
        return { sucesso: false, erro: 'Triagem não encontrada ou sem permissão' };
      }
    }

    await db
      .update(triagens)
      .set({ statusVisualizacao: status })
      .where(eq(triagens.id, triagemId));

    return { sucesso: true };
  } catch (error) {
    console.error('[Action] Erro ao atualizar triagem:', error);
    return { sucesso: false, erro: 'Erro ao atualizar triagem' };
  }
}

/**
 * Exclui uma triagem permanentemente (admin only).
 * Operação irreversível — triagens não possuem dado clínico vinculado.
 */
export async function excluirTriagem(triagemId: string): Promise<ActionResult> {
  try {
    const { verificarAdmin } = await import('@/lib/auth');
    const auth = await verificarAdmin();
    if (!auth.autorizado) {
      return { sucesso: false, erro: auth.erro };
    }

    if (!triagemId || typeof triagemId !== 'string') {
      return { sucesso: false, erro: 'ID da triagem inválido' };
    }

    await db.delete(triagens).where(eq(triagens.id, triagemId));

    return { sucesso: true };
  } catch (error) {
    console.error('[Action] Erro ao excluir triagem:', error);
    return { sucesso: false, erro: 'Erro ao excluir triagem' };
  }
}

/**
 * Exclui múltiplas triagens em lote (admin only).
 * Máximo de 100 por chamada para segurança.
 */
export async function excluirTriagensEmLote(
  ids: string[],
): Promise<ActionResult<{ excluidos: number }>> {
  try {
    const { verificarAdmin } = await import('@/lib/auth');
    const auth = await verificarAdmin();
    if (!auth.autorizado) {
      return { sucesso: false, erro: auth.erro };
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      return { sucesso: false, erro: 'Nenhum ID fornecido' };
    }

    const idsLimitados = ids.slice(0, 100);
    await db.delete(triagens).where(inArray(triagens.id, idsLimitados));

    return { sucesso: true, dados: { excluidos: idsLimitados.length } };
  } catch (error) {
    console.error('[Action] Erro ao excluir triagens em lote:', error);
    return { sucesso: false, erro: 'Erro ao excluir triagens' };
  }
}
