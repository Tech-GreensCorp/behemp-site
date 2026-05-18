'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  listarUsuariosAdmin,
  atualizarUsuarioAdmin,
  alterarRoleUsuario,
  definirSenhaTemporaria,
} from '@/app/(admin)/_actions/usuarios';
import { toast } from 'sonner';
import {
  Loader2,
  Search,
  Users,
  Shield,
  User,
  Stethoscope,
  Pencil,
  Check,
  X,
  KeyRound,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Smartphone,
  Mail,
  Calendar,
  Eye,
  EyeOff,
  Copy,
  Shuffle,
  AlertTriangle,
} from 'lucide-react';

/**
 * Página de Gerenciamento de Contas — Admin.
 * Edição de nome, telefone, role + definição de senha temporária.
 */

interface UsuarioItem {
  id: string;
  clerkId: string | null;
  nome: string;
  email: string;
  telefone: string | null;
  role: string | null;
  createdAt: Date;
}

type RoleFiltro = 'todos' | 'admin' | 'medico' | 'paciente';

const ROLE_CONFIG: Record<string, { label: string; cor: string; icon: typeof User }> = {
  admin:    { label: 'Admin',    cor: 'bg-red-500/10 text-red-600',          icon: Shield },
  medico:   { label: 'Médico',   cor: 'bg-primary/10 text-primary',          icon: Stethoscope },
  paciente: { label: 'Paciente', cor: 'bg-emerald-500/10 text-emerald-600',  icon: User },
};

const ROLES_OPCOES = ['admin', 'medico', 'paciente'] as const;

/** Gera uma senha aleatória forte de 12 caracteres */
function gerarSenhaAleatoria(): string {
  const upper  = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower  = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const all    = upper + lower + digits;
  let senha = '';
  // Garante ao menos 1 maiúscula e 1 número
  senha += upper[Math.floor(Math.random() * upper.length)];
  senha += digits[Math.floor(Math.random() * digits.length)];
  for (let i = 2; i < 12; i++) {
    senha += all[Math.floor(Math.random() * all.length)];
  }
  // Embaralha
  return senha.split('').sort(() => Math.random() - 0.5).join('');
}

export default function GerenciarContasPage() {
  const { userId: adminClerkId } = useAuth();

  const [usuarios, setUsuarios]         = useState<UsuarioItem[]>([]);
  const [carregando, setCarregando]     = useState(true);
  const [busca, setBusca]               = useState('');
  const [roleFiltro, setRoleFiltro]     = useState<RoleFiltro>('todos');
  const [expandido, setExpandido]       = useState<string | null>(null);

  /* ── Edição de dados ─────────────────────────────────────────── */
  const [editando, setEditando]         = useState<string | null>(null);
  const [nomeInput, setNomeInput]       = useState('');
  const [telefoneInput, setTelefoneInput] = useState('');
  const [salvando, setSalvando]         = useState<string | null>(null);

  /* ── Alterar role ────────────────────────────────────────────── */
  const [alterandoRole, setAlterandoRole] = useState<string | null>(null);

  /* ── Senha temporária ────────────────────────────────────────── */
  // Qual usuário está com o painel de senha aberto
  const [senhaAbertaPara, setSenhaAbertaPara]   = useState<string | null>(null);
  const [senhaInput, setSenhaInput]             = useState('');
  const [senhaVisivel, setSenhaVisivel]         = useState(false);
  const [salvandoSenha, setSalvandoSenha]       = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const res = await listarUsuariosAdmin({ limite: 500 });
    if (res.sucesso && res.dados) {
      setUsuarios(res.dados.usuarios as UsuarioItem[]);
    }
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  /* ── Filtro local ───────────────────────────────────────────── */
  const usuariosFiltrados = useMemo(() => {
    return usuarios.filter((u) => {
      if (roleFiltro !== 'todos' && u.role !== roleFiltro) return false;
      if (busca.trim()) {
        const t = busca.toLowerCase();
        return u.nome.toLowerCase().includes(t) || u.email.toLowerCase().includes(t);
      }
      return true;
    });
  }, [usuarios, busca, roleFiltro]);

  /* ── Handlers de edição ─────────────────────────────────────── */
  function iniciarEdicao(u: UsuarioItem) {
    setEditando(u.id);
    setNomeInput(u.nome);
    setTelefoneInput(u.telefone ?? '');
    setSenhaAbertaPara(null);
    setExpandido(u.id);
  }

  function cancelarEdicao() {
    setEditando(null);
    setNomeInput('');
    setTelefoneInput('');
  }

  async function salvarEdicao(usuarioId: string) {
    setSalvando(usuarioId);
    const res = await atualizarUsuarioAdmin(usuarioId, { nome: nomeInput, telefone: telefoneInput });
    setSalvando(null);
    if (res.sucesso) {
      toast.success('Usuário atualizado!');
      setEditando(null);
      carregar();
    } else {
      toast.error(res.erro || 'Erro ao salvar');
    }
  }

  async function handleAlterarRole(usuarioId: string, novaRole: 'admin' | 'medico' | 'paciente') {
    if (!adminClerkId) return;
    setAlterandoRole(usuarioId);
    const res = await alterarRoleUsuario(usuarioId, novaRole, adminClerkId);
    setAlterandoRole(null);
    if (res.sucesso) {
      toast.success('Role alterada com sucesso!');
      carregar();
    } else {
      toast.error(res.erro || 'Erro ao alterar role');
    }
  }

  /* ── Handlers de senha temporária ──────────────────────────── */
  function abrirPainelSenha(usuarioId: string) {
    const gerada = gerarSenhaAleatoria();
    setSenhaInput(gerada);
    setSenhaVisivel(true);
    setSenhaAbertaPara(usuarioId);
    setEditando(null);
    setExpandido(usuarioId);
  }

  function fecharPainelSenha() {
    setSenhaAbertaPara(null);
    setSenhaInput('');
    setSenhaVisivel(false);
  }

  function copiarSenha() {
    navigator.clipboard.writeText(senhaInput);
    toast.success('Senha copiada para a área de transferência!');
  }

  async function confirmarSenhaTemporaria(clerkId: string | null, nome: string) {
    if (!clerkId) { toast.error('Usuário sem conta Clerk vinculada'); return; }
    if (!senhaInput.trim()) { toast.error('Digite uma senha temporária'); return; }

    setSalvandoSenha(clerkId);
    const res = await definirSenhaTemporaria(clerkId, senhaInput);
    setSalvandoSenha(null);

    if (res.sucesso) {
      toast.success(`Senha temporária definida para ${nome}. Comunique ao usuário.`);
      fecharPainelSenha();
    } else {
      toast.error(res.erro || 'Erro ao definir senha');
    }
  }

  /* ── Contadores ─────────────────────────────────────────────── */
  const contadores = useMemo(() => ({
    todos:    usuarios.length,
    admin:    usuarios.filter(u => u.role === 'admin').length,
    medico:   usuarios.filter(u => u.role === 'medico').length,
    paciente: usuarios.filter(u => u.role === 'paciente').length,
  }), [usuarios]);

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Gerenciamento de Contas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Edite informações, roles e senhas de todos os usuários
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={carregar} className="gap-2">
          <RefreshCw size={14} />
          Atualizar
        </Button>
      </div>

      {/* Filtros rápidos */}
      <div className="flex flex-wrap gap-2">
        {(['todos', 'admin', 'medico', 'paciente'] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRoleFiltro(r)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
              roleFiltro === r
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground'
            }`}
          >
            {r === 'todos' ? 'Todos' : ROLE_CONFIG[r].label}
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${roleFiltro === r ? 'bg-white/20' : 'bg-muted'}`}>
              {contadores[r]}
            </span>
          </button>
        ))}
      </div>

      {/* Busca */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou e-mail..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-9"
        />
        {busca && (
          <button onClick={() => setBusca('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Lista */}
      {carregando ? (
        <div className="flex justify-center py-16">
          <Loader2 size={32} className="animate-spin text-primary" />
        </div>
      ) : usuariosFiltrados.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Users size={40} className="mb-3 text-muted-foreground/30" />
            <p className="font-medium text-muted-foreground">Nenhum usuário encontrado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {usuariosFiltrados.map((u) => {
            const config        = ROLE_CONFIG[u.role ?? 'paciente'] ?? ROLE_CONFIG.paciente;
            const isExpandido   = expandido === u.id;
            const isEditando    = editando === u.id;
            const isSalvando    = salvando === u.id;
            const isAlterandoRole = alterandoRole === u.id;
            const isSenhaPainel = senhaAbertaPara === u.id;
            const isSalvandoSenha = salvandoSenha === u.clerkId;
            const DynIcon       = config.icon;

            return (
              <Card key={u.id} className="border-0 shadow-sm transition-all hover:shadow-md">
                {/* Linha principal */}
                <CardContent className="p-0">
                  <div
                    className="flex cursor-pointer items-center gap-4 p-4"
                    onClick={() => setExpandido(isExpandido ? null : u.id)}
                  >
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${config.cor}`}>
                      <DynIcon size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{u.nome}</p>
                      <p className="truncate text-sm text-muted-foreground">{u.email}</p>
                    </div>
                    <div className="hidden shrink-0 items-center gap-3 sm:flex">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${config.cor}`}>
                        {config.label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(u.createdAt).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    {isExpandido
                      ? <ChevronUp size={16} className="shrink-0 text-muted-foreground" />
                      : <ChevronDown size={16} className="shrink-0 text-muted-foreground" />
                    }
                  </div>

                  {/* Painel expandido */}
                  {isExpandido && (
                    <div className="border-t bg-muted/20 px-4 pb-5 pt-4 space-y-4">

                      {/* ── FORMULÁRIO DE EDIÇÃO DE DADOS ── */}
                      {isEditando ? (
                        <div className="space-y-3">
                          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                            Editar dados
                          </p>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                              <label className="text-xs font-medium text-muted-foreground">Nome completo</label>
                              <Input
                                value={nomeInput}
                                onChange={(e) => setNomeInput(e.target.value)}
                                className="h-9"
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && salvarEdicao(u.id)}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-xs font-medium text-muted-foreground">Telefone</label>
                              <Input
                                value={telefoneInput}
                                onChange={(e) => setTelefoneInput(e.target.value)}
                                placeholder="(11) 99999-9999"
                                className="h-9"
                                onKeyDown={(e) => e.key === 'Enter' && salvarEdicao(u.id)}
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => salvarEdicao(u.id)} disabled={isSalvando} className="gap-1.5">
                              {isSalvando ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                              Salvar
                            </Button>
                            <Button size="sm" variant="outline" onClick={cancelarEdicao} disabled={isSalvando}>
                              <X size={13} className="mr-1" /> Cancelar
                            </Button>
                          </div>
                        </div>

                      ) : isSenhaPainel ? (
                        /* ── PAINEL DE SENHA TEMPORÁRIA ── */
                        <div className="space-y-3">
                          {/* Aviso */}
                          <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" />
                            <p className="text-xs leading-relaxed text-amber-700">
                              Uma senha temporária será definida para <strong>{u.nome}</strong>. Comunique-a ao usuário por um canal seguro. Ele poderá alterá-la a qualquer momento pelo seu perfil.
                            </p>
                          </div>

                          {/* Campo de senha */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-medium text-muted-foreground">Senha temporária</label>
                              <button
                                onClick={() => { setSenhaInput(gerarSenhaAleatoria()); setSenhaVisivel(true); }}
                                className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                              >
                                <Shuffle size={11} /> Gerar nova
                              </button>
                            </div>
                            <div className="relative">
                              <Input
                                type={senhaVisivel ? 'text' : 'password'}
                                value={senhaInput}
                                onChange={(e) => setSenhaInput(e.target.value)}
                                className="h-9 pr-20 font-mono text-sm tracking-wider"
                                autoFocus
                              />
                              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => setSenhaVisivel(!senhaVisivel)}
                                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                                  aria-label={senhaVisivel ? 'Ocultar senha' : 'Mostrar senha'}
                                >
                                  {senhaVisivel ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                                <button
                                  type="button"
                                  onClick={copiarSenha}
                                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                                  aria-label="Copiar senha"
                                >
                                  <Copy size={14} />
                                </button>
                              </div>
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              Mín. 8 caracteres · ao menos 1 maiúscula · ao menos 1 número
                            </p>
                          </div>

                          {/* Botões */}
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => confirmarSenhaTemporaria(u.clerkId, u.nome)}
                              disabled={isSalvandoSenha || !senhaInput.trim()}
                              className="gap-1.5 bg-amber-600 text-white hover:bg-amber-700"
                            >
                              {isSalvandoSenha ? <Loader2 size={13} className="animate-spin" /> : <KeyRound size={13} />}
                              Confirmar senha
                            </Button>
                            <Button size="sm" variant="outline" onClick={fecharPainelSenha} disabled={isSalvandoSenha}>
                              <X size={13} className="mr-1" /> Cancelar
                            </Button>
                          </div>
                        </div>

                      ) : (
                        /* ── VISUALIZAÇÃO PADRÃO ── */
                        <div className="space-y-4">
                          {/* Dados atuais */}
                          <div className="grid gap-3 text-sm sm:grid-cols-3">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Mail size={13} />
                              <span className="truncate">{u.email}</span>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Smartphone size={13} />
                              <span>{u.telefone || 'Sem telefone'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Calendar size={13} />
                              <span>Criado em {new Date(u.createdAt).toLocaleDateString('pt-BR')}</span>
                            </div>
                          </div>

                          {/* Alterar role */}
                          <div className="space-y-1.5">
                            <p className="text-xs font-medium text-muted-foreground">Role da conta</p>
                            <div className="flex flex-wrap gap-2">
                              {ROLES_OPCOES.map((role) => (
                                <button
                                  key={role}
                                  disabled={u.role === role || !!isAlterandoRole}
                                  onClick={() => handleAlterarRole(u.id, role)}
                                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-50 ${
                                    u.role === role
                                      ? `${ROLE_CONFIG[role].cor} border-transparent`
                                      : 'border-border text-muted-foreground hover:border-primary/30 hover:text-foreground'
                                  }`}
                                >
                                  {alterandoRole === u.id && u.role !== role
                                    ? <Loader2 size={11} className="animate-spin" />
                                    : null
                                  }
                                  {ROLE_CONFIG[role].label}
                                  {u.role === role && ' ✓'}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Botões de ação */}
                          <div className="flex flex-wrap gap-2 pt-1">
                            <button
                              onClick={() => iniciarEdicao(u)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition-all hover:border-primary/30 hover:bg-accent hover:text-primary active:scale-95"
                            >
                              <Pencil size={13} />
                              Editar dados
                            </button>
                            <button
                              disabled={!u.clerkId}
                              onClick={() => abrirPainelSenha(u.id)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 shadow-sm transition-all hover:border-amber-300 hover:bg-amber-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <KeyRound size={13} />
                              Definir senha temporária
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
