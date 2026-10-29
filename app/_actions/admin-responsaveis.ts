'use server';

/**
 * O ADMIN cadastra um responsável internamente — ADR-0033, pedido de Dryelle em 29/10/2026.
 *
 * O mesmo padrão de `criarAdminUsuario` (`app/(admin)/_actions/usuarios.ts`): só admin; o papel NÃO vem do
 * cliente (é fixo em `responsavel`); Clerk primeiro, já com o papel no `publicMetadata` (é de lá que o papel
 * efetivo é lido), banco depois, e se o banco falhar o login é desfeito para não sobrar conta órfã; a auditoria
 * leva o e-mail MASCARADO e nunca a senha.
 *
 * Mora em `app/_actions/` (como `admin-pacientes.ts` e `admin-medicos.ts`), e não em `app/(admin)/_actions/`.
 *
 * Depois de criar, a action envia o e-mail de boas-vindas (sem a senha). Falha de e-mail não desfaz o cadastro.
 *
 * O responsável nasce SEM dependentes e SEM ficha de paciente (ele não é paciente). Os dependentes ele mesmo
 * cadastra em `/responsavel`; ligar pacientes já existentes é a conversão do D-13, ainda não feita.
 */
import { clerkClient } from '@clerk/nextjs/server';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';

import { pacientes, responsaveis, responsaveisPacientes, users } from '@/db/schema';
import { verificarAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { DOMINIO_DO_EMAIL_TECNICO } from '@/lib/dependentes/regras';
import { enviarBoasVindasDoResponsavel } from '@/lib/email/boas-vindas-do-responsavel';
import { motivoLegivel } from '@/lib/erros/motivo-legivel';
import { cpfEhValido, mascararCpf, somenteDigitosDoCpf } from '@/lib/validacao/cpf';
import { registrarAuditoria } from '@/lib/utils/audit';

interface ActionResult<T = unknown> {
  sucesso: boolean;
  dados?: T;
  erro?: string;
}

const criarResponsavelSchema = z.object({
  nome: z.string().trim().min(2, 'Nome muito curto').max(100, 'Nome muito longo'),
  email: z.string().trim().toLowerCase().email('E-mail inválido').max(254, 'E-mail muito longo'),
  telefone: z
    .string()
    .trim()
    .regex(/^[\d\s()\-+]{8,20}$/, 'Telefone inválido')
    .or(z.literal(''))
    .optional(),
  cpf: z
    .string()
    .trim()
    .refine((v) => v === '' || cpfEhValido(v), 'CPF inválido')
    .optional(),
  senha: z
    .string()
    .min(8, 'A senha deve ter pelo menos 8 caracteres')
    .max(72, 'Senha muito longa')
    .regex(/[A-Z]/, 'Deve conter ao menos uma letra maiúscula')
    .regex(/[0-9]/, 'Deve conter ao menos um número'),
});

/** `maria@x.com` → `ma***@x.com`. A auditoria guarda isto: o e-mail original não sobrevive no log. */
function mascararEmail(email: string): string {
  const [local, dominio] = email.split('@');
  return `${(local ?? '').slice(0, 2)}***@${dominio ?? ''}`;
}

/** Traduz o erro da Backend API do Clerk para algo que o admin entenda. Sem eco do que foi enviado. */
function mensagemDeErroDoClerk(erro: unknown): string {
  const codigo = (erro as { errors?: { code?: string }[] })?.errors?.[0]?.code;
  switch (codigo) {
    case 'form_identifier_exists':
      return 'Este e-mail já tem login no Clerk mas não está no sistema. Peça à pessoa para entrar uma vez e depois ajuste o papel em Usuários.';
    case 'form_password_pwned':
      return 'Esta senha apareceu em vazamentos de dados. Escolha outra.';
    case 'form_password_length_too_short':
    case 'form_password_not_strong_enough':
      return 'A senha é fraca demais. Use uma mais longa e variada.';
    case 'form_param_format_invalid':
      return 'E-mail inválido.';
    default:
      return 'Não foi possível criar o login. Tente novamente.';
  }
}

export async function criarResponsavelAdmin(dados: {
  nome: string;
  email: string;
  telefone?: string;
  cpf?: string;
  senha: string;
}): Promise<ActionResult<{ id: string; emailEnviado: boolean }>> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado || !auth.clerkId) return { sucesso: false, erro: auth.erro };

    const parsed = criarResponsavelSchema.safeParse(dados);
    if (!parsed.success) {
      return { sucesso: false, erro: parsed.error.issues[0]?.message ?? 'Dados inválidos' };
    }
    const { nome, email, senha } = parsed.data;
    const telefone = parsed.data.telefone?.trim() || null;
    const cpf = parsed.data.cpf?.trim() ? somenteDigitosDoCpf(parsed.data.cpf) : null;

    // Já existe usuário ativo com este e-mail? Então é caso de ajuste, não de criação.
    const [existente] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(sql`lower(${users.email}) = ${email}`, isNull(users.deletedAt)))
      .limit(1);
    if (existente) {
      return { sucesso: false, erro: 'Já existe um usuário com este e-mail.' };
    }

    // 1. Login no Clerk, já com o papel no publicMetadata.
    const client = await clerkClient();
    let clerkId: string;
    try {
      const partes = nome.split(' ');
      const clerkUser = await client.users.createUser({
        emailAddress: [email],
        firstName: partes[0],
        lastName: partes.slice(1).join(' ') || '',
        password: senha,
        publicMetadata: { role: 'responsavel' },
      });
      clerkId = clerkUser.id;
    } catch (clerkError) {
      console.error('[Admin] Falha ao criar responsável no Clerk:', motivoLegivel(clerkError));
      return { sucesso: false, erro: mensagemDeErroDoClerk(clerkError) };
    }

    // 2. Linha em `users` (e o CPF, se informado). Se falhar, desfaz o login para não deixar conta órfã.
    let userId: string;
    try {
      const [novo] = await db
        .insert(users)
        .values({ email, nome, clerkId, role: 'responsavel', telefone })
        .onConflictDoNothing({ target: users.email })
        .returning({ id: users.id });

      if (novo) {
        userId = novo.id;
      } else {
        // O webhook do Clerk chegou primeiro: ajusta e religa a linha dele.
        const [doWebhook] = await db
          .update(users)
          .set({ clerkId, nome, role: 'responsavel', telefone })
          .where(and(sql`lower(${users.email}) = ${email}`, isNull(users.deletedAt)))
          .returning({ id: users.id });
        if (!doWebhook) throw new Error('Conflito de e-mail sem linha ativa correspondente');
        userId = doWebhook.id;
      }

      if (cpf) {
        await db
          .insert(responsaveis)
          .values({ userId, cpf })
          .onConflictDoNothing({ target: responsaveis.userId });
      }
    } catch (dbError) {
      console.error(
        '[Admin] Falha ao gravar o responsável; desfazendo o login:',
        motivoLegivel(dbError),
      );
      try {
        await client.users.deleteUser(clerkId);
      } catch (desfazerError) {
        console.error(
          '[Admin] Não foi possível desfazer o login no Clerk:',
          clerkId,
          motivoLegivel(desfazerError),
        );
      }
      return { sucesso: false, erro: 'Não foi possível concluir o cadastro. Nada foi criado.' };
    }

    const [admin] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, auth.clerkId))
      .limit(1);
    await registrarAuditoria({
      userId: admin?.id ?? null,
      acao: 'criar',
      entidade: 'users',
      entidadeId: userId,
      dadosDepois: { role: 'responsavel', email: mascararEmail(email) },
    });

    // O e-mail de boas-vindas NÃO leva a senha (ela vai por outro canal). Se não sair, a conta já existe: o admin é avisado.
    const emailEnviado = await enviarBoasVindasDoResponsavel({ email, nome });

    return { sucesso: true, dados: { id: userId, emailEnviado } };
  } catch (error) {
    console.error('[Admin] Erro ao criar responsável:', motivoLegivel(error));
    return { sucesso: false, erro: 'Erro ao criar responsável' };
  }
}

// ── Listagem para o admin ("Pacientes e responsáveis") ─────────────────────────────────────────────────────

const filtrosDaListaSchema = z.object({
  busca: z.string().trim().max(100).optional(),
  pagina: z.number().int().min(1).default(1),
  porPagina: z.number().int().min(1).max(100).default(20),
});

export type ResponsavelDoAdmin = {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  /** Mascarado (`123.***.***-01`): a lista não precisa do CPF inteiro, e o admin não o digita de novo aqui. */
  cpfMascarado: string | null;
  papel: string;
  createdAt: Date;
  dependentes: { pacienteId: string; nome: string; parentesco: string }[];
};

/**
 * Quem responde por alguém: o papel `responsavel` **e** o `paciente` que também cuida de outra pessoa (vínculo ativo).
 * Só admin. NÃO é regra de acesso a dado de dependente (o admin vê todos): é uma listagem, e por isso lê o vínculo aqui
 * em vez de passar por `garantirResponsavelDoPaciente`. O `users` técnico do dependente nunca entra (não é uma conta).
 */
export async function listarResponsaveisAdmin(
  entrada?: z.input<typeof filtrosDaListaSchema>,
): Promise<
  ActionResult<{ responsaveis: ResponsavelDoAdmin[]; total: number; totalPaginas: number }>
> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const parsed = filtrosDaListaSchema.safeParse(entrada ?? {});
    if (!parsed.success) return { sucesso: false, erro: 'Filtros inválidos' };
    const { busca, pagina, porPagina } = parsed.data;

    const condicoes = [
      isNull(users.deletedAt),
      sql`${users.email} NOT LIKE ${'%@' + DOMINIO_DO_EMAIL_TECNICO}`,
      sql`(${users.role} = 'responsavel' OR EXISTS (
        SELECT 1 FROM responsaveis_pacientes rp
        WHERE rp.responsavel_user_id = ${users.id} AND rp.status = 'ativo'
      ))`,
    ];
    if (busca) {
      condicoes.push(
        sql`(${users.nome} ILIKE ${`%${busca}%`} OR ${users.email} ILIKE ${`%${busca}%`})`,
      );
    }
    const where = and(...condicoes);

    const linhas = await db
      .select({
        id: users.id,
        nome: users.nome,
        email: users.email,
        telefone: users.telefone,
        papel: users.role,
        cpf: responsaveis.cpf,
        createdAt: users.createdAt,
      })
      .from(users)
      .leftJoin(responsaveis, eq(responsaveis.userId, users.id))
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(porPagina)
      .offset((pagina - 1) * porPagina);

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(users)
      .where(where);

    const ids = linhas.map((l) => l.id);
    const vinculos = ids.length
      ? await db
          .select({
            responsavelUserId: responsaveisPacientes.responsavelUserId,
            pacienteId: pacientes.id,
            nome: users.nome,
            parentesco: responsaveisPacientes.parentesco,
          })
          .from(responsaveisPacientes)
          .innerJoin(pacientes, eq(pacientes.id, responsaveisPacientes.pacienteId))
          .innerJoin(users, eq(users.id, pacientes.userId))
          .where(
            and(
              inArray(responsaveisPacientes.responsavelUserId, ids),
              eq(responsaveisPacientes.status, 'ativo'),
              isNull(pacientes.deletedAt),
            ),
          )
      : [];

    const resultado: ResponsavelDoAdmin[] = linhas.map((l) => ({
      id: l.id,
      nome: l.nome,
      email: l.email,
      telefone: l.telefone,
      cpfMascarado: l.cpf ? mascararCpf(l.cpf) : null,
      papel: l.papel,
      createdAt: l.createdAt,
      dependentes: vinculos
        .filter((v) => v.responsavelUserId === l.id)
        .map((v) => ({ pacienteId: v.pacienteId, nome: v.nome, parentesco: v.parentesco })),
    }));

    return {
      sucesso: true,
      dados: {
        responsaveis: resultado,
        total,
        totalPaginas: Math.max(1, Math.ceil(total / porPagina)),
      },
    };
  } catch (error) {
    console.error('[Admin] Erro ao listar responsáveis:', motivoLegivel(error));
    return { sucesso: false, erro: 'Erro ao listar responsáveis' };
  }
}
