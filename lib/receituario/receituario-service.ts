import { db } from '@/lib/db';
import { prescricoes, receituarioTemplates } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { renderizarTemplate } from './template-engine';
import {
  construirHtmlDeConfig,
  CONFIG_PADRAO,
} from './layout-builder';
import type { ReceituarioConfig, ContextoReceituario } from './tipos';

interface MedicamentoLinha {
  nome: string;
  dose?: string;
  forma?: string;
  posologia?: string;
  quantidade?: string;
}

function calcularIdade(dataNascimento: string | Date | null | undefined): number | null {
  if (!dataNascimento) return null;
  const nasc = new Date(dataNascimento);
  if (isNaN(nasc.getTime())) return null;
  const hoje = new Date();
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade >= 0 && idade < 130 ? idade : null;
}

function normalizarMedicamentos(medicamentos: unknown): MedicamentoLinha[] {
  let arr: unknown = medicamentos;
  if (typeof arr === 'string') {
    try {
      arr = JSON.parse(arr);
    } catch {
      arr = [];
    }
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((m) => {
      const med = (m ?? {}) as Record<string, unknown>;
      const s = (v: unknown) => (v == null ? '' : String(v)).trim();
      const posologia =
        s(med.posologia) ||
        [s(med.frequencia), s(med.duracao)].filter(Boolean).join(' · ');
      return {
        nome: s(med.nome) || s(med.principioAtivo),
        dose: s(med.dose),
        forma: s(med.via) || s(med.forma),
        posologia,
        quantidade: s(med.quantidade),
      };
    })
    .filter((m) => m.nome);
}

const TIPO_LABEL: Record<string, string> = {
  simples: 'Receituário',
  controle_especial: 'Receituário de Controle Especial',
  personalizado: 'Receituário',
};

interface TemplateResolvido {
  config: Partial<ReceituarioConfig> | null;
  layoutHtml: string | null;
}

/** Resolve o template a usar. Nunca lança: cai no default CIAS (config) se nada for encontrado. */
async function resolverTemplate(
  medicoId: string,
  templateId?: string | null,
): Promise<TemplateResolvido> {
  let t = null;
  
  if (templateId) {
    const [result] = await db.select().from(receituarioTemplates)
      .where(and(eq(receituarioTemplates.id, templateId), eq(receituarioTemplates.ativo, true), isNull(receituarioTemplates.deletedAt)))
      .limit(1);
    t = result;
  }
  
  if (!t) {
    const [result] = await db.select().from(receituarioTemplates)
      .where(and(eq(receituarioTemplates.medicoId, medicoId), eq(receituarioTemplates.padrao, true), eq(receituarioTemplates.ativo, true), isNull(receituarioTemplates.deletedAt)))
      .limit(1);
    t = result;
  }
  
  if (!t) {
    // Template da organização (medicoId nulo)
    const [result] = await db.select().from(receituarioTemplates)
      .where(and(isNull(receituarioTemplates.medicoId), eq(receituarioTemplates.padrao, true), eq(receituarioTemplates.ativo, true), isNull(receituarioTemplates.deletedAt)))
      .limit(1);
    t = result;
  }
  
  if (!t) return { config: CONFIG_PADRAO, layoutHtml: null };
  return {
    config: (t.config as Partial<ReceituarioConfig> | null) ?? null,
    layoutHtml: t.layoutHtml || null,
  };
}

/** Monta o contexto (dados auto-importados) a partir da Prescricao carregada. */
type PrescComRel = {
  medico: {
    nome: string;
    crm: string | null;
    especialidade: string;
  };
  paciente: {
    nome: string;
    dataNascimento: string | Date | null;
    genero: string | null;
  };
  medicamentos: unknown;
  diagnostico: string | null;
  cid: string | null;
  observacoes: string | null;
  orientacoes: string | null;
  createdAt: Date;
  validade: Date;
  tipo: string;
};

function montarContexto(presc: PrescComRel): ContextoReceituario {
  const medico = presc.medico;
  return {
    clinica: {
      nome: 'BeHemp',
      logoUrl: null,
      corPrimaria: '#EA5429', // Laranja BeHemp
      endereco: '',
      telefone: '',
    },
    medico: {
      nome: medico.nome || 'Médico',
      crm: medico.crm || '',
      crmUf: '',
      especialidade: medico.especialidade || '',
      rqe: '',
      telefone: '',
      assinaturaUrl: null,
      carimboUrl: null,
    },
    paciente: {
      nome: presc.paciente.nome || 'Paciente',
      idade: calcularIdade(presc.paciente.dataNascimento),
      sexo: presc.paciente.genero ?? '',
    },
    receita: {
      tipoLabel: TIPO_LABEL[presc.tipo] ?? TIPO_LABEL.simples,
      diagnostico: presc.diagnostico ?? '',
      cid: presc.cid ?? '',
      observacoes: presc.observacoes ?? presc.orientacoes ?? '',
      emitidaEm: presc.createdAt,
      validade: presc.validade,
    },
    medicamentos: normalizarMedicamentos(presc.medicamentos),
  };
}

/** Monta o HTML do receituário de uma prescrição (read-only). */
export async function montarHtmlReceituario(
  prescricaoId: string,
): Promise<string> {
  const { medicos, pacientes, users } = await import('@/db/schema');
  const [presc] = await db
    .select({
      id: prescricoes.id,
      medicoId: prescricoes.medicoId,
      templateId: prescricoes.templateId,
      medicamentos: prescricoes.medicamentos,
      diagnostico: prescricoes.diagnostico,
      cid: prescricoes.cid,
      observacoes: prescricoes.observacoes,
      orientacoes: prescricoes.orientacoes,
      createdAt: prescricoes.createdAt,
      validade: prescricoes.validade,
      tipo: prescricoes.tipo,
      medicoNome: users.nome,
      medicoCrm: medicos.crm,
      medicoEspecialidade: medicos.especialidade,
      pacienteNome: users.nome,
      pacienteNascimento: pacientes.dataNascimento,
      pacienteGenero: pacientes.genero,
    })
    .from(prescricoes)
    .innerJoin(medicos, eq(prescricoes.medicoId, medicos.id))
    .innerJoin(users, eq(medicos.userId, users.id))
    .innerJoin(pacientes, eq(prescricoes.pacienteId, pacientes.id))
    // we need to get user for patient too, let's just do it cleanly below
    .where(eq(prescricoes.id, prescricaoId))
    .limit(1);

  if (!presc) throw new Error('Prescrição não encontrada');

  // Let's refetch with proper patient user join since the query above has ambiguous 'users.nome'
  const [prescData] = await db
    .select({
      id: prescricoes.id,
      medicoId: prescricoes.medicoId,
      templateId: prescricoes.templateId,
      medicamentos: prescricoes.medicamentos,
      diagnostico: prescricoes.diagnostico,
      cid: prescricoes.cid,
      observacoes: prescricoes.observacoes,
      orientacoes: prescricoes.orientacoes,
      createdAt: prescricoes.createdAt,
      validade: prescricoes.validade,
      tipo: prescricoes.tipo,
      
      medicoCrm: medicos.crm,
      medicoEspecialidade: medicos.especialidade,
      pacienteNascimento: pacientes.dataNascimento,
      pacienteGenero: pacientes.genero,
      
      pacienteUserId: pacientes.userId,
      medicoUserId: medicos.userId,
    })
    .from(prescricoes)
    .innerJoin(medicos, eq(prescricoes.medicoId, medicos.id))
    .innerJoin(pacientes, eq(prescricoes.pacienteId, pacientes.id))
    .where(eq(prescricoes.id, prescricaoId))
    .limit(1);
    
  if (!prescData) throw new Error('Prescrição não encontrada');
  
  const [medicoUser] = await db.select({ nome: users.nome }).from(users).where(eq(users.id, prescData.medicoUserId)).limit(1);
  const [pacienteUser] = await db.select({ nome: users.nome }).from(users).where(eq(users.id, prescData.pacienteUserId)).limit(1);

  const ctxData: PrescComRel = {
    medico: {
      nome: medicoUser?.nome || 'Médico',
      crm: prescData.medicoCrm,
      especialidade: prescData.medicoEspecialidade || '',
    },
    paciente: {
      nome: pacienteUser?.nome || 'Paciente',
      dataNascimento: prescData.pacienteNascimento,
      genero: prescData.pacienteGenero,
    },
    medicamentos: prescData.medicamentos,
    diagnostico: prescData.diagnostico,
    cid: prescData.cid,
    observacoes: prescData.observacoes,
    orientacoes: prescData.orientacoes,
    createdAt: prescData.createdAt,
    validade: prescData.validade,
    tipo: prescData.tipo,
  };

  const ctx = montarContexto(ctxData);
  const tpl = await resolverTemplate(prescData.medicoId, prescData.templateId);

  if (tpl.layoutHtml) {
    return renderizarTemplate(
      tpl.layoutHtml,
      ctx as unknown as Record<string, unknown>,
    );
  }
  return construirHtmlDeConfig(tpl.config, ctx);
}

// Assinatura/carimbo de AMOSTRA (SVG data URI)
const ASSINATURA_AMOSTRA =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='180' height='44'><path d='M6 32c14-22 22 8 34-4s10-18 22-10 8 20 22 8 18-14 30-6 20 0 34-8' fill='none' stroke='#1a2a5a' stroke-width='2'/></svg>`,
  );
const CARIMBO_AMOSTRA =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='90' viewBox='0 0 120 90'><g fill='none' stroke='#1a5a3a' stroke-width='2'><circle cx='60' cy='45' r='40'/><circle cx='60' cy='45' r='32'/></g><text x='60' y='42' text-anchor='middle' font-size='9' fill='#1a5a3a' font-family='Arial'>Dr(a). EXEMPLO</text><text x='60' y='55' text-anchor='middle' font-size='8' fill='#1a5a3a' font-family='Arial'>CRM 000000/SP</text></svg>`,
  );

const CONTEXTO_AMOSTRA: ContextoReceituario = {
  clinica: {
    nome: 'BeHemp',
    logoUrl: null,
    corPrimaria: '#EA5429',
    endereco: 'Rua Exemplo, 123 — Centro',
    telefone: '(00) 0000-0000',
    email: 'contato@clinica.com',
    site: 'clinica.com.br',
  },
  medico: {
    nome: 'Dr(a). Exemplo da Silva',
    crm: '000000',
    crmUf: 'SP',
    especialidade: 'Clínica Médica',
    rqe: '12345',
    telefone: '',
    assinaturaUrl: ASSINATURA_AMOSTRA,
    carimboUrl: CARIMBO_AMOSTRA,
  },
  paciente: { nome: 'Paciente de Exemplo', idade: 42, sexo: 'F' },
  receita: {
    tipoLabel: 'Receituário',
    diagnostico: 'Faringite aguda',
    cid: 'J02.9',
    observacoes: 'Retornar em 15 dias. Manter hidratação.',
    emitidaEm: new Date(),
    validade: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  },
  medicamentos: [
    {
      nome: 'Óleo de CBD 5%',
      dose: '30 ml',
      forma: 'Óleo',
      posologia: '3 gotas sublinguais 2x ao dia',
      quantidade: '1',
    },
    {
      nome: 'Gomas de THC',
      dose: '10mg',
      forma: 'Goma',
      posologia: '1 goma à noite se insônia',
      quantidade: '30',
    },
  ],
};

export function montarHtmlPreviewDeConfig(
  config: Partial<ReceituarioConfig> | null | undefined,
): string {
  return construirHtmlDeConfig(config, CONTEXTO_AMOSTRA);
}

export function montarHtmlPreview(layoutHtml: string): string {
  return renderizarTemplate(
    layoutHtml,
    CONTEXTO_AMOSTRA as unknown as Record<string, unknown>,
  );
}
