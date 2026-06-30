'use client';

import { useUser, useClerk } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Camera,
  Mail,
  Smartphone,
  User,
  Pencil,
  Check,
  X,
  Stethoscope,
  Loader2,
  CalendarDays,
  KeyRound,
  Settings,
  Lock,
  BadgeCheck,
  BookOpen,
  Building2,
  Save,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';
import { useRef, useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { obterPerfilContato, atualizarTelefonePaciente } from '@/app/_actions/perfil-paciente';
import {
  obterPerfilMedico,
  atualizarPerfilMedico,
  obterUrlGoogleCalendar,
} from '@/app/(medico)/_actions/configuracoes';

/**
 * Página "Meu Perfil" do Médico.
 * Design Organic — fundo creme, terracota, verde musgo, Fraunces + Epilogue, grain, breathe.
 * Espelha o padrão visual do admin e do paciente, adaptado ao contexto médico.
 */
export default function PerfilMedicoPage() {
  const { user, isLoaded } = useUser();
  const { openUserProfile } = useClerk();

  /* ── Edição de nome ─────────────────────────────────────────── */
  const [editandoNome, setEditandoNome]   = useState(false);
  const [firstName, setFirstName]         = useState('');
  const [lastName, setLastName]           = useState('');
  const [salvandoNome, setSalvandoNome]   = useState(false);

  /* ── Avatar ─────────────────────────────────────────────────── */
  const [uploadandoAvatar, setUploadandoAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── Telefone (banco, sem Clerk Pro) ────────────────────────── */
  const [telefoneDb, setTelefoneDb]             = useState<string | null>(null);
  const [editandoTelefone, setEditandoTelefone] = useState(false);
  const [telefoneInput, setTelefoneInput]       = useState('');
  const [salvandoTelefone, setSalvandoTelefone] = useState(false);

  const searchParams = useSearchParams();

  /* ── Dados profissionais (banco médicos) ─────────────────────── */
  const [crm, setCrm]                 = useState<string | null>(null);
  const [especialidade, setEspecialidade] = useState<string | null>(null);
  const [bio, setBio]                 = useState<string | null>(null);
  const [googleConectado, setGoogleConectado] = useState(false);
  const [medicoId, setMedicoId]       = useState<string | null>(null);
  const [carregandoPerfil, setCarregandoPerfil] = useState(true);

  /* ── Edição de dados profissionais ──────────────────────────── */
  const [editandoProfissional, setEditandoProfissional] = useState(false);
  const [salvandoProfissional, setSalvandoProfissional] = useState(false);
  const [crmInput, setCrmInput] = useState('');
  const [especialidadeInput, setEspecialidadeInput] = useState('');
  const [bioInput, setBioInput] = useState('');

  /* ── Google Calendar integration ────────────────────────────── */
  const [conectandoGoogle, setConectandoGoogle] = useState(false);

  const carregarPerfilMedico = useCallback(async () => {
    setCarregandoPerfil(true);
    const res = await obterPerfilMedico();
    if (res.sucesso && res.dados) {
      setCrm(res.dados.crm);
      setEspecialidade(res.dados.especialidade);
      setBio(res.dados.bio);
      setGoogleConectado(res.dados.googleConectado);
      setMedicoId(res.dados.medicoId);
      
      setCrmInput(res.dados.crm ?? '');
      setEspecialidadeInput(res.dados.especialidade ?? '');
      setBioInput(res.dados.bio ?? '');
    }
    setCarregandoPerfil(false);
  }, []);

  useEffect(() => {
    // Carrega telefone
    obterPerfilContato().then((res) => {
      if (res.sucesso && res.dados) setTelefoneDb(res.dados.telefone);
    });

    // Carrega dados profissionais
    carregarPerfilMedico();
  }, [carregarPerfilMedico]);

  // Verificar resultado do OAuth do Google Calendar
  useEffect(() => {
    const googleParam = searchParams?.get('google');
    if (googleParam === 'sucesso') {
      toast.success('Google Calendar conectado com sucesso!');
      carregarPerfilMedico();
    } else if (googleParam === 'erro') {
      const motivo = searchParams?.get('motivo');
      const mensagens: Record<string, string> = {
        negado: 'Você negou a autorização do Google Calendar.',
        parametros: 'Parâmetros inválidos no callback.',
        token: 'Erro ao obter token de acesso do Google.',
      };
      toast.error(mensagens[motivo ?? ''] ?? 'Erro ao conectar Google Calendar.');
    }
  }, [searchParams, carregarPerfilMedico]);

  async function handleConectarGoogle() {
    if (!medicoId) return;
    setConectandoGoogle(true);
    try {
      const res = await obterUrlGoogleCalendar(medicoId);
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

  async function handleSalvarProfissional() {
    if (!crmInput.trim() || !especialidadeInput.trim()) {
      toast.error('CRM e Especialidade são obrigatórios.');
      return;
    }
    setSalvandoProfissional(true);
    const res = await atualizarPerfilMedico({
      crm: crmInput.trim(),
      especialidade: especialidadeInput.trim(),
      bio: bioInput.trim() || null,
    });
    setSalvandoProfissional(false);
    if (res.sucesso) {
      toast.success('Dados profissionais atualizados!');
      setEditandoProfissional(false);
      carregarPerfilMedico();
    } else {
      toast.error(res.erro || 'Erro ao salvar dados profissionais');
    }
  }

  if (!isLoaded) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  function iniciarEdicaoNome() {
    setFirstName(user?.firstName ?? '');
    setLastName(user?.lastName ?? '');
    setEditandoNome(true);
  }

  async function salvarNome() {
    if (!user) return;
    const nome = firstName.trim();
    if (!nome) { toast.error('O nome não pode estar em branco.'); return; }
    setSalvandoNome(true);
    try {
      await user.update({ firstName: nome, lastName: lastName.trim() });
      toast.success('Nome atualizado com sucesso!');
      setEditandoNome(false);
    } catch {
      toast.error('Erro ao atualizar o nome.');
    } finally {
      setSalvandoNome(false);
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadandoAvatar(true);
    try {
      await user.setProfileImage({ file });
      toast.success('Foto atualizada!');
    } catch {
      toast.error('Erro ao enviar a foto.');
    } finally {
      setUploadandoAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function salvarTelefone() {
    setSalvandoTelefone(true);
    const res = await atualizarTelefonePaciente(telefoneInput.trim());
    setSalvandoTelefone(false);
    if (res.sucesso) {
      setTelefoneDb(telefoneInput.trim() || null);
      setEditandoTelefone(false);
      toast.success('Telefone atualizado!');
    } else {
      toast.error(res.erro || 'Erro ao salvar telefone');
    }
  }

  const nomeCompleto = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Médico';
  const email = user?.emailAddresses[0]?.emailAddress || 'Não informado';
  const dataCriacao = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    : null;

  return (
    <div className="space-y-8">

      {/* ═══════════════════════════════════════════════════════
          HERO — Banner + Card de identidade
          ═══════════════════════════════════════════════════════ */}
      <section className="animate-fade-up overflow-hidden rounded-3xl shadow-lg border border-border/30">

        {/* Faixa terracota — mesma cor do admin */}
        <div className="relative overflow-hidden bg-gradient-to-r from-primary to-primary/85 px-6 py-4 sm:px-8 grain">
          <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute bottom-0 left-1/3 h-20 w-40 rounded-full bg-white/5 blur-3xl" />
          <div className="relative z-10">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/60">
              Área Médica
            </p>
            <h1 className="font-heading text-xl font-bold tracking-tight text-white sm:text-2xl">
              Meu Perfil
            </h1>
          </div>
        </div>

        {/* Card de identidade — avatar + nome */}
        <div className="bg-card px-6 py-6 sm:px-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">

            {/* Avatar com breathe */}
            <div className="relative shrink-0">
              <div className="animate-breathe h-20 w-20 overflow-hidden rounded-2xl border-4 border-background shadow-md sm:h-24 sm:w-24">
                {user?.imageUrl ? (
                  <img src={user.imageUrl} alt="Foto de perfil" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                    <User size={34} className="text-primary/60" />
                  </div>
                )}
                {uploadandoAvatar && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50 backdrop-blur-sm">
                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                  </div>
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadandoAvatar}
                className="absolute -right-1 -bottom-1 flex h-7 w-7 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md transition-all hover:scale-110 active:scale-95 disabled:opacity-50"
                aria-label="Alterar foto"
              >
                <Camera size={12} />
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>

            {/* Nome + badges médico */}
            <div className="flex-1 min-w-0">
              {editandoNome ? (
                <div className="max-w-sm space-y-3 animate-fade-in">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="fn-med" className="text-xs text-muted-foreground">Nome</Label>
                      <Input
                        id="fn-med"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="h-9 text-sm"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && salvarNome()}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="ln-med" className="text-xs text-muted-foreground">Sobrenome</Label>
                      <Input
                        id="ln-med"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="h-9 text-sm"
                        onKeyDown={(e) => e.key === 'Enter' && salvarNome()}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={salvarNome} disabled={salvandoNome} className="gap-1.5">
                      {salvandoNome ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      Salvar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditandoNome(false)} disabled={salvandoNome} className="gap-1.5">
                      <X className="h-3.5 w-3.5" /> Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="group">
                  <div className="flex items-center gap-2">
                    <h2 className="font-heading text-xl font-bold tracking-tight sm:text-2xl truncate">
                      {nomeCompleto}
                    </h2>
                    <button
                      onClick={iniciarEdicaoNome}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-all hover:bg-accent hover:text-foreground group-hover:opacity-100"
                      aria-label="Editar nome"
                    >
                      <Pencil size={12} />
                    </button>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {especialidade ? `${especialidade} · Médico` : 'Médico'}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                      <Stethoscope className="h-3 w-3" /> Médico
                    </span>
                    <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                      <BadgeCheck className="h-3 w-3" /> Conta verificada
                    </span>
                    {dataCriacao && (
                      <span className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                        <CalendarDays className="h-3 w-3" /> Desde {dataCriacao}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          CONTATO — E-mail e Telefone
          ═══════════════════════════════════════════════════════ */}
      <section className="animate-fade-up delay-100">
        <h2 className="font-heading mb-4 text-xl font-semibold tracking-tight">
          Informações de Contato
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">

          {/* E-mail */}
          <div className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-5 shadow-sm transition-all hover:border-primary/20 hover:shadow-md grain">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5">
                <Mail size={20} className="text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">E-mail</p>
                <p className="mt-0.5 truncate text-sm font-medium">{email}</p>
              </div>
            </div>
          </div>

          {/* Telefone — editável */}
          <div className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-5 shadow-sm transition-all hover:border-secondary/20 hover:shadow-md grain">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/15 to-violet-500/5">
                <Smartphone size={20} className="text-violet-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Telefone</p>
                {editandoTelefone ? (
                  <div className="mt-1.5 flex items-center gap-2">
                    <Input
                      value={telefoneInput}
                      onChange={(e) => setTelefoneInput(e.target.value)}
                      placeholder="(11) 99999-9999"
                      className="h-8 w-full max-w-[180px] text-sm"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') salvarTelefone();
                        if (e.key === 'Escape') setEditandoTelefone(false);
                      }}
                    />
                    <button
                      onClick={salvarTelefone}
                      disabled={salvandoTelefone}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-all hover:bg-primary/90 active:scale-95 disabled:opacity-50"
                    >
                      {salvandoTelefone ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                    </button>
                    <button
                      onClick={() => setEditandoTelefone(false)}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-muted-foreground transition-all hover:bg-accent"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="mt-0.5 truncate text-sm font-medium">
                      {telefoneDb || <span className="text-muted-foreground">Não informado</span>}
                    </p>
                    <button
                      onClick={() => { setTelefoneInput(telefoneDb ?? ''); setEditandoTelefone(true); }}
                      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-all hover:bg-accent hover:text-foreground group-hover:opacity-100"
                    >
                      <Pencil size={12} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        <p className="mt-2.5 text-xs text-muted-foreground">
          Para alterar o e-mail, use{' '}
          <button onClick={() => openUserProfile()} className="font-medium text-primary underline-offset-2 hover:underline">
            Gerenciar conta
          </button>
          . O telefone pode ser editado diretamente acima.
        </p>
      </section>

      {/* ═══════════════════════════════════════════════════════
          DADOS PROFISSIONAIS — CRM e Especialidade (editável)
          ═══════════════════════════════════════════════════════ */}
      <section className="animate-fade-up delay-200">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-xl font-semibold tracking-tight">
            Dados Profissionais
          </h2>
          {!editandoProfissional && !carregandoPerfil && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCrmInput(crm ?? '');
                setEspecialidadeInput(especialidade ?? '');
                setBioInput(bio ?? '');
                setEditandoProfissional(true);
              }}
              className="gap-2 rounded-xl"
            >
              <Pencil size={14} />
              Editar
            </Button>
          )}
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-6 shadow-sm grain">
          {carregandoPerfil ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : editandoProfissional ? (
            /* ── Modo Edição ── */
            <div className="space-y-4 animate-fade-in text-sm">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="crm">CRM</Label>
                  <Input
                    id="crm"
                    value={crmInput}
                    onChange={(e) => setCrmInput(e.target.value)}
                    placeholder="Ex: CRM/SP 000000"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="especialidade">Especialidade</Label>
                  <Input
                    id="especialidade"
                    value={especialidadeInput}
                    onChange={(e) => setEspecialidadeInput(e.target.value)}
                    placeholder="Ex: Neurologia, Medicina Endocanabinoide"
                    className="rounded-xl"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bio">Bio / Apresentação</Label>
                <Textarea
                  id="bio"
                  value={bioInput}
                  onChange={(e) => setBioInput(e.target.value)}
                  placeholder="Descreva sua formação e experiência profissional..."
                  className="min-h-[120px] resize-y rounded-xl"
                />
                <p className="text-xs text-muted-foreground text-right">
                  {bioInput.length}/2000 caracteres
                </p>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditandoProfissional(false)}
                  disabled={salvandoProfissional}
                  className="gap-2 rounded-xl"
                >
                  <X size={14} />
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleSalvarProfissional}
                  disabled={salvandoProfissional}
                  className="gap-2 rounded-xl"
                >
                  {salvandoProfissional ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Salvar
                </Button>
              </div>
            </div>
          ) : (
            /* ── Modo Leitura ── */
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {/* CRM */}
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5">
                    <BookOpen size={16} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">CRM</p>
                    <p className="mt-0.5 text-sm font-medium">{crm || 'Não cadastrado'}</p>
                  </div>
                </div>

                {/* Especialidade */}
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5">
                    <Building2 size={16} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Especialidade</p>
                    <p className="mt-0.5 text-sm font-medium">{especialidade || 'Não informada'}</p>
                  </div>
                </div>
              </div>

              {/* Bio */}
              {bio && (
                <div className="border-t border-border/40 pt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
                    Sobre
                  </p>
                  <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap">{bio}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          INTEGRAÇÕES E PREFERÊNCIAS — Google Calendar e Fuso Horário
          ═══════════════════════════════════════════════════════ */}
      <section className="animate-fade-up delay-300">
        <h2 className="font-heading mb-4 text-xl font-semibold tracking-tight">
          Integrações e Preferências
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          {/* Google Calendar */}
          <Card className="border-border/40 shadow-sm bg-card grain">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
                    <CalendarDays size={20} className="text-violet-600" />
                  </div>
                  <CardTitle className="text-base font-semibold">Google Calendar</CardTitle>
                </div>
                {googleConectado ? (
                  <Badge className="gap-1 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10 font-semibold border-0">
                    <CheckCircle2 size={12} className="h-3 w-3 shrink-0" />
                    Conectado
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-500/[0.02]">
                    Não conectado
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {googleConectado ? (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Seu Google Calendar está integrado. As consultas agendadas criarão eventos automaticamente com link do Google Meet.
                </p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Conecte seu Google Calendar para agendar consultas automaticamente
                    com link do Google Meet.
                  </p>
                  <Button
                    onClick={handleConectarGoogle}
                    disabled={conectandoGoogle}
                    className="w-full gap-2 rounded-xl"
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
          <Card className="border-border/40 shadow-sm bg-card grain">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
                  <Settings size={20} className="text-amber-600" />
                </div>
                <CardTitle className="text-base font-semibold">Preferências</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Idioma</span>
                <span className="font-medium">Português (BR)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Fuso horário</span>
                <span className="font-medium">America/Sao_Paulo</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SEGURANÇA
          ═══════════════════════════════════════════════════════ */}
      <section className="animate-fade-up delay-400 pb-4">
        <h2 className="font-heading mb-4 text-xl font-semibold tracking-tight">Segurança</h2>
        <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-6 shadow-sm grain">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/15 to-emerald-500/5">
              <Stethoscope className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">Segurança da conta</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Gerencie senha, autenticação em dois fatores e sessões ativas pelo painel de conta.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={() => openUserProfile()}
                  className="inline-flex items-center gap-2 rounded-xl border border-border/80 bg-background px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition-all hover:border-primary/30 hover:bg-accent hover:text-primary active:scale-95"
                >
                  <KeyRound className="h-4 w-4" />
                  Alterar senha
                </button>
                <button
                  onClick={() => openUserProfile()}
                  className="inline-flex items-center gap-2 rounded-xl border border-border/80 bg-background px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition-all hover:border-primary/30 hover:bg-accent hover:text-primary active:scale-95"
                >
                  <Lock className="h-4 w-4" />
                  Autenticação em 2 fatores
                </button>
                <button
                  onClick={() => openUserProfile()}
                  className="inline-flex items-center gap-2 rounded-xl border border-border/80 bg-background px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition-all hover:border-primary/30 hover:bg-accent hover:text-primary active:scale-95"
                >
                  <Settings className="h-4 w-4" />
                  Configurações da conta
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
