'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Link2, Loader2, Unlink } from 'lucide-react';
import { toast } from 'sonner';

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
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { desconectarContaMercadoPago } from '@/app/(medico)/_actions/mercadopago';
import type { StatusContaMercadoPago } from '@/app/(medico)/_actions/mercadopago';

/**
 * Cada motivo vira UMA frase, escolhida aqui. A rota manda só o rótulo — o texto nunca
 * viaja na URL, porque mensagem detalhada em querystring é oráculo para quem está
 * tentando descobrir o que funciona.
 */
const MENSAGEM_DE_ERRO: Record<string, string> = {
  negado: 'Você cancelou a autorização no Mercado Pago. Nada foi alterado.',
  sessao: 'Sua sessão expirou durante a conexão. Entre novamente e tente de novo.',
  configuracao: 'A integração com o Mercado Pago ainda não foi configurada pela Be4Hope.',
  state: 'Não foi possível validar o retorno do Mercado Pago. Tente conectar novamente.',
  incompleto: 'O Mercado Pago não devolveu os dados esperados. Tente novamente.',
  falha: 'Não conseguimos concluir a conexão. Tente novamente em alguns minutos.',
};

export function SecaoMercadoPago({ status }: { status: StatusContaMercadoPago }) {
  const [confirmando, setConfirmando] = useState(false);
  const [pendente, iniciarTransicao] = useTransition();
  const router = useRouter();
  const searchParams = useSearchParams();

  const resultado = searchParams.get('mp');
  const motivo = searchParams.get('motivo');

  /**
   * Mostra o resultado da volta do OAuth e LIMPA a querystring.
   *
   * ⚠️ Sem limpar, recarregar a página repete o toast — e um "conectado com sucesso" que
   * reaparece depois de desconectar faz a tela desmentir a si mesma.
   */
  useEffect(() => {
    if (!resultado) return;
    if (resultado === 'sucesso') {
      toast.success('Conta do Mercado Pago conectada.');
    } else {
      toast.error(MENSAGEM_DE_ERRO[motivo ?? ''] ?? MENSAGEM_DE_ERRO.falha);
    }
    router.replace('/medico/pagamentos/config');
  }, [resultado, motivo, router]);

  function handleDesconectar() {
    iniciarTransicao(async () => {
      const res = await desconectarContaMercadoPago();
      if (res.sucesso) {
        toast.success('Conta desconectada.');
        setConfirmando(false);
        router.refresh();
      } else {
        toast.error(res.erro ?? 'Não foi possível desconectar.');
      }
    });
  }

  if (!status.integracaoConfigurada) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recebimento pelo Mercado Pago</CardTitle>
          <CardDescription>
            A integração ainda não foi configurada pela Be4Hope. Assim que estiver pronta, o botão
            de conexão aparece aqui.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (status.conectado) {
    return (
      <>
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 size={18} className="text-primary" />
              Mercado Pago conectado
            </CardTitle>
            <CardDescription>
              Os pagamentos das suas consultas vão direto para a sua conta do Mercado Pago. A
              Be4Hope não intermedeia o valor.
              {status.conectadoEm ? (
                <span className="mt-1 block text-xs">
                  Conectado em {new Date(status.conectadoEm).toLocaleDateString('pt-BR')}
                  {status.mpUserId ? ` · conta ${status.mpUserId}` : null}
                </span>
              ) : null}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setConfirmando(true)}
            >
              <Unlink size={14} />
              Desconectar
            </Button>
          </CardContent>
        </Card>

        <AlertDialog open={confirmando} onOpenChange={setConfirmando}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Desconectar a conta do Mercado Pago?</AlertDialogTitle>
              <AlertDialogDescription>
                Enquanto estiver desconectado, <strong>pacientes não conseguirão agendar</strong>{' '}
                consultas com você, porque não há como receber o pagamento. Você pode reconectar
                quando quiser.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pendente}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleDesconectar();
                }}
                disabled={pendente}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-1.5"
              >
                {pendente ? <Loader2 size={14} className="animate-spin" /> : <Unlink size={14} />}
                {pendente ? 'Desconectando...' : 'Sim, desconectar'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Conecte sua conta do Mercado Pago</CardTitle>
        <CardDescription>
          Conecte sua conta para receber os pagamentos de consulta diretamente, sem passar pela
          Be4Hope. <strong>Enquanto não conectar, pacientes não conseguem agendar</strong> consultas
          com você.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Link normal, e não fetch: o fluxo é uma navegação de topo para o site do
            Mercado Pago, e é ela que carrega o cookie de sessão na volta. */}
        <a href="/api/medico/mercadopago/conectar">
          <Button size="sm" className="gap-1.5">
            <Link2 size={14} />
            Conectar Mercado Pago
          </Button>
        </a>
      </CardContent>
    </Card>
  );
}
