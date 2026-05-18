import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, pacientes, notificacoes } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { enviarNotificacaoRealtime } from '@/lib/integrations/pusher';

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
  public_metadata: Record<string, unknown>;
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
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

// ── Processar user.created ──────────────────────────────────────

async function processarNovoUsuario(data: ClerkUserCreatedData) {
  const clerkId = data.id;
  const email = data.email_addresses?.[0]?.email_address;
  const nome = [data.first_name, data.last_name].filter(Boolean).join(' ') || 'Novo Paciente';
  const telefone = data.phone_numbers?.[0]?.phone_number || null;
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

    if (userExistente) {
      // Atualizar o clerkId se ainda não estava vinculado
      // Não sobrescrever o role — o DB é a fonte de verdade para médicos/admins criados manualmente
      if (!userExistente.clerkId) {
        await db
          .update(users)
          .set({ clerkId })
          .where(eq(users.id, userExistente.id));
      }
      userId = userExistente.id;
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

    // 2. Se for paciente, criar registro de paciente (sem médico — admin atribuirá)
    if (role === 'paciente') {
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
