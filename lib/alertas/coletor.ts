import { db } from '@/lib/db';
import { dosagens, autorizacoesAnvisa, invoices, invoicePaymentShipping, pacientes, medicamentos, users } from '@/db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';
import { addDays, isBefore, isSameDay, parseISO, differenceInDays } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

export type PrioridadeAlerta = 'critico' | 'atencao' | 'aviso';

export interface AlertaMedicacao {
  tipo: 'medicacao';
  referenciaId: string;
  pacienteNome: string;
  pacienteEmail: string;
  pacienteTelefone: string | null;
  medicamento: string;
  diasRestantes: number;
  dataFim: string;
  prioridade: PrioridadeAlerta;
  marcoDisparado: number;
}

export interface AlertaLicenca {
  tipo: 'licenca_anvisa';
  referenciaId: string;
  pacienteNome: string;
  pacienteEmail: string;
  pacienteTelefone: string | null;
  diasRestantes: number;
  dataValidade: string;
  prioridade: PrioridadeAlerta;
  marcoDisparado: number;
}

export interface AlertaMensalidade {
  tipo: 'mensalidade';
  referenciaId: string;
  pacienteNome: string;
  pacienteEmail: string;
  pacienteTelefone: string | null;
  diasAtraso: number;
  dataVencimento: string;
  prioridade: PrioridadeAlerta;
  marcoDisparado: number;
}

const TZ = 'America/Sao_Paulo';

/**
 * Retorna a data atual na timezone de SP, zerada às 00:00:00.
 */
function getHojeSp() {
  const now = new Date();
  const zoned = toZonedTime(now, TZ);
  zoned.setHours(0, 0, 0, 0);
  return zoned;
}

export async function coletarAlertasMedicacao(): Promise<AlertaMedicacao[]> {
  const config = await db.query.alertasConfig.findFirst();
  if (!config) return [];
  
  const marcos = config.marcosMedicacaoDias as number[]; // ex: [40, 30, 10]
  if (!marcos || marcos.length === 0) return [];

  const hoje = getHojeSp();
  const alertas: AlertaMedicacao[] = [];

  const dosagensAtivas = await db
    .select({
      id: dosagens.id,
      dataFimPrevista: dosagens.dataFimPrevista,
      pacienteNome: users.nome,
      pacienteEmail: users.email,
      pacienteTelefone: users.telefone,
      medicamentoNome: medicamentos.nome,
    })
    .from(dosagens)
    .innerJoin(pacientes, eq(dosagens.pacienteId, pacientes.id))
    .innerJoin(users, eq(pacientes.userId, users.id))
    .innerJoin(medicamentos, eq(dosagens.medicamentoId, medicamentos.id))
    .where(eq(dosagens.ativa, true));

  for (const dosagem of dosagensAtivas) {
    if (!dosagem.dataFimPrevista) continue;
    
    // Convertendo YYYY-MM-DD para Date na timezone SP
    const dataFim = toZonedTime(parseISO(dosagem.dataFimPrevista + 'T00:00:00Z'), TZ);
    const diasRestantes = differenceInDays(dataFim, hoje);

    // Ordena marcos crescente: ex [10, 30, 40]
    // Encontra o menor marco que seja >= diasRestantes. Ex: dias = 23 -> marco = 30
    const marcosCrescente = [...marcos].sort((a, b) => a - b);
    const marcoAtingido = marcosCrescente.find(m => diasRestantes <= m);
    
    if (marcoAtingido !== undefined && diasRestantes >= 0) {
      let prioridade: PrioridadeAlerta = 'aviso';
      if (marcoAtingido <= 10) prioridade = 'critico';
      else if (marcoAtingido <= 30) prioridade = 'atencao';

      alertas.push({
        tipo: 'medicacao',
        referenciaId: dosagem.id,
        pacienteNome: dosagem.pacienteNome,
        pacienteEmail: dosagem.pacienteEmail,
        pacienteTelefone: dosagem.pacienteTelefone,
        medicamento: dosagem.medicamentoNome,
        diasRestantes: diasRestantes,
        dataFim: dosagem.dataFimPrevista,
        prioridade,
        marcoDisparado: marcoAtingido,
      });
    }
  }

  return alertas;
}

export async function coletarAlertasLicencas(): Promise<AlertaLicenca[]> {
  const config = await db.query.alertasConfig.findFirst();
  if (!config) return [];
  
  const marcos = config.marcosLicencaDias as number[]; // ex: [60, 30]
  if (!marcos || marcos.length === 0) return [];

  const hoje = getHojeSp();
  const alertas: AlertaLicenca[] = [];

  const licencasAtivas = await db
    .select({
      id: autorizacoesAnvisa.id,
      dataValidade: autorizacoesAnvisa.dataValidade,
      pacienteNome: users.nome,
      pacienteEmail: users.email,
      pacienteTelefone: users.telefone,
    })
    .from(autorizacoesAnvisa)
    .innerJoin(pacientes, eq(autorizacoesAnvisa.pacienteId, pacientes.id))
    .innerJoin(users, eq(pacientes.userId, users.id))
    .where(
      and(
        eq(autorizacoesAnvisa.status, 'aprovado'),
        isNotNull(autorizacoesAnvisa.dataValidade)
      )
    );

  for (const licenca of licencasAtivas) {
    if (!licenca.dataValidade) continue;

    const dataValidade = toZonedTime(parseISO(licenca.dataValidade + 'T00:00:00Z'), TZ);
    const diasRestantes = differenceInDays(dataValidade, hoje);

    const marcosCrescente = [...marcos].sort((a, b) => a - b);
    const marcoAtingido = marcosCrescente.find(m => diasRestantes <= m);

    if (marcoAtingido !== undefined && diasRestantes >= 0) {
      let prioridade: PrioridadeAlerta = 'atencao';
      if (marcoAtingido <= 30) prioridade = 'critico';

      alertas.push({
        tipo: 'licenca_anvisa',
        referenciaId: licenca.id,
        pacienteNome: licenca.pacienteNome,
        pacienteEmail: licenca.pacienteEmail,
        pacienteTelefone: licenca.pacienteTelefone,
        diasRestantes: diasRestantes,
        dataValidade: licenca.dataValidade,
        prioridade,
        marcoDisparado: marcoAtingido,
      });
    }
  }

  return alertas;
}

export async function coletarAlertasMensalidades(): Promise<AlertaMensalidade[]> {
  // Apenas invoices que tem paymentDeadline no invoicePaymentShipping
  const hoje = getHojeSp();
  const alertas: AlertaMensalidade[] = [];

  const pendingInvoices = await db
    .select({
      id: invoices.id,
      paymentDeadline: invoicePaymentShipping.paymentDeadline,
      pacienteNome: users.nome,
      pacienteEmail: users.email,
      pacienteTelefone: users.telefone,
    })
    .from(invoices)
    .innerJoin(invoicePaymentShipping, eq(invoices.id, invoicePaymentShipping.invoiceId))
    .innerJoin(pacientes, eq(invoices.pacienteId, pacientes.id))
    .innerJoin(users, eq(pacientes.userId, users.id))
    .where(
      and(
        eq(invoices.status, 'draft'), // Usando draft para representar pendente já que só tem completed
        isNotNull(invoicePaymentShipping.paymentDeadline)
      )
    );

  for (const inv of pendingInvoices) {
    if (!inv.paymentDeadline) continue;

    const dataVencimento = toZonedTime(parseISO(inv.paymentDeadline + 'T00:00:00Z'), TZ);

    if (isBefore(dataVencimento, hoje)) {
      const diasAtraso = differenceInDays(hoje, dataVencimento);

      // Dispara em marcos de atraso. O maior marco atingido
      const marcosAtraso = [1, 7, 15, 30, 45, 60, 90];
      const marcosDecrescente = [...marcosAtraso].sort((a, b) => b - a);
      const marcoAtingido = marcosDecrescente.find(m => diasAtraso >= m);
      
      if (marcoAtingido !== undefined) {
        let prioridade: PrioridadeAlerta = 'atencao';
        if (diasAtraso > 30) prioridade = 'critico';

        alertas.push({
          tipo: 'mensalidade',
          referenciaId: inv.id,
          pacienteNome: inv.pacienteNome,
          pacienteEmail: inv.pacienteEmail,
          pacienteTelefone: inv.pacienteTelefone,
          diasAtraso,
          dataVencimento: inv.paymentDeadline,
          prioridade,
          marcoDisparado: marcoAtingido,
        });
      }
    }
  }

  return alertas;
}
