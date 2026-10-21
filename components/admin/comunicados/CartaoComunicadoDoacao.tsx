'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Download,
  Eye,
  FileCheck,
  FileSignature,
  FileText,
  Link2,
  Loader2,
  RefreshCw,
  Mail,
  ExternalLink,
  Send,
  RotateCcw,
} from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  atualizarStatusDoComunicado,
  enviarComunicadoAtualizacaoDoacao,
  listarComunicadosDoPaciente,
  reiniciarFluxoDoComunicado,
  reenviarEmailDoComunicado,
} from '@/app/_actions/comunicados';
import { TITULO_ATUALIZACAO_PROGRAMA_DOACAO } from '@/lib/comunicados/catalogo';
import type { ComunicadoParaAdmin } from '@/lib/comunicados/assinatura';

/**
 * Cartão do comunicado "Atualização do Programa de Doação" na aba Documentos do paciente.
 *
 * Só o admin o vê: a action recusa os demais papéis e o cartão simplesmente não é desenhado.
 * O status vem do banco, que só muda por confirmação do DocuSign — o admin acompanha o
 * processo todo sem abrir o DocuSign.
 */

const quando = (d: Date | string) =>
  new Date(d).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

type Rotulo = { texto: string; classe: string; destrutivo?: boolean };

function rotuloDe(c: ComunicadoParaAdmin | undefined): Rotulo {
  if (!c) return { texto: 'Não enviado', classe: 'text-muted-foreground' };
  switch (c.status) {
    case 'pendente':
      return { texto: 'Pendente de assinatura', classe: 'border-[#C08E3A]/50 text-[#C08E3A]' };
    case 'assinado':
      return { texto: 'Assinado', classe: 'border-[#16a34a]/50 text-[#16a34a]' };
    case 'erro':
      return { texto: 'Erro no envio', classe: '', destrutivo: true };
    case 'recusado':
      return { texto: 'Erro na assinatura (recusado ou anulado)', classe: '', destrutivo: true };
    default:
      // `cancelado` = fluxo reiniciado pelo admin; o registro fica como histórico
      return { texto: 'Reiniciado', classe: 'text-muted-foreground' };
  }
}

export function CartaoComunicadoDoacao({ pacienteId }: { pacienteId: string }) {
  const [historico, setHistorico] = useState<ComunicadoParaAdmin[] | null>(null);
  const [permitido, setPermitido] = useState(true);
  const [confirmando, setConfirmando] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [reiniciando, setReiniciando] = useState(false);
  const [motivo, setMotivo] = useState('');

  const carregar = useCallback(async () => {
    const res = await listarComunicadosDoPaciente(pacienteId);
    if (!res.sucesso) {
      setPermitido(false);
      return;
    }
    setHistorico(res.dados);
  }, [pacienteId]);

  useEffect(() => {
    void (async () => {
      await carregar();
    })();
  }, [carregar]);

  if (!permitido || historico === null) return null;

  const ativo = historico.find((c) => c.status === 'pendente' || c.status === 'assinado');
  // Um fluxo reiniciado volta ao estado inicial ("Não enviado"); o registro dele fica só no histórico.
  const ultimo = historico[0];
  const atual = ativo ?? (ultimo && ultimo.status !== 'cancelado' ? ultimo : undefined);
  const rotulo = rotuloDe(atual);

  async function enviar() {
    setOcupado('enviar');
    const res = await enviarComunicadoAtualizacaoDoacao(pacienteId);
    setOcupado(null);
    setConfirmando(false);
    if (!res.sucesso) toast.error(res.erro);
    else if (res.dados.emailEnviado) toast.success('Comunicado enviado ao paciente.');
    else toast.warning('Comunicado enviado, mas o e-mail de aviso falhou. Use "Reenviar e-mail".');
    await carregar();
  }

  async function atualizar(id: string) {
    setOcupado(`status-${id}`);
    const res = await atualizarStatusDoComunicado(id);
    setOcupado(null);
    if (!res.sucesso) toast.error(res.erro);
    else toast.success('Status atualizado.');
    await carregar();
  }

  async function reiniciar(id: string) {
    setOcupado(`reiniciar-${id}`);
    const res = await reiniciarFluxoDoComunicado(id, motivo);
    setOcupado(null);
    if (!res.sucesso) {
      toast.error(res.erro);
      return;
    }
    toast.success('Fluxo reiniciado. Agora é possível enviar o comunicado de novo.');
    setReiniciando(false);
    setMotivo('');
    await carregar();
  }

  /** Copia o mesmo link do e-mail de aviso, para o admin mandar ao paciente por outro canal. */
  async function copiarLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Link de assinatura copiado.');
    } catch {
      toast.error('Não foi possível copiar. Selecione e copie o endereço manualmente.');
    }
  }

  async function reenviarEmail(id: string) {
    setOcupado(`email-${id}`);
    const res = await reenviarEmailDoComunicado(id);
    setOcupado(null);
    if (!res.sucesso) toast.error(res.erro);
    else toast.success('E-mail reenviado.');
    await carregar();
  }

  return (
    <Card className="border-border/40 shadow-sm">
      <CardHeader className="border-border/30 flex-row items-start justify-between gap-3 border-b pb-4">
        <div className="min-w-0">
          <CardTitle className="font-heading flex items-center gap-2 text-base">
            <FileSignature size={16} className="text-[#C08E3A]" />
            {TITULO_ATUALIZACAO_PROGRAMA_DOACAO}
          </CardTitle>
          <p className="text-muted-foreground mt-1 text-xs">
            Envio manual, com assinatura eletrônica pelo DocuSign. Para vários pacientes de uma vez,
            use a seleção nas telas Pacientes e Triagens.
          </p>
        </div>
        <Badge variant={rotulo.destrutivo ? 'destructive' : 'outline'} className={rotulo.classe}>
          {rotulo.texto}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4 pt-5">
        {atual && (
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground text-xs">Enviado em</dt>
              <dd>{quando(atual.enviadoEm)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Enviado por</dt>
              <dd>{atual.enviadoPorNome ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">E-mail de destino</dt>
              <dd className="break-all">{atual.emailDestino}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Assinado em</dt>
              <dd>{atual.assinadoEm ? quando(atual.assinadoEm) : '—'}</dd>
            </div>
          </dl>
        )}

        {atual && (
          <div className="border-border/40 space-y-2.5 rounded-2xl border bg-stone-50/60 p-3.5 dark:bg-stone-900/30">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                Documento anexado para assinatura
              </span>
              <Badge variant="outline" className="border-[#C08E3A]/40 text-xs text-[#C08E3A]">
                PDF preenchido
              </Badge>
            </div>

            <div className="border-border/40 bg-background flex flex-col justify-between gap-3 rounded-xl border p-3 shadow-xs sm:flex-row sm:items-center">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#C08E3A]/10 text-[#C08E3A]">
                  <FileText size={20} />
                </div>
                <div className="min-w-0">
                  <p className="font-heading text-foreground truncate text-sm font-semibold">
                    {TITULO_ATUALIZACAO_PROGRAMA_DOACAO} — {atual.nomeDestino || 'Paciente'}.pdf
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Carta preenchida com os dados do paciente para assinatura no DocuSign
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 rounded-xl text-xs"
                  render={
                    <a
                      href={`/api/comunicados/${atual.id}/documento`}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  }
                >
                  <Eye size={13} />
                  Visualizar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 rounded-xl border-[#C08E3A]/30 bg-[#C08E3A]/10 text-xs text-[#A87928] hover:bg-[#C08E3A]/20 dark:text-[#E0B25E]"
                  render={
                    <a
                      href={`/api/comunicados/${atual.id}/documento?download=1`}
                      download={`Atualizacao-Programa-Doacao-${atual.nomeDestino || 'paciente'}.pdf`}
                    />
                  }
                >
                  <Download size={13} />
                  Baixar documento
                </Button>
                {atual.status === 'pendente' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 rounded-xl text-xs"
                    onClick={() => copiarLink(atual.linkDeAssinatura)}
                  >
                    <Link2 size={13} />
                    Copiar link de assinatura
                  </Button>
                )}
              </div>
            </div>

            {atual.status === 'assinado' && atual.temArquivoAssinado && (
              <div className="flex flex-col justify-between gap-3 rounded-xl border border-emerald-500/20 bg-emerald-50/50 p-3 sm:flex-row sm:items-center dark:bg-emerald-950/20">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <FileCheck size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-heading text-foreground truncate text-sm font-semibold">
                      {TITULO_ATUALIZACAO_PROGRAMA_DOACAO} — Assinado.pdf
                    </p>
                    <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80">
                      Documento com assinatura eletrônica confirmada pelo DocuSign
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 rounded-xl border-emerald-500/30 text-xs text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"
                    render={
                      <a
                        href={`/api/comunicados/${atual.id}/arquivo`}
                        target="_blank"
                        rel="noopener noreferrer"
                      />
                    }
                  >
                    <Eye size={13} />
                    Visualizar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 rounded-xl border-0 bg-emerald-600 text-xs text-white hover:bg-emerald-700"
                    render={<a href={`/api/comunicados/${atual.id}/arquivo?download=1`} download />}
                  >
                    <Download size={13} />
                    Baixar assinado
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {atual?.erro && (
          <p className="border-destructive/30 bg-destructive/5 text-destructive rounded-xl border p-3 text-sm">
            {atual.erro}
          </p>
        )}
        {atual?.status === 'pendente' && atual.emailEnvioErro && (
          <p className="rounded-xl border border-[#C08E3A]/40 bg-[#C08E3A]/5 p-3 text-sm">
            {atual.emailEnvioErro} O paciente já vê o comunicado em Documentos.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {!ativo && (
            <Button
              size="sm"
              className="gap-2 rounded-xl"
              onClick={() => setConfirmando(true)}
              disabled={ocupado !== null}
            >
              <Send size={14} />
              {historico.length > 0 ? 'Enviar novamente' : 'Enviar comunicado'}
            </Button>
          )}
          {atual && (
            <Button
              size="sm"
              variant="outline"
              className="gap-2 rounded-xl"
              render={
                <a
                  href={`/api/comunicados/${atual.id}/documento?download=1`}
                  download={`Atualizacao-Programa-Doacao-${atual.nomeDestino || 'paciente'}.pdf`}
                />
              }
            >
              <Download size={14} />
              Baixar documento
            </Button>
          )}
          {atual?.status === 'pendente' && (
            <Button
              size="sm"
              variant="outline"
              className="gap-2 rounded-xl"
              onClick={() => copiarLink(atual.linkDeAssinatura)}
            >
              <Link2 size={14} />
              Copiar link de assinatura
            </Button>
          )}
          {atual?.status === 'pendente' && (
            <Button
              size="sm"
              variant="outline"
              className="gap-2 rounded-xl"
              onClick={() => reenviarEmail(atual.id)}
              disabled={ocupado !== null}
            >
              {ocupado === `email-${atual.id}` ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Mail size={14} />
              )}
              Reenviar e-mail
            </Button>
          )}
          {atual &&
            (atual.status === 'pendente' || (atual.status === 'assinado' && !!atual.erro)) && (
              <Button
                size="sm"
                variant="outline"
                className="gap-2 rounded-xl"
                onClick={() => atualizar(atual.id)}
                disabled={ocupado !== null}
              >
                {ocupado === `status-${atual.id}` ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <RefreshCw size={14} />
                )}
                Atualizar status
              </Button>
            )}
          {atual?.status === 'assinado' && atual.temArquivoAssinado && (
            <Button
              size="sm"
              variant="outline"
              className="gap-2 rounded-xl"
              render={
                <a
                  href={`/api/comunicados/${atual.id}/arquivo`}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              <ExternalLink size={14} />
              Ver documento assinado
            </Button>
          )}
          {atual?.status === 'assinado' && (
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:border-destructive/50 hover:bg-destructive/5 hover:text-destructive gap-2 rounded-xl"
              onClick={() => setReiniciando(true)}
              disabled={ocupado !== null}
            >
              <RotateCcw size={14} />
              Reiniciar fluxo
            </Button>
          )}
        </div>

        {ultimo?.status === 'cancelado' && !ativo && (
          <p className="text-muted-foreground rounded-xl border border-dashed p-3 text-sm">
            O fluxo foi reiniciado
            {ultimo.reiniciadoEm ? ` em ${quando(ultimo.reiniciadoEm)}` : ''}. O documento assinado
            anterior continua guardado no histórico, só para o admin.
          </p>
        )}

        {historico.length > 0 && (historico.length > 1 || historico[0].status === 'cancelado') && (
          <div className="border-border/30 space-y-1.5 border-t pt-4">
            <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Histórico de envios
            </p>
            <ul className="space-y-1 text-sm">
              {historico.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-muted-foreground">
                    {quando(c.enviadoEm)} · {c.enviadoPorNome ?? '—'}
                  </span>
                  <span className="text-right">
                    {rotuloDe(c).texto}
                    <a
                      href={`/api/comunicados/${c.id}/documento?download=1`}
                      download={`Atualizacao-Programa-Doacao-${c.nomeDestino || 'paciente'}.pdf`}
                      className="text-primary block text-xs underline"
                    >
                      Baixar documento enviado
                    </a>
                    {c.status === 'cancelado' && (
                      <span className="text-muted-foreground block text-xs">
                        por {c.reiniciadoPorNome ?? '—'}
                        {c.reiniciadoEm ? ` em ${quando(c.reiniciadoEm)}` : ''}
                        {c.motivoDoReinicio ? ` — ${c.motivoDoReinicio}` : ''}
                      </span>
                    )}
                    {c.status === 'cancelado' && c.temArquivoAssinado && (
                      <a
                        href={`/api/comunicados/${c.id}/arquivo`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary block text-xs underline"
                      >
                        Ver documento assinado (arquivado)
                      </a>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>

      <AlertDialog open={confirmando} onOpenChange={setConfirmando}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Enviar &quot;{TITULO_ATUALIZACAO_PROGRAMA_DOACAO}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              O paciente receberá um e-mail de aviso no endereço cadastrado e o comunicado passará a
              aparecer em Documentos, pendente de assinatura. O envio é individual e fica registrado
              com o seu nome.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={ocupado === 'enviar'}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={enviar} disabled={ocupado === 'enviar'} className="gap-1.5">
              {ocupado === 'enviar' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              {ocupado === 'enviar' ? 'Enviando...' : 'Sim, enviar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={reiniciando}
        onOpenChange={(aberto) => {
          if (!aberto && ocupado === null) {
            setReiniciando(false);
            setMotivo('');
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reiniciar o fluxo deste comunicado?</AlertDialogTitle>
            <AlertDialogDescription>
              O comunicado volta ao estado &quot;Não enviado&quot; e o paciente deixa de vê-lo em
              Documentos, para você poder enviar de novo. <strong>Nada é apagado:</strong> o
              documento assinado e o registro ficam guardados no histórico para auditoria, com o seu
              nome, a data e o motivo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="motivo-reinicio">Motivo (obrigatório)</Label>
            <Textarea
              id="motivo-reinicio"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              maxLength={500}
              placeholder="Ex.: carta atualizada, precisa ser assinada de novo"
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={ocupado !== null}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (atual) void reiniciar(atual.id);
              }}
              disabled={ocupado !== null || motivo.trim().length < 5}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-1.5"
            >
              {ocupado?.startsWith('reiniciar-') ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RotateCcw size={14} />
              )}
              Sim, reiniciar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
