'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { atualizarConfigAgenda } from '@/app/_actions/admin-medicos';
import { toast } from 'sonner';

export type ConfigAgendaDia = {
  diaSemana: number; // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
  ativo: boolean;
  horarios: string[]; // Ex: ["08:00", "09:00"]
};

const DIAS_SEMANA = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

const CONFIG_PADRAO: ConfigAgendaDia[] = DIAS_SEMANA.map((_, i) => ({
  diaSemana: i,
  ativo: false,
  horarios: [],
}));

interface FormConfigAgendaProps {
  medicoId: string;
  configAtual?: ConfigAgendaDia[] | null;
}

export function FormConfigAgenda({ medicoId, configAtual }: FormConfigAgendaProps) {
  const [config, setConfig] = useState<ConfigAgendaDia[]>(
    configAtual && Array.isArray(configAtual) && configAtual.length === 7
      ? configAtual
      : CONFIG_PADRAO
  );
  const [salvando, setSalvando] = useState(false);
  const [novoHorarioInputs, setNovoHorarioInputs] = useState<Record<number, string>>({});

  const handleToggleDia = (diaSemana: number, ativo: boolean) => {
    setConfig((prev) =>
      prev.map((c) => (c.diaSemana === diaSemana ? { ...c, ativo } : c))
    );
  };

  const handleRemoverHorario = (diaSemana: number, horario: string) => {
    setConfig((prev) =>
      prev.map((c) =>
        c.diaSemana === diaSemana
          ? { ...c, horarios: c.horarios.filter((h) => h !== horario) }
          : c
      )
    );
  };

  const handleAdicionarHorario = (diaSemana: number) => {
    const horarioStr = novoHorarioInputs[diaSemana];
    if (!horarioStr) return;

    // Regex simples para HH:mm
    if (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(horarioStr)) {
      toast.error('Formato de horário inválido (Use HH:mm)');
      return;
    }

    setConfig((prev) =>
      prev.map((c) => {
        if (c.diaSemana === diaSemana) {
          if (c.horarios.includes(horarioStr)) {
            toast.error('Horário já adicionado');
            return c;
          }
          const novosHorarios = [...c.horarios, horarioStr].sort();
          return { ...c, horarios: novosHorarios };
        }
        return c;
      })
    );

    setNovoHorarioInputs((prev) => ({ ...prev, [diaSemana]: '' }));
  };

  const handleSalvar = async () => {
    setSalvando(true);
    const res = await atualizarConfigAgenda(medicoId, config);
    if (res.sucesso) {
      toast.success('Configuração salva com sucesso!');
    } else {
      toast.error(res.erro || 'Erro ao salvar configuração');
    }
    setSalvando(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Horários de Atendimento</h2>
          <p className="text-sm text-muted-foreground">
            Configure os dias e horários em que você atende. Dias desmarcados ou sem horários aparecerão como indisponíveis para agendamento.
          </p>
        </div>
        <Button onClick={handleSalvar} disabled={salvando} className="gap-2">
          {salvando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Salvar
        </Button>
      </div>

      <div className="grid gap-4">
        {config.map((dia) => (
          <Card key={dia.diaSemana} className="border-0 shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center">
                {/* Header do Dia */}
                <div className="flex items-center justify-between sm:w-64 border-b sm:border-b-0 sm:border-r p-4 bg-muted/20">
                  <span className="font-medium">{DIAS_SEMANA[dia.diaSemana]}</span>
                  <Switch
                    checked={dia.ativo}
                    onCheckedChange={(checked) => handleToggleDia(dia.diaSemana, checked)}
                  />
                </div>

                {/* Horários */}
                <div className="flex-1 p-4">
                  {!dia.ativo ? (
                    <p className="text-sm text-muted-foreground">Dia indisponível para atendimento.</p>
                  ) : (
                    <div className="space-y-4">
                      {dia.horarios.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhum horário configurado.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {dia.horarios.map((h) => (
                            <div
                              key={h}
                              className="flex items-center gap-1 rounded-md border bg-background px-3 py-1.5 text-sm font-medium tabular-nums"
                            >
                              {h}
                              <button
                                onClick={() => handleRemoverHorario(dia.diaSemana, h)}
                                className="ml-1 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-2 max-w-[200px]">
                        <Input
                          type="time"
                          value={novoHorarioInputs[dia.diaSemana] || ''}
                          onChange={(e) =>
                            setNovoHorarioInputs({ ...novoHorarioInputs, [dia.diaSemana]: e.target.value })
                          }
                          className="h-8 text-sm"
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => handleAdicionarHorario(dia.diaSemana)}
                        >
                          <Plus size={16} />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
