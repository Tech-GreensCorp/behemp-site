'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Save, QrCode, Barcode, CreditCard } from 'lucide-react';
import {
  salvarConfigPagamentoMedico,
  type ConfigPagamentoMedico,
} from '@/app/(admin)/_actions/pagamentos-medicos';

interface FormConfigPagamentoMedicoProps {
  configInicial: ConfigPagamentoMedico;
}

type PixTipoChave = 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria' | '';
type ContaTipo = 'corrente' | 'poupanca' | '';

export function FormConfigPagamentoMedico({ configInicial }: FormConfigPagamentoMedicoProps) {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);

  const [pixHabilitado, setPixHabilitado] = useState(configInicial.pixHabilitado);
  const [pixTipoChave, setPixTipoChave] = useState<PixTipoChave>(
    (configInicial.pixTipoChave as PixTipoChave) ?? '',
  );
  const [pixChave, setPixChave] = useState(configInicial.pixChave ?? '');

  const [boletoHabilitado, setBoletoHabilitado] = useState(configInicial.boletoHabilitado);
  const [bancoNome, setBancoNome] = useState(configInicial.bancoNome ?? '');
  const [bancoAgencia, setBancoAgencia] = useState(configInicial.bancoAgencia ?? '');
  const [bancoConta, setBancoConta] = useState(configInicial.bancoConta ?? '');
  const [bancoContaTipo, setBancoContaTipo] = useState<ContaTipo>(
    (configInicial.bancoContaTipo as ContaTipo) ?? '',
  );
  const [bancoTitularNome, setBancoTitularNome] = useState(configInicial.bancoTitularNome ?? '');
  const [bancoTitularDocumento, setBancoTitularDocumento] = useState(
    configInicial.bancoTitularDocumento ?? '',
  );

  const [cartaoCreditoHabilitado, setCartaoCreditoHabilitado] = useState(
    configInicial.cartaoCreditoHabilitado,
  );
  const [cartaoDebitoHabilitado, setCartaoDebitoHabilitado] = useState(
    configInicial.cartaoDebitoHabilitado,
  );
  const [observacoes, setObservacoes] = useState(configInicial.observacoes ?? '');

  async function handleSalvar() {
    setSalvando(true);
    const res = await salvarConfigPagamentoMedico({
      medicoId: configInicial.medicoId,
      pixHabilitado,
      pixTipoChave: pixTipoChave || null,
      pixChave: pixChave.trim() || null,
      boletoHabilitado,
      cartaoCreditoHabilitado,
      cartaoDebitoHabilitado,
      bancoNome: bancoNome.trim() || null,
      bancoAgencia: bancoAgencia.trim() || null,
      bancoConta: bancoConta.trim() || null,
      bancoContaTipo: bancoContaTipo || null,
      bancoTitularNome: bancoTitularNome.trim() || null,
      bancoTitularDocumento: bancoTitularDocumento.trim() || null,
      observacoes: observacoes.trim() || null,
    });
    setSalvando(false);

    if (res.sucesso) {
      toast.success('Configuração salva');
      router.refresh();
    } else {
      toast.error(res.erro || 'Erro ao salvar configuração');
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <QrCode size={16} />
            PIX
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Chave PIX que o paciente verá na tela de pagamento.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch checked={pixHabilitado} onCheckedChange={setPixHabilitado} id="pix-habilitado" />
            <Label htmlFor="pix-habilitado">Habilitar PIX para este médico</Label>
          </div>

          {pixHabilitado && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Tipo de chave</Label>
                <Select value={pixTipoChave} onValueChange={(v) => setPixTipoChave(v as PixTipoChave)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cpf">CPF</SelectItem>
                    <SelectItem value="cnpj">CNPJ</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="telefone">Telefone</SelectItem>
                    <SelectItem value="aleatoria">Chave aleatória</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pix-chave">Chave PIX</Label>
                <Input
                  id="pix-chave"
                  value={pixChave}
                  onChange={(e) => setPixChave(e.target.value)}
                  placeholder="Chave PIX do médico"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Barcode size={16} />
            Boleto / dados bancários
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Conta que recebe o valor da consulta — usada para gerar o boleto/transferência.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch
              checked={boletoHabilitado}
              onCheckedChange={setBoletoHabilitado}
              id="boleto-habilitado"
            />
            <Label htmlFor="boleto-habilitado">Habilitar boleto para este médico</Label>
          </div>

          {boletoHabilitado && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="banco-nome">Banco</Label>
                <Input id="banco-nome" value={bancoNome} onChange={(e) => setBancoNome(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de conta</Label>
                <Select value={bancoContaTipo} onValueChange={(v) => setBancoContaTipo(v as ContaTipo)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corrente">Conta corrente</SelectItem>
                    <SelectItem value="poupanca">Conta poupança</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="banco-agencia">Agência</Label>
                <Input
                  id="banco-agencia"
                  value={bancoAgencia}
                  onChange={(e) => setBancoAgencia(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="banco-conta">Conta</Label>
                <Input id="banco-conta" value={bancoConta} onChange={(e) => setBancoConta(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="banco-titular-nome">Nome do titular</Label>
                <Input
                  id="banco-titular-nome"
                  value={bancoTitularNome}
                  onChange={(e) => setBancoTitularNome(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="banco-titular-documento">CPF/CNPJ do titular</Label>
                <Input
                  id="banco-titular-documento"
                  value={bancoTitularDocumento}
                  onChange={(e) => setBancoTitularDocumento(e.target.value)}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard size={16} />
            Cartão
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Sem integração de gateway ainda — só habilita/desabilita a opção na tela do paciente.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch
              checked={cartaoCreditoHabilitado}
              onCheckedChange={setCartaoCreditoHabilitado}
              id="credito-habilitado"
            />
            <Label htmlFor="credito-habilitado">Habilitar cartão de crédito</Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={cartaoDebitoHabilitado}
              onCheckedChange={setCartaoDebitoHabilitado}
              id="debito-habilitado"
            />
            <Label htmlFor="debito-habilitado">Habilitar cartão de débito</Label>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Observações</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Observações internas (não visíveis ao paciente)"
            rows={3}
          />
        </CardContent>
      </Card>

      <Button onClick={handleSalvar} disabled={salvando} className="gap-2">
        {salvando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        Salvar configuração
      </Button>
    </div>
  );
}
