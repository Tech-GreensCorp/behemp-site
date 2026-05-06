import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Settings, Database, Globe, Shield } from 'lucide-react';

export default function ConfiguracoesAdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">
          Configurações gerais da plataforma
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Settings className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-base">Geral</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nome da plataforma</span>
              <span className="font-medium">Be4Hope</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Versão</span>
              <span className="font-medium">0.1.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ambiente</span>
              <Badge variant="outline">Desenvolvimento</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
                <Database className="h-5 w-5 text-violet-600" />
              </div>
              <CardTitle className="text-base">Banco de Dados</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Provider</span>
              <span className="font-medium">Neon PostgreSQL</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">ORM</span>
              <span className="font-medium">Drizzle</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge>Conectado</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
                <Globe className="h-5 w-5 text-amber-600" />
              </div>
              <CardTitle className="text-base">Integrações</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Clerk (Auth)</span>
              <Badge variant="outline">Pendente</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Resend (E-mail)</span>
              <Badge variant="outline">Pendente</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Pusher (Chat)</span>
              <Badge variant="outline">Pendente</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Inngest (Jobs)</span>
              <Badge variant="outline">Pendente</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                <Shield className="h-5 w-5 text-emerald-600" />
              </div>
              <CardTitle className="text-base">LGPD</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Logs de auditoria</span>
              <Badge>Ativo</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Criptografia</span>
              <Badge>Ativo</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Soft delete</span>
              <Badge>Ativo</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
