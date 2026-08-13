import { put, del } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { produtoArquivos, produtos } from '@/db/schema';
import { verificarAdmin } from '@/lib/auth';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';

/**
 * API Route para upload de arquivos do catálogo de produtos.
 * Cada categoria é um slot único por produto — um novo upload substitui
 * o arquivo anterior da mesma categoria (comportamento "substituir").
 *
 * Usa Vercel Blob Storage (BLOB_BEHEMP_READ_WRITE_TOKEN).
 * Route Handler (não Server Action) por causa de FormData binário,
 * seguindo o mesmo padrão de /api/upload-documento.
 */

const CATEGORIAS_VALIDAS = [
  'imagem',
  'formula',
  'coa',
  'ficha_tecnica',
  'ficha_informativa',
] as const;

const MIME_POR_CATEGORIA: Record<(typeof CATEGORIAS_VALIDAS)[number], string[]> = {
  imagem: ['image/jpeg', 'image/png', 'image/webp'],
  formula: ['image/jpeg', 'image/png', 'image/webp'],
  coa: ['application/pdf'],
  ficha_tecnica: ['application/pdf'],
  ficha_informativa: ['application/pdf'],
};

const TAMANHO_MAXIMO_BYTES = 20 * 1024 * 1024; // 20MB

const uploadSchema = z.object({
  produtoId: z.string().min(1, 'ID do produto é obrigatório'),
  categoria: z.enum(CATEGORIAS_VALIDAS),
  descricao: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) {
      return NextResponse.json({ sucesso: false, erro: auth.erro }, { status: 401 });
    }

    const formData = await request.formData();

    const file = formData.get('arquivo') as File | null;
    if (!file || file.size === 0) {
      return NextResponse.json({ sucesso: false, erro: 'Arquivo é obrigatório' }, { status: 400 });
    }
    if (file.size > TAMANHO_MAXIMO_BYTES) {
      return NextResponse.json(
        { sucesso: false, erro: `Arquivo excede ${TAMANHO_MAXIMO_BYTES / 1024 / 1024}MB` },
        { status: 400 },
      );
    }

    const parsed = uploadSchema.safeParse({
      produtoId: formData.get('produtoId') ?? '',
      categoria: formData.get('categoria') ?? '',
      descricao: formData.get('descricao') || undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { sucesso: false, erro: parsed.error.errors[0].message },
        { status: 400 },
      );
    }

    const mimesAceitos = MIME_POR_CATEGORIA[parsed.data.categoria];
    if (!mimesAceitos.includes(file.type)) {
      return NextResponse.json(
        {
          sucesso: false,
          erro: `Tipo não permitido para ${parsed.data.categoria}. Use: ${mimesAceitos.join(', ')}`,
        },
        { status: 400 },
      );
    }

    const [produto] = await db
      .select({ id: produtos.id, sku: produtos.sku })
      .from(produtos)
      .where(eq(produtos.id, parsed.data.produtoId))
      .limit(1);
    if (!produto) {
      return NextResponse.json({ sucesso: false, erro: 'Produto não encontrado' }, { status: 404 });
    }

    // Categoria é slot único por produto: remove o arquivo anterior (blob + registro)
    const existentes = await db
      .select()
      .from(produtoArquivos)
      .where(
        and(
          eq(produtoArquivos.produtoId, parsed.data.produtoId),
          eq(produtoArquivos.categoria, parsed.data.categoria),
        ),
      );

    for (const antigo of existentes) {
      try {
        await del(antigo.urlBlob);
      } catch {
        console.warn('[API] Falha ao remover blob anterior, continuando com a substituição');
      }
    }
    if (existentes.length > 0) {
      await db
        .delete(produtoArquivos)
        .where(
          and(
            eq(produtoArquivos.produtoId, parsed.data.produtoId),
            eq(produtoArquivos.categoria, parsed.data.categoria),
          ),
        );
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin';
    const nomeSeguro = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const blobPath = `produtos/${produto.id}/${parsed.data.categoria}/${nomeSeguro}`;

    const blob = await put(blobPath, file, {
      access: 'public',
      token: process.env.BLOB_BEHEMP_READ_WRITE_TOKEN,
    });

    const [arquivo] = await db
      .insert(produtoArquivos)
      .values({
        produtoId: parsed.data.produtoId,
        categoria: parsed.data.categoria,
        urlBlob: blob.url,
        nomeArquivo: file.name,
        mimetype: file.type,
        descricao: parsed.data.descricao ?? null,
      })
      .returning();

    revalidatePath('/admin/produtos');
    revalidatePath(`/paciente/produtos/${produto.sku}`);
    revalidatePath(`/medico/produtos/${produto.sku}`);

    return NextResponse.json({ sucesso: true, dados: arquivo });
  } catch (error) {
    console.error('[API] Erro ao fazer upload de arquivo de produto:', error);
    return NextResponse.json(
      { sucesso: false, erro: 'Erro ao enviar arquivo. Tente novamente.' },
      { status: 500 },
    );
  }
}
