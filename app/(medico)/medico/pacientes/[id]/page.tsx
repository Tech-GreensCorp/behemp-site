'use client';

import { use, useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { obterPaciente, atualizarPaciente } from '@/app/_actions/pacientes';
import type { PacienteCompleto } from '@/app/_actions/pacientes';
import { toast } from 'sonner';

// Importar componentes de abas
import { TabAnamnese } from './_components/tab-anamnese';
import { TabDocumentos } from './_components/tab-documentos';
import { TabExames } from './_components/tab-exames';
import { TabEvolucao } from './_components/tab-evolucao';
import { TabDosagem } from './_components/tab-dosagem';
import { TabGraficos } from './_components/tab-graficos';
import { TabRelatorios } from './_components/tab-relatorios';
import {
  Activity,
  CheckCircle2,
  ChevronLeft,
  FileCheck,
  FileOutput,
  Home,
  LineChart,
  Loader2,
  Microscope,
  Pencil,
  Pill,
  Stethoscope,
  StickyNote,
  Upload,
  Users,
  X,
} from 'lucide-react';

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  em_tratamento: { label: 'Em tratamento', variant: 'default' },
  aguardando_consulta: { label: 'Aguardando consulta', variant: 'secondary' },
  concluido: { label: 'Concluído', variant: 'outline' },
  arquivado: { label: 'Arquivado', variant: 'destructive' },
};

function formatDate(d: string | null) {
  if (!d) return '—';
  try { return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR'); } catch { return d; }
}

/** Formata valor numérico/string para moeda BRL. Ex: "15000" → "R$ 15.000,00" */
function formatarMoeda(valor: string | null | undefined): string {
  if (!valor) return '—';
  const num = parseFloat(valor.replace(/[^0-9,.]/g, '').replace(',', '.'));
  if (isNaN(num)) return valor;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Aplica máscara de CPF: 000.000.000-00 */
function mascaraCpf(v: string): string {
  return v
    .replace(/\D/g, '')
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

/** Aplica máscara de RG: 00.000.000-0 */
function mascaraRg(v: string): string {
  return v
    .replace(/\D/g, '')
    .slice(0, 9)
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

/** Aplica máscara de moeda BRL enquanto digita */
function mascaraMoeda(v: string): string {
  const numeros = v.replace(/\D/g, '');
  if (!numeros) return '';
  const centavos = parseInt(numeros, 10);
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Mapas de exibição para campos select */
const GENERO_LABEL: Record<string, string> = {
  masculino: 'Masculino',
  feminino: 'Feminino',
  outro: 'Outro',
  nao_informado: 'Prefiro não informar',
};

const SIM_NAO_LABEL: Record<string, string> = {
  sim: 'Sim',
  nao: 'Não',
};

const TRATAMENTO_LABEL: Record<string, string> = {
  cbd: 'CBD',
  thc: 'THC',
  cbd_thc: 'CBD + THC',
};

function InfoItem({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value || '—'}</p>
    </div>
  );
}

export default function PacienteDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [paciente, setPaciente] = useState<PacienteCompleto | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const carregar = useCallback(async () => {
    setCarregando(true);
    const res = await obterPaciente(id);
    if (res.sucesso && res.dados) {
      setPaciente(res.dados);
      syncForm(res.dados);
    } else {
      toast.error(res.erro || 'Paciente não encontrado');
    }
    setCarregando(false);
  }, [id]);

  function syncForm(p: PacienteCompleto) {
    setForm({
      dataNascimento: p.dataNascimento ?? '', cpf: p.cpf ?? '', rg: p.rg ?? '',
      genero: p.genero ?? '', cep: p.cep ?? '', endereco: p.endereco ?? '',
      cidade: p.cidade ?? '', uf: p.uf ?? '', peso: p.peso ?? '', altura: p.altura ?? '',
      historicoMedico: p.historicoMedico ?? '', patologia: p.patologia ?? '',
      atendimento: p.atendimento ?? '', temAdvogado: p.temAdvogado ?? '',
      nomeAdvogado: p.nomeAdvogado ?? '', cid: p.cid ?? '', categorizacao: p.categorizacao ?? '',
      comoConheceu: p.comoConheceu ?? '', dataAssociacao: p.dataAssociacao ?? '',
      entradaPaciente: p.entradaPaciente ?? '', etapa: p.etapa ?? '',
      hospitalProximo: p.hospitalProximo ?? '', homeCare: p.homeCare ?? '',
      planoSaude: p.planoSaude ?? '', possuiPlanoSaude: p.possuiPlanoSaude ?? '',
      rendaFamilia: p.rendaFamilia ?? '', termoAssociado: p.termoAssociado ?? '',
      valorContribuicao: p.valorContribuicao ?? '', processoJudicializacao: p.processoJudicializacao ?? '',
      responsavelNome: p.responsavelNome ?? '', responsavelCpf: p.responsavelCpf ?? '',
      tratamentoTipo: p.tratamentoTipo ?? '', status: p.status ?? '',
    });
  }

  useEffect(() => { carregar(); }, [carregar]);

  function u(campo: string, valor: string) { setForm(p => ({ ...p, [campo]: valor })); }

  async function handleSalvar() {
    setSalvando(true);
    const res = await atualizarPaciente({ pacienteId: id, ...form });
    setSalvando(false);
    if (res.sucesso) {
      toast.success('Paciente atualizado com sucesso!');
      setEditando(false);
      await carregar();
    } else {
      toast.error(res.erro || 'Erro ao salvar');
    }
  }

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!paciente) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <p className="text-lg font-medium">Paciente não encontrado</p>
        <Link href="/medico/pacientes" className="mt-4">
          <Button variant="outline" nativeButton={false}>Voltar</Button>
        </Link>
      </div>
    );
  }

  const st = STATUS_MAP[paciente.status] ?? STATUS_MAP.aguardando_consulta;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/medico/pacientes">
          <Button variant="ghost" size="icon" className="mt-1 shrink-0" nativeButton={false}>
            <ChevronLeft size={18} />
          </Button>
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Paciente</p>
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-2xl font-bold tracking-tight">{paciente.nome}</h1>
            <Badge variant={st.variant}>{st.label}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {paciente.email}{paciente.medicoNome ? ` · Médico: ${paciente.medicoNome}` : ''}
          </p>
        </div>
        <Button
          variant={editando ? 'destructive' : 'outline'}
          size="sm"
          className="gap-2 rounded-xl"
          onClick={() => { if (editando && paciente) syncForm(paciente); setEditando(!editando); }}
        >
          {(() => { const DynIcon = editando ? X : Pencil; return <DynIcon size={14} />; })()}
          {editando ? 'Cancelar' : 'Editar'}
        </Button>
      </div>

      <div className="h-px bg-gradient-to-r from-border/60 via-border to-transparent" />

      <Tabs defaultValue="dados">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="dados" className="gap-1.5">
            <Users size={14} /> Dados
          </TabsTrigger>
          <TabsTrigger value="anamnese" className="gap-1.5">
            <StickyNote size={14} /> Anamnese
          </TabsTrigger>
          <TabsTrigger value="documentos" className="gap-1.5">
            <Upload size={14} /> Documentos
          </TabsTrigger>
          <TabsTrigger value="exames" className="gap-1.5">
            <Microscope size={14} /> Exames
          </TabsTrigger>
          <TabsTrigger value="evolucao" className="gap-1.5">
            <Activity size={14} /> Evolução
          </TabsTrigger>
          <TabsTrigger value="dosagem" className="gap-1.5">
            <Pill size={14} /> Dosagem
          </TabsTrigger>
          <TabsTrigger value="graficos" className="gap-1.5">
            <LineChart size={14} /> Gráficos
          </TabsTrigger>
          <TabsTrigger value="relatorios" className="gap-1.5">
            <FileOutput size={14} /> Relatórios
          </TabsTrigger>
        </TabsList>

        {/* ── DADOS PESSOAIS + CLÍNICO + ASSOCIAÇÃO + RESPONSÁVEL ── */}
        <TabsContent value="dados" className="space-y-6">
          {/* Dados Pessoais */}
          <Card className="border-border/40 shadow-sm">
            <CardHeader className="border-b border-border/30 pb-4">
              <CardTitle className="font-heading text-lg">Dados Pessoais</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
              {editando ? (<>
                <div><Label>Data de Nascimento</Label><Input type="date" value={form.dataNascimento} onChange={e => u('dataNascimento', e.target.value)} /></div>
                <div><Label>CPF</Label><Input value={form.cpf} onChange={e => u('cpf', mascaraCpf(e.target.value))} placeholder="000.000.000-00" maxLength={14} /></div>
                <div><Label>RG</Label><Input value={form.rg} onChange={e => u('rg', mascaraRg(e.target.value))} placeholder="00.000.000-0" maxLength={12} /></div>
                <div>
                  <Label>Gênero</Label>
                  <Select value={form.genero} onValueChange={v => u('genero', v ?? '')}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="masculino">Masculino</SelectItem>
                      <SelectItem value="feminino">Feminino</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                      <SelectItem value="nao_informado">Prefiro não informar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>) : (<>
                <InfoItem label="Data de Nascimento" value={formatDate(paciente.dataNascimento)} />
                <InfoItem label="CPF" value={paciente.cpf ? mascaraCpf(paciente.cpf) : null} />
                <InfoItem label="RG" value={paciente.rg ? mascaraRg(paciente.rg) : null} />
                <InfoItem label="Gênero" value={paciente.genero ? (GENERO_LABEL[paciente.genero] ?? paciente.genero) : null} />
                <InfoItem label="Telefone" value={paciente.telefone} />
                <InfoItem label="E-mail" value={paciente.email} />
              </>)}
            </CardContent>
          </Card>

          {/* Endereço */}
          <Card className="border-border/40 shadow-sm">
            <CardHeader className="border-b border-border/30 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#C08E3A]/10">
                  <Home size={16} className="text-[#C08E3A]" />
                </div>
                <CardTitle className="font-heading text-lg">Endereço</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
              {editando ? (<>
                <div><Label>CEP</Label><Input value={form.cep} onChange={e => u('cep', e.target.value)} placeholder="00000-000" /></div>
                <div className="sm:col-span-2"><Label>Endereço</Label><Input value={form.endereco} onChange={e => u('endereco', e.target.value)} placeholder="Rua, número, bairro" /></div>
                <div><Label>Cidade</Label><Input value={form.cidade} onChange={e => u('cidade', e.target.value)} /></div>
                <div><Label>UF</Label><Input value={form.uf} onChange={e => u('uf', e.target.value)} maxLength={2} className="uppercase" /></div>
              </>) : (<>
                <InfoItem label="CEP" value={paciente.cep} />
                <InfoItem label="Endereço" value={paciente.endereco} />
                <InfoItem label="Cidade" value={paciente.cidade} />
                <InfoItem label="UF" value={paciente.uf} />
              </>)}
            </CardContent>
          </Card>

          {/* Dados Clínicos */}
          <Card className="border-border/40 shadow-sm">
            <CardHeader className="border-b border-border/30 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#C34C32]/10">
                  <Stethoscope size={16} className="text-[#C34C32]" />
                </div>
                <CardTitle className="font-heading text-lg">Dados Clínicos</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
              {editando ? (<>
                <div><Label>Peso (kg)</Label><Input value={form.peso} onChange={e => u('peso', e.target.value)} /></div>
                <div><Label>Altura (cm)</Label><Input value={form.altura} onChange={e => u('altura', e.target.value)} /></div>
                <div className="sm:col-span-2"><Label>Histórico médico</Label><Textarea value={form.historicoMedico} onChange={e => u('historicoMedico', e.target.value)} rows={3} /></div>
                <div className="sm:col-span-2"><Label>Patologia</Label><Textarea value={form.patologia} onChange={e => u('patologia', e.target.value)} rows={3} /></div>
                <div>
                  <Label>Tipo de Tratamento</Label>
                  <Select value={form.tratamentoTipo} onValueChange={v => u('tratamentoTipo', v ?? '')}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cbd">CBD</SelectItem>
                      <SelectItem value="thc">THC</SelectItem>
                      <SelectItem value="cbd_thc">CBD + THC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={v => u('status', v ?? '')}>
                    <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aguardando_consulta">Aguardando consulta</SelectItem>
                      <SelectItem value="em_tratamento">Em tratamento</SelectItem>
                      <SelectItem value="concluido">Concluído</SelectItem>
                      <SelectItem value="arquivado">Arquivado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>) : (<>
                <InfoItem label="Peso" value={paciente.peso ? `${paciente.peso} kg` : null} />
                <InfoItem label="Altura" value={paciente.altura ? `${paciente.altura} cm` : null} />
                <div className="sm:col-span-2"><InfoItem label="Histórico médico" value={paciente.historicoMedico} /></div>
                <div className="sm:col-span-2"><InfoItem label="Patologia" value={paciente.patologia} /></div>
                <InfoItem label="Tratamento" value={paciente.tratamentoTipo ? (TRATAMENTO_LABEL[paciente.tratamentoTipo] ?? paciente.tratamentoTipo.toUpperCase()) : null} />
                <InfoItem label="Status" value={st.label} />
              </>)}
            </CardContent>
          </Card>

          {/* Associação */}
          <Card className="border-border/40 shadow-sm">
            <CardHeader className="border-b border-border/30 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#2D4F3C]/10">
                  <FileCheck size={16} className="text-[#2D4F3C]" />
                </div>
                <CardTitle className="font-heading text-lg">Dados da Associação</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
              {editando ? (<>
                <div><Label>Atendimento</Label><Input value={form.atendimento} onChange={e => u('atendimento', e.target.value)} /></div>
                <div><Label>CID</Label><Input value={form.cid} onChange={e => u('cid', e.target.value)} placeholder="Ex: F32.0" /></div>
                <div><Label>Categorização</Label><Input value={form.categorizacao} onChange={e => u('categorizacao', e.target.value)} /></div>
                <div><Label>Como conheceu</Label><Input value={form.comoConheceu} onChange={e => u('comoConheceu', e.target.value)} /></div>
                <div><Label>Data de Associação</Label><Input type="date" value={form.dataAssociacao} onChange={e => u('dataAssociacao', e.target.value)} /></div>
                <div><Label>Entrada Paciente</Label><Input value={form.entradaPaciente} onChange={e => u('entradaPaciente', e.target.value)} /></div>
                <div><Label>Etapa</Label><Input value={form.etapa} onChange={e => u('etapa', e.target.value)} /></div>
                <div className="sm:col-span-2"><Label>Hospital mais próximo</Label><Input value={form.hospitalProximo} onChange={e => u('hospitalProximo', e.target.value)} /></div>
                <div>
                  <Label>Home Care?</Label>
                  <Select value={form.homeCare} onValueChange={v => u('homeCare', v ?? '')}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent><SelectItem value="sim">Sim</SelectItem><SelectItem value="nao">Não</SelectItem></SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Possui plano de saúde?</Label>
                  <Select value={form.possuiPlanoSaude} onValueChange={v => { u('possuiPlanoSaude', v ?? ''); if (v === 'nao') u('planoSaude', ''); }}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent><SelectItem value="sim">Sim</SelectItem><SelectItem value="nao">Não</SelectItem></SelectContent>
                  </Select>
                </div>
                {form.possuiPlanoSaude === 'sim' && <div className="sm:col-span-2"><Label>Plano de Saúde</Label><Input value={form.planoSaude} onChange={e => u('planoSaude', e.target.value)} /></div>}
                <div><Label>Renda Família</Label><Input value={form.rendaFamilia} onChange={e => u('rendaFamilia', mascaraMoeda(e.target.value))} placeholder="R$ 0,00" /></div>
                <div><Label>Termo de Associado</Label><Input value={form.termoAssociado} onChange={e => u('termoAssociado', e.target.value)} /></div>
                <div><Label>Valor da Contribuição</Label><Input value={form.valorContribuicao} onChange={e => u('valorContribuicao', mascaraMoeda(e.target.value))} placeholder="R$ 0,00" /></div>
                <div className="sm:col-span-2"><Label>Processo de Judicialização</Label><Textarea value={form.processoJudicializacao} onChange={e => u('processoJudicializacao', e.target.value)} rows={3} /></div>
              </>) : (<>
                <InfoItem label="Atendimento" value={paciente.atendimento} />
                <InfoItem label="CID" value={paciente.cid} />
                <InfoItem label="Categorização" value={paciente.categorizacao} />
                <InfoItem label="Como conheceu" value={paciente.comoConheceu} />
                <InfoItem label="Data de Associação" value={formatDate(paciente.dataAssociacao)} />
                <InfoItem label="Entrada Paciente" value={paciente.entradaPaciente} />
                <InfoItem label="Etapa" value={paciente.etapa} />
                <InfoItem label="Hospital mais próximo" value={paciente.hospitalProximo} />
                <InfoItem label="Home Care" value={paciente.homeCare ? (SIM_NAO_LABEL[paciente.homeCare] ?? paciente.homeCare) : null} />
                <InfoItem label="Plano de Saúde" value={paciente.possuiPlanoSaude === 'sim' ? paciente.planoSaude : (paciente.possuiPlanoSaude ? (SIM_NAO_LABEL[paciente.possuiPlanoSaude] ?? paciente.possuiPlanoSaude) : null)} />
                <InfoItem label="Renda Família" value={formatarMoeda(paciente.rendaFamilia)} />
                <InfoItem label="Termo de Associado" value={paciente.termoAssociado} />
                <InfoItem label="Valor da Contribuição" value={formatarMoeda(paciente.valorContribuicao)} />
                <div className="sm:col-span-2"><InfoItem label="Processo de Judicialização" value={paciente.processoJudicializacao} /></div>
              </>)}
            </CardContent>
          </Card>

          {/* Responsável */}
          <Card className="border-border/40 shadow-sm">
            <CardHeader className="border-b border-border/30 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#D4A388]/15">
                  <Users size={16} className="text-[#B08B6E]" />
                </div>
                <CardTitle className="font-heading text-lg">Responsável / Representação Legal</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
              {editando ? (<>
                <div><Label>Nome do Responsável</Label><Input value={form.responsavelNome} onChange={e => u('responsavelNome', e.target.value)} /></div>
                <div><Label>CPF do Responsável</Label><Input value={form.responsavelCpf} onChange={e => u('responsavelCpf', mascaraCpf(e.target.value))} placeholder="000.000.000-00" maxLength={14} /></div>
                <div>
                  <Label>Possui advogado?</Label>
                  <Select value={form.temAdvogado} onValueChange={v => { u('temAdvogado', v ?? ''); if (v === 'nao') u('nomeAdvogado', ''); }}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent><SelectItem value="sim">Sim</SelectItem><SelectItem value="nao">Não</SelectItem></SelectContent>
                  </Select>
                </div>
                {form.temAdvogado === 'sim' && <div><Label>Nome do Advogado</Label><Input value={form.nomeAdvogado} onChange={e => u('nomeAdvogado', e.target.value)} /></div>}
              </>) : (<>
                <InfoItem label="Nome do Responsável" value={paciente.responsavelNome} />
                <InfoItem label="CPF do Responsável" value={paciente.responsavelCpf ? mascaraCpf(paciente.responsavelCpf) : null} />
                <InfoItem label="Possui Advogado?" value={paciente.temAdvogado ? (SIM_NAO_LABEL[paciente.temAdvogado] ?? paciente.temAdvogado) : null} />
                {paciente.temAdvogado === 'sim' && <InfoItem label="Nome do Advogado" value={paciente.nomeAdvogado} />}
              </>)}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── ANAMNESE ── */}
        <TabsContent value="anamnese"><TabAnamnese pacienteId={id} /></TabsContent>

        {/* ── DOCUMENTOS ── */}
        <TabsContent value="documentos"><TabDocumentos pacienteId={id} /></TabsContent>

        {/* ── EXAMES ── */}
        <TabsContent value="exames"><TabExames pacienteId={id} /></TabsContent>

        {/* ── EVOLUÇÃO ── */}
        <TabsContent value="evolucao"><TabEvolucao pacienteId={id} /></TabsContent>

        {/* ── DOSAGEM ── */}
        <TabsContent value="dosagem"><TabDosagem pacienteId={id} /></TabsContent>

        {/* ── GRÁFICOS ── */}
        <TabsContent value="graficos"><TabGraficos pacienteId={id} /></TabsContent>

        {/* ── RELATÓRIOS ── */}
        <TabsContent value="relatorios"><TabRelatorios pacienteId={id} pacienteNome={paciente.nome} /></TabsContent>
      </Tabs>

      {/* Botão Salvar (fixo quando editando) */}
      {editando && (
        <div className="flex justify-end gap-3 pb-8">
          <Button variant="outline" onClick={() => { if (paciente) syncForm(paciente); setEditando(false); }}>Cancelar</Button>
          <Button onClick={handleSalvar} disabled={salvando} className="gap-2 rounded-xl px-6">
            {salvando ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            {salvando ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </div>
      )}
    </div>
  );
}
