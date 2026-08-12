'use server';

import { db } from '@/lib/db';
import { alertasConfig } from '@/db/schema';
import { verificarAdmin } from '@/lib/auth';
import { coletarAlertasMedicacao, coletarAlertasLicencas, coletarAlertasMensalidades, PrioridadeAlerta } from '@/lib/alertas/coletor';
import { gerarHtmlDigestAdmin } from '@/lib/email/alertas';
import { enviarEmailGenerico } from '@/lib/email/brevo';
import { eq } from 'drizzle-orm';
import { inngest } from '@/lib/integrations/inngest/client';

export async function buscarResumoAlertas() {
  try {
    await verificarAdmin();

    const meds = await coletarAlertasMedicacao();
    const lics = await coletarAlertasLicencas();
    const mens = await coletarAlertasMensalidades();

    const todos = [...meds, ...lics, ...mens];

    const resumo = {
      criticos: todos.filter(a => a.prioridade === 'critico').length,
      atencao: todos.filter(a => a.prioridade === 'atencao').length,
      ativosMed: meds.length,
      ativosLic: lics.length,
      ativosMen: mens.length,
    };

    return { sucesso: true, dados: resumo };
  } catch (error: unknown) {
    console.error('Erro ao buscar resumo de alertas:', error);
    return { sucesso: false, erro: (error as Error).message || 'Erro desconhecido' };
  }
}

export async function listarAlertas(filtros?: { tipo?: string, prioridade?: PrioridadeAlerta, busca?: string }) {
  try {
    await verificarAdmin();

    const meds = await coletarAlertasMedicacao();
    const lics = await coletarAlertasLicencas();
    const mens = await coletarAlertasMensalidades();

    let todos = [...meds, ...lics, ...mens];

    if (filtros?.tipo) {
      todos = todos.filter(a => a.tipo === filtros.tipo);
    }
    if (filtros?.prioridade) {
      todos = todos.filter(a => a.prioridade === filtros.prioridade);
    }
    if (filtros?.busca) {
      const q = filtros.busca.toLowerCase();
      todos = todos.filter(a => 
        a.pacienteNome.toLowerCase().includes(q) || 
        (a.tipo === 'medicacao' ? (a as import('@/lib/alertas/coletor').AlertaMedicacao).medicamento.toLowerCase().includes(q) : false)
      );
    }

    // Ordenar críticos > atenção > aviso
    const rank = { critico: 1, atencao: 2, aviso: 3 };
    todos.sort((a, b) => rank[a.prioridade] - rank[b.prioridade]);

    return { sucesso: true, dados: todos };
  } catch (error: unknown) {
    console.error('Erro ao listar alertas:', error);
    return { sucesso: false, erro: (error as Error).message || 'Erro desconhecido' };
  }
}

export async function buscarConfigAlertas() {
  try {
    await verificarAdmin();
    const config = await db.query.alertasConfig.findFirst();
    if (!config) {
      return { sucesso: true, dados: { marcosMedicacaoDias: [40, 30, 10], marcosLicencaDias: [60, 30], digestHorario: '08:00', digestAtivo: true, notificarPaciente: true } };
    }
    return { sucesso: true, dados: config };
  } catch (error: unknown) {
    console.error('Erro ao buscar config alertas:', error);
    return { sucesso: false, erro: (error as Error).message || 'Erro desconhecido' };
  }
}

export async function salvarConfigAlertas(config: { marcosMedicacaoDias: number[], marcosLicencaDias: number[], digestHorario: string, digestAtivo: boolean, notificarPaciente: boolean }) {
  try {
    await verificarAdmin();
    const current = await db.query.alertasConfig.findFirst();
    if (current) {
      await db.update(alertasConfig).set(config).where(eq(alertasConfig.id, current.id));
    } else {
      await db.insert(alertasConfig).values(config);
    }
    return { sucesso: true };
  } catch (error: unknown) {
    console.error('Erro ao salvar config alertas:', error);
    return { sucesso: false, erro: (error as Error).message || 'Erro desconhecido' };
  }
}

export async function dispararVerificacaoManual() {
  try {
    await verificarAdmin();
    // Envia evento pro Inngest para rodar o job imediatamente (bypass no cron)
    // Vamos usar a API do Inngest envia o evento "be4hope/digest.manual"
    // Wait, eu defini o trigger do digestDiarioAdmin apenas por cron. Eu posso mandar o Inngest rodar via API, mas não posso disparar cron direto por aqui facilmente sem um evento associado.
    // Como a instrução diz "envia evento Inngest para rodar o digest agora", vou mudar o digestDiarioAdmin pra aceitar evento também!
    await inngest.send({ name: 'be4hope/digest.manual', data: {} });
    return { sucesso: true };
  } catch (error: unknown) {
    console.error('Erro ao disparar verificacao manual:', error);
    return { sucesso: false, erro: (error as Error).message || 'Erro desconhecido' };
  }
}

export async function enviarEmailTeste(email: string) {
  try {
    await verificarAdmin();
    const html = gerarHtmlDigestAdmin({
      alertasMedicacao: [{ tipo: 'medicacao', referenciaId: 't1', pacienteNome: 'João Silva (TESTE)', pacienteEmail: '', pacienteTelefone: '(11) 99999-9999', medicamento: 'Greens MED 6300mg Full Spectrum', diasRestantes: 8, dataFim: new Date().toISOString(), prioridade: 'critico', marcoDisparado: 10 }],
      alertasLicenca: [],
      alertasMensalidade: [],
      adminUrl: 'https://be4hope.org/admin/alertas',
    });
    
    await enviarEmailGenerico([{ email, name: 'Admin Teste' }], '🧪 TESTE - Alertas Be4Hope', html);
    return { sucesso: true };
  } catch (error: unknown) {
    console.error('Erro ao enviar email de teste:', error);
    return { sucesso: false, erro: (error as Error).message || 'Erro desconhecido' };
  }
}
