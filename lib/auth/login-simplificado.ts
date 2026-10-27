/**
 * Regras PURAS do "login simplificado": paciente que entra só com e-mail e senha, sem o código
 * por e-mail, liberado INDIVIDUALMENTE pelo admin.
 *
 * 🔴 Por que existe (27/10/2026): pacientes idosos não conseguem abrir o e-mail e digitar o código
 * que o Clerk exige ao entrar de um aparelho novo (Device Trust). O Clerk só liga/desliga isso
 * para a INSTÂNCIA inteira — não há exceção por usuário (clerk.com/docs/guides/secure/device-trust:
 * "has no settings"). Desligar para todos tiraria a verificação de quem não precisa de exceção.
 *
 * Como funciona, e por que é seguro o bastante:
 *   · O admin liga o flag `loginSimplificado` no `privateMetadata` do Clerk do paciente (só a
 *     Backend API escreve ali; nem o próprio usuário nem o JWT o veem) e define a senha.
 *   · A tela oficial de login (`/entrar`) manda e-mail + senha ao SERVIDOR antes de chamar o Clerk; ele confere o flag, o limite de
 *     tentativas e a senha (Backend API `verifyPassword`) e, só então, emite um ticket de entrada
 *     de uso único e 60 s (`signInTokens`). O navegador troca o ticket por sessão.
 *   · Quem não tem o flag continua no fluxo normal, com código. Nada muda para os outros.
 *
 * ⚠️ O que se perde, e é decisão do dono: para esses pacientes a senha é o ÚNICO fator. Por isso
 * a senha é forte (gerada, ou validada pelo Clerk contra vazamentos), o flag só vale para
 * PACIENTE (nunca admin/médico) e toda tentativa passa por limite.
 *
 * Sem `db`, sem `auth`, sem `next/*`.
 */
import { z } from 'zod';

/** Chave em `privateMetadata` do Clerk. Mudar o nome desliga o recurso de todos, em silêncio. */
export const CHAVE_LOGIN_SIMPLIFICADO = 'loginSimplificado';

/** Tempo de vida do ticket. Ele é de uso único; 60 s só cobre o salto do servidor ao navegador. */
export const VALIDADE_DO_TICKET_EM_SEGUNDOS = 60;

/** Tentativas por e-mail (por janela) e por origem. Ver `entrar-so-com-senha.ts`. */
export const LIMITE_POR_EMAIL = { tentativas: 5, janelaEmSegundos: 15 * 60 } as const;
export const LIMITE_POR_ORIGEM = { tentativas: 20, janelaEmSegundos: 15 * 60 } as const;

/**
 * UMA mensagem para todo motivo de recusa: senha errada, e-mail inexistente, conta sem o flag,
 * conta sem senha. Mensagens diferentes viram oráculo ("este e-mail existe", "este paciente tem
 * acesso simplificado").
 */
export const MENSAGEM_ENTRADA_RECUSADA =
  'E-mail ou senha incorretos, ou este acesso não está liberado para entrar só com senha. ' +
  'Se precisar, use a entrada normal ou fale com a equipe.';

export const MENSAGEM_MUITAS_TENTATIVAS =
  'Muitas tentativas. Aguarde alguns minutos e tente de novo.';

/**
 * Política da senha definida pelo admin. Sem exigir maiúscula/símbolo (é para quem digita
 * devagar), mas com o piso que importa: tamanho, e letra + número. O Clerk ainda confere contra
 * senhas vazadas — `skipPasswordChecks` NÃO é usado: com a senha como único fator, aceitar
 * "maria1234" seria pior do que o código que estamos tirando.
 */
export const senhaDoPacienteSchema = z
  .string()
  .min(8, 'A senha deve ter pelo menos 8 caracteres')
  .max(72, 'Senha muito longa')
  .regex(/[A-Za-z]/, 'A senha deve ter ao menos uma letra')
  .regex(/[0-9]/, 'A senha deve ter ao menos um número');

export const entradaSemCodigoSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  // Sem política aqui: quem entra digita a senha que tem. Só um teto, contra payload absurdo.
  senha: z.string().min(1).max(200),
});

/** O flag, lido de um `privateMetadata` qualquer. Só `true` literal vale. */
export function temLoginSimplificado(privateMetadata: unknown): boolean {
  return (
    typeof privateMetadata === 'object' &&
    privateMetadata !== null &&
    (privateMetadata as Record<string, unknown>)[CHAVE_LOGIN_SIMPLIFICADO] === true
  );
}

/**
 * Alfabeto da senha gerada: minúsculas e dígitos SEM os que se confundem (0/o, 1/l/i). Quem lê a
 * senha por telefone para um idoso digitar precisa de caracteres sem ambiguidade.
 */
export const ALFABETO_DA_SENHA = 'abcdefghjkmnpqrstuvwxyz23456789';
export const TAMANHO_DA_SENHA_GERADA = 10;
const DIGITOS = ALFABETO_DA_SENHA.replace(/[a-z]/g, '');
const LETRAS = ALFABETO_DA_SENHA.replace(/[0-9]/g, '');

/**
 * Gera a senha com uma fonte de bytes aleatórios injetada (no navegador: `crypto.getRandomValues`).
 * Amostragem por rejeição: `byte % tamanho` favoreceria os primeiros símbolos do alfabeto.
 * ~49 bits de entropia com 10 símbolos de um alfabeto de 31.
 *
 * Gerada NO NAVEGADOR do admin de propósito: a senha nunca trafega do servidor para a tela, então
 * não existe resposta de API que a carregue (só o admin a vê, uma vez, e a envia ao servidor
 * para ser guardada como hash pelo Clerk).
 */
export function gerarSenhaLegivel(
  bytesAleatorios: (n: number) => Uint8Array,
  tamanho: number = TAMANHO_DA_SENHA_GERADA,
): string {
  const sortear = (tamanhoDoConjunto: number): number => {
    const teto = 256 - (256 % tamanhoDoConjunto);
    for (;;) {
      for (const byte of bytesAleatorios(16)) {
        if (byte < teto) return byte % tamanhoDoConjunto;
      }
    }
  };
  const doAlfabeto = () => ALFABETO_DA_SENHA[sortear(ALFABETO_DA_SENHA.length)];

  const simbolos = Array.from({ length: tamanho }, doAlfabeto);
  // A política exige letra e número. Sem um dos dois (chance ~3%), troca UMA posição sorteada
  // por um símbolo da classe que falta — sem viés relevante e sem refazer a senha inteira.
  if (!simbolos.some((c) => /[0-9]/.test(c))) {
    simbolos[sortear(tamanho)] = DIGITOS[sortear(DIGITOS.length)];
  }
  if (!simbolos.some((c) => /[a-z]/.test(c))) {
    simbolos[sortear(tamanho)] = LETRAS[sortear(LETRAS.length)];
  }
  return simbolos.join('');
}
