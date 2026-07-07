import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertCircle,
  Building2,
  ChevronRight,
  Eye,
  FileCheck,
  FlaskConical,
  Gavel,
  Gift,
  HeartHandshake,
  ListChecks,
  Lock,
  Mail,
  RefreshCw,
  Scale,
  Shield,
  Smartphone,
  Target,
  UserCheck,
  XCircle,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Programa de Acesso Solidário — Be4Hope',
  description:
    'Conheça o Programa de Acesso Solidário à Medicina Endocanabinóide, parceria entre a Greens Pharmaceutical e a Fundação Be4Hope para ampliar o acesso de pacientes em vulnerabilidade social ou econômica.',
};

/* ── Seções do Regulamento ───────────────────────────── */

interface Secao {
  id: string;
  icon: typeof Shield;
  titulo: string;
  conteudo: React.ReactNode;
}

const SECOES: Secao[] = [
  {
    id: 'objetivo',
    icon: Target,
    titulo: '1. Objetivo',
    conteudo: (
      <div className="space-y-4">
        <p>
          O Programa de Acesso Solidário tem como finalidade ampliar o acesso de pacientes em
          situação de vulnerabilidade social ou econômica a tratamentos com medicamentos
          disponibilizados pela <strong>Greens</strong>, por meio de uma parceria institucional
          com a <strong>Fundação Be4Hope</strong>.
        </p>
        <p>
          O programa busca promover acesso responsável, ético e transparente, sempre respeitando
          a legislação vigente e as boas práticas de compliance.
        </p>
      </div>
    ),
  },
  {
    id: 'instituicoes',
    icon: Building2,
    titulo: '2. Instituições Participantes',
    conteudo: (
      <div className="space-y-5">
        <div className="rounded-xl bg-muted/40 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
            Greens Pharmaceutical
          </p>
          <p className="mb-2 text-sm">Responsável por:</p>
          <ul className="space-y-1.5">
            {[
              'desenvolvimento e fabricação dos medicamentos',
              'controle de qualidade',
              'documentação regulatória',
              'logística e fornecimento dos produtos',
              'suporte técnico e científico',
              'educação continuada para profissionais de saúde',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm">
                <FileCheck size={14} className="mt-1 shrink-0 text-primary" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl bg-muted/40 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
            Fundação Be4Hope
          </p>
          <p className="mb-2 text-sm">Responsável por:</p>
          <ul className="space-y-1.5">
            {[
              'acolhimento dos pacientes',
              'triagem socioeconômica',
              'análise documental',
              'avaliação dos critérios de elegibilidade',
              'acompanhamento social',
              'orientação às famílias',
              'monitoramento da continuidade do tratamento',
              'programas educacionais',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm">
                <FileCheck size={14} className="mt-1 shrink-0 text-primary" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: 'publico-elegivel',
    icon: UserCheck,
    titulo: '3. Público Elegível',
    conteudo: (
      <div className="space-y-4">
        <p>
          Poderão participar pacientes que preencham cumulativamente os seguintes requisitos:
        </p>
        <ul className="space-y-2">
          {[
            'possuir prescrição médica válida',
            'possuir indicação clínica compatível',
            'apresentar documentação exigida',
            'comprovar renda conforme critérios do programa',
            'concordar com o regulamento',
            'manter atualização cadastral',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm">
              <UserCheck size={14} className="mt-1 shrink-0 text-primary" />
              {item}
            </li>
          ))}
        </ul>
        <p className="text-sm">Poderão ser priorizados pacientes com:</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            'Doenças raras',
            'Epilepsia refratária',
            'Transtorno do espectro autista',
            'Paralisia cerebral',
            'Doenças neurodegenerativas',
            'Dor crônica refratária',
            'Pacientes oncológicos',
            'Outras condições aprovadas pela comissão técnica',
          ].map((item) => (
            <div key={item} className="rounded-lg bg-primary/5 px-3 py-2 text-sm">
              {item}
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'criterios-sociais',
    icon: Scale,
    titulo: '4. Critérios Sociais',
    conteudo: (
      <div className="space-y-4">
        <p>A Fundação realizará análise individual considerando:</p>
        <ul className="space-y-2">
          {[
            'renda familiar',
            'número de dependentes',
            'gastos médicos mensais',
            'custo dos tratamentos',
            'despesas extraordinárias',
            'laudos médicos',
            'histórico clínico',
            'situação de vulnerabilidade',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm">
              <Scale size={14} className="mt-1 shrink-0 text-primary" />
              {item}
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">
          A elegibilidade poderá ser revista periodicamente.
        </p>
      </div>
    ),
  },
  {
    id: 'inscricao',
    icon: FileCheck,
    titulo: '5. Processo de Inscrição',
    conteudo: (
      <div className="space-y-4">
        <p>O paciente deverá apresentar:</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            'Documento de identificação',
            'CPF',
            'Comprovante de residência',
            'Prescrição médica',
            'Relatório clínico',
            'Exames quando necessários',
            'Comprovante de renda',
            'Demais documentos solicitados',
          ].map((item) => (
            <div key={item} className="flex items-start gap-2.5 rounded-lg bg-muted/40 px-3 py-2 text-sm">
              <FileCheck size={14} className="mt-0.5 shrink-0 text-primary" />
              {item}
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'fluxo',
    icon: ListChecks,
    titulo: '6. Fluxo do Programa',
    conteudo: (
      <ol className="space-y-2">
        {[
          'Cadastro',
          'Acolhimento',
          'Triagem',
          'Conferência documental',
          'Avaliação social',
          'Avaliação técnica',
          'Aprovação',
          'Definição do benefício',
          'Orientação ao paciente',
          'Início do tratamento',
          'Acompanhamento periódico',
        ].map((item, i) => (
          <li key={item} className="flex items-center gap-3 text-sm">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {i + 1}
            </span>
            {item}
          </li>
        ))}
      </ol>
    ),
  },
  {
    id: 'beneficios',
    icon: Gift,
    titulo: '7. Benefícios Possíveis',
    conteudo: (
      <div className="space-y-4">
        <p>Conforme disponibilidade do programa, poderão ser concedidos:</p>
        <ul className="space-y-2">
          {[
            'acesso subsidiado aos medicamentos',
            'apoio técnico',
            'orientação farmacêutica',
            'acompanhamento educacional',
            'materiais informativos',
            'suporte ao uso correto da medicação',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm">
              <Gift size={14} className="mt-1 shrink-0 text-primary" />
              {item}
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">
          O percentual de subsídio será definido conforme os critérios internos do programa e
          poderá variar de acordo com cada caso.
        </p>
      </div>
    ),
  },
  {
    id: 'responsabilidades-paciente',
    icon: UserCheck,
    titulo: '8. Responsabilidades do Paciente',
    conteudo: (
      <div className="space-y-4">
        <p>O participante compromete-se a:</p>
        <ul className="space-y-2">
          {[
            'utilizar o medicamento conforme prescrição médica',
            'manter os dados cadastrais atualizados',
            'comunicar alterações de renda',
            'comparecer às avaliações solicitadas',
            'enviar documentos quando necessário',
            'utilizar os produtos exclusivamente para tratamento próprio',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm">
              <UserCheck size={14} className="mt-1 shrink-0 text-primary" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    ),
  },
  {
    id: 'responsabilidades-fundacao',
    icon: Shield,
    titulo: '9. Responsabilidades da Fundação',
    conteudo: (
      <div className="space-y-4">
        <p>Compete à Fundação:</p>
        <ul className="space-y-2">
          {[
            'garantir tratamento igualitário',
            'manter confidencialidade',
            'preservar dados pessoais',
            'realizar acolhimento humanizado',
            'aplicar critérios técnicos',
            'promover educação em saúde',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm">
              <Shield size={14} className="mt-1 shrink-0 text-primary" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    ),
  },
  {
    id: 'responsabilidades-greens',
    icon: FlaskConical,
    titulo: '10. Responsabilidades da Greens',
    conteudo: (
      <div className="space-y-4">
        <p>Compete à Greens:</p>
        <ul className="space-y-2">
          {[
            'garantir qualidade dos medicamentos',
            'manter rastreabilidade dos produtos',
            'fornecer suporte técnico',
            'disponibilizar materiais científicos',
            'cumprir todas as exigências regulatórias aplicáveis',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm">
              <FlaskConical size={14} className="mt-1 shrink-0 text-primary" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    ),
  },
  {
    id: 'transparencia',
    icon: Eye,
    titulo: '11. Transparência',
    conteudo: (
      <div className="space-y-4">
        <p>O programa será conduzido com base em:</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            'Ética',
            'Transparência',
            'Impessoalidade',
            'Responsabilidade social',
            'Rastreabilidade',
            'Compliance',
            'Respeito à legislação vigente',
          ].map((item) => (
            <div key={item} className="rounded-lg bg-primary/5 px-3 py-2 text-sm">
              {item}
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-900/10">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">
            Nenhum paciente terá benefício garantido automaticamente.
          </p>
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
            Toda concessão dependerá da análise de elegibilidade.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'revisao',
    icon: RefreshCw,
    titulo: '12. Revisão Periódica',
    conteudo: (
      <div className="space-y-4">
        <p>A permanência no programa poderá ser revista periodicamente mediante:</p>
        <ul className="space-y-2">
          {[
            'atualização da documentação',
            'confirmação dos critérios sociais',
            'manutenção da indicação médica',
            'disponibilidade orçamentária do programa',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm">
              <RefreshCw size={14} className="mt-1 shrink-0 text-primary" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    ),
  },
  {
    id: 'encerramento',
    icon: XCircle,
    titulo: '13. Encerramento da Participação',
    conteudo: (
      <div className="space-y-4">
        <p>O benefício poderá ser encerrado nas seguintes hipóteses:</p>
        <ul className="space-y-2">
          {[
            'solicitação do próprio paciente',
            'perda dos critérios de elegibilidade',
            'utilização inadequada do programa',
            'informações falsas',
            'descumprimento do regulamento',
            'encerramento do tratamento médico',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm">
              <XCircle size={14} className="mt-1 shrink-0 text-destructive" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    ),
  },
  {
    id: 'protecao-dados',
    icon: Lock,
    titulo: '14. Proteção de Dados',
    conteudo: (
      <div className="space-y-4">
        <p>
          Todos os dados pessoais e documentos serão tratados conforme a legislação aplicável de
          proteção de dados, sendo utilizados exclusivamente para a operacionalização do Programa
          de Acesso Solidário.
        </p>
        <div className="rounded-xl bg-muted/40 p-4">
          <p className="text-sm">
            Saiba mais em nossa{' '}
            <Link
              href="/politica-de-privacidade"
              className="font-medium text-primary underline underline-offset-4 hover:no-underline"
            >
              Política de Privacidade
            </Link>
            .
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'disposicoes-finais',
    icon: Gavel,
    titulo: '15. Disposições Finais',
    conteudo: (
      <div className="space-y-4">
        <p>
          O Programa de Acesso Solidário possui finalidade exclusivamente assistencial e social.
        </p>
        <p>
          A participação não gera direito adquirido à manutenção permanente do benefício.
        </p>
        <p>
          A aprovação estará sempre condicionada à análise técnica, social, documental e à
          disponibilidade de recursos do programa.
        </p>
        <div className="rounded-xl bg-primary/5 p-4">
          <p className="text-sm">
            A parceria entre a <strong className="text-foreground">Greens Pharmaceutical</strong>{' '}
            e a <strong className="text-foreground">Fundação Be4Hope</strong> tem como propósito
            ampliar o acesso responsável à medicina endocanabinoide, promovendo acolhimento,
            educação e suporte às famílias, sempre em conformidade com a legislação vigente e com
            elevados padrões de ética, transparência e responsabilidade social.
          </p>
        </div>
      </div>
    ),
  },
];

/* ── Componente ─────────────────────────────────────── */

export default function ProgramaAcessoSolidarioPage() {
  return (
    <div className="min-h-screen pb-16 pt-24">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-16">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-primary">
            Greens Pharmaceutical · Fundação Be4Hope
          </p>
          <h1 className="font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Programa de{' '}
            <span className="text-accent-italic">Acesso Solidário.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Uma parceria institucional entre a Greens Pharmaceutical e a Fundação Be4Hope para
            ampliar o acesso de pacientes em situação de vulnerabilidade social ou econômica a
            tratamentos com medicina endocanabinoide — com acesso responsável, ético e
            transparente.
          </p>
          <div className="mt-6 flex items-center gap-3 rounded-xl bg-primary/5 px-4 py-3">
            <HeartHandshake size={18} className="shrink-0 text-primary" />
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Regulamento Geral do Programa</strong> — leia
              atentamente antes de solicitar participação.
            </p>
          </div>
        </div>

        {/* Sumário */}
        <Card className="mb-12 border-0 shadow-sm">
          <CardContent className="p-6 sm:p-8">
            <h2 className="mb-4 font-display text-lg font-semibold">Sumário</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {SECOES.map((secao) => (
                <a
                  key={secao.id}
                  href={`#${secao.id}`}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <secao.icon size={14} className="shrink-0 text-primary" />
                  {secao.titulo}
                </a>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Seções */}
        <div className="space-y-10">
          {SECOES.map((secao) => (
            <section key={secao.id} id={secao.id} className="scroll-mt-24">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-6 sm:p-8">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                      <secao.icon size={20} className="text-primary" />
                    </div>
                    <h2 className="font-display text-xl font-bold tracking-tight">
                      {secao.titulo}
                    </h2>
                  </div>
                  <div className="prose-sm text-sm leading-relaxed text-muted-foreground [&_strong]:text-foreground">
                    {secao.conteudo}
                  </div>
                </CardContent>
              </Card>
            </section>
          ))}
        </div>

        {/* Aviso de elegibilidade */}
        <div className="mt-10 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-900/10">
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Nenhum paciente tem benefício garantido automaticamente. Toda concessão depende da
            análise de elegibilidade conduzida pela Fundação Be4Hope.
          </p>
        </div>

        {/* CTA final */}
        <Card className="mt-12 overflow-hidden border-0 shadow-lg">
          <div className="relative bg-gradient-to-br from-primary/90 via-primary to-primary/80 px-6 py-10 text-center text-white sm:px-12">
            <div
              className="absolute inset-0 opacity-[0.06]"
              style={{
                backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
                backgroundSize: '24px 24px',
              }}
            />
            <div className="relative">
              <HeartHandshake size={40} className="mx-auto mb-4 text-white/80" />
              <h2 className="font-display text-2xl font-bold sm:text-3xl">
                Quer solicitar participação?
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-white/70">
                Inicie a triagem social e clínica para verificar sua elegibilidade ao Programa de
                Acesso Solidário.
              </p>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <div className="flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2.5 text-sm backdrop-blur-sm">
                  <Mail size={14} />
                  tech@be4hope.org
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2.5 text-sm backdrop-blur-sm">
                  <Smartphone size={14} />
                  +55 (11) 93204-7360
                </div>
              </div>
              <div className="mt-6">
                <Link href="/triagem">
                  <Button
                    className="btn-pill gap-2 bg-white px-8 text-primary hover:bg-white/90"
                    nativeButton={false}
                  >
                    Iniciar triagem
                    <ChevronRight size={16} />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
