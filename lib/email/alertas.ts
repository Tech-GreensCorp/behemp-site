import { AlertaMedicacao, AlertaLicenca, AlertaMensalidade } from '../alertas/coletor';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DigestProps {
  alertasMedicacao: AlertaMedicacao[];
  alertasLicenca: AlertaLicenca[];
  alertasMensalidade: AlertaMensalidade[];
  adminUrl: string;
}

export function gerarHtmlDigestAdmin({ alertasMedicacao, alertasLicenca, alertasMensalidade, adminUrl }: DigestProps): string {
  const todosAlertas = [...alertasMedicacao, ...alertasLicenca, ...alertasMensalidade];
  if (todosAlertas.length === 0) return '';

  const criticos = todosAlertas.filter(a => a.prioridade === 'critico');
  const atencao = todosAlertas.filter(a => a.prioridade === 'atencao');
  const avisos = todosAlertas.filter(a => a.prioridade === 'aviso');

  const renderItem = (alerta: AlertaMedicacao | AlertaLicenca | AlertaMensalidade) => {
    let detalhe = '';
    let corDestaque = alerta.prioridade === 'critico' ? '#E41B1C' : alerta.prioridade === 'atencao' ? '#f59e0b' : '#3b82f6';

    if (alerta.tipo === 'medicacao') {
      detalhe = `Produto: ${alerta.medicamento}<br>Termina em: <strong style="color: ${corDestaque};">${alerta.diasRestantes} dias</strong> (${format(new Date(alerta.dataFim), 'dd/MM/yyyy')})`;
    } else if (alerta.tipo === 'licenca_anvisa') {
      detalhe = `Licença ANVISA<br>Vence em: <strong style="color: ${corDestaque};">${alerta.diasRestantes} dias</strong> (${format(new Date(alerta.dataValidade), 'dd/MM/yyyy')})`;
    } else if (alerta.tipo === 'mensalidade') {
      detalhe = `Mensalidade em Atraso<br>Atraso: <strong style="color: ${corDestaque};">${alerta.diasAtraso} dias</strong> (Venceu em ${format(new Date(alerta.dataVencimento), 'dd/MM/yyyy')})`;
    }

    return `
      <div style="margin: 10px 0; padding: 10px; background: white; border-radius: 4px;">
        <strong>${alerta.pacienteNome}</strong><br>
        ${detalhe}<br>
        Telefone: ${alerta.pacienteTelefone || 'Não informado'}
      </div>
    `;
  };

  const renderSecao = (titulo: string, icone: string, alertas: typeof todosAlertas, bgColor: string, borderColor: string, textColor: string) => {
    if (alertas.length === 0) return '';
    return `
      <div style="background: ${bgColor}; border-left: 4px solid ${borderColor}; padding: 15px; margin: 15px 0; border-radius: 4px;">
        <h3 style="color: ${textColor}; margin: 0 0 10px 0;">${icone} ${titulo}</h3>
        ${alertas.map(renderItem).join('')}
      </div>
    `;
  };

  const hojeFormatado = format(new Date(), "dd/MM/yyyy 'às' HH:mm:ss");

  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset='UTF-8'>
        <meta name='viewport' content='width=device-width, initial-scale=1.0'>
        <title>Sistema de Alertas Be4Hope</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5;">
        <div style="max-width: 700px; margin: 0 auto; padding: 20px;">
            <div style="background: #E41B1C; color: white; padding: 25px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="margin: 0; font-size: 24px;">🚨 Be4Hope</h1>
                <p style='margin: 5px 0 0 0; font-size: 16px;'>Resumo de Alertas Diários</p>
            </div>
            <div style="background: #fff; padding: 30px; border: 1px solid #ddd; min-height: 200px;">
                <p>Aqui está o resumo automático do sistema de monitoramento de pacientes:</p>
                
                ${renderSecao('CRÍTICO', '🔴', criticos, '#fee2e2', '#E41B1C', '#E41B1C')}
                ${renderSecao('ATENÇÃO', '🟡', atencao, '#fef3c7', '#f59e0b', '#f59e0b')}
                ${renderSecao('AVISO', '🔵', avisos, '#e7f3ff', '#3b82f6', '#3b82f6')}
                
                <div style='text-align: center; margin-top: 30px;'>
                    <a href='${adminUrl}' style="display: inline-block; background: #E41B1C; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 15px 0; font-weight: bold;">🔗 Acessar Central de Alertas</a>
                </div>
                
                <div style="color: #666; font-size: 12px; margin-top: 20px; text-align: center;">
                    📅 Gerado em ${hojeFormatado}
                </div>
            </div>
            <div style="background: #f9f9f9; padding: 20px; text-align: center; font-size: 14px; color: #666; border-radius: 0 0 8px 8px; border: 1px solid #ddd; border-top: none;">
                <p><strong>Este é um alerta automático do sistema Be4Hope</strong></p>
            </div>
        </div>
    </body>
    </html>
  `;
}

interface TemplatePacienteProps {
  nome: string;
  medicamento: string;
  dataTermino: string;
  recompraUrl: string;
}

export function gerarHtmlAlertaPaciente({ nome, medicamento, dataTermino, recompraUrl }: TemplatePacienteProps): string {
  const dataFormatada = format(new Date(dataTermino), "dd 'de' MMMM", { locale: ptBR });

  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset='UTF-8'>
        <meta name='viewport' content='width=device-width, initial-scale=1.0'>
        <title>Aviso de Medicação - Be4Hope</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #2D4F3C; color: white; padding: 25px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="margin: 0; font-size: 24px;">Be4Hope</h1>
            </div>
            <div style="background: #fff; padding: 30px; border: 1px solid #ddd; min-height: 200px;">
                <p>Olá, <strong>${nome}</strong>.</p>
                <p>Esperamos que o seu tratamento esteja indo muito bem!</p>
                <p>De acordo com o nosso sistema, o seu medicamento <strong>${medicamento}</strong> está previsto para durar aproximadamente até o dia <strong>${dataFormatada}</strong>.</p>
                <p>Para garantir que não haja interrupções no seu tratamento, recomendamos que você solicite a recompra do medicamento o quanto antes.</p>
                
                <div style='text-align: center; margin-top: 30px; margin-bottom: 30px;'>
                    <a href='${recompraUrl}' style="display: inline-block; background: #C16E56; color: white; padding: 14px 28px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 16px;">Solicitar Recompra</a>
                </div>
                
                <p>Se tiver qualquer dúvida, a nossa equipe está à disposição no chat da plataforma.</p>
                <p>Com carinho,<br><strong>Equipe Be4Hope</strong></p>
            </div>
            <div style="background: #f9f9f9; padding: 20px; text-align: center; font-size: 14px; color: #666; border-radius: 0 0 8px 8px; border: 1px solid #ddd; border-top: none;">
                <p>Acesse o nosso portal: <a href="https://be4hope.org" style="color: #2D4F3C;">be4hope.org</a></p>
            </div>
        </div>
    </body>
    </html>
  `;
}
