import { auth, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

/**
 * Rota de debug para verificar os dados de autenticação do Clerk.
 * REMOVER em produção.
 */
export async function GET() {
  try {
    const authData = await auth();
    const user = await currentUser();

    return NextResponse.json({
      userId: authData.userId,
      sessionClaims: authData.sessionClaims,
      clerkUser: user
        ? {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.emailAddresses?.[0]?.emailAddress,
            publicMetadata: user.publicMetadata,
            privateMetadata: user.privateMetadata,
            unsafeMetadata: user.unsafeMetadata,
          }
        : null,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
