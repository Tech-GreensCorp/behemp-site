import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { users, pacientes } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Página de redirecionamento pós-login — Server Component.
 *
 * Roda inteiramente no servidor: lê a sessão via auth() (JWT rápido)
 * e currentUser() (API do Clerk), determina o role e redireciona
 * instantaneamente antes de qualquer renderização no browser.
 *
 * ESTRATÉGIA DE ROLE (em ordem de prioridade):
 * 1. publicMetadata.role do Clerk (JWT já propagado — caso nominal)
 * 2. sessionClaims.metadata.role (fallback JWT)
 * 3. Banco de dados (fallback para OAuth como Google no primeiro login,
 *    onde o publicMetadata ainda não foi sincronizado)
 * 4. Default 'paciente' (toda conta nova é tratada como paciente)
 *
 * IMPORTANTE:
 * - 'force-dynamic' garante que esta rota NUNCA seja cacheada.
 * - A rota é marcada como PÚBLICA no middleware para evitar race condition
 *   onde o middleware bloqueia o acesso antes da sessão propagar.
 */
export const dynamic = 'force-dynamic';

export default async function AuthRedirectPage() {
  // Estratégia 1: auth() — resolve via JWT/cookie, mais rápido
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Redirect] Nenhuma sessão via auth(), redirecionando para sign-in');
    }
    redirect('/entrar');
  }

  // Estratégia 2: publicMetadata via currentUser() — mais atualizado que o JWT
  let role: string | undefined;

  try {
    const user = await currentUser();

    if (user) {
      role = user.publicMetadata?.role as string | undefined;
      if (process.env.NODE_ENV === 'development') {
        console.debug(
          `[Redirect] Usuário: ${user.emailAddresses?.[0]?.emailAddress} | Role Clerk: ${role ?? 'sem role'}`,
        );
      }
    }
  } catch (error) {
    console.error('[Redirect] Erro ao buscar currentUser:', error);
  }

  // Estratégia 3: sessionClaims do JWT (fallback se currentUser falhou)
  if (!role) {
    role = (sessionClaims?.metadata as { role?: string } | undefined)?.role;
    if (role && process.env.NODE_ENV === 'development') {
      console.debug(`[Redirect] Role via sessionClaims: ${role}`);
    }
  }

  // Estratégia 4: banco de dados — necessário no PRIMEIRO login via OAuth (Google, etc.)
  // O webhook user.created cria o registro com role='paciente', mas o publicMetadata
  // do Clerk pode ainda não ter sido sincronizado quando esta página é renderizada.
  let registro = null;
  try {
    const [userDb] = await db
      .select({ id: users.id, role: users.role, telefone: users.telefone })
      .from(users)
      .where(eq(users.clerkId, userId))
      .limit(1);

    if (userDb) {
      registro = userDb;
      role = userDb.role;
      console.log(`[Redirect] Role via banco: ${role} (clerkId: ${userId})`);

      // Se o usuário já existe no banco de dados mas o telefone não está salvo, sincronizar do Clerk
      if (!userDb.telefone) {
        const user = await currentUser();
        if (user) {
          const metadataPhone = (user.unsafeMetadata?.phone as string) || (user.publicMetadata?.phone as string);
          const telefone = user.phoneNumbers[0]?.phoneNumber || metadataPhone || null;
          if (telefone) {
            await db
              .update(users)
              .set({ telefone })
              .where(eq(users.id, userDb.id));
            console.log(`[Redirect] 🔄 Telefone sincronizado via metadados do Clerk para usuário existente: ${telefone}`);
          }
        }
      }
    }
  } catch (dbError) {
    console.error('[Redirect] Erro ao buscar role no banco:', dbError);
  }

  // Se o usuário não existe no banco (ex: webhook não disparou ou localhost), criar o registro em modo fallback
  if (!registro) {
    try {
      const user = await currentUser();
      if (user) {
        const email = user.emailAddresses[0]?.emailAddress;
        if (email) {
          const nome = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Novo Paciente';
          const metadataPhone = (user.unsafeMetadata?.phone as string) || (user.publicMetadata?.phone as string);
          const telefone = user.phoneNumbers[0]?.phoneNumber || metadataPhone || null;
          const userRole = (user.publicMetadata?.role as 'admin' | 'medico' | 'paciente') || 'paciente';

          // 1. Criar usuário na tabela 'users'
          const [novoUser] = await db
            .insert(users)
            .values({
              email,
              nome,
              clerkId: userId,
              role: userRole,
              telefone,
            })
            .returning({ id: users.id, role: users.role });
          
          registro = novoUser;
          role = novoUser.role;
          console.log(`[Redirect] Fallback Sync: ✅ Usuário criado no banco de dados: ${email}`);

          // 2. Se for paciente, garantir registro na tabela 'pacientes'
          if (userRole === 'paciente') {
            const [pacienteExistente] = await db
              .select({ id: pacientes.id })
              .from(pacientes)
              .where(eq(pacientes.userId, novoUser.id))
              .limit(1);

            if (!pacienteExistente) {
              await db.insert(pacientes).values({
                userId: novoUser.id,
                medicoId: null,
                status: 'aguardando_consulta',
                jornadaFase: 'acolhimento',
              });
              console.log(`[Redirect] Fallback Sync: ✅ Registro de paciente criado para userId: ${novoUser.id}`);
            }
          }
        }
      }
    } catch (syncError) {
      console.error('[Redirect] Fallback Sync: ❌ Falha ao sincronizar usuário do Clerk:', syncError);
    }
  }

  // Estratégia 5: default — toda conta nova sem role explícita é tratada como paciente
  if (!role) {
    console.warn(`[Redirect] Role não encontrada para clerkId: ${userId} — usando default 'paciente'`);
    role = 'paciente';
  }

  // Redireciona para o dashboard conforme o role
  if (role === 'admin') redirect('/admin');
  if (role === 'medico') redirect('/medico');
  redirect('/paciente');
}

