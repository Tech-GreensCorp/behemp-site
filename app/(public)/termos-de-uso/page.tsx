import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertCircle,
  BookOpen,
  ChevronRight,
  FileCheck,
  FileText,
  Gavel,
  Globe,
  Lock,
  Mail,
  RefreshCw,
  Scale,
  Shield,
  Smartphone,
  UserCheck,
  XCircle,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Termos de Uso — Be4Hope',
  description:
    'Leia os Termos de Uso da plataforma Be4Hope. Saiba seus direitos, responsabilidades e as condições de acesso aos nossos serviços de Medicina Endocanabinóide.',
};

/* ── Seções dos Termos ───────────────────────────────── */

interface Secao {
  id: string;
  icon: typeof Shield;
  titulo: string;
  conteudo: React.ReactNode;
}

const SECOES: Secao[] = [
  {
    id: 'aceitacao',
    icon: FileCheck,
    titulo: '1. Aceitação dos Termos',
    conteudo: (
      <div className="space-y-4">
        <p>
          Ao acessar e utilizar a plataforma <strong>Be4Hope</strong> — incluindo o site
          institucional, o sistema de triagem, a área restrita de pacientes e médicos ou qualquer
          outro serviço disponibilizado — você declara ter lido, compreendido e concordado com
          estes Termos de Uso.
        </p>
        <p>
          Caso não concorde com qualquer disposição destes Termos, você deve interromper
          imediatamente o uso da plataforma.
        </p>
        <div className="rounded-xl bg-primary/5 p-4">
          <p className="text-sm">
            <strong className="text-foreground">Nota importante:</strong> a Be4Hope é uma
            organização filantrópica sem fins lucrativos. Nossos serviços são prestados de forma
            gratuita como ato de cuidado e acolhimento. Estes Termos existem para proteger tanto
            os usuários quanto a missão da organização.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'servicos',
    icon: BookOpen,
    titulo: '2. Descrição dos Serviços',
    conteudo: (
      <div className="space-y-4">
        <p>A Be4Hope oferece, por meio desta plataforma, os seguintes serviços:</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { titulo: 'Triagem social e clínica', desc: 'Formulário de pré-avaliação para pacientes que buscam tratamento com Medicina Endocanabinóide' },
            { titulo: 'Agendamento de consultas', desc: 'Marcação de consultas médicas com profissionais credenciados pela organização' },
            { titulo: 'Acompanhamento clínico', desc: 'Prontuário digital, evolução clínica, controle de dosagem e histórico de tratamento' },
            { titulo: 'Gestão de documentos', desc: 'Armazenamento e controle de validade de documentos regulatórios (ANVISA, receitas, etc.)' },
            { titulo: 'Chat interno', desc: 'Canal de comunicação seguro entre paciente e médico dentro da plataforma' },
            { titulo: 'Recompra de medicamentos', desc: 'Solicitação de recompra com notificação automática à equipe clínica e administrativa' },
          ].map((item) => (
            <div key={item.titulo} className="rounded-xl bg-muted/40 p-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {item.titulo}
              </p>
              <p className="text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          A Be4Hope se reserva o direito de modificar, suspender ou descontinuar qualquer serviço
          a qualquer momento, mediante aviso prévio quando possível.
        </p>
      </div>
    ),
  },
  {
    id: 'elegibilidade',
    icon: UserCheck,
    titulo: '3. Elegibilidade e Cadastro',
    conteudo: (
      <div className="space-y-4">
        <p>Para utilizar os serviços da plataforma, o usuário deve:</p>
        <ul className="space-y-2">
          {[
            'Ter 18 anos ou mais, ou estar representado por responsável legal devidamente cadastrado',
            'Fornecer informações verdadeiras, completas e atualizadas no cadastro',
            'Possuir uma conta ativa e verificada no sistema de autenticação',
            'Utilizar os serviços exclusivamente para fins pessoais e de saúde, vedado o uso comercial',
            'Manter a confidencialidade de suas credenciais de acesso',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm">
              <FileCheck size={14} className="mt-1 shrink-0 text-primary" />
              {item}
            </li>
          ))}
        </ul>
        <p>
          A Be4Hope se reserva o direito de recusar ou cancelar cadastros que violem estes critérios
          ou que apresentem informações falsas, sem aviso prévio.
        </p>
      </div>
    ),
  },
  {
    id: 'responsabilidades-usuario',
    icon: UserCheck,
    titulo: '4. Responsabilidades do Usuário',
    conteudo: (
      <div className="space-y-4">
        <p>Ao usar a plataforma, o usuário se compromete a:</p>
        <ul className="space-y-2">
          {[
            'Não compartilhar suas credenciais de acesso com terceiros',
            'Não utilizar a plataforma para fins ilícitos, fraudulentos ou prejudiciais a outros',
            'Não tentar acessar áreas ou dados de outros usuários sem autorização',
            'Não reproduzir, copiar, distribuir ou explorar comercialmente qualquer conteúdo da plataforma',
            'Não inserir informações falsas, enganosas ou incompletas em formulários clínicos',
            'Notificar imediatamente a Be4Hope sobre qualquer uso não autorizado de sua conta',
            'Respeitar as orientações dos profissionais de saúde vinculados à plataforma',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm">
              <FileCheck size={14} className="mt-1 shrink-0 text-primary" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    ),
  },
  {
    id: 'saude',
    icon: AlertCircle,
    titulo: '5. Natureza dos Serviços de Saúde',
    conteudo: (
      <div className="space-y-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-900/10">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">
            ⚠️ Aviso Importante sobre Saúde
          </p>
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
            As informações disponibilizadas na plataforma não substituem consulta médica
            presencial, diagnóstico clínico ou prescrição de profissional habilitado.
          </p>
        </div>
        <p>
          Os serviços clínicos da Be4Hope são prestados por médicos devidamente registrados no
          Conselho Federal de Medicina (CFM) e credenciados pela organização. O tratamento com
          Medicina Endocanabinóide é regulamentada pela ANVISA e só pode ser prescrita por médico
          habilitado.
        </p>
        <ul className="space-y-2">
          {[
            'A Be4Hope não garante resultados específicos de tratamento',
            'A eficácia do tratamento depende de fatores individuais de cada paciente',
            'Eventuais reações adversas devem ser imediatamente comunicadas ao médico responsável',
            'O uso de Medicina Endocanabinóide fora da prescrição médica é de exclusiva responsabilidade do usuário',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm">
              <AlertCircle size={14} className="mt-1 shrink-0 text-amber-500" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    ),
  },
  {
    id: 'propriedade-intelectual',
    icon: Lock,
    titulo: '6. Propriedade Intelectual',
    conteudo: (
      <div className="space-y-4">
        <p>
          Todo o conteúdo disponibilizado na plataforma Be4Hope — incluindo textos, imagens, logotipos,
          layout, código-fonte, design, banco de dados, funcionalidades e identidade visual — é de
          propriedade exclusiva da Be4Hope ou está licenciado para uso pela organização.
        </p>
        <p>
          É expressamente vedado, sem autorização prévia por escrito:
        </p>
        <ul className="space-y-2">
          {[
            'Reproduzir ou copiar total ou parcialmente o conteúdo da plataforma',
            'Utilizar a marca, logotipo ou nome "Be4Hope" em qualquer contexto comercial',
            'Realizar engenharia reversa, descompilar ou extrair o código-fonte da plataforma',
            'Criar obras derivadas baseadas no conteúdo ou funcionalidades da plataforma',
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
    id: 'limitacao-responsabilidade',
    icon: Scale,
    titulo: '7. Limitação de Responsabilidade',
    conteudo: (
      <div className="space-y-4">
        <p>
          A Be4Hope não se responsabiliza por:
        </p>
        <ul className="space-y-2">
          {[
            'Interrupções, falhas técnicas ou indisponibilidade temporária da plataforma',
            'Danos resultantes do uso incorreto das informações disponibilizadas',
            'Decisões médicas tomadas com base em dados incorretos inseridos pelo usuário',
            'Conteúdos ou condutas de terceiros, incluindo médicos autônomos credenciados',
            'Perdas ou danos decorrentes de acesso não autorizado causado por falha do usuário em proteger suas credenciais',
            'Falhas em serviços de terceiros integrados (Clerk, Brevo, Pusher, Neon, Vercel)',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm">
              <Scale size={14} className="mt-1 shrink-0 text-muted-foreground" />
              {item}
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">
          A responsabilidade total da Be4Hope, em qualquer hipótese, está limitada à natureza
          gratuita e filantrópica dos serviços prestados.
        </p>
      </div>
    ),
  },
  {
    id: 'privacidade',
    icon: Shield,
    titulo: '8. Privacidade e Proteção de Dados',
    conteudo: (
      <div className="space-y-4">
        <p>
          O tratamento de seus dados pessoais é regido pela nossa{' '}
          <Link href="/politica-de-privacidade" className="font-medium text-primary underline underline-offset-4 hover:no-underline">
            Política de Privacidade
          </Link>
          , elaborada em conformidade com a{' '}
          <strong>Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018)</strong>.
        </p>
        <p>
          Ao aceitar estes Termos, você também concorda com a nossa Política de Privacidade,
          que faz parte integrante deste documento.
        </p>
        <div className="rounded-xl bg-muted/40 p-4">
          <p className="text-sm">
            Seus dados de saúde são classificados como <strong>dados sensíveis</strong> pela LGPD
            e recebem tratamento com nível elevado de proteção, incluindo criptografia em trânsito
            e em repouso, e controle de acesso por perfil.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'suspensao',
    icon: XCircle,
    titulo: '9. Suspensão e Encerramento',
    conteudo: (
      <div className="space-y-4">
        <p>
          A Be4Hope pode, a seu exclusivo critério, suspender ou encerrar o acesso de um usuário
          à plataforma, temporária ou definitivamente, nas seguintes situações:
        </p>
        <ul className="space-y-2">
          {[
            'Violação de qualquer disposição destes Termos de Uso',
            'Fornecimento de informações falsas ou enganosas',
            'Uso da plataforma para fins ilícitos ou prejudiciais',
            'Comportamento abusivo ou desrespeitoso com profissionais de saúde ou equipe administrativa',
            'Tentativa de acesso não autorizado a dados de outros usuários',
            'Inatividade prolongada da conta, a critério da organização',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm">
              <XCircle size={14} className="mt-1 shrink-0 text-destructive" />
              {item}
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">
          O usuário também pode solicitar o encerramento de sua conta a qualquer momento,
          entrando em contato pelos canais indicados ao final deste documento.
        </p>
      </div>
    ),
  },
  {
    id: 'alteracoes',
    icon: RefreshCw,
    titulo: '10. Alterações nos Termos',
    conteudo: (
      <div className="space-y-4">
        <p>
          A Be4Hope se reserva o direito de modificar estes Termos de Uso a qualquer momento.
          As alterações entram em vigor imediatamente após a publicação da versão atualizada
          nesta página.
        </p>
        <p>
          Sempre que houver alterações materiais, notificaremos os usuários ativos por e-mail
          e atualizaremos a data de última revisão no topo desta página.
        </p>
        <p>
          O uso continuado da plataforma após a publicação das alterações constitui aceitação
          automática dos novos Termos.
        </p>
      </div>
    ),
  },
  {
    id: 'lei-foro',
    icon: Gavel,
    titulo: '11. Lei Aplicável e Foro',
    conteudo: (
      <div className="space-y-4">
        <p>
          Estes Termos de Uso são regidos e interpretados de acordo com as leis da
          <strong> República Federativa do Brasil</strong>, especialmente:
        </p>
        <ul className="space-y-2">
          {[
            'Lei Geral de Proteção de Dados — LGPD (Lei nº 13.709/2018)',
            'Marco Civil da Internet (Lei nº 12.965/2014)',
            'Código de Defesa do Consumidor (Lei nº 8.078/1990) — quando aplicável',
            'Código Civil Brasileiro (Lei nº 10.406/2002)',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm">
              <Gavel size={14} className="mt-1 shrink-0 text-primary" />
              {item}
            </li>
          ))}
        </ul>
        <p>
          Fica eleito o foro da comarca de <strong>São Paulo/SP</strong> para dirimir quaisquer
          controvérsias decorrentes destes Termos, com renúncia expressa a qualquer outro,
          por mais privilegiado que seja.
        </p>
      </div>
    ),
  },
  {
    id: 'contato',
    icon: Globe,
    titulo: '12. Contato e Canal de Atendimento',
    conteudo: (
      <div className="space-y-4">
        <p>
          Para dúvidas, solicitações ou notificações relacionadas a estes Termos de Uso,
          entre em contato com nossa equipe:
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { titulo: 'Suporte geral', desc: 'tech@be4hope.org', icon: Mail },
            { titulo: 'Privacidade e LGPD', desc: 'privacidade@be4hope.org', icon: Shield },
            { titulo: 'WhatsApp', desc: '+55 (11) 93204-7360', icon: Smartphone },
            { titulo: 'Formulário online', desc: 'be4hope.org/contato', icon: Globe },
          ].map((item) => (
            <div key={item.titulo} className="rounded-xl bg-muted/40 p-4">
              <div className="mb-1 flex items-center gap-2">
                <item.icon size={13} className="text-primary" />
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {item.titulo}
                </p>
              </div>
              <p className="text-sm font-medium">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
];

/* ── Componente ─────────────────────────────────────── */

export default function TermosPage() {
  return (
    <div className="min-h-screen pb-16 pt-24">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-16">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-primary">
            Uso responsável da plataforma
          </p>
          <h1 className="font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Termos de{' '}
            <span className="text-accent-italic">Uso.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Leia atentamente antes de utilizar nossa plataforma. Estes termos definem as regras
            de uso dos serviços Be4Hope e os direitos e deveres de cada parte.
          </p>
          <div className="mt-6 flex items-center gap-3 rounded-xl bg-primary/5 px-4 py-3">
            <FileText size={18} className="shrink-0 text-primary" />
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Última atualização:</strong>{' '}
              12 de maio de 2026 &nbsp;·&nbsp;
              <Link href="/politica-de-privacidade" className="text-primary hover:underline">
                Ver Política de Privacidade →
              </Link>
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

        {/* CTA final */}
        <Card className="mt-16 overflow-hidden border-0 shadow-lg">
          <div
            className="relative bg-gradient-to-br from-primary/90 via-primary to-primary/80 px-6 py-10 text-center text-white sm:px-12"
          >
            <div
              className="absolute inset-0 opacity-[0.06]"
              style={{
                backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
                backgroundSize: '24px 24px',
              }}
            />
            <div className="relative">
              <Scale size={40} className="mx-auto mb-4 text-white/80" />
              <h2 className="font-display text-2xl font-bold sm:text-3xl">
                Dúvidas sobre os Termos?
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-white/70">
                Nossa equipe está disponível para esclarecer qualquer ponto deste documento.
                Entre em contato e responderemos em até 2 dias úteis.
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
                <Link href="/contato">
                  <Button
                    className="btn-pill gap-2 bg-white px-8 text-primary hover:bg-white/90"
                    nativeButton={false}
                  >
                    Fale conosco
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
