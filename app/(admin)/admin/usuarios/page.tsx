import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Stethoscope, Shield } from 'lucide-react';

const USUARIOS_MOCK = [
  { id: '1', nome: 'Admin Principal', email: 'admin@be4hope.org', role: 'admin' },
  { id: '2', nome: 'Dr. André Lima', email: 'andre@be4hope.org', role: 'medico' },
  { id: '3', nome: 'Dra. Camila Santos', email: 'camila@be4hope.org', role: 'medico' },
  { id: '4', nome: 'Maria Silva', email: 'maria@email.com', role: 'paciente' },
  { id: '5', nome: 'João Santos', email: 'joao@email.com', role: 'paciente' },
  { id: '6', nome: 'Ana Oliveira', email: 'ana@email.com', role: 'paciente' },
];

const ROLE_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline'; icon: typeof User }> = {
  admin: { label: 'Admin', variant: 'default', icon: Shield },
  medico: { label: 'Médico', variant: 'secondary', icon: Stethoscope },
  paciente: { label: 'Paciente', variant: 'outline', icon: User },
};

export default function UsuariosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Usuários</h1>
        <p className="text-sm text-muted-foreground">
          {USUARIOS_MOCK.length} usuários registrados
        </p>
      </div>

      <div className="space-y-3">
        {USUARIOS_MOCK.map((user) => {
          const config = ROLE_CONFIG[user.role];
          const Icon = config?.icon || User;
          return (
            <Card key={user.id} className="border-0 shadow-sm">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{user.nome}</p>
                  <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                </div>
                <Badge variant={config?.variant || 'outline'}>
                  {config?.label}
                </Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
