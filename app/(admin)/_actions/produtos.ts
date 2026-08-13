'use server';

import { db } from '@/lib/db';
import { produtos, produtoArquivos, users } from '@/db/schema';
import { eq, asc, desc, and, or, ilike, inArray, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { verificarAdmin } from '@/lib/auth';
import { del } from '@vercel/blob';
import { registrarAuditoria } from '@/lib/utils/audit';
import { revalidatePath } from 'next/cache';
import { LINHAS_PRODUTO } from '@/lib/catalogo/linhas';

/**
 * Server Actions de administração do catálogo de produtos.
 * Somente role admin pode acessar. Produtos são vendidos em plataforma
 * externa — este módulo apenas gerencia a vitrine institucional.
 */

interface ActionResult<T = unknown> {
  sucesso: boolean;
  dados?: T;
  erro?: string;
}

export interface ProdutoArquivoAdmin {
  id: string;
  categoria: 'imagem' | 'formula' | 'coa' | 'ficha_tecnica' | 'ficha_informativa';
  urlBlob: string;
  nomeArquivo: string | null;
  mimetype: string;
  descricao: string | null;
  createdAt: Date;
}

export interface ProdutoAdmin {
  id: string;
  sku: string;
  nome: string;
  linhaProduto: string | null;
  descricao: string[];
  preco: string | null;
  urlCompra: string;
  ativo: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  excluidoPor: string | null;
  excluidoPorNome: string | null;
  imagemUrl: string | null;
}

// ── Schemas ───────────────────────────────────────────────────

const produtoSchema = z.object({
  sku: z.string().trim().min(1, 'SKU é obrigatório').max(50),
  nome: z.string().trim().min(2, 'Nome muito curto').max(200),
  linhaProduto: z.enum(LINHAS_PRODUTO).optional(),
  descricao: z.array(z.string().trim().min(1)).max(50, 'Descrição com muitos itens'),
  preco: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, 'Preço inválido')
    .optional(),
  urlCompra: z.string().trim().url('URL de compra inválida'),
  ativo: z.boolean().optional(),
});

async function obterUserIdInterno(clerkId: string): Promise<string | null> {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  return user?.id ?? null;
}

function revalidarProduto(sku?: string) {
  revalidatePath('/admin/produtos');
  revalidatePath('/paciente/produtos');
  revalidatePath('/medico/produtos');
  if (sku) {
    revalidatePath(`/paciente/produtos/${sku}`);
    revalidatePath(`/medico/produtos/${sku}`);
  }
}

// ── Criar ─────────────────────────────────────────────────────

export async function criarProduto(
  dados: z.infer<typeof produtoSchema>,
): Promise<ActionResult<{ produtoId: string }>> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const parsed = produtoSchema.safeParse(dados);
    if (!parsed.success) return { sucesso: false, erro: parsed.error.errors[0].message };

    const [skuExistente] = await db
      .select({ id: produtos.id })
      .from(produtos)
      .where(eq(produtos.sku, parsed.data.sku))
      .limit(1);
    if (skuExistente) return { sucesso: false, erro: 'Já existe um produto com este SKU' };

    const [produto] = await db
      .insert(produtos)
      .values({
        sku: parsed.data.sku,
        nome: parsed.data.nome,
        linhaProduto: parsed.data.linhaProduto || null,
        descricao: parsed.data.descricao,
        preco: parsed.data.preco ?? null,
        urlCompra: parsed.data.urlCompra,
        ativo: parsed.data.ativo ?? true,
      })
      .returning({ id: produtos.id });

    const userIdInterno = await obterUserIdInterno(auth.clerkId!);
    if (userIdInterno) {
      await registrarAuditoria({
        userId: userIdInterno,
        acao: 'criar',
        entidade: 'produtos',
        entidadeId: produto.id,
        dadosDepois: { sku: parsed.data.sku, nome: parsed.data.nome },
      });
    }

    revalidarProduto(parsed.data.sku);
    return { sucesso: true, dados: { produtoId: produto.id } };
  } catch (error) {
    console.error('[Produtos] Erro ao criar produto:', error);
    return { sucesso: false, erro: 'Erro ao criar produto' };
  }
}

// ── Atualizar ─────────────────────────────────────────────────

export async function atualizarProduto(
  produtoId: string,
  dados: z.infer<typeof produtoSchema>,
): Promise<ActionResult> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const parsed = produtoSchema.safeParse(dados);
    if (!parsed.success) return { sucesso: false, erro: parsed.error.errors[0].message };

    const [produtoAntes] = await db
      .select()
      .from(produtos)
      .where(eq(produtos.id, produtoId))
      .limit(1);
    if (!produtoAntes) return { sucesso: false, erro: 'Produto não encontrado' };

    const [skuConflito] = await db
      .select({ id: produtos.id })
      .from(produtos)
      .where(and(eq(produtos.sku, parsed.data.sku), sql`${produtos.id} != ${produtoId}`))
      .limit(1);
    if (skuConflito) return { sucesso: false, erro: 'Já existe outro produto com este SKU' };

    await db
      .update(produtos)
      .set({
        sku: parsed.data.sku,
        nome: parsed.data.nome,
        linhaProduto: parsed.data.linhaProduto || null,
        descricao: parsed.data.descricao,
        preco: parsed.data.preco ?? null,
        urlCompra: parsed.data.urlCompra,
        ativo: parsed.data.ativo ?? produtoAntes.ativo,
      })
      .where(eq(produtos.id, produtoId));

    const userIdInterno = await obterUserIdInterno(auth.clerkId!);
    if (userIdInterno) {
      await registrarAuditoria({
        userId: userIdInterno,
        acao: 'atualizar',
        entidade: 'produtos',
        entidadeId: produtoId,
        dadosAntes: { sku: produtoAntes.sku, nome: produtoAntes.nome, ativo: produtoAntes.ativo },
        dadosDepois: { sku: parsed.data.sku, nome: parsed.data.nome, ativo: parsed.data.ativo },
      });
    }

    revalidarProduto(parsed.data.sku);
    if (produtoAntes.sku !== parsed.data.sku) revalidarProduto(produtoAntes.sku);
    return { sucesso: true };
  } catch (error) {
    console.error('[Produtos] Erro ao atualizar produto:', error);
    return { sucesso: false, erro: 'Erro ao atualizar produto' };
  }
}

// ── Ativar / Desativar ───────────────────────────────────────

export async function alternarAtivoProduto(
  produtoId: string,
  ativo: boolean,
): Promise<ActionResult> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const [produto] = await db
      .select({ sku: produtos.sku, ativo: produtos.ativo })
      .from(produtos)
      .where(eq(produtos.id, produtoId))
      .limit(1);
    if (!produto) return { sucesso: false, erro: 'Produto não encontrado' };

    await db.update(produtos).set({ ativo }).where(eq(produtos.id, produtoId));

    const userIdInterno = await obterUserIdInterno(auth.clerkId!);
    if (userIdInterno) {
      await registrarAuditoria({
        userId: userIdInterno,
        acao: 'atualizar',
        entidade: 'produtos',
        entidadeId: produtoId,
        dadosAntes: { ativo: produto.ativo },
        dadosDepois: { ativo },
      });
    }

    revalidarProduto(produto.sku);
    return { sucesso: true };
  } catch (error) {
    console.error('[Produtos] Erro ao alternar status do produto:', error);
    return { sucesso: false, erro: 'Erro ao alterar status do produto' };
  }
}

// ── Excluir (soft delete) ────────────────────────────────────

export async function excluirProduto(produtoId: string): Promise<ActionResult> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const [produto] = await db
      .select({ sku: produtos.sku, deletedAt: produtos.deletedAt })
      .from(produtos)
      .where(eq(produtos.id, produtoId))
      .limit(1);
    if (!produto) return { sucesso: false, erro: 'Produto não encontrado' };
    if (produto.deletedAt) return { sucesso: false, erro: 'Produto já está excluído' };

    const userIdInterno = await obterUserIdInterno(auth.clerkId!);

    await db
      .update(produtos)
      .set({ deletedAt: new Date(), ativo: false, excluidoPor: userIdInterno })
      .where(eq(produtos.id, produtoId));

    if (userIdInterno) {
      await registrarAuditoria({
        userId: userIdInterno,
        acao: 'deletar',
        entidade: 'produtos',
        entidadeId: produtoId,
      });
    }

    revalidarProduto(produto.sku);
    return { sucesso: true };
  } catch (error) {
    console.error('[Produtos] Erro ao excluir produto:', error);
    return { sucesso: false, erro: 'Erro ao excluir produto' };
  }
}

// ── Listar (admin — inclui inativos e excluídos) ─────────────

export async function listarProdutosAdmin(params?: {
  busca?: string;
  linhaProduto?: string;
  incluirExcluidos?: boolean;
  ordenarPor?: 'recentes' | 'antigos';
  pagina?: number;
  porPagina?: number;
}): Promise<ActionResult<{ produtos: ProdutoAdmin[]; total: number; totalPaginas: number }>> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const pagina = Math.max(1, params?.pagina ?? 1);
    const porPagina = Math.min(100, Math.max(1, params?.porPagina ?? 20));
    const offset = (pagina - 1) * porPagina;

    const condicoes = [];
    if (!params?.incluirExcluidos) condicoes.push(isNull(produtos.deletedAt));
    if (params?.busca) {
      condicoes.push(
        or(ilike(produtos.nome, `%${params.busca}%`), ilike(produtos.sku, `%${params.busca}%`)),
      );
    }
    if (params?.linhaProduto) {
      condicoes.push(eq(produtos.linhaProduto, params.linhaProduto));
    }
    const whereClause = condicoes.length > 0 ? and(...condicoes) : undefined;

    const excluidoPorUsers = db
      .select({ id: users.id, nome: users.nome })
      .from(users)
      .as('excluido_por_users');

    const ordenarFn = params?.ordenarPor === 'antigos' ? asc : desc;

    const resultado = await db
      .select({
        id: produtos.id,
        sku: produtos.sku,
        nome: produtos.nome,
        linhaProduto: produtos.linhaProduto,
        descricao: produtos.descricao,
        preco: produtos.preco,
        urlCompra: produtos.urlCompra,
        ativo: produtos.ativo,
        createdAt: produtos.createdAt,
        updatedAt: produtos.updatedAt,
        deletedAt: produtos.deletedAt,
        excluidoPor: produtos.excluidoPor,
        excluidoPorNome: excluidoPorUsers.nome,
      })
      .from(produtos)
      .leftJoin(excluidoPorUsers, eq(produtos.excluidoPor, excluidoPorUsers.id))
      .where(whereClause)
      .orderBy(ordenarFn(produtos.createdAt))
      .limit(porPagina)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(produtos)
      .where(whereClause);

    const imagens = resultado.length
      ? await db
          .select({ produtoId: produtoArquivos.produtoId, urlBlob: produtoArquivos.urlBlob })
          .from(produtoArquivos)
          .where(
            and(
              inArray(
                produtoArquivos.produtoId,
                resultado.map((p) => p.id),
              ),
              eq(produtoArquivos.categoria, 'imagem'),
            ),
          )
      : [];

    return {
      sucesso: true,
      dados: {
        produtos: resultado.map((p) => ({
          ...p,
          excluidoPorNome: p.excluidoPorNome ?? null,
          imagemUrl: imagens.find((i) => i.produtoId === p.id)?.urlBlob ?? null,
        })),
        total: count,
        totalPaginas: Math.max(1, Math.ceil(count / porPagina)),
      },
    };
  } catch (error) {
    console.error('[Produtos] Erro ao listar produtos:', error);
    return { sucesso: false, erro: 'Erro ao listar produtos' };
  }
}

// ── Buscar um produto (com arquivos) ─────────────────────────

export async function buscarProdutoAdmin(
  produtoId: string,
): Promise<ActionResult<ProdutoAdmin & { arquivos: ProdutoArquivoAdmin[] }>> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const [produto] = await db.select().from(produtos).where(eq(produtos.id, produtoId)).limit(1);
    if (!produto) return { sucesso: false, erro: 'Produto não encontrado' };

    let excluidoPorNome: string | null = null;
    if (produto.excluidoPor) {
      const [u] = await db
        .select({ nome: users.nome })
        .from(users)
        .where(eq(users.id, produto.excluidoPor))
        .limit(1);
      excluidoPorNome = u?.nome ?? null;
    }

    const arquivos = await db
      .select()
      .from(produtoArquivos)
      .where(eq(produtoArquivos.produtoId, produtoId))
      .orderBy(desc(produtoArquivos.createdAt));

    const imagemUrl = arquivos.find((a) => a.categoria === 'imagem')?.urlBlob ?? null;

    return {
      sucesso: true,
      dados: { ...produto, excluidoPorNome, imagemUrl, arquivos },
    };
  } catch (error) {
    console.error('[Produtos] Erro ao buscar produto:', error);
    return { sucesso: false, erro: 'Erro ao buscar produto' };
  }
}

// ── Remover arquivo de produto ────────────────────────────────

export async function removerArquivoProduto(arquivoId: string): Promise<ActionResult> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const [arquivo] = await db
      .select()
      .from(produtoArquivos)
      .where(eq(produtoArquivos.id, arquivoId))
      .limit(1);
    if (!arquivo) return { sucesso: false, erro: 'Arquivo não encontrado' };

    try {
      await del(arquivo.urlBlob);
    } catch {
      console.warn('[Produtos] Falha ao remover blob, continuando com remoção do registro');
    }

    await db.delete(produtoArquivos).where(eq(produtoArquivos.id, arquivoId));

    const userIdInterno = await obterUserIdInterno(auth.clerkId!);
    if (userIdInterno) {
      await registrarAuditoria({
        userId: userIdInterno,
        acao: 'deletar',
        entidade: 'produto_arquivos',
        entidadeId: arquivoId,
      });
    }

    const [produto] = await db
      .select({ sku: produtos.sku })
      .from(produtos)
      .where(eq(produtos.id, arquivo.produtoId))
      .limit(1);
    revalidarProduto(produto?.sku);

    return { sucesso: true };
  } catch (error) {
    console.error('[Produtos] Erro ao remover arquivo:', error);
    return { sucesso: false, erro: 'Erro ao remover arquivo' };
  }
}
