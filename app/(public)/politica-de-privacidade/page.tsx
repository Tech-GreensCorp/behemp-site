import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  ChevronRight,
  Database,
  Eye,
  FileCheck,
  Lock,
  Mail,
  MessageSquare,
  Shield,
  ShieldCheck,
  Smartphone,
  Trash2,
  UserCheck,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Política de Privacidade — Be4Hope',
  description:
    'Conheça a Política de Privacidade da Be4Hope. Saiba como seus dados pessoais e clínicos são coletados, armazenados e protegidos, em conformidade com a LGPD.',
};

/* ── Seções da política ─────────────────────────────── */

interface Secao {
  id: string;
  icon: typeof Shield;
  titulo: string;
  conteudo: React.ReactNode;
}

const SECOES: Secao[] = [
  {
    id: 'introducao',
    icon: ShieldCheck,
    titulo: '1. Introdução',
    conteudo: (
      <div className="space-y-4">
        <p>
          A <strong>Be4Hope</strong> (&ldquo;nós&rdquo;, &ldquo;nosso&rdquo; ou &ldquo;organização&rdquo;)
          é uma organização filantrópica sem fins lucrativos, atuante desde 2004 no acolhimento de
          pacientes e famílias que buscam tratamentos com Medicina Endocanabinóide.
        </p>
        <p>
          Esta Política de Privacidade descreve como coletamos, utilizamos, armazenamos e protegemos
          suas informações pessoais quando você acessa nosso site, preenche formulários, utiliza nossos
          serviços clínicos ou se comunica conosco por qualquer canal.
        </p>
        <p>
          Ao utilizar nossos serviços, você concorda com as práticas aqui descritas, em conformidade com
          a <strong>Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018)</strong>.
        </p>
      </div>
    ),
  },
  {
    id: 'dados-coletados',
    icon: Database,
    titulo: '2. Dados que coletamos',
    conteudo: (
      <div className="space-y-4">
        <p>
          Podemos coletar as seguintes categorias de dados pessoais, de acordo com a finalidade do
          serviço utilizado:
        </p>

        <div className="space-y-3">
          <div className="rounded-xl bg-muted/40 p-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Dados de identificação
            </p>
            <p className="text-sm">
              Nome completo, CPF, data de nascimento, endereço, CEP, estado, telefone, e-mail.
            </p>
          </div>

          <div className="rounded-xl bg-muted/40 p-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Dados clínicos (sensíveis)
            </p>
            <p className="text-sm">
              Diagnóstico principal, histórico de tratamentos, medicamentos em uso, relatório médico,
              peso, altura, evolução clínica, dosagens e resultados de exames.
            </p>
          </div>

          <div className="rounded-xl bg-muted/40 p-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Dados socioeconômicos
            </p>
            <p className="text-sm">
              Renda familiar, composição familiar, condição de moradia, programas sociais,
              situação de trabalho e despesas médicas — usados exclusivamente para avaliação social
              na triagem.
            </p>
          </div>

          <div className="rounded-xl bg-muted/40 p-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Dados de acesso e autenticação
            </p>
            <p className="text-sm">
              Endereço de e-mail, foto de perfil (quando fornecida), dados de sessão de login
              e informações de autenticação gerenciadas pelo serviço Clerk.
            </p>
          </div>

          <div className="rounded-xl bg-muted/40 p-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Dados de comunicação
            </p>
            <p className="text-sm">
              Mensagens trocadas via chat interno da plataforma, formulários de contato,
              e notificações enviadas por e-mail.
            </p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'finalidade',
    icon: Eye,
    titulo: '3. Para que utilizamos seus dados',
    conteudo: (
      <div className="space-y-4">
        <p>Os dados coletados são utilizados exclusivamente para as seguintes finalidades:</p>
        <ul className="space-y-2">
          {[
            'Realizar triagem social e médica para avaliação do paciente',
            'Agendar e gerenciar consultas médicas',
            'Emitir receitas, prescrições e documentos clínicos',
            'Controlar dosagens e acompanhamento de tratamento',
            'Gerar notificações sobre vencimento de documentos e recompra de medicamentos',
            'Comunicação entre médico e paciente via chat interno',
            'Enviar notificações por e-mail (Brevo) sobre seu tratamento',
            'Gerar relatórios administrativos e auditorias internas',
            'Cumprir obrigações legais junto à Anvisa e outros órgãos reguladores',
            'Melhorar a qualidade dos nossos serviços',
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
    id: 'base-legal',
    icon: FileCheck,
    titulo: '4. Base legal para tratamento',
    conteudo: (
      <div className="space-y-4">
        <p>
          Os tratamentos de dados realizados pela Be4Hope fundamentam-se nas seguintes bases legais
          previstas na LGPD:
        </p>
        <ul className="space-y-2">
          {[
            { base: 'Consentimento (Art. 7º, I)', desc: 'quando você preenche formulários e aceita nossos termos' },
            { base: 'Tutela da saúde (Art. 7º, VIII)', desc: 'para tratamentos e prontuários clínicos' },
            { base: 'Proteção da vida (Art. 7º, VII)', desc: 'quando os dados são necessários para proteger a vida ou incolumidade física' },
            { base: 'Obrigação legal (Art. 7º, II)', desc: 'para cumprimento de regulamentações da Anvisa' },
            { base: 'Interesse legítimo (Art. 7º, IX)', desc: 'para melhorias operacionais e comunicações administrativas' },
          ].map((item) => (
            <li key={item.base} className="flex items-start gap-2.5 text-sm">
              <Shield size={14} className="mt-1 shrink-0 text-primary" />
              <span>
                <strong>{item.base}:</strong> {item.desc}
              </span>
            </li>
          ))}
        </ul>
        <p>
          Para dados sensíveis de saúde, utilizamos a base legal de{' '}
          <strong>tutela da saúde</strong>, conforme Art. 11, II, &ldquo;f&rdquo; da LGPD,
          em procedimentos realizados por profissionais de saúde.
        </p>
      </div>
    ),
  },
  {
    id: 'compartilhamento',
    icon: UserCheck,
    titulo: '5. Compartilhamento de dados',
    conteudo: (
      <div className="space-y-4">
        <p>
          Seus dados pessoais <strong>nunca são vendidos</strong> a terceiros. O compartilhamento ocorre
          apenas nas seguintes situações:
        </p>
        <ul className="space-y-2">
          {[
            'Médicos credenciados da plataforma — acesso restrito aos dados clínicos dos pacientes vinculados',
            'Provedores de infraestrutura — servidores e banco de dados hospedados na Neon (PostgreSQL), com criptografia em trânsito e em repouso',
            'Autenticação — Clerk, responsável pelo gerenciamento seguro de login e sessões',
            'E-mail transacional — Brevo (ex-Sendinblue), para envio de notificações e comunicações do tratamento',
            'Chat em tempo real — Pusher, para transmissão segura de mensagens entre paciente e médico',
            'Órgãos reguladores — Anvisa, quando exigido por determinação legal',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm">
              <FileCheck size={14} className="mt-1 shrink-0 text-primary" />
              {item}
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">
          Todos os terceiros mencionados possuem contratos de proteção de dados e seguem padrões
          de segurança compatíveis com a LGPD e regulamentações internacionais (GDPR).
        </p>
      </div>
    ),
  },
  {
    id: 'seguranca',
    icon: Lock,
    titulo: '6. Segurança dos dados',
    conteudo: (
      <div className="space-y-4">
        <p>
          Adotamos medidas técnicas e organizacionais para proteger seus dados contra acesso não
          autorizado, perda, alteração ou destruição:
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { titulo: 'Criptografia', desc: 'Dados transmitidos via HTTPS/TLS e armazenados com criptografia em repouso' },
            { titulo: 'Controle de acesso', desc: 'Autenticação multifator e controle de permissões por perfil (admin, médico, paciente)' },
            { titulo: 'Auditoria', desc: 'Sistema de logs de auditoria para rastreio de acessos e alterações em dados sensíveis' },
            { titulo: 'Backups', desc: 'Backups automáticos e regulares do banco de dados com retenção segura' },
          ].map((item) => (
            <div key={item.titulo} className="rounded-xl bg-muted/40 p-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {item.titulo}
              </p>
              <p className="text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'direitos',
    icon: UserCheck,
    titulo: '7. Seus direitos (LGPD)',
    conteudo: (
      <div className="space-y-4">
        <p>
          Como titular dos dados, você possui os seguintes direitos, que podem ser exercidos a
          qualquer momento:
        </p>
        <ul className="space-y-2">
          {[
            'Confirmar a existência de tratamento de dados pessoais',
            'Acessar os dados pessoais que possuímos sobre você',
            'Corrigir dados incompletos, inexatos ou desatualizados',
            'Solicitar a anonimização, bloqueio ou eliminação de dados desnecessários',
            'Solicitar a portabilidade de seus dados',
            'Revogar o consentimento dado anteriormente',
            'Obter informações sobre entidades com as quais compartilhamos seus dados',
            'Apresentar reclamação à Autoridade Nacional de Proteção de Dados (ANPD)',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm">
              <FileCheck size={14} className="mt-1 shrink-0 text-primary" />
              {item}
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">
          Para exercer qualquer direito, entre em contato conosco pelo e-mail{' '}
          <strong className="text-foreground">privacidade@be4hope.org</strong> ou pelos canais de
          atendimento.
        </p>
      </div>
    ),
  },
  {
    id: 'retencao',
    icon: Trash2,
    titulo: '8. Retenção e exclusão',
    conteudo: (
      <div className="space-y-4">
        <p>
          Os dados pessoais são mantidos pelo tempo necessário para cumprir as finalidades para as
          quais foram coletados, incluindo obrigações legais e regulatórias:
        </p>
        <ul className="space-y-2">
          {[
            'Dados clínicos: mínimo de 20 anos, conforme resolução do Conselho Federal de Medicina (CFM)',
            'Dados de triagem social: mantidos enquanto houver vínculo com a organização',
            'Dados de autenticação: mantidos enquanto a conta estiver ativa',
            'Dados de comunicação (chat): mantidos por 5 anos após o encerramento do tratamento',
            'Logs de auditoria: mantidos por 5 anos para fins de conformidade e segurança',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm">
              <FileCheck size={14} className="mt-1 shrink-0 text-primary" />
              {item}
            </li>
          ))}
        </ul>
        <p>
          Após o período de retenção, os dados são anonimizados ou eliminados de forma segura.
          Dados utilizados para fins estatísticos são anonimizados e não permitem identificação
          individual.
        </p>
      </div>
    ),
  },
  {
    id: 'cookies',
    icon: Eye,
    titulo: '9. Cookies e tecnologias semelhantes',
    conteudo: (
      <div className="space-y-4">
        <p>
          Utilizamos cookies e tecnologias semelhantes para melhorar sua experiência:
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { titulo: 'Cookies essenciais', desc: 'Necessários para autenticação e funcionamento básico da plataforma' },
            { titulo: 'Cookies de sessão', desc: 'Gerenciados pelo Clerk para manter sua sessão ativa com segurança' },
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
          Não utilizamos cookies de marketing, rastreamento ou publicidade. A Be4Hope não exibe
          anúncios e não rastreia seu comportamento para fins comerciais.
        </p>
      </div>
    ),
  },
  {
    id: 'menores',
    icon: Shield,
    titulo: '10. Dados de menores de idade',
    conteudo: (
      <div className="space-y-4">
        <p>
          Quando o paciente for menor de 18 anos, o tratamento de dados será realizado mediante
          consentimento expresso do responsável legal, conforme Art. 14 da LGPD.
        </p>
        <p>
          Os dados do responsável (nome, CPF) são coletados na triagem para esse fim, garantindo
          a legalidade do processo.
        </p>
      </div>
    ),
  },
  {
    id: 'alteracoes',
    icon: MessageSquare,
    titulo: '11. Alterações nesta política',
    conteudo: (
      <div className="space-y-4">
        <p>
          Esta Política de Privacidade pode ser atualizada periodicamente para refletir mudanças
          nas nossas práticas ou na legislação aplicável.
        </p>
        <p>
          Sempre que houver alterações significativas, notificaremos os usuários cadastrados por
          e-mail e atualizaremos a data de última revisão no topo desta página.
        </p>
        <p className="text-sm text-muted-foreground">
          Recomendamos revisitar esta página periodicamente para se manter informado.
        </p>
      </div>
    ),
  },
];

/* ── Componente ─────────────────────────────────────── */

export default function PrivacidadePage() {
  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-16">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-primary">
            Transparência e segurança
          </p>
          <h1 className="font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Política de{' '}
            <span className="text-accent-italic">Privacidade.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Sua privacidade é prioridade. Aqui explicamos de forma clara e transparente como
            tratamos seus dados pessoais e clínicos, em total conformidade com a LGPD.
          </p>
          <div className="mt-6 flex items-center gap-3 rounded-xl bg-primary/5 px-4 py-3">
            <Lock size={18} className="shrink-0 text-primary" />
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Última atualização:</strong>{' '}
              11 de maio de 2026
            </p>
          </div>
        </div>

        {/* Sumário rápido */}
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

        {/* Seções da política */}
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

        {/* Contato DPO */}
        <Card className="mt-16 overflow-hidden border-0 shadow-lg">
          <div className="relative bg-gradient-to-br from-primary/90 via-primary to-primary/80 px-6 py-10 text-center text-white sm:px-12">
            <div className="absolute inset-0 opacity-[0.06]" style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
              backgroundSize: '24px 24px',
            }} />
            <div className="relative">
              <Shield size={40} className="mx-auto mb-4 text-white/80" />
              <h2 className="font-display text-2xl font-bold sm:text-3xl">
                Dúvidas sobre privacidade?
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-white/70">
                Se você tem qualquer dúvida, reclamação ou deseja exercer seus direitos como
                titular de dados, entre em contato com nosso encarregado de proteção de dados (DPO).
              </p>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <div className="flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2.5 text-sm backdrop-blur-sm">
                  <Mail size={14} />
                  privacidade@be4hope.org
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
