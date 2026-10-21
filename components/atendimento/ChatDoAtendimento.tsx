'use client';

/**
 * O chat da chamada de atendimento — ADR-0029 D-17 e D-18 (`DO-74`).
 *
 * Texto e print. É por aqui que o paciente no celular mostra a tela, porque o navegador do celular
 * não compartilha tela (§1.11).
 *
 * ⚠️ O print é buscado UMA vez, quando aparece no chat, e a miniatura e o modal usam a mesma cópia
 * (`URL.createObjectURL`). A rota audita `visualizar` a cada GET: uma exibição, uma leitura auditada,
 * nunca duas. Até 30/09/2026 a imagem só era buscada no clique; Davi decidiu que o print aparece no
 * chat (`DO-83`). E o endereço do blob nunca chega aqui: a imagem vem da rota autenticada, pelo id
 * da mensagem.
 *
 * O modal (D-23) amplia com zoom: o chat é estreito, e a miniatura não deixa ler.
 */
import Image from 'next/image';
import { useEffect, useRef, useState, useTransition } from 'react';
import { ImageIcon, Loader2, Send, ZoomIn, ZoomOut } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

/** Os degraus do zoom: 1 é a imagem inteira na largura do modal. */
const ZOOM = [1, 1.5, 2, 3] as const;

function Print({ id }: { id: string }) {
  const [aberto, setAberto] = useState(false);
  const [degrau, setDegrau] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [visivel, setVisivel] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const lugar = useRef<HTMLDivElement>(null);
  const zoom = ZOOM[degrau];

  // Só busca quando a miniatura ENTRA na área visível do chat: a auditoria registra o que foi de fato
  // exibido, e um chat com muitos prints não estoura o limite da rota (60 por minuto).
  useEffect(() => {
    const el = lugar.current;
    if (!el || visivel) return;
    const observador = new IntersectionObserver((entradas) => {
      if (entradas.some((e) => e.isIntersecting)) setVisivel(true);
    });
    observador.observe(el);
    return () => observador.disconnect();
  }, [visivel]);

  useEffect(() => {
    if (!visivel) return;
    let vivo = true;
    let criada: string | null = null;
    fetch(`/api/atendimento/print/${id}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((b) => {
        if (!vivo) return;
        criada = URL.createObjectURL(b);
        setUrl(criada);
      })
      .catch(() => {
        if (vivo) setFalhou(true);
      });
    return () => {
      vivo = false;
      if (criada) URL.revokeObjectURL(criada);
    };
  }, [id, visivel, tentativa]);

  if (falhou) {
    return (
      <button
        type="button"
        onClick={() => {
          setFalhou(false);
          setTentativa((t) => t + 1);
        }}
        className="text-primary flex items-center gap-1.5 text-xs font-medium underline-offset-2 hover:underline"
      >
        <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />O print não carregou — tentar de
        novo
      </button>
    );
  }
  if (!url) {
    return (
      <div
        ref={lugar}
        className="border-border bg-muted/40 flex h-24 w-40 items-center justify-center rounded-lg border"
      >
        <Loader2
          className="text-muted-foreground h-4 w-4 animate-spin"
          aria-label="Carregando o print"
        />
      </div>
    );
  }
  const botao = (
    <button
      type="button"
      onClick={() => {
        setDegrau(0);
        setAberto(true);
      }}
      aria-label="Ampliar o print"
      className="border-border block overflow-hidden rounded-lg border bg-white"
    >
      {/* `unoptimized`: é uma cópia local (blob:), que o otimizador do Next não busca. */}
      <Image
        unoptimized
        src={url}
        alt="Print enviado no atendimento"
        width={320}
        height={180}
        className="max-h-40 w-auto max-w-full cursor-zoom-in object-contain"
      />
    </button>
  );
  // O modal fica montado para devolver o foco à miniatura ao fechar.
  return (
    <>
      {botao}
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[92dvh] max-w-5xl gap-0 overflow-hidden p-0">
          <DialogHeader className="border-border border-b px-5 py-3 pr-12">
            <DialogTitle className="text-base">Print enviado no atendimento</DialogTitle>
            <DialogDescription className="text-xs">
              Clique na imagem para ampliar, ou use os botões.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted/40 max-h-[70dvh] overflow-auto">
            {aberto && (
              <Image
                unoptimized
                src={url}
                alt="Print enviado no atendimento"
                width={1600}
                height={900}
                onClick={() => setDegrau((d) => (d === 0 ? 2 : 0))}
                style={{ width: `${zoom * 100}%`, maxWidth: 'none', height: 'auto' }}
                className={cn('mx-auto block', zoom === 1 ? 'cursor-zoom-in' : 'cursor-zoom-out')}
              />
            )}
          </div>
          <div className="border-border flex items-center justify-center gap-2 border-t px-5 py-3">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setDegrau((d) => Math.max(0, d - 1))}
              disabled={degrau === 0}
              aria-label="Diminuir"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-muted-foreground w-12 text-center text-xs" aria-live="polite">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setDegrau((d) => Math.min(ZOOM.length - 1, d + 1))}
              disabled={degrau === ZOOM.length - 1}
              aria-label="Ampliar"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
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
