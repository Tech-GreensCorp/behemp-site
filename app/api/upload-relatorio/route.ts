import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 400 });

    const blob = await put(`relatorios/${Date.now()}-${file.name}`, file, { access: 'public' });
    return NextResponse.json({ url: blob.url });
  } catch (error) {
    console.error('[API] Erro upload relatório:', error);
    return NextResponse.json({ error: 'Erro ao fazer upload' }, { status: 500 });
  }
}
