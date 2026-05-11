'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { obterPerfilMedico, obterUrlGoogleCalendar } from '@/app/(medico)/_actions/configuracoes';
import {
  Calendar,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Settings,
  Shield,
  User,
} from 'lucide-react';

/**
 * Página de configurações do médico.
 * Exibe perfil real do banco + botão funcional para conectar Google Calendar.
 */
export default function ConfiguracoesPage() {
  const searchParams = useSearchParams();
  const [perfil, setPerfil] = useState<{
    nome: string;
    email: string;
    crm: string;
    especialidade: string;
    bio: string | null;
    googleConectado: boolean;
    medicoId: string;
  } | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [conectandoGoogle, setConectandoGoogle] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const res = await obterPerfilMedico();
    if (res.sucesso && res.dados) {
      setPerfil(res.dados);
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Verificar resultado do OAuth do Google Calendar
  useEffect(() => {
    const googleParam = searchParams.get('google');
    if (googleParam === 'sucesso') {
      toast.success('Google Calendar conectado com sucesso!');
      carregar(); // Recarregar para atualizar status
    } else if (googleParam === 'erro') {
      const motivo = searchParams.get('motivo');
      const mensagens: Record<string, string> = {
        negado: 'Você negou a autorização do Google Calendar.',
        parametros: 'Parâmetros inválidos no callback.',
        token: 'Erro ao obter token de acesso do Google.',
      };
      toast.error(mensagens[motivo ?? ''] ?? 'Erro ao conectar Google Calendar.');
    }
  }, [searchParams, carregar]);

  async function handleConectarGoogle() {
    if (!perfil) return;
    setConectandoGoogle(true);
    try {
      const res = await obterUrlGoogleCalendar(perfil.medicoId);
      if (res.sucesso && res.dados?.url) {
        // Redireciona para o Google OAuth
        window.location.href = res.dados.url;
      } else {
        toast.error(res.erro ?? 'Erro ao gerar URL de autorização.');
        setConectandoGoogle(false);
      }
    } catch {
      toast.error('Erro ao conectar com o Google.');
      setConectandoGoogle(false);
    }
  }

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie seu perfil e integrações
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Perfil Profissional */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <User size={20} className="text-primary" />
              </div>
              <CardTitle className="text-base">Perfil Profissional</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nome</span>
              <span className="font-medium">{perfil?.nome ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">E-mail</span>
              <span className="font-medium">{perfil?.email ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">CRM</span>
              <span className="font-medium">{perfil?.crm ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Especialidade</span>
              <span className="font-medium">{perfil?.especialidade ?? '—'}</span>
            </div>
            {perfil?.bio && (
              <div className="pt-2">
                <span className="text-muted-foreground">Bio</span>
                <p className="mt-1 text-sm">{perfil.bio}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Google Calendar */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
                <Calendar size={20} className="text-violet-600" />
              </div>
              <CardTitle className="text-base">Google Calendar</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              {perfil?.googleConectado ? (
                <Badge className="gap-1 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20">
                  <CheckCircle2 size={12} />
                  Conectado
                </Badge>
              ) : (
                <Badge variant="outline" className="text-amber-600">
                  Não conectado
                </Badge>
              )}
            </div>

            {perfil?.googleConectado ? (
              <p className="text-xs text-muted-foreground">
                Seu Google Calendar está integrado. As consultas agendadas criarão eventos automaticamente com link do Google Meet.
              </p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Conecte seu Google Calendar para agendar consultas automaticamente
                  com link do Google Meet.
                </p>
                <Button
                  onClick={handleConectarGoogle}
                  disabled={conectandoGoogle}
                  className="w-full gap-2"
                  variant="outline"
                >
                  {conectandoGoogle ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <ExternalLink size={16} />
                  )}
                  {conectandoGoogle ? 'Redirecionando...' : 'Conectar Google Calendar'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Preferências */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
                <Settings size={20} className="text-amber-600" />
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

        {/* Segurança */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                <Shield size={20} className="text-emerald-600" />
              </div>
              <CardTitle className="text-base">Segurança</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Autenticação</span>
              <Badge className="gap-1 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20">
                <CheckCircle2 size={12} />
                Clerk ativo
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Sua conta é protegida pela autenticação Clerk com sessão segura.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
