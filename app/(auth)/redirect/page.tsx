import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { users, pacientes, autorizacoesAnvisa } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { reconciliarPelaSessao } from '@/lib/fluxo/reconciliar';

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
      // `email` entra aqui para a reconciliação abaixo — sem uma ida extra ao Clerk no login.
      .select({ id: users.id, role: users.role, telefone: users.telefone, email: users.email })
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
            // `email` também aqui: os dois caminhos que preenchem `registro` precisam dele.
              .returning({ id: users.id, role: users.role, email: users.email });
          
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

  /**
   * 🔴 RECONCILIAÇÃO NO LOGIN — ADR-0022 D-09, e isto RETIFICA o rejeitado da própria decisão.
   *
   * O D-09 rejeitava _"reconciliar automaticamente no login"_ por um motivo real: trabalho de
   * rede no caminho de entrada, e falha de rede viraria falha de login.
   *
   * **Medido em produção em 13/09/2026, e o rejeitado custou caro:** eu havia posto a
   * reconciliação só em `/cadastro/[token]`, então ela só rodava para quem abrisse o link. O
   * dono fez o que qualquer pessoa faz — entrou na conta e navegou pelo menu — e achou a tela
   * da ANVISA pedindo os quatro documentos que ele já mandara pela Greens. _"A falsa
   * reconciliação está acontecendo."_
   *
   * ⚠️ O RISCO DO REJEITADO CONTINUA VÁLIDO, E É POR ISSO QUE ISTO É `try/catch` MUDO: se
   * qualquer coisa falhar aqui, o login segue. A reconciliação é oportunidade, nunca
   * pré-requisito — ninguém pode ficar sem entrar na própria conta porque um documento não
   * copiou.
   *
   * 🔴 E ela roda ANTES do `redirect('/paciente/anvisa')` de propósito: mandar para a tela da
   * procuração antes de materializar é exatamente o que produziu o relato do dono.
   */
  if (registro?.email) {
    try {
      const r = await reconciliarPelaSessao({ clerkId: userId, email: registro.email });
      if (r.reconciliou && r.documentosMaterializados > 0) {
        console.log('[redirect] reconciliado', { documentos: r.documentosMaterializados });
      }
    } catch (erro) {
      // Nunca derruba o login. Sem PII: só o fato.
      console.warn('[redirect] reconciliação falhou — o login segue', {
        tipo: erro instanceof Error ? erro.message.slice(0, 80) : 'desconhecido',
      });
    }
  }

  // Paciente sem processo de autorização ANVISA iniciado: leva direto para lá
  if (registro) {
    const [paciente] = await db
      .select({ id: pacientes.id })
      .from(pacientes)
      .where(and(eq(pacientes.userId, registro.id), isNull(pacientes.deletedAt)))
      .limit(1);

    if (paciente) {
      const [autorizacao] = await db
        .select({ id: autorizacoesAnvisa.id })
        .from(autorizacoesAnvisa)
        .where(
          and(eq(autorizacoesAnvisa.pacienteId, paciente.id), isNull(autorizacoesAnvisa.deletedAt)),
        )
        .limit(1);

      if (!autorizacao) redirect('/paciente/anvisa');
    }
  }

  redirect('/paciente');
}

