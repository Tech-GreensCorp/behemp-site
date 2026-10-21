/**
 * O VEREDITO DA CONFERÊNCIA DE IDENTIDADE — a parte PURA (ADR-0028).
 *
 * Tipos, normalização e a decisão, sem banco, sem `next/*` e sem Clerk. Existe separada de
 * `conferir-identidade.ts` porque a TELA (client) precisa dos tipos e dos textos, e importar o
 * módulo que importa `db` levaria o driver do banco para o bundle do navegador.
 *
 * O que faz: decide, a partir do que o banco achou, o que a tela mostra. Não lê nem escreve
 * nada. Idempotente.
 */

import { normalizarTelefoneWhatsapp } from '@/lib/chatpro/telefone';
import { cpfEhValido, somenteDigitosDoCpf } from '@/lib/validacao/cpf';

/**
 * Os vereditos possíveis. A tela decide o que mostrar a partir SÓ disto.
 *
 * ⚠️ É a lista que o guarda `a-identidade-e-conferida-na-etapa-1` lê para provar que nada além
 * de uma palavra sai daqui. Veredito novo entra aqui, e a tela precisa saber exibi-lo.
 */
export const VEREDITOS = [
  'livre',
  'sessao_propria',
  'sessao_alheia',
  'conta_pelo_email',
  'cpf_em_outra_conta',
  'telefone_conhecido',
  'limite',
  'indisponivel',
] as const;

export type Veredito = (typeof VEREDITOS)[number];

/**
 * Os vereditos que a TELA mostra como aviso na etapa 1 — e que param o "Continuar" até a
 * pessoa agir. Os outros deixam seguir:
 *
 *   - `sessao_alheia` e `sessao_propria`: a sessão é estado VIVO do navegador, e a tela já o
 *     conhece pelo Clerk (`sessaoEDeOutraPessoa`, `jaTemSessaoUtil`). Usar o veredito do
 *     servidor para isso mostraria um aviso velho depois de a pessoa sair da conta
 *   - `limite`: 🔴 NÃO PARA, e não diz nada. Retificação do plano (ADR-0028 D-08): parar quem
 *     estourou cinco conferências trancaria por uma hora o paciente que corrigiu os dados várias
 *     vezes. A proteção contra o oráculo é NÃO RESPONDER — e isso vale seguindo. A action final
 *     confere o CPF de qualquer jeito
 *   - `indisponivel`: falha nossa não trava o paciente
 *   - `telefone_conhecido`: 🔴 NÃO é aviso desde 28/09/2026 (`DO-68`) — virou BLOQUEIO NO CAMPO
 *     do telefone, com "este número está em uso". Ver `telefoneEmUso` e `TEXTO_DO_TELEFONE_EM_USO`
 */
export const VEREDITOS_COM_AVISO = [
  'cpf_em_outra_conta',
  'conta_pelo_email',
] as const satisfies readonly Veredito[];

export type VereditoComAviso = (typeof VEREDITOS_COM_AVISO)[number];

export function temAviso(v: Veredito | null | undefined): v is VereditoComAviso {
  return (VEREDITOS_COM_AVISO as readonly string[]).includes(v ?? '');
}

export interface EntradaDaConferencia {
  cpf?: string | null;
  email?: string | null;
  telefone?: string | null;
}

/**
 * O que o banco respondeu. **Interno** — `users.id` de outras pessoas nunca sai do servidor.
 *
 * `contaDoEmail` separa a linha de `users` que TEM conta de acesso (`clerkId`) da que não tem:
 * o admin cria `users` sem `clerkId` (`app/_actions/pacientes.ts`), e mandar essa pessoa "entrar
 * na conta" seria mandá-la para uma conta que não existe. Sem `clerkId`, a linha é só a MESMA
 * pessoa, e a action do cadastro já liga a conta nova a ela pelo e-mail.
 */
export interface Achados {
  /** A conta do e-mail DIGITADO — decide só o "entre na sua conta" (ADR-0016 D-07). */
  contaDoEmail: { userId: string; temAcesso: boolean } | null;
  /**
   * 🔴 A conta do e-mail DO LINK — é ela que diz de quem são o CPF e o telefone.
   *
   * Achado na revisão de segurança de 28/09/2026: com o e-mail DIGITADO como referência, a etapa
   * 1 virava um oráculo que ligava identidades — mandar o e-mail E e o CPF C respondia "C é da
   * conta de E" (`conta_pelo_email`) ou "não é" (`cpf_em_outra_conta`). O e-mail do link veio de
   * quem emitiu o link (a Greens, o bot, o admin), e o digitado veio de quem o abriu.
   *
   * ⚠️ O custo, aceito e escrito: quem CORRIGIU o e-mail para o da própria conta antiga, que tem
   * aquele CPF, vai ao suporte em vez de ir ao login. É raro, e o suporte resolve.
   */
  contaDoEmailDoLink: string | null;
  donosDoCpf: string[];
  donosDoTelefone: string[];
}

export type EstadoDaSessao =
  | { estado: 'nenhuma' }
  | { estado: 'propria'; userId: string | null }
  | { estado: 'alheia' };

/** CPF que se confere: só dígitos, e só se o dígito verificador fecha. */
export function cpfParaConferir(valor: string | null | undefined): string | null {
  return cpfEhValido(valor) ? somenteDigitosDoCpf(valor) : null;
}

export function emailParaConferir(valor: string | null | undefined): string | null {
  const limpo = (valor ?? '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpo) ? limpo : null;
}

/**
 * O número NACIONAL do celular — DDD + 9 + número, 11 dígitos.
 *
 * ⚠️ Por que 11 e não 8, como a triagem (`lib/chatpro/triagem.ts`): 8 dígitos casam números de
 * DDDs diferentes. A triagem só INFORMA um candidato; aqui o veredito muda o que a pessoa vê.
 * Um fixo de 10 dígitos não casa — falso negativo aceito, porque errar para "não achou" deixa a
 * pessoa seguir como hoje (ADR-0028 D-03).
 */
export function telefoneParaConferir(valor: string | null | undefined): string | null {
  const bruto = (valor ?? '').trim();
  if (!bruto) return null;
  const digitos = (normalizarTelefoneWhatsapp(bruto) ?? bruto).replace(/\D/g, '');
  /**
   * 🔴 O NÚMERO NACIONAL, e não "os últimos 11 do que vier". Achado pelo guarda ao nascer: o
   * fixo `(11) 3333-4444` normaliza para `+551133334444`, e os últimos 11 dígitos disso são
   * `51133334444` — o "5" do DDI colado ao DDD. Esse valor casa com o fixo gravado em E.164 e
   * NÃO casa com o mesmo fixo gravado sem DDI: o mesmo número daria respostas diferentes
   * conforme o formato de quem o gravou.
   *
   * Tira o DDI 55 quando ele está lá, e só confere o que sobra com 11 dígitos — o celular.
   */
  const nacional = digitos.length >= 12 && digitos.startsWith('55') ? digitos.slice(2) : digitos;
  return nacional.length === 11 ? nacional : null;
}

/**
 * A DECISÃO — pura, sem banco. A ordem é a regra:
 *
 *   1. sessão de outra pessoa: resolve-se antes de tudo ("é você?"), porque ela decide de quem
 *      são os dados que vêm depois (`DO-60`)
 *   2. CPF em OUTRA conta: suporte (`DO-62`). "Outra" = não é a conta da sessão nem a do e-mail
 *      DO LINK (ver `contaDoEmailDoLink`)
 *   3. telefone de OUTRA conta: trava o campo (`DO-68`). Vem ANTES da sessão própria — achado na
 *      revisão de backend: depois dela, quem estava logado só descobria o bloqueio no envio final,
 *      que é o contrário de `DO-59`
 *   4. sessão da própria pessoa: segue, sem criar conta
 *   5. e-mail com conta de acesso: login (ADR-0016 D-07)
 *   6. nada: livre
 *
 * 🔴 CPF IGUAL NA CONTA DO MESMO E-MAIL É A MESMA PESSOA VOLTANDO — resposta E, 28/09/2026:
 * login, não suporte. Mandar ao suporte todo CPF que bate levaria toda recompra a um atendente.
 */
export function decidirVeredito(params: { achados: Achados; sessao: EstadoDaSessao }): Veredito {
  const { achados, sessao } = params;

  if (sessao.estado === 'alheia') return 'sessao_alheia';

  const referencia =
    (sessao.estado === 'propria' ? sessao.userId : null) ?? achados.contaDoEmailDoLink ?? null;

  if (achados.donosDoCpf.some((id) => id !== referencia)) return 'cpf_em_outra_conta';
  if (achados.donosDoTelefone.some((id) => id !== referencia)) return 'telefone_conhecido';
  if (sessao.estado === 'propria') return 'sessao_propria';
  if (achados.contaDoEmail?.temAcesso) return 'conta_pelo_email';

  return 'livre';
}

/**
 * Os limites. Cinco conferências por link numa hora cobrem quem corrige um dado duas ou três
 * vezes; um ataque que teste CPFs precisa de milhares. O teto por IP pega quem tenta com vários
 * links do mesmo lugar.
 *
 * ⚠️ Moram AQUI, e não na action, porque arquivo `'use server'` só pode exportar função
 * assíncrona — o `pnpm build` recusou, e o type-check e os testes não acusavam. E aqui o guarda e a
 * integração os leem sem importar a action.
 *
 * ⚠️ O contador é por PROCESSO (Item 31) — com um `behemp-site` no PM2, basta. Declarado.
 */
export const LIMITE_POR_SOLICITACAO = 5;
export const LIMITE_POR_IP = 30;
export const JANELA_DO_LIMITE_EM_SEGUNDOS = 3600;

/**
 * 🔴 O TELEFONE DE OUTRA CONTA TRAVA O CAMPO — `DO-68`, decisão de 28/09/2026: _"se o telefone ja
 * tem conta ela não pode colocar esse telefone, deve-se ficar bloqueado com aviso na caixa de
 * texto informando que este numero está em uso"_.
 *
 * ⚠️ ISTO REVELA QUE O NÚMERO TEM CONTA, e foi decidido sabendo disso. É a exceção declarada à
 * regra de não dizer o que bateu (`OWASP-01`): o CPF continua sem ser revelado. O que segura o
 * oráculo aqui é o limite de 5 conferências por link, e o mesmo bloqueio na action final.
 *
 * O que NÃO trava: o telefone da conta da própria pessoa (a do e-mail ou a da sessão).
 */
export function telefoneEmUso(v: Veredito | null | undefined): boolean {
  return v === 'telefone_conhecido';
}

/**
 * O envio final que estourou o limite de recusas. Não diz QUAL foi o motivo — é o que o limite
 * existe para esconder de quem testa CPFs em loop.
 */
export const TEXTO_DE_MUITAS_TENTATIVAS =
  'Não conseguimos concluir agora. Fale com a gente pelo WhatsApp informando o protocolo.';

export const TEXTO_DO_TELEFONE_EM_USO =
  'Este número está em uso. Informe outro número de telefone para continuar.';

/**
 * O texto de quem parou por CPF. Não diz que o CPF existe — diz o que fazer.
 * Um lugar só, porque a tela e a action falam a mesma frase (e o guarda confere a frase).
 */
export const TEXTO_DO_SUPORTE =
  'Precisamos confirmar alguns dados com a nossa equipe antes de continuar. Fale com a gente pelo WhatsApp informando o protocolo.';

/**
 * O WhatsApp da BeHemp com o PROTOCOLO já na mensagem: é por ele que o suporte acha a solicitação,
 * e ele não é dado pessoal. Nenhum CPF, e-mail ou nome viaja na URL. Um lugar só, porque o aviso
 * do CPF e a saída do telefone em uso usam o mesmo link.
 */
export function linkDoSuporteComProtocolo(base: string, protocolo: string): string {
  const texto = `Olá! Preciso de ajuda para concluir meu cadastro. Protocolo ${protocolo}.`;
  return `${base}?text=${encodeURIComponent(texto)}`;
}
