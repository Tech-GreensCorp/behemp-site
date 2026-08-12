'use client';

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Video, Users, Activity, RefreshCw, Calendar as CalendarIcon,
    CheckCircle2, Zap, Wifi, WifiOff, Mic, Camera,
    AlertCircle, Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useTeleconsulta } from "@/components/teleconsulta/TeleconsultaContext";
import { BuscaPaciente } from "@/components/busca-paciente";
import { getPusherClient } from "@/lib/integrations/pusher/client";
import { listarConsultasMedico, listarPacientesMedico } from "@/app/(medico)/_actions/consultas";
import { listarPacientesParaPresenca, iniciarConsultaAvulsa, iniciarTeleconsulta } from "@/app/(medico)/_actions/notificar-teleconsulta";

interface ConsultaAgendada {
    id: string;
    pacienteNome: string;
    pacienteId: string;
    dataHora: Date;
    status: string;
}

interface Paciente {
    id: string;
    nome: string;
    email: string;
}

type ConexaoQualidade = 'verificando' | 'excelente' | 'boa' | 'ruim';

function TeleconsultaLobbyContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { state, startCall } = useTeleconsulta();

    // Fila de espera
    const [consultasHoje, setConsultasHoje] = useState<ConsultaAgendada[]>([]);
    const [carregandoConsultas, setCarregandoConsultas] = useState(true);
    const [iniciandoSala, setIniciandoSala] = useState<string | null>(null);

    // Atendimento imediato (Sprint 3)
    const [pacientes, setPacientes] = useState<Paciente[]>([]);
    const [pacienteSelecionado, setPacienteSelecionado] = useState('');
    const [iniciandoAvulso, setIniciandoAvulso] = useState(false);

    // Presença Pusher — userIds ativos no portal (Sprint 3)
    const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
    const [mapaUserIdParaPacienteId, setMapaUserIdParaPacienteId] = useState<Record<string, string>>({});

    // Pre-flight check (Sprint 2)
    const [qualidadeConexao, setQualidadeConexao] = useState<ConexaoQualidade>('verificando');
    const [ping, setPing] = useState<number | null>(null);
    const [temCamera, setTemCamera] = useState<boolean | null>(null);
    const [temMic, setTemMic] = useState<boolean | null>(null);

    // Sprint 1: Auto-start se URL tiver parâmetros (link direto via agenda)
    useEffect(() => {
        const urlSalaId = searchParams.get('salaId');
        const urlRoomId = searchParams.get('roomId');
        if (urlSalaId && urlRoomId && state.salaId !== urlSalaId) {
            startCall(urlSalaId, urlRoomId);
            router.replace('/medico/teleconsulta');
        }
    }, [searchParams, state.salaId, startCall, router]);

    // Carregar consultas da fila + pacientes para busca
    useEffect(() => {
        const carregar = async () => {
            setCarregandoConsultas(true);
            const [consultasRes, pacientesRes] = await Promise.all([
                listarConsultasMedico(),
                listarPacientesMedico(),
            ]);

            if (consultasRes.sucesso && consultasRes.dados) {
                const ativas = consultasRes.dados.filter(
                    (c: any) => c.status === 'agendada' || c.status === 'confirmada'
                ) as ConsultaAgendada[];
                setConsultasHoje(ativas);
            }

            if (pacientesRes.sucesso && pacientesRes.dados) {
                setPacientes(pacientesRes.dados);
            }

            setCarregandoConsultas(false);
        };
        carregar();
    }, []);

    // Sprint 3: Canal Pusher Presence para detectar pacientes online
    useEffect(() => {
        const carregarPresenca = async () => {
            try {
                const res = await listarPacientesParaPresenca();
                if (!res.sucesso || !res.dados) return;

                // Montar mapa userId -> pacienteId para correlacionar com a fila
                const mapa: Record<string, string> = {};
                res.dados.forEach(p => { mapa[p.userId] = p.pacienteId; });
                setMapaUserIdParaPacienteId(mapa);

                // Subscrever no canal presence da sala de espera virtual
                const pusher = getPusherClient();
                const canal = pusher.subscribe('presence-sala-espera');

                canal.bind('pusher:subscription_succeeded', (members: any) => {
                    const userIdsOnline = new Set<string>();
                    members.each((m: any) => { userIdsOnline.add(m.id); });
                    setOnlineUserIds(userIdsOnline);
                });

                canal.bind('pusher:member_added', (member: any) => {
                    setOnlineUserIds(prev => new Set([...prev, member.id]));
                });

                canal.bind('pusher:member_removed', (member: any) => {
                    setOnlineUserIds(prev => {
                        const next = new Set(prev);
                        next.delete(member.id);
                        return next;
                    });
                });

                return () => {
                    pusher.unsubscribe('presence-sala-espera');
                };
            } catch (e) {
                // Pusher opcional — não bloquear se falhar
                console.warn('[Lobby] Presença Pusher indisponível:', e);
            }
        };
        carregarPresenca();
    }, []);

    // Pre-flight: verificar dispositivos e ping
    useEffect(() => {
        const verificar = async () => {
            // Checar câmera e mic
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                setTemCamera(devices.some(d => d.kind === 'videoinput'));
                setTemMic(devices.some(d => d.kind === 'audioinput'));
            } catch {
                setTemCamera(false);
                setTemMic(false);
            }

            // Checar latência com o servidor WebRTC via STUN
            try {
                const inicio = Date.now();
                const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
                pc.createDataChannel('ping');
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                await new Promise<void>(resolve => {
                    pc.onicecandidate = (e) => { if (!e.candidate) resolve(); };
                    setTimeout(resolve, 2000);
                });
                const latencia = Date.now() - inicio;
                setPing(latencia);
                if (latencia < 100) setQualidadeConexao('excelente');
                else if (latencia < 300) setQualidadeConexao('boa');
                else setQualidadeConexao('ruim');
                pc.close();
            } catch {
                setQualidadeConexao('ruim');
            }
        };
        verificar();
    }, []);

    const handleIniciarConsulta = async (consultaId: string) => {
        setIniciandoSala(consultaId);
        try {
            const res = await iniciarTeleconsulta(consultaId);
            if (res.sucesso && res.dados) {
                toast.success('Paciente notificado! Abrindo sala...');
                startCall(res.dados.salaId, res.dados.roomId);
            } else {
                toast.error(res.erro ?? 'Erro ao iniciar teleconsulta');
            }
        } catch {
            toast.error('Erro de conexão. Tente novamente.');
        } finally {
            setIniciandoSala(null);
        }
    };

    const handleAtendimentoAvulso = async () => {
        if (!pacienteSelecionado) return;
        setIniciandoAvulso(true);
        try {
            const res = await iniciarConsultaAvulsa({
                pacienteId: pacienteSelecionado,
                tipo: 'encaixe',
            });
            if (res.sucesso && res.dados) {
                toast.success('Consulta criada e paciente notificado! Abrindo sala...');
                startCall(res.dados.salaId, res.dados.roomId);
            } else {
                toast.error(res.erro ?? 'Erro ao iniciar atendimento');
            }
        } catch {
            toast.error('Erro de conexão. Tente novamente.');
        } finally {
            setIniciandoAvulso(false);
        }
    };

    const isPacienteOnline = useCallback((pacienteId: string): boolean => {
        const userId = Object.entries(mapaUserIdParaPacienteId).find(([, pid]) => pid === pacienteId)?.[0];
        return userId ? onlineUserIds.has(userId) : false;
    }, [mapaUserIdParaPacienteId, onlineUserIds]);

    const qualidadeConfig = {
        verificando: { label: 'Verificando...', cor: 'text-muted-foreground', icon: RefreshCw, animate: true },
        excelente: { label: 'Excelente', cor: 'text-emerald-600', icon: Wifi, animate: false },
        boa: { label: 'Boa', cor: 'text-amber-600', icon: Wifi, animate: false },
        ruim: { label: 'Instável', cor: 'text-red-500', icon: WifiOff, animate: false },
    }[qualidadeConexao];

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            {/* Header */}
            <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Command Center</p>
                <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight text-foreground">
                    Recepção de <span className="text-primary italic">Teleconsulta</span>
                </h1>
                <p className="text-muted-foreground mt-2 text-sm">
                    Inicie seus atendimentos agendados ou crie consultas de urgência imediatamente.
                </p>
            </div>

            {/* Alerta se já há chamada ativa */}
            {state.salaId && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                    <p className="text-sm font-medium text-emerald-700">
                        Você tem uma teleconsulta em andamento. Minimize a tela para continuar navegando.
                    </p>
                </div>
            )}

            <div className="grid lg:grid-cols-3 gap-6 items-start">

                {/* Coluna 1 e 2: Fila de Espera */}
                <div className="lg:col-span-2">
                    <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                        {/* Header do card */}
                        <div className="p-5 border-b border-border flex items-center justify-between bg-secondary/30">
                            <h2 className="font-heading text-base font-semibold flex items-center gap-2">
                                <Users className="h-4 w-4 text-primary" />
                                Fila de Espera
                            </h2>
                            <Badge variant="outline" className="bg-background text-xs">
                                {consultasHoje.length} pendente{consultasHoje.length !== 1 ? 's' : ''}
                            </Badge>
                        </div>

                        <div className="p-5 bg-background min-h-[200px]">
                            {carregandoConsultas ? (
                                <div className="flex justify-center items-center py-16">
                                    <RefreshCw className="h-5 w-5 animate-spin text-primary/50" />
                                </div>
                            ) : consultasHoje.length === 0 ? (
                                <div className="text-center py-12 flex flex-col items-center gap-3">
                                    <CalendarIcon className="h-10 w-10 text-muted-foreground/20" />
                                    <div>
                                        <p className="font-medium text-foreground text-sm">Nenhuma consulta agendada para hoje</p>
                                        <p className="text-xs text-muted-foreground mt-1">Use o painel ao lado para um atendimento imediato</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {consultasHoje.map((c) => {
                                        const online = isPacienteOnline(c.pacienteId);
                                        const iniciais = c.pacienteNome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
                                        const horario = new Date(c.dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                                        return (
                                            <div
                                                key={c.id}
                                                className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                                                    online
                                                        ? 'border-emerald-200 bg-emerald-50/50 shadow-sm'
                                                        : 'border-border bg-card hover:border-primary/20 hover:shadow-sm'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    {/* Avatar */}
                                                    <div className="relative">
                                                        <div className={`h-11 w-11 rounded-full flex items-center justify-center font-semibold text-sm ${
                                                            online ? 'bg-emerald-100 text-emerald-700' : 'bg-secondary text-foreground'
                                                        }`}>
                                                            {iniciais}
                                                        </div>
                                                        {/* Indicador de presença */}
                                                        <div className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background ${
                                                            online ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
                                                        }`} />
                                                    </div>

                                                    {/* Info */}
                                                    <div>
                                                        <p className="font-semibold text-sm text-foreground leading-tight">{c.pacienteNome}</p>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <Clock className="h-3 w-3 text-muted-foreground" />
                                                            <span className="text-xs text-muted-foreground">{horario}</span>
                                                            {online && (
                                                                <span className="text-xs font-medium text-emerald-600">
                                                                    • Na sala de espera
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Botão */}
                                                <Button
                                                    onClick={() => handleIniciarConsulta(c.id)}
                                                    disabled={iniciandoSala === c.id || !!state.salaId}
                                                    size="sm"
                                                    className={`gap-2 rounded-full px-5 text-xs font-semibold transition-all ${
                                                        online
                                                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-200'
                                                            : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                                                    }`}
                                                >
                                                    {iniciandoSala === c.id ? (
                                                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                                    ) : (
                                                        <Video className="h-3.5 w-3.5" />
                                                    )}
                                                    {online ? 'Chamar Agora' : 'Notificar e Iniciar'}
                                                </Button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Coluna 3: Atendimento Imediato + Pre-flight */}
                <div className="space-y-4">

                    {/* Atendimento Imediato — overflow-visible para o dropdown aparecer fora do card */}
                    <div className="bg-card border border-border rounded-2xl shadow-sm relative">
                        {/* Barra de cor no topo — isolada com overflow-hidden para não vazar */}
                        <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl overflow-hidden">
                            <div className="h-full w-full bg-gradient-to-r from-primary via-orange-400 to-amber-400" />
                        </div>
                        <div className="p-5 pt-6">
                            <h2 className="font-heading text-base font-semibold flex items-center gap-2 mb-1">
                                <Zap className="h-4 w-4 text-primary" />
                                Atendimento Imediato
                            </h2>
                            <p className="text-xs text-muted-foreground mb-5">
                                Atenda agora sem agendamento. A consulta é criada automaticamente.
                            </p>

                            <div className="space-y-3">
                                <BuscaPaciente
                                    pacientes={pacientes}
                                    value={pacienteSelecionado}
                                    onChange={setPacienteSelecionado}
                                    placeholder="Buscar paciente..."
                                    disabled={iniciandoAvulso || !!state.salaId}
                                />

                                <Button
                                    onClick={handleAtendimentoAvulso}
                                    disabled={!pacienteSelecionado || iniciandoAvulso || !!state.salaId}
                                    className="w-full gap-2 rounded-xl font-semibold"
                                >
                                    {iniciandoAvulso ? (
                                        <>
                                            <RefreshCw className="h-4 w-4 animate-spin" />
                                            Criando sala e notificando...
                                        </>
                                    ) : (
                                        <>
                                            <Video className="h-4 w-4" />
                                            Atender Agora
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Pre-flight Check */}
                    <div className="bg-secondary/20 border border-border rounded-2xl p-5">
                        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                            Verificação do Ambiente
                        </h3>

                        <div className="space-y-3">
                            {/* Conexão */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <qualidadeConfig.icon className={`h-4 w-4 ${qualidadeConfig.cor} ${qualidadeConfig.animate ? 'animate-spin' : ''}`} />
                                    <span className="text-sm text-foreground">Conexão</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className={`text-xs font-medium ${qualidadeConfig.cor}`}>{qualidadeConfig.label}</span>
                                    {ping && <span className="text-xs text-muted-foreground">({ping}ms)</span>}
                                </div>
                            </div>

                            {/* Câmera */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    {temCamera === null
                                        ? <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin" />
                                        : temCamera
                                            ? <Camera className="h-4 w-4 text-emerald-600" />
                                            : <AlertCircle className="h-4 w-4 text-amber-500" />
                                    }
                                    <span className="text-sm text-foreground">Câmera</span>
                                </div>
                                <span className={`text-xs font-medium ${
                                    temCamera === null ? 'text-muted-foreground' :
                                    temCamera ? 'text-emerald-600' : 'text-amber-500'
                                }`}>
                                    {temCamera === null ? 'Verificando' : temCamera ? 'Detectada' : 'Não encontrada'}
                                </span>
                            </div>

                            {/* Microfone */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    {temMic === null
                                        ? <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin" />
                                        : temMic
                                            ? <Mic className="h-4 w-4 text-emerald-600" />
                                            : <AlertCircle className="h-4 w-4 text-red-500" />
                                    }
                                    <span className="text-sm text-foreground">Microfone</span>
                                </div>
                                <span className={`text-xs font-medium ${
                                    temMic === null ? 'text-muted-foreground' :
                                    temMic ? 'text-emerald-600' : 'text-red-500'
                                }`}>
                                    {temMic === null ? 'Verificando' : temMic ? 'Detectado' : 'Não encontrado'}
                                </span>
                            </div>

                            {/* Servidor */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                    <span className="text-sm text-foreground">Servidor</span>
                                </div>
                                <span className="text-xs font-medium text-emerald-600">Online</span>
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
        <Suspense fallback={
            <div className="p-12 flex justify-center">
                <RefreshCw className="h-8 w-8 animate-spin text-primary/40" />
            </div>
        }>
            <TeleconsultaLobbyContent />
        </Suspense>
    );
}
