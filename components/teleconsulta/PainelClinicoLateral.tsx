'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, User, FileText, Pill, Calendar, Phone, Stethoscope, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { DadosPainelTeleconsulta } from '@/app/(medico)/_actions/teleconsulta-painel';

interface PainelClinicoLateralProps {
  dados: DadosPainelTeleconsulta;
  abaInicial: 'paciente' | 'prontuario' | 'prescricao';
  visivel: boolean;
  onFechar: () => void;
}

export function PainelClinicoLateral({ dados, abaInicial, visivel, onFechar }: PainelClinicoLateralProps) {
  const [aba, setAba] = useState<'paciente' | 'prontuario' | 'prescricao'>(abaInicial);

  useEffect(() => {
    if (visivel) setAba(abaInicial);
  }, [visivel, abaInicial]);

  const { paciente, ultimaEvolucao, ultimaPrescricao, totalConsultas } = dados;

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
            className="fixed top-4 bottom-4 right-4 w-[380px] z-40
                       flex flex-col bg-background rounded-2xl border border-border shadow-2xl overflow-hidden"
          >
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
                <div className="space-y-5">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                      {paciente.nome.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground leading-tight">{paciente.nome}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{totalConsultas} consulta{totalConsultas !== 1 ? 's' : ''} no total</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-muted/40 border border-border/50">
                      <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-1 flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Nascimento
                      </p>
                      <p className="text-sm font-medium">{paciente.dataNascimento || 'Não informado'}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/40 border border-border/50">
                      <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-1 flex items-center gap-1">
                        <Phone className="h-3 w-3" /> Telefone
                      </p>
                      <p className="text-sm font-medium">{paciente.telefone || 'Não informado'}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-900 dark:text-orange-200">
                      <p className="text-[10px] uppercase font-bold mb-1 flex items-center gap-1 opacity-70">
                        <Stethoscope className="h-3 w-3" /> Patologia Principal
                      </p>
                      <p className="text-sm font-medium">{paciente.patologia || 'Nenhuma informada.'}</p>
                    </div>

                    <div className={`p-3 rounded-xl border ${paciente.alergias ? 'bg-red-500/10 border-red-500/20 text-red-900 dark:text-red-200' : 'bg-muted/40 border-border/50 text-foreground'}`}>
                      <p className="text-[10px] uppercase font-bold mb-1 flex items-center gap-1 opacity-70">
                        <AlertTriangle className="h-3 w-3" /> Alergias
                      </p>
                      <p className="text-sm font-medium">{paciente.alergias || 'Nenhuma alergia relatada.'}</p>
                    </div>
                  </div>

                  <Button className="w-full mt-4" variant="outline" onClick={() => window.open(`/medico/pacientes/${paciente.id}`, '_blank')}>
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
                  
                  <Button className="w-full mt-2" variant="outline" onClick={() => window.open(`/medico/pacientes/${paciente.id}`, '_blank')}>
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

                  <div className="pt-4 border-t border-border mt-4">
                    <Button className="w-full bg-primary hover:bg-primary/90 text-white gap-2" 
                      onClick={() => window.open(`/medico/pacientes/${paciente.id}?tab=prescricao`, '_blank')}>
                      <Pill className="h-4 w-4" /> Nova Prescrição
                    </Button>
                    <p className="text-[10px] text-muted-foreground text-center mt-2 leading-relaxed">
                      A nova prescrição será associada automaticamente a esta teleconsulta.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
