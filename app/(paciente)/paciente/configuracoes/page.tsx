'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Shield, Bell, Loader2 } from 'lucide-react';
import { obterPerfilPaciente } from '@/app/_actions/documentos-paciente-self';

interface Perfil {
  nome: string;
  email: string;
  telefone: string | null;
}

export default function ConfiguracoesPacientePage() {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    obterPerfilPaciente().then((res) => {
      if (res.sucesso && res.dados) {
        setPerfil({
          nome: res.dados.nome ?? '—',
          email: res.dados.email ?? '—',
          telefone: res.dados.telefone ?? null,
        });
      }
      setCarregando(false);
    });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Gerencie seu perfil e preferências</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Meu Perfil */}
        <Card className="border-border/40 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <User className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-base">Meu Perfil</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {carregando ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nome</span>
                  <span className="font-medium">{perfil?.nome ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">E-mail</span>
                  <span className="font-medium">{perfil?.email ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Telefone</span>
                  <span className="font-medium">{perfil?.telefone ?? 'Não informado'}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Notificações */}
        <Card className="border-border/40 shadow-sm">
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

        {/* Privacidade */}
        <Card className="border-border/40 shadow-sm md:col-span-2">
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
