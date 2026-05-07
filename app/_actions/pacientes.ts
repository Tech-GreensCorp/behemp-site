'use server';

import { db } from '@/lib/db';
import { users, pacientes, medicos } from '@/db/schema';
import { eq, and, isNull, ilike, desc, sql } from 'drizzle-orm';
import { z } from 'zod';
import { verificarMedicoOuAdmin } from '@/lib/auth';

/**
 * Server Actions de pacientes.
 * Todas as mutations validam role (medico ou admin).
 */

// ── Schemas ───────────────────────────────────────────────────

const criarPacienteSchema = z.object({
  // Dados pessoais
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('E-mail inválido'),
  telefone: z.string().optional(),
  dataNascimento: z.string().optional(),
  cpf: z.string().optional(),
  rg: z.string().optional(),
  genero: z.string().optional(),
  // Endereço
  cep: z.string().optional(),
  endereco: z.string().optional(),
  cidade: z.string().optional(),
  uf: z.string().optional(),
  // Dados clínicos
  peso: z.string().optional(),
  altura: z.string().optional(),
  historicoMedico: z.string().optional(),
  patologia: z.string().optional(),
  // Dados da associação
  atendimento: z.string().optional(),
  temAdvogado: z.string().optional(),
  nomeAdvogado: z.string().optional(),
  cid: z.string().optional(),
  categorizacao: z.string().optional(),
  comoConheceu: z.string().optional(),
  dataAssociacao: z.string().optional(),
  entradaPaciente: z.string().optional(),
  etapa: z.string().optional(),
  hospitalProximo: z.string().optional(),
  homeCare: z.string().optional(),
  planoSaude: z.string().optional(),
  possuiPlanoSaude: z.string().optional(),
  rendaFamilia: z.string().optional(),
  termoAssociado: z.string().optional(),
  valorContribuicao: z.string().optional(),
  processoJudicializacao: z.string().optional(),
  // Responsável
  responsavelNome: z.string().optional(),
  responsavelCpf: z.string().optional(),
  // Tratamento
  tratamentoTipo: z.enum(['cbd', 'thc', 'cbd_thc']).optional(),
});

const atualizarPacienteSchema = criarPacienteSchema.partial().extend({
  pacienteId: z.string().min(1, 'ID do paciente é obrigatório'),
  status: z.enum(['aguardando_consulta', 'em_tratamento', 'concluido', 'arquivado']).optional(),
});

// ── Types ─────────────────────────────────────────────────────

interface ActionResult<T = unknown> {
  sucesso: boolean;
  dados?: T;
  erro?: string;
}

// ── Actions ───────────────────────────────────────────────────

/**
 * Cria um novo paciente vinculado ao médico autenticado.
 * Cria também um user base para o paciente.
 */
export async function criarPaciente(
  dados: z.infer<typeof criarPacienteSchema>,
): Promise<ActionResult<{ pacienteId: string }>> {
  try {
    const auth = await verificarMedicoOuAdmin();
    if (!auth.autorizado) {
      return { sucesso: false, erro: auth.erro };
    }

    const parsed = criarPacienteSchema.safeParse(dados);
    if (!parsed.success) {
      return { sucesso: false, erro: parsed.error.errors[0].message };
    }

    // Verificar se já existe user com esse e-mail
    const [userExistente] = await db
      .select()
      .from(users)
      .where(eq(users.email, parsed.data.email))
      .limit(1);

    let userId: string;

    if (userExistente) {
      userId = userExistente.id;
    } else {
      // Cria user base para o paciente
      const [novoUser] = await db
        .insert(users)
        .values({
          email: parsed.data.email,
          nome: parsed.data.nome,
          role: 'paciente',
          telefone: parsed.data.telefone,
        })
        .returning({ id: users.id });
      userId = novoUser.id;
    }

    // Buscar medicoId do usuário autenticado
    const medicoId = await obterMedicoIdDoUsuario(auth.clerkId!);

    // Criar paciente
    const [novoPaciente] = await db
      .insert(pacientes)
      .values({
        userId,
        medicoId,
        dataNascimento: parsed.data.dataNascimento,
        cpf: parsed.data.cpf,
        rg: parsed.data.rg,
        genero: parsed.data.genero,
        cep: parsed.data.cep,
        endereco: parsed.data.endereco,
        cidade: parsed.data.cidade,
        uf: parsed.data.uf,
        peso: parsed.data.peso,
        altura: parsed.data.altura,
        historicoMedico: parsed.data.historicoMedico,
        patologia: parsed.data.patologia,
        atendimento: parsed.data.atendimento,
        temAdvogado: parsed.data.temAdvogado,
        nomeAdvogado: parsed.data.nomeAdvogado,
        cid: parsed.data.cid,
        categorizacao: parsed.data.categorizacao,
        comoConheceu: parsed.data.comoConheceu,
        dataAssociacao: parsed.data.dataAssociacao,
        entradaPaciente: parsed.data.entradaPaciente,
        etapa: parsed.data.etapa,
        hospitalProximo: parsed.data.hospitalProximo,
        homeCare: parsed.data.homeCare,
        planoSaude: parsed.data.planoSaude,
        possuiPlanoSaude: parsed.data.possuiPlanoSaude,
        rendaFamilia: parsed.data.rendaFamilia,
        termoAssociado: parsed.data.termoAssociado,
        valorContribuicao: parsed.data.valorContribuicao,
        processoJudicializacao: parsed.data.processoJudicializacao,
        responsavelNome: parsed.data.responsavelNome,
        responsavelCpf: parsed.data.responsavelCpf,
        tratamentoTipo: parsed.data.tratamentoTipo,
        status: 'aguardando_consulta',
      })
      .returning({ id: pacientes.id });

    return { sucesso: true, dados: { pacienteId: novoPaciente.id } };
  } catch (error) {
    console.error('[Action] Erro ao criar paciente:', error);
    return { sucesso: false, erro: 'Erro ao criar paciente' };
  }
}

/**
 * Atualiza dados de um paciente existente.
 */
export async function atualizarPaciente(
  dados: z.infer<typeof atualizarPacienteSchema>,
): Promise<ActionResult> {
  try {
    const auth = await verificarMedicoOuAdmin();
    if (!auth.autorizado) {
      return { sucesso: false, erro: auth.erro };
    }

    const parsed = atualizarPacienteSchema.safeParse(dados);
    if (!parsed.success) {
      return { sucesso: false, erro: parsed.error.errors[0].message };
    }

    const { pacienteId, nome, email, telefone, ...dadosPaciente } = parsed.data;

    // Campos que pertencem à tabela pacientes
    const CAMPOS_PACIENTE = [
      'dataNascimento', 'cpf', 'rg', 'genero',
      'cep', 'endereco', 'cidade', 'uf',
      'peso', 'altura', 'historicoMedico', 'patologia',
      'atendimento', 'temAdvogado', 'nomeAdvogado',
      'cid', 'categorizacao', 'comoConheceu',
      'dataAssociacao', 'entradaPaciente', 'etapa',
      'hospitalProximo', 'homeCare', 'planoSaude',
      'possuiPlanoSaude', 'rendaFamilia', 'termoAssociado',
      'valorContribuicao', 'processoJudicializacao',
      'responsavelNome', 'responsavelCpf',
      'tratamentoTipo', 'status',
    ] as const;

    const updatePaciente: Record<string, unknown> = {};
    for (const campo of CAMPOS_PACIENTE) {
      const valor = (dadosPaciente as Record<string, unknown>)[campo];
      if (valor !== undefined) updatePaciente[campo] = valor;
    }

    if (Object.keys(updatePaciente).length > 0) {
      await db
        .update(pacientes)
        .set(updatePaciente)
        .where(eq(pacientes.id, pacienteId));
    }

    // Atualizar dados do user associado se necessário
    if (nome || email || telefone) {
      const [pacienteData] = await db
        .select({ userId: pacientes.userId })
        .from(pacientes)
        .where(eq(pacientes.id, pacienteId))
        .limit(1);

      if (pacienteData) {
        const updateUser: Record<string, unknown> = {};
        if (nome) updateUser.nome = nome;
        if (email) updateUser.email = email;
        if (telefone) updateUser.telefone = telefone;

        await db
          .update(users)
          .set(updateUser)
          .where(eq(users.id, pacienteData.userId));
      }
    }

    return { sucesso: true };
  } catch (error) {
    console.error('[Action] Erro ao atualizar paciente:', error);
    return { sucesso: false, erro: 'Erro ao atualizar paciente' };
  }
}

/**
 * Arquiva um paciente (soft delete).
 */
export async function arquivarPaciente(
  pacienteId: string,
): Promise<ActionResult> {
  try {
    const auth = await verificarMedicoOuAdmin();
    if (!auth.autorizado) {
      return { sucesso: false, erro: auth.erro };
    }

    await db
      .update(pacientes)
      .set({
        status: 'arquivado',
        deletedAt: new Date(),
      })
      .where(eq(pacientes.id, pacienteId));

    return { sucesso: true };
  } catch (error) {
    console.error('[Action] Erro ao arquivar paciente:', error);
    return { sucesso: false, erro: 'Erro ao arquivar paciente' };
  }
}

/**
 * Lista pacientes do médico autenticado com filtros.
 */
export async function listarPacientes(filtros?: {
  busca?: string;
  status?: string;
  tratamento?: string;
  jornada?: string;
}): Promise<ActionResult<Array<{
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  status: string;
  jornadaFase: string | null;
  tratamentoTipo: string | null;
  dataNascimento: string | null;
  createdAt: Date;
}>>> {
  try {
    const auth = await verificarMedicoOuAdmin();
    if (!auth.autorizado) {
      return { sucesso: false, erro: auth.erro };
    }

    const medicoId = await obterMedicoIdDoUsuario(auth.clerkId!);

    const conditions = [isNull(pacientes.deletedAt)];

    // Se for médico (não admin), filtrar por seus pacientes
    if (auth.role === 'medico' && medicoId) {
      conditions.push(eq(pacientes.medicoId, medicoId));
    }

    if (filtros?.status && filtros.status !== 'todos') {
      conditions.push(eq(pacientes.status, filtros.status as 'aguardando_consulta' | 'em_tratamento' | 'concluido' | 'arquivado'));
    }

    if (filtros?.tratamento && filtros.tratamento !== 'todos') {
      conditions.push(eq(pacientes.tratamentoTipo, filtros.tratamento as 'cbd' | 'thc' | 'cbd_thc'));
    }

    if (filtros?.jornada && filtros.jornada !== 'todos') {
      conditions.push(
        eq(
          pacientes.jornadaFase,
          filtros.jornada as 'acolhimento' | 'avaliacao_medica' | 'burocracia_anvisa' | 'logistica' | 'acompanhamento_continuo',
        ),
      );
    }

    let query = db
      .select({
        id: pacientes.id,
        nome: users.nome,
        email: users.email,
        telefone: users.telefone,
        status: pacientes.status,
        jornadaFase: pacientes.jornadaFase,
        tratamentoTipo: pacientes.tratamentoTipo,
        dataNascimento: pacientes.dataNascimento,
        createdAt: pacientes.createdAt,
      })
      .from(pacientes)
      .innerJoin(users, eq(pacientes.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(pacientes.createdAt))
      .$dynamic();

    if (filtros?.busca) {
      query = query.where(
        and(...conditions, ilike(users.nome, `%${filtros.busca}%`)),
      );
    }

    const resultado = await query;

    return { sucesso: true, dados: resultado };
  } catch (error) {
    console.error('[Action] Erro ao listar pacientes:', error);
    return { sucesso: false, erro: 'Erro ao listar pacientes' };
  }
}

/**
 * Obtém detalhes completos de um paciente pelo ID.
 */
/** Tipo completo de paciente retornado por obterPaciente */
export type PacienteCompleto = {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  status: string;
  tratamentoTipo: string | null;
  jornadaFase: string | null;
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
  atendimento: string | null;
  temAdvogado: string | null;
  nomeAdvogado: string | null;
  cid: string | null;
  categorizacao: string | null;
  comoConheceu: string | null;
  dataAssociacao: string | null;
  entradaPaciente: string | null;
  etapa: string | null;
  hospitalProximo: string | null;
  homeCare: string | null;
  planoSaude: string | null;
  possuiPlanoSaude: string | null;
  rendaFamilia: string | null;
  termoAssociado: string | null;
  valorContribuicao: string | null;
  processoJudicializacao: string | null;
  responsavelNome: string | null;
  responsavelCpf: string | null;
  medicoNome: string | null;
  createdAt: Date;
};

export async function obterPaciente(
  pacienteId: string,
): Promise<ActionResult<PacienteCompleto>> {
  try {
    const auth = await verificarMedicoOuAdmin();
    if (!auth.autorizado) {
      return { sucesso: false, erro: auth.erro };
    }

    const resultado = await db.execute(sql`
      SELECT
        p.id,
        u.nome,
        u.email,
        u.telefone,
        p.status,
        p.tratamento_tipo as "tratamentoTipo",
        p.jornada_fase as "jornadaFase",
        p.data_nascimento as "dataNascimento",
        p.cpf,
        p.rg,
        p.genero,
        p.cep,
        p.endereco,
        p.cidade,
        p.uf,
        p.peso,
        p.altura,
        p.historico_medico as "historicoMedico",
        p.patologia,
        p.atendimento,
        p.tem_advogado as "temAdvogado",
        p.nome_advogado as "nomeAdvogado",
        p.cid,
        p.categorizacao,
        p.como_conheceu as "comoConheceu",
        p.data_associacao as "dataAssociacao",
        p.entrada_paciente as "entradaPaciente",
        p.etapa,
        p.hospital_proximo as "hospitalProximo",
        p.home_care as "homeCare",
        p.plano_saude as "planoSaude",
        p.possui_plano_saude as "possuiPlanoSaude",
        p.renda_familia as "rendaFamilia",
        p.termo_associado as "termoAssociado",
        p.valor_contribuicao as "valorContribuicao",
        p.processo_judicializacao as "processoJudicializacao",
        p.responsavel_nome as "responsavelNome",
        p.responsavel_cpf as "responsavelCpf",
        p.created_at as "createdAt",
        um.nome as "medicoNome"
      FROM pacientes p
      INNER JOIN users u ON p.user_id = u.id
      LEFT JOIN medicos m ON p.medico_id = m.id
      LEFT JOIN users um ON m.user_id = um.id
      WHERE p.id = ${pacienteId}
        AND p.deleted_at IS NULL
      LIMIT 1
    `);

    if (!resultado.rows || resultado.rows.length === 0) {
      return { sucesso: false, erro: 'Paciente não encontrado' };
    }

    return { sucesso: true, dados: resultado.rows[0] as unknown as PacienteCompleto };
  } catch (error) {
    console.error('[Action] Erro ao obter paciente:', error);
    return { sucesso: false, erro: 'Erro ao obter paciente' };
  }
}

/**
 * Obtém KPIs do dashboard do médico.
 */
export async function obterKpisMedico(): Promise<ActionResult<{
  totalPacientes: number;
  aguardandoConsulta: number;
  emTratamento: number;
  concluidos: number;
}>> {
  try {
    const auth = await verificarMedicoOuAdmin();
    if (!auth.autorizado) {
      return { sucesso: false, erro: auth.erro };
    }

    const medicoId = await obterMedicoIdDoUsuario(auth.clerkId!);

    const medicoFilter = auth.role === 'medico' && medicoId
      ? sql`AND p.medico_id = ${medicoId}`
      : sql``;

    const resultado = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE p.deleted_at IS NULL) as "totalPacientes",
        COUNT(*) FILTER (WHERE p.status = 'aguardando_consulta' AND p.deleted_at IS NULL) as "aguardandoConsulta",
        COUNT(*) FILTER (WHERE p.status = 'em_tratamento' AND p.deleted_at IS NULL) as "emTratamento",
        COUNT(*) FILTER (WHERE p.status = 'concluido' AND p.deleted_at IS NULL) as "concluidos"
      FROM pacientes p
      WHERE 1=1 ${medicoFilter}
    `);

    const row = resultado.rows[0] as Record<string, string>;

    return {
      sucesso: true,
      dados: {
        totalPacientes: parseInt(row.totalPacientes || '0'),
        aguardandoConsulta: parseInt(row.aguardandoConsulta || '0'),
        emTratamento: parseInt(row.emTratamento || '0'),
        concluidos: parseInt(row.concluidos || '0'),
      },
    };
  } catch (error) {
    console.error('[Action] Erro ao obter KPIs:', error);
    return { sucesso: false, erro: 'Erro ao obter KPIs' };
  }
}

// ── Jornada do Paciente (Kanban CRM) ──────────────────────────

/** Tipo de fase válida para a jornada */
type JornadaFase =
  | 'acolhimento'
  | 'avaliacao_medica'
  | 'burocracia_anvisa'
  | 'logistica'
  | 'acompanhamento_continuo';

const fasesValidas: JornadaFase[] = [
  'acolhimento',
  'avaliacao_medica',
  'burocracia_anvisa',
  'logistica',
  'acompanhamento_continuo',
];

/**
 * Atualiza a fase da jornada de um paciente (drag & drop do Kanban).
 */
export async function atualizarJornadaFase(
  pacienteId: string,
  fase: JornadaFase,
): Promise<ActionResult> {
  try {
    const auth = await verificarMedicoOuAdmin();
    if (!auth.autorizado) {
      return { sucesso: false, erro: auth.erro };
    }

    if (!fasesValidas.includes(fase)) {
      return { sucesso: false, erro: 'Fase inválida' };
    }

    await db
      .update(pacientes)
      .set({ jornadaFase: fase })
      .where(eq(pacientes.id, pacienteId));

    return { sucesso: true };
  } catch (error) {
    console.error('[Action] Erro ao atualizar fase da jornada:', error);
    return { sucesso: false, erro: 'Erro ao atualizar fase' };
  }
}

/**
 * Lista pacientes do médico logado para o Kanban, agrupados por fase.
 */
export async function listarPacientesPorJornada(): Promise<ActionResult<{
  acolhimento: PacienteKanban[];
  avaliacao_medica: PacienteKanban[];
  burocracia_anvisa: PacienteKanban[];
  logistica: PacienteKanban[];
  acompanhamento_continuo: PacienteKanban[];
}>> {
  try {
    const auth = await verificarMedicoOuAdmin();
    if (!auth.autorizado) {
      return { sucesso: false, erro: auth.erro };
    }

    const medicoId = await obterMedicoIdDoUsuario(auth.clerkId!);

    const conditions = [isNull(pacientes.deletedAt)];

    // Excluir arquivados do Kanban
    conditions.push(
      sql`${pacientes.status} != 'arquivado'`,
    );

    // Se for médico, filtrar por seus pacientes
    if (auth.role === 'medico' && medicoId) {
      conditions.push(eq(pacientes.medicoId, medicoId));
    }

    const resultado = await db
      .select({
        id: pacientes.id,
        nome: users.nome,
        email: users.email,
        telefone: users.telefone,
        cpf: pacientes.cpf,
        status: pacientes.status,
        jornadaFase: pacientes.jornadaFase,
        tratamentoTipo: pacientes.tratamentoTipo,
        createdAt: pacientes.createdAt,
      })
      .from(pacientes)
      .innerJoin(users, eq(pacientes.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(pacientes.createdAt));

    // Agrupar por fase
    const agrupado: Record<JornadaFase, PacienteKanban[]> = {
      acolhimento: [],
      avaliacao_medica: [],
      burocracia_anvisa: [],
      logistica: [],
      acompanhamento_continuo: [],
    };

    for (const p of resultado) {
      const fase = (p.jornadaFase as JornadaFase) || 'acolhimento';
      if (agrupado[fase]) {
        agrupado[fase].push(p);
      }
    }

    return { sucesso: true, dados: agrupado };
  } catch (error) {
    console.error('[Action] Erro ao listar pacientes por jornada:', error);
    return { sucesso: false, erro: 'Erro ao listar pacientes por jornada' };
  }
}

/** Tipo do paciente retornado para o Kanban */
export interface PacienteKanban {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  cpf: string | null;
  status: string;
  jornadaFase: string;
  tratamentoTipo: string | null;
  createdAt: Date;
}



// ── Importação CSV ────────────────────────────────────────────

/**
 * Importa pacientes a partir do conteúdo de um arquivo CSV.
 * O CSV deve usar separador `;` e ter header na primeira linha.
 *
 * Colunas esperadas (case-insensitive):
 *   nome_completo;cpf;data_nascimento;genero;email;telefone;
 *   endereco;cidade;estado;cep;peso;altura;historico_medico
 *
 * Para cada linha:
 *  1. Verifica se já existe user com o e-mail → reutiliza.
 *  2. Verifica se já existe paciente vinculado → pula.
 *  3. Cria user + paciente + vínculo com o médico autenticado.
 */
export async function importarPacientesCSV(
  csvContent: string,
): Promise<ActionResult<{ importados: number; ignorados: number; erros: string[] }>> {
  try {
    const auth = await verificarMedicoOuAdmin();
    if (!auth.autorizado) {
      return { sucesso: false, erro: auth.erro };
    }

    const medicoId = await obterMedicoIdDoUsuario(auth.clerkId!);

    // Parsear CSV (separador ; e possíveis campos entre aspas com quebra de linha)
    const linhas = parseCsvLinhas(csvContent);

    if (linhas.length < 2) {
      return { sucesso: false, erro: 'O arquivo CSV parece estar vazio ou sem header.' };
    }

    // Normalizar nomes das colunas
    const headerRaw = linhas[0];
    const header = headerRaw.map((h) => h.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));

    // Mapear índices das colunas
    const colMap: Record<string, number> = {};
    const colNames = [
      'nome_completo', 'cpf', 'data_nascimento', 'genero',
      'email', 'telefone', 'endereco', 'cidade', 'estado',
      'cep', 'peso', 'altura', 'historico_medico',
    ];
    for (const col of colNames) {
      const idx = header.findIndex((h) => h === col || h === col.replace(/_/g, ''));
      colMap[col] = idx;
    }

    // Verificar colunas obrigatórias
    if (colMap.nome_completo === -1 || colMap.email === -1) {
      return { sucesso: false, erro: 'O CSV deve conter pelo menos as colunas "nome_completo" e "email".' };
    }

    let importados = 0;
    let ignorados = 0;
    const erros: string[] = [];

    for (let i = 1; i < linhas.length; i++) {
      const cols = linhas[i];
      const getValue = (colName: string): string => {
        const idx = colMap[colName];
        if (idx === -1 || idx >= cols.length) return '';
        return (cols[idx] ?? '').trim();
      };

      const nome = getValue('nome_completo');
      const email = getValue('email');

      // Pular linhas sem nome ou email
      if (!nome || !email) {
        ignorados++;
        continue;
      }

      try {
        // Verificar se já existe user com esse e-mail
        const [userExistente] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        let userId: string;

        if (userExistente) {
          // Verificar se já existe paciente vinculado a este user
          const [pacienteExistente] = await db
            .select({ id: pacientes.id })
            .from(pacientes)
            .where(eq(pacientes.userId, userExistente.id))
            .limit(1);

          if (pacienteExistente) {
            ignorados++;
            continue;
          }
          userId = userExistente.id;
        } else {
          const telefone = getValue('telefone');
          const [novoUser] = await db
            .insert(users)
            .values({
              email,
              nome,
              role: 'paciente',
              telefone: telefone || null,
            })
            .returning({ id: users.id });
          userId = novoUser.id;
        }

        // Inserir paciente
        await db.insert(pacientes).values({
          userId,
          medicoId,
          cpf: getValue('cpf') || null,
          dataNascimento: getValue('data_nascimento') || null,
          genero: getValue('genero') || null,
          endereco: getValue('endereco') || null,
          cidade: getValue('cidade') || null,
          uf: getValue('estado') || null,
          cep: getValue('cep') || null,
          peso: getValue('peso') || null,
          altura: getValue('altura') || null,
          historicoMedico: getValue('historico_medico') || null,
          status: 'aguardando_consulta',
        });

        importados++;
      } catch (err) {
        erros.push(`Linha ${i + 1} (${nome}): ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
      }
    }

    return {
      sucesso: true,
      dados: { importados, ignorados, erros: erros.slice(0, 10) },
    };
  } catch (error) {
    console.error('[Action] Erro ao importar CSV:', error);
    return { sucesso: false, erro: 'Erro ao processar importação' };
  }
}

/**
 * Parseia o conteúdo CSV considerando campos entre aspas com quebra de linha interna.
 * Separador: ponto-e-vírgula (;)
 */
function parseCsvLinhas(csv: string): string[][] {
  const resultado: string[][] = [];
  let linhaAtual: string[] = [];
  let campoAtual = '';
  let dentroDeAspas = false;

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    const nextChar = csv[i + 1];

    if (dentroDeAspas) {
      if (char === '"' && nextChar === '"') {
        campoAtual += '"';
        i++; // pular aspas escapada
      } else if (char === '"') {
        dentroDeAspas = false;
      } else {
        campoAtual += char;
      }
    } else {
      if (char === '"') {
        dentroDeAspas = true;
      } else if (char === ';') {
        linhaAtual.push(campoAtual);
        campoAtual = '';
      } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
        linhaAtual.push(campoAtual);
        campoAtual = '';
        if (linhaAtual.some((c) => c.trim() !== '')) {
          resultado.push(linhaAtual);
        }
        linhaAtual = [];
        if (char === '\r') i++; // pular \n do \r\n
      } else {
        campoAtual += char;
      }
    }
  }

  // Última linha
  linhaAtual.push(campoAtual);
  if (linhaAtual.some((c) => c.trim() !== '')) {
    resultado.push(linhaAtual);
  }

  return resultado;
}

// ── Exportação CSV ────────────────────────────────────────────

/**
 * Exporta todos os pacientes do médico autenticado como CSV (separador ;).
 */
export async function exportarPacientesCSV(): Promise<ActionResult<string>> {
  try {
    const auth = await verificarMedicoOuAdmin();
    if (!auth.autorizado) {
      return { sucesso: false, erro: auth.erro };
    }

    const medicoId = await obterMedicoIdDoUsuario(auth.clerkId!);

    const conditions = [isNull(pacientes.deletedAt)];
    if (auth.role === 'medico' && medicoId) {
      conditions.push(eq(pacientes.medicoId, medicoId));
    }

    const resultado = await db
      .select({
        nome: users.nome,
        email: users.email,
        telefone: users.telefone,
        cpf: pacientes.cpf,
        rg: pacientes.rg,
        dataNascimento: pacientes.dataNascimento,
        genero: pacientes.genero,
        cep: pacientes.cep,
        endereco: pacientes.endereco,
        cidade: pacientes.cidade,
        uf: pacientes.uf,
        peso: pacientes.peso,
        altura: pacientes.altura,
        historicoMedico: pacientes.historicoMedico,
        patologia: pacientes.patologia,
        status: pacientes.status,
        tratamentoTipo: pacientes.tratamentoTipo,
        jornadaFase: pacientes.jornadaFase,
        atendimento: pacientes.atendimento,
        cid: pacientes.cid,
        categorizacao: pacientes.categorizacao,
        comoConheceu: pacientes.comoConheceu,
        dataAssociacao: pacientes.dataAssociacao,
        entradaPaciente: pacientes.entradaPaciente,
        etapa: pacientes.etapa,
        hospitalProximo: pacientes.hospitalProximo,
        homeCare: pacientes.homeCare,
        planoSaude: pacientes.planoSaude,
        possuiPlanoSaude: pacientes.possuiPlanoSaude,
        rendaFamilia: pacientes.rendaFamilia,
        termoAssociado: pacientes.termoAssociado,
        valorContribuicao: pacientes.valorContribuicao,
        temAdvogado: pacientes.temAdvogado,
        nomeAdvogado: pacientes.nomeAdvogado,
        processoJudicializacao: pacientes.processoJudicializacao,
        responsavelNome: pacientes.responsavelNome,
        responsavelCpf: pacientes.responsavelCpf,
      })
      .from(pacientes)
      .innerJoin(users, eq(pacientes.userId, users.id))
      .where(and(...conditions))
      .orderBy(users.nome);

    // Montar CSV
    const csvHeader = [
      'nome_completo', 'cpf', 'rg', 'data_nascimento', 'genero',
      'email', 'telefone', 'cep', 'endereco', 'cidade', 'estado',
      'peso', 'altura', 'historico_medico', 'patologia',
      'status', 'tratamento_tipo', 'jornada_fase',
      'atendimento', 'cid', 'categorizacao', 'como_conheceu',
      'data_associacao', 'entrada_paciente', 'etapa',
      'hospital_proximo', 'home_care', 'plano_saude',
      'possui_plano_saude', 'renda_familia', 'termo_associado',
      'valor_contribuicao', 'tem_advogado', 'nome_advogado',
      'processo_judicializacao', 'responsavel_nome', 'responsavel_cpf',
    ];

    const linhas = resultado.map((p) => [
      p.nome ?? '', p.cpf ?? '', p.rg ?? '', p.dataNascimento ?? '', p.genero ?? '',
      p.email ?? '', p.telefone ?? '', p.cep ?? '', p.endereco ?? '', p.cidade ?? '', p.uf ?? '',
      p.peso ?? '', p.altura ?? '', p.historicoMedico ?? '', p.patologia ?? '',
      p.status ?? '', p.tratamentoTipo ?? '', p.jornadaFase ?? '',
      p.atendimento ?? '', p.cid ?? '', p.categorizacao ?? '', p.comoConheceu ?? '',
      p.dataAssociacao ?? '', p.entradaPaciente ?? '', p.etapa ?? '',
      p.hospitalProximo ?? '', p.homeCare ?? '', p.planoSaude ?? '',
      p.possuiPlanoSaude ?? '', p.rendaFamilia ?? '', p.termoAssociado ?? '',
      p.valorContribuicao ?? '', p.temAdvogado ?? '', p.nomeAdvogado ?? '',
      p.processoJudicializacao ?? '', p.responsavelNome ?? '', p.responsavelCpf ?? '',
    ]);

    // Escapar campos que contêm ; ou " ou \n
    const escapeCsv = (valor: string): string => {
      if (valor.includes(';') || valor.includes('"') || valor.includes('\n')) {
        return `"${valor.replace(/"/g, '""')}"`;
      }
      return valor;
    };

    const csvContent = [
      csvHeader.join(';'),
      ...linhas.map((l) => l.map(escapeCsv).join(';')),
    ].join('\n');

    return { sucesso: true, dados: csvContent };
  } catch (error) {
    console.error('[Action] Erro ao exportar CSV:', error);
    return { sucesso: false, erro: 'Erro ao exportar pacientes' };
  }
}

/**
 * Obtém dados agregados para os gráficos do dashboard do médico.
 * Retorna 3 datasets: distribuição por tratamento, por status e evolução mensal.
 */
export async function obterDadosGraficosDashboard(): Promise<ActionResult<{
  tratamentos: Array<{ tipo: string; quantidade: number }>;
  statusDistribuicao: Array<{ status: string; quantidade: number }>;
  evolucaoMensal: Array<{ mes: string; pacientes: number }>;
}>> {
  try {
    const auth = await verificarMedicoOuAdmin();
    if (!auth.autorizado) {
      return { sucesso: false, erro: auth.erro };
    }

    const medicoId = await obterMedicoIdDoUsuario(auth.clerkId!);

    const medicoFilter = auth.role === 'medico' && medicoId
      ? sql`AND p.medico_id = ${medicoId}`
      : sql``;

    // Distribuição por tipo de tratamento
    const tratamentosResult = await db.execute(sql`
      SELECT
        COALESCE(p.tratamento_tipo, 'nao_definido') as tipo,
        COUNT(*)::int as quantidade
      FROM pacientes p
      WHERE p.deleted_at IS NULL ${medicoFilter}
      GROUP BY p.tratamento_tipo
      ORDER BY quantidade DESC
    `);

    const TRATAMENTO_LABELS: Record<string, string> = {
      cbd: 'CBD',
      thc: 'THC',
      cbd_thc: 'CBD + THC',
      nao_definido: 'Não definido',
    };

    const tratamentos = (tratamentosResult.rows as Array<{ tipo: string; quantidade: number }>).map((r) => ({
      tipo: TRATAMENTO_LABELS[r.tipo] ?? r.tipo,
      quantidade: Number(r.quantidade),
    }));

    // Distribuição por status
    const statusResult = await db.execute(sql`
      SELECT
        p.status,
        COUNT(*)::int as quantidade
      FROM pacientes p
      WHERE p.deleted_at IS NULL ${medicoFilter}
      GROUP BY p.status
      ORDER BY quantidade DESC
    `);

    const STATUS_LABELS: Record<string, string> = {
      aguardando_consulta: 'Aguardando',
      em_tratamento: 'Em tratamento',
      concluido: 'Concluído',
      arquivado: 'Arquivado',
    };

    const statusDistribuicao = (statusResult.rows as Array<{ status: string; quantidade: number }>).map((r) => ({
      status: STATUS_LABELS[r.status] ?? r.status,
      quantidade: Number(r.quantidade),
    }));

    // Evolução mensal (últimos 6 meses)
    const evolucaoResult = await db.execute(sql`
      SELECT
        TO_CHAR(p.created_at, 'YYYY-MM') as mes_raw,
        TO_CHAR(p.created_at, 'Mon/YY') as mes,
        COUNT(*)::int as pacientes
      FROM pacientes p
      WHERE p.deleted_at IS NULL
        AND p.created_at >= NOW() - INTERVAL '6 months'
        ${medicoFilter}
      GROUP BY mes_raw, mes
      ORDER BY mes_raw ASC
    `);

    const evolucaoMensal = (evolucaoResult.rows as Array<{ mes: string; pacientes: number }>).map((r) => ({
      mes: r.mes,
      pacientes: Number(r.pacientes),
    }));

    return {
      sucesso: true,
      dados: { tratamentos, statusDistribuicao, evolucaoMensal },
    };
  } catch (error) {
    console.error('[Action] Erro ao obter dados dos gráficos:', error);
    return { sucesso: false, erro: 'Erro ao obter dados dos gráficos' };
  }
}

/**
 * Busca o medicoId a partir do clerkId do usuário.
 */
async function obterMedicoIdDoUsuario(clerkId: string): Promise<string | null> {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  if (!user) return null;

  const [medico] = await db
    .select({ id: medicos.id })
    .from(medicos)
    .where(eq(medicos.userId, user.id))
    .limit(1);

  return medico?.id ?? null;
}
