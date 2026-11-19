'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Save, FileText, Search, Loader2, Link2, X } from 'lucide-react';
import { formatarCpf } from '@/lib/validacao/cpf';
import { BotaoExcluirPlano } from './botao-excluir-plano';
import {
  criarPlanoTratamento,
  atualizarPlanoTratamento,
  buscarPacientesParaPlano,
} from '@/app/(admin)/_actions/planos-tratamento';
import type {
  PlanoTratamentoFormData,
  PlanoTratamentoCompleto,
} from '@/app/(admin)/_actions/planos-tratamento';
import { generatePlanoNumber, ADESAO_DEFAULTS } from '@/lib/planos-tratamento/plano-defaults';
import {
  calcularAdesao,
  paraReais,
  formatarValor,
  formatarPercentual,
  textosDaAdesao,
} from '@/lib/planos-tratamento/calculo';

const ROTA_LISTA = '/admin/planos-tratamento';

type PacienteEncontrado = NonNullable<
  Awaited<ReturnType<typeof buscarPacientesParaPlano>>['dados']
>[number];

/** Linha label + campo. Fora do componente do form (React 19: nada de componente no render). */
function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 sm:grid-cols-[220px_1fr] sm:items-center">
      <Label className="text-muted-foreground text-sm">{label}</Label>
      {children}
    </div>
  );
}

/** Linha do resumo calculado. */
function LinhaResumo({
  rotulo,
  detalhe,
  valor,
  destaque,
}: {
  rotulo: string;
  detalhe?: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 py-2 ${
        destaque ? 'border-t pt-3 text-base font-semibold' : 'text-sm'
      }`}
    >
      <div>
        <span className={destaque ? '' : 'font-medium'}>{rotulo}</span>
        {detalhe && <span className="text-muted-foreground ml-2 text-xs">{detalhe}</span>}
      </div>
      <span className="tabular-nums">{valor}</span>
    </div>
  );
}

/** Número digitado → número para a prévia (vazio ou inválido conta como 0). */
const num = (s: string) => (Number.isFinite(Number(s)) ? Number(s) : 0);

interface PlanoTratamentoFormProps {
  plano?: PlanoTratamentoCompleto;
  /**
   * Data de hoje em America/Sao_Paulo, calculada no SERVIDOR (`novo/page.tsx`). Calcular aqui
   * com `toISOString()` dava a data UTC — depois das 21h o formulário já sugeria amanhã.
   */
  dataPadrao?: string;
  /** Mostra o botão Excluir (só na edição). Decidido no servidor com `verificarAdmin()`. */
  podeExcluir?: boolean;
}

/** Paciente cadastrado vinculado ao plano — fica visível e removível no formulário. */
interface Vinculo {
  id: string;
  nome: string;
  cpf: string | null;
}

/**
 * Formulário da Adesão ao Tratamento (Programa de Acesso Collab).
 * A prévia usa a MESMA função de cálculo que a action e o documento (`calcularAdesao`), mas é só
 * prévia: o servidor recalcula e é o valor dele que fica gravado.
 */
export function PlanoTratamentoForm({
  plano,
  dataPadrao,
  podeExcluir = false,
}: PlanoTratamentoFormProps) {
  const router = useRouter();
  const isEdit = !!plano;
  const [saving, setSaving] = useState(false);
  const [buscaPaciente, setBuscaPaciente] = useState('');
  const [pacientesEncontrados, setPacientesEncontrados] = useState<PacienteEncontrado[]>([]);
  const [buscando, setBuscando] = useState(false);

  // ── Estado do formulário ──────────────────────────────
  const [numero, setNumero] = useState(plano?.planoNumber ?? '');
  const [status, setStatus] = useState(plano?.status ?? 'draft');
  // O vínculo é mostrado como um selo com "Remover": digitar outro nome à mão NÃO desfaz o
  // vínculo sozinho, então ele não pode ser invisível.
  const [vinculo, setVinculo] = useState<Vinculo | null>(
    plano?.pacienteId ? { id: plano.pacienteId, nome: plano.patientName, cpf: plano.cpf } : null,
  );

  const [pacNome, setPacNome] = useState(plano?.patientName ?? '');
  const [pacCpf, setPacCpf] = useState(plano ? formatarCpf(plano.cpf) : '');
  const [dataAdesao, setDataAdesao] = useState(plano?.dataAdesao ?? dataPadrao ?? '');
  const [periodo, setPeriodo] = useState(
    plano ? String(plano.periodoMeses) : ADESAO_DEFAULTS.periodoMeses,
  );
  const [medicamento, setMedicamento] = useState(plano?.medicamento ?? ADESAO_DEFAULTS.medicamento);

  const [qtdFrascos, setQtdFrascos] = useState(
    plano ? String(plano.qtdFrascos) : ADESAO_DEFAULTS.qtdFrascos,
  );
  const [valorFrasco, setValorFrasco] = useState(plano?.valorFrasco ?? ADESAO_DEFAULTS.valorFrasco);
  const [desconto, setDesconto] = useState(
    plano ? String(Number(plano.descontoPct)) : ADESAO_DEFAULTS.descontoPct,
  );
  const [qtdConsultas, setQtdConsultas] = useState(
    plano ? String(plano.qtdConsultas) : ADESAO_DEFAULTS.qtdConsultas,
  );
  const [valorConsulta, setValorConsulta] = useState(
    plano?.valorConsulta ?? ADESAO_DEFAULTS.valorConsulta,
  );
  const [qtdFretes, setQtdFretes] = useState(
    plano ? String(plano.qtdFretes) : ADESAO_DEFAULTS.qtdFretes,
  );
  const [valorFrete, setValorFrete] = useState(plano?.valorFrete ?? ADESAO_DEFAULTS.valorFrete);
  const [parcelas, setParcelas] = useState(
    plano ? String(plano.parcelas) : ADESAO_DEFAULTS.parcelas,
  );
  const [formaPagamento, setFormaPagamento] = useState(
    plano?.formaPagamento ?? ADESAO_DEFAULTS.formaPagamento,
  );

  // ── Prévia ao vivo ────────────────────────────────────
  const entrada = {
    qtdFrascos: num(qtdFrascos),
    valorFrasco: num(valorFrasco),
    descontoPct: num(desconto),
    qtdConsultas: num(qtdConsultas),
    valorConsulta: num(valorConsulta),
    qtdFretes: num(qtdFretes),
    valorFrete: num(valorFrete),
    parcelas: num(parcelas),
  };
  const calc = calcularAdesao(entrada);
  const textos = textosDaAdesao({
    ...entrada,
    periodoMeses: num(periodo),
    medicamento,
  });
  const brl = (centavos: number) => `R$ ${formatarValor(paraReais(centavos))}`;

  // ── Busca de pacientes ────────────────────────────────
  // Cada busca leva um número; só a MAIS RECENTE pode escrever a lista. Sem isso, a resposta
  // de "Ma" chegando depois da de "Maria S" mostraria a lista larga para o termo estreito.
  const ultimaBusca = useRef(0);

  const buscarPacientes = useCallback(async (termo: string) => {
    const minhaBusca = ++ultimaBusca.current;
    if (termo.length < 2) {
      setPacientesEncontrados([]);
      setBuscando(false);
      return;
    }
    setBuscando(true);
    try {
      const resultado = await buscarPacientesParaPlano(termo);
      if (minhaBusca !== ultimaBusca.current) return;
      if (resultado.sucesso && resultado.dados) setPacientesEncontrados(resultado.dados);
    } catch {
      // Rede caiu: a busca é auxiliar — o admin ainda pode digitar os dados à mão.
    } finally {
      if (minhaBusca === ultimaBusca.current) setBuscando(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => buscarPacientes(buscaPaciente), 300);
    return () => clearTimeout(timer);
  }, [buscaPaciente, buscarPacientes]);

  function selecionarPaciente(pac: PacienteEncontrado) {
    setVinculo({ id: pac.id, nome: pac.nome, cpf: pac.cpf });
    setPacNome(pac.nome);
    setPacCpf(formatarCpf(pac.cpf));
    setBuscaPaciente('');
    setPacientesEncontrados([]);
  }

  // ── Submit ────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const formData: PlanoTratamentoFormData = {
      planoNumber: numero,
      status: status as PlanoTratamentoFormData['status'],
      pacienteId: vinculo?.id,
      patientName: pacNome,
      cpf: pacCpf,
      dataAdesao,
      periodoMeses: periodo,
      medicamento,
      qtdFrascos,
      valorFrasco,
      descontoPct: desconto,
      qtdConsultas,
      valorConsulta,
      qtdFretes,
      valorFrete,
      parcelas,
      formaPagamento,
    };

    // Se a chamada rejeitar (rede caiu antes do try/catch da action), o botão não pode ficar
    // travado no spinner — o admin perderia o formulário inteiro ao recarregar.
    try {
      const resultado = isEdit
        ? await atualizarPlanoTratamento(plano.id, formData)
        : await criarPlanoTratamento(formData);

      if (resultado.sucesso) {
        // `saving` FICA true no sucesso: o botão segue travado até a lista carregar. Liberar
        // aqui deixava um segundo clique, durante o redirecionamento, criar um plano duplicado.
        toast.success(isEdit ? 'Plano de tratamento atualizado.' : 'Plano de tratamento criado.');
        router.push(ROTA_LISTA);
        router.refresh();
        return;
      }
      toast.error(resultado.erro ?? 'Não foi possível salvar o plano de tratamento.');
      setSaving(false);
    } catch {
      toast.error(
        'Não foi possível salvar o plano de tratamento. Verifique a conexão e tente de novo.',
      );
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Informações básicas */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Informações Básicas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FieldRow label="Número">
            <div className="flex gap-2">
              <Input
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="Gerado automaticamente se ficar vazio"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setNumero(generatePlanoNumber())}
              >
                Gerar
              </Button>
            </div>
          </FieldRow>
          <FieldRow label="Data da adesão *">
            <Input
              type="date"
              value={dataAdesao}
              onChange={(e) => setDataAdesao(e.target.value)}
              required
            />
          </FieldRow>
          <FieldRow label="Status *">
            <Select
              value={status}
              onValueChange={(val) => {
                if (val) setStatus(val);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Rascunho</SelectItem>
                <SelectItem value="completed">Completo</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
        </CardContent>
      </Card>

      {/* Paciente */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Paciente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/30 rounded-xl border p-4">
            <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
              Buscar paciente cadastrado
            </p>
            <div className="relative">
              <Search
                size={16}
                className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2"
              />
              <Input
                value={buscaPaciente}
                onChange={(e) => setBuscaPaciente(e.target.value)}
                placeholder="Digite nome ou CPF..."
                className="pl-9"
              />
              {buscando && (
                <Loader2
                  size={16}
                  className="text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2 animate-spin"
                />
              )}
            </div>
            {pacientesEncontrados.length > 0 && (
              <div className="bg-background mt-2 max-h-40 space-y-1 overflow-auto rounded-lg border p-1">
                {pacientesEncontrados.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => selecionarPaciente(p)}
                    className="hover:bg-accent w-full rounded-md px-3 py-2 text-left text-sm"
                  >
                    <span className="font-medium">{p.nome}</span>
                    {p.cpf && <span className="text-muted-foreground ml-2">· {p.cpf}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {vinculo && (
            <div className="bg-primary/5 border-primary/20 flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
              <span className="flex items-center gap-2">
                <Link2 size={14} className="text-primary shrink-0" />
                <span>
                  Vinculado ao cadastro de <span className="font-medium">{vinculo.nome}</span>
                  {vinculo.cpf && (
                    <span className="text-muted-foreground"> · {formatarCpf(vinculo.cpf)}</span>
                  )}
                </span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => setVinculo(null)}
              >
                <X size={12} /> Remover vínculo
              </Button>
            </div>
          )}

          <FieldRow label="Nome do paciente *">
            <Input value={pacNome} onChange={(e) => setPacNome(e.target.value)} required />
          </FieldRow>
          <FieldRow label="CPF *">
            <Input value={pacCpf} onChange={(e) => setPacCpf(e.target.value)} required />
          </FieldRow>
        </CardContent>
      </Card>

      {/* Tratamento */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Tratamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FieldRow label="Medicamento *">
            <Input value={medicamento} onChange={(e) => setMedicamento(e.target.value)} required />
          </FieldRow>
          <FieldRow label="Período (meses) *">
            <Input
              type="number"
              min={1}
              max={60}
              step={1}
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              required
            />
          </FieldRow>
        </CardContent>
      </Card>

      {/* Composição */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Composição da adesão</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FieldRow label="Frascos (quantidade) *">
            <Input
              type="number"
              min={1}
              step={1}
              value={qtdFrascos}
              onChange={(e) => setQtdFrascos(e.target.value)}
              required
            />
          </FieldRow>
          <FieldRow label="Valor por frasco (R$) *">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={valorFrasco}
              onChange={(e) => setValorFrasco(e.target.value)}
              required
            />
          </FieldRow>
          <FieldRow label="Subsídio Collab (%) *">
            <Input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={desconto}
              onChange={(e) => setDesconto(e.target.value)}
              required
            />
          </FieldRow>
          <FieldRow label="Consultas (quantidade) *">
            <Input
              type="number"
              min={0}
              step={1}
              value={qtdConsultas}
              onChange={(e) => setQtdConsultas(e.target.value)}
              required
            />
          </FieldRow>
          <FieldRow label="Valor por consulta (R$) *">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={valorConsulta}
              onChange={(e) => setValorConsulta(e.target.value)}
              required
            />
          </FieldRow>
          <FieldRow label="Fretes (quantidade) *">
            <Input
              type="number"
              min={0}
              step={1}
              value={qtdFretes}
              onChange={(e) => setQtdFretes(e.target.value)}
              required
            />
          </FieldRow>
          <FieldRow label="Valor por frete (R$) *">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={valorFrete}
              onChange={(e) => setValorFrete(e.target.value)}
              required
            />
          </FieldRow>
          <FieldRow label="Parcelas *">
            <Input
              type="number"
              min={1}
              max={60}
              step={1}
              value={parcelas}
              onChange={(e) => setParcelas(e.target.value)}
              required
            />
          </FieldRow>
          <FieldRow label="Forma de pagamento *">
            <Input
              value={formaPagamento}
              onChange={(e) => setFormaPagamento(e.target.value)}
              required
            />
          </FieldRow>
        </CardContent>
      </Card>

      {/* Prévia calculada */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Resumo calculado</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          <LinhaResumo
            rotulo={textos.linhaFrascos}
            detalhe={`${entrada.qtdFrascos} × R$ ${formatarValor(entrada.valorFrasco)}`}
            valor={brl(calc.subtotalMedicamentos)}
          />
          <LinhaResumo
            rotulo="Subsídio Collab"
            detalhe={`${formatarPercentual(entrada.descontoPct)}%`}
            valor={`– ${brl(calc.valorSubsidio)}`}
          />
          <LinhaResumo
            rotulo="Medicamentos após o subsídio"
            valor={brl(calc.medicamentosLiquido)}
          />
          <LinhaResumo
            rotulo="Consultas neurológicas"
            detalhe={`${entrada.qtdConsultas} × R$ ${formatarValor(entrada.valorConsulta)}`}
            valor={brl(calc.totalConsultas)}
          />
          <LinhaResumo
            rotulo={textos.linhaFretes}
            detalhe={`${entrada.qtdFretes} × R$ ${formatarValor(entrada.valorFrete)}`}
            valor={brl(calc.totalFretes)}
          />
          <LinhaResumo rotulo={textos.rotuloTotal} valor={brl(calc.totalAdesao)} destaque />
          <p className="text-muted-foreground pt-3 text-sm">
            {entrada.parcelas} {textos.parcelasTexto}{' '}
            <span className="text-foreground font-semibold">{brl(calc.valorParcela)}</span>
            {calc.valorUltimaParcela !== calc.valorParcela && (
              <span className="block pt-1 text-xs">
                Última parcela de {brl(calc.valorUltimaParcela)}, com o ajuste de centavos para
                fechar o total.
              </span>
            )}
          </p>
        </CardContent>
      </Card>

      {/* Ações */}
      <div className="flex items-center justify-between border-t pt-6">
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={() => router.push(ROTA_LISTA)}>
            Cancelar
          </Button>
          {isEdit && podeExcluir && <BotaoExcluirPlano id={plano.id} numero={plano.planoNumber} />}
        </div>
        <div className="flex gap-3">
          {isEdit && (
            <a
              href={`/api/planos-tratamento/${plano.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button type="button" variant="outline" className="gap-2">
                <FileText size={16} /> Ver documento
              </Button>
            </a>
          )}
          <Button type="submit" disabled={saving} className="gap-2">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {isEdit ? 'Atualizar' : 'Salvar'} Plano
          </Button>
        </div>
      </div>
    </form>
  );
}
