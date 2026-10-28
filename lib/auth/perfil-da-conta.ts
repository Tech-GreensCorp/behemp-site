/**
 * Com qual perfil uma conta NOVA nasce — ADR-0033 D-10.
 *
 * O `/registrar-se` deixa o usuário escolher "Sou o paciente" ou "Sou responsável por um menor" e
 * manda a escolha em `unsafeMetadata.perfil` do Clerk. Este módulo é a ÚNICA tradução dessa entrada
 * em papel, e existe para que a regra de segurança fique num lugar só.
 *
 * 🔴 `unsafeMetadata` É ENTRADA DO USUÁRIO: o Clerk deixa o próprio usuário reescrevê-lo depois. Logo:
 *   1. o perfil só pode ser lido **na CRIAÇÃO da conta** (webhook `user.created` e o fallback de
 *      `/redirect`), validado por um conjunto FECHADO de dois valores, e gravado no banco e no
 *      `publicMetadata` (que só o servidor escreve). NUNCA relido a cada login: senão um paciente
 *      viraria `responsavel` editando o próprio metadado.
 *   2. NUNCA devolve `admin` nem `medico`, qualquer que seja a entrada.
 *   3. conta criada por OAuth (Google) NÃO ganha `responsavel`: o cadastro de responsável é só por
 *      e-mail e senha (decisão de Dryelle, P-14 e P-17b), e o botão do Google já saiu do cadastro.
 *
 * ⚠️ O papel `responsavel` SEM vínculo ativo não alcança nenhum paciente (resolvedor,
 * `lib/auth/escopo-do-responsavel.ts`): o pior caso de um perfil mal escolhido é uma conta vazia.
 */

export type PerfilDeCadastro = 'paciente' | 'responsavel';

export function perfilDaConta(entrada: {
  unsafeMetadata?: Record<string, unknown> | null;
  /** A conta veio de um provedor social (Google…)? Então o perfil escolhido não vale. */
  temContaExterna: boolean;
}): PerfilDeCadastro {
  if (entrada.temContaExterna) return 'paciente';
  return entrada.unsafeMetadata?.perfil === 'responsavel' ? 'responsavel' : 'paciente';
}
