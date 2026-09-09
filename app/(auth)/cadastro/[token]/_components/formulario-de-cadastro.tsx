'use client';

/**
 * O FORMULÁRIO DO LINK QUE VEIO DO WHATSAPP.
 *
 * Duas etapas, e a divisão não é estética:
 *
 *   1. DADOS + SENHA  → cria a conta no Clerk (e-mail é o login)
 *   2. CÓDIGO         → confirma o e-mail e abre a sessão; só então a ficha é gravada
 *
 * 🔴 A FICHA CLÍNICA SÓ É GRAVADA DEPOIS DA SESSÃO EXISTIR.
 * Gravar antes deixaria no banco um paciente sem dono caso a verificação falhasse —
 * invisível para ele e para o médico. Do jeito atual, uma falha na etapa 2 não deixa
 * resíduo: o link continua válido e ele tenta de novo.
 *
 * 🔴 O E-MAIL QUE VALE É O CONFIRMADO. Ele chega pré-preenchido do bot, mas é editável:
 * o paciente pode ter ditado errado no WhatsApp, e é por este endereço que ele receberá
 * a consulta e a prescrição.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSignUp } from '@clerk/nextjs/legacy';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { cpfEhValido, formatarCpf, somenteDigitosDoCpf } from '@/lib/validacao/cpf';
import { concluirCadastroPorLink } from '@/app/_actions/cadastro-por-link';

interface Props {
  token: string;
  protocolo: string;
  nomeInicial: string | null;
  emailInicial: string | null;
  telefoneInicial: string | null;
}

/** `+5562988771234` → `(62) 98877-1234`. O paciente não reconhece o formato E.164. */
function formatarTelefoneParaTela(valor: string | null): string {
  if (!valor) return '';
  const d = valor.replace(/\D/g, '').replace(/^55/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return valor;
}

function mascararTelefoneDigitado(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Traduz o erro do Clerk. Mensagem em inglês numa tela de saúde é abandono. */
function traduzirErro(err: unknown): string {
  const e = err as { errors?: { code?: string; message?: string }[] };
  const codigo = e?.errors?.[0]?.code;
  const mensagem = e?.errors?.[0]?.message ?? '';

  const mapa: Record<string, string> = {
    form_identifier_exists: 'Já existe uma conta com este e-mail. Use a opção de entrar.',
    form_password_pwned:
      'Esta senha apareceu em vazamentos públicos. Escolha outra, por segurança.',
    form_password_length_too_short: 'A senha precisa ter pelo menos 8 caracteres.',
    form_password_validation_failed: 'Escolha uma senha mais forte.',
    form_code_incorrect: 'Código incorreto. Confira o e-mail e tente de novo.',
    verification_expired: 'O código expirou. Peça um novo.',
    form_param_format_invalid: 'Confira os dados digitados.',
  };
  if (codigo && mapa[codigo]) return mapa[codigo];
  if (/password/i.test(mensagem) && /8/.test(mensagem))
    return 'A senha precisa ter pelo menos 8 caracteres.';
  return 'Não conseguimos concluir agora. Confira os dados e tente novamente.';
}

export function FormularioDeCadastro({
  token,
  protocolo,
  nomeInicial,
  emailInicial,
  telefoneInicial,
}: Props) {
  const router = useRouter();
  const { isLoaded, signUp, setActive } = useSignUp();

  const [etapa, setEtapa] = useState<'dados' | 'codigo' | 'pronto'>('dados');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  const [nome, setNome] = useState(nomeInicial ?? '');
  const [cpf, setCpf] = useState('');
  const [telefone, setTelefone] = useState(formatarTelefoneParaTela(telefoneInicial));
  const [email, setEmail] = useState(emailInicial ?? '');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [verSenha, setVerSenha] = useState(false);
  const [jaFazTratamento, setJaFazTratamento] = useState<boolean | null>(null);
  const [tratamentoAtual, setTratamentoAtual] = useState('');
  const [codigo, setCodigo] = useState('');

  /**
   * O Clerk normalmente carrega em menos de um segundo. Passados oito, ou a chave
   * pública não está configurada no ambiente, ou a rede do paciente não alcança o
   * serviço. Nos dois casos ele precisa ouvir isso — em vez de encarar um botão
   * "Preparando…" que nunca muda.
   */
  const [demorouParaCarregar, setDemorouParaCarregar] = useState(false);
  useEffect(() => {
    if (isLoaded) return;
    const t = setTimeout(() => setDemorouParaCarregar(true), 8000);
    return () => clearTimeout(t);
  }, [isLoaded]);

  const campoCodigo = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (etapa === 'codigo') campoCodigo.current?.focus();
  }, [etapa]);

  const nomeValido = nome.trim().split(/\s+/).filter(Boolean).length >= 2;
  const cpfValido = cpfEhValido(cpf);
  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const telefoneValido = telefone.replace(/\D/g, '').length >= 10;
  const senhaValida = senha.length >= 8;
  const senhasConferem = senha.length > 0 && senha === confirmarSenha;
  // A pergunta clínica é obrigatória: `null` significa "não respondeu", e é o estado
  // que a ficha do médico não pode receber como se fosse "não".
  const tratamentoRespondido = jaFazTratamento !== null;

  const podeEnviar =
    nomeValido &&
    cpfValido &&
    emailValido &&
    telefoneValido &&
    senhaValida &&
    senhasConferem &&
    tratamentoRespondido;

  /** Força da senha, para dar retorno em vez de só recusar no envio. */
  const forcaDaSenha = useMemo(() => {
    let pontos = 0;
    if (senha.length >= 8) pontos++;
    if (senha.length >= 12) pontos++;
    if (/[a-z]/.test(senha) && /[A-Z]/.test(senha)) pontos++;
    if (/\d/.test(senha)) pontos++;
    if (/[^A-Za-z0-9]/.test(senha)) pontos++;
    return Math.min(pontos, 4);
  }, [senha]);

  async function criarConta(evento: React.FormEvent) {
    evento.preventDefault();
    if (!isLoaded || !podeEnviar) return;

    setCarregando(true);
    setErro('');

    const partes = nome.trim().split(/\s+/);
    try {
      await signUp.create({
        emailAddress: email.trim().toLowerCase(),
        password: senha,
        firstName: partes[0],
        lastName: partes.slice(1).join(' '),
      });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setEtapa('codigo');
    } catch (err) {
      setErro(traduzirErro(err));
    } finally {
      setCarregando(false);
    }
  }

  async function confirmarCodigo(evento: React.FormEvent) {
    evento.preventDefault();
    if (!isLoaded) return;

    setCarregando(true);
    setErro('');

    try {
      const conclusao = await signUp.attemptEmailAddressVerification({ code: codigo.trim() });
      if (conclusao.status !== 'complete') {
        setErro('A verificação não pôde ser concluída. Tente novamente.');
        return;
      }

      await setActive({ session: conclusao.createdSessionId });

      // Só agora a ficha existe — ver o bloco no topo do arquivo.
      const gravado = await concluirCadastroPorLink({
        token,
        nomeCompleto: nome.trim(),
        cpf: somenteDigitosDoCpf(cpf),
        telefone: telefone.trim(),
        email: email.trim().toLowerCase(),
        jaFazTratamento: jaFazTratamento === true,
        tratamentoAtual: jaFazTratamento ? tratamentoAtual.trim() : null,
      });

      if (!gravado.sucesso) {
        // A conta EXISTE e ele está logado. Mandá-lo de volta ao formulário seria pedir
        // que criasse a conta outra vez — o que falharia com "e-mail já cadastrado".
        setErro(
          `${gravado.erro} Sua conta já foi criada: entre com seu e-mail e complete o cadastro pelo painel.`,
        );
        return;
      }

      setEtapa('pronto');
      // O destino é agendar a teleconsulta: é para isso que ele veio.
      setTimeout(() => router.push('/paciente/teleconsulta'), 1400);
    } catch (err) {
      setErro(traduzirErro(err));
    } finally {
      setCarregando(false);
    }
  }

  async function reenviarCodigo() {
    if (!isLoaded) return;
    setErro('');
    try {
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
    } catch (err) {
      setErro(traduzirErro(err));
    }
  }

  return (
    <div className="relative mx-auto w-full max-w-xl">
      <Cabecalho protocolo={protocolo} etapa={etapa} />

      <div
        className={cn(
          'animate-fade-up border-border/60 bg-card/80 rounded-3xl border backdrop-blur-xl',
          // Sombra em duas camadas: um contorno de 1px e uma difusa e baixa. É o que dá
          // a sensação de peso sem a mancha cinzenta de uma `box-shadow` única.
          'shadow-[0_1px_2px_rgba(26,22,18,0.04),0_16px_40px_-16px_rgba(26,22,18,0.16)]',
          'p-6 sm:p-9',
        )}
      >
        {etapa === 'pronto' ? (
          <Concluido />
        ) : etapa === 'codigo' ? (
          <form onSubmit={confirmarCodigo} className="space-y-6">
            <div className="text-center">
              <div className="bg-primary/10 mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl">
                <Mail size={26} className="text-primary" strokeWidth={1.75} />
              </div>
              <h2 className="font-display text-xl font-semibold tracking-tight">
                Confirme seu e-mail
              </h2>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                Enviamos um código de 6 dígitos para{' '}
                <span className="text-foreground font-medium">{email}</span>.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="codigo">Código de verificação</Label>
              <Input
                id="codigo"
                ref={campoCodigo}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="h-14 rounded-xl text-center font-mono text-2xl tracking-[0.5em]"
              />
            </div>

            {erro && <Aviso texto={erro} />}

            <Button
              type="submit"
              disabled={carregando || codigo.length < 6}
              className="h-12 w-full rounded-xl text-base"
            >
              {carregando ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Confirmando…
                </>
              ) : (
                <>
                  Confirmar e continuar
                  <ArrowRight size={18} />
                </>
              )}
            </Button>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => {
                  setEtapa('dados');
                  setErro('');
                }}
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
              >
                <ArrowLeft size={14} />
                Corrigir meus dados
              </button>
              <button
                type="button"
                onClick={reenviarCodigo}
                className="text-primary font-medium transition-opacity hover:opacity-70"
              >
                Reenviar código
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={criarConta} className="space-y-7">
            <Secao titulo="Seus dados" icone={User}>
              <Campo
                id="nome"
                rotulo="Nome completo"
                valor={nome}
                aoMudar={setNome}
                placeholder="Como está no seu documento"
                autoComplete="name"
                valido={nomeValido}
                dica={nome.length > 0 && !nomeValido ? 'Informe nome e sobrenome' : undefined}
              />
              <Campo
                id="cpf"
                rotulo="CPF"
                valor={formatarCpf(cpf) === cpf ? cpf : cpf}
                aoMudar={(v) => setCpf(somenteDigitosDoCpf(v).slice(0, 11))}
                exibir={cpf.length === 11 ? formatarCpf(cpf) : cpf}
                placeholder="000.000.000-00"
                inputMode="numeric"
                valido={cpfValido}
                dica={
                  cpf.length === 11 && !cpfValido
                    ? 'Confira os números — este CPF não é válido'
                    : undefined
                }
              />
              <div className="grid gap-5 sm:grid-cols-2">
                <Campo
                  id="telefone"
                  rotulo="Telefone (WhatsApp)"
                  valor={telefone}
                  aoMudar={(v) => setTelefone(mascararTelefoneDigitado(v))}
                  placeholder="(00) 00000-0000"
                  inputMode="tel"
                  autoComplete="tel"
                  icone={Phone}
                  valido={telefoneValido}
                />
                <Campo
                  id="email"
                  rotulo="E-mail"
                  valor={email}
                  aoMudar={setEmail}
                  placeholder="voce@email.com"
                  type="email"
                  autoComplete="email"
                  icone={Mail}
                  valido={emailValido}
                  dica="Será o seu login"
                />
              </div>
            </Secao>

            <Separador />

            <Secao titulo="Crie sua senha" icone={Lock}>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="senha">Senha</Label>
                  <div className="relative">
                    <Input
                      id="senha"
                      type={verSenha ? 'text' : 'password'}
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      autoComplete="new-password"
                      placeholder="Mínimo de 8 caracteres"
                      className="h-12 rounded-xl pr-11"
                    />
                    <button
                      type="button"
                      onClick={() => setVerSenha((v) => !v)}
                      aria-label={verSenha ? 'Ocultar senha' : 'Mostrar senha'}
                      className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
                    >
                      {verSenha ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                  <MedidorDeSenha nivel={forcaDaSenha} ativo={senha.length > 0} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmar">Repita a senha</Label>
                  <Input
                    id="confirmar"
                    type={verSenha ? 'text' : 'password'}
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    autoComplete="new-password"
                    placeholder="Digite novamente"
                    className={cn(
                      'h-12 rounded-xl transition-shadow',
                      confirmarSenha.length > 0 &&
                        !senhasConferem &&
                        'border-destructive/60 focus-visible:ring-destructive/30',
                    )}
                  />
                  {confirmarSenha.length > 0 && !senhasConferem && (
                    <p className="text-destructive text-xs">As senhas não são iguais</p>
                  )}
                </div>
              </div>
            </Secao>

            <Separador />

            <Secao titulo="Sobre o seu tratamento" icone={Sparkles}>
              <fieldset className="space-y-3">
                <legend className="text-muted-foreground mb-3 text-sm">
                  Você já faz tratamento com cannabis medicinal?
                </legend>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { valor: true, rotulo: 'Sim, já faço' },
                    { valor: false, rotulo: 'Ainda não' },
                  ].map((opcao) => {
                    const escolhido = jaFazTratamento === opcao.valor;
                    return (
                      <button
                        key={String(opcao.valor)}
                        type="button"
                        onClick={() => setJaFazTratamento(opcao.valor)}
                        aria-pressed={escolhido}
                        className={cn(
                          'group relative flex h-12 items-center justify-center gap-2 rounded-xl border text-sm font-medium',
                          'transition-all duration-300 ease-out',
                          escolhido
                            ? 'border-primary bg-primary/10 text-foreground shadow-[0_0_0_3px_rgba(234,84,41,0.10)]'
                            : 'border-border bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground',
                        )}
                      >
                        {escolhido && <CheckCircle2 size={15} className="text-primary" />}
                        {opcao.rotulo}
                      </button>
                    );
                  })}
                </div>

                {/*
                  A caixa de texto cresce quando ele diz "sim". Renderizar sempre e
                  esconder por CSS deixaria um campo obrigatório invisível no DOM; e
                  perguntar antes da resposta é ruído.
                */}
                <div
                  className={cn(
                    'grid transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]',
                    jaFazTratamento === true
                      ? 'grid-rows-[1fr] opacity-100'
                      : 'grid-rows-[0fr] opacity-0',
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="space-y-2 pt-3">
                      <Label htmlFor="tratamento">Conte qual tratamento você faz hoje</Label>
                      <Textarea
                        id="tratamento"
                        value={tratamentoAtual}
                        onChange={(e) => setTratamentoAtual(e.target.value)}
                        placeholder="Ex.: uso óleo de CBD 20mg, 3 gotas à noite, há 6 meses. Se souber a marca ou quem prescreveu, ajuda bastante."
                        rows={4}
                        maxLength={2000}
                        className="resize-none rounded-xl leading-relaxed"
                      />
                      <p className="text-muted-foreground text-xs">
                        Essas informações vão direto para o médico que vai te atender.
                      </p>
                    </div>
                  </div>
                </div>
              </fieldset>
            </Secao>

            {/*
              🔴 ONDE O CLERK DESENHA O CAPTCHA. Sem este elemento no DOM, o
              `signUp.create` avisa no console que não achou `clerk-captcha` e cai para o
              CAPTCHA invisível — que decide sozinho, sem dar ao paciente nenhuma forma de
              provar que é humano. Num fluxo customizado como este, é o desenvolvedor que
              precisa reservar o lugar; o `/registrar-se` já fazia isso e este formulário
              não fazia.
              Fica ANTES do botão de propósito: quando o desafio aparece, ele precisa estar
              visível na tela, não abaixo da dobra.
            */}
            <div id="clerk-captcha" className="empty:hidden" />

            {erro && <Aviso texto={erro} />}
            {demorouParaCarregar && !isLoaded && (
              <Aviso texto="O serviço de contas não respondeu. Recarregue a página — se continuar assim, fale com a gente pelo WhatsApp." />
            )}

            <div className="space-y-4">
              <Button
                type="submit"
                /*
                  🔴 `!isLoaded` ENTRA NO DISABLED, e não só no early-return do handler.
                  Sem isto o botão fica clicável enquanto o Clerk não terminou de carregar
                  — o paciente clica, nada acontece, e ele conclui que o site está quebrado.
                  Um clique sem resposta é pior que um botão desabilitado, porque não diz
                  que está esperando.
                */
                disabled={!isLoaded || carregando || !podeEnviar}
                className="h-12 w-full rounded-xl text-base transition-transform duration-200 active:scale-[0.985]"
              >
                {!isLoaded ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Preparando…
                  </>
                ) : carregando ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Criando sua conta…
                  </>
                ) : (
                  <>
                    Criar conta e agendar consulta
                    <ArrowRight size={18} />
                  </>
                )}
              </Button>

              <p className="text-muted-foreground flex items-start justify-center gap-2 text-center text-xs leading-relaxed">
                <ShieldCheck size={14} className="text-secondary mt-0.5 shrink-0" />
                <span>
                  Seus dados de saúde são tratados com sigilo médico e usados apenas no seu
                  atendimento.
                </span>
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/* ── Peças ─────────────────────────────────────────────────────────────────────── */

function Cabecalho({ protocolo, etapa }: { protocolo: string; etapa: string }) {
  const passo = etapa === 'dados' ? 1 : etapa === 'codigo' ? 2 : 3;
  return (
    <div className="animate-fade-up mb-7 text-center">
      <span className="eyebrow">Protocolo {protocolo}</span>
      <h1 className="font-display text-foreground mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
        {etapa === 'pronto' ? (
          'Tudo certo!'
        ) : (
          <>
            Falta pouco para sua <span className="text-accent-italic">consulta</span>
          </>
        )}
      </h1>
      <p className="text-muted-foreground mx-auto mt-3 max-w-md text-sm leading-relaxed">
        {etapa === 'dados'
          ? 'Preencha seus dados para criar sua conta e agendar a teleconsulta com um médico prescritor.'
          : etapa === 'codigo'
            ? 'Só falta confirmar seu e-mail.'
            : 'Estamos abrindo sua agenda de consultas.'}
      </p>

      {/* Progresso: a barra preenche de forma contínua em vez de saltar entre pontos. */}
      <div className="mx-auto mt-6 flex max-w-[220px] items-center gap-2" aria-hidden>
        {[1, 2, 3].map((n) => (
          <div key={n} className="bg-border h-1 flex-1 overflow-hidden rounded-full">
            <div
              className="bg-primary h-full rounded-full transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{ width: passo >= n ? '100%' : '0%' }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function Secao({
  titulo,
  icone: Icone,
  children,
}: {
  titulo: string;
  icone: typeof User;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-5">
      <div className="flex items-center gap-2.5">
        <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-lg">
          <Icone size={15} className="text-secondary" strokeWidth={2} />
        </div>
        <h2 className="font-heading text-foreground text-sm font-semibold tracking-tight">
          {titulo}
        </h2>
      </div>
      {children}
    </section>
  );
}

function Separador() {
  return (
    <div className="via-border h-px w-full bg-gradient-to-r from-transparent to-transparent" />
  );
}

function Campo({
  id,
  rotulo,
  valor,
  exibir,
  aoMudar,
  placeholder,
  type = 'text',
  inputMode,
  autoComplete,
  icone: Icone,
  valido,
  dica,
}: {
  id: string;
  rotulo: string;
  valor: string;
  exibir?: string;
  aoMudar: (v: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: 'numeric' | 'tel' | 'text';
  autoComplete?: string;
  icone?: typeof User;
  valido?: boolean;
  dica?: string;
}) {
  const preenchido = valor.length > 0;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{rotulo}</Label>
      <div className="relative">
        {Icone && (
          <Icone
            size={16}
            className="text-muted-foreground absolute top-1/2 left-3.5 -translate-y-1/2"
          />
        )}
        <Input
          id={id}
          type={type}
          inputMode={inputMode}
          autoComplete={autoComplete}
          value={exibir ?? valor}
          onChange={(e) => aoMudar(e.target.value)}
          placeholder={placeholder}
          className={cn(
            'h-12 rounded-xl transition-all duration-300',
            Icone && 'pl-10',
            preenchido && valido && 'border-secondary/40',
            preenchido && valido === false && 'border-destructive/50',
          )}
        />
        {/* O certo só aparece quando há o que confirmar — decoração constante vira ruído. */}
        {preenchido && valido && (
          <CheckCircle2
            size={16}
            className="animate-fade-in text-secondary absolute top-1/2 right-3.5 -translate-y-1/2"
          />
        )}
      </div>
      {dica && (
        <p
          className={cn(
            'text-xs',
            valido === false && preenchido ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {dica}
        </p>
      )}
    </div>
  );
}

function MedidorDeSenha({ nivel, ativo }: { nivel: number; ativo: boolean }) {
  const rotulos = ['Muito fraca', 'Fraca', 'Razoável', 'Boa', 'Forte'];
  return (
    <div
      className={cn(
        'space-y-1.5 transition-opacity duration-300',
        ativo ? 'opacity-100' : 'opacity-0',
      )}
    >
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              'h-1 flex-1 rounded-full transition-all duration-500',
              i < nivel
                ? nivel <= 1
                  ? 'bg-destructive'
                  : nivel === 2
                    ? 'bg-primary'
                    : 'bg-secondary'
                : 'bg-border',
            )}
          />
        ))}
      </div>
      <p className="text-muted-foreground text-xs">{rotulos[nivel]}</p>
    </div>
  );
}

function Aviso({ texto }: { texto: string }) {
  return (
    <div
      role="alert"
      className="animate-fade-in border-destructive/25 bg-destructive/5 text-destructive rounded-xl border px-4 py-3 text-sm leading-relaxed"
    >
      {texto}
    </div>
  );
}

function Concluido() {
  return (
    <div className="animate-fade-up py-8 text-center">
      <div className="bg-secondary/10 mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl">
        <CheckCircle2 size={30} className="text-secondary" strokeWidth={1.75} />
      </div>
      <h2 className="font-display text-2xl font-semibold tracking-tight">Cadastro concluído</h2>
      <p className="text-muted-foreground mx-auto mt-3 max-w-sm text-sm leading-relaxed">
        Estamos abrindo sua agenda para você escolher o horário da teleconsulta.
      </p>
      <Loader2 size={22} className="text-primary mx-auto mt-6 animate-spin" />
    </div>
  );
}
