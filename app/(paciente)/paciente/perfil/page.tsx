'use client';

import { useUser, useClerk } from '@clerk/nextjs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
} from 'lucide-react';
import Link from 'next/link';
import { useRef, useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { listarDocumentosPaciente } from '@/app/_actions/documentos-paciente-self';
import { obterPerfilContato, atualizarTelefonePaciente } from '@/app/_actions/perfil-paciente';

export default function PerfilPacientePage() {
  const { user, isLoaded } = useUser();
  const { openUserProfile } = useClerk();

  /* ── Edição de nome ───────────────────────────────────────── */
  const [editandoNome, setEditandoNome] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [salvandoNome, setSalvandoNome] = useState(false);

  /* ── Avatar upload ────────────────────────────────────────── */
  const [uploadandoAvatar, setUploadandoAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── Edição de telefone ───────────────────────────────────── */
  const [telefoneDb, setTelefoneDb] = useState<string | null>(null);
  const [editandoTelefone, setEditandoTelefone] = useState(false);
  const [telefoneInput, setTelefoneInput] = useState('');
  const [salvandoTelefone, setSalvandoTelefone] = useState(false);

  /* ── Documentos reais ─────────────────────────────────────── */
  const [docs, setDocs] = useState<any[]>([]);
  const [carregandoDocs, setCarregandoDocs] = useState(true);

  const carregarDocs = useCallback(async () => {
    setCarregandoDocs(true);
    const res = await listarDocumentosPaciente();
    if (res.sucesso && res.dados) setDocs(res.dados as any[]);
    setCarregandoDocs(false);
  }, []);

  // Carrega telefone do banco (independente do Clerk)
  useEffect(() => {
    obterPerfilContato().then((res) => {
      if (res.sucesso && res.dados) {
        setTelefoneDb(res.dados.telefone);
      }
    });
  }, []);

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

  useEffect(() => { carregarDocs(); }, [carregarDocs]);

  if (!isLoaded) {
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
      toast.success('Nome atualizado com sucesso!');
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
  // Telefone vem do banco (users.telefone), não do Clerk
  const telefone = telefoneDb;
  const dataCriacao = user?.createdAt ? new Date(user.createdAt).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : null;
  const docsPendentes = docs.filter((d) => d.dataValidade && new Date(d.dataValidade) < new Date()).length;

  return (
    <div className="space-y-8">

      {/* ═══════════════════════════════════════════════════════
          HERO — Banner + Card de identidade
          ═══════════════════════════════════════════════════════ */}
      <section className="animate-fade-up overflow-hidden rounded-3xl shadow-lg border border-border/30">

        {/* Faixa vermelha fina — apenas título */}
        <div className="relative bg-gradient-to-r from-primary to-primary/85 px-6 py-4 sm:px-8 grain overflow-hidden">
          <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <div className="relative z-10">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/60">Área do Paciente</p>
            <h1 className="font-heading text-xl font-bold tracking-tight text-white sm:text-2xl">Meu Perfil</h1>
          </div>
        </div>

        {/* Card de identidade — avatar + nome */}
        <div className="bg-card px-6 py-6 sm:px-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">

            {/* Avatar */}
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

            {/* Nome + badges */}
            <div className="flex-1 min-w-0">
              {editandoNome ? (
                <div className="max-w-sm space-y-3 animate-fade-in">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="fn" className="text-xs text-muted-foreground">Nome</Label>
                      <Input id="fn" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="h-9 text-sm" autoFocus onKeyDown={(e) => e.key === 'Enter' && salvarNome()} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="ln" className="text-xs text-muted-foreground">Sobrenome</Label>
                      <Input id="ln" value={lastName} onChange={(e) => setLastName(e.target.value)} className="h-9 text-sm" onKeyDown={(e) => e.key === 'Enter' && salvarNome()} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={salvarNome} disabled={salvandoNome} className="gap-1.5">
                      {salvandoNome ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      Salvar
                    </Button>
                    <Button size="sm" variant="outline" onClick={cancelarEdicao} disabled={salvandoNome} className="gap-1.5">
                      <X className="h-3.5 w-3.5" /> Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="group">
                  <div className="flex items-center gap-2">
                    <h2 className="font-heading text-xl font-bold tracking-tight sm:text-2xl truncate">{nomeCompleto}</h2>
                    <button
                      onClick={iniciarEdicao}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-all hover:bg-accent hover:text-foreground group-hover:opacity-100"
                      aria-label="Editar nome"
                    >
                      <Pencil size={12} />
                    </button>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">Paciente</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                      <ShieldCheck className="h-3 w-3" /> Conta verificada
                    </span>
                    {dataCriacao && (
                      <span className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                        <CalendarDays className="h-3 w-3" /> Desde {dataCriacao}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                      <Heart className="h-3 w-3" /> Tratamento ativo
                    </span>
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
        <h2 className="font-heading mb-4 text-xl font-semibold tracking-tight">Informações de Contato</h2>
        <div className="grid gap-4 sm:grid-cols-2">
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
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50"
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
                      {telefone || <span className="text-muted-foreground">Não informado</span>}
                    </p>
                    <button
                      onClick={() => { setTelefoneInput(telefone ?? ''); setEditandoTelefone(true); }}
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
          Para alterar o e-mail, use <button onClick={() => openUserProfile()} className="font-medium text-primary underline-offset-2 hover:underline">Gerenciar conta</button>. O telefone pode ser editado diretamente acima.
        </p>
      </section>

      {/* ═══════════════════════════════════════════════════════
          DOCUMENTOS
          ═══════════════════════════════════════════════════════ */}
      <section className="animate-fade-up delay-200">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-heading text-xl font-semibold tracking-tight">Meus Documentos</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Documentos vinculados ao seu tratamento</p>
          </div>
          <div className="flex items-center gap-2.5">
            {docsPendentes > 0 && (
              <span className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-700">
                <AlertTriangle className="h-3 w-3" />
                {docsPendentes} {docsPendentes === 1 ? 'documento vencido' : 'documentos vencidos'}
              </span>
            )}
            <Link
              href="/paciente/documentos"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground whitespace-nowrap shadow-sm transition-colors hover:bg-primary/90"
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
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/60 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Nenhum documento enviado ainda</p>
            <Link
              href="/paciente/documentos"
              className="mt-1 inline-flex items-center gap-1.5 rounded-xl border border-input bg-background px-3 py-1.5 text-xs font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Upload className="h-3.5 w-3.5" /> Enviar agora
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
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
                <div key={doc.id} className="group flex items-center gap-4 rounded-2xl border border-border/50 bg-card px-5 py-4 transition-all hover:border-primary/20 hover:shadow-sm">
                  {/* Ícone */}
                  <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', vencido ? 'bg-red-500/10' : 'bg-primary/10')}>
                    <FileCheck className={cn('h-4 w-4', vencido ? 'text-red-500' : 'text-primary')} />
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-snug">{TIPO_LABELS[doc.tipo] ?? doc.tipo}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{doc.nomeArquivo}</p>
                  </div>

                  {/* Validade + Status */}
                  <div className="hidden items-center gap-3 sm:flex">
                    {doc.dataValidade && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(doc.dataValidade + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </span>
                    )}
                    <span className={cn(
                      'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold',
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
          <Link href="/paciente/documentos" className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border/80 py-3.5 text-sm font-medium text-muted-foreground transition-all hover:border-primary/30 hover:bg-primary/5 hover:text-primary">
            Ver todos os documentos
            <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </section>

      {/* ═══════════════════════════════════════════════════════
          DADOS CLÍNICOS
          ═══════════════════════════════════════════════════════ */}
      <section className="animate-fade-up delay-300">
        <h2 className="font-heading mb-4 text-xl font-semibold tracking-tight">Dados Clínicos</h2>
        <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-6 shadow-sm grain">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-semibold">Gerenciados pelo médico responsável</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Diagnóstico, prescrição e histórico clínico são controlados pela equipe médica. Para alterações, entre em contato pelo chat.
              </p>
              <Link href="/paciente/chat" className="mt-2 inline-flex items-center text-xs font-medium text-primary hover:underline underline-offset-2">
                Falar com a equipe →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          PREFERÊNCIAS E PRIVACIDADE — Notificações e LGPD
          ═══════════════════════════════════════════════════════ */}
      <section className="animate-fade-up delay-400">
        <h2 className="font-heading mb-4 text-xl font-semibold tracking-tight">Preferências e Privacidade</h2>
        <div className="grid gap-6 md:grid-cols-2">
          {/* Notificações */}
          <Card className="border-border/40 shadow-sm bg-card grain">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
                  <Bell className="h-5 w-5 text-amber-600" />
                </div>
                <CardTitle className="text-base font-semibold">Notificações por E-mail</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">E-mail de recompra</span>
                <Badge className="bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 font-semibold transition-colors">Ativo</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Lembrete de consulta</span>
                <Badge className="bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 font-semibold transition-colors">Ativo</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Renovação de documento</span>
                <Badge className="bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 font-semibold transition-colors">Ativo</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Privacidade */}
          <Card className="border-border/40 shadow-sm bg-card grain">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                </div>
                <CardTitle className="text-base font-semibold">Privacidade e LGPD</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-relaxed">
              <p>
                Seus dados pessoais e clínicos são protegidos conforme a Lei Geral de
                Proteção de Dados (LGPD). Apenas seu médico responsável tem acesso
                aos seus dados clínicos. Todas as operações são registradas em log
                de auditoria.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          AÇÃO — Gerenciar conta
          ═══════════════════════════════════════════════════════ */}
      <div className="animate-fade-up delay-500 pb-4">
        <Button variant="outline" onClick={() => openUserProfile()} className="gap-2 rounded-xl">
          <User className="h-4 w-4" /> Gerenciar conta
        </Button>
      </div>
    </div>
  );
}
