'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';

import { solicitarRecompraManual } from '@/app/_actions/recompras';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

/**
 * Solicita a recompra EM NOME DE UM DEPENDENTE. O `pacienteId` vai junto, mas **não é ele que decide**: a action
 * o prova pelo vínculo ativo (`garantirResponsavelDoPaciente`) e responde "Paciente não encontrado" se não for
 * deste responsável. O contato já vem do responsável (o dependente não tem e-mail nem telefone).
 */
export function FormularioDeRecompra({
  pacienteId,
  nomeDoDependente,
  contatoEmail,
}: {
  pacienteId: string;
  nomeDoDependente: string;
  contatoEmail: string;
}) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [medicamentoNome, setMedicamentoNome] = useState('');
  const [mlFrasco, setMlFrasco] = useState('');
  const [gotasPorDia, setGotasPorDia] = useState('');
  const [dataInicioUso, setDataInicioUso] = useState('');
  const [contatoTelefone, setContatoTelefone] = useState('');
  const [observacoes, setObservacoes] = useState('');

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    const res = await solicitarRecompraManual({
      pacienteId,
      medicamentoNome,
      mlFrasco: Number(mlFrasco),
      gotasPorDia: Number(gotasPorDia),
      dataInicioUso,
      contatoTelefone: contatoTelefone || undefined,
      contatoEmail,
      observacoes: observacoes || undefined,
    });
    setEnviando(false);

    if (!res.sucesso) {
      toast.error(res.erro ?? 'Não foi possível solicitar a recompra.');
      return;
    }
    toast.success(`Recompra solicitada para ${nomeDoDependente}.`);
    setMedicamentoNome('');
    setMlFrasco('');
    setGotasPorDia('');
    setDataInicioUso('');
    setObservacoes('');
    router.refresh();
  }

  return (
    <Card className="border-border/50 rounded-[1.75rem] shadow-sm">
      <CardContent className="p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-2xl">
            <ShoppingCart className="text-primary h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-foreground text-lg font-bold">
              Solicitar recompra para {nomeDoDependente}
            </h2>
            <p className="text-muted-foreground text-xs">
              O pedido fica registrado em nome de {nomeDoDependente}. Os avisos chegam a você.
            </p>
          </div>
        </div>

        <form onSubmit={enviar} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="r-med">Medicamento</Label>
            <Input
              id="r-med"
              required
              value={medicamentoNome}
              onChange={(e) => setMedicamentoNome(e.target.value)}
              className="h-10 rounded-xl"
            />
          </div>
          <div>
            <Label htmlFor="r-ml">Frasco (ml)</Label>
            <Input
              id="r-ml"
              type="number"
              min={1}
              required
              value={mlFrasco}
              onChange={(e) => setMlFrasco(e.target.value)}
              className="h-10 rounded-xl"
            />
          </div>
          <div>
            <Label htmlFor="r-gotas">Gotas por dia</Label>
            <Input
              id="r-gotas"
              type="number"
              min={1}
              required
              value={gotasPorDia}
              onChange={(e) => setGotasPorDia(e.target.value)}
              className="h-10 rounded-xl"
            />
          </div>
          <div>
            <Label htmlFor="r-inicio">Início do uso</Label>
            <Input
              id="r-inicio"
              type="date"
              required
              value={dataInicioUso}
              onChange={(e) => setDataInicioUso(e.target.value)}
              className="h-10 rounded-xl"
            />
          </div>
          <div>
            <Label htmlFor="r-tel">Seu telefone para contato</Label>
            <Input
              id="r-tel"
              placeholder="(11) 99999-1234"
              value={contatoTelefone}
              onChange={(e) => setContatoTelefone(e.target.value)}
              className="h-10 rounded-xl"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="r-obs">Observações</Label>
            <Textarea
              id="r-obs"
              rows={2}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Button
              type="submit"
              disabled={enviando}
              className="h-10 rounded-full px-6 text-xs font-semibold"
            >
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Solicitar recompra'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
