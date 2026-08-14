'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import {
  medicamentos,
  prescricoes,
  teleconsultas,
  medicos,
  pacientes,
  users,
  notificacoes,
  logsAuditoria,
} from '@/db/schema';
import { verificarMedico } from '@/lib/auth/permissions';
import { eq, and, isNull, desc, asc } from 'drizzle-orm';
import { addDays } from 'date-fns';
import { enviarEmailGenerico } from '@/lib/email/brevo';
import { resolverMedicoIdInterno, resolverContextoSala } from '@/lib/teleconsulta/contexto-sala';

// ── Tipos públicos ────────────────────────────────────────────────────────

export interface ItemCatalogo {
  id: string;
  nome: string;
  gotasPorMl: number;
  cbdMgPorGota: string | null;
  thcMgPorGota: string | null;
  marca: string | null;
  tipoEspectro: string | null;
}

export interface ItemMedicamentoForm {
  /** Se selecionado do catálogo; null para medicamento avulso */
  medicamentoId?: string | null;
  /** Nome display (obrigatório) */
  nome: string;
  /** Gotas por tomada */
  gotas: number;
  /** Intervalo entre tomadas em horas */
  intervaloHoras: 6 | 8 | 12 | 24;
  /** Via de administração */
  via: 'sublingual' | 'oral' | 'topica';
  /** Duração em dias; null = uso contínuo */
  duracaoDias?: number | null;
  /** Observações livres */
  observacoes?: string | null;
}

export interface DadosFormRenovar {
  medicamentos: ItemMedicamentoForm[];
  validadeDias: number;
}

// ── Zod schemas ──────────────────────────────────────────────────────────

const itemMedSchema = z.object({
  medicamentoId: z.string().nullable().optional(),
  nome: z.string().min(1, 'Nome do medicamento é obrigatório'),
  gotas: z.number().min(1, 'Dose deve ser ao menos 1 gota'),
  intervaloHoras: z.union([z.literal(6), z.literal(8), z.literal(12), z.literal(24)]),
  via: z.enum(['sublingual', 'oral', 'topica']),
  duracaoDias: z.number().nullable().optional(),
  observacoes: z.string().nullable().optional(),
});

const criarSchema = z.object({
  salaId: z.string().min(1, 'salaId é obrigatório'),
  medicamentos: z.array(itemMedSchema).min(1, 'Ao menos 1 medicamento é obrigatório'),
  validadeDias: z.number().int().min(7).max(90).default(30),
});

// ── Helpers ──────────────────────────────────────────────────────────────

/** Gera posologia legível: "Tomar 05 gotas sublingual de 8 em 8 horas" */
function gerarPosologiaTexto(item: ItemMedicamentoForm): string {
  const viaLabel: Record<string, string> = {
    sublingual: 'sublingual',
    oral: 'oral',
    topica: 'tópica',
  };
  const gotasStr = String(item.gotas).padStart(2, '0');
  const intervalo = item.intervaloHoras;
  const via = viaLabel[item.via] ?? item.via;
  let texto = `Tomar ${gotasStr} gota${item.gotas > 1 ? 's' : ''} ${via} de ${intervalo} em ${intervalo} horas`;
  if (item.duracaoDias) {
    texto += ` por ${item.duracaoDias} dias`;
  } else {
    texto += ' (uso contínuo)';
  }
  return texto;
}

/**
 * Monta o JSONB no formato que o PDF e /paciente/prescricoes esperam:
 * { nome, dose, forma, posologia, quantidade }
 */
function montarJsonbMedicamento(item: ItemMedicamentoForm) {
  return {
    nome: item.nome,
    dose: `${item.gotas} gota${item.gotas > 1 ? 's' : ''}`,
    forma: 'Solução oral / extrato',
    posologia: gerarPosologiaTexto(item),
    quantidade: item.duracaoDias
      ? `${item.gotas * Math.ceil(24 / item.intervaloHoras) * item.duracaoDias} gotas (${item.duracaoDias} dias)`
      : 'Uso contínuo',
    observacoes: item.observacoes ?? undefined,
  };
}



// ── Actions ──────────────────────────────────────────────────────────────

/**
 * Lista medicamentos ativos: Greens primeiro, depois alfabético.
 * Null-safe em campos opcionais da sprint Central de Alertas.
 */
export async function buscarCatalogoMedicamentos(): Promise<{
  sucesso: boolean;
  dados?: ItemCatalogo[];
  erro?: string;
}> {
  try {
    const perm = await verificarMedico();
    if (!perm.autorizado) return { sucesso: false, erro: 'Não autorizado' };

    const rows = await db
      .select({
        id: medicamentos.id,
        nome: medicamentos.nome,
        gotasPorMl: medicamentos.gotasPorMl,
        cbdMgPorGota: medicamentos.cbdMgPorGota,
        thcMgPorGota: medicamentos.thcMgPorGota,
        marca: medicamentos.marca,
        tipoEspectro: medicamentos.tipoEspectro,
      })
      .from(medicamentos)
      .where(eq(medicamentos.ativo, true))
      .orderBy(asc(medicamentos.nome));

    // Greens primeiro (marca = 'Greens' ou nome contém 'Greens')
    const greens = rows.filter(
      (m) =>
        m.marca?.toLowerCase().includes('greens') ||
        m.nome.toLowerCase().includes('greens'),
    );
    const outros = rows.filter(
      (m) =>
        !m.marca?.toLowerCase().includes('greens') &&
        !m.nome.toLowerCase().includes('greens'),
    );

    const dados: ItemCatalogo[] = [...greens, ...outros].map((m) => ({
      id: m.id,
      nome: m.nome,
      gotasPorMl: m.gotasPorMl,
      cbdMgPorGota: m.cbdMgPorGota ?? null,
      thcMgPorGota: m.thcMgPorGota ?? null,
      marca: m.marca ?? null,
      tipoEspectro: m.tipoEspectro ?? null,
    }));

    return { sucesso: true, dados };
  } catch (err) {
    console.error('[buscarCatalogoMedicamentos]', err);
    return { sucesso: false, erro: 'Erro ao buscar catálogo' };
  }
}

/**
 * Cria prescrição inline, resolvendo contexto da sala server-side.
 * Notifica o paciente (in-app + e-mail) e registra auditoria LGPD.
 */
export async function criarPrescricaoInline(input: unknown): Promise<{
  sucesso: boolean;
  prescricaoId?: string;
  erro?: string;
}> {
  try {
    const perm = await verificarMedico();
    if (!perm.autorizado || !perm.clerkId) return { sucesso: false, erro: 'Não autorizado' };

    const parsed = criarSchema.safeParse(input);
    if (!parsed.success) {
      return { sucesso: false, erro: parsed.error.errors[0]?.message ?? 'Dados inválidos' };
    }
    const req = parsed.data;

    // Resolver identidades server-side
    const medicoCtx = await resolverMedicoIdInterno(perm.clerkId);
    if (!medicoCtx) return { sucesso: false, erro: 'Médico não encontrado' };

    const salaCtx = await resolverContextoSala(req.salaId);
    if (!salaCtx) return { sucesso: false, erro: 'Sala não encontrada' };

    // Verificar que o médico autenticado é o dono da sala
    if (salaCtx.medicoIdDaSala !== medicoCtx.medicoId) {
      return { sucesso: false, erro: 'Você não é o médico responsável por esta sala' };
    }

    // Montar JSONB compatível com /api/receituario/pdf e /paciente/prescricoes
    const medicamentosJsonb = req.medicamentos.map(montarJsonbMedicamento);

    // Calcular validade
    const validade = addDays(new Date(), req.validadeDias);

    // Inserir prescrição
    const [nova] = await db
      .insert(prescricoes)
      .values({
        medicoId: medicoCtx.medicoId,
        pacienteId: salaCtx.pacienteId,
        consultaId: salaCtx.consultaId ?? undefined,
        tipo: 'simples',
        status: 'emitida',
        medicamentos: medicamentosJsonb,
        validade,
      })
      .returning({ id: prescricoes.id });

    if (!nova?.id) return { sucesso: false, erro: 'Falha ao inserir prescrição' };

    // Buscar userId do paciente para notificação
    const [pacienteRow] = await db
      .select({ userId: pacientes.userId, email: users.email, nome: users.nome })
      .from(pacientes)
      .innerJoin(users, eq(pacientes.userId, users.id))
      .where(eq(pacientes.id, salaCtx.pacienteId))
      .limit(1);

    // Notificação in-app
    if (pacienteRow?.userId) {
      await db
        .insert(notificacoes)
        .values({
          userId: pacienteRow.userId,
          tipo: 'geral',
          titulo: 'Nova prescrição disponível',
          mensagem: 'O médico emitiu uma nova prescrição durante a teleconsulta. Acesse seu histórico para visualizar.',
          linkAcao: '/paciente/prescricoes',
        })
        .catch((e) => console.error('[criarPrescricaoInline] Notif in-app:', e));
    }

    // E-mail via Brevo (fire-and-forget)
    if (pacienteRow?.email) {
      const htmlEmail = `
        <div style="font-family:sans-serif;max-width:560px;margin:auto">
          <h2 style="color:#2D4F3C">Nova prescrição disponível</h2>
          <p>Olá${pacienteRow.nome ? `, ${pacienteRow.nome}` : ''}!</p>
          <p>O seu médico emitiu uma nova prescrição durante a teleconsulta de hoje.</p>
          <p>Acesse a plataforma para visualizar e baixar o PDF:</p>
          <a href="https://be4hope.org/paciente/prescricoes"
             style="display:inline-block;background:#2D4F3C;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:8px">
            Ver Prescrição
          </a>
          <p style="color:#888;font-size:12px;margin-top:24px">Be4Hope Telemedicina</p>
        </div>
      `;
      enviarEmailGenerico(
        [{ email: pacienteRow.email, name: pacienteRow.nome ?? '' }],
        '🩺 Nova prescrição — Be4Hope',
        htmlEmail,
      ).catch((e) => console.error('[criarPrescricaoInline] E-mail:', e));
    }

    // Auditoria LGPD
    await db
      .insert(logsAuditoria)
      .values({
        userId: medicoCtx.userIdInterno,
        acao: 'prescricao_emitida',
        entidade: 'prescricoes',
        entidadeId: nova.id,
        dadosDepois: {
          pacienteId: salaCtx.pacienteId,
          salaId: req.salaId,
          origem: 'teleconsulta',
          medicamentosCount: req.medicamentos.length,
          validade: validade.toISOString(),
        },
        ip: 'SERVER_ACTION',
      })
      .catch((e) => console.error('[criarPrescricaoInline] Auditoria:', e));

    return { sucesso: true, prescricaoId: nova.id };
  } catch (err) {
    console.error('[criarPrescricaoInline]', err);
    return { sucesso: false, erro: 'Erro interno ao criar prescrição' };
  }
}

/**
 * Busca a última prescrição do paciente da sala e retorna os dados
 * no formato do formulário para pré-preenchimento.
 * NÃO cria nada no banco.
 */
export async function renovarUltimaPrescricao(salaId: string): Promise<{
  sucesso: boolean;
  dados?: DadosFormRenovar;
  erro?: string;
}> {
  try {
    const perm = await verificarMedico();
    if (!perm.autorizado || !perm.clerkId) return { sucesso: false, erro: 'Não autorizado' };

    const salaCtx = await resolverContextoSala(salaId);
    if (!salaCtx) return { sucesso: false, erro: 'Sala não encontrada' };

    // Verificar que o médico é o dono da sala
    const medicoCtx = await resolverMedicoIdInterno(perm.clerkId);
    if (!medicoCtx) return { sucesso: false, erro: 'Médico não encontrado' };
    if (salaCtx.medicoIdDaSala !== medicoCtx.medicoId) {
      return { sucesso: false, erro: 'Não autorizado para esta sala' };
    }

    const [ultima] = await db
      .select({ medicamentos: prescricoes.medicamentos })
      .from(prescricoes)
      .where(and(eq(prescricoes.pacienteId, salaCtx.pacienteId), isNull(prescricoes.deletedAt)))
      .orderBy(desc(prescricoes.createdAt))
      .limit(1);

    if (!ultima) return { sucesso: false, erro: 'Nenhuma prescrição anterior encontrada' };

    // Converter o JSONB de volta para o formato do formulário (best-effort)
    const meds = Array.isArray(ultima.medicamentos) ? ultima.medicamentos : [];
    const medsForm: ItemMedicamentoForm[] = (meds as Record<string, unknown>[]).map((m) => {
      // Tentar extrair gotas da dose: "5 gotas" → 5
      const doseStr = String(m.dose ?? '');
      const gotasMatch = doseStr.match(/(\d+)/);
      const gotas = gotasMatch ? Number(gotasMatch[1]) : 5;

      // Tentar extrair intervalo da posologia: "de 8 em 8 horas" → 8
      const posStr = String(m.posologia ?? '');
      const intervaloMatch = posStr.match(/de (\d+) em \d+ horas/);
      const intervaloRaw = intervaloMatch ? Number(intervaloMatch[1]) : 8;
      const intervalo: 6 | 8 | 12 | 24 = ([6, 8, 12, 24] as const).includes(intervaloRaw as 6 | 8 | 12 | 24)
        ? (intervaloRaw as 6 | 8 | 12 | 24)
        : 8;

      // Via
      const viaMap: Record<string, 'sublingual' | 'oral' | 'topica'> = {
        sublingual: 'sublingual', oral: 'oral', tópica: 'topica',
      };
      const viaRaw = Object.keys(viaMap).find((v) => posStr.toLowerCase().includes(v));
      const via: 'sublingual' | 'oral' | 'topica' = viaRaw ? viaMap[viaRaw] : 'sublingual';

      // Duração
      const duracaoMatch = posStr.match(/por (\d+) dias/);
      const duracaoDias = duracaoMatch ? Number(duracaoMatch[1]) : null;

      return {
        nome: String(m.nome ?? ''),
        gotas,
        intervaloHoras: intervalo,
        via,
        duracaoDias,
        observacoes: m.observacoes ? String(m.observacoes) : null,
      };
    });

    return {
      sucesso: true,
      dados: {
        medicamentos: medsForm.length > 0 ? medsForm : [{ nome: '', gotas: 5, intervaloHoras: 8, via: 'sublingual' }],
        validadeDias: 30,
      },
    };
  } catch (err) {
    console.error('[renovarUltimaPrescricao]', err);
    return { sucesso: false, erro: 'Erro ao buscar prescrição anterior' };
  }
}
