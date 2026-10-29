/**
 * O que o responsável vê de UM dependente — ADR-0033, decisão de Dryelle em 29/10/2026.
 *
 * 🔴 TODA função daqui recebe um `pacienteId` e NÃO PROVA o acesso: **quem chama já provou o vínculo** com
 * `garantirResponsavelDoPaciente` (`lib/auth/escopo-do-responsavel.ts`) e passa o `pacienteId` que ELE devolveu,
 * nunca o do cliente. Por isso este módulo não importa `auth`: ele não tem como decidir quem pode ler, e fingir
 * que tem seria uma segunda regra de acesso divergindo da primeira. O guarda
 * `o-responsavel-age-so-por-vinculo-provado` falha se uma página chamar estas funções sem o resolvedor.
 *
 * As consultas são as do painel do paciente (`app/_actions/dashboard-paciente.ts`, `medicamentos-paciente.ts`),
 * trocando a chave `users.clerk_id = <sessão>` por `pacientes.id = <vínculo provado>`: o dependente não tem
 * `clerkId`, e a chave da sessão é a do RESPONSÁVEL. Cada função filtra `deleted_at IS NULL`.
 *
 * ⚠️ Cada lista é de UM paciente: nenhuma junta dependentes. É o que impede "misturar informações" quando o
 * responsável tem vários.
 */
import { and, desc, eq, isNull, sql } from 'drizzle-orm';

import { consultas, documentos, medicos, pacientes, recompras, users } from '@/db/schema';
import { db } from '@/lib/db';

export interface FichaDoDependenteLida {
  nome: string;
  dataNascimento: string | null;
  cpf: string | null;
  rg: string | null;
  genero: string | null;
  cep: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  peso: string | null;
  altura: string | null;
  historicoMedico: string | null;
  patologia: string | null;
  cid: string | null;
  tratamentoTipo: string | null;
  hospitalProximo: string | null;
  homeCare: string | null;
  possuiPlanoSaude: string | null;
  planoSaude: string | null;
  rendaFamilia: string | null;
  temAdvogado: string | null;
  nomeAdvogado: string | null;
  processoJudicializacao: string | null;
  comoConheceu: string | null;
  status: string;
  jornadaFase: string;
  medicoNome: string | null;
}

/**
 * Os dados do dependente que o responsável declarou, mais o andamento. NÃO traz os campos internos da
 * associação (`valorContribuicao`, `termoAssociado`, `categorizacao`…): são da equipe.
 */
export async function obterFichaDoDependente(
  pacienteId: string,
): Promise<FichaDoDependenteLida | null> {
  const medicoUser = db
    .select({ id: medicos.id, nome: users.nome })
    .from(medicos)
    .innerJoin(users, eq(users.id, medicos.userId))
    .as('medico_user');

  const [f] = await db
    .select({
      nome: users.nome,
      dataNascimento: pacientes.dataNascimento,
      cpf: pacientes.cpf,
      rg: pacientes.rg,
      genero: pacientes.genero,
      cep: pacientes.cep,
      endereco: pacientes.endereco,
      cidade: pacientes.cidade,
      uf: pacientes.uf,
      peso: pacientes.peso,
      altura: pacientes.altura,
      historicoMedico: pacientes.historicoMedico,
      patologia: pacientes.patologia,
      cid: pacientes.cid,
      tratamentoTipo: pacientes.tratamentoTipo,
      hospitalProximo: pacientes.hospitalProximo,
      homeCare: pacientes.homeCare,
      possuiPlanoSaude: pacientes.possuiPlanoSaude,
      planoSaude: pacientes.planoSaude,
      rendaFamilia: pacientes.rendaFamilia,
      temAdvogado: pacientes.temAdvogado,
      nomeAdvogado: pacientes.nomeAdvogado,
      processoJudicializacao: pacientes.processoJudicializacao,
      comoConheceu: pacientes.comoConheceu,
      status: pacientes.status,
      jornadaFase: pacientes.jornadaFase,
      medicoNome: medicoUser.nome,
    })
    .from(pacientes)
    .innerJoin(users, eq(users.id, pacientes.userId))
    .leftJoin(medicoUser, eq(medicoUser.id, pacientes.medicoId))
    .where(and(eq(pacientes.id, pacienteId), isNull(pacientes.deletedAt)))
    .limit(1);

  return f ?? null;
}

export interface ResumoDoDependente {
  medicamentoAtivo: {
    tipoCanabinoide: string;
    novaDosagem: string;
    frequencia: string;
    proximaRevisao: string | null;
  } | null;
  proximaConsulta: { dataHora: string; medicoNome: string; status: string } | null;
  totalDocumentos: number;
  autorizacaoAnvisa: { status: string; dataValidade: string | null } | null;
}

/** O resumo do painel de UM dependente: o que vira os cartões de "Jornada de <nome>". */
export async function resumoDoDependente(pacienteId: string): Promise<ResumoDoDependente> {
  const [medicamentoRes, consultaRes, documentosRes, anvisaRes] = await Promise.all([
    db.execute(sql`
      SELECT
        iad.tipo_canabinoide AS "tipoCanabinoide",
        iad.nova_dosagem     AS "novaDosagem",
        iad.frequencia,
        ad.proxima_revisao   AS "proximaRevisao"
      FROM itens_ajuste_dosagem iad
      INNER JOIN ajustes_dosagem ad ON ad.id = iad.ajuste_id
      INNER JOIN pacientes p        ON p.id  = ad.paciente_id
      WHERE p.id = ${pacienteId}
        AND p.deleted_at IS NULL
        AND ad.deleted_at IS NULL
      ORDER BY ad.data_ajuste DESC, iad.created_at DESC
      LIMIT 1
    `),
    db.execute(sql`
      SELECT c.data_hora AS "dataHora", c.status, um.nome AS "medicoNome"
      FROM consultas c
      INNER JOIN medicos m ON m.id = c.medico_id
      INNER JOIN users um  ON um.id = m.user_id
      WHERE c.paciente_id = ${pacienteId}
        AND c.deleted_at IS NULL
        AND c.data_hora >= NOW()
        AND c.status IN ('agendada', 'confirmada')
      ORDER BY c.data_hora ASC
      LIMIT 1
    `),
    db.execute(sql`
      SELECT COUNT(*)::int AS total
      FROM documentos d
      WHERE d.paciente_id = ${pacienteId} AND d.deleted_at IS NULL
    `),
    db.execute(sql`
      SELECT a.status, a.data_validade AS "dataValidade"
      FROM autorizacoes_anvisa a
      WHERE a.paciente_id = ${pacienteId} AND a.deleted_at IS NULL
      ORDER BY a.created_at DESC
      LIMIT 1
    `),
  ]);

  const med = medicamentoRes.rows[0] as ResumoDoDependente['medicamentoAtivo'] | undefined;
  const cons = consultaRes.rows[0] as
    | { dataHora: string | Date; medicoNome: string; status: string }
    | undefined;
  const docs = documentosRes.rows[0] as { total: number } | undefined;
  const anv = anvisaRes.rows[0] as ResumoDoDependente['autorizacaoAnvisa'] | undefined;

  return {
    medicamentoAtivo: med ?? null,
    proximaConsulta: cons
      ? {
          dataHora: new Date(cons.dataHora).toISOString(),
          medicoNome: cons.medicoNome,
          status: cons.status,
        }
      : null,
    totalDocumentos: docs?.total ?? 0,
    autorizacaoAnvisa: anv ?? null,
  };
}

export interface MedicamentoDoDependente {
  id: string;
  tipoCanabinoide: string;
  novaDosagem: string;
  dosagemAnterior: string | null;
  frequencia: string;
  concentracaoTHC: string | null;
  concentracaoCBD: string | null;
  viaAdministracao: string | null;
  dataAjuste: string;
  proximaRevisao: string | null;
  motivoAjuste: string;
}

export async function listarMedicamentosDoDependente(
  pacienteId: string,
): Promise<MedicamentoDoDependente[]> {
  const r = await db.execute(sql`
    SELECT
      iad.id,
      iad.tipo_canabinoide  AS "tipoCanabinoide",
      iad.nova_dosagem      AS "novaDosagem",
      iad.dosagem_anterior  AS "dosagemAnterior",
      iad.frequencia,
      iad.concentracao_thc  AS "concentracaoTHC",
      iad.concentracao_cbd  AS "concentracaoCBD",
      iad.via_administracao AS "viaAdministracao",
      ad.data_ajuste        AS "dataAjuste",
      ad.proxima_revisao    AS "proximaRevisao",
      ad.motivo_ajuste      AS "motivoAjuste"
    FROM itens_ajuste_dosagem iad
    INNER JOIN ajustes_dosagem ad ON ad.id = iad.ajuste_id
    INNER JOIN pacientes p        ON p.id  = ad.paciente_id
    WHERE p.id = ${pacienteId}
      AND p.deleted_at IS NULL
      AND ad.deleted_at IS NULL
    ORDER BY ad.data_ajuste DESC, iad.created_at DESC
  `);
  return r.rows as unknown as MedicamentoDoDependente[];
}

export interface DocumentoDoDependente {
  id: string;
  tipo: string;
  tipoPersonalizado: string | null;
  nomeArquivo: string | null;
  dataEmissao: string;
  dataValidade: string;
}

/**
 * Metadados dos documentos do dependente. NUNCA a URL do arquivo (`urlBlob`): o arquivo abre pela rota
 * autenticada `/api/documentos/{id}/arquivo`, que confere o vínculo (`lib/auth/escopo-documento.ts`).
 */
export async function listarDocumentosDoDependente(
  pacienteId: string,
): Promise<DocumentoDoDependente[]> {
  return db
    .select({
      id: documentos.id,
      tipo: documentos.tipo,
      tipoPersonalizado: documentos.tipoPersonalizado,
      nomeArquivo: documentos.nomeArquivo,
      dataEmissao: documentos.dataEmissao,
      dataValidade: documentos.dataValidade,
    })
    .from(documentos)
    .where(and(eq(documentos.pacienteId, pacienteId), isNull(documentos.deletedAt)))
    .orderBy(desc(documentos.createdAt));
}

export interface RecompraDoDependente {
  id: string;
  medicamentoNome: string | null;
  mlFrasco: number | null;
  gotasPorDia: number | null;
  dataInicioUso: string | null;
  dataPrevista: string;
  status: string;
  criadoEm: Date;
  solicitanteNome: string;
}

/** As solicitações de recompra DESTE dependente (e só dele), com quem as pediu. */
export async function listarRecomprasDoDependente(
  pacienteId: string,
): Promise<RecompraDoDependente[]> {
  return db
    .select({
      id: recompras.id,
      medicamentoNome: recompras.medicamentoNome,
      mlFrasco: recompras.mlFrasco,
      gotasPorDia: recompras.gotasPorDia,
      dataInicioUso: recompras.dataInicioUso,
      dataPrevista: recompras.dataPrevista,
      status: recompras.status,
      criadoEm: recompras.createdAt,
      solicitanteNome: users.nome,
    })
    .from(recompras)
    .innerJoin(users, eq(users.id, recompras.solicitanteId))
    .where(eq(recompras.pacienteId, pacienteId))
    .orderBy(desc(recompras.createdAt));
}

export interface ConsultaDoDependente {
  id: string;
  dataHora: Date;
  status: string;
  medicoNome: string;
}

export async function listarConsultasDoDependente(
  pacienteId: string,
): Promise<ConsultaDoDependente[]> {
  return db
    .select({
      id: consultas.id,
      dataHora: consultas.dataHora,
      status: consultas.status,
      medicoNome: users.nome,
    })
    .from(consultas)
    .innerJoin(medicos, eq(medicos.id, consultas.medicoId))
    .innerJoin(users, eq(users.id, medicos.userId))
    .where(and(eq(consultas.pacienteId, pacienteId), isNull(consultas.deletedAt)))
    .orderBy(desc(consultas.dataHora));
}
