'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { criarTriagem } from '@/app/(public)/_actions/triagem';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Upload,
} from 'lucide-react';

/* ── Tipos ───────────────────────────────────────────── */

type TipoCampo =
  | 'input'
  | 'textarea'
  | 'select'
  | 'radio'
  | 'checkbox-group'
  | 'file'
  | 'currency';

interface Campo {
  id: string;
  label: string;
  tipo: TipoCampo;
  placeholder?: string;
  obrigatorio?: boolean;
  opcoes?: string[];
  halfWidth?: boolean;
  condicional?: { campo: string; valor: string };
}

interface Step {
  titulo: string;
  descricao: string;
  campos: Campo[];
}

/* ── Steps do formulário ─────────────────────────────── */

const STEPS: Step[] = [
  /* ── 1. Dados pessoais ── */
  {
    titulo: 'Dados do paciente',
    descricao: 'Informações de identificação',
    campos: [
      {
        id: 'nome_paciente',
        label: 'Nome completo do Paciente',
        tipo: 'input',
        placeholder: 'Nome completo',
        obrigatorio: true,
      },
      {
        id: 'cpf',
        label: 'CPF',
        tipo: 'input',
        placeholder: '000.000.000-00',
        obrigatorio: true,
        halfWidth: true,
      },
      {
        id: 'data_nascimento',
        label: 'Data de nascimento',
        tipo: 'input',
        placeholder: 'DD/MM/AAAA',
        obrigatorio: true,
        halfWidth: true,
      },
      {
        id: 'peso',
        label: 'Peso do Paciente (kg)',
        tipo: 'input',
        placeholder: 'Ex: 70',
        obrigatorio: true,
        halfWidth: true,
      },
      {
        id: 'altura',
        label: 'Altura do Paciente (cm)',
        tipo: 'input',
        placeholder: 'Ex: 172',
        obrigatorio: true,
        halfWidth: true,
      },
      {
        id: 'nome_responsavel',
        label: 'Nome Completo do Responsável',
        tipo: 'input',
        placeholder: 'Se diferente do paciente',
        obrigatorio: false,
      },
      {
        id: 'cpf_responsavel',
        label: 'CPF do Responsável',
        tipo: 'input',
        placeholder: '000.000.000-00',
        obrigatorio: false,
      },
      {
        id: 'email',
        label: 'E-mail',
        tipo: 'input',
        placeholder: 'seu@email.com',
        obrigatorio: true,
        halfWidth: true,
      },
      {
        id: 'telefone',
        label: 'Telefone / WhatsApp',
        tipo: 'input',
        placeholder: '(11) 98123-4567',
        obrigatorio: true,
        halfWidth: true,
      },
      {
        id: 'cep',
        label: 'CEP',
        tipo: 'input',
        placeholder: '00000-000',
        obrigatorio: true,
        halfWidth: true,
      },
      {
        id: 'estado',
        label: 'Estado',
        tipo: 'select',
        obrigatorio: true,
        halfWidth: true,
        opcoes: [
          'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
          'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
          'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
        ],
      },
      {
        id: 'endereco',
        label: 'Endereço completo',
        tipo: 'input',
        placeholder: 'Rua, número, complemento, bairro, cidade',
        obrigatorio: true,
      },
      {
        id: 'como_chegou',
        label: 'Como chegou até nós?',
        tipo: 'radio',
        obrigatorio: true,
        opcoes: [
          'Redes Sociais - Behemp',
          'Redes Sociais - Greens',
          'Site Be4Hope',
          'Site Greens',
          'Indicação de quem já toma',
          'Influencer',
          'Indicação Médica',
        ],
      },
    ],
  },

  /* ── 2. Informações clínicas ── */
  {
    titulo: 'Informações clínicas',
    descricao: 'Saúde e tratamento',
    campos: [
      {
        id: 'diagnostico_principal',
        label: 'Diagnóstico principal',
        tipo: 'input',
        placeholder: 'Ex: Epilepsia refratária, Ansiedade, Dor crônica...',
        obrigatorio: true,
      },
      {
        id: 'nivel_tratamento',
        label: 'Tratamento',
        tipo: 'radio',
        obrigatorio: true,
        opcoes: ['Alto', 'Médio', 'Baixo'],
      },
      {
        id: 'historico_tratamentos',
        label: 'Histórico de tratamentos anteriores',
        tipo: 'textarea',
        placeholder: 'Descreva terapias, internações, procedimentos realizados anteriormente...',
        obrigatorio: true,
      },
      {
        id: 'medicamentos_atuais',
        label: 'Medicamentos atuais',
        tipo: 'textarea',
        placeholder: 'Liste os medicamentos que está tomando atualmente, com doses se possível...',
        obrigatorio: true,
      },
      {
        id: 'relatorio_medico',
        label: 'Relatório médico ou prescrição',
        tipo: 'file',
        obrigatorio: false,
      },
    ],
  },

  /* ── 3. Composição familiar ── */
  {
    titulo: 'Composição familiar',
    descricao: 'Dados sobre sua residência',
    campos: [
      {
        id: 'total_residencia',
        label: 'Número total de pessoas na residência',
        tipo: 'input',
        placeholder: 'Ex: 4',
        obrigatorio: true,
        halfWidth: true,
      },
      {
        id: 'num_criancas',
        label: 'Número de crianças (0–17 anos)',
        tipo: 'input',
        placeholder: 'Ex: 2',
        obrigatorio: true,
        halfWidth: true,
      },
      {
        id: 'num_idosos',
        label: 'Número de idosos (60+ anos)',
        tipo: 'input',
        placeholder: 'Ex: 1',
        obrigatorio: true,
        halfWidth: true,
      },
      {
        id: 'num_deficiencia',
        label: 'Número de pessoas com deficiência',
        tipo: 'input',
        placeholder: 'Ex: 0',
        obrigatorio: true,
        halfWidth: true,
      },
      {
        id: 'responsavel_financeiro',
        label: 'Você é o principal responsável financeiro?',
        tipo: 'radio',
        obrigatorio: true,
        opcoes: ['Sim', 'Não'],
      },
      {
        id: 'responsavel_financeiro_quem',
        label: 'Se não, quem seria?',
        tipo: 'input',
        placeholder: 'Nome e parentesco',
        obrigatorio: false,
        condicional: { campo: 'responsavel_financeiro', valor: 'Não' },
      },
    ],
  },

  /* ── 4. Situação financeira ── */
  {
    titulo: 'Situação financeira',
    descricao: 'Renda e trabalho',
    campos: [
      {
        id: 'renda_total',
        label: 'Renda total mensal da família',
        tipo: 'currency',
        placeholder: 'R$ 0,00',
        obrigatorio: true,
      },
      {
        id: 'fontes_renda',
        label: 'Principais fontes de renda familiar',
        tipo: 'checkbox-group',
        obrigatorio: true,
        opcoes: [
          'Empregado CLT',
          'Trabalho Informal',
          'Aposentadoria / Pensão',
          'Benefícios sociais (Bolsa Família, BPC, etc.)',
          'Trabalho autônomo',
          'Renda de aluguel',
          'Ajuda de familiares',
        ],
      },
      {
        id: 'situacao_trabalho',
        label: 'Sua situação atual de trabalho',
        tipo: 'radio',
        obrigatorio: true,
        opcoes: [
          'Empregado CLT',
          'Autônomo / Freelancer',
          'Empresário / Sócio',
          'Desempregado',
          'Aposentado / Pensionista',
          'Estudante',
          'Do lar',
          'Afastado por doença',
          'Servidor público',
          'Outros',
        ],
      },
      {
        id: 'profissao',
        label: 'Profissão',
        tipo: 'input',
        placeholder: 'Ex: Professora, Auxiliar administrativo...',
        obrigatorio: true,
      },
      {
        id: 'tempo_desempregado',
        label: 'Se desempregado, há quanto tempo?',
        tipo: 'input',
        placeholder: 'Ex: 6 meses',
        obrigatorio: false,
        condicional: { campo: 'situacao_trabalho', valor: 'Desempregado' },
      },
      {
        id: 'programas_sociais',
        label: 'Participa de programas sociais?',
        tipo: 'checkbox-group',
        obrigatorio: true,
        opcoes: [
          'Família inscrita no CadÚnico',
          'Bolsa Família / Auxílio Brasil',
          'BPC / LOAS',
          'Tarifa social de energia',
          'Outros benefícios sociais',
          'Nenhum',
        ],
      },
    ],
  },

  /* ── 5. Moradia e saúde ── */
  {
    titulo: 'Moradia e saúde',
    descricao: 'Última etapa',
    campos: [
      {
        id: 'convenio_medico',
        label: 'Possui convênio médico?',
        tipo: 'radio',
        obrigatorio: true,
        opcoes: ['Sim', 'Não'],
      },
      {
        id: 'convenio_qual',
        label: 'Se sim, qual?',
        tipo: 'input',
        placeholder: 'Nome do convênio',
        obrigatorio: false,
        condicional: { campo: 'convenio_medico', valor: 'Sim' },
      },
      {
        id: 'condicao_moradia',
        label: 'Condições de Moradia',
        tipo: 'radio',
        obrigatorio: true,
        opcoes: ['Própria', 'Alugada', 'Cedida', 'Ocupação'],
      },
      {
        id: 'despesas_medicas',
        label: 'Despesas médicas mensais atuais',
        tipo: 'currency',
        placeholder: 'R$ 0,00',
        obrigatorio: true,
      },
    ],
  },
];

/* ── Props ────────────────────────────────────────────── */

interface TriagemFormProps {
  /** ClerkId do médico logado. Se presente, vincula a triagem. */
  medicoClerkId?: string;
  /** Callback executado após envio com sucesso. */
  onSuccess?: () => void;
  /** Layout compacto para uso dentro do dashboard (sem breadcrumb, sem coluna lateral). */
  compact?: boolean;
}

/* ── Componente principal ────────────────────────────── */

export function TriagemForm({ medicoClerkId, onSuccess, compact = false }: TriagemFormProps) {
  const [step, setStep] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [dados, setDados] = useState<Record<string, string>>({});
  const [checkboxes, setCheckboxes] = useState<Record<string, string[]>>({});
  const [arquivo, setArquivo] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalSteps = STEPS.length;
  const currentStep = STEPS[step];

  function updateField(id: string, value: string) {
    setDados((prev) => ({ ...prev, [id]: value }));
  }

  function toggleCheckbox(id: string, opcao: string) {
    setCheckboxes((prev) => {
      const atual = prev[id] || [];
      const existe = atual.includes(opcao);
      return {
        ...prev,
        [id]: existe ? atual.filter((v) => v !== opcao) : [...atual, opcao],
      };
    });
  }

  /* campo condicional — só exibe se o campo pai tem o valor esperado */
  function campoVisivel(campo: Campo): boolean {
    if (!campo.condicional) return true;
    return dados[campo.condicional.campo] === campo.condicional.valor;
  }

  function resetForm() {
    setStep(0);
    setEnviado(false);
    setDados({});
    setCheckboxes({});
    setArquivo(null);
  }

  async function handleSubmit() {
    setEnviando(true);

    /* Monta os dados consolidados (texto + checkboxes) */
    const dadosCompletos: Record<string, unknown> = { ...dados };
    for (const [key, values] of Object.entries(checkboxes)) {
      dadosCompletos[key] = values.join(', ');
    }

    /* Arquivo: converte para Base64 para armazenar no JSON */
    if (arquivo) {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(arquivo);
      });
      dadosCompletos['relatorio_medico_arquivo'] = base64;
      dadosCompletos['relatorio_medico_nome'] = arquivo.name;
    }

    const resultado = await criarTriagem({
      dados: dadosCompletos,
      nomeContato: dados.nome_paciente || undefined,
      emailContato: dados.email || undefined,
      telefoneContato: dados.telefone || undefined,
      medicoClerkId: medicoClerkId || undefined,
    });

    setEnviando(false);

    if (resultado.sucesso) {
      setEnviado(true);
      toast.success('Triagem enviada com sucesso!');
      onSuccess?.();
    } else {
      toast.error(resultado.erro || 'Erro ao enviar triagem');
    }
  }

  /* ── Tela de sucesso ─────────────────────────────── */
  if (enviado) {
    return (
      <Card className="mx-auto max-w-md border-0 shadow-lg">
        <CardContent className="p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle2 size={32} className="text-primary" />
          </div>
          <h2 className="font-display text-2xl font-bold">Triagem enviada!</h2>
          <p className="mt-3 text-muted-foreground">
            {medicoClerkId
              ? 'Triagem registrada com sucesso. Você pode acompanhar na aba "Minhas triagens".'
              : 'Obrigado pelas informações. Nossa equipe analisará suas respostas e entrará em contato em até 48h pelo WhatsApp.'}
          </p>
          <Button
            className="btn-pill mt-6 bg-primary text-primary-foreground"
            onClick={resetForm}
          >
            {medicoClerkId ? 'Nova triagem' : 'Enviar outra triagem'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  /* ── Formulário multi-steps ──────────────────────── */
  return (
    <div className={cn(compact ? '' : 'min-h-screen pb-16 pt-24')}>
      <div className={cn(compact ? '' : 'mx-auto max-w-6xl px-4 sm:px-6 lg:px-8')}>

        {/* Breadcrumb — apenas na versão pública */}
        {!compact && (
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Início / Triagem
            </p>
          </div>
        )}

        <div className={cn(
          compact
            ? '' /* layout simples no dashboard */
            : 'grid gap-12 lg:grid-cols-[1fr_2fr] lg:gap-16',
        )}>

          {/* Coluna esquerda — Informações fixas (apenas público) */}
          {!compact && (
            <div className="hidden lg:block">
              <h1 className="font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
                Vamos
                <br />
                te <span className="text-accent-italic">acolher.</span>
              </h1>
              <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground">
                Este formulário é o primeiro passo para entender sua história
                e conectá-la ao cuidado certo. Sem pressa, sem julgamento, sem custo.
              </p>

              {/* Progresso dos steps */}
              <ul className="mt-10 space-y-4">
                {STEPS.map((s, i) => (
                  <li key={s.titulo} className="flex items-center gap-3">
                    <span
                      className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors',
                        i < step
                          ? 'bg-primary text-white'
                          : i === step
                            ? 'bg-primary text-white ring-4 ring-primary/20'
                            : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {i < step ? (
                        <CheckCircle2 size={14} />
                      ) : (
                        i + 1
                      )}
                    </span>
                    <span
                      className={cn(
                        'text-sm transition-colors',
                        i === step ? 'font-semibold text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {s.titulo}
                    </span>
                  </li>
                ))}
              </ul>

              <p className="mt-8 text-xs text-muted-foreground">
                🔒 Suas informações são confidenciais e protegidas pela LGPD.
              </p>
            </div>
          )}

          {/* Coluna direita (ou única) — Card do formulário */}
          <Card className="border-0 shadow-xl">
            <CardContent className="p-6 sm:p-8">

              {/* Barra de progresso */}
              <div className="mb-6 flex gap-1.5">
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      'h-1 flex-1 rounded-full transition-all duration-300',
                      i < step ? 'bg-primary' : i === step ? 'bg-primary/50' : 'bg-muted',
                    )}
                  />
                ))}
              </div>

              {/* Header do step */}
              <div className="mb-6">
                <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                  Etapa {step + 1} de {totalSteps}
                </p>
                <h2 className="font-display text-xl font-semibold">{currentStep.titulo}</h2>
                <p className="text-sm text-muted-foreground">{currentStep.descricao}</p>
              </div>

              {/* Campos */}
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  {currentStep.campos
                    .filter(campoVisivel)
                    .map((campo) => (
                      <div
                        key={campo.id}
                        className={campo.halfWidth ? 'col-span-1' : 'col-span-2'}
                      >
                        <Label
                          htmlFor={campo.id}
                          className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground"
                        >
                          {campo.label}
                          {campo.obrigatorio && (
                            <span className="ml-1 text-primary">*</span>
                          )}
                        </Label>

                        {/* ── textarea ── */}
                        {campo.tipo === 'textarea' && (
                          <Textarea
                            id={campo.id}
                            value={dados[campo.id] || ''}
                            onChange={(e) => updateField(campo.id, e.target.value)}
                            placeholder={campo.placeholder}
                            rows={3}
                            className="bg-background"
                          />
                        )}

                        {/* ── select ── */}
                        {campo.tipo === 'select' && (
                          <select
                            id={campo.id}
                            value={dados[campo.id] || ''}
                            onChange={(e) => updateField(campo.id, e.target.value)}
                            className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary"
                          >
                            <option value="">Selecione...</option>
                            {campo.opcoes?.map((op) => (
                              <option key={op} value={op}>{op}</option>
                            ))}
                          </select>
                        )}

                        {/* ── radio (botões pill) ── */}
                        {campo.tipo === 'radio' && (
                          <div className="flex flex-wrap gap-2">
                            {campo.opcoes?.map((op) => (
                              <button
                                key={op}
                                type="button"
                                onClick={() => updateField(campo.id, op)}
                                className={cn(
                                  'rounded-full border px-4 py-1.5 text-xs font-medium transition-colors',
                                  dados[campo.id] === op
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-border bg-background text-muted-foreground hover:border-primary/50',
                                )}
                              >
                                {op}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* ── checkbox-group ── */}
                        {campo.tipo === 'checkbox-group' && (
                          <div className="flex flex-wrap gap-2">
                            {campo.opcoes?.map((op) => {
                              const selecionado = (checkboxes[campo.id] || []).includes(op);
                              return (
                                <button
                                  key={op}
                                  type="button"
                                  onClick={() => toggleCheckbox(campo.id, op)}
                                  className={cn(
                                    'rounded-full border px-4 py-1.5 text-xs font-medium transition-colors',
                                    selecionado
                                      ? 'border-primary bg-primary/10 text-primary'
                                      : 'border-border bg-background text-muted-foreground hover:border-primary/50',
                                  )}
                                >
                                  {op}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* ── currency ── */}
                        {campo.tipo === 'currency' && (
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                              R$
                            </span>
                            <Input
                              id={campo.id}
                              value={dados[campo.id] || ''}
                              onChange={(e) => updateField(campo.id, e.target.value)}
                              placeholder="0,00"
                              className="bg-background pl-9"
                            />
                          </div>
                        )}

                        {/* ── file ── */}
                        {campo.tipo === 'file' && (
                          <div>
                            <input
                              ref={fileInputRef}
                              type="file"
                              id={campo.id}
                              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                              className="hidden"
                              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
                            />
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className={cn(
                                'flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-4 text-sm transition-colors',
                                arquivo
                                  ? 'border-primary bg-primary/5 text-primary'
                                  : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground',
                              )}
                            >
                              <Upload size={18} />
                              {arquivo ? arquivo.name : 'Clique para enviar (PDF, imagem ou Word)'}
                            </button>
                          </div>
                        )}

                        {/* ── input padrão ── */}
                        {campo.tipo === 'input' && (
                          <Input
                            id={campo.id}
                            value={dados[campo.id] || ''}
                            onChange={(e) => updateField(campo.id, e.target.value)}
                            placeholder={campo.placeholder}
                            className="bg-background"
                          />
                        )}
                      </div>
                    ))}
                </div>
              </div>

              {/* Navegação */}
              <div className="mt-8 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                  disabled={step === 0}
                  className={cn(
                    'flex items-center gap-1 text-sm font-medium transition-colors',
                    step === 0 ? 'invisible' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <ChevronLeft size={16} />
                  Voltar
                </button>

                {step < totalSteps - 1 ? (
                  <Button
                    type="button"
                    onClick={() => setStep((s) => Math.min(totalSteps - 1, s + 1))}
                    className="btn-pill gap-2 bg-primary px-8 text-primary-foreground hover:bg-primary/90"
                  >
                    Continuar
                    <ChevronRight size={16} />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={handleSubmit}
                    disabled={enviando}
                    className="btn-pill gap-2 bg-primary px-8 text-primary-foreground hover:bg-primary/90"
                  >
                    {enviando ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        Enviar triagem
                        <ChevronRight size={16} />
                      </>
                    )}
                  </Button>
                )}
              </div>

              <p className="mt-6 text-center text-xs text-muted-foreground">
                🔒 Suas informações são confidenciais e protegidas pela LGPD.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
