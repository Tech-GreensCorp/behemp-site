'use client';

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { 
    Video, Users, Activity, Plus, RefreshCw, Calendar as CalendarIcon, 
    ArrowRight, CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useTeleconsulta } from "@/components/teleconsulta/TeleconsultaContext";

function TeleconsultaLobbyContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { state, startCall } = useTeleconsulta();
    
    const [consultasHoje, setConsultasHoje] = useState<any[]>([]);
    const [carregandoConsultas, setCarregandoConsultas] = useState(true);
    const [iniciandoSala, setIniciandoSala] = useState<string | null>(null);

    // Sprint 1: Auto-start if URL has parameters
    useEffect(() => {
        const urlSalaId = searchParams.get('salaId');
        const urlRoomId = searchParams.get('roomId');
        
        if (urlSalaId && urlRoomId && state.salaId !== urlSalaId) {
            startCall(urlSalaId, urlRoomId);
            // Opcional: limpar a URL para não re-chamar se der refresh
            router.replace('/medico/teleconsulta');
        }
    }, [searchParams, state.salaId, startCall, router]);

    // Sprint 2: Carregar fila viva
    useEffect(() => {
        setCarregandoConsultas(true);
        import('@/app/(medico)/_actions/consultas').then(m => m.listarConsultasMedico()).then(res => {
            if (res.sucesso && res.dados) {
                // Filtramos hoje (simplificado)
                const ativas = res.dados.filter((c: any) => c.status === 'agendada' || c.status === 'confirmada');
                setConsultasHoje(ativas);
            }
            setCarregandoConsultas(false);
        });
    }, []);

    const handleIniciarConsulta = async (consultaId: string) => {
        setIniciandoSala(consultaId);
        try {
            const { iniciarTeleconsulta } = await import('@/app/(medico)/_actions/notificar-teleconsulta');
            const res = await iniciarTeleconsulta(consultaId);
            if (res.sucesso && res.dados) {
                toast.success('Paciente notificado! Preparando sala...');
                // Em vez de navegar para URL, chamamos direto o Contexto Global! (Sprint 1)
                startCall(res.dados.salaId, res.dados.roomId);
            } else {
                toast.error(res.erro ?? 'Erro ao iniciar teleconsulta');
            }
        } catch {
            toast.error('Erro de conexão.');
        } finally {
            setIniciandoSala(null);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header Orgânico */}
            <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Command Center</p>
                <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight text-foreground">
                    Recepção de <span className="text-primary italic">Teleconsulta</span>
                </h1>
                <p className="text-muted-foreground mt-2">
                    Inicie seus atendimentos agendados ou crie consultas de urgência.
                </p>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                
                {/* Coluna 1 e 2: Fila de Espera */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-border flex items-center justify-between bg-secondary/20">
                            <h2 className="font-heading text-lg font-semibold flex items-center gap-2">
                                <Users className="h-5 w-5 text-primary" /> Fila de Espera (Hoje)
                            </h2>
                            <Badge variant="secondary" className="bg-primary/10 text-primary">
                                {consultasHoje.length} consultas pendentes
                            </Badge>
                        </div>
                        
                        <div className="p-6 flex-1 bg-background">
                            {carregandoConsultas ? (
                                <div className="flex justify-center items-center py-12">
                                    <RefreshCw className="h-6 w-6 animate-spin text-primary/50" />
                                </div>
                            ) : consultasHoje.length === 0 ? (
                                <div className="text-center py-12 flex flex-col items-center">
                                    <CalendarIcon className="h-12 w-12 text-muted-foreground/30 mb-4" />
                                    <p className="text-foreground font-medium">Nenhuma consulta agendada para hoje.</p>
                                    <p className="text-sm text-muted-foreground mt-1">Sua fila está vazia.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {consultasHoje.map((c) => (
                                        <div key={c.id} className="group relative flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-md transition-all">
                                            <div className="flex items-center gap-4">
                                                <div className="relative">
                                                    <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center">
                                                        <span className="font-semibold text-primary">{c.pacienteNome.charAt(0)}</span>
                                                    </div>
                                                    {/* Indicador de presença (Mock para Sprint 2, será implementado na 3 com Pusher real-time) */}
                                                    <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-background bg-slate-300" title="Offline" />
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold text-foreground">{c.pacienteNome}</h3>
                                                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                                                        <span>{new Date(c.dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                                        <span>•</span>
                                                        <span>Agendada</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <Button 
                                                onClick={() => handleIniciarConsulta(c.id)}
                                                disabled={iniciandoSala === c.id || state.salaId !== null}
                                                className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-6"
                                            >
                                                {iniciandoSala === c.id ? (
                                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Video className="h-4 w-4" />
                                                )}
                                                Chamar Paciente
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Coluna 3: Atendimento Imediato & Setup */}
                <div className="space-y-6">
                    
                    {/* Atendimento Imediato (Sprint 3) */}
                    <div className="bg-card border border-border rounded-2xl shadow-sm p-6 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-orange-400" />
                        <h2 className="font-heading text-lg font-semibold flex items-center gap-2 mb-2">
                            <Activity className="h-5 w-5 text-primary" /> Atendimento Imediato
                        </h2>
                        <p className="text-sm text-muted-foreground mb-6">
                            Inicie uma consulta de encaixe imediatamente. O paciente será notificado agora.
                        </p>
                        
                        <Button variant="outline" className="w-full justify-between group rounded-xl h-12" onClick={() => router.push('/medico/agenda')}>
                            <span className="flex items-center gap-2">
                                <Plus className="h-4 w-4 text-primary" />
                                Buscar Paciente
                            </span>
                            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </Button>
                    </div>

                    {/* Pre-flight Check Visual */}
                    <div className="bg-secondary/30 border border-border rounded-2xl p-6">
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Setup do Sistema</h3>
                        
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-foreground">Conexão Estável</p>
                                    <p className="text-xs text-muted-foreground">Ping: 24ms</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-foreground">Servidor WebRTC</p>
                                    <p className="text-xs text-muted-foreground">Online (us-east-1)</p>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}

export default function TeleconsultaLobby() {
    return (
        <Suspense fallback={<div className="p-12 flex justify-center"><RefreshCw className="h-8 w-8 animate-spin text-primary" /></div>}>
            <TeleconsultaLobbyContent />
        </Suspense>
    );
}
