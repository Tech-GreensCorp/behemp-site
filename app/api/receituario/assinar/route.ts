import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function POST(_request: NextRequest) {
  const authReq = await auth();
  const userId = authReq.userId;
  
  if (!userId) {
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 });
  }

  // STUB — aguardando credenciais do PSC (BirdID/VIDaaS)
  return NextResponse.json({
    sucesso: false,
    erro: 'Assinatura digital ICP-Brasil em implantação. As credenciais do PSC estão sendo configuradas. Disponível em breve.',
    stub: true,
  }, { status: 503 });
}
