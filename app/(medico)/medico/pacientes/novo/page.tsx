'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowLeft01Icon,
  CheckmarkCircle01Icon,
  Loading03Icon,
  User02Icon,
  Home01Icon,
  Stethoscope02Icon,
  FileValidationIcon,
  UserMultiple02Icon,
} from '@hugeicons/core-free-icons';
import { criarPaciente } from '@/app/_actions/pacientes';
import { toast } from 'sonner';
import Link from 'next/link';

/**
 * Página de criação de novo paciente — formulário completo.
 * Design: Organic / Editorial Caloroso.
 * Seções: Dados Pessoais | Endereço | Dados Clínicos | Dados da Associação | Responsável
 */
export default function NovoPacientePage() {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);

  const [dados, setDados] = useState({
    // Dados pessoais
    nome: '',
    email: '',
    telefone: '',
    dataNascimento: '',
    cpf: '',
    rg: '',
    genero: '',
    // Endereço
    cep: '',
    endereco: '',
    cidade: '',
    uf: '',
    // Dados clínicos
    peso: '',
    altura: '',
    historicoMedico: '',
    patologia: '',
    // Dados da associação
    atendimento: '',
    temAdvogado: '',
    nomeAdvogado: '',
    cid: '',
    categorizacao: '',
    comoConheceu: '',
    dataAssociacao: '',
    entradaPaciente: '',
    etapa: '',
    hospitalProximo: '',
    homeCare: '',
    planoSaude: '',
    possuiPlanoSaude: '',
    rendaFamilia: '',
    termoAssociado: '',
    valorContribuicao: '',
    processoJudicializacao: '',
    tratamentoTipo: '' as '' | 'cbd' | 'thc' | 'cbd_thc',
    // Responsável
    responsavelNome: '',
    responsavelCpf: '',
  });

  function updateField(campo: string, valor: string) {
    setDados((prev) => ({ ...prev, [campo]: valor }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);

    const resultado = await criarPaciente({
      ...dados,
      tratamentoTipo: dados.tratamentoTipo || undefined,
    });

    setSalvando(false);

    if (resultado.sucesso) {
      toast.success('Paciente cadastrado com sucesso!');
      router.push('/medico/pacientes');
    } else {
      toast.error(resultado.erro || 'Erro ao cadastrar paciente');
    }
  }

  return (
    <div className="space-y-8">
      {/* Header editorial */}
      <div className="flex items-center gap-4">
        <Link href="/medico/pacientes">
          <Button variant="ghost" size="icon" nativeButton={false}>
            <HugeiconsIcon icon={ArrowLeft01Icon} size={20} />
          </Button>
        </Link>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Pacientes
          </p>
          <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
            Cadastrar <span className="text-accent-italic">Paciente</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Preencha os dados completos para iniciar o tratamento
          </p>
        </div>
      </div>

      <div className="h-px bg-gradient-to-r from-border/60 via-border to-transparent" />

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ── 1. Dados Pessoais ───────────────────────── */}
        <Card className="border-border/40 shadow-sm">
          <CardHeader className="border-b border-border/30 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-secondary/10">
                <HugeiconsIcon icon={User02Icon} size={16} className="text-secondary" />
              </div>
              <CardTitle className="font-heading text-lg">Dados Pessoais</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
            {/* Nome — largura total */}
            <div className="sm:col-span-2">
              <Label htmlFor="nome">Nome completo *</Label>
              <Input
                id="nome"
                value={dados.nome}
                onChange={(e) => updateField('nome', e.target.value)}
                placeholder="Nome completo do paciente"
                required
              />
            </div>

            <div>
              <Label htmlFor="cpf">CPF</Label>
              <Input
                id="cpf"
                value={dados.cpf}
                onChange={(e) => updateField('cpf', e.target.value)}
                placeholder="000.000.000-00"
              />
            </div>

            <div>
              <Label htmlFor="rg">RG</Label>
              <Input
                id="rg"
                value={dados.rg}
                onChange={(e) => updateField('rg', e.target.value)}
                placeholder="00.000.000-0"
              />
            </div>

            <div>
              <Label htmlFor="dataNascimento">Data de Nascimento</Label>
              <Input
                id="dataNascimento"
                type="date"
                value={dados.dataNascimento}
                onChange={(e) => updateField('dataNascimento', e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="genero">Gênero</Label>
              <Select value={dados.genero} onValueChange={(v) => updateField('genero', v ?? '')}>
                <SelectTrigger id="genero">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="masculino">Masculino</SelectItem>
                  <SelectItem value="feminino">Feminino</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                  <SelectItem value="nao_informado">Prefiro não informar</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={dados.telefone}
                onChange={(e) => updateField('telefone', e.target.value)}
                placeholder="(11) 99999-1234"
              />
            </div>

            <div>
              <Label htmlFor="email">E-mail *</Label>
              <Input
                id="email"
                type="email"
                value={dados.email}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder="paciente@email.com"
                required
              />
            </div>
          </CardContent>
        </Card>

        {/* ── 2. Endereço ─────────────────────────────── */}
        <Card className="border-border/40 shadow-sm">
          <CardHeader className="border-b border-border/30 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#C08E3A]/10">
                <HugeiconsIcon icon={Home01Icon} size={16} className="text-[#C08E3A]" />
              </div>
              <CardTitle className="font-heading text-lg">Endereço</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
            <div>
              <Label htmlFor="cep">CEP</Label>
              <Input
                id="cep"
                value={dados.cep}
                onChange={(e) => updateField('cep', e.target.value)}
                placeholder="00000-000"
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="endereco">Endereço</Label>
              <Input
                id="endereco"
                value={dados.endereco}
                onChange={(e) => updateField('endereco', e.target.value)}
                placeholder="Rua, número, bairro"
              />
            </div>

            <div>
              <Label htmlFor="cidade">Cidade</Label>
              <Input
                id="cidade"
                value={dados.cidade}
                onChange={(e) => updateField('cidade', e.target.value)}
                placeholder="São Paulo"
              />
            </div>

            <div>
              <Label htmlFor="uf">UF</Label>
              <Input
                id="uf"
                value={dados.uf}
                onChange={(e) => updateField('uf', e.target.value)}
                placeholder="SP"
                maxLength={2}
                className="uppercase"
              />
            </div>
          </CardContent>
        </Card>

        {/* ── 3. Dados Clínicos ───────────────────────── */}
        <Card className="border-border/40 shadow-sm">
          <CardHeader className="border-b border-border/30 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#C34C32]/10">
                <HugeiconsIcon icon={Stethoscope02Icon} size={16} className="text-[#C34C32]" />
              </div>
              <CardTitle className="font-heading text-lg">Dados Clínicos</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
            <div>
              <Label htmlFor="peso">Peso (kg)</Label>
              <Input
                id="peso"
                value={dados.peso}
                onChange={(e) => updateField('peso', e.target.value)}
                placeholder="70"
              />
            </div>

            <div>
              <Label htmlFor="altura">Altura (cm)</Label>
              <Input
                id="altura"
                value={dados.altura}
                onChange={(e) => updateField('altura', e.target.value)}
                placeholder="170"
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="historicoMedico">Histórico médico</Label>
              <Textarea
                id="historicoMedico"
                value={dados.historicoMedico}
                onChange={(e) => updateField('historicoMedico', e.target.value)}
                placeholder="Doenças pré-existentes, cirurgias, alergias..."
                rows={3}
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="patologia">Patologia do Paciente</Label>
              <Textarea
                id="patologia"
                value={dados.patologia}
                onChange={(e) => updateField('patologia', e.target.value)}
                placeholder="Diagnóstico e condições clínicas relevantes..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* ── 4. Dados da Associação ──────────────────── */}
        <Card className="border-border/40 shadow-sm">
          <CardHeader className="border-b border-border/30 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#2D4F3C]/10">
                <HugeiconsIcon icon={FileValidationIcon} size={16} className="text-[#2D4F3C]" />
              </div>
              <CardTitle className="font-heading text-lg">Dados da Associação</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
            <div>
              <Label htmlFor="atendimento">Atendimento</Label>
              <Input
                id="atendimento"
                value={dados.atendimento}
                onChange={(e) => updateField('atendimento', e.target.value)}
                placeholder="Tipo de atendimento"
              />
            </div>

            <div>
              <Label htmlFor="cid">CID</Label>
              <Input
                id="cid"
                value={dados.cid}
                onChange={(e) => updateField('cid', e.target.value)}
                placeholder="Ex: F32.0"
              />
            </div>

            <div>
              <Label htmlFor="categorizacao">Categorização</Label>
              <Input
                id="categorizacao"
                value={dados.categorizacao}
                onChange={(e) => updateField('categorizacao', e.target.value)}
                placeholder="Categoria do paciente"
              />
            </div>

            <div>
              <Label htmlFor="comoConheceu">Como conheceu a BeHemp?</Label>
              <Input
                id="comoConheceu"
                value={dados.comoConheceu}
                onChange={(e) => updateField('comoConheceu', e.target.value)}
                placeholder="Indicação, redes sociais..."
              />
            </div>

            <div>
              <Label htmlFor="dataAssociacao">Data de Associação</Label>
              <Input
                id="dataAssociacao"
                type="date"
                value={dados.dataAssociacao}
                onChange={(e) => updateField('dataAssociacao', e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="entradaPaciente">Entrada Paciente</Label>
              <Input
                id="entradaPaciente"
                value={dados.entradaPaciente}
                onChange={(e) => updateField('entradaPaciente', e.target.value)}
                placeholder="Identificador de entrada"
              />
            </div>

            <div>
              <Label htmlFor="etapa">Etapa</Label>
              <Input
                id="etapa"
                value={dados.etapa}
                onChange={(e) => updateField('etapa', e.target.value)}
                placeholder="Etapa atual"
              />
            </div>

            <div>
              <Label htmlFor="tratamentoTipo">Tipo de Tratamento</Label>
              <Select
                value={dados.tratamentoTipo}
                onValueChange={(v) => updateField('tratamentoTipo', v ?? '')}
              >
                <SelectTrigger id="tratamentoTipo">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cbd">CBD</SelectItem>
                  <SelectItem value="thc">THC</SelectItem>
                  <SelectItem value="cbd_thc">CBD + THC</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="hospitalProximo">Hospital mais próximo</Label>
              <Input
                id="hospitalProximo"
                value={dados.hospitalProximo}
                onChange={(e) => updateField('hospitalProximo', e.target.value)}
                placeholder="Nome e endereço do hospital"
              />
            </div>

            <div>
              <Label htmlFor="homeCare">Paciente em Home Care?</Label>
              <Select value={dados.homeCare} onValueChange={(v) => updateField('homeCare', v ?? '')}>
                <SelectTrigger id="homeCare">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sim">Sim</SelectItem>
                  <SelectItem value="nao">Não</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="possuiPlanoSaude">Possui plano de saúde?</Label>
              <Select
                value={dados.possuiPlanoSaude}
                onValueChange={(v) => {
                  updateField('possuiPlanoSaude', v ?? '');
                  if (v === 'nao') updateField('planoSaude', '');
                }}
              >
                <SelectTrigger id="possuiPlanoSaude">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sim">Sim</SelectItem>
                  <SelectItem value="nao">Não</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Plano de saúde só aparece se tiver plano */}
            {dados.possuiPlanoSaude === 'sim' && (
              <div className="sm:col-span-2">
                <Label htmlFor="planoSaude">Qual o plano de saúde?</Label>
                <Input
                  id="planoSaude"
                  value={dados.planoSaude}
                  onChange={(e) => updateField('planoSaude', e.target.value)}
                  placeholder="Nome do plano de saúde"
                />
              </div>
            )}

            <div>
              <Label htmlFor="rendaFamilia">Renda Família</Label>
              <Input
                id="rendaFamilia"
                value={dados.rendaFamilia}
                onChange={(e) => updateField('rendaFamilia', e.target.value)}
                placeholder="Faixa de renda familiar"
              />
            </div>

            <div>
              <Label htmlFor="termoAssociado">Termo de Associado</Label>
              <Input
                id="termoAssociado"
                value={dados.termoAssociado}
                onChange={(e) => updateField('termoAssociado', e.target.value)}
                placeholder="Nº ou identificador do termo"
              />
            </div>

            <div>
              <Label htmlFor="valorContribuicao">Valor da Contribuição</Label>
              <Input
                id="valorContribuicao"
                value={dados.valorContribuicao}
                onChange={(e) => updateField('valorContribuicao', e.target.value)}
                placeholder="R$ 0,00"
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="processoJudicializacao">
                Processo de Judicialização{' '}
                <span className="font-normal text-muted-foreground">(Aviso)</span>
              </Label>
              <Textarea
                id="processoJudicializacao"
                value={dados.processoJudicializacao}
                onChange={(e) => updateField('processoJudicializacao', e.target.value)}
                placeholder="Descreva o processo de judicialização, se houver..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* ── 5. Responsável / Representação Legal ────── */}
        <Card className="border-border/40 shadow-sm">
          <CardHeader className="border-b border-border/30 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#D4A388]/15">
                <HugeiconsIcon icon={UserMultiple02Icon} size={16} className="text-[#B08B6E]" />
              </div>
              <CardTitle className="font-heading text-lg">Responsável / Representação Legal</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
            <div>
              <Label htmlFor="responsavelNome">Nome do Responsável</Label>
              <Input
                id="responsavelNome"
                value={dados.responsavelNome}
                onChange={(e) => updateField('responsavelNome', e.target.value)}
                placeholder="Nome completo do responsável"
              />
            </div>

            <div>
              <Label htmlFor="responsavelCpf">CPF do Responsável</Label>
              <Input
                id="responsavelCpf"
                value={dados.responsavelCpf}
                onChange={(e) => updateField('responsavelCpf', e.target.value)}
                placeholder="000.000.000-00"
              />
            </div>

            <div>
              <Label htmlFor="temAdvogado">Possui advogado?</Label>
              <Select
                value={dados.temAdvogado}
                onValueChange={(v) => {
                  updateField('temAdvogado', v ?? '');
                  if (v === 'nao') updateField('nomeAdvogado', '');
                }}
              >
                <SelectTrigger id="temAdvogado">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sim">Sim</SelectItem>
                  <SelectItem value="nao">Não</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Nome do advogado aparece condicionalmente */}
            {dados.temAdvogado === 'sim' && (
              <div>
                <Label htmlFor="nomeAdvogado">Nome do Advogado</Label>
                <Input
                  id="nomeAdvogado"
                  value={dados.nomeAdvogado}
                  onChange={(e) => updateField('nomeAdvogado', e.target.value)}
                  placeholder="Nome completo do advogado"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Ações ────────────────────────────────────── */}
        <div className="flex justify-end gap-3 pb-8">
          <Link href="/medico/pacientes">
            <Button variant="outline" type="button" nativeButton={false}>
              Cancelar
            </Button>
          </Link>
          <Button type="submit" disabled={salvando} className="gap-2 rounded-xl px-6">
            {salvando ? (
              <>
                <HugeiconsIcon icon={Loading03Icon} size={16} className="animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <HugeiconsIcon icon={CheckmarkCircle01Icon} size={16} />
                Cadastrar Paciente
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
