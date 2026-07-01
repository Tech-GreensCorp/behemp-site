import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { verificarAdmin } from '@/lib/auth';

/**
 * API Route para upload de avatar de médico.
 *
 * Aceita imagens JPEG, PNG e WebP até 2MB.
 * Retorna a URL pública do blob para salvar em users.avatar_url.
 */

const TAMANHO_MAX_BYTES = 2 * 1024 * 1024; // 2MB
const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'];

export async function POST(request: Request) {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) {
      return NextResponse.json(
        { sucesso: false, erro: auth.erro },
        { status: 401 },
      );
    }

    const formData = await request.formData();
    const file = formData.get('arquivo') as File | null;

    if (!file || file.size === 0) {
      return NextResponse.json(
        { sucesso: false, erro: 'Arquivo é obrigatório' },
        { status: 400 },
      );
    }

    if (file.size > TAMANHO_MAX_BYTES) {
      return NextResponse.json(
        { sucesso: false, erro: 'Imagem excede 2MB' },
        { status: 400 },
      );
    }

    if (!TIPOS_PERMITIDOS.includes(file.type)) {
      return NextResponse.json(
        { sucesso: false, erro: 'Tipo não permitido. Use JPG, PNG ou WebP' },
        { status: 400 },
      );
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const nomeSeguro = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const blobPath = `avatars/${nomeSeguro}`;

    const blob = await put(blobPath, file, {
      access: 'public',
      token: process.env.BLOB_BEHEMP_READ_WRITE_TOKEN,
    });

    return NextResponse.json({ sucesso: true, url: blob.url });
  } catch (error) {
    console.error('[API] Erro ao fazer upload de avatar:', error);
    return NextResponse.json(
      { sucesso: false, erro: 'Erro ao enviar imagem. Tente novamente.' },
      { status: 500 },
    );
  }
}
