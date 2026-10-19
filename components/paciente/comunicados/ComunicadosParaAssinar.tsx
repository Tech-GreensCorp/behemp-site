'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { FileSignature, FileCheck, Loader2, ExternalLink } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { iniciarAssinaturaDoComunicado, listarMeusComunicados } from '@/app/_actions/comunicados';
import type { ComunicadoParaPaciente } from '@/lib/comunicados/assinatura';

/**
 * Comunicados que a equipe enviou ao paciente para assinatura eletrônica.
 *
 * Só aparece quando existe ao menos um comunicado JÁ enviado a ESTE paciente — quem não recebeu
 * o disparo não vê nada (nem uma seção vazia). O status exibido é o do banco, que só muda por
 * confirmação do DocuSign: voltar da tela de assinatura não marca nada como assinado.
 */

const data = (d: Date | string) =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

export function ComunicadosParaAssinar() {
  const [itens, setItens] = useState<ComunicadoParaPaciente[] | null>(null);
  const [abrindo, setAbrindo] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const res = await listarMeusComunicados();
    setItens(res.sucesso ? res.dados : []);
    return res.sucesso ? res.dados : [];
  }, []);

  useEffect(() => {
    void (async () => {
      const lista = await carregar();
      // Voltou do DocuSign: a rota de retorno já consultou o status; aqui só se mostra o resultado.
      const params = new URLSearchParams(window.location.search);
      const voltou = params.get('comunicado');
      if (!voltou) return;
      const c = lista.find((x) => x.id === voltou);
      if (c?.status === 'assinado') toast.success('Assinatura confirmada. Obrigado!');
      else if (c?.status === 'pendente')
        toast.info(
          'Ainda não recebemos a confirmação da assinatura. Se você terminou, aguarde um instante e atualize a página.',
        );
      params.delete('comunicado');
      const resto = params.toString();
      window.history.replaceState(null, '', window.location.pathname + (resto ? `?${resto}` : ''));
    })();
  }, [carregar]);

  async function assinar(id: string) {
    setAbrindo(id);
    const res = await iniciarAssinaturaDoComunicado(id);
    if (res.sucesso) {
      window.location.assign(res.dados.url);
      return; // a página sai daqui; mantém o botão ocupado
    }
    toast.error(res.erro || 'Não foi possível abrir a assinatura.');
    setAbrindo(null);
    await carregar();
  }

  if (!itens || itens.length === 0) return null;

  return (
    <section className="animate-fade-up space-y-3" aria-label="Comunicados para assinatura">
      <h2 className="font-heading text-muted-foreground text-sm font-semibold tracking-wide uppercase">
        Comunicados
      </h2>
      {itens.map((c) => (
        <Card
          key={c.id}
          className="border-border/30 bg-card overflow-hidden rounded-3xl border shadow-sm"
        >
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#C08E3A]/10">
                {c.status === 'assinado' ? (
                  <FileCheck size={18} className="text-[#16a34a]" />
                ) : (
                  <FileSignature size={18} className="text-[#C08E3A]" />
                )}
              </div>
              <div className="min-w-0">
                <p className="font-heading text-foreground font-semibold">{c.titulo}</p>
                <p className="text-muted-foreground text-xs">
                  Recebido em {data(c.enviadoEm)}
                  {c.status === 'assinado' && c.assinadoEm && (
                    <> · Assinado em {data(c.assinadoEm)}</>
                  )}
                </p>
                <div className="mt-2">
                  {c.status === 'pendente' && (
                    <Badge variant="outline" className="border-[#C08E3A]/50 text-[#C08E3A]">
                      Pendente de assinatura
                    </Badge>
                  )}
                  {c.status === 'assinado' && (
                    <Badge variant="outline" className="border-[#16a34a]/50 text-[#16a34a]">
                      Assinado
                    </Badge>
                  )}
                  {c.status === 'recusado' && (
                    <Badge variant="destructive">Assinatura não concluída</Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {c.status === 'pendente' && (
                <Button
                  className="rounded-full border-0 bg-[#16a34a] px-6 text-sm font-semibold text-white hover:bg-[#148f43]"
                  onClick={() => assinar(c.id)}
                  disabled={abrindo === c.id}
                >
                  {abrindo === c.id ? (
                    <Loader2 size={14} className="mr-2 animate-spin" />
                  ) : (
                    <FileSignature size={14} className="mr-2" />
                  )}
                  Abrir e assinar
                </Button>
              )}
              {c.status === 'assinado' && c.temArquivoAssinado && (
                <Button
                  variant="outline"
                  className="rounded-full px-5 text-sm font-semibold"
                  render={
                    <a
                      href={`/api/comunicados/${c.id}/arquivo`}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  }
                >
                  <ExternalLink size={14} className="mr-2" />
                  Ver documento assinado
                </Button>
              )}
              {c.status === 'assinado' && !c.temArquivoAssinado && (
                <p className="text-muted-foreground text-xs">
                  Estamos preparando o documento assinado. Ele aparece aqui em instantes.
                </p>
              )}
              {c.status === 'recusado' && (
                <p className="text-muted-foreground max-w-[16rem] text-xs">
                  Fale com a nossa equipe pelo WhatsApp (11) 93204-7360 para receber um novo envio.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
