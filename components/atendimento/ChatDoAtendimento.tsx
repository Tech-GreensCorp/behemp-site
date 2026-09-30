'use client';

/**
 * O chat da chamada de atendimento — ADR-0029 D-17 e D-18 (`DO-74`).
 *
 * Texto e print. É por aqui que o paciente no celular mostra a tela, porque o navegador do celular
 * não compartilha tela (§1.11).
 *
 * ⚠️ O print só é BUSCADO quando alguém clica para vê-lo: a rota audita `visualizar` a cada GET, e
 * carregar a imagem sozinha gravaria "visualizou" para quem só rolou o chat. É a mesma regra do
 * `VisualizadorDeDocumento`. E o endereço do blob nunca chega aqui: a imagem vem da rota
 * autenticada, pelo id da mensagem.
 */
import Image from 'next/image';
import { useEffect, useRef, useState, useTransition } from 'react';
import { ImageIcon, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  enviarMensagemNoAtendimento,
  enviarPrintNoAtendimento,
} from '@/app/_actions/chamada-de-atendimento';
import type { PapelNaChamada } from '@/lib/atendimento/canal';

export interface MensagemDoChat {
  id: string;
  autor: PapelNaChamada;
  texto: string | null;
  temPrint: boolean;
  criadaEm: string;
}

interface Props {
  sala: string;
  papel: PapelNaChamada;
  mensagens: MensagemDoChat[];
  encerrada: boolean;
  onEnviada: (m: MensagemDoChat) => void;
}

const TIPOS_ACEITOS = 'image/png,image/jpeg,image/webp';

function Print({ id }: { id: string }) {
  const [aberto, setAberto] = useState(false);
  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="text-primary flex items-center gap-1.5 text-xs font-medium underline-offset-2 hover:underline"
      >
        <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
        Print enviado — clique para ver
      </button>
    );
  }
  return (
    // `unoptimized`: a imagem é autenticada e sem cache, e o otimizador do Next não poderia buscá-la.
    <Image
      unoptimized
      src={`/api/atendimento/print/${id}`}
      alt="Print enviado no atendimento"
      width={640}
      height={360}
      className="border-border max-h-72 w-full rounded-lg border object-contain"
    />
  );
}

export function ChatDoAtendimento({ sala, papel, mensagens, encerrada, onEnviada }: Props) {
  const [texto, setTexto] = useState('');
  const [enviando, iniciar] = useTransition();
  const arquivo = useRef<HTMLInputElement>(null);
  const fim = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fim.current?.scrollIntoView({ block: 'end' });
  }, [mensagens.length]);

  const enviarTexto = () => {
    const t = texto.trim();
    if (!t) return;
    iniciar(async () => {
      const r = await enviarMensagemNoAtendimento({ sala, texto: t }).catch(() => ({
        sucesso: false as const,
        dados: undefined,
        erro: 'Sem conexão. Tente de novo.',
      }));
      if (r.sucesso && r.dados) {
        onEnviada(r.dados);
        setTexto('');
      } else toast.error(r.erro ?? 'A mensagem não foi enviada.');
    });
  };

  const enviarPrint = (f: File) =>
    iniciar(async () => {
      const dados = new FormData();
      dados.set('sala', sala);
      dados.set('arquivo', f);
      const r = await enviarPrintNoAtendimento(dados).catch(() => ({
        sucesso: false as const,
        dados: undefined,
        erro: 'Sem conexão. Tente de novo.',
      }));
      if (r.sucesso && r.dados) onEnviada(r.dados);
      else toast.error(r.erro ?? 'O print não foi enviado.');
      if (arquivo.current) arquivo.current.value = '';
    });

  const rotulo = (autor: PapelNaChamada) =>
    autor === papel ? 'Você' : autor === 'admin' ? 'Equipe Be4Hope' : 'Paciente';

  return (
    <div className="border-border flex h-full min-h-[24rem] flex-col rounded-2xl border bg-white">
      <div className="border-border border-b px-4 py-3">
        <p className="text-foreground text-sm font-semibold">Mensagens</p>
        <p className="text-muted-foreground text-xs">
          {papel === 'paciente'
            ? 'Escreva aqui ou mande um print da sua tela.'
            : 'O paciente pode mandar prints por aqui.'}
        </p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3" aria-live="polite">
        {mensagens.length === 0 && (
          <p className="text-muted-foreground text-xs">Nenhuma mensagem ainda.</p>
        )}
        {mensagens.map((m) => (
          <div key={m.id} className={cn('space-y-1', m.autor === papel && 'text-right')}>
            <p className="text-muted-foreground text-[11px]">
              {rotulo(m.autor)} ·{' '}
              {new Date(m.criadaEm).toLocaleTimeString('pt-BR', {
                timeZone: 'America/Sao_Paulo',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
            <div
              className={cn(
                'inline-block max-w-full rounded-xl px-3 py-2 text-left text-sm',
                m.autor === papel ? 'bg-primary/10 text-foreground' : 'bg-muted text-foreground',
              )}
            >
              {m.texto && <p className="break-words whitespace-pre-wrap">{m.texto}</p>}
              {m.temPrint && <Print id={m.id} />}
            </div>
          </div>
        ))}
        <div ref={fim} />
      </div>

      {encerrada ? (
        <p className="text-muted-foreground border-border border-t px-4 py-3 text-xs">
          O atendimento foi encerrado. As mensagens ficam registradas.
        </p>
      ) : (
        <div className="border-border space-y-2 border-t p-3">
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                enviarTexto();
              }
            }}
            placeholder="Escreva uma mensagem"
            rows={2}
            maxLength={2000}
            aria-label="Mensagem"
          />
          <div className="flex gap-2">
            <input
              ref={arquivo}
              type="file"
              accept={TIPOS_ACEITOS}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) enviarPrint(f);
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={enviando}
              onClick={() => arquivo.current?.click()}
            >
              <ImageIcon className="h-4 w-4" /> Enviar print
            </Button>
            <Button
              type="button"
              size="sm"
              className="flex-1 gap-1.5"
              disabled={enviando || !texto.trim()}
              onClick={enviarTexto}
            >
              {enviando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Enviar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
