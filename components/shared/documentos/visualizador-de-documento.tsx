'use client';

/**
 * VER O DOCUMENTO SEM SAIR DA TELA — botão que abre um modal com o arquivo.
 *
 * 🔴 POR QUE ISTO EXISTE, e o pedido é do dono em 14/09/2026:
 * _"na procuração da ANVISA, onde tem os documentos, você vai adicionar a opção de visualizar
 * esses documentos através de um botão que abre um modal com a imagem. O mesmo você fará em
 * outras abas, como meu perfil. **Isso é essencial até pra validar o que está chegando entre
 * empresas.**"_
 *
 * A última frase é o requisito de verdade. Hoje a tela diz _"✓ rg.jpg"_ — e isso afirma que
 * um arquivo chegou, não que o arquivo **é o que diz ser**. Um handoff da Greens pode trazer
 * um comprovante no lugar do RG, um PDF corrompido, ou a foto de outra pessoa, e nada aqui
 * acusaria: o nome do arquivo é escolhido por quem envia. Ver é a única conferência possível.
 *
 * ## As três perguntas do `.claude/rules/seguranca-lgpd.md`
 *
 * 1. **Quem pode ler?** Este componente **não decide nada**. Ele aponta para
 *    `GET /api/documentos/{id}/arquivo`, que autentica, confere **escopo de objeto**
 *    (`garantirLeitorDoDocumento`) e responde 404 tanto para "não existe" quanto para "não é
 *    seu", para não virar oráculo de enumeração. Papel certo com id alheio é OWASP API1, o
 *    risco número um deste projeto — e ele continua sendo tratado lá, não aqui.
 * 2. **Quanto tempo fica?** Nada é guardado. A resposta vem com `cache-control: private,
 *    no-store`, então nem CDN nem proxy retêm dado de saúde.
 * 3. **O acesso é auditado?** Sim, e **isto melhora a auditoria**: a rota grava
 *    `acao: 'visualizar'` a cada chamada, e o arquivo só é buscado quando o modal ABRE. Cada
 *    linha de auditoria passa a significar "alguém de fato olhou", não "a tela carregou".
 *
 * ⚠️ **NUNCA A URL DO BLOB.** `documentos.urlBlob` existe e seria mais curto — e estaria
 * errado duas vezes: o blob novo é **privado** e não abre por link direto (é para isso que ele
 * é privado), e o antigo é público, então usá-lo entregaria o RG sem autenticação e sem
 * auditoria. Um caminho só, para os dois mundos, é o que a rota já resolve.
 *
 * ⚠️ **O TIPO VEM DO NOME DO ARQUIVO, porque a tabela não guarda MIME.** `db/schema/documentos.ts`
 * tem `nomeArquivo`, e mais nada sobre o conteúdo. Então a decisão imagem × PDF é por extensão,
 * e o que não for reconhecido cai no link de abrir em aba — nunca numa tela em branco.
 */

import { useState } from 'react';
import { Eye, ExternalLink, FileWarning, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/** Extensões que o navegador desenha inline com `<img>`. */
const IMAGENS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];

type Formato = 'imagem' | 'pdf' | 'desconhecido';

/**
 * Decide como desenhar, pelo nome do arquivo.
 *
 * Exportada porque é a única regra do componente que tem valor sozinha — e um guarda a
 * executa em vez de ler o JSX.
 */
export function formatoDoArquivo(nomeArquivo: string | null | undefined): Formato {
  const nome = (nomeArquivo ?? '').trim().toLowerCase();
  if (!nome) return 'desconhecido';
  if (nome.endsWith('.pdf')) return 'pdf';
  if (IMAGENS.some((ext) => nome.endsWith(ext))) return 'imagem';
  return 'desconhecido';
}

export interface VisualizadorDeDocumentoProps {
  /** O id na tabela `documentos` — é ele que a rota autenticada resolve. */
  documentoId: string;
  /** O que o paciente chama isto: "Documento com foto", "Receita médica". */
  rotulo: string;
  /** O nome do arquivo enviado. Decide imagem × PDF, e aparece no modal. */
  nomeArquivo?: string | null;
  /** Quem enviou, quando se sabe — é o que responde "isto veio da Greens?". */
  procedencia?: string | null;
  className?: string;
  /** Tamanho do botão, para caber tanto em linha de checklist quanto em card. */
  tamanho?: 'sm' | 'default';
}

export function VisualizadorDeDocumento({
  documentoId,
  rotulo,
  nomeArquivo,
  procedencia,
  className,
  tamanho = 'sm',
}: VisualizadorDeDocumentoProps) {
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [falhou, setFalhou] = useState(false);

  /**
   * 🔴 O endereço é sempre este. Ver a nota do topo sobre `urlBlob`.
   */
  const endereco = `/api/documentos/${documentoId}/arquivo`;
  const formato = formatoDoArquivo(nomeArquivo);

  return (
    <Dialog
      open={aberto}
      onOpenChange={(v) => {
        setAberto(v);
        // Reabrir depois de uma falha tem de tentar de novo, não mostrar o erro velho.
        if (v) {
          setCarregando(true);
          setFalhou(false);
        }
      }}
    >
      {/*
        `render=`, e não `asChild`: o Dialog daqui é `base-ui`, não Radix. Os dois resolvem o
        mesmo problema — o gatilho ser o SEU botão e não um `<button>` a mais — com nomes
        diferentes, e trocar um pelo outro compila em erro de tipo, não em tela quebrada.
      */}
      <DialogTrigger
        render={
          <Button
            type="button"
            size={tamanho}
            variant="outline"
            className={cn('shrink-0 gap-1.5', className)}
            aria-label={`Visualizar ${rotulo}`}
          />
        }
      >
        <Eye className="h-3.5 w-3.5" />
        Ver
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden p-0">
        <DialogHeader className="border-border border-b px-6 py-4">
          <DialogTitle className="text-base">{rotulo}</DialogTitle>
          <DialogDescription className="text-xs">
            {nomeArquivo ? <span className="break-all">{nomeArquivo}</span> : 'Arquivo enviado'}
            {procedencia ? <span className="ml-1.5">· enviado por {procedencia}</span> : null}
          </DialogDescription>
        </DialogHeader>

        {/*
          🔴 O CONTEÚDO SÓ MONTA COM O MODAL ABERTO — e não é detalhe de performance.

          `<img>` e `<iframe>` disparam o GET ao montar, e a rota grava auditoria a cada GET.
          Montar fechado encheria o registro de "visualizou" para quem só abriu a página, e
          uma auditoria que regista o que não aconteceu é pior que nenhuma.
        */}
        <div className="bg-muted/30 relative max-h-[70vh] min-h-[280px] overflow-auto">
          {aberto && !falhou && formato === 'imagem' && (
            /*
              🔴 `<img>` DE PROPÓSITO, e não `next/image`.

              O otimizador do Next BUSCA a imagem no servidor e a guarda em cache para servir
              versões redimensionadas. Fazer um documento de saúde passar por ali criaria uma
              segunda cópia, fora da rota que autentica e audita, e num cache que a resposta
              pede explicitamente para não existir (`cache-control: private, no-store`).

              O aviso do lint é sobre LCP e banda. O custo do outro lado é dado de paciente
              replicado — não há comparação.
            */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={endereco}
              alt={rotulo}
              className="mx-auto block h-auto w-full max-w-full object-contain"
              onLoad={() => setCarregando(false)}
              onError={() => {
                setCarregando(false);
                setFalhou(true);
              }}
            />
          )}

          {aberto && !falhou && formato === 'pdf' && (
            <iframe
              src={endereco}
              title={rotulo}
              className="h-[70vh] w-full border-0"
              onLoad={() => setCarregando(false)}
            />
          )}

          {aberto && !falhou && formato === 'desconhecido' && (
            <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 px-6 text-center">
              <FileWarning className="text-muted-foreground h-8 w-8" />
              <p className="text-muted-foreground text-sm">
                Não conseguimos desenhar este arquivo aqui — o formato não é imagem nem PDF.
              </p>
            </div>
          )}

          {aberto && falhou && (
            <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 px-6 text-center">
              <FileWarning className="text-destructive h-8 w-8" />
              {/*
                ⚠️ DIZ O QUE ACONTECEU, não "erro". A rota responde 404 tanto para "não existe"
                quanto para "não é seu" — de propósito, para não virar oráculo. Então a tela
                também não adivinha qual dos dois foi.
              */}
              <p className="text-muted-foreground text-sm">
                Não conseguimos abrir este arquivo agora. Tente abrir em uma aba nova.
              </p>
            </div>
          )}

          {aberto && carregando && !falhou && formato !== 'desconhecido' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
            </div>
          )}
        </div>

        <div className="border-border flex items-center justify-between gap-3 border-t px-6 py-3">
          {/*
            A saída que sempre funciona. O navegador desenha muito mais que um `<img>`, e
            quando nada disso der certo o download continua sendo caminho — pela MESMA rota
            autenticada, então continua auditado.
          */}
          <a
            href={endereco}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Abrir em uma aba nova
          </a>
          <p className="text-muted-foreground/70 text-[11px]">
            Documento de saúde — o acesso fica registrado.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
