'use client';

import { useUser, useClerk } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Camera,
  Mail,
  Smartphone,
  User,
  Pencil,
  Check,
  X,
  Shield,
  Loader2,
  CalendarDays,
  KeyRound,
  Settings,
  ShieldCheck,
  Lock,
  BadgeCheck,
} from 'lucide-react';
import { useRef, useState, useEffect } from 'react';
import { toast } from 'sonner';
import { obterPerfilContato, atualizarTelefonePaciente } from '@/app/_actions/perfil-paciente';

/**
 * Página "Meu Perfil" do Admin.
 * Design Organic — fundo creme, terracota, verde musgo, Fraunces + Epilogue, grain, breathe.
 * Espelha fielmente a estrutura do perfil do paciente, adaptada ao contexto administrativo.
 */
export default function PerfilAdminPage() {
  const { user, isLoaded } = useUser();
  const { openUserProfile } = useClerk();

  /* ── Edição de nome ────────────────────────────────────────── */
  const [editandoNome, setEditandoNome] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [salvandoNome, setSalvandoNome] = useState(false);

  /* ── Avatar upload ─────────────────────────────────────────── */
  const [uploadandoAvatar, setUploadandoAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── Telefone (banco, sem Clerk Pro) ──────────────────────── */
  const [telefoneDb, setTelefoneDb] = useState<string | null>(null);
  const [editandoTelefone, setEditandoTelefone] = useState(false);
  const [telefoneInput, setTelefoneInput] = useState('');
  const [salvandoTelefone, setSalvandoTelefone] = useState(false);

  useEffect(() => {
    obterPerfilContato().then((res) => {
      if (res.sucesso && res.dados) setTelefoneDb(res.dados.telefone);
    });
  }, []);

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

  const nomeCompleto = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Administrador';
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

        {/* Faixa terracota — título da área */}
        <div className="relative bg-gradient-to-r from-primary to-primary/85 px-6 py-4 sm:px-8 grain overflow-hidden">
          <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute bottom-0 left-1/3 h-20 w-40 rounded-full bg-white/5 blur-3xl" />
          <div className="relative z-10">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/60">
              Área Administrativa
            </p>
            <h1 className="font-heading text-xl font-bold tracking-tight text-white sm:text-2xl">
              Meu Perfil
            </h1>
          </div>
        </div>

        {/* Card de identidade — avatar + nome */}
        <div className="bg-card px-6 py-6 sm:px-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">

            {/* Avatar com breathe e botão de câmera */}
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

            {/* Nome + badges admin */}
            <div className="flex-1 min-w-0">
              {editandoNome ? (
                <div className="max-w-sm space-y-3 animate-fade-in">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="fn-admin" className="text-xs text-muted-foreground">Nome</Label>
                      <Input
                        id="fn-admin"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="h-9 text-sm"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && salvarNome()}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="ln-admin" className="text-xs text-muted-foreground">Sobrenome</Label>
                      <Input
                        id="ln-admin"
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
                  <p className="mt-0.5 text-sm text-muted-foreground">Administrador</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-1 text-[11px] font-medium text-red-600">
                      <Shield className="h-3 w-3" /> Acesso total
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

          {/* E-mail — somente leitura */}
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

          {/* Telefone — editável via banco */}
          <div className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-5 shadow-sm transition-all hover:border-primary/20 hover:shadow-md grain">
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
                      aria-label="Salvar"
                    >
                      {salvandoTelefone ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                    </button>
                    <button
                      onClick={() => setEditandoTelefone(false)}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-muted-foreground transition-all hover:bg-accent"
                      aria-label="Cancelar"
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
                      aria-label="Editar telefone"
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
          <button
            onClick={() => openUserProfile()}
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Gerenciar conta
          </button>
          . O telefone pode ser editado diretamente acima.
        </p>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SEGURANÇA
          ═══════════════════════════════════════════════════════ */}
      <section className="animate-fade-up delay-200">
        <h2 className="font-heading mb-4 text-xl font-semibold tracking-tight">Segurança</h2>
        <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-6 shadow-sm grain">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/15 to-emerald-500/5">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">Controle total da sua conta</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Gerencie senha, autenticação em dois fatores e dispositivos conectados diretamente pelo painel de segurança.
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

      {/* ═══════════════════════════════════════════════════════
          PERMISSÕES — resumo do nível de acesso
          ═══════════════════════════════════════════════════════ */}
      <section className="animate-fade-up delay-300 pb-4">
        <h2 className="font-heading mb-4 text-xl font-semibold tracking-tight">Nível de Acesso</h2>
        <div className="relative overflow-hidden rounded-2xl border border-red-200/60 bg-red-500/[0.03] p-6 shadow-sm grain">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500/20 to-red-500/5">
              <Shield className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-red-700">Administrador da plataforma</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Você possui acesso irrestrito a todas as funcionalidades da plataforma Be4Hope — incluindo gestão de usuários, médicos, pacientes, triagens, invoices e auditoria.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  'Gerenciar usuários',
                  'Atribuir médicos',
                  'Ver triagens',
                  'Gerir recompras',
                  'Acessar auditoria',
                  'Gerenciar invoices',
                ].map((perm) => (
                  <span
                    key={perm}
                    className="flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-1 text-[11px] font-medium text-red-600"
                  >
                    <Check className="h-3 w-3" />
                    {perm}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
