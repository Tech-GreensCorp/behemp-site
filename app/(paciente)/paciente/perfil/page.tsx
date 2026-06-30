'use client';

import { useUser, useClerk } from '@clerk/nextjs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Camera,
  Mail,
  Smartphone,
  User,
  Pencil,
  Check,
  X,
  FileText,
  AlertTriangle,
  ShieldCheck,
  Upload,
  ChevronRight,
  Loader2,
  CalendarDays,
  Clock,
  Heart,
  FileCheck,
  ExternalLink,
  Bell,
  MapPin,
  Home,
  Map,
  Fingerprint,
  Lock,
} from 'lucide-react';
import Link from 'next/link';
import { useRef, useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { listarDocumentosPaciente } from '@/app/_actions/documentos-paciente-self';
import { 
  obterPerfilCompletoPaciente, 
  atualizarPerfilCompletoPaciente,
  excluirMinhaConta
} from '@/app/_actions/perfil-paciente';

export default function PerfilPacientePage() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();

  /* ── Edição de nome ───────────────────────────────────────── */
  const [editandoNome, setEditandoNome] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [salvandoNome, setSalvandoNome] = useState(false);

  /* ── Avatar upload ────────────────────────────────────────── */
  const [uploadandoAvatar, setUploadandoAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── Dados completos do banco ──────────────────────────────── */
  const [perfil, setPerfil] = useState<{
    telefone: string | null;
    cep: string | null;
    endereco: string | null;
    cidade: string | null;
    uf: string | null;
    cpf: string | null;
    rg: string | null;
    genero: string | null;
    dataNascimento: string | null;
  } | null>(null);
  const [carregandoPerfil, setCarregandoPerfil] = useState(true);

  /* ── Form contato ────────────────────────────────────────── */
  const [contatoForm, setContatoForm] = useState({
    telefone: '',
    cep: '',
    endereco: '',
    cidade: '',
    uf: '',
  });
  const [editandoContato, setEditandoContato] = useState(false);
  const [salvandoContato, setSalvandoContato] = useState(false);

  /* ── Form pessoal ────────────────────────────────────────── */
  const [pessoalForm, setPessoalForm] = useState({
    cpf: '',
    rg: '',
    genero: '',
    dataNascimento: '',
  });
  const [editandoPessoal, setEditandoPessoal] = useState(false);
  const [salvandoPessoal, setSalvandoPessoal] = useState(false);

  /* ── Exclusão e Segurança de Conta ───────────────────────── */
  const [modalSenhaAberto, setModalSenhaAberto] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarNovaSenha, setConfirmarNovaSenha] = useState('');
  const [salvandoSenha, setSalvandoSenha] = useState(false);

  const [modalExcluirAberto, setModalExcluirAberto] = useState(false);
  const [excluindoConta, setExcluindoConta] = useState(false);

  /* ── Documentos ──────────────────────────────────────────── */
  const [docs, setDocs] = useState<any[]>([]);
  const [carregandoDocs, setCarregandoDocs] = useState(true);

  const carregarDocs = useCallback(async () => {
    setCarregandoDocs(true);
    const res = await listarDocumentosPaciente();
    if (res.sucesso && res.dados) setDocs(res.dados as any[]);
    setCarregandoDocs(false);
  }, []);

  const carregarPerfil = useCallback(async () => {
    setCarregandoPerfil(true);
    const res = await obterPerfilCompletoPaciente();
    if (res.sucesso && res.dados) {
      const d = res.dados;
      setPerfil({
        telefone: d.telefone,
        cep: d.cep,
        endereco: d.endereco,
        cidade: d.cidade,
        uf: d.uf,
        cpf: d.cpf,
        rg: d.rg,
        genero: d.genero,
        dataNascimento: d.dataNascimento,
      });
      setContatoForm({
        telefone: d.telefone ?? '',
        cep: d.cep ?? '',
        endereco: d.endereco ?? '',
        cidade: d.cidade ?? '',
        uf: d.uf ?? '',
      });
      setPessoalForm({
        cpf: d.cpf ?? '',
        rg: d.rg ?? '',
        genero: d.genero ?? '',
        dataNascimento: d.dataNascimento ?? '',
      });
    }
    setCarregandoPerfil(false);
  }, []);

  useEffect(() => {
    carregarPerfil();
    carregarDocs();
  }, [carregarPerfil, carregarDocs]);

  async function salvarContato() {
    setSalvandoContato(true);
    const res = await atualizarPerfilCompletoPaciente({
      telefone: contatoForm.telefone.trim(),
      cep: contatoForm.cep.trim(),
      endereco: contatoForm.endereco.trim(),
      cidade: contatoForm.cidade.trim(),
      uf: contatoForm.uf.trim(),
    });
    setSalvandoContato(false);
    if (res.sucesso) {
      toast.success('Informações de contato atualizadas!');
      setEditandoContato(false);
      carregarPerfil();
    } else {
      toast.error(res.erro || 'Erro ao salvar contato');
    }
  }

  async function salvarPessoal() {
    setSalvandoPessoal(true);
    const res = await atualizarPerfilCompletoPaciente({
      cpf: pessoalForm.cpf.trim(),
      rg: pessoalForm.rg.trim(),
      genero: pessoalForm.genero.trim(),
      dataNascimento: pessoalForm.dataNascimento.trim(),
    });
    setSalvandoPessoal(false);
    if (res.sucesso) {
      toast.success('Dados pessoais atualizados!');
      setEditandoPessoal(false);
      carregarPerfil();
    } else {
      toast.error(res.erro || 'Erro ao salvar dados pessoais');
    }
  }

  async function handleAlterarSenha() {
    if (!user) return;
    if (!senhaAtual || !novaSenha || !confirmarNovaSenha) {
      toast.error('Preencha todos os campos da senha.');
      return;
    }
    if (novaSenha !== confirmarNovaSenha) {
      toast.error('A nova senha e a confirmação não coincidem.');
      return;
    }
    setSalvandoSenha(true);
    try {
      await user.updatePassword({
        currentPassword: senhaAtual,
        newPassword: novaSenha,
      });
      toast.success('Senha atualizada com sucesso!');
      setModalSenhaAberto(false);
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmarNovaSenha('');
    } catch (err: any) {
      toast.error(err.errors?.[0]?.message || 'Erro ao alterar a senha. Verifique a senha atual.');
    } finally {
      setSalvandoSenha(false);
    }
  }

  async function executarExclusaoConta() {
    setExcluindoConta(true);
    const res = await excluirMinhaConta();
    setExcluindoConta(false);

    if (res.sucesso) {
      toast.success('Sua conta foi excluída com sucesso.');
      signOut().then(() => {
        window.location.href = '/';
      });
    } else {
      toast.error(res.erro || 'Não foi possível excluir sua conta.');
    }
  }

  if (!isLoaded || carregandoPerfil) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  function iniciarEdicao() {
    setFirstName(user?.firstName ?? '');
    setLastName(user?.lastName ?? '');
    setEditandoNome(true);
  }

  async function salvarNome() {
    if (!user) return;
    const nome = firstName.trim();
    const sobrenome = lastName.trim();
    if (!nome) { toast.error('O nome não pode estar em branco.'); return; }
    setSalvandoNome(true);
    try {
      await user.update({ firstName: nome, lastName: sobrenome });
      toast.success('Nome updated com sucesso!');
      setEditandoNome(false);
    } catch { toast.error('Erro ao atualizar o nome.'); }
    finally { setSalvandoNome(false); }
  }

  function cancelarEdicao() {
    setEditandoNome(false);
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadandoAvatar(true);
    try {
      await user.setProfileImage({ file });
      toast.success('Foto atualizada!');
    } catch { toast.error('Erro ao enviar a foto.'); }
    finally { setUploadandoAvatar(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  }

  const nomeCompleto = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Paciente';
  const email = user?.emailAddresses[0]?.emailAddress || 'Não informado';
  const docsPendentes = docs.filter((d) => d.dataValidade && new Date(d.dataValidade) < new Date()).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-12">

      {/* ── Top Header Section (Estilo Editorial Landing Page) ── */}
      <div className="animate-fade-up">
        <p className="text-primary mb-3 text-xs font-semibold tracking-[0.25em] uppercase">
          Área do Paciente
        </p>
        <h1 className="font-display text-4xl leading-[1.1] font-bold tracking-tight sm:text-5xl">
          Meu <span className="text-accent-italic">Perfil</span>
        </h1>
        <p className="text-muted-foreground mt-4 max-w-2xl text-base leading-relaxed">
          Gerencie suas informações pessoais, dados de contato e acompanhe com transparência os documentos vinculados ao seu tratamento.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3 items-start animate-fade-up delay-100">

        {/* Coluna da Esquerda (Identidade + Dados Pessoais) */}
        <div className="lg:col-span-2 space-y-8">

          {/* Card de Identidade */}
          <Card className="border border-border/30 bg-card shadow-sm rounded-3xl p-6 grain relative overflow-hidden transition-all hover:shadow-md">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">

              {/* Avatar (Fixo/Sem movimento) */}
              <div className="relative shrink-0 w-fit">
                <div className="h-24 w-24 overflow-hidden rounded-2xl border-4 border-background shadow-md sm:h-28 sm:w-28 bg-muted">
                  {user?.imageUrl ? (
                    <img src={user.imageUrl} alt="Foto de perfil" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                      <User size={38} className="text-primary/60" />
                    </div>
                  )}
                  {uploadandoAvatar && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50 backdrop-blur-sm">
                      <Loader2 className="h-6 w-6 animate-spin text-white" />
                    </div>
                  )}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadandoAvatar}
                  className="absolute -right-1 -bottom-1 flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md transition-all hover:scale-110 active:scale-95 disabled:opacity-50"
                  aria-label="Alterar foto"
                >
                  <Camera size={14} />
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </div>

              {/* Nome + Badges */}
              <div className="flex-1 min-w-0">
                {editandoNome ? (
                  <div className="max-w-sm space-y-3 animate-fade-in">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor="fn" className="text-xs text-muted-foreground">Nome</Label>
                        <Input id="fn" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="h-9 rounded-xl text-sm border-border/40 focus:ring-primary/20" autoFocus onKeyDown={(e) => e.key === 'Enter' && salvarNome()} />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="ln" className="text-xs text-muted-foreground">Sobrenome</Label>
                        <Input id="ln" value={lastName} onChange={(e) => setLastName(e.target.value)} className="h-9 rounded-xl text-sm border-border/40 focus:ring-primary/20" onKeyDown={(e) => e.key === 'Enter' && salvarNome()} />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={salvarNome} disabled={salvandoNome} className="gap-1.5 rounded-full bg-primary hover:bg-primary/95 text-white">
                        {salvandoNome ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        Salvar
                      </Button>
                      <Button size="sm" variant="outline" onClick={cancelarEdicao} disabled={salvandoNome} className="gap-1.5 rounded-full">
                        <X className="h-3.5 w-3.5" /> Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="group">
                    <div className="flex items-center gap-3">
                      <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground truncate">{nomeCompleto}</h2>
                      <button
                        onClick={iniciarEdicao}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-all hover:bg-accent hover:text-foreground group-hover:opacity-100"
                        aria-label="Editar nome"
                      >
                        <Pencil size={12} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary uppercase tracking-wider border border-primary/20">
                        Paciente
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Card de Dados Pessoais */}
          <Card className="border border-border/30 bg-card shadow-sm rounded-3xl grain overflow-hidden transition-all hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/20">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-base font-semibold text-foreground">Dados Pessoais</CardTitle>
              </div>
              {!editandoPessoal && (
                <Button variant="ghost" size="sm" onClick={() => setEditandoPessoal(true)} className="h-8 gap-1 rounded-xl text-xs text-muted-foreground hover:text-foreground">
                  <Pencil size={12} /> Editar
                </Button>
              )}
            </CardHeader>

            <CardContent className="p-6 text-sm">
              {editandoPessoal ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="cpf" className="text-xs text-muted-foreground">CPF</Label>
                    <Input id="cpf" value={pessoalForm.cpf} onChange={(e) => setPessoalForm({ ...pessoalForm, cpf: e.target.value })} className="h-9 rounded-xl text-sm" placeholder="000.000.000-00" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="rg" className="text-xs text-muted-foreground">RG</Label>
                    <Input id="rg" value={pessoalForm.rg} onChange={(e) => setPessoalForm({ ...pessoalForm, rg: e.target.value })} className="h-9 rounded-xl text-sm" placeholder="00.000.000-0" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="genero" className="text-xs text-muted-foreground">Gênero</Label>
                    <select
                      id="genero"
                      value={pessoalForm.genero}
                      onChange={(e) => setPessoalForm({ ...pessoalForm, genero: e.target.value })}
                      className="flex h-9 w-full rounded-xl border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="">Não informado</option>
                      <option value="Masculino">Masculino</option>
                      <option value="Feminino">Feminino</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="nasc" className="text-xs text-muted-foreground">Data de Nascimento</Label>
                    <Input id="nasc" type="date" value={pessoalForm.dataNascimento} onChange={(e) => setPessoalForm({ ...pessoalForm, dataNascimento: e.target.value })} className="h-9 rounded-xl text-sm" />
                  </div>
                  <div className="sm:col-span-2 flex gap-2 pt-2">
                    <Button size="sm" onClick={salvarPessoal} disabled={salvandoPessoal} className="gap-1.5 rounded-full bg-primary hover:bg-primary/95 text-white">
                      {salvandoPessoal ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      Salvar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setEditandoPessoal(false); setPessoalForm({ cpf: perfil?.cpf ?? '', rg: perfil?.rg ?? '', genero: perfil?.genero ?? '', dataNascimento: perfil?.dataNascimento ?? '' }); }} disabled={salvandoPessoal} className="gap-1.5 rounded-full">
                      <X className="h-3.5 w-3.5" /> Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="flex items-start gap-3 py-1">
                    <Fingerprint size={18} className="text-primary/70 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">CPF</p>
                      <p className="text-sm font-semibold text-foreground mt-0.5">{perfil?.cpf || <span className="text-muted-foreground font-normal">Não informado</span>}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 py-1">
                    <FileText size={18} className="text-primary/70 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">RG</p>
                      <p className="text-sm font-semibold text-foreground mt-0.5">{perfil?.rg || <span className="text-muted-foreground font-normal">Não informado</span>}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 py-1">
                    <Heart size={18} className="text-primary/70 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">Gênero</p>
                      <p className="text-sm font-semibold text-foreground mt-0.5">{perfil?.genero || <span className="text-muted-foreground font-normal">Não informado</span>}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 py-1">
                    <CalendarDays size={18} className="text-primary/70 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">Data de Nascimento</p>
                      <p className="text-sm font-semibold text-foreground mt-0.5">
                        {perfil?.dataNascimento ? new Date(perfil.dataNascimento + 'T00:00:00').toLocaleDateString('pt-BR') : <span className="text-muted-foreground font-normal">Não informado</span>}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Coluna da Direita (Informações de Contato) */}
        <div>
          <Card className="border border-border/30 bg-card shadow-sm rounded-3xl grain overflow-hidden transition-all hover:shadow-md h-full flex flex-col justify-between">
            <div>
              <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/20">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <Smartphone className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-base font-semibold text-foreground">Contato</CardTitle>
                </div>
                {!editandoContato && (
                  <Button variant="ghost" size="sm" onClick={() => setEditandoContato(true)} className="h-8 gap-1 rounded-xl text-xs text-muted-foreground hover:text-foreground">
                    <Pencil size={12} /> Editar
                  </Button>
                )}
              </CardHeader>

              <CardContent className="p-6 space-y-5 text-sm">
                {editandoContato ? (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="tel" className="text-xs text-muted-foreground">Telefone</Label>
                      <Input id="tel" value={contatoForm.telefone} onChange={(e) => setContatoForm({ ...contatoForm, telefone: e.target.value })} className="h-9 rounded-xl text-sm" placeholder="(11) 99999-9999" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="cep" className="text-xs text-muted-foreground">CEP</Label>
                      <Input id="cep" value={contatoForm.cep} onChange={(e) => setContatoForm({ ...contatoForm, cep: e.target.value })} className="h-9 rounded-xl text-sm" placeholder="00000-000" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="end" className="text-xs text-muted-foreground">Endereço</Label>
                      <Input id="end" value={contatoForm.endereco} onChange={(e) => setContatoForm({ ...contatoForm, endereco: e.target.value })} className="h-9 rounded-xl text-sm" placeholder="Rua, número, complemento" />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2 space-y-1">
                        <Label htmlFor="cid" className="text-xs text-muted-foreground">Cidade</Label>
                        <Input id="cid" value={contatoForm.cidade} onChange={(e) => setContatoForm({ ...contatoForm, cidade: e.target.value })} className="h-9 rounded-xl text-sm" placeholder="Cidade" />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="uf" className="text-xs text-muted-foreground">UF</Label>
                        <Input id="uf" value={contatoForm.uf} onChange={(e) => setContatoForm({ ...contatoForm, uf: e.target.value })} className="h-9 rounded-xl text-sm" placeholder="SP" maxLength={2} />
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button size="sm" onClick={salvarContato} disabled={salvandoContato} className="gap-1.5 rounded-full bg-primary hover:bg-primary/95 text-white">
                        {salvandoContato ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        Salvar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setEditandoContato(false); setContatoForm({ telefone: perfil?.telefone ?? '', cep: perfil?.cep ?? '', endereco: perfil?.endereco ?? '', cidade: perfil?.cidade ?? '', uf: perfil?.uf ?? '' }); }} disabled={salvandoContato} className="gap-1.5 rounded-full">
                        <X className="h-3.5 w-3.5" /> Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 pb-3 border-b border-border/10">
                      <Mail size={18} className="text-primary/70 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">E-mail</p>
                        <p className="truncate text-sm font-semibold text-foreground mt-0.5">{email}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 pb-3 border-b border-border/10">
                      <Smartphone size={18} className="text-primary/70 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">Telefone</p>
                        <p className="text-sm font-semibold text-foreground mt-0.5">{perfil?.telefone || <span className="text-muted-foreground font-normal">Não informado</span>}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 pb-3 border-b border-border/10">
                      <MapPin size={18} className="text-primary/70 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">CEP</p>
                        <p className="text-sm font-semibold text-foreground mt-0.5">{perfil?.cep || <span className="text-muted-foreground font-normal">Não informado</span>}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 pb-3 border-b border-border/10">
                      <Home size={18} className="text-primary/70 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">Endereço</p>
                        <p className="text-sm font-semibold text-foreground mt-0.5">{perfil?.endereco || <span className="text-muted-foreground font-normal">Não informado</span>}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Map size={18} className="text-primary/70 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">Cidade / UF</p>
                        <p className="text-sm font-semibold text-foreground mt-0.5">
                          {perfil?.cidade || perfil?.uf ? `${perfil.cidade || ''} - ${perfil.uf || ''}` : <span className="text-muted-foreground font-normal">Não informado</span>}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </div>
            <div className="p-4 text-[11px] text-muted-foreground border-t border-border/15 bg-muted/20">
              O e-mail é gerido através do sistema seguro Be4Hope.
            </div>
          </Card>
        </div>

      </div>

      {/* ═══════════════════════════════════════════════════════
          DOCUMENTOS
          ═══════════════════════════════════════════════════════ */}
      <section className="animate-fade-up delay-200 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground">
              Meus <span className="text-accent-italic">Documentos</span>
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Gerenciamento de documentos vinculados ao seu tratamento</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {docsPendentes > 0 && (
              <span className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5" />
                {docsPendentes} {docsPendentes === 1 ? 'documento vencido' : 'documentos vencidos'}
              </span>
            )}
            <Link
              href="/paciente/documentos"
              className="inline-flex items-center gap-2 rounded-full bg-[#16a34a] hover:bg-[#148f43] text-white font-semibold shadow-md hover:shadow-lg transition-all duration-200 px-6 py-2.5 text-sm cursor-pointer border-0"
            >
              <Upload className="h-4 w-4 shrink-0" />
              <span>Enviar Documento</span>
            </Link>
          </div>
        </div>

        {/* Lista de documentos reais */}
        {carregandoDocs ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : docs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-border/60 py-12 text-center bg-card">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <FileText className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Nenhum documento enviado ainda</p>
            <Link
              href="/paciente/documentos"
              className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-secondary/30 bg-background px-4 py-2 text-xs font-semibold shadow-sm transition-colors hover:bg-accent text-foreground"
            >
              <Upload className="h-3.5 w-3.5" /> Enviar agora
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {docs.slice(0, 4).map((doc: any) => {
              const vencido = doc.dataValidade && new Date(doc.dataValidade + 'T00:00:00') < new Date();
              const TIPO_LABELS: Record<string, string> = {
                rg: 'RG', receita_medica: 'Receita Médica',
                comprovante_residencia: 'Comprovante de Residência',
                autorizacao_anvisa: 'Autorização Anvisa',
                oficio_anvisa: 'Ofício da Anvisa',
                documento_pessoal: 'Documento Pessoal',
              };
              return (
                <div key={doc.id} className="group flex items-center gap-4 rounded-3xl border border-border/40 bg-card px-5 py-4 transition-all hover:border-primary/20 hover:shadow-md">
                  {/* Ícone */}
                  <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', vencido ? 'bg-red-500/10' : 'bg-primary/10')}>
                    <FileCheck className={cn('h-5 w-5', vencido ? 'text-red-500' : 'text-primary')} />
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-snug text-foreground">{TIPO_LABELS[doc.tipo] ?? doc.tipo}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{doc.nomeArquivo}</p>
                  </div>

                  {/* Validade + Status */}
                  <div className="hidden items-center gap-3 sm:flex">
                    {doc.dataValidade && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(doc.dataValidade + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </span>
                    )}
                    <span className={cn(
                      'flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold',
                      vencido ? 'bg-red-500/10 text-red-600' : 'bg-emerald-500/10 text-emerald-700'
                    )}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', vencido ? 'bg-red-500' : 'bg-emerald-500')} />
                      {vencido ? 'Vencido' : 'Válido'}
                    </span>
                  </div>

                  {/* Ver */}
                  <a href={doc.urlBlob} target="_blank" rel="noopener noreferrer"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-all hover:bg-accent hover:text-foreground group-hover:opacity-100"
                    aria-label="Visualizar"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              );
            })}
          </div>
        )}

        {docs.length > 0 && (
          <Link href="/paciente/documentos" className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border/80 py-4 text-sm font-semibold text-muted-foreground transition-all hover:border-primary/30 hover:bg-primary/5 hover:text-primary bg-card/30">
            Ver todos os documentos
            <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </section>

      {/* ── Dados Clínicos, Preferências & Segurança/Conta ── */}
      <div className="grid gap-8 md:grid-cols-3 animate-fade-up delay-300">

        {/* Dados Clínicos Card */}
        <Card className="border border-border/30 bg-white shadow-sm rounded-3xl p-6 grain flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#2D4F3C]/10">
              <ShieldCheck className="h-6 w-6 text-[#2D4F3C]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Dados Clínicos</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Diagnóstico, posologias e histórico clínico são geridos estritamente pelo seu médico Be4Hope habilitado. Para solicitar alterações ou novas consultas, contate o atendimento.
              </p>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-border/20">
            <Link href="/paciente/chat" className="inline-flex items-center text-xs font-semibold text-primary hover:underline underline-offset-4">
              Falar com a equipe Be4Hope →
            </Link>
          </div>
        </Card>

        {/* Preferências e Notificações */}
        <Card className="border border-border/40 shadow-sm bg-card grain rounded-3xl p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-border/20">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
                <Bell className="h-5 w-5 text-amber-600" />
              </div>
              <CardTitle className="text-base font-semibold text-foreground">Notificações</CardTitle>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-border/10">
                <span className="text-muted-foreground">E-mail de recompra</span>
                <Badge className="bg-emerald-500/10 text-emerald-700 border-0 font-bold text-[10px] py-0.5 px-2 rounded-full">Ativo</Badge>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border/10">
                <span className="text-muted-foreground">Lembrete de consulta</span>
                <Badge className="bg-emerald-500/10 text-emerald-700 border-0 font-bold text-[10px] py-0.5 px-2 rounded-full">Ativo</Badge>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground">Validade de documento</span>
                <Badge className="bg-emerald-500/10 text-emerald-700 border-0 font-bold text-[10px] py-0.5 px-2 rounded-full">Ativo</Badge>
              </div>
            </div>
          </div>
        </Card>

        {/* Segurança e Configurações de Conta */}
        <Card className="border border-border/40 shadow-sm bg-card grain rounded-3xl p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-border/20">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C34C32]/10">
                <Lock className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-base font-semibold text-foreground">Segurança e Conta</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Gerencie suas credenciais de acesso ou solicite a exclusão de sua conta conforme os direitos garantidos pela LGPD.
            </p>
          </div>
          <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-border/20">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalSenhaAberto(true)}
              className="w-full rounded-xl text-xs font-semibold gap-1.5 h-9"
            >
              <Lock className="h-3.5 w-3.5" /> Alterar Senha
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setModalExcluirAberto(true)}
              className="w-full rounded-xl text-xs font-semibold gap-1.5 h-9"
            >
              <X className="h-3.5 w-3.5" />
              Excluir Minha Conta
            </Button>
          </div>
        </Card>

      </div>

      {/* ── Modal de Alterar Senha ── */}
      <Dialog open={modalSenhaAberto} onOpenChange={setModalSenhaAberto}>
        <DialogContent showCloseButton={false} className="sm:max-w-md bg-white border border-border/30 rounded-3xl p-0 shadow-xl overflow-hidden grain">
          <div className="relative p-6 w-full h-full">
            <DialogClose className="absolute top-4 right-4 z-50 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer border-0 bg-transparent">
              <X className="h-4 w-4" />
            </DialogClose>
            
            <DialogHeader className="space-y-2 text-center pb-4 border-b border-border/10">
              <DialogTitle className="font-display text-2xl font-bold text-foreground">
                Alterar <span className="text-accent-italic">Senha</span>
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Insira as informações abaixo para atualizar sua senha de acesso.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 text-sm text-left">
              <div className="space-y-1.5">
                <Label htmlFor="senha-atual" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Senha Atual
                </Label>
                <Input
                  id="senha-atual"
                  type="password"
                  value={senhaAtual}
                  onChange={(e) => setSenhaAtual(e.target.value)}
                  className="bg-background border-border/40 rounded-xl h-10 px-3 py-2 text-sm focus:ring-1 focus:ring-primary"
                  placeholder="Sua senha atual"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nova-senha" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Nova Senha
                </Label>
                <Input
                  id="nova-senha"
                  type="password"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  className="bg-background border-border/40 rounded-xl h-10 px-3 py-2 text-sm focus:ring-1 focus:ring-primary"
                  placeholder="Mínimo 8 caracteres"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmar-senha" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Confirmar Nova Senha
                </Label>
                <Input
                  id="confirmar-senha"
                  type="password"
                  value={confirmarNovaSenha}
                  onChange={(e) => setConfirmarNovaSenha(e.target.value)}
                  className="bg-background border-border/40 rounded-xl h-10 px-3 py-2 text-sm focus:ring-1 focus:ring-primary"
                  placeholder="Repita a nova senha"
                />
              </div>
            </div>
            <DialogFooter className="flex gap-2 sm:justify-end mt-4 pt-4 border-t border-border/10">
              <Button
                variant="outline"
                onClick={() => setModalSenhaAberto(false)}
                disabled={salvandoSenha}
                className="rounded-full px-5 text-xs font-semibold h-10"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleAlterarSenha}
                disabled={salvandoSenha}
                className="rounded-full px-6 text-xs font-semibold bg-primary text-white hover:bg-primary/90 h-10 cursor-pointer"
              >
                {salvandoSenha ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar Alteração'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal de Confirmação de Exclusão de Conta ── */}
      <Dialog open={modalExcluirAberto} onOpenChange={setModalExcluirAberto}>
        <DialogContent showCloseButton={false} className="sm:max-w-md bg-white border border-border/30 rounded-3xl p-0 shadow-xl overflow-hidden grain">
          <div className="relative p-6 w-full h-full">
            <DialogClose className="absolute top-4 right-4 z-50 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer border-0 bg-transparent">
              <X className="h-4 w-4" />
            </DialogClose>

            <DialogHeader className="space-y-2 text-center pb-4 border-b border-border/10">
              <DialogTitle className="font-heading text-xl font-bold text-foreground">
                Confirmar Exclusão de Conta
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
                Você realmente deseja excluir permanentemente sua conta e todos os dados associados a ela?
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 text-sm text-muted-foreground text-center">
              Esta ação não pode ser desfeita. Todos os seus dados pessoais, histórico e documentos serão removidos.
            </div>
            <DialogFooter className="flex gap-2 sm:justify-end mt-4 pt-4 border-t border-border/10">
              <Button
                variant="outline"
                onClick={() => setModalExcluirAberto(false)}
                disabled={excluindoConta}
                className="rounded-full px-5 text-xs font-semibold h-10"
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={executarExclusaoConta}
                disabled={excluindoConta}
                className="rounded-full px-6 text-xs font-semibold h-10 bg-red-600 hover:bg-red-700 text-white"
              >
                {excluindoConta ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Excluir Conta'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
