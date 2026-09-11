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
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { destinoDepoisDoCadastro, textosDoDestino } from '@/lib/parceiros/destino-do-paciente';
import { useSignUp } from '@clerk/nextjs/legacy';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  Lock,
  Mail,
  Check,
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
import { ConsentimentoDoCompartilhamento } from '@/components/paciente/ConsentimentoDoCompartilhamento';
import type { Finalidade } from '@/lib/parceiros/consentimento';

interface Props {
  token: string;
  protocolo: string;
  /** O que o parceiro ainda não tem. Aparece como aviso — nunca bloqueia (ADR-0016 D-06). */
  pendencias?: {
    chave: string;
    rotulo: string;
    opcional: boolean;
    resolvemosAqui: boolean;
  }[];
  /**
   * O que o parceiro JÁ mandou. Aparece confirmado — quem subiu RG e comprovante no
   * formulário da Greens precisa ver que chegou, senão para no meio e liga para perguntar.
   */
  recebidos?: {
    chave: string;
    rotulo: string;
    opcional: boolean;
    resolvemosAqui: boolean;
  }[];
  /** Destino de volta, já conferido contra a lista de origens permitidas. */
  urlDeRetorno?: string | null;
  nomeInicial: string | null;
  emailInicial: string | null;
  telefoneInicial: string | null;
  /** Só chega preenchido quando veio do parceiro — o bot do WhatsApp não pede CPF. */
  cpfInicial?: string | null;
  /**
   * 🔴 QUEM VEIO DO FORMULÁRIO DO PARCEIRO NÃO DIGITA NADA DE NOVO.
   *
   * Ele já preencheu nome, CPF, telefone e e-mail lá. A tela CONFIRMA o que chegou e pede só o
   * que ainda não existe: a senha, e depois o código do e-mail. Pedir tudo outra vez é fazer o
   * trabalho duas vezes, e é onde se perde gente no meio do cadastro.
   *
   * ⚠️ Confirmar não é esconder: os dados aparecem, e há um "corrigir" ao lado. Se a Greens
   * mandou um telefone errado, o paciente precisa poder consertar — senão o erro vira
   * definitivo justamente no cadastro que deveria simplificar a vida dele.
   */
  veioDeParceiro?: boolean;
  /**
   * 🔴 ELE JÁ RESPONDEU SOBRE A ANVISA NO FORMULÁRIO DO PARCEIRO.
   *
   * Quando verdadeiro, a pergunta não aparece — a resposta já existe, e pedi-la de novo é
   * fazer o paciente responder duas vezes a mesma coisa. Apontado pelo dono em 10/09/2026:
   * "lá ele já marcou a opção que não tem anvisa, então já vem, não precisa perguntá-lo
   * novamente".
   */
  jaDeclarouSobreAnvisa?: boolean;
}

/**
 * Converte o arquivo escolhido em base64 para viajar na Server Action.
 *
 * ⚠️ Vai no payload em vez de num endpoint de upload porque, neste momento, o paciente ainda
 * NÃO TEM SESSÃO — a conta nasce no fim do mesmo ato. Um endpoint aberto a quem não tem sessão
 * seria um lugar para qualquer um despejar arquivo; aqui o token de uso único do link é a
 * credencial, e ela já é conferida.
 */
async function lerAnexos(mapa: Record<string, File>) {
  const lidos = [];
  for (const [tipo, arquivo] of Object.entries(mapa)) {
    const um = await lerAnexo(arquivo);
    if (um) lidos.push({ tipo: tipo as never, ...um });
  }
  return lidos;
}

async function lerAnexo(arquivo: File | null) {
  if (!arquivo) return null;
  const buffer = await arquivo.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binario = '';
  for (let i = 0; i < bytes.byteLength; i += 1) binario += String.fromCharCode(bytes[i]);
  return {
    nomeArquivo: arquivo.name,
    tipoMime: arquivo.type,
    conteudoBase64: btoa(binario),
  };
}

/** Uma linha de dado já confirmado: rótulo à esquerda, valor à direita. */
function LinhaConfirmada({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-muted-foreground text-xs">{rotulo}</span>
      <span className="text-foreground text-sm font-medium">{valor}</span>
    </div>
  );
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
  pendencias = [],
  recebidos = [],
  urlDeRetorno = null,
  nomeInicial,
  emailInicial,
  telefoneInicial,
  cpfInicial = null,
  veioDeParceiro = false,
  jaDeclarouSobreAnvisa = false,
}: Props) {
  const router = useRouter();
  const { isLoaded, signUp, setActive } = useSignUp();

  /**
   * Os quatro campos que o formulário do parceiro já coletou. Se os quatro vieram, a tela
   * confirma em vez de pedir — e `corrigindo` devolve os campos editáveis quando o paciente
   * clica em "corrigir".
   */
  const dadosVieramDoParceiro = Boolean(
    veioDeParceiro && nomeInicial && emailInicial && telefoneInicial && cpfInicial,
  );
  const [corrigindo, setCorrigindo] = useState(false);

  const confirmandoDados = dadosVieramDoParceiro && !corrigindo;

  const [etapa, setEtapa] = useState<'dados' | 'codigo' | 'pronto'>('dados');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  const [nome, setNome] = useState(nomeInicial ?? '');
  const [cpf, setCpf] = useState(cpfInicial ? formatarCpf(cpfInicial) : '');
  const [telefone, setTelefone] = useState(formatarTelefoneParaTela(telefoneInicial));
  const [email, setEmail] = useState(emailInicial ?? '');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [verSenha, setVerSenha] = useState(false);
  const [jaFazTratamento, setJaFazTratamento] = useState<boolean | null>(null);

  /**
   * 🔴 A PERGUNTA DA ANVISA — e por que ela só aparece quando a autorização falta.
   *
   * Quem chegou pelo parceiro com a autorização já enviada não deve ser perguntado: a
   * resposta já existe, e perguntar de novo é desconfiar do que ele acabou de mandar.
   *
   * E a resposta "não tenho" vale por si: é ela que permite, depois da consulta, oferecer a
   * procuração sem precisar perguntar outra vez.
   */
  const [temAnvisa, setTemAnvisa] = useState<boolean | null>(null);
  /**
   * 🔴 A MESMA PERGUNTA, PARA A RECEITA — e ela decide para onde ele vai.
   *
   * O bot não sabe o que o paciente já tem. Sem perguntar, consideramos que falta tudo e o
   * destino vira sempre o agendamento — inclusive para quem só precisa da procuração e já tem
   * receita válida. Era o buraco do fluxo BeHemp 1.
   */
  const [temReceita, setTemReceita] = useState<boolean | null>(null);

  /**
   * 🔴 UM MAPA, NÃO UM ESTADO POR DOCUMENTO.
   *
   * Cinco dos oito fluxos pedem o "formulário completo", com os cinco documentos. Cinco
   * estados nomeados viram cinco lugares para esquecer um — e o esquecido some em silêncio,
   * porque anexo que não sobe não dá erro: vira pendência.
   */
  const [anexos, setAnexos] = useState<Record<string, File>>({});
  const escolherAnexo = (tipo: string, arquivo: File | null) => {
    setErroDoAnexo('');
    if (arquivo && arquivo.size > 8 * 1024 * 1024) {
      setErroDoAnexo('O arquivo passa de 8 MB. Tente uma foto menor ou um PDF.');
      return;
    }
    setAnexos((atual) => {
      const proximo = { ...atual };
      if (arquivo) proximo[tipo] = arquivo;
      else delete proximo[tipo];
      return proximo;
    });
  };
  const [erroDoAnexo, setErroDoAnexo] = useState('');
  /**
   * A pergunta só faz sentido quando a autorização falta **e** ninguém já perguntou.
   *
   * Quem veio do formulário do parceiro já declarou lá — e a pendência aqui é justamente a
   * consequência daquela resposta, não uma dúvida nova.
   */
  const perguntarSobreAnvisa =
    !jaDeclarouSobreAnvisa && pendencias.some((p) => p.chave === 'autorizacao_anvisa');
  /**
   * Os documentos que ainda cabem anexar aqui.
   *
   * Receita e ANVISA saem da lista: elas têm bloco próprio, com a pergunta antes do anexo,
   * porque a resposta delas decide o destino. Repeti-las aqui pediria o mesmo arquivo duas
   * vezes na mesma tela.
   */
  const documentosParaAnexar = pendencias.filter(
    (p) => p.chave !== 'receita_medica' && p.chave !== 'autorizacao_anvisa',
  );
  const perguntarSobreReceita =
    !jaDeclarouSobreAnvisa && pendencias.some((p) => p.chave === 'receita_medica');

  /**
   * 🔴 O DESTINO PASSA A CONSIDERAR O QUE ELE ACABOU DE RESPONDER.
   *
   * O manifesto do parceiro diz o que ELE mandou; a resposta na tela diz o que o PACIENTE
   * tem. Quando os dois discordam, vale o paciente — ele é a fonte sobre a própria vida, e o
   * parceiro pode simplesmente não ter recebido o documento ainda.
   *
   * É a mesma regra que o guarda `a-triagem-roteia-e-nao-julga` já aplica ao bot: a resposta
   * do paciente vence a base.
   */
  const pendenciasDepoisDasRespostas = pendencias
    .filter((p) => !(p.chave === 'autorizacao_anvisa' && temAnvisa === true))
    .filter((p) => !(p.chave === 'receita_medica' && temReceita === true));

  /**
   * 🔴 O QUE A TELA PROMETE VEM DO DESTINO, não de um texto fixo.
   *
   * Os dois fluxos terminavam com "Criar conta e agendar consulta" — inclusive o do paciente
   * que já tem receita e vai para a procuração da ANVISA. Prometer consulta a quem não vai
   * ter consulta confunde no clique e desmente a tela seguinte.
   */
  const textos = textosDoDestino(
    destinoDepoisDoCadastro(pendenciasDepoisDasRespostas.map((p) => p.chave)),
  );
  /**
   * 🔴 COMEÇA VAZIO — nenhuma finalidade vem marcada.
   *
   * Pré-marcar seria gravar como escolha dele algo que ele não fez (art. 8º §4º). E ficar
   * fora de `podeEnviar` também é decisão: consentimento que trava o cadastro não é livre
   * (art. 8º §3º), e o que o cadastro precisa mesmo se sustenta na tutela da saúde.
   */
  const [finalidadesConsentidas, setFinalidadesConsentidas] = useState<Finalidade[]>([]);
  const [tratamentoAtual, setTratamentoAtual] = useState('');
  const [codigo, setCodigo] = useState('');
  /**
   * 🔴 D-07 — o e-mail já tem conta aqui.
   *
   * Antes isto era só uma mensagem de erro do Clerk, e o paciente ficava PRESO: lia
   * "já existe uma conta" e não tinha para onde ir. A mensagem sem caminho é pior que
   * o erro, porque parece que o sistema quebrou.
   */
  const [jaTemConta, setJaTemConta] = useState(false);

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
      const e = err as { errors?: { code?: string }[] };
      if (e?.errors?.[0]?.code === 'form_identifier_exists') setJaTemConta(true);
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
        /**
         * A declaração vai mesmo sem arquivo: "não tenho" é informação, não ausência dela.
         * `null` quando a pergunta nem apareceu — o parceiro já tinha mandado a autorização.
         */
        temAutorizacaoAnvisa: perguntarSobreAnvisa ? temAnvisa : null,
        temReceitaMedica: perguntarSobreReceita ? temReceita : null,
        anexos: await lerAnexos(anexos),
        tratamentoAtual: jaFazTratamento ? tratamentoAtual.trim() : null,
        // Pode ser lista vazia, e vazia é uma resposta: ele leu e não autorizou nada.
        finalidadesConsentidas,
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
      /**
       * 🔴 O DESTINO DEPENDE DO QUE FALTA, e é o que separa os dois fluxos da Greens.
       *
       * Sem receita → agendamento: a receita só existe depois de um médico avaliar.
       * Com receita e sem ANVISA → procuração: mandá-lo agendar seria pedir que repetisse um
       * ato médico que já aconteceu.
       *
       * A regra e o porquê da ordem moram em `lib/parceiros/destino-do-paciente.ts`.
       */
      const destino = destinoDepoisDoCadastro(pendenciasDepoisDasRespostas.map((p) => p.chave));
      setTimeout(() => router.push(destino), 1400);
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
      <Cabecalho protocolo={protocolo} etapa={etapa} textos={textos} />

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
          <Concluido urlDeRetorno={urlDeRetorno} />
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
            {confirmandoDados ? (
              /**
               * 🔴 O PACIENTE QUE VEIO DO PARCEIRO CONFIRMA — NÃO DIGITA.
               *
               * Ele acabou de preencher nome, CPF, telefone e e-mail no formulário da Greens.
               * Repetir os quatro campos aqui é pedir o mesmo trabalho duas vezes, e é o ponto
               * do funil onde se perde gente.
               *
               * ⚠️ Confirmar não é esconder: os dados aparecem, e há "corrigir" ao lado. Se a
               * Greens mandou um telefone errado, ele precisa poder consertar — senão o erro
               * vira definitivo justamente no cadastro que deveria facilitar a vida dele.
               */
              <Secao titulo="Confirme seus dados" icone={User}>
                <div className="border-border/60 bg-muted/30 space-y-3 rounded-2xl border p-5">
                  <LinhaConfirmada rotulo="Nome" valor={nome} />
                  <LinhaConfirmada rotulo="CPF" valor={formatarCpf(cpf)} />
                  <LinhaConfirmada rotulo="Telefone" valor={telefone} />
                  <LinhaConfirmada rotulo="E-mail" valor={email} />
                  <p className="text-muted-foreground pt-1 text-xs">
                    Estes dados vieram do formulário que você preencheu. O e-mail acima será o seu
                    login.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCorrigindo(true)}
                  className="text-primary text-sm font-medium transition-opacity hover:opacity-70"
                >
                  Algo está errado? Corrigir
                </button>
              </Secao>
            ) : (
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
            )}

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

            {pendencias.length > 0 && (
              <>
                <Separador />
                {recebidos.length > 0 && (
                  <Secao titulo="O que já recebemos" icone={FileText}>
                    <div className="border-secondary/30 bg-secondary/5 rounded-xl border px-4 py-3.5">
                      <ul className="space-y-2">
                        {recebidos.map((r) => (
                          <li key={r.chave} className="flex items-start gap-2.5 text-sm">
                            <Check size={15} className="text-secondary mt-0.5 shrink-0" />
                            <span className="text-foreground">{r.rotulo}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="text-muted-foreground mt-3 text-xs">
                        Chegaram junto com o seu cadastro. Você não precisa enviar de novo.
                      </p>
                    </div>
                  </Secao>
                )}

                <Secao titulo="O que ainda vamos precisar" icone={FileText}>
                  {/*
                    🔴 AVISO, NUNCA BLOQUEIO (ADR-0016 D-06). Quem chega sem receita é
                    justamente quem mais precisa da teleconsulta; barrá-lo aqui seria
                    recusar quem o produto existe para atender. Aparece para ele saber o
                    que virá, não para impedi-lo de continuar.
                  */}
                  <div className="border-border bg-muted/40 rounded-xl border px-4 py-3.5">
                    <ul className="space-y-2">
                      {pendencias.map((p) => (
                        <li key={p.chave} className="flex items-start gap-2.5 text-sm">
                          <span className="bg-primary/50 mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" />
                          <span className="text-muted-foreground">
                            {p.rotulo}
                            {p.opcional && (
                              <span className="text-muted-foreground/70 ml-1.5 text-xs">
                                (opcional)
                              </span>
                            )}
                            {/*
                              🔴 NÃO diz "opcional" aqui. A ANVISA e a receita faltam
                              porque são o que ele veio buscar — chamá-las de opcionais
                              diria que são dispensáveis, e não são: nós é que vamos
                              tirá-las com ele.
                            */}
                            {p.resolvemosAqui && (
                              <span className="text-secondary/80 ml-1.5 text-xs">
                                — nós resolvemos com você
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="border-border/60 text-muted-foreground mt-3 border-t pt-3 text-xs leading-relaxed">
                      Nada disso impede você de continuar agora. Você envia depois, com calma, pela
                      sua área — e o médico já pode te atender antes.
                    </p>
                  </div>
                </Secao>
              </>
            )}

            <Separador />

            {/*
              🔴 UM ANEXO PARA CADA DOCUMENTO QUE FALTA — a peça P3 da ADR-0021.
            
              Não existem "dois formulários". Existe UM que mostra o que falta: quem veio do
              parceiro com tudo não vê nenhum campo; quem veio do bot vê os cinco. Cinco telas
              divergiriam na primeira mudança (D-05).
            
              Receita e ANVISA têm bloco próprio, com pergunta antes do anexo, porque a resposta
              delas decide para onde o paciente vai. Os outros três são só envio.
            */}
            {documentosParaAnexar.length > 0 && (
              <>
                <Secao titulo="Seus documentos" icone={FileText}>
                  <p className="text-muted-foreground -mt-1 mb-4 text-xs">
                    Envie agora ou depois, pela sua área. Nada disso impede você de continuar.
                  </p>
                  <div className="space-y-4">
                    {documentosParaAnexar.map((doc) => (
                      <div key={doc.chave} className="space-y-1.5">
                        <Label htmlFor={`anexo-${doc.chave}`}>
                          {doc.rotulo}
                          {doc.opcional && (
                            <span className="text-muted-foreground/70 ml-1.5 text-xs">
                              (opcional)
                            </span>
                          )}
                        </Label>
                        <Input
                          id={`anexo-${doc.chave}`}
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.webp"
                          onChange={(e) => escolherAnexo(doc.chave, e.target.files?.[0] ?? null)}
                          className="h-12 rounded-xl"
                        />
                        {anexos[doc.chave] && (
                          <p className="text-secondary flex items-center gap-1.5 text-xs">
                            <Check size={13} /> {anexos[doc.chave].name}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                  {erroDoAnexo && <p className="text-destructive mt-2 text-xs">{erroDoAnexo}</p>}
                </Secao>

                <Separador />
              </>
            )}

            {perguntarSobreReceita && (
              <>
                {/*
                  🔴 A RECEITA VEM ANTES DA ANVISA NA TELA, pelo mesmo motivo que vem antes no
                  destino: sem receita não há o que autorizar. Perguntar pela autorização primeiro
                  sugere uma ordem que a norma não permite.
                */}
                <Secao titulo="Receita médica" icone={FileText}>
                  <fieldset className="space-y-3">
                    <legend className="text-muted-foreground mb-3 text-sm">
                      Você já tem uma receita médica de cannabis medicinal válida?
                    </legend>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { valor: true, rotulo: 'Sim, já tenho' },
                        { valor: false, rotulo: 'Ainda não' },
                      ].map((opcao) => {
                        const escolhido = temReceita === opcao.valor;
                        return (
                          <button
                            key={String(opcao.valor)}
                            type="button"
                            onClick={() => {
                              setTemReceita(opcao.valor);
                              if (!opcao.valor) escolherAnexo('receita_medica', null);
                            }}
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

                    {temReceita === true && (
                      <div className="animate-fade-up space-y-2 pt-1">
                        <Label htmlFor="anexo-receita">Anexe a receita</Label>
                        <Input
                          id="anexo-receita"
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.webp"
                          onChange={(e) =>
                            escolherAnexo('receita_medica', e.target.files?.[0] ?? null)
                          }
                          className="h-12 rounded-xl"
                        />
                        <p className="text-muted-foreground text-xs">
                          PDF ou foto, até 8 MB. O médico confere na consulta.
                        </p>
                      </div>
                    )}

                    {temReceita === false && (
                      <p className="text-muted-foreground animate-fade-up pt-1 text-xs">
                        Tudo bem — é justamente para isso que existe a teleconsulta. O médico avalia
                        o seu caso e, havendo indicação, a receita sai na própria consulta.
                      </p>
                    )}
                  </fieldset>
                </Secao>

                <Separador />
              </>
            )}

            {perguntarSobreAnvisa && (
              <>
                <Secao titulo="Autorização da ANVISA" icone={FileText}>
                  <fieldset className="space-y-3">
                    <legend className="text-muted-foreground mb-3 text-sm">
                      Você já tem a Autorização de Importação da ANVISA?
                    </legend>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { valor: true, rotulo: 'Sim, já tenho' },
                        { valor: false, rotulo: 'Ainda não' },
                      ].map((opcao) => {
                        const escolhido = temAnvisa === opcao.valor;
                        return (
                          <button
                            key={String(opcao.valor)}
                            type="button"
                            onClick={() => {
                              setTemAnvisa(opcao.valor);
                              // Trocar para "ainda não" descarta o arquivo escolhido antes:
                              // enviar documento que ele acabou de dizer que não tem seria
                              // gravar uma contradição.
                              if (!opcao.valor) {
                                escolherAnexo('autorizacao_anvisa', null);
                              }
                            }}
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
                      O campo de arquivo só nasce depois do "sim" — pelo mesmo motivo da caixa
                      de texto do tratamento: pedir antes da resposta é ruído, e esconder por
                      CSS deixa um campo invisível no DOM.
                    */}
                    {temAnvisa === true && (
                      <div className="animate-fade-up space-y-2 pt-1">
                        <Label htmlFor="anexo-anvisa">Anexe o documento</Label>
                        <Input
                          id="anexo-anvisa"
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.webp"
                          onChange={(e) =>
                            escolherAnexo('autorizacao_anvisa', e.target.files?.[0] ?? null)
                          }
                          className="h-12 rounded-xl"
                        />
                        {erroDoAnexo ? (
                          <p className="text-destructive text-xs">{erroDoAnexo}</p>
                        ) : (
                          <p className="text-muted-foreground text-xs">
                            PDF ou foto, até 8 MB. Se preferir, pode enviar depois pela sua área —
                            isso não impede você de continuar.
                          </p>
                        )}
                      </div>
                    )}

                    {/*
                      🔴 O "ainda não" NÃO é um beco: é o começo do caminho da procuração.
                      Dizer isso aqui evita que ele ache que respondeu errado.
                    */}
                    {temAnvisa === false && (
                      <p className="text-muted-foreground animate-fade-up pt-1 text-xs">
                        Sem problema — nós resolvemos isso com você. Depois da consulta, a
                        procuração da ANVISA fica disponível na sua área.
                      </p>
                    )}
                  </fieldset>
                </Secao>

                <Separador />
              </>
            )}

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

            <ConsentimentoDoCompartilhamento
              selecionadas={finalidadesConsentidas}
              onChange={setFinalidadesConsentidas}
              desabilitado={carregando}
            />

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

            {jaTemConta ? (
              <div className="animate-fade-in border-secondary/25 bg-secondary/5 space-y-3 rounded-xl border px-4 py-4">
                <p className="text-foreground text-sm leading-relaxed">
                  Você já tem uma conta na BeHemp com este e-mail. Entre com a sua senha para
                  continuar de onde parou.
                </p>
                <Button className="h-11 w-full rounded-xl" render={<Link href="/entrar" />}>
                  Entrar na minha conta
                </Button>
              </div>
            ) : (
              erro && <Aviso texto={erro} />
            )}
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
                    {textos.botao}
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

function Cabecalho({
  protocolo,
  etapa,
  textos,
}: {
  protocolo: string;
  etapa: string;
  /** O que a tela promete — vem do destino, não de texto fixo. Ver `textosDoDestino`. */
  textos: ReturnType<typeof textosDoDestino>;
}) {
  const passo = etapa === 'dados' ? 1 : etapa === 'codigo' ? 2 : 3;
  return (
    <div className="animate-fade-up mb-7 text-center">
      <span className="eyebrow">Protocolo {protocolo}</span>
      <h1 className="font-display text-foreground mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
        {etapa === 'pronto' ? (
          'Tudo certo!'
        ) : (
          <>
            {textos.titulo} <span className="text-accent-italic">{textos.destaque}</span>
          </>
        )}
      </h1>
      <p className="text-muted-foreground mx-auto mt-3 max-w-md text-sm leading-relaxed">
        {etapa === 'dados'
          ? textos.subtitulo
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

function Concluido({ urlDeRetorno }: { urlDeRetorno: string | null }) {
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

      {/*
        🔴 D-08 — o caminho de volta. Ele veio de outro site porque quer comprar
        medicamento, e a compra acontece lá. Terminar sem porta de saída é perder alguém
        no meio de um processo que atravessa duas empresas.

        A URL já foi conferida contra a lista de origens permitidas quando foi GRAVADA.
        Validar de novo aqui espalharia a checagem por toda tela que a use — e bastaria
        uma esquecer para virar redirecionamento aberto.
      */}
      {urlDeRetorno && (
        <div className="border-border/60 mt-8 border-t pt-6">
          <Button
            variant="ghost"
            className="h-11 rounded-xl"
            render={<a href={urlDeRetorno} rel="noopener noreferrer" />}
          >
            <ArrowLeft size={16} />
            Voltar para continuar minha compra
          </Button>
        </div>
      )}
    </div>
  );
}
