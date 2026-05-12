'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { listarTodasRecompras, atualizarStatusRecompra } from '@/app/_actions/recompras';
import {
  listarEmailsNotificacao,
  criarEmailNotificacao,
  toggleEmailNotificacao,
  excluirEmailNotificacao,
} from '@/app/_actions/emails-notificacao';
import { toast } from 'sonner';
import {
  Loader2,
  RefreshCw,
  Mail,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  MessageSquare,
  Package,
  Users,
} from 'lucide-react';

/**
 * Página de administração de recompras — Admin.
 * Histórico de todos os pedidos + gerenciamento de e-mails do financeiro.
 */

interface RecompraItem {
  id: string;
  medicamentoNome: string | null;
  mlFrasco: number | null;
  gotasPorDia: number | null;
  dataPrevista: string;
  status: string;
  contatoTelefone: string | null;
  contatoEmail: string | null;
  criadoEm: string;
  solicitanteNome: string;
  solicitanteRole: string | null;
  pacienteNome: string | null;
}

interface EmailItem {
  id: string;
  email: string;
  nome: string;
  categoria: string;
  ativo: boolean;
}

const STATUS_LABELS: Record<string, { label: string; cor: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  agendada: { label: 'Agendada', cor: 'outline' },
  pedida: { label: 'Pedido enviado', cor: 'default' },
  entregue: { label: 'Entregue', cor: 'secondary' },
};

export default function AdminRecomprasPage() {
  const [recompras, setRecompras] = useState<RecompraItem[]>([]);
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [carregandoEmails, setCarregandoEmails] = useState(true);
  const [atualizando, setAtualizando] = useState<string | null>(null);

  // Form de novo email
  const [novoEmail, setNovoEmail] = useState('');
  const [novoNome, setNovoNome] = useState('');
  const [adicionandoEmail, setAdicionandoEmail] = useState(false);

  useEffect(() => {
    carregarRecompras();
    carregarEmails();
  }, []);

  async function carregarRecompras() {
    setCarregando(true);
    const res = await listarTodasRecompras();
    if (res.sucesso && res.dados) {
      setRecompras(res.dados);
    }
    setCarregando(false);
  }

  async function carregarEmails() {
    setCarregandoEmails(true);
    const res = await listarEmailsNotificacao();
    if (res.sucesso && res.dados) {
      setEmails(res.dados);
    }
    setCarregandoEmails(false);
  }

  async function handleMudarStatus(recompraId: string, novoStatus: 'agendada' | 'pedida' | 'entregue') {
    setAtualizando(recompraId);
    const res = await atualizarStatusRecompra(recompraId, novoStatus);
    setAtualizando(null);

    if (res.sucesso) {
      toast.success('Status atualizado');
      carregarRecompras();
    } else {
      toast.error(res.erro || 'Erro ao atualizar');
    }
  }

  async function handleAdicionarEmail() {
    if (!novoEmail || !novoNome) {
      toast.error('Preencha nome e e-mail');
      return;
    }

    setAdicionandoEmail(true);
    const res = await criarEmailNotificacao({ email: novoEmail, nome: novoNome, categoria: 'financeiro' });
    setAdicionandoEmail(false);

    if (res.sucesso) {
      toast.success('E-mail adicionado');
      setNovoEmail('');
      setNovoNome('');
      carregarEmails();
    } else {
      toast.error(res.erro || 'Erro ao adicionar');
    }
  }

  async function handleToggleEmail(id: string) {
    const res = await toggleEmailNotificacao(id);
    if (res.sucesso) {
      carregarEmails();
    } else {
      toast.error(res.erro || 'Erro ao alternar');
    }
  }

  async function handleExcluirEmail(id: string) {
    const res = await excluirEmailNotificacao(id);
    if (res.sucesso) {
      toast.success('E-mail removido');
      carregarEmails();
    } else {
      toast.error(res.erro || 'Erro ao remover');
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Recompras</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie pedidos de recompra e e-mails de notificação
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={carregarRecompras} className="gap-2">
          <RefreshCw size={14} />
          Atualizar
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Pedidos de Recompra */}
        <div className="xl:col-span-2">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Package size={16} />
                Pedidos de Recompra ({recompras.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {carregando ? (
                <div className="flex justify-center py-8">
                  <Loader2 size={24} className="animate-spin text-primary" />
                </div>
              ) : recompras.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Package size={32} className="mb-3 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">Nenhum pedido de recompra.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recompras.map((r) => {
                    const st = STATUS_LABELS[r.status] ?? { label: r.status, cor: 'outline' as const };
                    const roleLabel = r.solicitanteRole === 'medico' ? '👨‍⚕️ Médico' : '👤 Paciente';
                    return (
                      <div key={r.id} className="rounded-xl border p-4">
                        <div className="mb-3 flex items-start justify-between">
                          <div className="space-y-1">
                            <p className="text-sm font-medium">{r.medicamentoNome ?? 'Medicamento'}</p>
                            <p className="text-xs text-muted-foreground">
                              {r.mlFrasco}ml • {r.gotasPorDia} gotas/dia
                            </p>
                          </div>
                          <Badge variant={st.cor}>{st.label}</Badge>
                        </div>

                        <div className="mb-3 grid gap-2 text-xs sm:grid-cols-2">
                          <div>
                            <span className="text-muted-foreground">Solicitante: </span>
                            <span className="font-medium">{r.solicitanteNome} ({roleLabel})</span>
                          </div>
                          {r.pacienteNome && (
                            <div>
                              <span className="text-muted-foreground">Paciente: </span>
                              <span className="font-medium">{r.pacienteNome}</span>
                            </div>
                          )}
                          <div>
                            <span className="text-muted-foreground">Término previsto: </span>
                            <span className="font-semibold text-primary">
                              {new Date(r.dataPrevista).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Pedido em: </span>
                            <span>{new Date(r.criadoEm).toLocaleDateString('pt-BR')}</span>
                          </div>
                        </div>

                        {/* Contato */}
                        <div className="mb-3 flex flex-wrap gap-2">
                          {r.contatoTelefone && (
                            <a
                              href={`https://wa.me/55${r.contatoTelefone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-200"
                            >
                              <MessageSquare size={12} />
                              WhatsApp: {r.contatoTelefone}
                            </a>
                          )}
                          {r.contatoEmail && (
                            <a
                              href={`mailto:${r.contatoEmail}`}
                              className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200"
                            >
                              <Mail size={12} />
                              {r.contatoEmail}
                            </a>
                          )}
                        </div>

                        {/* Ações de status */}
                        <div className="flex gap-2">
                          {r.status !== 'entregue' && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={atualizando === r.id}
                              onClick={() => handleMudarStatus(r.id, 'entregue')}
                              className="gap-1.5 text-xs"
                            >
                              {atualizando === r.id && <Loader2 size={12} className="animate-spin" />}
                              ✅ Marcar como entregue
                            </Button>
                          )}
                          {r.status === 'pedida' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={atualizando === r.id}
                              onClick={() => handleMudarStatus(r.id, 'agendada')}
                              className="gap-1.5 text-xs"
                            >
                              Agendar
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Gerenciamento de E-mails */}
        <div>
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail size={16} />
                E-mails do Financeiro
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                E-mails que receberão notificações de novos pedidos de recompra.
              </p>

              {/* Formulário de novo email */}
              <div className="space-y-2 rounded-xl border p-3">
                <div className="space-y-2">
                  <Input
                    placeholder="Nome do contato"
                    value={novoNome}
                    onChange={(e) => setNovoNome(e.target.value)}
                    className="h-9 text-sm"
                  />
                  <Input
                    type="email"
                    placeholder="email@empresa.com"
                    value={novoEmail}
                    onChange={(e) => setNovoEmail(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={handleAdicionarEmail}
                  disabled={adicionandoEmail}
                  className="w-full gap-1.5"
                >
                  {adicionandoEmail ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Plus size={14} />
                  )}
                  Adicionar
                </Button>
              </div>

              {/* Lista */}
              {carregandoEmails ? (
                <div className="flex justify-center py-4">
                  <Loader2 size={16} className="animate-spin text-muted-foreground" />
                </div>
              ) : emails.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  Nenhum e-mail cadastrado.
                </p>
              ) : (
                <div className="space-y-2">
                  {emails.map((em) => (
                    <div
                      key={em.id}
                      className={`flex items-center justify-between rounded-lg border p-3 ${!em.ativo ? 'opacity-50' : ''}`}
                    >
                      <div>
                        <p className="text-sm font-medium">{em.nome}</p>
                        <p className="text-xs text-muted-foreground">{em.email}</p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleToggleEmail(em.id)}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                          title={em.ativo ? 'Desativar' : 'Ativar'}
                        >
                          {em.ativo ? <ToggleRight size={16} className="text-green-600" /> : <ToggleLeft size={16} />}
                        </button>
                        <button
                          onClick={() => handleExcluirEmail(em.id)}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          title="Excluir"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
