import { Card, CardContent } from '@/components/ui/card';
import { Shield, User, FileText, Calendar } from 'lucide-react';

const LOGS_MOCK = [
  { id: '1', acao: 'Acesso a prontuário', usuario: 'Dr. André Lima', recurso: 'Maria Silva', data: '2026-05-04 10:30', ip: '192.168.1.100' },
  { id: '2', acao: 'Upload de documento', usuario: 'Maria Silva', recurso: 'Receita_CBD.pdf', data: '2026-05-04 09:15', ip: '201.45.12.89' },
  { id: '3', acao: 'Exportação de relatório', usuario: 'Dr. André Lima', recurso: 'Relatório de João Santos', data: '2026-05-03 16:42', ip: '192.168.1.100' },
  { id: '4', acao: 'Alteração de dosagem', usuario: 'Dra. Camila Santos', recurso: 'Ana Oliveira', data: '2026-05-03 14:20', ip: '10.0.0.55' },
  { id: '5', acao: 'Login no sistema', usuario: 'Admin Principal', recurso: 'Painel administrativo', data: '2026-05-03 08:00', ip: '203.0.113.50' },
];

const ACAO_ICONES: Record<string, typeof Shield> = {
  'Acesso a prontuário': User,
  'Upload de documento': FileText,
  'Exportação de relatório': FileText,
  'Alteração de dosagem': Shield,
  'Login no sistema': Shield,
};

export default function AuditoriaPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Auditoria LGPD</h1>
        <p className="text-sm text-muted-foreground">
          Registro de todas as operações sensíveis na plataforma
        </p>
      </div>

      <div className="space-y-3">
        {LOGS_MOCK.map((log) => {
          const Icon = ACAO_ICONES[log.acao] || Shield;
          return (
            <Card key={log.id} className="border-0 shadow-sm">
              <CardContent className="flex items-start gap-4 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{log.acao}</p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{log.usuario}</span>{' '}
                    → {log.recurso}
                  </p>
                </div>
                <div className="hidden text-right text-xs text-muted-foreground sm:block">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>{log.data}</span>
                  </div>
                  <p className="mt-0.5">IP: {log.ip}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
