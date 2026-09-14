'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
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

export interface CamposDadosPagamentoMedico {
  pixTipoChave: 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria' | null;
  pixChave: string | null;
  bancoNome: string | null;
  bancoAgencia: string | null;
  bancoConta: string | null;
  bancoContaTipo: 'corrente' | 'poupanca' | null;
  bancoTitularNome: string | null;
  bancoTitularDocumento: string | null;
  observacoes: string | null;
}

export interface CamposConfigPagamentoMedico extends CamposDadosPagamentoMedico {
  pixHabilitado: boolean;
  boletoHabilitado: boolean;
  cartaoCreditoHabilitado: boolean;
  cartaoDebitoHabilitado: boolean;
}

type FormConfigPagamentoMedicoProps =
  | {
      /** Admin: controla tudo — dado E o que fica ativo na tela do paciente. */
      perfil: 'admin';
      configInicial: CamposConfigPagamentoMedico;
      aoSalvar: (
        dados: CamposConfigPagamentoMedico,
      ) => Promise<{ sucesso: boolean; erro?: string }>;
    }
  | {
      /**
       * Médico: só alimenta o DADO (chave PIX, conta bancária). O que fica ativo na
       * tela do paciente é decisão exclusiva do admin — por isso os campos de
       * habilitação aqui são só leitura (vêm de `configInicial`, nunca voltam no save).
       */
      perfil: 'medico';
      configInicial: CamposConfigPagamentoMedico;
      aoSalvar: (dados: CamposDadosPagamentoMedico) => Promise<{ sucesso: boolean; erro?: string }>;
    };

type PixTipoChave = 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria' | '';
type ContaTipo = 'corrente' | 'poupanca' | '';

function BadgeAtivo({ ativo }: { ativo: boolean }) {
  return ativo ? (
    <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
      Ativo
    </Badge>
  ) : (
    <Badge variant="secondary" className="bg-gray-100 text-gray-600 hover:bg-gray-100">
      Inativo
    </Badge>
  );
}

export function FormConfigPagamentoMedico(props: FormConfigPagamentoMedicoProps) {
  const { configInicial } = props;
  const somenteDados = props.perfil === 'medico';

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

    const dadosComuns: CamposDadosPagamentoMedico = {
      pixTipoChave: pixTipoChave || null,
      pixChave: pixChave.trim() || null,
      bancoNome: bancoNome.trim() || null,
      bancoAgencia: bancoAgencia.trim() || null,
      bancoConta: bancoConta.trim() || null,
      bancoContaTipo: bancoContaTipo || null,
      bancoTitularNome: bancoTitularNome.trim() || null,
      bancoTitularDocumento: bancoTitularDocumento.trim() || null,
      observacoes: observacoes.trim() || null,
    };

    const res =
      props.perfil === 'admin'
        ? await props.aoSalvar({
            ...dadosComuns,
            pixHabilitado,
            boletoHabilitado,
            cartaoCreditoHabilitado,
            cartaoDebitoHabilitado,
          })
        : await props.aoSalvar(dadosComuns);

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
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <QrCode size={16} />
              PIX
            </CardTitle>
            {somenteDados && <BadgeAtivo ativo={pixHabilitado} />}
          </div>
          <p className="text-muted-foreground text-sm">
            {somenteDados
              ? 'Chave que o paciente verá quando o admin ativar o PIX para você.'
              : 'Chave PIX que o paciente verá na tela de pagamento.'}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {!somenteDados && (
            <div className="flex items-center gap-3">
              <Switch
                checked={pixHabilitado}
                onCheckedChange={setPixHabilitado}
                id="pix-habilitado"
              />
              <Label htmlFor="pix-habilitado">Habilitar PIX</Label>
            </div>
          )}

          {(somenteDados || pixHabilitado) && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Tipo de chave</Label>
                <Select
                  value={pixTipoChave}
                  onValueChange={(v) => setPixTipoChave(v as PixTipoChave)}
                >
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
                  placeholder="Sua chave PIX"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Barcode size={16} />
              Boleto / dados bancários
            </CardTitle>
            {somenteDados && <BadgeAtivo ativo={boletoHabilitado} />}
          </div>
          <p className="text-muted-foreground text-sm">
            Conta que recebe o valor da consulta — usada para gerar o boleto/transferência.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {!somenteDados && (
            <div className="flex items-center gap-3">
              <Switch
                checked={boletoHabilitado}
                onCheckedChange={setBoletoHabilitado}
                id="boleto-habilitado"
              />
              <Label htmlFor="boleto-habilitado">Habilitar boleto</Label>
            </div>
          )}

          {(somenteDados || boletoHabilitado) && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="banco-nome">Banco</Label>
                <Input
                  id="banco-nome"
                  value={bancoNome}
                  onChange={(e) => setBancoNome(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de conta</Label>
                <Select
                  value={bancoContaTipo}
                  onValueChange={(v) => setBancoContaTipo(v as ContaTipo)}
                >
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
                <Input
                  id="banco-conta"
                  value={bancoConta}
                  onChange={(e) => setBancoConta(e.target.value)}
                />
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
          <p className="text-muted-foreground text-sm">
            {somenteDados
              ? 'Sem dado para cadastrar aqui — o admin decide se fica disponível para o paciente.'
              : 'Sem integração de gateway ainda — só habilita/desabilita a opção na tela do paciente.'}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {somenteDados ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
                <span className="text-sm">Cartão de crédito</span>
                <BadgeAtivo ativo={cartaoCreditoHabilitado} />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
                <span className="text-sm">Cartão de débito</span>
                <BadgeAtivo ativo={cartaoDebitoHabilitado} />
              </div>
            </div>
          ) : (
            <>
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
            </>
          )}
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
            placeholder="Observações internas"
            rows={3}
          />
        </CardContent>
      </Card>

      <Button onClick={handleSalvar} disabled={salvando} className="gap-2">
        {salvando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        Salvar {somenteDados ? 'dados' : 'configuração'}
      </Button>
    </div>
  );
}
