'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Save, Settings } from 'lucide-react';
import { salvarConfigPagamentos } from '@/app/(admin)/_actions/pagamentos';

interface PagamentosConfigFormProps {
  configInicial: {
    valorConsultaPadrao: string;
    moedaPadrao: string;
  };
}

export function PagamentosConfigForm({ configInicial }: PagamentosConfigFormProps) {
  const [valorConsultaPadrao, setValorConsultaPadrao] = useState(configInicial.valorConsultaPadrao);
  const [salvando, setSalvando] = useState(false);

  async function handleSalvar() {
    setSalvando(true);
    const res = await salvarConfigPagamentos({
      valorConsultaPadrao: Number(valorConsultaPadrao),
      moedaPadrao: configInicial.moedaPadrao,
    });
    setSalvando(false);
    if (res.sucesso) {
      toast.success('Configuração salva');
    } else {
      toast.error(res.erro || 'Erro ao salvar configuração');
    }
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings size={16} />
          Configuração de pagamento
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Valor padrão usado quando o médico não tem valor próprio de consulta definido. O
          pagamento vai direto para a conta do médico — a Be4Hope não retém comissão, então não
          há divisão a configurar aqui. Consultas já criadas mantêm o valor calculado na hora do
          agendamento.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="valor-consulta-padrao">Valor padrão da consulta ({configInicial.moedaPadrao})</Label>
            <Input
              id="valor-consulta-padrao"
              type="number"
              min="0"
              step="0.01"
              value={valorConsultaPadrao}
              onChange={(e) => setValorConsultaPadrao(e.target.value)}
            />
          </div>
        </div>

        <Button onClick={handleSalvar} disabled={salvando} className="gap-2">
          {salvando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Salvar configuração
        </Button>
      </CardContent>
    </Card>
  );
}
