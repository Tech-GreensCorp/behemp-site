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
import { useClerk, useUser } from '@clerk/nextjs';
// `useAuth` não existe no entrypoint `/legacy` — vem do pacote principal, como em
// `entrar/page.tsx` e `navbar.tsx`. Medido: o type-check acusa TS2305 se importado de lá.
import { useAuth } from '@clerk/nextjs';
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
  /**
   * O mesmo, para a receita — separado desde 11/09/2026 (Item 33).
   *
   * Uma flag só para as duas perguntas escondia o caso de quem veio do formulário da Greens,
   * onde ninguém pergunta sobre receita: ele não era perguntado aqui tampouco, e o destino
   * saía errado.
   */
  jaDeclarouSobreReceita?: boolean;
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
    /**
     * 🔴 SESSÃO JÁ ABERTA. Medido em 12/09/2026, com o dono testando o fluxo 1 logado: o
     * `signUp.create` foi recusado, o código não estava neste mapa, e a tela caiu na frase
     * genérica "Confira os dados e tente novamente" — mandando conferir dados que estavam
     * todos certos.
     *
     * ⚠️ Com a retomada, este caminho não deveria mais ser alcançado: quem tem sessão pula o
     * Clerk e grava só a ficha. A entrada fica como rede — se a sessão aparecer NO MEIO do
     * preenchimento (outra aba, login em paralelo), a mensagem diz o que fazer em vez de
     * culpar os dados.
     */
    session_exists: 'Você já está com a sessão aberta. Recarregue a página para continuar.',
    identifier_already_signed_in:
      'Você já está com a sessão aberta. Recarregue a página para continuar.',
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
  jaDeclarouSobreReceita = false,
}: Props) {
  const router = useRouter();
  const { isLoaded, signUp, setActive } = useSignUp();

  /**
   * 🔴 QUEM JÁ TEM SESSÃO NÃO PRECISA CRIAR CONTA DE NOVO — e não conseguia.
   *
   * O estado em que o dono ficou em 11/09/2026, no protocolo SOL-000046: a conta foi criada,
   * o e-mail foi confirmado, a sessão abriu — e a gravação da ficha falhou. Ele ficou logado,
   * com o painel vazio, e o link não servia para mais nada: ao voltar, a tela pedia para criar
   * uma conta que já existia, e o Clerk respondia `form_identifier_exists`.
   *
   * ⚠️ Com sessão viva, a conta é fato consumado. O que falta é só a FICHA — e
   * `concluirCadastroPorLink` já exige `auth()`, então ela funciona sozinha, sem passar pelo
   * Clerk outra vez.
   */
  const { isSignedIn, isLoaded: authCarregou } = useAuth();

  /**
   * 🔴 DE QUEM É A SESSÃO ABERTA — e ela precisa ser de quem o link chama.
   *
   * Achado pelo dono em 12/09/2026, com três contas de teste no mesmo navegador: abriu um
   * link emitido para um e-mail estando logado com outro. Sem esta conferência, "pular o
   * Clerk porque já há sessão" gravaria a ficha do paciente do link — CPF, telefone,
   * documentos do parceiro — na conta de quem estivesse logado.
   *
   * ⚠️ O servidor RECUSA esse caso (`cadastro-por-link.ts`), e é ele que garante. Aqui o
   * trabalho é outro: dizer ANTES do clique, para o paciente não bater numa recusa sem
   * entender o motivo — e para não parecer que os dados dele estão errados.
   */
  const { user } = useUser();
  const { signOut } = useClerk();
  const emailDaSessao = user?.primaryEmailAddress?.emailAddress?.toLowerCase() ?? '';
  /**
   * ⚠️ A COMPARAÇÃO É COM `emailInicial` — o e-mail que o PARCEIRO mandou —, nunca com o
   * campo `email` da tela. O campo é editável: quem estivesse logado em outra conta poderia
   * digitar o próprio endereço e fazer a checagem passar, que é exatamente o que ela existe
   * para impedir. A mesma razão pela qual o servidor compara com `solicitacao.email`.
   */
  const emailDoLink = (emailInicial ?? '').trim().toLowerCase();

  /**
   * 🔴 RETIFICADO EM 13/09/2026 — A TRAVA BARRAVA QUEM CORRIGIU O PRÓPRIO E-MAIL.
   *
   * Decisão do dono, preso nesta tela: _"esse bloqueio atual é inválido, já que o 'corrigir
   * meus dados' serve basicamente pra isso"_. E ele estava certo: o botão existe porque o
   * parceiro erra — e naquele dia **nós** erramos, mandando um e-mail antigo por reaproveitar
   * a solicitação pelo telefone. Ele corrigiu, a conta nasceu certa, e a tela disse que o
   * link era de outra pessoa.
   *
   * **O que a trava passa a comparar:** a sessão contra o e-mail do link **ou** contra o que
   * o paciente digitou nesta tela. O campo é editável, sim — mas o Clerk só cria a conta
   * depois do código, então uma sessão que casa com o campo digitado é uma sessão cujo e-mail
   * foi comprovadamente confirmado aqui.
   *
   * ⚠️ O QUE ELA AINDA PEGA, e é o caso que a originou: chegar com a sessão de OUTRA conta
   * (o dono, ontem, com três contas de teste no mesmo navegador). Aí a sessão não casa nem
   * com o link nem com o que está sendo preenchido, e o aviso com "Sair desta conta" aparece.
   */

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

  /**
   * O paciente clicou em "Corrigir meus dados". É escolha dele, e escolha não se desfaz
   * sozinha — sem esta marca, a retomada o traria de volta no render seguinte, e ele ficaria
   * preso sem nunca conseguir corrigir o que estava errado.
   */
  const [voltouDeProposito, setVoltouDeProposito] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  const [nome, setNome] = useState(nomeInicial ?? '');
  const [cpf, setCpf] = useState(cpfInicial ? formatarCpf(cpfInicial) : '');
  const [telefone, setTelefone] = useState(formatarTelefoneParaTela(telefoneInicial));
  const [email, setEmail] = useState(emailInicial ?? '');

  /**
   * ⚠️ DECLARADO AQUI, e não junto dos outros derivados lá em cima, por uma razão do
   * compilador: desde a retificação de 13/09 ele depende de `email`, que é estado. Calcular
   * antes daria `Block-scoped variable 'email' used before its declaration`.
   */
  const emailDigitado = email.trim().toLowerCase();
  const sessaoEDeOutraPessoa =
    authCarregou &&
    Boolean(isSignedIn) &&
    Boolean(emailDaSessao) &&
    Boolean(emailDoLink) &&
    emailDaSessao !== emailDoLink &&
    emailDaSessao !== emailDigitado;
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
    !jaDeclarouSobreReceita && pendencias.some((p) => p.chave === 'receita_medica');

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
   * 🔴 O REENVIO PRECISA DAR RETORNO — achado em 11/09/2026, com o dono testando.
   *
   * "Reenviar código" não mudava nada na tela. Quem clica e não vê resposta clica de novo, e
   * **cada reenvio invalida o código anterior**: o paciente digita o do primeiro e-mail e a
   * tela responde "código incorreto". O defeito parece do código; é da falta de retorno.
   */
  const [reenviado, setReenviado] = useState(false);
  const [reenviando, setReenviando] = useState(false);
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

  /**
   * 🔴 RETOMAR DE ONDE PAROU — derivado no render, sem `useEffect`.
   *
   * Pedido do dono em 12/09/2026: _"se eu parei na etapa de verificar o código do e-mail,
   * quando eu entrasse na minha conta era para aparecer justamente essa tela"_. E a razão:
   * _"isso pode ser um caso real do paciente BeHemp, nós temos que prevenir esse tipo de
   * coisa"_.
   *
   * ⚠️ A PRIMEIRA VERSÃO USAVA UM EFEITO com três `setState` no corpo — e o lint acusou, com
   * razão: _"Calling setState synchronously within an effect can trigger cascading renders"_.
   * O `AGENTS.md` proíbe isso, e o React documenta o padrão certo: **isto não precisa de
   * efeito**. A etapa é uma função do que já se sabe, então se calcula.
   */
  const cadastroPendenteNoNavegador =
    isLoaded &&
    Boolean(signUp) &&
    signUp.status === 'missing_requirements' &&
    Boolean(signUp.emailAddress) &&
    signUp.verifications?.emailAddress?.status === 'unverified';

  /**
   * 🔴 S8.5 — POR QUE PULAR PARA O CÓDIGO EXIGE O FORMULÁRIO INTEIRO, e não só a senha.
   *
   * O dono declarou pendência real em 13/09/2026: _"retomar da mesma aba deve funcionar em
   * todas as instâncias"_. Ao medir o que separa "todas as instâncias" do que existe, apareceu
   * uma coisa que a versão anterior tratava por acidente — e que **inverte** a correção óbvia.
   *
   * A versão anterior exigia `Boolean(senha)`, e explicava isso pela senha: ela é entregue ao
   * Clerk depois da confirmação, então retomar sem ela completaria a conta sem senha. Verdade,
   * e insuficiente. **A senha era um proxy para algo maior.**
   *
   * 🔴 MEDIDO: confirmar o código não termina no Clerk. Ele chama `gravarFicha()`, que monta a
   * ficha inteira a partir do ESTADO DO REACT — `cpf`, `telefone`, `jaFazTratamento`,
   * `temAnvisa`, `temReceita`, `anexos`, `tratamentoAtual` e `finalidadesConsentidas`. Pular
   * para a etapa do código com o estado zerado grava uma ficha **sem documento, sem
   * consentimento e sem as respostas clínicas** — e consome o link de uso único no caminho.
   *
   * ⚠️ Ou seja: a correção ingênua do S8.5 produziria a FICHA CASCA (ADR-0022, G2) pelo caminho
   * principal, com o paciente lendo "pronto". É o defeito que esta ADR inteira existe para
   * fechar, entrando pela porta da correção dele.
   *
   * ⛔ E guardar o formulário no navegador para contornar isso está fora de questão: `File` de
   * documento clínico não é serializável, e senha em `localStorage`/`sessionStorage` é
   * exatamente o que a regra de segurança proíbe. Persistir para conveniência sairia mais caro
   * que o problema.
   *
   * **Então a condição passa a ser declarada em vez de inferida.** O nome diz o que ela
   * protege, e um campo novo que só viva em memória se acrescenta aqui — em vez de quebrar
   * este cálculo em silêncio, como `Boolean(senha)` quebraria.
   */
  const formularioEmMaos = Boolean(senha) && Boolean(confirmarSenha) && jaFazTratamento !== null;

  const deveRetomar = cadastroPendenteNoNavegador && formularioEmMaos && !voltouDeProposito;

  /**
   * 🔴 E ESTA É A OUTRA METADE DO S8.5 — a que faltava, e a que o dono viu faltando.
   *
   * Quando há cadastro pendente mas o formulário não está em mãos (recarregou a página, fechou
   * a aba, voltou pelo link no mesmo navegador), o comportamento correto **já era** ficar na
   * etapa 1: ao enviar de novo, `pendenteDoMesmoEmail` reconhece o cadastro e só reenvia o
   * código, sem criar outro.
   *
   * ⚠️ O DEFEITO NÃO ERA O COMPORTAMENTO: ERA O SILÊNCIO. O paciente voltava, via a etapa 1 do
   * zero e concluía que tinha perdido tudo — sem saber que o cadastro estava esperando, que o
   * e-mail já fora enviado, nem que precisava anexar os documentos de novo. É o R6 (verdade
   * sobre o estado) aplicado à própria tela do cadastro: **não basta funcionar, tem que dizer.**
   */
  const retomandoSemFormulario =
    cadastroPendenteNoNavegador && !formularioEmMaos && !voltouDeProposito;

  /**
   * A etapa que a tela mostra. `etapa` é o que o paciente escolheu; esta é o que ele vê —
   * e as duas só divergem enquanto há cadastro pendente para retomar.
   */
  const etapaVisivel: 'dados' | 'codigo' | 'pronto' =
    etapa === 'dados' && deveRetomar ? 'codigo' : etapa;

  const campoCodigo = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (etapaVisivel === 'codigo') campoCodigo.current?.focus();
  }, [etapaVisivel]);

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

  /**
   * GRAVA A FICHA — o único caminho, usado pelos DOIS pontos de entrada.
   *
   * 🔴 Extraída em 12/09/2026 porque passou a haver dois caminhos até aqui:
   *   1. o normal — confirmou o código, a sessão abriu, grava;
   *   2. a RETOMADA — a sessão já estava viva e só a ficha faltava.
   *
   * ⚠️ Uma cópia em cada caminho é como nasce a divergência silenciosa: um ganha um campo
   * novo, o outro não, e o paciente que veio pelo segundo caminho fica sem ele. Por isso é
   * uma função só.
   */
  async function gravarFicha() {
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
  }

  async function criarConta(evento: React.FormEvent) {
    evento.preventDefault();
    if (!isLoaded || !podeEnviar) return;

    setCarregando(true);
    setErro('');

    try {
      /**
       * 🔴 VOLTAR E ENVIAR DE NOVO NÃO PODE VIRAR BECO — achado em 11/09/2026.
       *
       * "Corrigir meus dados" leva de volta a esta etapa. Chamar `signUp.create` outra vez
       * com um cadastro já pendente faz o Clerk responder `form_identifier_exists`, e a tela
       * dizia **"Já existe uma conta com este e-mail"** — para alguém que estava no meio do
       * próprio cadastro, e que NÃO tem conta. O caminho de correção virava saída.
       *
       * Quando o cadastro pendente é do MESMO e-mail, só reenviamos o código e seguimos.
       */
      /**
       * 🔴 SESSÃO VIVA: a conta existe, falta a ficha. Pula o Clerk inteiro.
       *
       * Sem isto, quem voltou ao link com sessão aberta batia em `form_identifier_exists` e
       * lia "já existe uma conta" — sendo que a conta é DELE, e o que faltava era só gravar.
       */
      if (authCarregou && isSignedIn && !sessaoEDeOutraPessoa) {
        await gravarFicha();
        return;
      }

      /**
       * 🔴 SAIR DA SESSÃO ALHEIA ANTES DE CRIAR O CADASTRO — e não depois.
       *
       * Medido com o dono em 12/09/2026, e o relato dele diz o essencial: _"o sistema loga
       * assim que clico em criar a conta, sendo que era pra logar após eu inserir o código
       * do e-mail… tentei inserir o código e deu erro que eu já estava logado; saí da conta
       * e tentei entrar com minha senha, e não foi"_.
       *
       * ⚠️ O CLERK NÃO COMPLETA UM `signUp` ENQUANTO HÁ SESSÃO ATIVA. O `create` passa — e
       * por isso parece que deu certo —, mas o `attemptEmailAddressVerification` seguinte
       * responde `session_exists`. O cadastro morre no meio: o `signUp` fica pendente, a
       * conta **nunca chega a existir** (sem e-mail verificado não há conta), e a senha que
       * o paciente acabou de escolher não serve para entrar. Limbo completo, e sem saída
       * visível.
       *
       * ⚠️ POR QUE AUTOMÁTICO, e não mais um aviso. O aviso com botão "Sair desta conta"
       * existe e cobre quem CHEGA logado. Este caso é outro: a sessão pode estar viva por
       * um login em paralelo, por uma aba antiga, ou porque o `signOut` do aviso ainda não
       * propagou. Pedir de novo o que o paciente já fez é o que transforma correção em beco.
       */
      if (authCarregou && isSignedIn) {
        await signOut();
      }

      const emailAlvo = email.trim().toLowerCase();
      const pendenteDoMesmoEmail =
        Boolean(signUp.status) && signUp.emailAddress?.toLowerCase() === emailAlvo;

      if (pendenteDoMesmoEmail) {
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
        setCodigo('');
        setReenviado(true);
        setEtapa('codigo');
        return;
      }

      /**
       * 🔴 SÓ O E-MAIL AQUI. A SENHA E O NOME VÃO DEPOIS DA CONFIRMAÇÃO.
       *
       * Decisão do dono em 12/09/2026, e a frase dele diz o motivo melhor do que eu
       * resumiria: _"a conta já existe mas pra entrar nela eu não consigo, porque a senha não
       * foi gerada… ou seja, na última etapa, por conta do erro do código, eu perdi minha
       * conta"_.
       *
       * ⚠️ O QUE ACONTECIA COM TUDO JUNTO NO `create`. Se o fluxo morresse entre esta linha e
       * a confirmação do e-mail — e morreu, com `session_exists` —, sobrava um cadastro no
       * Clerk segurando aquele e-mail. Voltar dava `form_identifier_exists` ("já existe uma
       * conta"), e entrar não dava, porque a senha nunca tinha sido gravada de verdade.
       * Preso dos dois lados, com os dados do parceiro parados esperando um cadastro que não
       * podia mais ser feito.
       *
       * 🔴 A DOC DO CLERK DÁ A GARANTIA, e é o que sustenta esta ordem: o status
       * `'complete'` significa _"The user has been created and the custom flow can proceed to
       * setActive()"_. Enquanto faltar requisito, o status é `'missing_requirements'` e
       * **não há conta** — só uma tentativa. Mandando a senha depois da verificação, a conta
       * nasce num passo só, já com senha, e nunca existe o estado "conta sem senha".
       *
       * ⚠️ E o `update()` aceita os mesmos campos do `create()` (doc do objeto `SignUp`), com
       * `missingFields` listando o que falta. É o fluxo incremental previsto, não um desvio.
       */
      await signUp.create({ emailAddress: email.trim().toLowerCase() });
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
      /**
       * 🔴 REDE DE SEGURANÇA: sessão que apareceu ENTRE as duas etapas.
       *
       * O `criarConta` já sai de qualquer sessão antes de criar o cadastro. Mas entre uma
       * etapa e outra o paciente vai ao e-mail, volta, às vezes por outra aba — e pode
       * chegar aqui com sessão nova. Sem isto, o `attempt` responde `session_exists` e o
       * cadastro morre no meio, com a conta ainda inexistente.
       */
      if (authCarregou && isSignedIn) {
        await signOut();
      }

      const verificado = await signUp.attemptEmailAddressVerification({ code: codigo.trim() });

      /**
       * 🔴 AGORA A CONTA NASCE — e é aqui que ela deve nascer.
       *
       * O `create` mandou só o e-mail, então depois da verificação o status é
       * `'missing_requirements'` e `missingFields` lista o que falta (senha, nome). O
       * `update` entrega tudo de uma vez: o status vira `'complete'`, e é nesse instante que
       * o Clerk cria o usuário — _"The user has been created"_, na doc do objeto `SignUp`.
       *
       * ⚠️ Isto elimina a classe inteira do estado "conta existe, senha não". Se algo falhar
       * antes desta linha, não há conta — há uma tentativa pendente, que a retomada recupera.
       */
      const partesDoNome = nome.trim().split(/\s+/);
      const conclusao =
        verificado.status === 'complete'
          ? verificado
          : await signUp.update({
              password: senha,
              firstName: partesDoNome[0],
              lastName: partesDoNome.slice(1).join(' '),
            });

      if (conclusao.status !== 'complete') {
        /**
         * Sobrou requisito que não sabemos preencher. Dizer QUAL evita o "tente novamente"
         * que não leva a lugar nenhum — foi o que prendeu o dono por duas rodadas.
         */
        const faltando = conclusao.missingFields?.join(', ');
        setErro(
          faltando
            ? `Faltou concluir: ${faltando}. Volte e confira os dados.`
            : 'A verificação não pôde ser concluída. Tente novamente.',
        );
        return;
      }

      await setActive({ session: conclusao.createdSessionId });

      await gravarFicha();
    } catch (err) {
      setErro(traduzirErro(err));
    } finally {
      setCarregando(false);
    }
  }

  async function reenviarCodigo() {
    if (!isLoaded || reenviando) return;
    setErro('');
    setReenviando(true);
    try {
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      /**
       * 🔴 LIMPA O CAMPO. O código que estava digitado é o ANTERIOR, e ele acabou de deixar
       * de valer. Manter os dígitos na tela convida a confirmar o código morto — e o erro
       * que aparece ("código incorreto") aponta para o lugar errado.
       */
      setCodigo('');
      setReenviado(true);
      campoCodigo.current?.focus();
    } catch (err) {
      setErro(traduzirErro(err));
    } finally {
      setReenviando(false);
    }
  }

  return (
    <div className="relative mx-auto w-full max-w-xl">
      <Cabecalho protocolo={protocolo} etapa={etapaVisivel} textos={textos} />

      <div
        className={cn(
          'animate-fade-up border-border/60 bg-card/80 rounded-3xl border backdrop-blur-xl',
          // Sombra em duas camadas: um contorno de 1px e uma difusa e baixa. É o que dá
          // a sensação de peso sem a mancha cinzenta de uma `box-shadow` única.
          'shadow-[0_1px_2px_rgba(26,22,18,0.04),0_16px_40px_-16px_rgba(26,22,18,0.16)]',
          'p-6 sm:p-9',
        )}
      >
        {etapaVisivel === 'pronto' ? (
          <Concluido urlDeRetorno={urlDeRetorno} />
        ) : etapaVisivel === 'codigo' ? (
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
                onChange={(e) => {
                  setCodigo(e.target.value.replace(/\D/g, ''));
                  // O aviso já foi lido quando ele começa a digitar.
                  if (reenviado) setReenviado(false);
                }}
                placeholder="000000"
                className="h-14 rounded-xl text-center font-mono text-2xl tracking-[0.5em]"
              />
            </div>

            {/*
              🔴 O RETORNO DO REENVIO. Sem ele o paciente clica de novo — e cada reenvio
              invalida o código anterior, o que faz o código certo do e-mail ERRADO ser
              recusado. Diz também que o anterior deixou de valer, porque é isso que explica
              o e-mail antigo na caixa de entrada.
            */}
            {reenviado && !erro && (
              <div className="animate-fade-in border-primary/25 bg-primary/5 rounded-xl border px-4 py-3">
                <p className="text-foreground text-sm leading-relaxed">
                  Enviamos um código novo. <strong>O anterior deixou de valer</strong> — use o
                  e-mail mais recente.
                </p>
              </div>
            )}

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
                  /**
                   * 🔴 `setRetomado(true)` AQUI, e sem isso o botão não funcionava.
                   *
                   * Defeito da própria retomada, achado em 12/09/2026 ao revisar o caminho
                   * de volta que o dono pediu: o efeito que retoma dispara quando
                   * `etapa === 'dados'` e ainda não retomou. Quem clicasse em "Corrigir meus
                   * dados" voltaria para a etapa 1 e seria **jogado de volta** para a do
                   * código no render seguinte — preso, sem nunca conseguir corrigir o que
                   * estava errado.
                   *
                   * ⚠️ A marca diz "a retomada já cumpriu seu papel nesta visita". Voltar
                   * passa a ser uma escolha do paciente, e escolha do paciente não se
                   * desfaz sozinha.
                   */
                  setVoltouDeProposito(true);
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
                disabled={reenviando}
                className="text-primary font-medium transition-opacity hover:opacity-70 disabled:opacity-50"
              >
                {reenviando ? 'Enviando…' : 'Reenviar código'}
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

            {/*
              🔴 QUEM VOLTA COM SESSÃO ABERTA PRECISA SABER QUE NÃO VAI CRIAR CONTA DE NOVO.
              Sem este aviso, o botão continua dizendo "Criar conta e continuar" para quem já
              tem conta — e o paciente hesita, ou clica achando que vai duplicar alguma coisa.
              É o estado em que o dono ficou em 11/09/2026 (SOL-000046): conta criada, ficha
              não gravada, e o link parecendo inútil.
            */}
            {/*
              🔴 SESSÃO DE OUTRA PESSOA — e com SAÍDA, não só com o aviso.
              Dizer "este link é de outro e-mail" e parar aí deixa o paciente preso: ele não
              sabe que precisa sair da conta, e muito menos onde. O botão faz o trabalho.
              ⚠️ Vem ANTES do aviso de sessão aberta: os dois são sobre sessão, e este é o
              que impede de continuar.
            */}
            {sessaoEDeOutraPessoa && (
              <div className="animate-fade-in space-y-3 rounded-xl border border-amber-300/60 bg-amber-50/60 px-4 py-4">
                <p className="text-foreground text-sm leading-relaxed">
                  Você está nesta página com a conta <strong>{emailDaSessao}</strong>, mas este link
                  foi enviado para <strong>{emailDoLink}</strong>. Saia da conta atual para
                  continuar o cadastro certo.
                </p>
                <Button
                  variant="outline"
                  className="h-11 w-full rounded-xl"
                  onClick={() => signOut()}
                  type="button"
                >
                  Sair desta conta e continuar
                </Button>
              </div>
            )}

            {/*
              🔴 S8.5 — O CADASTRO PENDENTE SE ANUNCIA, em vez de deixar o paciente concluir
              que perdeu tudo.

              Aparece quando o Clerk tem um cadastro pendente deste navegador e o formulário
              não está mais em memória — recarregou a página, fechou a aba, voltou pelo link.
              O cadastro está intacto; o que se perdeu foram os campos desta tela.

              ⚠️ DIZ OS DOIS LADOS DE PROPÓSITO: o que sobreviveu (o cadastro, o e-mail já
              enviado) e o que não (os documentos anexados). Avisar só a boa notícia faria o
              paciente chegar ao fim sem os arquivos — que é como a ficha casca nasce.
            */}
            {retomandoSemFormulario && !sessaoEDeOutraPessoa && !jaTemConta && (
              <div className="animate-fade-in border-secondary/25 bg-secondary/5 rounded-xl border px-4 py-4">
                <p className="text-foreground text-sm leading-relaxed">
                  Você já tinha começado este cadastro e paramos na{' '}
                  <strong>confirmação do e-mail</strong>. Ele continua guardado — confira os dados
                  abaixo e continue, que reenviamos o código.
                </p>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  Só os documentos precisam ser anexados de novo: arquivo não fica salvo no
                  navegador.
                </p>
              </div>
            )}

            {authCarregou && isSignedIn && !sessaoEDeOutraPessoa && !jaTemConta && (
              <div className="animate-fade-in border-secondary/25 bg-secondary/5 rounded-xl border px-4 py-4">
                <p className="text-foreground text-sm leading-relaxed">
                  Você já está com a sessão aberta. Vamos apenas{' '}
                  <strong>concluir o seu cadastro</strong> — sua conta não será criada de novo.
                </p>
              </div>
            )}

            {jaTemConta ? (
              <div className="animate-fade-in border-secondary/25 bg-secondary/5 space-y-3 rounded-xl border px-4 py-4">
                <p className="text-foreground text-sm leading-relaxed">
                  Você já tem uma conta na BeHemp com este e-mail. Entre com a sua senha para
                  continuar de onde parou.
                </p>
                {/*
                  🔴 O LINK DO CADASTRO VIAJA JUNTO, e sem isso este botão era um beco.
                  Medido em 12/09/2026: ele mandava para `/entrar` sem `redirect_url`. A tela
                  de login **aceita** esse parâmetro (`entrar/page.tsx:104`) e, sem ele, cai no
                  padrão `/redirect` — fora do cadastro, com o token perdido e as caixas de
                  consentimento desmarcadas.
                  ⚠️ O paciente da RECOMPRA (fluxo 3 da Greens) é justamente quem cai aqui: ele
                  já tem conta, é esse o motivo de ele voltar. Mandá-lo para o painel em vez de
                  para o cadastro que ele estava preenchendo é perder o fluxo inteiro.
                  Mesma família dos dois becos do Item 35.
                */}
                <Button
                  className="h-11 w-full rounded-xl"
                  render={
                    <Link
                      href={`/entrar?redirect_url=${encodeURIComponent(`/cadastro/${token}`)}`}
                    />
                  }
                >
                  Entrar na minha conta
                </Button>
                {/*
                  A SAÍDA PARA QUEM NÃO TEM SENHA UTILIZÁVEL. Medido na instância em
                  12/09/2026: para um e-mail nesse estado o Clerk declara TRÊS caminhos —
                  `password`, `email_code` e `reset_password_email_code`. A tela oferecia um.
                  O `redirect_url` leva de volta a ESTE cadastro: sem ele, quem recupera o
                  acesso cai no painel e o fluxo morre aqui.
                */}
                <Button
                  variant="outline"
                  className="h-11 w-full rounded-xl"
                  render={
                    <Link
                      href={`/entrar?redirect_url=${encodeURIComponent(`/cadastro/${token}`)}`}
                    />
                  }
                >
                  Esqueci minha senha / entrar por código
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
                    {/*
                      Com sessão aberta não se cria conta nenhuma — dizer "criando sua conta"
                      seria descrever um passo que não está acontecendo.
                    */}
                    {authCarregou && isSignedIn ? 'Concluindo seu cadastro…' : 'Criando sua conta…'}
                  </>
                ) : (
                  <>
                    {/*
                      🔴 O BOTÃO NÃO PROMETE O QUE NÃO VAI FAZER. `textos.botao` diz "Criar
                      conta e …" — certo para quem chega sem conta, e mentira para quem volta
                      com a sessão viva e só precisa da ficha.
                    */}
                    {authCarregou && isSignedIn ? 'Concluir meu cadastro' : textos.botao}
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
