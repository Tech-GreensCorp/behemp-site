import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, pacientes, notificacoes } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { enviarNotificacaoRealtime } from '@/lib/integrations/pusher';
import { clerkClient } from '@clerk/nextjs/server';

/**
 * Webhook do Clerk — processa eventos de usuário.
 *
 * Eventos capturados:
 * - `user.created` → Cria registro no banco + notifica admins
 *
 * CONFIGURAÇÃO NO CLERK DASHBOARD:
 * 1. Acesse Webhooks → Add Endpoint
 * 2. URL: https://seu-dominio.com/api/webhooks/clerk
 * 3. Eventos: user.created
 * 4. Copie o Signing Secret e coloque em CLERK_WEBHOOK_SECRET no .env
 */

// ── Tipos do payload Clerk ─────────────────────────────────────

interface ClerkUserCreatedData {
  id: string;
  email_addresses: Array<{
    email_address: string;
    id: string;
    verification: { status: string };
  }>;
  first_name: string | null;
  last_name: string | null;
  phone_numbers: Array<{
    phone_number: string;
  }>;
  image_url: string | null;
  public_metadata: Record<string, unknown>;
  unsafe_metadata?: Record<string, unknown>;
  created_at: number;
}

interface ClerkWebhookEvent {
  data: ClerkUserCreatedData;
  type: string;
  object: string;
}

// ── Handler ────────────────────────────────────────────────────

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    console.error('[Webhook Clerk] CLERK_WEBHOOK_SECRET não configurado');
    return NextResponse.json(
      { error: 'Webhook secret não configurado' },
      { status: 500 },
    );
  }

  // Validar assinatura com Svix
  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json(
      { error: 'Headers de verificação ausentes' },
      { status: 400 },
    );
  }

  const payload = await req.text();
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: ClerkWebhookEvent;

  try {
    evt = wh.verify(payload, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as ClerkWebhookEvent;
  } catch (err) {
    console.error('[Webhook Clerk] Verificação de assinatura falhou:', err);
    return NextResponse.json(
      { error: 'Assinatura inválida' },
      { status: 400 },
    );
  }

  // ── Processar evento ─────────────────────────────────────────

  const eventType = evt.type;
  console.log(`[Webhook Clerk] Evento recebido: ${eventType}`);

  if (eventType === 'user.created') {
    await processarNovoUsuario(evt.data);
  } else if (eventType === 'user.updated') {
    await sincronizarPerfilUsuario(evt.data);
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

// ── Processar user.updated ──────────────────────────────────────

async function sincronizarPerfilUsuario(data: ClerkUserCreatedData) {
  const clerkId = data.id;
  const email = data.email_addresses?.[0]?.email_address;
  const nome = [data.first_name, data.last_name].filter(Boolean).join(' ') || undefined;
  const avatarUrl = data.image_url ?? null;

  if (!email && !nome && !avatarUrl) return;

  try {
    await db
      .update(users)
      .set({
        ...(email && { email }),
        ...(nome && { nome }),
        avatarUrl,
      })
      .where(eq(users.clerkId, clerkId));

    console.log(`[Webhook Clerk] ✅ Perfil atualizado: ${clerkId}`);
  } catch (error) {
    console.error('[Webhook Clerk] ❌ Erro ao atualizar perfil:', error);
  }
}

// ── Processar user.created ──────────────────────────────────────

async function processarNovoUsuario(data: ClerkUserCreatedData) {
  const clerkId = data.id;
  const email = data.email_addresses?.[0]?.email_address;
  const nome = [data.first_name, data.last_name].filter(Boolean).join(' ') || email.split('@')[0];
  const metadataPhone = (data.unsafe_metadata?.phone as string) || (data.public_metadata?.phone as string);
  const telefone = data.phone_numbers?.[0]?.phone_number || metadataPhone || null;
  const role = (data.public_metadata?.role as string) || 'paciente';

  if (!email) {
    console.warn('[Webhook Clerk] Usuário sem email, ignorando:', clerkId);
    return;
  }

  console.log(`[Webhook Clerk] Processando novo usuário: ${email} (role: ${role})`);

  try {
    // 1. Verificar se o user já existe no banco (pode ter sido criado manualmente)
    const [userExistente] = await db
      .select({ id: users.id, clerkId: users.clerkId })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    let userId: string;
    let roleEfetivo: string = role; // role do payload (default 'paciente')

    if (userExistente) {
      // Sempre atualizar o clerkId — o usuário pode ter recriado a conta (ex: Google OAuth)
      // e o clerkId antigo precisa ser substituído pelo novo para que as buscas por clerkId funcionem.
      await db
        .update(users)
        .set({ clerkId })
        .where(eq(users.id, userExistente.id));

      userId = userExistente.id;

      // Preservar o role que já existe no banco (fonte de verdade para médicos/admins criados manualmente).
      // Buscar o role atual para sincronizar corretamente com o Clerk.
      const [userComRole] = await db
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, userExistente.id))
        .limit(1);

      if (userComRole?.role) {
        roleEfetivo = userComRole.role;
      }
    } else {
      // Criar user no banco
      const [novoUser] = await db
        .insert(users)
        .values({
          email,
          nome,
          clerkId,
          role: role as 'admin' | 'medico' | 'paciente',
          telefone,
        })
        .returning({ id: users.id });
      userId = novoUser.id;
    }

    // Sincronizar publicMetadata.role no Clerk usando o role EFETIVO do banco.
    // Isso é essencial para usuários criados via OAuth (Google, etc.) onde o publicMetadata
    // não é definido automaticamente pelo Clerk.
    try {
      const client = await clerkClient();
      await client.users.updateUserMetadata(clerkId, {
        publicMetadata: { role: roleEfetivo },
      });
      console.log(`[Webhook Clerk] ✅ publicMetadata.role='${roleEfetivo}' sincronizado no Clerk: ${clerkId}`);
    } catch (clerkError) {
      // Não é crítico: o banco já tem o role correto. A página /redirect usa o banco como fallback.
      console.warn('[Webhook Clerk] ⚠️ Falha ao sincronizar role no Clerk (banco OK):', clerkError);
    }


    // 2. Se for paciente (role efetivo), criar registro de paciente (sem médico — admin atribuirá)
    if (roleEfetivo === 'paciente') {
      // Verificar se já existe registro de paciente
      const [pacienteExistente] = await db
        .select({ id: pacientes.id })
        .from(pacientes)
        .where(eq(pacientes.userId, userId))
        .limit(1);

      if (!pacienteExistente) {
        await db.insert(pacientes).values({
          userId,
          medicoId: null,
          status: 'aguardando_consulta',
          jornadaFase: 'acolhimento',
        });
      }

      // 3. Notificar todos os admins
      await notificarAdminsNovoPaciente(userId, nome, email);
    }

    console.log(`[Webhook Clerk] ✅ Usuário processado: ${email}`);
  } catch (error) {
    console.error('[Webhook Clerk] ❌ Erro ao processar usuário:', error);
  }
}

// ── Notificar admins ────────────────────────────────────────────

async function notificarAdminsNovoPaciente(
  pacienteUserId: string,
  nome: string,
  email: string,
) {
  try {
    // Buscar todos os admins
    const admins = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, 'admin'));

    if (admins.length === 0) {
      console.warn('[Webhook Clerk] Nenhum admin encontrado para notificar');
      return;
    }

    const titulo = '👤 Novo paciente registrado';
    const mensagem = `${nome} (${email}) se cadastrou e precisa de um médico.`;
    const linkAcao = '/admin/atribuir-medico';

    // Inserir notificação para cada admin
    for (const admin of admins) {
      await db.insert(notificacoes).values({
        userId: admin.id,
        tipo: 'novo_paciente',
        titulo,
        mensagem,
        linkAcao,
      });

      // Notificação em tempo real via Pusher
      try {
        await enviarNotificacaoRealtime({
          userId: admin.id,
          tipo: 'novo_paciente',
          titulo,
          mensagem,
          linkAcao,
        });
      } catch (pusherErr) {
        // Pusher pode falhar em dev, não é crítico
        console.warn('[Webhook Clerk] Pusher falhou:', pusherErr);
      }
    }

    console.log(`[Webhook Clerk] ✅ ${admins.length} admin(s) notificado(s)`);
  } catch (error) {
    console.error('[Webhook Clerk] ❌ Erro ao notificar admins:', error);
  }
}
