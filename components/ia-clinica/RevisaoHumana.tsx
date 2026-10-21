'use client';

/**
 * A TRAVA 2 na tela — o passo que a saída da IA precisa atravessar para existir no prontuário.
 *
 * 🔴 POR QUE ESTE COMPONENTE NÃO TEM BOTÃO DE PRESCREVER
 * É o ponto central do desenho aprovado (`DO-33`): entre a sugestão e o ato clínico existe um
 * juízo humano **registrado**, e não um clique. Um botão "prescrever" aqui transformaria a tela
 * naquela que **dirige** a conduta — e é justamente essa distinção que pesa no enquadramento de
 * software médico (`ANV-01`…`ANV-04`).
 *
 * A prescrição continua onde sempre esteve: no fluxo de prescrição, depois desta decisão.
 *
 * 🔴 DIVERGIR É UM CAMINHO DE PRIMEIRA CLASSE
 * Não é o "cancelar" da tela. Tem o mesmo peso visual de concordar, porque registrar que o
 * médico discordou é o que permite medir a qualidade do modelo — e é o que separa revisão de
 * obediência. Divergir **exige** justificativa; o servidor recusa sem ela.
 */

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Loader2,
  SplitSquareVertical,
  UserCheck,
} from 'lucide-react';

import { registrarRevisao } from '@/app/_actions/revisao-ia';
import { listarRascunhosRevisao, salvarRascunhoRevisao } from '@/app/_actions/rascunho-revisao';
import { EvidenciaDaHipotese } from '@/components/ia-clinica/EvidenciaDaHipotese';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { GrafoEvidencias } from '@/lib/ia-clinica/contrato';
import { cn } from '@/lib/utils';

interface Props {
  pacienteId: string;
  anamneseId?: string;
  teleconsultaId?: string;
  grafo: GrafoEvidencias;
  /** A hipótese que o médico abriu no painel — vira a sugestão pré-selecionada aqui. */
  hipoteseAberta?: string | null;
  onRegistrado?: () => void;
  /** Compacto para o sidebar da teleconsulta, onde a coluna é estreita. */
  denso?: boolean;
  className?: string;
}

export function RevisaoHumana({
  pacienteId,
  anamneseId,
  teleconsultaId,
  grafo,
  hipoteseAberta,
  onRegistrado,
  denso = false,
  className,
}: Props) {
  const [modo, setModo] = useState<'validar' | 'divergir' | null>(null);
  const [hipoteseId, setHipoteseId] = useState<string | null>(hipoteseAberta ?? null);
  const [conclusao, setConclusao] = useState('');
  const [cid, setCid] = useState('');
  /**
   * Os dois campos do `DO-40` — só aparecem ao DIVERGIR.
   *
   * > "a hipotese manual em divirjo ela tem que ter também a alimentação do rag ou seja precisa
   * >  de um texto explicando porque a ia errou (opcional) além de ter também o medicamento na
   * >  qual o médico vai prescrever"
   *
   * Obrigatoriedade **diferente de propósito**: exigir a explicação de quem está com pressa
   * produz texto vazio, que polui o corpus mais do que a ausência. Já o medicamento é o que
   * fecha o par (sugerido × escolhido) — sem ele, a divergência diz que o modelo errou mas não
   * o que era certo.
   */
  const [porQueIaErrou, setPorQueIaErrou] = useState('');
  const [medicamentoPrescrito, setMedicamentoPrescrito] = useState('');
  /**
   * Qual opção está com a evidência aberta AQUI, na hora de decidir.
   *
   * Pedido do dono em 24/08/2026: *"em Sua decisão deve ter um botão dentro de cada uma das
   * opções na qual vai expandir e mostrar o mesmo dado que há em Hipóteses sugeridas pela IA (…)
   * para o médico querer revisar nessa parte do processo"*.
   *
   * É estado separado de `hipoteseId` de propósito: **abrir para reler não é escolher**. Se um
   * clique fizesse as duas coisas, o médico selecionaria uma hipótese só por ter querido
   * conferi-la — e num passo de HITL a seleção acidental é o defeito mais grave possível.
   */
  const [revisandoId, setRevisandoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [registrado, setRegistrado] = useState(false);
  const [enviando, iniciar] = useTransition();

  // ── O RASCUNHO NO SERVIDOR (`DO-41`, ADR-0011 D-03/D-04) ─────────────────────
  // > "o médico pode sair sem querer e esse dado precisa ficar salvo, ou seja precisa ter um
  // >  historico assim como tem no vid-ai"
  //
  // 🛑 `localStorage` foi REJEITADO com motivo: é dado de saúde num navegador de consultório que
  // pode ser compartilhado, e não sobrevive a trocar de máquina — que é o caso do `DO-41`.
  const [rascunhoSalvoEm, setRascunhoSalvoEm] = useState<string | null>(null);
  const [versoes, setVersoes] = useState<number>(0);
  const [restaurado, setRestaurado] = useState(false);
  // `useRef` para não reidratar duas vezes: reidratar por cima do que o médico já digitou
  // apagaria decisão tomada — é o `preservarCamposHitl()` do VidAI (P7).
  const jaReidratou = useRef(false);

  const conteudoAtual = useCallback(
    () => ({ modo, hipoteseId, conclusao, cid, porQueIaErrou, medicamentoPrescrito }),
    [modo, hipoteseId, conclusao, cid, porQueIaErrou, medicamentoPrescrito],
  );

  // Retomada: busca a versão mais alta UMA vez, e só preenche campo que está vazio.
  useEffect(() => {
    if (jaReidratou.current || registrado) return;
    jaReidratou.current = true;
    void (async () => {
      const r = await listarRascunhosRevisao(pacienteId);
      if (!r.sucesso || r.dados.length === 0) return;
      setVersoes(r.dados.length);
      const c = r.dados[0].conteudo as Record<string, string | null>;
      // Só preenche o que está vazio — nunca sobrescreve o que já foi digitado nesta sessão.
      setModo((v) => v ?? (c.modo as 'validar' | 'divergir' | null) ?? null);
      setHipoteseId((v) => v ?? c.hipoteseId ?? null);
      setConclusao((v) => v || (c.conclusao ?? ''));
      setCid((v) => v || (c.cid ?? ''));
      setPorQueIaErrou((v) => v || (c.porQueIaErrou ?? ''));
      setMedicamentoPrescrito((v) => v || (c.medicamentoPrescrito ?? ''));
      setRestaurado(true);
    })();
  }, [pacienteId, registrado]);

  const salvarRascunho = useCallback(async () => {
    const r = await salvarRascunhoRevisao({
      pacienteId,
      anamneseId,
      teleconsultaId,
      conteudo: conteudoAtual(),
    });
    if (r.sucesso) {
      setVersoes(r.dados.versao);
      setRascunhoSalvoEm(new Date().toLocaleTimeString('pt-BR'));
    }
  }, [pacienteId, anamneseId, teleconsultaId, conteudoAtual]);

  /**
   * 🔴 AUTO-SAVE — é isto que cumpre o `DO-41`, não o botão.
   *
   * > "o médico **pode sair sem querer** e esse dado precisa ficar salvo"
   *
   * Um botão manual não protege de sair sem querer: quem sai sem querer, por definição, **não
   * clicou**. O botão continua existindo para quem quer salvar de propósito, mas o mecanismo que
   * atende o pedido é este.
   *
   * **2 segundos de debounce**, e não a cada tecla: cada salvamento INSERE uma linha nova
   * (histórico não se sobrescreve), então salvar por tecla criaria centenas de versões e
   * transformaria o histórico em ruído. Dois segundos é a pausa natural entre frases.
   */
  useEffect(() => {
    if (!modo || registrado) return;
    const temConteudo =
      conclusao.trim() || cid.trim() || porQueIaErrou.trim() || medicamentoPrescrito.trim();
    if (!temConteudo) return;

    const timer = setTimeout(() => void salvarRascunho(), 2000);
    return () => clearTimeout(timer);
  }, [
    modo,
    registrado,
    conclusao,
    cid,
    porQueIaErrou,
    medicamentoPrescrito,
    hipoteseId,
    salvarRascunho,
  ]);

  /**
   * A última rede: fechar a aba dispara um aviso do navegador enquanto há texto não registrado.
   *
   * ⚠️ NÃO tentamos salvar aqui. Requisição disparada em `beforeunload` é cancelada pelo
   * navegador na maior parte das vezes — prometer um salvamento que não acontece é pior que não
   * prometer. O debounce de 2 s é quem de fato salvou; isto só avisa quem está prestes a sair
   * dentro dessa janela.
   */
  useEffect(() => {
    if (!modo || registrado) return;
    const aviso = (e: BeforeUnloadEvent) => {
      if (!conclusao.trim() && !medicamentoPrescrito.trim()) return;
      e.preventDefault();
    };
    window.addEventListener('beforeunload', aviso);
    return () => window.removeEventListener('beforeunload', aviso);
  }, [modo, registrado, conclusao, medicamentoPrescrito]);

  const hipoteseEscolhida = grafo.hipoteses.find((h) => h.id === hipoteseId) ?? null;

  function registrar() {
    if (!modo) return;
    setErro(null);
    iniciar(async () => {
      const r = await registrarRevisao({
        pacienteId,
        anamneseId,
        teleconsultaId,
        validacao: modo === 'validar' ? 'validado' : 'divergente',
        hipoteseAcatadaId: modo === 'validar' ? (hipoteseId ?? undefined) : undefined,
        hipoteseAcatadaTitulo:
          modo === 'validar' ? (hipoteseEscolhida?.titulo ?? undefined) : undefined,
        conclusaoMedico: conclusao.trim() || undefined,
        cidMedico: cid.trim() || undefined,
        // `DO-40` — só fazem sentido na divergência; ao validar, não há "erro da IA" a explicar.
        porQueIaErrou: modo === 'divergir' ? porQueIaErrou.trim() || undefined : undefined,
        medicamentoPrescritoNome:
          modo === 'divergir' ? medicamentoPrescrito.trim() || undefined : undefined,
        // A saída como ela apareceu na tela, congelada — é o que torna a revisão auditável.
        saidaApresentada: {
          schema_version: grafo.schema_version ?? null,
          sindrome: grafo.sindrome?.titulo ?? null,
          hipoteses: grafo.hipoteses.map((h) => ({
            id: h.id,
            slot: h.slot,
            titulo: h.titulo,
            cid: h.cid,
            confianca_evidencia: h.confianca_evidencia ?? null,
          })),
          completude: grafo.completude ?? null,
        },
      });
      if (r.sucesso) {
        setRegistrado(true);
        onRegistrado?.();
      } else {
        setErro(r.erro);
      }
    });
  }

  if (registrado) {
    return (
      <Card className={cn('border-secondary/40 bg-secondary/5', className)}>
        <CardContent className="flex items-start gap-3 py-5">
          <UserCheck className="text-secondary mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-heading text-sm font-semibold">Decisão registrada</p>
            <p className="text-muted-foreground mt-1 text-sm">
              {modo === 'validar'
                ? `Você acatou: ${hipoteseEscolhida?.titulo}.`
                : 'Sua divergência foi registrada — e ela vale como dado sobre a qualidade da análise.'}{' '}
              Fica no prontuário com o seu nome, a data e a versão da análise revisada.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('border-primary/40', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="font-heading flex items-center gap-2 text-base">
          <UserCheck className="text-primary size-4" />
          Sua decisão
        </CardTitle>
        <p className="text-muted-foreground text-sm">
          A análise acima é apoio.{' '}
          <strong className="text-foreground">Nada vai ao prontuário sem este passo</strong> — e o
          que for registrado leva o seu nome.
        </p>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Os dois caminhos, com o mesmo peso. Divergir não é o "cancelar" da tela. */}
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setModo('validar')}
            aria-pressed={modo === 'validar'}
            className={cn(
              'rounded-lg border p-4 text-left transition-colors',
              modo === 'validar'
                ? 'border-secondary bg-secondary/10'
                : 'border-border hover:border-secondary/50',
            )}
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <Check className="text-secondary size-4" />
              Acato uma das hipóteses
            </span>
            <span className="text-muted-foreground mt-1 block text-xs">
              A análise ajudou, e você escolhe qual.
            </span>
          </button>

          <button
            type="button"
            onClick={() => setModo('divergir')}
            aria-pressed={modo === 'divergir'}
            className={cn(
              'rounded-lg border p-4 text-left transition-colors',
              modo === 'divergir'
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-primary/50',
            )}
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <SplitSquareVertical className="text-primary size-4" />
              Divirjo da análise
            </span>
            <span className="text-muted-foreground mt-1 block text-xs">
              Sua conclusão é outra — e isso é informação, não erro.
            </span>
          </button>
        </div>

        {modo === 'validar' && (
          <div className="border-secondary/40 space-y-3 border-l-2 pl-4">
            <Label className="text-sm font-medium">Qual hipótese você acata?</Label>
            <div className="space-y-2">
              {grafo.hipoteses.map((h) => {
                const escolhida = hipoteseId === h.id;
                const revisando = revisandoId === h.id;
                return (
                  <div
                    key={h.id}
                    className={cn(
                      'rounded-md border transition-colors',
                      escolhida ? 'border-secondary bg-secondary/5' : 'border-border',
                    )}
                  >
                    {/*
                      Dois botões IRMÃOS, nunca aninhados: um <button> dentro de outro é HTML
                      inválido e o navegador desmonta a árvore de formas imprevisíveis. E são
                      dois porque as ações são distintas — escolher e reler.
                    */}
                    <div className="flex items-stretch">
                      <button
                        type="button"
                        onClick={() => setHipoteseId(h.id)}
                        aria-pressed={escolhida}
                        className="flex min-w-0 flex-1 items-center gap-2.5 p-3 text-left text-sm"
                      >
                        <span className="bg-muted flex size-5 shrink-0 items-center justify-center rounded-full font-mono text-xs">
                          {h.slot}
                        </span>
                        <span className="min-w-0 flex-1">{h.titulo}</span>
                        {h.cid && (
                          <span className="text-muted-foreground shrink-0 font-mono text-xs">
                            {h.cid}
                          </span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setRevisandoId(revisando ? null : h.id)}
                        aria-expanded={revisando}
                        aria-label={`Revisar a evidência de ${h.titulo}`}
                        className={cn(
                          'text-muted-foreground hover:text-foreground flex shrink-0 items-center gap-1 border-l px-3 text-xs transition-colors',
                          revisando && 'text-foreground bg-muted/50',
                        )}
                      >
                        <ChevronDown
                          className={cn('size-3.5 transition-transform', revisando && 'rotate-180')}
                        />
                        {!denso && <span>revisar</span>}
                      </button>
                    </div>

                    {revisando && (
                      <div className="border-t p-3">
                        <EvidenciaDaHipotese grafo={grafo} hipotese={h} denso={denso} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {modo && (
          <div className="border-primary/30 space-y-4 border-l-2 pl-4">
            <div className="space-y-2">
              <Label htmlFor="conclusao">
                Sua conclusão
                {modo === 'divergir' && <span className="text-destructive ml-1">*</span>}
              </Label>
              <Textarea
                id="conclusao"
                rows={3}
                value={conclusao}
                onChange={(e) => setConclusao(e.target.value)}
                placeholder={
                  modo === 'divergir'
                    ? 'O que você concluiu, e por que difere da análise'
                    : 'Observação sobre a decisão (opcional)'
                }
              />
              {modo === 'divergir' && (
                <p className="text-muted-foreground text-xs">
                  Obrigatório ao divergir. Divergência sem justificativa não mede nada — e é a
                  divergência justificada que melhora o modelo.
                </p>
              )}
            </div>

            <div className="max-w-xs space-y-2">
              <Label htmlFor="cid">CID que você registra</Label>
              <Input
                id="cid"
                value={cid}
                onChange={(e) => setCid(e.target.value)}
                placeholder="opcional — pode diferir do sugerido"
                className="font-mono"
              />
            </div>

            {/* ── Os dois campos do `DO-40`: só ao divergir ────────────────────
                Ficam DEPOIS da conclusão e do CID de propósito: o médico primeiro registra o
                que ele concluiu (que é o ato clínico), e só então diz o que isso ensina ao
                modelo. Inverter a ordem faria a tela parecer que o objetivo é treinar a IA. */}
            {modo === 'divergir' && (
              <div className="animate-fade-in border-secondary/40 space-y-4 rounded-xl border border-dashed p-4">
                <p className="text-muted-foreground text-xs leading-relaxed">
                  O que você registrar aqui vira insumo de aprendizado do modelo, marcado como
                  revisão humana. Laudo bruto de IA nunca entra — só o respaldo do médico.
                </p>

                <div className="space-y-2">
                  <Label htmlFor="medicamento-prescrito">
                    Medicamento que você vai prescrever
                    <span className="text-destructive ml-1">*</span>
                  </Label>
                  <Input
                    id="medicamento-prescrito"
                    value={medicamentoPrescrito}
                    onChange={(e) => setMedicamentoPrescrito(e.target.value)}
                    placeholder="Nome do produto"
                  />
                  <p className="text-muted-foreground text-xs">
                    Obrigatório. É ele que fecha o par que o modelo aprende: o que foi sugerido e o
                    que você de fato escolheu.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="por-que-ia-errou">Por que a análise errou</Label>
                  <Textarea
                    id="por-que-ia-errou"
                    rows={2}
                    value={porQueIaErrou}
                    onChange={(e) => setPorQueIaErrou(e.target.value)}
                    placeholder="Opcional — o que faltou, ou o que foi lido errado"
                  />
                  <p className="text-muted-foreground text-xs">
                    Opcional, e de propósito: explicação escrita às pressas ensina menos que
                    nenhuma.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── A barra do rascunho (`DO-41`) ────────────────────────────────────
            Fica ao pé do formulário, discreta: salvar rascunho é rede de segurança, não a ação
            principal. A ação principal é registrar a decisão. */}
        {modo && !registrado && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
            <p className="text-muted-foreground text-xs">
              {restaurado && versoes > 0 ? (
                <>
                  Rascunho restaurado do servidor · {versoes} versão{versoes === 1 ? '' : 'ões'}{' '}
                  salva{versoes === 1 ? '' : 's'}
                </>
              ) : rascunhoSalvoEm ? (
                <>
                  Rascunho salvo às {rascunhoSalvoEm} · versão {versoes}
                </>
              ) : (
                'Salva sozinho no servidor enquanto você escreve — não neste navegador.'
              )}
            </p>
            <Button type="button" variant="ghost" size="sm" onClick={salvarRascunho}>
              Salvar rascunho
            </Button>
          </div>
        )}

        {erro && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertDescription>{erro}</AlertDescription>
          </Alert>
        )}

        {!modo && (
          <Alert>
            <AlertTitle>Escolha um dos dois caminhos</AlertTitle>
            <AlertDescription>
              Enquanto não houver decisão registrada, a análise fica aguardando você — e não entra
              no prontuário.
            </AlertDescription>
          </Alert>
        )}

        <Button
          size="lg"
          className="h-12 w-full text-base sm:w-auto"
          disabled={!modo || enviando || (modo === 'validar' && !hipoteseId)}
          onClick={registrar}
        >
          {enviando ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <UserCheck className="size-4" />
          )}
          Registrar minha decisão
        </Button>

        {/*
          FRONTEIRA_MOTOR_IA: quando a prescrição for gerada a partir desta decisão (Sprint 5),
          ela entra em tela PRÓPRIA — não como botão aqui. Um caminho de um clique entre
          sugestão e prescrição é exatamente o desenho rejeitado em `DO-33`.
        */}
      </CardContent>
    </Card>
  );
}
