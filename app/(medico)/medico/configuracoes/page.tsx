'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  obterPerfilMedico,
  obterUrlGoogleCalendar,
  atualizarPerfilMedico,
} from '@/app/(medico)/_actions/configuracoes';
import {
  Calendar,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Pencil,
  Save,
  Settings,
  Shield,
  User,
  X,
} from 'lucide-react';

/**
 * Página de configurações do médico.
 * Exibe e permite editar o perfil profissional + integração Google Calendar.
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

  // Estado de edição do perfil
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({ crm: '', especialidade: '', bio: '' });

  const carregar = useCallback(async () => {
    setCarregando(true);
    const res = await obterPerfilMedico();
    if (res.sucesso && res.dados) {
      setPerfil(res.dados);
      setForm({
        crm: res.dados.crm ?? '',
        especialidade: res.dados.especialidade ?? '',
        bio: res.dados.bio ?? '',
      });
    }
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // Verificar resultado do OAuth do Google Calendar
  useEffect(() => {
    const googleParam = searchParams.get('google');
    if (googleParam === 'sucesso') {
      toast.success('Google Calendar conectado com sucesso!');
      carregar();
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

  function handleIniciarEdicao() {
    setForm({
      crm: perfil?.crm ?? '',
      especialidade: perfil?.especialidade ?? '',
      bio: perfil?.bio ?? '',
    });
    setEditando(true);
  }

  function handleCancelarEdicao() {
    setEditando(false);
  }

  async function handleSalvarPerfil() {
    setSalvando(true);
    const res = await atualizarPerfilMedico({
      crm: form.crm,
      especialidade: form.especialidade,
      bio: form.bio || null,
    });
    if (res.sucesso) {
      toast.success('Perfil atualizado com sucesso!');
      setEditando(false);
      carregar();
    } else {
      toast.error(res.erro ?? 'Erro ao salvar perfil');
    }
    setSalvando(false);
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
        <Card className="border-0 shadow-sm md:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <User size={20} className="text-primary" />
                </div>
                <CardTitle className="text-base">Perfil Profissional</CardTitle>
              </div>
              {!editando && (
                <Button variant="outline" size="sm" onClick={handleIniciarEdicao} className="gap-2">
                  <Pencil size={14} />
                  Editar
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {/* Nome e e-mail — somente leitura (gerenciados pelo Clerk) */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Nome</Label>
                <p className="font-medium">{perfil?.nome ?? '—'}</p>
                <p className="text-[11px] text-muted-foreground">Gerenciado pela autenticação</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">E-mail</Label>
                <p className="font-medium">{perfil?.email ?? '—'}</p>
                <p className="text-[11px] text-muted-foreground">Gerenciado pela autenticação</p>
              </div>
            </div>

            <div className="h-px bg-border" />

            {editando ? (
              /* ── Modo Edição ── */
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="crm">CRM</Label>
                    <Input
                      id="crm"
                      value={form.crm}
                      onChange={(e) => setForm({ ...form, crm: e.target.value })}
                      placeholder="Ex: CRM/SP 000000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="especialidade">Especialidade</Label>
                    <Input
                      id="especialidade"
                      value={form.especialidade}
                      onChange={(e) => setForm({ ...form, especialidade: e.target.value })}
                      placeholder="Ex: Neurologia, Medicina Endocanabinoide"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bio">Bio / Apresentação</Label>
                  <Textarea
                    id="bio"
                    value={form.bio}
                    onChange={(e) => setForm({ ...form, bio: e.target.value })}
                    placeholder="Descreva sua formação e experiência profissional..."
                    className="min-h-[120px] resize-y"
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {form.bio.length}/2000 caracteres
                  </p>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelarEdicao}
                    disabled={salvando}
                    className="gap-2"
                  >
                    <X size={14} />
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSalvarPerfil}
                    disabled={salvando}
                    className="gap-2"
                  >
                    {salvando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    {salvando ? 'Salvando...' : 'Salvar'}
                  </Button>
                </div>
              </div>
            ) : (
              /* ── Modo Leitura ── */
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">CRM</Label>
                  <p className="font-medium">{perfil?.crm ?? '—'}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Especialidade</Label>
                  <p className="font-medium">{perfil?.especialidade ?? '—'}</p>
                </div>
                {perfil?.bio && (
                  <div className="sm:col-span-2 space-y-1">
                    <Label className="text-xs text-muted-foreground">Bio</Label>
                    <p className="leading-relaxed">{perfil.bio}</p>
                  </div>
                )}
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
