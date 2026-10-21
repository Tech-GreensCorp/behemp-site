'use server';

/**
 * CONDUTA, DOSAGEM E TITULAÇÃO — o caminho novo da Sprint 5.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * A cadeia `conduta -> {prescrição, dosagem} -> titulação` já tinha metade implementada, em duas
 * representações que não se falavam, e essa metade violava três rejeitados da
 * [ADR-0005](../../../docs/adr/ADR-0005-a-cadeia-conduta-prescricao-dosagem-titulacao.md).
 * Os cinco defeitos estão medidos com `caminho:linha` em `docs/04-LISTA-DE-AFAZERES.md` Item 13.
 *
 * 🛑 NENHUM DELES É CORRIGIDO AQUI. Este arquivo é o caminho NOVO, e o que ele garante é não
 * repetir nenhum. Desenho em
 * [ADR-0012](../../../docs/adr/ADR-0012-o-sistema-avisa-o-medico-decide-na-cadeia-da-conduta.md).
 *
 * AS QUATRO REGRAS QUE ESTE ARQUIVO CUMPRE, E O GUARDA COBRA
 * 1. 🔴 ESCOPO DE OBJETO em toda função. Papel certo + `pacienteId` alheio é OWASP API1 (BOLA).
 *    O helper é `lib/auth/escopo-paciente.ts` — importado, nunca copiado (R-10).
 * 2. 🔴 NADA SOBRESCREVE O ANTERIOR. Ajustar dose é `insert` de linha nova + desativação da
 *    anterior, nunca `UPDATE` em `gotasPorDia` (R-03) e nunca `delete` de item de histórico.
 * 3. 🔴 O SISTEMA AVISA, O MÉDICO DECIDE (`DO-46`, `DO-47`). O tipo de receituário é calculado
 *    a partir do teor que o MÉDICO informou, entra como **aviso**, e o que ele decidiu vai para
 *    a auditoria — inclusive quando decide diferente.
 * 4. 🔴 TODO AJUSTE NOTIFICA O PACIENTE (`DO-44` b).
 *
 * 🛑 O QUE ESTE ARQUIVO NÃO FAZ: não escreve em `prescricoes`, não importa `lib/receituario/`,
 * não toca em assinatura nem em SNCR. A ponte para a prescrição é ADR-0005 D-04 — PREENCHE e
 * entrega ao fluxo existente, sem alterá-lo.
 */

import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import {
  ajustesDosagem,
  dosagens,
  itensAjusteDosagem,
  medicamentos,
  notificacoes,
  pacientes,
  users,
} from '@/db/schema';
import { db } from '@/lib/db';
import { garantirMedicoDoPaciente } from '@/lib/auth/escopo-paciente';
import { obterUsuarioAtual } from '@/lib/auth/permissions';
import { calcularDoseDiaria } from '@/lib/conduta/dose';
import {
  montarRascunhoDePrescricao,
  type RascunhoDePrescricao,
} from '@/lib/conduta/ponte-prescricao';
import { avisoDeReceituario, avisoDeTrocaDeFaixa, normalizarTeor } from '@/lib/conduta/receituario';
import { falha, ok, type ResultadoAction } from '@/lib/conduta/resultado';
import { calcularDosagem } from '@/lib/utils/dosagem';
import { registrarAuditoria } from '@/lib/utils/audit';

// ═══════════════════════════════════════════════════════════════════════════════
// TIPOS PÚBLICOS
// ═══════════════════════════════════════════════════════════════════════════════

export interface ProdutoDoCatalogo {
  id: string;
  nome: string;
  marca: string | null;
  gotasPorMl: number;
  cbdMgPorGota: string | null;
  thcMgPorGota: string | null;
  /** `null` enquanto o catálogo não tiver o teor (`DO-46`) — e a tela DIZ que não sabe. */
  teorThcPercentual: string | null;
  tipoEspectro: string | null;
}

export interface PlanoVigente {
  dosagemId: string;
  medicamentoId: string;
  medicamentoNome: string;
  marca: string | null;
  gotasPorDia: number;
  mlFrasco: number;
  dataInicio: string;
  dataFimPrevista: string;
  /** Calculado, nunca persistido — ADR-0004 D-06. */
  cbdMgPorDia: number | null;
  thcMgPorDia: number | null;
  teorThcPercentual: string | null;
}

export interface PassoDaTitulacao {
  ajusteId: string;
  dataAjuste: string;
  proximaRevisao: string | null;
  motivoAjuste: string;
  medicamentoNome: string | null;
  dosagemAnterior: string | null;
  novaDosagem: string;
  frequencia: string;
  viaAdministracao: string | null;
  /** `true` para as linhas anteriores à Sprint 5, que não têm FK (`DO-48`). */
  legado: boolean;
}

export interface TitulacaoDoPaciente {
  pacienteId: string;
  pacienteNome: string | null;
  planosVigentes: PlanoVigente[];
  curva: PassoDaTitulacao[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDAÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * O teor chega como texto porque é o que o médico digita, com vírgula decimal. `normalizarTeor`
 * transforma em número ou em `null` — e `null` é um estado legítimo, não erro (`DO-46`).
 */
const teorSchema = z.string().max(16).optional().nullable();

const condutaSchema = z.object({
  pacienteId: z.string().min(1).max(64),
  medicamentoId: z.string().min(1).max(64),
  gotasPorDia: z.number().int().min(1, 'A dose deve ser de ao menos 1 gota').max(200),
  mlFrasco: z.number().int().min(1).max(1000),
  dataInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data inválida'),
  frequencia: z.string().min(1, 'Informe a frequência').max(120),
  viaAdministracao: z.enum(['sublingual', 'oral', 'topica']),
  teorThcInformado: teorSchema,
  observacoes: z.string().max(2000).optional().nullable(),
});

const ajusteSchema = z.object({
  pacienteId: z.string().min(1).max(64),
  /** A dosagem que este ajuste encerra. Opcional: o primeiro ajuste pode não ter antecessora. */
  dosagemAnteriorId: z.string().min(1).max(64).optional().nullable(),
  medicamentoId: z.string().min(1).max(64),
  gotasPorDia: z.number().int().min(1).max(200),
  mlFrasco: z.number().int().min(1).max(1000),
  dataAjuste: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data inválida'),
  proximaRevisao: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  motivoAjuste: z.string().min(3, 'O motivo do ajuste é obrigatório').max(2000),
  frequencia: z.string().min(1, 'Informe a frequência').max(120),
  viaAdministracao: z.enum(['sublingual', 'oral', 'topica']),
  teorThcInformado: teorSchema,
  /**
   * O que o médico decidiu sobre gerar prescrição nova. É `DO-47`: a tela PERGUNTA, não impõe —
   * e o que ele respondeu fica na auditoria, inclusive quando responde "não" diante do aviso.
   */
  gerarPrescricaoNova: z.boolean().default(false),
});

// ═══════════════════════════════════════════════════════════════════════════════
// CATÁLOGO
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Catálogo para a tela de conduta. Traz `teorThcPercentual` — que hoje vem **vazio** e é o
 * campo que o médico preenche (`DO-46`).
 */
export async function listarCatalogoDeProdutos(): Promise<ResultadoAction<ProdutoDoCatalogo[]>> {
  const perm = await obterUsuarioAtual();
  if (!perm.autorizado) return falha('Não autenticado');

  try {
    const linhas = await db
      .select({
        id: medicamentos.id,
        nome: medicamentos.nome,
        marca: medicamentos.marca,
        gotasPorMl: medicamentos.gotasPorMl,
        cbdMgPorGota: medicamentos.cbdMgPorGota,
        thcMgPorGota: medicamentos.thcMgPorGota,
        teorThcPercentual: medicamentos.teorThcPercentual,
        tipoEspectro: medicamentos.tipoEspectro,
      })
      .from(medicamentos)
      .where(eq(medicamentos.ativo, true))
      .orderBy(medicamentos.nome);

    return ok(linhas as ProdutoDoCatalogo[]);
  } catch (erro) {
    console.error('[conduta] listarCatalogoDeProdutos', erro);
    return falha('Erro ao carregar o catálogo');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CRIAR CONDUTA — entregável 1 e 4
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Registra o plano terapêutico inicial: cria `dosagens` com `medicamentoId` REAL (D-05) e
 * desativa a anterior do mesmo paciente + medicamento.
 *
 * Não gera prescrição. A ponte é passo separado e explícito — ADR-0005 D-04.
 */
export async function criarConduta(
  entrada: z.infer<typeof condutaSchema>,
): Promise<ResultadoAction<{ dosagemId: string; avisoReceituario: string }>> {
  const parsed = condutaSchema.safeParse(entrada);
  if (!parsed.success) return falha(parsed.error.errors[0]?.message ?? 'Dados inválidos');
  const d = parsed.data;

  const escopo = await garantirMedicoDoPaciente(d.pacienteId);
  if (!escopo.ok) return falha(escopo.erro);

  try {
    const [produto] = await db
      .select({
        id: medicamentos.id,
        nome: medicamentos.nome,
        gotasPorMl: medicamentos.gotasPorMl,
        teorCatalogo: medicamentos.teorThcPercentual,
      })
      .from(medicamentos)
      .where(eq(medicamentos.id, d.medicamentoId))
      .limit(1);
    if (!produto) return falha('Produto não encontrado no catálogo');

    // O teor que vale é o que o médico informou; o do catálogo é só o pré-preenchimento.
    const teorEfetivo = normalizarTeor(d.teorThcInformado) ?? normalizarTeor(produto.teorCatalogo);
    const aviso = avisoDeReceituario(teorEfetivo);

    const calculo = calcularDosagem({
      mlFrasco: d.mlFrasco,
      gotasPorDia: d.gotasPorDia,
      gotasPorMl: produto.gotasPorMl,
      dataInicio: new Date(`${d.dataInicio}T00:00:00`),
    });

    // Desativa a anterior — não apaga. Uma `ativa = true` por paciente + medicamento.
    await db
      .update(dosagens)
      .set({ ativa: false })
      .where(
        and(
          eq(dosagens.pacienteId, escopo.escopo.pacienteId),
          eq(dosagens.medicamentoId, d.medicamentoId),
          eq(dosagens.ativa, true),
        ),
      );

    const [nova] = await db
      .insert(dosagens)
      .values({
        pacienteId: escopo.escopo.pacienteId,
        medicamentoId: d.medicamentoId,
        gotasPorDia: d.gotasPorDia,
        mlFrasco: d.mlFrasco,
        dataInicio: d.dataInicio,
        dataFimPrevista: calculo.dataFimPrevista.toISOString().slice(0, 10),
        ativa: true,
      })
      .returning({ id: dosagens.id });
    if (!nova?.id) return falha('Falha ao registrar a conduta');

    // O que o sistema AVISOU e o que o médico DECIDIU — proibição nº 2 do CLAUDE.md.
    await registrarAuditoria({
      userId: escopo.escopo.userId,
      acao: 'criar',
      entidade: 'dosagens',
      entidadeId: nova.id,
      dadosDepois: {
        pacienteId: escopo.escopo.pacienteId,
        medicamentoId: d.medicamentoId,
        gotasPorDia: d.gotasPorDia,
        teorThcInformado: d.teorThcInformado ?? null,
        tipoReceituarioAvisado: aviso.tipo,
        fundamento: aviso.fundamento,
        viaAdmin: escopo.escopo.viaAdmin,
      },
    });

    revalidatePath(`/medico/pacientes/${escopo.escopo.pacienteId}`);
    revalidatePath('/medico/titulacao');

    return ok({ dosagemId: nova.id, avisoReceituario: aviso.rotulo });
  } catch (erro) {
    console.error('[conduta] criarConduta', erro);
    return falha('Erro ao registrar a conduta');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// AJUSTAR DOSE — entregáveis 5, 11 e 12
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Ajusta a dose: cria linha nova em `dosagens`, registra o ato em `ajustesDosagem` com as FKs
 * dos dois lados, notifica o paciente e audita.
 *
 * 🔴 O anterior NUNCA é sobrescrito — nem a dosagem (`ativa = false`, não `UPDATE` na dose),
 * nem o ajuste (nenhum `delete`).
 */
export async function ajustarDose(
  entrada: z.infer<typeof ajusteSchema>,
): Promise<ResultadoAction<{ ajusteId: string; dosagemId: string; aviso: string }>> {
  const parsed = ajusteSchema.safeParse(entrada);
  if (!parsed.success) return falha(parsed.error.errors[0]?.message ?? 'Dados inválidos');
  const d = parsed.data;

  const escopo = await garantirMedicoDoPaciente(d.pacienteId);
  if (!escopo.ok) return falha(escopo.erro);

  try {
    const [produto] = await db
      .select({
        id: medicamentos.id,
        nome: medicamentos.nome,
        gotasPorMl: medicamentos.gotasPorMl,
        teorCatalogo: medicamentos.teorThcPercentual,
      })
      .from(medicamentos)
      .where(eq(medicamentos.id, d.medicamentoId))
      .limit(1);
    if (!produto) return falha('Produto não encontrado no catálogo');

    // A dosagem que sai — precisa ser DESTE paciente. Escopo de objeto também aqui: o
    // `dosagemAnteriorId` vem do cliente.
    let anterior: { id: string; gotasPorDia: number; medicamentoId: string } | undefined;
    if (d.dosagemAnteriorId) {
      [anterior] = await db
        .select({
          id: dosagens.id,
          gotasPorDia: dosagens.gotasPorDia,
          medicamentoId: dosagens.medicamentoId,
        })
        .from(dosagens)
        .where(
          and(
            eq(dosagens.id, d.dosagemAnteriorId),
            eq(dosagens.pacienteId, escopo.escopo.pacienteId),
          ),
        )
        .limit(1);
      if (!anterior) return falha('Dosagem anterior não encontrada');
    }

    // O aviso de troca de faixa (`DO-47`) — avisa, não impede.
    let teorAnterior: string | null = null;
    if (anterior && anterior.medicamentoId !== d.medicamentoId) {
      const [produtoAnterior] = await db
        .select({ teor: medicamentos.teorThcPercentual })
        .from(medicamentos)
        .where(eq(medicamentos.id, anterior.medicamentoId))
        .limit(1);
      teorAnterior = produtoAnterior?.teor ?? null;
    }
    const teorEfetivo = normalizarTeor(d.teorThcInformado) ?? normalizarTeor(produto.teorCatalogo);
    const troca = avisoDeTrocaDeFaixa(teorAnterior, teorEfetivo);
    const aviso = avisoDeReceituario(teorEfetivo);

    const calculo = calcularDosagem({
      mlFrasco: d.mlFrasco,
      gotasPorDia: d.gotasPorDia,
      gotasPorMl: produto.gotasPorMl,
      dataInicio: new Date(`${d.dataAjuste}T00:00:00`),
    });

    // 1) desativa a anterior — não apaga, não reescreve a dose
    await db
      .update(dosagens)
      .set({ ativa: false })
      .where(
        and(
          eq(dosagens.pacienteId, escopo.escopo.pacienteId),
          eq(dosagens.medicamentoId, d.medicamentoId),
          eq(dosagens.ativa, true),
        ),
      );

    // 2) a dosagem nova
    const [nova] = await db
      .insert(dosagens)
      .values({
        pacienteId: escopo.escopo.pacienteId,
        medicamentoId: d.medicamentoId,
        gotasPorDia: d.gotasPorDia,
        mlFrasco: d.mlFrasco,
        dataInicio: d.dataAjuste,
        dataFimPrevista: calculo.dataFimPrevista.toISOString().slice(0, 10),
        ativa: true,
      })
      .returning({ id: dosagens.id });
    if (!nova?.id) return falha('Falha ao registrar a dose nova');

    // 3) o ATO de ajustar, com motivo e próxima revisão
    const [ajuste] = await db
      .insert(ajustesDosagem)
      .values({
        pacienteId: escopo.escopo.pacienteId,
        dataAjuste: d.dataAjuste,
        proximaRevisao: d.proximaRevisao ?? null,
        motivoAjuste: d.motivoAjuste,
        criadoPor: escopo.escopo.medicoId,
      })
      .returning({ id: ajustesDosagem.id });
    if (!ajuste?.id) return falha('Falha ao registrar o ajuste');

    await db.insert(itensAjusteDosagem).values({
      ajusteId: ajuste.id,
      tipoCanabinoide: produto.nome,
      novaDosagem: `${d.gotasPorDia} gotas/dia`,
      dosagemAnterior: anterior ? `${anterior.gotasPorDia} gotas/dia` : null,
      frequencia: d.frequencia,
      viaAdministracao: d.viaAdministracao,
      concentracaoTHC: d.teorThcInformado ?? produto.teorCatalogo ?? null,
      // As FKs que ligam as duas cadeias (ADR-0012 D-01):
      medicamentoId: d.medicamentoId,
      dosagemAnteriorId: anterior?.id ?? null,
      novaDosagemId: nova.id,
    });

    // 4) o paciente é notificado — `DO-44` (b), sem exceção
    const [paciente] = await db
      .select({ userId: pacientes.userId })
      .from(pacientes)
      .where(eq(pacientes.id, escopo.escopo.pacienteId))
      .limit(1);

    if (paciente?.userId) {
      await db
        .insert(notificacoes)
        .values({
          userId: paciente.userId,
          tipo: 'geral',
          titulo: 'Sua dose foi ajustada',
          mensagem:
            `O seu médico ajustou a dose de ${produto.nome} para ${d.gotasPorDia} gotas por dia. ` +
            (d.proximaRevisao ? 'A próxima revisão já está marcada. ' : '') +
            'Abra o seu acompanhamento para ver os detalhes.',
          linkAcao: '/paciente/medicamentos',
        })
        .catch((e) => console.error('[conduta] notificação do ajuste', e));
    }

    // 5) auditoria: o que o sistema avisou, e o que o médico decidiu diante do aviso
    await registrarAuditoria({
      userId: escopo.escopo.userId,
      acao: 'atualizar',
      entidade: 'ajustes_dosagem',
      entidadeId: ajuste.id,
      dadosAntes: anterior
        ? {
            dosagemId: anterior.id,
            gotasPorDia: anterior.gotasPorDia,
            medicamentoId: anterior.medicamentoId,
          }
        : undefined,
      dadosDepois: {
        dosagemId: nova.id,
        gotasPorDia: d.gotasPorDia,
        medicamentoId: d.medicamentoId,
        motivoAjuste: d.motivoAjuste,
        teorThcInformado: d.teorThcInformado ?? null,
        tipoReceituarioAvisado: aviso.tipo,
        mudouDeFaixaDeThc: troca.mudouDeFaixa,
        avisoMostrado: troca.mensagem || null,
        // `DO-47`: a decisão é do médico, e fica registrada mesmo quando ele decide NÃO gerar
        // prescrição nova diante de um aviso de troca de faixa.
        medicoOptouPorPrescricaoNova: d.gerarPrescricaoNova,
        viaAdmin: escopo.escopo.viaAdmin,
      },
    });

    revalidatePath(`/medico/pacientes/${escopo.escopo.pacienteId}`);
    revalidatePath('/medico/titulacao');

    return ok({ ajusteId: ajuste.id, dosagemId: nova.id, aviso: troca.mensagem });
  } catch (erro) {
    console.error('[conduta] ajustarDose', erro);
    return falha('Erro ao ajustar a dose');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEITURA — entregável 6 (a curva) e `DO-44` (c)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Plano vigente + curva de titulação de UM paciente. É a visão padrão (`DO-44` c).
 *
 * A curva inclui as linhas legadas, em texto livre, marcadas com `legado: true` — o `DO-48`
 * manda preservá-las, e escondê-las seria perder o histórico na prática.
 */
export async function listarTitulacaoDoPaciente(
  pacienteId: string,
): Promise<ResultadoAction<TitulacaoDoPaciente>> {
  const escopo = await garantirMedicoDoPaciente(pacienteId);
  if (!escopo.ok) return falha(escopo.erro);

  try {
    const [paciente] = await db
      .select({ nome: users.nome })
      .from(pacientes)
      .innerJoin(users, eq(pacientes.userId, users.id))
      .where(eq(pacientes.id, escopo.escopo.pacienteId))
      .limit(1);

    const vigentes = await db
      .select({
        dosagemId: dosagens.id,
        medicamentoId: dosagens.medicamentoId,
        medicamentoNome: medicamentos.nome,
        marca: medicamentos.marca,
        gotasPorDia: dosagens.gotasPorDia,
        mlFrasco: dosagens.mlFrasco,
        dataInicio: dosagens.dataInicio,
        dataFimPrevista: dosagens.dataFimPrevista,
        cbdMgPorGota: medicamentos.cbdMgPorGota,
        thcMgPorGota: medicamentos.thcMgPorGota,
        teorThcPercentual: medicamentos.teorThcPercentual,
      })
      .from(dosagens)
      .innerJoin(medicamentos, eq(dosagens.medicamentoId, medicamentos.id))
      .where(and(eq(dosagens.pacienteId, escopo.escopo.pacienteId), eq(dosagens.ativa, true)))
      .orderBy(desc(dosagens.dataInicio));

    const planosVigentes: PlanoVigente[] = vigentes.map((v) => {
      const dose = calcularDoseDiaria({
        gotasPorDia: v.gotasPorDia,
        cbdMgPorGota: v.cbdMgPorGota,
        thcMgPorGota: v.thcMgPorGota,
      });
      return {
        dosagemId: v.dosagemId,
        medicamentoId: v.medicamentoId,
        medicamentoNome: v.medicamentoNome,
        marca: v.marca,
        gotasPorDia: v.gotasPorDia,
        mlFrasco: v.mlFrasco,
        dataInicio: v.dataInicio,
        dataFimPrevista: v.dataFimPrevista,
        cbdMgPorDia: dose.cbdMgPorDia,
        thcMgPorDia: dose.thcMgPorDia,
        teorThcPercentual: v.teorThcPercentual,
      };
    });

    const curva = await carregarCurva([escopo.escopo.pacienteId]);

    return ok({
      pacienteId: escopo.escopo.pacienteId,
      pacienteNome: paciente?.nome ?? null,
      planosVigentes,
      curva,
    });
  } catch (erro) {
    console.error('[conduta] listarTitulacaoDoPaciente', erro);
    return falha('Erro ao carregar a titulação');
  }
}

/**
 * A visão GERAL — `DO-44` (c): _"além de ter o filtro de geral aonde vê todos os medicamentos
 * prescritos"_. É filtro, não a tela inicial.
 *
 * Só traz pacientes DESTE médico: o `where` por `medicoId` é o escopo de objeto na forma de
 * lista — não há id vindo do cliente para conferir, então a conjunção é a própria consulta.
 */
export async function listarTitulacaoGeral(): Promise<
  ResultadoAction<
    Array<{
      pacienteId: string;
      pacienteNome: string | null;
      medicamentoNome: string;
      gotasPorDia: number;
      cbdMgPorDia: number | null;
      dataInicio: string;
      dataFimPrevista: string;
      teorThcPercentual: string | null;
    }>
  >
> {
  const perm = await obterUsuarioAtual();
  if (!perm.autorizado || !perm.clerkId) return falha('Não autenticado');

  try {
    const [user] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.clerkId, perm.clerkId))
      .limit(1);
    if (!user) return falha('Usuário não encontrado');
    if (user.role !== 'medico' && user.role !== 'admin') return falha('Acesso restrito ao médico');

    const escopoPacientes = db
      .select({ id: pacientes.id })
      .from(pacientes)
      .where(
        user.role === 'admin'
          ? isNull(pacientes.deletedAt)
          : and(
              isNull(pacientes.deletedAt),
              eq(
                pacientes.medicoId,
                sql`(select id from medicos where user_id = ${user.id} limit 1)`,
              ),
            ),
      );

    const linhas = await db
      .select({
        pacienteId: dosagens.pacienteId,
        pacienteNome: users.nome,
        medicamentoNome: medicamentos.nome,
        gotasPorDia: dosagens.gotasPorDia,
        cbdMgPorGota: medicamentos.cbdMgPorGota,
        dataInicio: dosagens.dataInicio,
        dataFimPrevista: dosagens.dataFimPrevista,
        teorThcPercentual: medicamentos.teorThcPercentual,
      })
      .from(dosagens)
      .innerJoin(medicamentos, eq(dosagens.medicamentoId, medicamentos.id))
      .innerJoin(pacientes, eq(dosagens.pacienteId, pacientes.id))
      .innerJoin(users, eq(pacientes.userId, users.id))
      .where(and(eq(dosagens.ativa, true), inArray(dosagens.pacienteId, escopoPacientes)))
      .orderBy(users.nome, desc(dosagens.dataInicio));

    return ok(
      linhas.map((l) => ({
        pacienteId: l.pacienteId,
        pacienteNome: l.pacienteNome,
        medicamentoNome: l.medicamentoNome,
        gotasPorDia: l.gotasPorDia,
        cbdMgPorDia: calcularDoseDiaria({
          gotasPorDia: l.gotasPorDia,
          cbdMgPorGota: l.cbdMgPorGota,
        }).cbdMgPorDia,
        dataInicio: l.dataInicio,
        dataFimPrevista: l.dataFimPrevista,
        teorThcPercentual: l.teorThcPercentual,
      })),
    );
  } catch (erro) {
    console.error('[conduta] listarTitulacaoGeral', erro);
    return falha('Erro ao carregar a visão geral');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// A PONTE PARA A PRESCRIÇÃO — entregável 3 (ADR-0005 D-04)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Monta o rascunho da prescrição a partir de um plano vigente. **NÃO cria nada.**
 *
 * ADR-0005 D-04: a conduta *preenche* e entrega ao fluxo existente. Quem grava é a
 * `criarPrescricao` de `app/(medico)/_actions/prescricoes.ts`, que já cuida de validade,
 * desbloqueio ANVISA e notificação — e que não é alterada aqui (rejeitado R-06: é ICP-Brasil
 * em produção).
 *
 * 🔴 DEVOLVER SEM GRAVAR É O PONTO. Entre a conduta e o documento legal existe um passo humano:
 * o médico vê o que vai ser prescrito, confere o tipo de receituário e confirma. Um caminho que
 * emitisse direto seria o "um clique" que a proibição nº 2 do `CLAUDE.md` veda.
 */
export async function prepararPrescricaoDaConduta(
  dosagemId: string,
): Promise<ResultadoAction<RascunhoDePrescricao & { pacienteId: string }>> {
  const perm = await obterUsuarioAtual();
  if (!perm.autorizado) return falha('Não autenticado');

  try {
    // O `dosagemId` vem do cliente: descobre-se o paciente por ele e PROVA-SE o escopo depois.
    const [linha] = await db
      .select({
        pacienteId: dosagens.pacienteId,
        gotasPorDia: dosagens.gotasPorDia,
        mlFrasco: dosagens.mlFrasco,
        nome: medicamentos.nome,
        gotasPorMl: medicamentos.gotasPorMl,
        teorThcPercentual: medicamentos.teorThcPercentual,
      })
      .from(dosagens)
      .innerJoin(medicamentos, eq(dosagens.medicamentoId, medicamentos.id))
      .where(eq(dosagens.id, dosagemId))
      .limit(1);
    if (!linha) return falha('Plano não encontrado');

    const escopo = await garantirMedicoDoPaciente(linha.pacienteId);
    if (!escopo.ok) return falha(escopo.erro);

    const rascunho = montarRascunhoDePrescricao({
      medicamentoNome: linha.nome,
      gotasPorDia: linha.gotasPorDia,
      mlFrasco: linha.mlFrasco,
      gotasPorMl: linha.gotasPorMl,
      frequencia: '',
      viaAdministracao: 'sublingual',
      teorThcPercentual: linha.teorThcPercentual,
    });

    return ok({ ...rascunho, pacienteId: escopo.escopo.pacienteId });
  } catch (erro) {
    console.error('[conduta] prepararPrescricaoDaConduta', erro);
    return falha('Erro ao preparar a prescrição');
  }
}

/**
 * Os ajustes de dose do paciente, para a SEGUNDA superfície do `DO-44` (b): *"a dosagem ou
 * medicamento anterior tem que ficar no historico tanto do paciente quanto no historico de
 * prescrições dentro do nome do paciente"*.
 *
 * É a MESMA origem da curva da aba de dosagem — nenhuma cópia. Duas telas lendo a mesma tabela
 * não divergem; duas telas com cópias divergem na primeira correção.
 */
export async function listarAjustesParaPrescricoes(
  pacienteId: string,
): Promise<ResultadoAction<PassoDaTitulacao[]>> {
  const escopo = await garantirMedicoDoPaciente(pacienteId);
  if (!escopo.ok) return falha(escopo.erro);

  try {
    return ok(await carregarCurva([escopo.escopo.pacienteId]));
  } catch (erro) {
    console.error('[conduta] listarAjustesParaPrescricoes', erro);
    return falha('Erro ao carregar o histórico de ajustes');
  }
}

/** A curva de titulação, com as linhas legadas marcadas. */
async function carregarCurva(pacienteIds: string[]): Promise<PassoDaTitulacao[]> {
  if (pacienteIds.length === 0) return [];

  const linhas = await db
    .select({
      ajusteId: ajustesDosagem.id,
      dataAjuste: ajustesDosagem.dataAjuste,
      proximaRevisao: ajustesDosagem.proximaRevisao,
      motivoAjuste: ajustesDosagem.motivoAjuste,
      itemId: itensAjusteDosagem.id,
      medicamentoId: itensAjusteDosagem.medicamentoId,
      tipoCanabinoide: itensAjusteDosagem.tipoCanabinoide,
      novaDosagem: itensAjusteDosagem.novaDosagem,
      dosagemAnterior: itensAjusteDosagem.dosagemAnterior,
      frequencia: itensAjusteDosagem.frequencia,
      viaAdministracao: itensAjusteDosagem.viaAdministracao,
      medicamentoNome: medicamentos.nome,
    })
    .from(ajustesDosagem)
    .innerJoin(itensAjusteDosagem, eq(itensAjusteDosagem.ajusteId, ajustesDosagem.id))
    .leftJoin(medicamentos, eq(itensAjusteDosagem.medicamentoId, medicamentos.id))
    .where(and(inArray(ajustesDosagem.pacienteId, pacienteIds), isNull(ajustesDosagem.deletedAt)))
    .orderBy(desc(ajustesDosagem.dataAjuste));

  return linhas.map((l) => ({
    ajusteId: l.ajusteId,
    dataAjuste: l.dataAjuste,
    proximaRevisao: l.proximaRevisao,
    motivoAjuste: l.motivoAjuste,
    // Sem `medicamentoId` a linha veio do caminho antigo, em texto livre: o nome do produto é o
    // que estiver em `tipoCanabinoide`, que era campo livre.
    medicamentoNome: l.medicamentoNome ?? l.tipoCanabinoide ?? null,
    dosagemAnterior: l.dosagemAnterior,
    novaDosagem: l.novaDosagem,
    frequencia: l.frequencia,
    viaAdministracao: l.viaAdministracao,
    legado: l.medicamentoId === null,
  }));
}
