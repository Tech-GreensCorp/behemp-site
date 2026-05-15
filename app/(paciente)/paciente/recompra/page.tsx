'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { solicitarRecompraManual, listarMinhasRecompras } from '@/app/_actions/recompras';
import { obterPerfilContato } from '@/app/_actions/perfil-paciente';
import { toast } from 'sonner';
import {
  Loader2,
  CheckCircle2,
  Phone,
  Mail,
  History,
  Send,
  ShoppingCart,
  MessageCircle,
  Info,
} from 'lucide-react';

/** Número fixo do WhatsApp da Be4Hope */
const WHATSAPP_BEHEMP = process.env.NEXT_PUBLIC_WHATSAPP_BEHEMP ?? '5511932047360';

const STATUS_LABELS: Record<string, { label: string; cor: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  agendada: { label: 'Agendada', cor: 'outline' },
  pedida: { label: 'Pedido enviado', cor: 'default' },
  entregue: { label: 'Entregue', cor: 'secondary' },
};

interface RecompraHistorico {
  id: string;
  medicamentoNome: string | null;
  mlFrasco: number | null;
  gotasPorDia: number | null;
  dataInicioUso: string | null;
  dataPrevista: string;
  status: string;
  contatoTelefone: string | null;
  contatoEmail: string | null;
  criadoEm: string;
  solicitanteNome: string;
}

export default function RecompraPage() {
  // Contato (pré-preenchido)
  const [contatoTelefone, setContatoTelefone] = useState('');
  const [contatoEmail, setContatoEmail] = useState('');
  const [observacoes, setObservacoes] = useState('');

  // UI
  const [carregandoPerfil, setCarregandoPerfil] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [historico, setHistorico] = useState<RecompraHistorico[]>([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(true);

  useEffect(() => {
    // Carrega perfil e histórico em paralelo
    Promise.all([carregarPerfil(), carregarHistorico()]);
  }, []);

  async function carregarPerfil() {
    setCarregandoPerfil(true);
    const res = await obterPerfilContato();
    if (res.sucesso && res.dados) {
      setContatoTelefone(res.dados.telefone ?? '');
      setContatoEmail(res.dados.email ?? '');
    }
    setCarregandoPerfil(false);
  }

  async function carregarHistorico() {
    setCarregandoHistorico(true);
    const res = await listarMinhasRecompras();
    if (res.sucesso && res.dados) setHistorico(res.dados);
    setCarregandoHistorico(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contatoTelefone && !contatoEmail) {
      toast.error('Informe pelo menos um contato (telefone ou e-mail)');
      return;
    }

    setEnviando(true);
    const resultado = await solicitarRecompraManual({
      // Campos obrigatórios — usamos valores mínimos pois o foco agora é só o contato
      medicamentoNome: 'Recompra via plataforma',
      mlFrasco: 1,
      gotasPorDia: 1,
      dataInicioUso: new Date().toISOString().split('T')[0],
      contatoTelefone: contatoTelefone || undefined,
      contatoEmail: contatoEmail || undefined,
      observacoes: observacoes || undefined,
    });
    setEnviando(false);

    if (resultado.sucesso) {
      setSucesso(true);
      toast.success('Pedido de recompra enviado com sucesso!');
      carregarHistorico();
    } else {
      toast.error(resultado.erro || 'Erro ao enviar pedido');
    }
  }

  // ── Estado de Sucesso ────────────────────────────────────────
  if (sucesso) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Recompra de Medicamento</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Solicitação enviada para nossa equipe
          </p>
        </div>

        <Card className="border-border/40 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/20">
              <CheckCircle2 size={40} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="mb-2 text-xl font-bold text-emerald-700 dark:text-emerald-400">
              Pedido Encaminhado!
            </h2>
            <p className="mb-1 max-w-sm text-center text-sm text-muted-foreground">
              Sua solicitação foi enviada para a equipe Be4Hope.
            </p>
            <p className="mb-8 max-w-sm text-center text-sm text-muted-foreground">
              Entraremos em contato em breve pelo canal informado.
            </p>

            <div className="flex flex-col items-center gap-3 sm:flex-row">
              <a
                href={`https://wa.me/${WHATSAPP_BEHEMP}?text=${encodeURIComponent(
                  `Olá Be4Hope! Acabei de solicitar uma recompra pelo sistema.\n` +
                  (contatoTelefone ? `📞 Meu telefone: ${contatoTelefone}\n` : '') +
                  (contatoEmail ? `✉️ Meu e-mail: ${contatoEmail}\n` : '') +
                  (observacoes ? `📝 Obs: ${observacoes}\n` : '') +
                  `\nAguardo o retorno. Obrigado(a)!`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-5 py-2.5 text-sm font-semibold text-white shadow transition-all hover:bg-[#1da851]"
              >
                <MessageCircle size={18} />
                Falar no WhatsApp
              </a>

              <Button
                onClick={() => { setSucesso(false); setObservacoes(''); }}
                variant="outline"
                className="gap-2 rounded-xl"
              >
                <Send size={16} />
                Novo pedido
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Formulário ───────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Recompra de Medicamento</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Solicite a recompra do seu medicamento
        </p>
      </div>

      {/* Banner informativo */}
      <Card className="border-primary/20 bg-primary/5 shadow-sm">
        <CardContent className="flex items-start gap-4 p-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Info size={18} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">Como funciona?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Confirme seus dados de contato abaixo e clique em{' '}
              <strong className="text-foreground">Solicitar Recompra</strong>. Nossa equipe
              receberá sua solicitação e entrará em contato para dar andamento ao pedido.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Formulário */}
      <Card className="border-border/40 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShoppingCart size={16} className="text-primary" />
            Dados para Contato
          </CardTitle>
        </CardHeader>
        <CardContent>
          {carregandoPerfil ? (
            <div className="flex justify-center py-10">
              <Loader2 size={24} className="animate-spin text-primary" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Telefone */}
                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone / WhatsApp</Label>
                  <div className="relative">
                    <Phone
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                      id="telefone"
                      type="tel"
                      placeholder="(11) 99999-9999"
                      value={contatoTelefone}
                      onChange={(e) => setContatoTelefone(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Pré-preenchido com seu perfil. Altere se necessário.
                  </p>
                </div>

                {/* E-mail */}
                <div className="space-y-2">
                  <Label htmlFor="emailContato">E-mail para Contato</Label>
                  <div className="relative">
                    <Mail
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                      id="emailContato"
                      type="email"
                      placeholder="seu@email.com"
                      value={contatoEmail}
                      onChange={(e) => setContatoEmail(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Pré-preenchido com seu perfil. Altere se necessário.
                  </p>
                </div>
              </div>

              {/* Observações */}
              <div className="space-y-2">
                <Label htmlFor="obs">Observações (opcional)</Label>
                <Textarea
                  id="obs"
                  placeholder="Alguma informação adicional sobre seu pedido..."
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>

              <Button
                type="submit"
                disabled={enviando || (!contatoTelefone && !contatoEmail)}
                className="w-full gap-2 rounded-xl"
              >
                {enviando ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
                Solicitar Recompra
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Histórico de Pedidos */}
      <Card className="border-border/40 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History size={16} />
            Histórico de Pedidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {carregandoHistorico ? (
            <div className="flex justify-center py-8">
              <Loader2 size={24} className="animate-spin text-primary" />
            </div>
          ) : historico.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <History size={32} className="mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Nenhum pedido realizado ainda.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {historico.map((item) => {
                const st = STATUS_LABELS[item.status] ?? { label: item.status, cor: 'outline' as const };
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-border/50 p-4"
                  >
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">Recompra solicitada</p>
                      <p className="text-xs text-muted-foreground">
                        {item.contatoTelefone && `📞 ${item.contatoTelefone}`}
                        {item.contatoTelefone && item.contatoEmail && ' · '}
                        {item.contatoEmail && `✉️ ${item.contatoEmail}`}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Solicitado em {new Date(item.criadoEm).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <Badge variant={st.cor}>{st.label}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
