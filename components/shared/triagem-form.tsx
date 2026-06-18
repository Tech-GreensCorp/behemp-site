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

  const aplicarMascara = (id: string, value: string): string => {
    const clean = value.replace(/\D/g, '');
    
    if (id === 'cpf' || id === 'cpf_responsavel') {
      return clean.slice(0, 11).replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, (_, p1, p2, p3, p4) => {
        let res = '';
        if (p1) res += p1;
        if (p2) res += `.${p2}`;
        if (p3) res += `.${p3}`;
        if (p4) res += `-${p4}`;
        return res;
      }).replace(/(\d{3})(\d{3})(\d{0,3})/, (_, p1, p2, p3) => {
        if (!p3) return p2 ? `${p1}.${p2}` : p1;
        return `${p1}.${p2}.${p3}`;
      });
    }

    if (id === 'data_nascimento') {
      return clean.slice(0, 8).replace(/(\d{2})(\d{2})(\d{4})/, (_, p1, p2, p3) => {
        let res = '';
        if (p1) res += p1;
        if (p2) res += `/${p2}`;
        if (p3) res += `/${p3}`;
        return res;
      }).replace(/(\d{2})(\d{0,2})/, (_, p1, p2) => {
        if (!p2) return p1;
        return `${p1}/${p2}`;
      });
    }

    if (id === 'telefone') {
      if (clean.length <= 10) {
        return clean.replace(/(\d{2})(\d{4})(\d{0,4})/, (_, p1, p2, p3) => {
          let res = '';
          if (p1) res += `(${p1}`;
          if (p2) res += `) ${p2}`;
          if (p3) res += `-${p3}`;
          return res;
        });
      } else {
        return clean.slice(0, 11).replace(/(\d{2})(\d{5})(\d{0,4})/, (_, p1, p2, p3) => {
          let res = '';
          if (p1) res += `(${p1}`;
          if (p2) res += `) ${p2}`;
          if (p3) res += `-${p3}`;
          return res;
        });
      }
    }

    if (id === 'cep') {
      return clean.slice(0, 8).replace(/(\d{5})(\d{0,3})/, (_, p1, p2) => {
        if (!p2) return p1;
        return `${p1}-${p2}`;
      });
    }

    if (id === 'peso' || id === 'altura' || id === 'total_residencia' || id === 'num_criancas' || id === 'num_idosos' || id === 'num_deficiencia') {
      return clean;
    }

    if (id === 'renda_total' || id === 'despesas_medicas') {
      if (!clean) return '';
      const floatVal = parseFloat(clean) / 100;
      return floatVal.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }

    return value;
  };

  function validarCPF(cpf: string): boolean {
    if (/^(\d)\1+$/.test(cpf)) return false;
    
    let soma = 0;
    let resto;
    
    for (let i = 1; i <= 9; i++) {
      soma += parseInt(cpf.substring(i - 1, i), 10) * (11 - i);
    }
    
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf.substring(9, 10), 10)) return false;
    
    soma = 0;
    for (let i = 1; i <= 10; i++) {
      soma += parseInt(cpf.substring(i - 1, i), 10) * (12 - i);
    }
    
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf.substring(10, 11), 10)) return false;
    
    return true;
  }

  function validarPassoAtual(): boolean {
    const campos = currentStep.campos.filter(campoVisivel);
    
    for (const campo of campos) {
      if (campo.obrigatorio) {
        if (campo.tipo === 'checkbox-group') {
          const vals = checkboxes[campo.id] || [];
          if (vals.length === 0) {
            toast.error(`O campo "${campo.label}" é obrigatório.`);
            return false;
          }
        } else if (campo.tipo === 'file') {
          if (!arquivo) {
            toast.error(`O anexo "${campo.label}" é obrigatório.`);
            return false;
          }
        } else {
          const val = dados[campo.id] || '';
          if (!val.trim()) {
            toast.error(`O campo "${campo.label}" é obrigatório.`);
            return false;
          }
        }
      }
      
      const val = dados[campo.id] || '';
      if (val.trim()) {
        if (campo.id === 'email') {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(val)) {
            toast.error('O e-mail informado é inválido. Por favor, digite um formato válido (ex: nome@email.com).');
            return false;
          }
        }
        
        if (campo.id === 'cpf' || campo.id === 'cpf_responsavel') {
          const cleanCpf = val.replace(/\D/g, '');
          if (cleanCpf.length !== 11) {
            toast.error(`O ${campo.label} deve conter 11 dígitos.`);
            return false;
          }
          if (!validarCPF(cleanCpf)) {
            toast.error(`${campo.label} inválido. Por favor, verifique os dígitos informados.`);
            return false;
          }
        }
        
        if (campo.id === 'telefone') {
          const cleanTel = val.replace(/\D/g, '');
          if (cleanTel.length < 10 || cleanTel.length > 11) {
            toast.error(`O ${campo.label} deve conter 10 ou 11 dígitos (com DDD).`);
            return false;
          }
        }
        
        if (campo.id === 'data_nascimento') {
          const cleanDate = val.replace(/\D/g, '');
          if (cleanDate.length !== 8) {
            toast.error(`A ${campo.label} deve estar no formato DD/MM/AAAA.`);
            return false;
          }
          
          const dia = parseInt(cleanDate.substring(0, 2), 10);
          const mes = parseInt(cleanDate.substring(2, 4), 10);
          const ano = parseInt(cleanDate.substring(4, 8), 10);
          
          const dateObj = new Date(ano, mes - 1, dia);
          const hoje = new Date();
          if (
            dateObj.getFullYear() !== ano ||
            dateObj.getMonth() !== mes - 1 ||
            dateObj.getDate() !== dia ||
            ano < 1900 ||
            dateObj > hoje
          ) {
            toast.error(`${campo.label} inválida ou no futuro.`);
            return false;
          }
        }

        if (campo.id === 'cep') {
          const cleanCep = val.replace(/\D/g, '');
          if (cleanCep.length !== 8) {
            toast.error(`O ${campo.label} deve conter 8 dígitos.`);
            return false;
          }
        }

        if (campo.id === 'peso') {
          const num = parseFloat(val);
          if (isNaN(num) || num <= 0) {
            toast.error('Por favor, informe um peso válido maior que 0.');
            return false;
          }
        }

        if (campo.id === 'altura') {
          const num = parseInt(val, 10);
          if (isNaN(num) || num <= 0) {
            toast.error('Por favor, informe uma altura válida maior que 0.');
            return false;
          }
        }

        if (campo.id === 'total_residencia') {
          const num = parseInt(val, 10);
          if (isNaN(num) || num <= 0) {
            toast.error('O número total de pessoas na residência deve ser maior que 0.');
            return false;
          }
        }

        if (campo.id === 'num_criancas' || campo.id === 'num_idosos' || campo.id === 'num_deficiencia') {
          const num = parseInt(val, 10);
          if (isNaN(num) || num < 0) {
            toast.error(`O campo "${campo.label}" não pode conter valor negativo.`);
            return false;
          }
        }
      }
    }

    if (step === 2) {
      const total = parseInt(dados['total_residencia'] || '0', 10);
      const criancas = parseInt(dados['num_criancas'] || '0', 10);
      const idosos = parseInt(dados['num_idosos'] || '0', 10);
      
      if (!isNaN(total) && !isNaN(criancas) && !isNaN(idosos)) {
        if (criancas + idosos > total) {
          toast.error('A soma de crianças e idosos não pode ser maior que o total de pessoas na residência.');
          return false;
        }
      }
    }
    
    return true;
  }

  function updateField(id: string, value: string) {
    const valueComMascara = aplicarMascara(id, value);
    setDados((prev) => ({ ...prev, [id]: valueComMascara }));
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
    if (!validarPassoAtual()) return;
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
      <div className={cn(compact ? '' : 'mx-auto max-w-[80rem] px-4 sm:px-6 lg:px-8')}>

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
                e conectá-la ao cuidado certo.
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
                    onClick={() => {
                      if (validarPassoAtual()) {
                        setStep((s) => Math.min(totalSteps - 1, s + 1));
                      }
                    }}
                    className="btn-pill gap-2 bg-primary px-8 text-primary-foreground hover:bg-primary/90"
                  >
                    Continuar
                    <ChevronRight size={16} />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={() => {
                      if (validarPassoAtual()) {
                        handleSubmit();
                      }
                    }}
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
