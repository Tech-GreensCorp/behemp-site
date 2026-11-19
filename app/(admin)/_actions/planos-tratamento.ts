'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { eq, desc, sql, and, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { planosTratamento, pacientes, users } from '@/db/schema';
import { verificarAdmin } from '@/lib/auth';
import { registrarAuditoria } from '@/lib/utils/audit';
import { calcularAdesao, paraReais } from '@/lib/planos-tratamento/calculo';
import { generatePlanoNumber } from '@/lib/planos-tratamento/plano-defaults';
import { cpfEhValido, somenteDigitosDoCpf } from '@/lib/validacao/cpf';
import { ehViolacaoDeUnico } from '@/lib/comunicados/puro';

/**
 * Server Actions do Plano de Tratamento (Adesão ao Tratamento — Programa de Acesso Collab).
 * Somente admin.
 *
 * Todo plano é Collab (decisão do dono, 19/11/2026): não há tipo. Os totais NÃO vêm do client —
 * a action recebe só as entradas, recalcula com `calcularAdesao` e grava o resultado.
 * Payload validado com Zod; criar/atualizar/deletar auditados; exclusão lógica.
 */

interface ActionResult<T = unknown> {
  sucesso: boolean;
  dados?: T;
  erro?: string;
}

const ROTA_LISTA = '/admin/planos-tratamento';

// ── Tipos ──────────────────────────────────────────────────────

export type PlanoTratamentoStatus = 'draft' | 'completed';

/** O que o formulário envia. Números vêm como string, do jeito que o `<input>` entrega. */
export interface PlanoTratamentoFormData {
  planoNumber: string;
  status: PlanoTratamentoStatus;
  pacienteId?: string;

  patientName: string;
  cpf: string;
  dataAdesao: string;
  periodoMeses: string;
  medicamento: string;

  qtdFrascos: string;
  valorFrasco: string;
  descontoPct: string;
  qtdConsultas: string;
  valorConsulta: string;
  qtdFretes: string;
  valorFrete: string;
  parcelas: string;
  formaPagamento: string;
}

export interface PlanoTratamentoListItem {
  id: string;
  planoNumber: string;
  dataAdesao: string;
  status: string;
  createdAt: Date;
  patientName: string;
  totalAdesao: string;
}

export interface PlanoTratamentoCompleto {
  id: string;
  planoNumber: string;
  status: string;
  pacienteId: string | null;
  createdAt: Date;
  updatedAt: Date;

  patientName: string;
  cpf: string;
  dataAdesao: string;
  periodoMeses: number;
  medicamento: string;

  qtdFrascos: number;
  valorFrasco: string;
  descontoPct: string;
  qtdConsultas: number;
  valorConsulta: string;
  qtdFretes: number;
  valorFrete: string;
  parcelas: number;
  formaPagamento: string;

  subtotalMedicamentos: string;
  valorSubsidio: string;
  medicamentosLiquido: string;
  totalConsultas: string;
  totalFretes: string;
  totalAdesao: string;
  valorParcela: string;
}

// ── Validação ──────────────────────────────────────────────────

/** Maior valor que cabe em `numeric(10, 2)`: 8 dígitos inteiros. */
const LIMITE_NUMERIC = 99_999_999.99;

const obrigatorio = (campo: string) => z.string().trim().min(1, `${campo} é obrigatório`);
const data = (campo: string) => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, `${campo} inválida`);

/** Número decimal vindo de `<input type="number">` (".5" e "1e3" incluídos), em reais. */
const decimal = (campo: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .refine((s) => s !== '' && Number.isFinite(Number(s)), `${campo} precisa ser um número`)
    .transform((s) => Math.round(Number(s) * 100) / 100)
    .refine((n) => n >= min, `${campo} não pode ser menor que ${min}`)
    .refine((n) => n <= max, `${campo} está acima do limite permitido`);

/** Inteiro vindo de `<input type="number">`. */
const inteiro = (campo: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .refine(
      (s) => s !== '' && Number.isInteger(Number(s)),
      `${campo} precisa ser um número inteiro`,
    )
    .transform((s) => Number(s))
    .refine((n) => n >= min && n <= max, `${campo} deve estar entre ${min} e ${max}`);

const formSchema = z
  .object({
    planoNumber: z.string().trim().max(60, 'Número muito longo'),
    status: z.enum(['draft', 'completed']),
    pacienteId: z.string().trim().max(64).optional(),

    // Limites de tamanho pensados no LAYOUT do documento A4, não só no banco.
    patientName: obrigatorio('Nome do paciente').pipe(
      z.string().max(120, 'Nome do paciente muito longo (máx. 120 caracteres)'),
    ),
    // Vai impresso num documento financeiro: precisa ser um CPF de verdade. Grava só dígitos.
    cpf: obrigatorio('CPF')
      .refine((s) => cpfEhValido(s), 'CPF inválido — confira os dígitos')
      .transform((s) => somenteDigitosDoCpf(s)),
    dataAdesao: data('Data da adesão'),
    periodoMeses: inteiro('Período (meses)', 1, 60),
    medicamento: obrigatorio('Medicamento').pipe(
      z.string().max(120, 'Medicamento muito longo (máx. 120 caracteres)'),
    ),

    qtdFrascos: inteiro('Quantidade de frascos', 1, 1000),
    valorFrasco: decimal('Valor do frasco', 0, LIMITE_NUMERIC),
    descontoPct: decimal('Desconto', 0, 100),
    qtdConsultas: inteiro('Quantidade de consultas', 0, 100),
    valorConsulta: decimal('Valor da consulta', 0, LIMITE_NUMERIC),
    qtdFretes: inteiro('Quantidade de fretes', 0, 100),
    valorFrete: decimal('Valor do frete', 0, LIMITE_NUMERIC),
    parcelas: inteiro('Parcelas', 1, 60),
    formaPagamento: obrigatorio('Forma de pagamento').pipe(
      z.string().max(200, 'Forma de pagamento muito longa (máx. 200 caracteres)'),
    ),
  })
  // TODO valor gravado precisa caber em numeric(10, 2) — não só o total: 1000 frascos de
  // R$ 1 milhão com 100% de subsídio dão total 0, mas subtotal de R$ 1 bilhão, e o Postgres
  // recusaria com um erro genérico.
  .superRefine((d, ctx) => {
    const r = calcularAdesao(d);
    const valores: [string, number][] = [
      ['Subtotal dos medicamentos', r.subtotalMedicamentos],
      ['Total das consultas', r.totalConsultas],
      ['Total dos fretes', r.totalFretes],
      ['Total da adesão', r.totalAdesao],
    ];
    for (const [rotulo, centavos] of valores) {
      if (paraReais(centavos) > LIMITE_NUMERIC) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${rotulo} passa do limite permitido`,
        });
        return;
      }
    }
  });

type FormValidado = z.infer<typeof formSchema>;

function validar(
  dados: PlanoTratamentoFormData,
): { ok: true; dados: FormValidado } | { ok: false; erro: string } {
  const parsed = formSchema.safeParse(dados);
  if (!parsed.success) return { ok: false, erro: parsed.error.errors[0].message };
  return { ok: true, dados: parsed.data };
}

const idSchema = z.string().trim().min(1).max(64);

/** Converte o formulário validado nas colunas, com os totais recalculados aqui. */
function paraColunas(d: FormValidado) {
  const r = calcularAdesao(d);
  const dinheiro = (centavos: number) => paraReais(centavos).toFixed(2);
  return {
    status: d.status,
    pacienteId: d.pacienteId || null,
    patientName: d.patientName,
    cpf: d.cpf,
    dataAdesao: d.dataAdesao,
    periodoMeses: d.periodoMeses,
    medicamento: d.medicamento,
    qtdFrascos: d.qtdFrascos,
    valorFrasco: d.valorFrasco.toFixed(2),
    descontoPct: d.descontoPct.toFixed(2),
    qtdConsultas: d.qtdConsultas,
    valorConsulta: d.valorConsulta.toFixed(2),
    qtdFretes: d.qtdFretes,
    valorFrete: d.valorFrete.toFixed(2),
    parcelas: d.parcelas,
    formaPagamento: d.formaPagamento,
    subtotalMedicamentos: dinheiro(r.subtotalMedicamentos),
    valorSubsidio: dinheiro(r.valorSubsidio),
    medicamentosLiquido: dinheiro(r.medicamentosLiquido),
    totalConsultas: dinheiro(r.totalConsultas),
    totalFretes: dinheiro(r.totalFretes),
    totalAdesao: dinheiro(r.totalAdesao),
    valorParcela: dinheiro(r.valorParcela),
  };
}

/** Snapshot enxuto para auditoria — sem CPF nem nome do paciente. */
function resumoParaAuditoria(c: ReturnType<typeof paraColunas> & { planoNumber: string }) {
  return {
    planoNumber: c.planoNumber,
    status: c.status,
    pacienteId: c.pacienteId,
    dataAdesao: c.dataAdesao,
    periodoMeses: c.periodoMeses,
    qtdFrascos: c.qtdFrascos,
    descontoPct: c.descontoPct,
    totalAdesao: c.totalAdesao,
    parcelas: c.parcelas,
  };
}

/**
 * verificarAdmin() não popula `userId` — resolve pelo clerkId, para auditoria.
 *
 * ⚠️ Nunca lança: roda DEPOIS da gravação, e uma falha aqui viraria "erro ao salvar" para um
 * plano que já foi gravado — o admin clicaria Salvar de novo e criaria um duplicado. Na falha, a
 * auditoria sai sem autor (a coluna aceita nulo) e o erro fica no log.
 */
async function obterUserIdInterno(clerkId: string | undefined): Promise<string | null> {
  if (!clerkId) return null;
  try {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1);
    return user?.id ?? null;
  } catch (error) {
    console.error('[PlanoTratamento] Erro ao resolver autor da auditoria:', error);
    return null;
  }
}

/**
 * O `pacienteId` vem do client — nunca confiar (AGENTS.md). Confere que existe e não está
 * arquivado nem com a conta excluída, a mesma regra do autocomplete.
 */
async function pacienteAtivo(pacienteId: string): Promise<boolean> {
  const [paciente] = await db
    .select({ id: pacientes.id })
    .from(pacientes)
    .innerJoin(users, eq(pacientes.userId, users.id))
    .where(and(eq(pacientes.id, pacienteId), isNull(pacientes.deletedAt), isNull(users.deletedAt)))
    .limit(1);
  return !!paciente;
}

const ERRO_PACIENTE =
  'O paciente vinculado não foi encontrado ou está arquivado. Remova o vínculo ou escolha outro.';

const erroNumeroDuplicado = (numero: string) =>
  `Já existe um plano com o número ${numero}. Use outro número ou deixe em branco para gerar.`;

// ── Criar ──────────────────────────────────────────────────────

export async function criarPlanoTratamento(
  dados: PlanoTratamentoFormData,
): Promise<ActionResult<{ planoId: string }>> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const v = validar(dados);
    if (!v.ok) return { sucesso: false, erro: v.erro };

    if (v.dados.pacienteId && !(await pacienteAtivo(v.dados.pacienteId))) {
      return { sucesso: false, erro: ERRO_PACIENTE };
    }

    // Número em branco → gerado aqui. O índice único do banco decide colisão: número digitado
    // repetido vira mensagem; número GERADO que colidiu (sufixo aleatório) tenta outro.
    const numeroDigitado = v.dados.planoNumber;
    const base = paraColunas(v.dados);
    let colunas = { ...base, planoNumber: numeroDigitado || generatePlanoNumber() };
    let plano: { id: string } | undefined;

    for (let tentativa = 0; tentativa < 3 && !plano; tentativa++) {
      try {
        // Tabela única: um INSERT é atômico por si — não precisa de transação.
        [plano] = await db
          .insert(planosTratamento)
          .values(colunas)
          .returning({ id: planosTratamento.id });
      } catch (erro) {
        if (!ehViolacaoDeUnico(erro)) throw erro;
        if (numeroDigitado) return { sucesso: false, erro: erroNumeroDuplicado(numeroDigitado) };
        colunas = { ...base, planoNumber: generatePlanoNumber() };
      }
    }
    if (!plano) {
      return { sucesso: false, erro: 'Não foi possível gerar um número único. Tente de novo.' };
    }

    await registrarAuditoria({
      userId: await obterUserIdInterno(auth.clerkId),
      acao: 'criar',
      entidade: 'planos_tratamento',
      entidadeId: plano.id,
      dadosDepois: resumoParaAuditoria(colunas),
    });

    revalidatePath(ROTA_LISTA);
    return { sucesso: true, dados: { planoId: plano.id } };
  } catch (error) {
    console.error('[PlanoTratamento] Erro ao criar plano:', error);
    return { sucesso: false, erro: 'Erro ao criar plano de tratamento' };
  }
}

// ── Atualizar ──────────────────────────────────────────────────

export async function atualizarPlanoTratamento(
  planoId: string,
  dados: PlanoTratamentoFormData,
): Promise<ActionResult> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const id = idSchema.safeParse(planoId);
    if (!id.success) return { sucesso: false, erro: 'Plano inválido' };

    const v = validar(dados);
    if (!v.ok) return { sucesso: false, erro: v.erro };

    const [antes] = await db
      .select()
      .from(planosTratamento)
      .where(and(eq(planosTratamento.id, id.data), isNull(planosTratamento.deletedAt)))
      .limit(1);
    if (!antes) return { sucesso: false, erro: 'Plano de tratamento não encontrado' };

    // Só confere vínculo NOVO: um plano antigo cujo paciente foi arquivado depois continua
    // editável (corrigir um erro de digitação não pode exigir trocar o paciente).
    if (
      v.dados.pacienteId &&
      v.dados.pacienteId !== antes.pacienteId &&
      !(await pacienteAtivo(v.dados.pacienteId))
    ) {
      return { sucesso: false, erro: ERRO_PACIENTE };
    }

    const colunas = {
      ...paraColunas(v.dados),
      planoNumber: v.dados.planoNumber || antes.planoNumber,
    };

    // Um UPDATE só — atômico. O `deletedAt IS NULL` repetido impede reviver um plano apagado
    // entre a leitura acima e esta escrita.
    let atualizado: { id: string } | undefined;
    try {
      [atualizado] = await db
        .update(planosTratamento)
        .set(colunas)
        .where(and(eq(planosTratamento.id, id.data), isNull(planosTratamento.deletedAt)))
        .returning({ id: planosTratamento.id });
    } catch (erro) {
      if (ehViolacaoDeUnico(erro)) {
        return { sucesso: false, erro: erroNumeroDuplicado(colunas.planoNumber) };
      }
      throw erro;
    }
    if (!atualizado) return { sucesso: false, erro: 'Plano de tratamento não encontrado' };

    await registrarAuditoria({
      userId: await obterUserIdInterno(auth.clerkId),
      acao: 'atualizar',
      entidade: 'planos_tratamento',
      entidadeId: id.data,
      dadosAntes: {
        planoNumber: antes.planoNumber,
        status: antes.status,
        pacienteId: antes.pacienteId,
        dataAdesao: antes.dataAdesao,
        periodoMeses: antes.periodoMeses,
        qtdFrascos: antes.qtdFrascos,
        descontoPct: antes.descontoPct,
        totalAdesao: antes.totalAdesao,
        parcelas: antes.parcelas,
      },
      dadosDepois: resumoParaAuditoria(colunas),
    });

    revalidatePath(ROTA_LISTA);
    revalidatePath(`${ROTA_LISTA}/${id.data}`);
    return { sucesso: true };
  } catch (error) {
    console.error('[PlanoTratamento] Erro ao atualizar plano:', error);
    return { sucesso: false, erro: 'Erro ao atualizar plano de tratamento' };
  }
}

// ── Deletar (soft delete) ──────────────────────────────────────

export async function deletarPlanoTratamento(planoId: string): Promise<ActionResult> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const id = idSchema.safeParse(planoId);
    if (!id.success) return { sucesso: false, erro: 'Plano inválido' };

    const [removido] = await db
      .update(planosTratamento)
      .set({ deletedAt: new Date() })
      .where(and(eq(planosTratamento.id, id.data), isNull(planosTratamento.deletedAt)))
      .returning({ id: planosTratamento.id, planoNumber: planosTratamento.planoNumber });

    if (!removido) return { sucesso: false, erro: 'Plano de tratamento não encontrado' };

    await registrarAuditoria({
      userId: await obterUserIdInterno(auth.clerkId),
      acao: 'deletar',
      entidade: 'planos_tratamento',
      entidadeId: id.data,
      dadosAntes: { planoNumber: removido.planoNumber },
    });

    revalidatePath(ROTA_LISTA);
    return { sucesso: true };
  } catch (error) {
    console.error('[PlanoTratamento] Erro ao deletar plano:', error);
    return { sucesso: false, erro: 'Erro ao deletar plano de tratamento' };
  }
}

// ── Buscar completo ────────────────────────────────────────────

export async function buscarPlanoTratamento(
  planoId: string,
): Promise<ActionResult<PlanoTratamentoCompleto>> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const id = idSchema.safeParse(planoId);
    if (!id.success) return { sucesso: false, erro: 'Plano de tratamento não encontrado' };

    const [plano] = await db
      .select()
      .from(planosTratamento)
      .where(and(eq(planosTratamento.id, id.data), isNull(planosTratamento.deletedAt)))
      .limit(1);

    if (!plano) return { sucesso: false, erro: 'Plano de tratamento não encontrado' };

    return {
      sucesso: true,
      dados: {
        id: plano.id,
        planoNumber: plano.planoNumber,
        status: plano.status,
        pacienteId: plano.pacienteId,
        createdAt: plano.createdAt,
        updatedAt: plano.updatedAt,
        patientName: plano.patientName,
        cpf: plano.cpf,
        dataAdesao: plano.dataAdesao,
        periodoMeses: plano.periodoMeses,
        medicamento: plano.medicamento,
        qtdFrascos: plano.qtdFrascos,
        valorFrasco: plano.valorFrasco,
        descontoPct: plano.descontoPct,
        qtdConsultas: plano.qtdConsultas,
        valorConsulta: plano.valorConsulta,
        qtdFretes: plano.qtdFretes,
        valorFrete: plano.valorFrete,
        parcelas: plano.parcelas,
        formaPagamento: plano.formaPagamento,
        subtotalMedicamentos: plano.subtotalMedicamentos,
        valorSubsidio: plano.valorSubsidio,
        medicamentosLiquido: plano.medicamentosLiquido,
        totalConsultas: plano.totalConsultas,
        totalFretes: plano.totalFretes,
        totalAdesao: plano.totalAdesao,
        valorParcela: plano.valorParcela,
      },
    };
  } catch (error) {
    console.error('[PlanoTratamento] Erro ao buscar plano:', error);
    return { sucesso: false, erro: 'Erro ao buscar plano de tratamento' };
  }
}

// ── Listar ─────────────────────────────────────────────────────

/**
 * Cada campo cai sozinho: um `?status=xyz` na URL descarta só o status, não a busca nem a
 * paginação. A busca é cortada em 100 caracteres em vez de rejeitada.
 */
const listarSchema = z.object({
  status: z.enum(['draft', 'completed']).optional().catch(undefined),
  busca: z
    .string()
    .trim()
    .transform((s) => s.slice(0, 100))
    .optional()
    .catch(undefined),
  limite: z.number().int().min(1).max(100).catch(50),
  offset: z.number().int().min(0).catch(0),
});

export async function listarPlanosTratamento(params?: {
  status?: string;
  busca?: string;
  limite?: number;
  offset?: number;
}): Promise<ActionResult<{ planos: PlanoTratamentoListItem[]; total: number }>> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const parsed = listarSchema.safeParse(params ?? {});
    const p = parsed.success ? parsed.data : { limite: 50, offset: 0 };

    const conditions = [isNull(planosTratamento.deletedAt)];
    if (p.status) conditions.push(eq(planosTratamento.status, p.status));

    // Busca textual por número do plano, nome ou CPF do paciente. O CPF é gravado só com
    // dígitos, então a busca por CPF compara dígitos — "123.456" e "123456" acham o mesmo.
    if (p.busca) {
      const termo = `%${p.busca}%`;
      const digitos = somenteDigitosDoCpf(p.busca);
      conditions.push(
        digitos
          ? sql`(${planosTratamento.planoNumber} ILIKE ${termo} OR ${planosTratamento.patientName} ILIKE ${termo} OR ${planosTratamento.cpf} LIKE ${`%${digitos}%`})`
          : sql`(${planosTratamento.planoNumber} ILIKE ${termo} OR ${planosTratamento.patientName} ILIKE ${termo})`,
      );
    }

    const whereClause = and(...conditions);

    const [resultado, [{ count }]] = await Promise.all([
      db
        .select({
          id: planosTratamento.id,
          planoNumber: planosTratamento.planoNumber,
          dataAdesao: planosTratamento.dataAdesao,
          status: planosTratamento.status,
          createdAt: planosTratamento.createdAt,
          patientName: planosTratamento.patientName,
          totalAdesao: planosTratamento.totalAdesao,
        })
        .from(planosTratamento)
        .where(whereClause)
        .orderBy(desc(planosTratamento.createdAt))
        .limit(p.limite)
        .offset(p.offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(planosTratamento)
        .where(whereClause),
    ]);

    return { sucesso: true, dados: { planos: resultado, total: count } };
  } catch (error) {
    console.error('[PlanoTratamento] Erro ao listar planos:', error);
    return { sucesso: false, erro: 'Erro ao listar planos de tratamento' };
  }
}

// ── Autocomplete de pacientes ──────────────────────────────────

export async function buscarPacientesParaPlano(
  busca: string,
): Promise<ActionResult<{ id: string; nome: string; cpf: string | null }[]>> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const termo = z.string().trim().min(2).max(100).safeParse(busca);
    if (!termo.success) return { sucesso: true, dados: [] };

    const like = `%${termo.data}%`;
    // Só o que o documento usa (nome e CPF) sai do servidor — endereço e e-mail não.
    const resultado = await db
      .select({ id: pacientes.id, nome: users.nome, cpf: pacientes.cpf })
      .from(pacientes)
      .innerJoin(users, eq(pacientes.userId, users.id))
      .where(
        and(
          sql`(${users.nome} ILIKE ${like} OR ${pacientes.cpf} ILIKE ${like})`,
          // Paciente arquivado ou conta excluída não entra num plano novo.
          isNull(pacientes.deletedAt),
          isNull(users.deletedAt),
        ),
      )
      .limit(10);

    return { sucesso: true, dados: resultado };
  } catch (error) {
    console.error('[PlanoTratamento] Erro ao buscar pacientes:', error);
    return { sucesso: false, erro: 'Erro ao buscar pacientes' };
  }
}
