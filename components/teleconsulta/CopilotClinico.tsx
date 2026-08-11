'use client';

import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Brain, X, Loader2, CheckCircle2, Edit3, Sparkles,
  AlertTriangle, ClipboardCheck, Cpu, FileText, Pill,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { getPusherClient } from '@/lib/integrations/pusher/client';

type AbaAtiva = 'resumo' | 'prescricao' | 'raciocinio';

interface CopilotClinicoProps {
  salaId: string;
  roomId: string;
  pacienteNome: string;
  pacienteId: string;
  consultaId: string | null;
  visivel: boolean;
  onFechar: () => void;
  onTranscricaoPronta: () => void;
}

export function CopilotClinico({
  salaId, roomId, pacienteNome, pacienteId,
  consultaId, visivel, onFechar, onTranscricaoPronta,
}: CopilotClinicoProps) {
  const [abaAtiva, setAbaAtiva] = useState<AbaAtiva>('resumo');
  const [iaProcessando, setIaProcessando] = useState(false);
  const [rascunho, setRascunho] = useState('');
  const [textoEditado, setTextoEditado] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [aprovado, setAprovado] = useState(false);
  const [alertaCritico, setAlertaCritico] = useState(false);
  const [modeloUsado, setModeloUsado] = useState('gemini-2.5-flash');

  // Ouvir Pusher para notificação de transcrição pronta
  useEffect(() => {
    if (!salaId) return;
    const pusher = getPusherClient();
    const channel = pusher.subscribe(`private-sala-${salaId}`);

    // Evento disparado quando Gemini conclui a narrativa clínica
    channel.bind('transcricao:narrativa_pronta', (data: {
      narrativa: string;
      modeloUsado: string;
      alertaCritico?: boolean;
    }) => {
      setRascunho(data.narrativa);
      setTextoEditado(data.narrativa);
      setModeloUsado(data.modeloUsado ?? 'gemini-2.5-flash');
      setAlertaCritico(data.alertaCritico ?? false);
      setIaProcessando(false);
      onTranscricaoPronta();

      toast.success('🤖 Rascunho clínico pronto!', {
        description: 'Gemini gerou a narrativa clínica. Revise e aprove.',
        duration: 6000,
      });
    });

    channel.bind('transcricao:processando', () => {
      setIaProcessando(true);
    });

    return () => {
      pusher.unsubscribe(`private-sala-${salaId}`);
    };
  }, [salaId, onTranscricaoPronta]);

  // Buscar narrativa existente ao abrir
  useEffect(() => {
    if (!visivel || !salaId) return;
    const buscar = async () => {
      try {
        const res = await fetch(`/api/teleconsulta/transcricao?teleconsultaId=${salaId}`);
        const data = await res.json();
        if (data.sucesso && data.dados?.narrativa) {
          setRascunho(data.dados.narrativa);
          setTextoEditado(data.dados.narrativa);
          setModeloUsado(data.dados.modeloUsado ?? 'gemini-2.5-flash');
          if (data.dados.status === 'processando') setIaProcessando(true);
        }
      } catch { /* silencioso */ }
    };
    buscar();
  }, [visivel, salaId]);

  // Aprovar e salvar narrativa no prontuário
  const aprovarConduta = useCallback(async () => {
    if (!textoEditado.trim() || salvando) return;
    setSalvando(true);
    try {
      // Por ora salvar como evolução do paciente
      // Quando VIDaaS/prontuário eletrônico expandido estiver pronto,
      // migrar para endpoint específico de aprovação SOAP
      const res = await fetch('/api/teleconsulta/aprovar-narrativa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salaId,
          narrativaAprovada: textoEditado,
          pacienteId,
          consultaId,
        }),
      });

      if (res.ok) {
        setAprovado(true);
        toast.success('✅ Narrativa clínica aprovada e salva!');
        setTimeout(() => onFechar(), 2000);
      } else {
        toast.error('Erro ao salvar. Tente novamente.');
      }
    } catch {
      toast.error('Erro de conexão. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }, [textoEditado, salvando, salaId, pacienteId, consultaId, onFechar]);

  return (
    <AnimatePresence>
      {visivel && (
        <>
          {/* Overlay */}
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-40"
            onClick={onFechar}
          />

          {/* Painel lateral */}
          <motion.aside
            key="copilot"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed top-0 right-0 h-full w-full max-w-[480px] z-50
                       flex flex-col bg-background border-l border-primary/20 shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Brain className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-bold text-sm">Copilot Clínico</h2>
                  <p className="text-xs text-muted-foreground">
                    {pacienteNome} — rascunho para aprovação
                  </p>
                </div>
              </div>
              <button onClick={onFechar}
                className="p-1 rounded-lg hover:bg-accent text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Aviso HITL */}
            <div className="mx-5 mt-3 flex items-start gap-2 rounded-lg border
                            border-amber-300/50 bg-amber-50 px-3 py-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-800 leading-relaxed font-medium">
                Este rascunho foi gerado por IA e <strong>precisa da sua revisão</strong>{' '}
                antes de ser salvo no prontuário. (CFM Art. 10)
              </p>
            </div>

            {/* Alert crítico */}
            {alertaCritico && (
              <div className="mx-5 mt-2 flex items-start gap-2 rounded-lg border
                              border-red-400/40 bg-red-50 px-3 py-2.5 animate-pulse">
                <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-xs text-red-700 font-semibold">
                  ⚠️ Termos críticos detectados na transcrição. Revise com atenção.
                </p>
              </div>
            )}

            {/* Abas */}
            <div className="flex items-center gap-0 px-5 mt-3 border-b border-border">
              {([
                { aba: 'resumo', label: 'Resumo SOAP', icon: Edit3 },
                { aba: 'prescricao', label: 'Prescrição', icon: Pill },
                { aba: 'raciocinio', label: 'Raciocínio', icon: Cpu },
              ] as { aba: AbaAtiva; label: string; icon: any }[]).map(({ aba, label, icon: Icon }) => (
                <button
                  key={aba}
                  onClick={() => setAbaAtiva(aba)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium
                             transition-colors border-b-2 -mb-px
                             ${abaAtiva === aba
                               ? 'border-primary text-primary'
                               : 'border-transparent text-muted-foreground hover:text-foreground'
                             }`}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                </button>
              ))}
            </div>

            {/* Conteúdo */}
            <div className="flex-1 overflow-hidden flex flex-col">

              {/* ABA RESUMO SOAP */}
              {abaAtiva === 'resumo' && (
                <div className="flex-1 overflow-hidden flex flex-col gap-2 px-5 pt-4 pb-2">
                  {iaProcessando ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-3">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">
                        Gemini 2.5 Flash processando narrativa clínica...
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Transcrição dual-channel → mascaramento PII → narrativa SOAP
                      </p>
                    </div>
                  ) : rascunho ? (
                    <>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Edit3 className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                          Rascunho editável
                        </span>
                      </div>
                      <textarea
                        value={textoEditado}
                        onChange={(e) => setTextoEditado(e.target.value)}
                        className="flex-1 w-full rounded-lg bg-muted/30 border border-border
                                   text-foreground text-xs font-mono leading-relaxed
                                   resize-none p-3 focus:outline-none focus:border-primary/50
                                   placeholder:text-muted-foreground min-h-[280px]"
                        placeholder="O rascunho SOAP aparecerá aqui após a teleconsulta..."
                        spellCheck={false}
                      />
                    </>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
                      <Brain className="h-10 w-10 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground font-medium">
                        Aguardando transcrição
                      </p>
                      <p className="text-xs text-muted-foreground max-w-[260px]">
                        Após encerrar a teleconsulta, o Gemini irá gerar automaticamente
                        a narrativa clínica SOAP para sua revisão.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ABA PRESCRIÇÃO */}
              {abaAtiva === 'prescricao' && (
                <div className="flex-1 overflow-y-auto px-5 pt-4 pb-2 space-y-3">
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <p className="text-xs font-bold text-primary uppercase tracking-wider">
                        Emitir Prescrição
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      A prescrição será associada automaticamente a esta teleconsulta
                      e ao paciente <strong>{pacienteNome}</strong>.
                    </p>
                    <Button
                      size="sm"
                      className="w-full gap-1.5"
                      onClick={() => {
                        window.open(
                          `/medico/pacientes/${pacienteId}?tab=prescricao`,
                          '_blank'
                        );
                      }}
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Abrir formulário de prescrição
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground text-center">
                    A prescrição será gerada com o receituário oficial Be4Hope
                    e ficará disponível no portal do paciente para download.
                  </p>
                </div>
              )}

              {/* ABA RACIOCÍNIO */}
              {abaAtiva === 'raciocinio' && (
                <div className="flex-1 overflow-y-auto px-5 pt-4 pb-2 space-y-4">
                  <p className="text-xs text-muted-foreground">
                    Metadados do processo de geração pelo Gemini 2.5 Flash.
                    Documentado para fins de audit trail (CFM 2.454/2026 Art. 7.2).
                  </p>

                  <div className="rounded-lg border border-border bg-muted/20 px-4 py-3
                                  flex items-center gap-3">
                    <Cpu className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        Modelo
                      </p>
                      <p className="text-sm font-semibold">{modeloUsado}</p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
                      Pipeline de Processamento
                    </p>
                    {[
                      { label: 'Gravação dual-channel WebRTC', cor: 'bg-blue-500' },
                      { label: 'Merge AudioContext (médico L + paciente R)', cor: 'bg-blue-500' },
                      { label: 'Google Speech-to-Text v1', cor: 'bg-indigo-500' },
                      { label: 'Mascaramento PII (LGPD — CPF, RG, tel)', cor: 'bg-amber-500' },
                      { label: 'Gemini 2.5 Flash — Narrativa SOAP', cor: 'bg-primary' },
                      { label: 'Pusher → Copilot Clínico → Revisão', cor: 'bg-green-500' },
                    ].map((e, i) => (
                      <div key={i} className="flex items-center gap-2.5">
                        <div className={`w-2 h-2 rounded-full ${e.cor} shrink-0`} />
                        <span className="text-xs text-foreground">{e.label}</span>
                        <CheckCircle2 className="h-3 w-3 text-green-500 ml-auto shrink-0" />
                      </div>
                    ))}
                  </div>

                  <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
                      Status da API
                    </p>
                    <Badge className={`text-xs ${
                      process.env.NEXT_PUBLIC_GOOGLE_API_KEY_CONFIGURED === 'true'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {process.env.NEXT_PUBLIC_GOOGLE_API_KEY_CONFIGURED === 'true'
                        ? '✅ GOOGLE_API_KEY configurada'
                        : '⏳ STUB ativo — aguardando GOOGLE_API_KEY'
                      }
                    </Badge>
                  </div>
                </div>
              )}
            </div>

            {/* Rodapé */}
            <div className="px-5 py-4 border-t border-border flex flex-col gap-2">
              <Button
                onClick={aprovarConduta}
                disabled={salvando || !textoEditado.trim() || aprovado}
                className="w-full gap-2 h-10 font-semibold"
              >
                {salvando ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</>
                ) : aprovado ? (
                  <><CheckCircle2 className="h-4 w-4" /> Aprovado!</>
                ) : (
                  <><ClipboardCheck className="h-4 w-4" /> Aprovar e Salvar no Prontuário</>
                )}
              </Button>
              <Button variant="ghost" size="sm" onClick={onFechar} disabled={salvando}
                className="text-muted-foreground text-xs h-8">
                Revisar depois
              </Button>
              <p className="text-center text-[10px] text-muted-foreground">
                CFM Art. 10 + LGPD Art. 46-49 — aprovação médica obrigatória
              </p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
