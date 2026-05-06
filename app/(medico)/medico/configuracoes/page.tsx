import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Settings, User, Calendar, Shield } from 'lucide-react';

export default function ConfiguracoesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie seu perfil e preferências
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <User className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-base">Perfil Profissional</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nome</span>
              <span className="font-medium">Dr. André Lima</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">CRM</span>
              <span className="font-medium">CRM/SP 123456</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Especialidade</span>
              <span className="font-medium">Neurologia</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
                <Calendar className="h-5 w-5 text-violet-600" />
              </div>
              <CardTitle className="text-base">Google Calendar</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge variant="outline">Não conectado</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Conecte seu Google Calendar para agendar consultas automaticamente
              com link do Google Meet.
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
                <Settings className="h-5 w-5 text-amber-600" />
              </div>
              <CardTitle className="text-base">Preferências</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Idioma</span>
              <span className="font-medium">Português (BR)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fuso horário</span>
              <span className="font-medium">America/Sao_Paulo</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                <Shield className="h-5 w-5 text-emerald-600" />
              </div>
              <CardTitle className="text-base">Segurança</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Autenticação</span>
              <Badge variant="outline">Clerk (pendente)</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              A autenticação será habilitada quando as chaves do Clerk
              forem configuradas.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
