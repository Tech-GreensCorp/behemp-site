import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Shield, Bell } from 'lucide-react';

export default function ConfiguracoesPacientePage() {
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
              <CardTitle className="text-base">Meu Perfil</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nome</span>
              <span className="font-medium">Maria Silva</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">E-mail</span>
              <span className="font-medium">maria@email.com</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Telefone</span>
              <span className="font-medium">(11) 99999-1234</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
                <Bell className="h-5 w-5 text-amber-600" />
              </div>
              <CardTitle className="text-base">Notificações</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">E-mail de recompra</span>
              <Badge>Ativo</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Lembrete de consulta</span>
              <Badge>Ativo</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Renovação de documento</span>
              <Badge>Ativo</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm md:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                <Shield className="h-5 w-5 text-emerald-600" />
              </div>
              <CardTitle className="text-base">Privacidade e LGPD</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>
              Seus dados pessoais e clínicos são protegidos conforme a Lei Geral de
              Proteção de Dados (LGPD). Apenas seu médico responsável tem acesso
              aos seus dados clínicos. Todas as operações são registradas em log
              de auditoria.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
