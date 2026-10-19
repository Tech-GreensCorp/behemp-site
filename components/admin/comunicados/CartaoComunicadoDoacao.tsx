'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { FileSignature, Loader2, RefreshCw, Mail, ExternalLink, Send } from 'lucide-react';

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
import {
  atualizarStatusDoComunicado,
  enviarComunicadoAtualizacaoDoacao,
  listarComunicadosDoPaciente,
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
      return { texto: 'Cancelado', classe: 'text-muted-foreground' };
  }
}

export function CartaoComunicadoDoacao({ pacienteId }: { pacienteId: string }) {
  const [historico, setHistorico] = useState<ComunicadoParaAdmin[] | null>(null);
  const [permitido, setPermitido] = useState(true);
  const [confirmando, setConfirmando] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);

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
  const atual = ativo ?? historico[0];
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
            Envio manual e individual, com assinatura eletrônica pelo DocuSign.
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
        </div>

        {historico.length > 1 && (
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
                  <span>{rotuloDe(c).texto}</span>
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
              O paciente receberá um e-mail de docs@be4hope.org e o comunicado passará a aparecer em
              Documentos, pendente de assinatura. O envio é individual e fica registrado com o seu
              nome.
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
    </Card>
  );
}
