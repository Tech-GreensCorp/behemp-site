'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, User, FileText, Pill, Calendar, Phone, Stethoscope, AlertTriangle, Activity } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { buscarDadosPainelTeleconsulta, type DadosPainelTeleconsulta } from '@/app/(medico)/_actions/teleconsulta-painel';
import { renovarUltimaPrescricao, type DadosFormRenovar } from '@/app/(medico)/_actions/prescricao-inline';
import { PrescricaoInlineWizard } from './PrescricaoInlineWizard';
import { ProntuarioVivo } from './ProntuarioVivo';
import { toast } from 'sonner';

interface PainelClinicoLateralProps {
  dados: DadosPainelTeleconsulta;
  salaId: string;
  abaInicial: 'paciente' | 'prontuario' | 'prescricao';
  visivel: boolean;
  onFechar: () => void;
}

export function PainelClinicoLateral({ dados: initialDados, salaId, abaInicial, visivel, onFechar }: PainelClinicoLateralProps) {
  const [aba, setAba] = useState<'paciente' | 'prontuario' | 'prescricao'>(abaInicial);
  const [dadosLocais, setDadosLocais] = useState(initialDados);

  // Estados do Wizard e Timeline
  const [wizardAberto, setWizardAberto] = useState(false);
  const [dadosWizard, setDadosWizard] = useState<DadosFormRenovar | null>(null);
  const [loadingRenovar, setLoadingRenovar] = useState(false);
  const [prontuarioVivoAberto, setProntuarioVivoAberto] = useState(false);
  const [prontuarioExpandido, setProntuarioExpandido] = useState(false);

  useEffect(() => {
    if (visivel) setAba(abaInicial);
  }, [visivel, abaInicial]);

  // Atualiza dadosLocais se as props mudarem
  useEffect(() => {
    setDadosLocais(initialDados);
  }, [initialDados]);

  const dados = dadosLocais;
  const { paciente, ultimaEvolucao, ultimaPrescricao, totalConsultas } = dados;

  const handleRefetch = async () => {
    const res = await buscarDadosPainelTeleconsulta(salaId);
    if (res.sucesso && res.dados) {
      setDadosLocais(res.dados);
    }
  };

  const handleRenovarClick = async () => {
    setLoadingRenovar(true);
    const res = await renovarUltimaPrescricao(salaId);
    if (res.sucesso && res.dados) {
      setDadosWizard(res.dados);
      setWizardAberto(true);
    } else {
      toast.error(res.erro || 'Erro ao buscar prescrição anterior');
    }
    setLoadingRenovar(false);
  };

  return (
    <AnimatePresence>
      {visivel && (
        <>
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-30"
            onClick={onFechar}
          />

          <motion.aside
            key="painel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`fixed top-4 bottom-4 right-4 z-40 flex flex-col bg-background rounded-2xl border border-border shadow-2xl overflow-hidden transition-all duration-300 ${prontuarioVivoAberto && prontuarioExpandido ? 'w-[calc(100%-2rem)] md:w-[640px]' : 'w-[380px]'}`}
          >
            {/* Se a timeline de prontuário estiver aberta, ela assume o painel */}
            {aba === 'prontuario' && prontuarioVivoAberto ? (
              <ProntuarioVivo
                salaId={salaId}
                pacienteNome={paciente.nome}
                onFechar={() => {
                  setProntuarioVivoAberto(false);
                  setProntuarioExpandido(false);
                }}
                isExpanded={prontuarioExpandido}
                onToggleExpand={() => setProntuarioExpandido(!prontuarioExpandido)}
              />
            ) : aba === 'prescricao' && wizardAberto ? (
              <PrescricaoInlineWizard
                salaId={salaId}
                pacienteNome={paciente.nome}
                dadosIniciais={dadosWizard}
                onConcluir={() => {
                  setWizardAberto(false);
                  handleRefetch();
                }}
                onCancelar={() => setWizardAberto(false)}
              />
            ) : (
              <>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
                  <div className="flex items-center gap-2 font-semibold">
                    {aba === 'paciente' && <><User className="h-4 w-4 text-primary" /> Dados do Paciente</>}
                    {aba === 'prontuario' && <><FileText className="h-4 w-4 text-primary" /> Prontuário</>}
                    {aba === 'prescricao' && <><Pill className="h-4 w-4 text-primary" /> Prescrições</>}
                  </div>
                  <button onClick={onFechar} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>

            {/* Abas Tab */}
            <div className="flex px-2 pt-2 gap-1 bg-muted/30 border-b border-border">
              {[
                { id: 'paciente', label: 'Paciente', icon: User },
                { id: 'prontuario', label: 'Prontuário', icon: FileText },
                { id: 'prescricao', label: 'Prescrição', icon: Pill },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setAba(t.id as any)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-t-lg transition-colors
                    ${aba === t.id ? 'bg-background border-x border-t border-border text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                >
                  <t.icon className="h-3 w-3" />
                  {t.label}
                </button>
              ))}
            </div>

            {/* Conteúdo scrollável */}
            <div className="flex-1 overflow-y-auto p-5">
              {/* ABA PACIENTE */}
              {aba === 'paciente' && (
                <div className="space-y-0">
                  {/* Banner de Alergias */}
                  {paciente.alergias && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-start gap-3 text-red-900 dark:text-red-200 mb-5">
                      <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold uppercase mb-0.5">Alerta de Alergia</p>
                        <p className="text-sm font-medium leading-tight">{paciente.alergias}</p>
                      </div>
                    </div>
                  )}

                  {/* Header: Avatar, Nome, Idade, Anvisa */}
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0">
                      {paciente.nome.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground leading-tight">{paciente.nome}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        {dados.sinaisRapidos?.idade != null && <span className="text-xs text-muted-foreground">{dados.sinaisRapidos.idade} anos</span>}
                        {dados.sinaisRapidos?.idade != null && <span className="text-xs text-muted-foreground text-border">•</span>}
                        <span className="text-xs text-muted-foreground">{totalConsultas} consulta{totalConsultas !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  </div>
                  {dados.statusAnvisa && dados.statusAnvisa.status !== 'none' && (
                    <div className="mt-3">
                      <Badge variant="outline" className={
                        dados.statusAnvisa.statusVencimento === 'valida' ? 'bg-green-500/10 text-green-700 border-green-500/20' :
                        dados.statusAnvisa.statusVencimento === 'vencendo' ? 'bg-amber-500/10 text-amber-700 border-amber-500/20' :
                        'bg-red-500/10 text-red-700 border-red-500/20'
                      }>
                        ANVISA: {dados.statusAnvisa.statusVencimento === 'valida' ? 'Válida' : dados.statusAnvisa.statusVencimento === 'vencendo' ? 'Vencendo' : 'Vencida'}
                      </Badge>
                    </div>
                  )}

                  {/* Widget Tratamento Atual */}
                  {dados.tratamentoAtual ? (
                    <div className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-3 mt-5">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-bold text-foreground leading-tight">{dados.tratamentoAtual.medicamentoNome}</h4>
                        <Badge variant="secondary" className="whitespace-nowrap shrink-0">{dados.tratamentoAtual.gotasPorDia} gotas/dia</Badge>
                      </div>
                      <div className="space-y-1.5 pt-1">
                        <div className="flex justify-between text-[11px] font-semibold uppercase tracking-wide">
                          <span className="text-muted-foreground">Progresso</span>
                          <span className={
                            dados.tratamentoAtual.statusFrasco === 'ok' ? 'text-green-600' :
                            dados.tratamentoAtual.statusFrasco === 'atencao' ? 'text-amber-600' : 'text-red-600'
                          }>
                            {dados.tratamentoAtual.percentualConsumido}% consumido
                          </span>
                        </div>
                        <div className="h-2 w-full bg-muted/50 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              dados.tratamentoAtual.statusFrasco === 'ok' ? 'bg-green-500' :
                              dados.tratamentoAtual.statusFrasco === 'atencao' ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${dados.tratamentoAtual.percentualConsumido}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs pt-1">
                        <span className="text-muted-foreground">Término: {dados.tratamentoAtual.dataFimPrevista}</span>
                        <span className="font-bold">{dados.tratamentoAtual.diasRestantes} dias restantes</span>
                      </div>
                      {dados.tratamentoAtual.statusFrasco === 'critico' && (
                        <div className="mt-3 text-xs text-red-700 bg-red-500/10 rounded-md p-2 text-center font-bold">
                          Recompra necessária urgente!
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-5 rounded-xl border border-dashed border-border bg-muted/20 flex flex-col items-center justify-center gap-2 mt-5 text-center">
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-1">
                        <Pill className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-semibold text-foreground">Nenhum tratamento ativo</p>
                      <p className="text-xs text-muted-foreground max-w-[200px]">O paciente não possui dosagens em andamento no momento.</p>
                      <Button variant="outline" size="sm" className="mt-3" onClick={() => window.open(`/medico/pacientes/${paciente.id}?tab=prescricao`, '_blank')}>Registrar tratamento</Button>
                    </div>
                  )}

                  {/* Mini-gráficos de Evolução */}
                  {dados.evolucaoGraficos && dados.evolucaoGraficos.length > 1 ? (
                    <div className="mt-6 space-y-2">
                      <div className="flex items-center gap-2 mb-3">
                        <Activity className="h-4 w-4 text-primary" />
                        <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Evolução Clínica</h4>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-muted/30 p-2 rounded-lg border border-border/50 flex flex-col items-center">
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Dor (0-10)</span>
                          <div className="h-10 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={dados.evolucaoGraficos}>
                                <Line type="stepAfter" dataKey="nivelDor" stroke="#ef4444" strokeWidth={2} dot={false} connectNulls />
                                <YAxis domain={[0, 10]} hide />
                                <Tooltip contentStyle={{ fontSize: '10px', padding: '2px 4px', borderRadius: '4px' }} labelStyle={{ display: 'none' }} cursor={false} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                        <div className="bg-muted/30 p-2 rounded-lg border border-border/50 flex flex-col items-center">
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Sono</span>
                          <div className="h-10 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={dados.evolucaoGraficos}>
                                <Line type="monotone" dataKey="qualidadeSono" stroke="#3b82f6" strokeWidth={2} dot={false} connectNulls />
                                <YAxis domain={[1, 4]} hide />
                                <Tooltip contentStyle={{ fontSize: '10px', padding: '2px 4px', borderRadius: '4px' }} labelStyle={{ display: 'none' }} cursor={false} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                        <div className="bg-muted/30 p-2 rounded-lg border border-border/50 flex flex-col items-center">
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Bem-estar</span>
                          <div className="h-10 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={dados.evolucaoGraficos}>
                                <Line type="monotone" dataKey="bemEstar" stroke="#22c55e" strokeWidth={2} dot={false} connectNulls />
                                <YAxis domain={[1, 4]} hide />
                                <Tooltip contentStyle={{ fontSize: '10px', padding: '2px 4px', borderRadius: '4px' }} labelStyle={{ display: 'none' }} cursor={false} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-6 space-y-2">
                      <div className="flex items-center gap-2 mb-3">
                        <Activity className="h-4 w-4 text-primary" />
                        <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Evolução Clínica</h4>
                      </div>
                      <div className="p-4 rounded-xl border border-dashed border-border bg-muted/20 text-center">
                        <p className="text-xs text-muted-foreground">Dados insuficientes para gerar gráficos (mín. 2 evoluções).</p>
                      </div>
                    </div>
                  )}

                  {/* Sinais Rápidos */}
                  {dados.sinaisRapidos && (
                    <div className="mt-6">
                      <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-3">Sinais Rápidos</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-3 rounded-xl bg-muted/40 border border-border/50">
                          <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-1 flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> Última Consulta
                          </p>
                          <p className="text-sm font-medium text-foreground">{dados.sinaisRapidos.ultimaConsultaData || 'Nenhuma'}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-muted/40 border border-border/50">
                          <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-1 flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> Próxima Consulta
                          </p>
                          <p className="text-sm font-medium text-foreground">{dados.sinaisRapidos.proximaConsultaData || 'Não agendada'}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-muted/40 border border-border/50">
                          <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-1 flex items-center gap-1">
                            <FileText className="h-3 w-3" /> Exames Recentes
                          </p>
                          {dados.sinaisRapidos.examesRecentes.length > 0 ? (
                            <ul className="text-[11px] font-medium space-y-1 text-foreground">
                              {dados.sinaisRapidos.examesRecentes.map((ex, i) => (
                                <li key={i} className="truncate" title={ex.nomeExame}>{ex.nomeExame}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm font-medium text-foreground">Nenhum</p>
                          )}
                        </div>
                        <div className="p-3 rounded-xl bg-muted/40 border border-border/50 relative overflow-hidden flex flex-col">
                          <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-1 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> Docs Vencendo
                          </p>
                          <p className="text-sm font-medium text-foreground">{dados.sinaisRapidos.documentosVencendo > 0 ? `${dados.sinaisRapidos.documentosVencendo} docs` : 'Nenhum'}</p>
                          {dados.sinaisRapidos.documentosVencendo > 0 && (
                            <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Patologia Principal */}
                  <div className="mt-6">
                    <div className="p-3.5 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-900 dark:text-orange-200">
                      <p className="text-[10px] uppercase font-bold mb-1.5 flex items-center gap-1.5 opacity-70 tracking-wider">
                        <Stethoscope className="h-3 w-3" /> Patologia Principal
                      </p>
                      <p className="text-sm font-medium leading-relaxed">{paciente.patologia || 'Nenhuma patologia informada.'}</p>
                    </div>
                  </div>

                  <Button className="w-full mt-6" variant="outline" onClick={() => window.open(`/medico/pacientes/${paciente.id}`, '_blank')}>
                    Ver Prontuário Completo
                  </Button>
                </div>
              )}

              {/* ABA PRONTUÁRIO */}
              {aba === 'prontuario' && (
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">Última Evolução</h4>
                  {ultimaEvolucao ? (
                    <div className="p-4 rounded-xl border bg-card shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 capitalize">
                          {ultimaEvolucao.tipo}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-medium">{ultimaEvolucao.createdAt}</span>
                      </div>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90 font-medium line-clamp-6">
                        {ultimaEvolucao.texto}
                      </p>
                    </div>
                  ) : (
                    <div className="py-8 text-center bg-muted/30 rounded-xl border border-dashed">
                      <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Nenhuma evolução registrada.</p>
                    </div>
                  )}
                  
                  <Button className="w-full mt-2" variant="outline" onClick={() => setProntuarioVivoAberto(true)}>
                    Ver Histórico Completo
                  </Button>
                </div>
              )}

              {/* ABA PRESCRIÇÃO */}
              {aba === 'prescricao' && (
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">Última Prescrição</h4>
                  
                  {ultimaPrescricao ? (
                    <div className="p-4 rounded-xl border bg-card shadow-sm space-y-4">
                      <div className="flex items-center justify-between border-b pb-3">
                        <div>
                          <p className="text-xs text-muted-foreground font-medium">Emitida em</p>
                          <p className="text-sm font-semibold">{ultimaPrescricao.createdAt}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground font-medium">Validade</p>
                          <p className="text-sm font-semibold text-primary">{ultimaPrescricao.validade}</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {ultimaPrescricao.medicamentos.map((med, i) => (
                          <div key={i} className="bg-muted/40 p-2.5 rounded-lg border border-border/50">
                            <p className="text-sm font-semibold">{med.nome}</p>
                            {(med.dose || med.posologia) && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {med.dose && <span className="mr-2">Dose: {med.dose}</span>}
                                {med.posologia && <span>Posologia: {med.posologia}</span>}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center bg-muted/30 rounded-xl border border-dashed">
                      <Pill className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Nenhuma prescrição encontrada.</p>
                    </div>
                  )}

                  <div className="pt-4 border-t border-border mt-4 flex flex-col gap-2">
                    <Button className="w-full bg-primary hover:bg-primary/90 text-white gap-2" 
                      onClick={() => { setDadosWizard(null); setWizardAberto(true); }}>
                      <Pill className="h-4 w-4" /> Nova Prescrição
                    </Button>
                    
                    {ultimaPrescricao && (
                      <Button className="w-full gap-2" variant="outline" onClick={handleRenovarClick} disabled={loadingRenovar}>
                        <FileText className="h-4 w-4" /> 
                        {loadingRenovar ? 'Carregando...' : 'Renovar Última'}
                      </Button>
                    )}
                    
                    <p className="text-[10px] text-muted-foreground text-center mt-2 leading-relaxed">
                      A nova prescrição será associada automaticamente a esta teleconsulta.
                    </p>
                  </div>
                </div>
              )}
            </div>
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
